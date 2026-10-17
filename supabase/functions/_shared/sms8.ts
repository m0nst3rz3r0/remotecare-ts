export type SendStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'unknown';
export interface ProviderResult { status: SendStatus; messageId?: string; note?: string }

export function normalizePhone(value: string): string | null {
  let phone = value.trim().replace(/[\s()-]/g, '');
  if (/^0[67]\d{8}$/.test(phone)) phone = '+255' + phone.slice(1);
  else if (/^255[67]\d{8}$/.test(phone)) phone = '+' + phone;
  else if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  if (phone.startsWith('+255')) return /^\+255[67]\d{8}$/.test(phone) ? phone : null;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function maskPhone(value: string): string {
  return value ? '*'.repeat(Math.max(0, value.length - 3)) + value.slice(-3) : '';
}

export function parseSMS8(payload: unknown, expectedId?: string): ProviderResult {
  if (!payload || typeof payload !== 'object') return { status: 'unknown', note: 'Invalid gateway response; do not resubmit.' };
  const envelope = payload as Record<string, unknown>;
  if (envelope.success === false) return { status: 'failed', note: 'SMS8 rejected the request. Check gateway configuration and credits.' };
  if (envelope.success !== true) return { status: 'unknown', note: 'Gateway acceptance is uncertain; do not resubmit.' };
  const data = envelope.data;
  const messages = Array.isArray(data) ? data : (data && typeof data === 'object' ? (data as { messages?: unknown }).messages : null);
  if (!Array.isArray(messages)) return { status: 'unknown', note: 'Missing gateway message ID; do not resubmit.' };
  const message = messages.find((m) => m && typeof m === 'object' && (!expectedId || String(m.ID) === expectedId));
  if (!message || message.ID == null) return { status: 'unknown', note: 'Message not found at gateway; do not resubmit.' };
  const statuses: Record<string, SendStatus> = { pending: 'queued', queued: 'queued', scheduled: 'queued', sent: 'sent', delivered: 'delivered', failed: 'failed', expired: 'failed' };
  const status = statuses[String(message.status).toLowerCase()] ?? 'unknown';
  return { status, messageId: String(message.ID), note: status === 'unknown' ? 'Gateway status is uncertain; refresh before taking action.' : undefined };
}

export async function callSMS8(key: string, fields: Record<string, string>, read = false, fetcher: typeof fetch = fetch): Promise<ProviderResult> {
  try {
    const response = await fetcher(`https://app.sms8.io/api/v1/messages${read ? '/read' : ''}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key, ...fields }), signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { status: 'unknown', note: 'Gateway response is uncertain; do not resubmit.' };
    return parseSMS8(await response.json(), read ? fields['ids[]'] : undefined);
  } catch {
    return { status: 'unknown', note: 'Gateway connection interrupted; acceptance is uncertain. Do not resubmit.' };
  }
}

// Compatibility reader for existing enc:v1 patient records. This legacy key
// derives from public facility names; replacing it requires a separate migration.
export async function readPatientPhone(patient: { phone: string | null; region: string; district: string; hospital: string }): Promise<string | null> {
  const value = patient.phone;
  if (!value) return null;
  if (!value.startsWith('enc:v1:')) return normalizePhone(value);
  try {
    const [ivText, cipherText] = value.slice(7).split(':');
    const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const material = `${patient.region.toLowerCase()}||${patient.district.toLowerCase()}||${patient.hospital.toLowerCase()}`;
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(material), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: new TextEncoder().encode('touchhealth-phone-enc-v1-2025'), iterations: 100_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(ivText) }, key, bytes(cipherText));
    return normalizePhone(new TextDecoder().decode(plain));
  } catch { return null; }
}
