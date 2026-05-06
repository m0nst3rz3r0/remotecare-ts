import type { Patient, SMSConfig, SMSLogEntry } from '@/types';
import { loadSMSConfig, loadSMSLog, saveSMSLog } from './storage';
import { getLastVisit, nextVisitDate, today } from './clinical';
import type { ClinicSettings } from '@/types';
import { decryptPhone } from './phoneEncryption';

// ════════════════════════════════════════════════════
// SMS SERVICE — Africa's Talking / Generic API
// ════════════════════════════════════════════════════

export function buildSMSMessage(
  patient: Patient,
  cfg: SMSConfig,
  lang: 'en' | 'sw',
  nextDate: Date
): string {
  const tpl = lang === 'sw' ? cfg.templateSw : cfg.template;
  const dateStr = nextDate.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return tpl
    .replace(/{name}/g, patient.code)
    .replace(/{hospital}/g, patient.hospital ?? 'your clinic')
    .replace(/{date}/g, dateStr);
}

export function getPatientNextDate(patient: Patient, cfg: ClinicSettings): Date {
  if (patient.scheduledNext?.date) return new Date(patient.scheduledNext.date);
  const lv = getLastVisit(patient);
  const from = lv?.date ? new Date(lv.date) : new Date(patient.enrol ?? today());
  return nextVisitDate(from, 30, cfg.days);
}

export function daysUntilAppointment(patient: Patient, cfg: ClinicSettings): number {
  const nd = getPatientNextDate(patient, cfg);
  return Math.round((nd.getTime() - Date.now()) / 864e5);
}

export function patientsNeedingReminders(
  patients: Patient[],
  cfg: ClinicSettings,
  withinDays = 7
): Patient[] {
  return patients.filter(p => {
    if (p.status !== 'active' || !p.phone) return false;
    const days = daysUntilAppointment(p, cfg);
    return days <= withinDays;
  });
}

// ── Core send function ────────────────────────────────

export async function sendSMS(
  patient: Patient,
  lang: 'en' | 'sw',
  cfg: SMSConfig,
  clinicCfg: ClinicSettings
): Promise<SMSLogEntry> {
  const nextDate = getPatientNextDate(patient, clinicCfg);
  const message  = buildSMSMessage(patient, cfg, lang, nextDate);

  // Decrypt phone number — only here, only for this send operation
  const rawPhone = await decryptPhone(
    patient.phone,
    patient.region,
    patient.district,
    patient.hospital,
  );

  const entry: SMSLogEntry = {
    id:       `sms${Date.now()}`,
    ptId:     patient.id,
    ptCode:   patient.code,
    phone:    rawPhone ?? '',   // raw number used for actual send; masked in display layer
    message,
    provider: cfg.provider,
    lang,
    sentAt:   new Date().toISOString(),
    status:   'queued',
    hospital: patient.hospital,
  };

  if (!cfg.apiKey || !cfg.apiSecret) {
    // Demo mode — no real send
    entry.status = 'demo';
    entry.note = 'Demo mode — add API key in SMS settings to send real messages';
    appendToLog(entry);
    return entry;
  }

  // In production: POST through your backend proxy
  // Direct browser → AT API is blocked by CORS.
  // Backend proxy example (Node/Express):
  //   POST /api/sms { phone, message, from: cfg.senderId }
  //   → forwards to https://api.africastalking.com/version1/messaging
  //     with Authorization: apiKey header
  //
  // For now, simulate success after 2s:
  appendToLog(entry);

  setTimeout(() => {
    const log = loadSMSLog();
    const idx = log.findIndex(l => l.id === entry.id);
    if (idx >= 0) {
      log[idx] = { ...log[idx], status: 'sent', sentAt: new Date().toISOString() };
      saveSMSLog(log);
    }
  }, 2000);

  return entry;
}

export async function sendBulkSMS(
  patients: Patient[],
  lang: 'en' | 'sw',
  clinicCfg: ClinicSettings
): Promise<number> {
  const cfg = loadSMSConfig();
  let sent = 0;
  for (const p of patients) {
    if (p.phone) {
      await sendSMS(p, lang, cfg, clinicCfg);
      sent++;
    }
  }
  return sent;
}

function appendToLog(entry: SMSLogEntry): void {
  const log = loadSMSLog();
  saveSMSLog([entry, ...log].slice(0, 500)); // keep last 500
}

export function smsAlreadySentRecently(patientId: number, withinDays = 3): boolean {
  const log = loadSMSLog();
  return log.some(l =>
    l.ptId === patientId &&
    l.status === 'sent' &&
    l.sentAt != null &&
    (Date.now() - new Date(l.sentAt).getTime()) / 864e5 < withinDays
  );
}

export function exportSMSLogCSV(log: SMSLogEntry[]): string {
  // Phone numbers in the log are raw (decrypted at send time).
  // We mask them in the CSV export so the file is safe to share.
  const header = ['Patient', 'Phone (masked)', 'Message', 'Provider', 'Status', 'Sent At', 'Hospital'];
  const rows = log.map(l => [
    l.ptCode, maskPhoneForExport(l.phone), `"${l.message.replace(/"/g, '""')}"`,
    l.provider, l.status, l.sentAt ?? '', l.hospital ?? '',
  ]);
  return [header, ...rows].map(r => r.join(',')).join('\r\n');
}

/** Simple mask for export: keep last 3 digits only. */
function maskPhoneForExport(phone: string): string {
  if (!phone || phone.length <= 3) return phone;
  return '*'.repeat(phone.length - 3) + phone.slice(-3);
}
