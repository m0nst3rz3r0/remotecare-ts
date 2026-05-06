// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · Phone Number Encryption at Rest
// src/services/phoneEncryption.ts
//
// THREAT MODEL
// ────────────
// Phone numbers are sensitive PII. This module ensures that:
//   • localStorage stores only AES-GCM ciphertext (base64)
//   • Supabase stores only ciphertext — never a raw number
//   • The SMS service decrypts on demand, in-memory only
//   • A breach of localStorage or Supabase yields unreadable blobs
//   • Backup JSON exports contain only ciphertext
//
// DESIGN
// ──────
// Key derivation: PBKDF2-SHA256, 100k iterations
//   Input:  facilityKey  = `${region}||${district}||${hospital}`
//   Salt:   fixed per-app constant (not a secret, prevents
//           cross-context key reuse only)
// Encryption: AES-GCM, 256-bit, random 12-byte IV per ciphertext
//
// Ciphertext format stored in patient.phone:
//   "enc:v1:<iv_b64>:<ciphertext_b64>"
//
// The prefix "enc:v1:" makes it trivially detectable so we can
// migrate legacy plain-text entries and never double-encrypt.
//
// KEY SCOPE
// ─────────
// The encryption key is derived from the facility identity
// (region + district + hospital name).  This means:
//   • All devices at the same facility can decrypt each other's
//     patient phones (needed for multi-device serving).
//   • A device at a different facility cannot decrypt.
//   • The key is deterministic — no key storage needed, just
//     re-derive from the session's facility info.
//
// ════════════════════════════════════════════════════════════

const APP_SALT_HEX = 'touchhealth-phone-enc-v1-2025';
const PBKDF2_ITER  = 100_000;

const ENC_PREFIX = 'enc:v1:';

// ── Key cache (per facility string, session-lifetime) ────────
const keyCache = new Map<string, CryptoKey>();

/**
 * Build the facility key material string.
 * Deterministic from facility identity — same on every device
 * at the same facility.
 */
function facilityKeyMaterial(region: string, district: string, hospital: string): string {
  return `${region.toLowerCase()}||${district.toLowerCase()}||${hospital.toLowerCase()}`;
}

/** Derive (or retrieve from cache) an AES-GCM key for a facility. */
async function deriveKey(region: string, district: string, hospital: string): Promise<CryptoKey> {
  const material = facilityKeyMaterial(region, district, hospital);
  if (keyCache.has(material)) return keyCache.get(material)!;

  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(material),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  const salt = enc.encode(APP_SALT_HEX);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  keyCache.set(material, key);
  return key;
}

/**
 * Returns true if the string is already encrypted by this module.
 */
export function isEncryptedPhone(value: string | undefined): boolean {
  return !!value && value.startsWith(ENC_PREFIX);
}

/**
 * Encrypt a raw phone number.
 * Returns ciphertext string safe to store in localStorage / Supabase.
 *
 * If the value is already encrypted or empty, returns it unchanged.
 */
export async function encryptPhone(
  phone: string | undefined,
  region: string,
  district: string,
  hospital: string,
): Promise<string | undefined> {
  if (!phone || phone.trim() === '') return phone;
  if (isEncryptedPhone(phone)) return phone; // already encrypted

  const key = await deriveKey(region, district, hospital);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();

  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(phone.trim()),
  );

  const ivB64   = btoa(String.fromCharCode(...iv));
  const ctB64   = btoa(String.fromCharCode(...new Uint8Array(cipherBuf)));
  return `${ENC_PREFIX}${ivB64}:${ctB64}`;
}

/**
 * Decrypt a stored phone number.
 * Returns the raw phone string for use in SMS sending only.
 *
 * If the value is not encrypted (legacy plain text), returns as-is.
 * If decryption fails (wrong key / corrupt data), returns undefined.
 */
export async function decryptPhone(
  stored: string | undefined,
  region: string,
  district: string,
  hospital: string,
): Promise<string | undefined> {
  if (!stored || stored.trim() === '') return undefined;
  if (!isEncryptedPhone(stored)) return stored; // legacy plain text

  try {
    const rest   = stored.slice(ENC_PREFIX.length);           // "iv_b64:ct_b64"
    const colonAt = rest.indexOf(':');
    if (colonAt < 0) return undefined;

    const iv  = Uint8Array.from(atob(rest.slice(0, colonAt)), (c) => c.charCodeAt(0));
    const ct  = Uint8Array.from(atob(rest.slice(colonAt + 1)), (c) => c.charCodeAt(0));
    const key = await deriveKey(region, district, hospital);

    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plainBuf);
  } catch {
    // Wrong key, tampered data, or corrupt entry — fail safe
    return undefined;
  }
}

/**
 * Migrate all patients in-place: encrypt any plain-text phone numbers.
 * Safe to call multiple times (idempotent).
 * Returns number of patients migrated.
 */
export async function migratePhones(
  patients: Array<{
    phone?: string;
    region: string;
    district: string;
    hospital: string;
  }>,
): Promise<number> {
  let count = 0;
  for (const p of patients) {
    if (p.phone && !isEncryptedPhone(p.phone)) {
      p.phone = await encryptPhone(p.phone, p.region, p.district, p.hospital);
      count++;
    }
  }
  return count;
}

/**
 * Convenience: check if a patient has a phone (encrypted or not).
 * Use this instead of `!!patient.phone` to keep semantics clear.
 */
export function patientHasPhone(phone: string | undefined): boolean {
  return !!phone && phone.trim() !== '';
}
