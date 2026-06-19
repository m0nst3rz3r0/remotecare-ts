// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · src/services/sms.ts
// SMS Service — multi-provider bulk messaging
//
// ARCHITECTURE
// ─────────────────────────────────────────────────────────
// Browser → supabase.functions.invoke('send-sms') → Edge Fn
//           → Provider API (AT / Bongolive / Nexah / Twilio / …)
//
// CORS: direct browser→provider calls are blocked by every
// major SMS gateway.  The Supabase Edge Function acts as the
// proxy and holds the secret API keys.  The frontend only
// ever holds the Supabase anon key.
//
// PROVIDERS SUPPORTED
// ─────────────────────────────────────────────────────────
// 'at'         Africa's Talking   (recommended for Tanzania)
// 'bongolive'  Bongolive          (TCRA-registered, local)
// 'nexah'      Nexah              (TCRA-registered, local)
// 'twilio'     Twilio             (international)
// 'vonage'     Vonage / Nexmo     (international)
// 'infobip'    Infobip            (international)
// 'custom'     any REST endpoint via SMSConfig.customEndpoint
//
// STATE-BASED TEMPLATES
// ─────────────────────────────────────────────────────────
// Each SMSReason maps to its own EN/SW template pair in
// SMSConfig.  Fallback order:
//   templateMissed → template  (for missed_appointment)
//   templateLtfu   → template  (for ltfu_warning)
//   templateWelcome→ template  (for welcome)
//   template                   (for reminder — always set)
// ════════════════════════════════════════════════════════════

import type { ClinicSettings, Patient, SMSConfig, SMSLogEntry, SMSReason } from '@/types';
import { isDue } from './clinical';
import { isActivePatientStatus } from './patients';
import { loadSMSConfig, loadSMSLog, saveSMSLog } from './storage';
import { getLastVisit, nextVisitDate, today } from './clinical';
import { decryptPhone } from './phoneEncryption';
import { supabase } from './supabase';

export type SmsPatientTab = 'ltfu' | 'overdue' | 'reminder' | 'all';

// ── Message building ──────────────────────────────────────────

export function buildSMSMessage(
  patient: Patient,
  cfg: SMSConfig,
  lang: 'en' | 'sw',
  nextDate: Date,
  reason: SMSReason = 'reminder'
): string {
  // Pick the right template for this reason + language
  let tpl: string;
  if (lang === 'sw') {
    tpl =
      reason === 'missed_appointment' ? (cfg.templateMissedSw || cfg.templateSw) :
      reason === 'ltfu_warning'       ? (cfg.templateLtfuSw   || cfg.templateSw) :
      reason === 'welcome'            ? (cfg.templateWelcomeSw || cfg.templateSw) :
      cfg.templateSw;
  } else {
    tpl =
      reason === 'missed_appointment' ? (cfg.templateMissed  || cfg.template) :
      reason === 'ltfu_warning'       ? (cfg.templateLtfu    || cfg.template) :
      reason === 'welcome'            ? (cfg.templateWelcome || cfg.template) :
      cfg.template;
  }

  const dateStr = nextDate.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return tpl
    .replace(/{name}/g,     patient.code)
    .replace(/{hospital}/g, patient.hospital ?? 'your clinic')
    .replace(/{date}/g,     dateStr);
}

export function getPatientNextDate(patient: Patient, cfg: ClinicSettings): Date {
  if (patient.scheduledNext?.date) return new Date(patient.scheduledNext.date);
  const lv   = getLastVisit(patient);
  const from = lv?.date ? new Date(lv.date) : new Date(patient.enrol ?? today());
  return nextVisitDate(from, 30, cfg.days);
}

export function daysUntilAppointment(patient: Patient, cfg: ClinicSettings): number {
  const nd = getPatientNextDate(patient, cfg);
  return Math.round((nd.getTime() - Date.now()) / 864e5);
}

export function filterPatientsForSmsTab(
  patients: Patient[],
  tab: SmsPatientTab,
  cfg: ClinicSettings,
  hospital?: string,
): Patient[] {
  let list = patients.filter((p) => p.status !== 'discharged');
  if (hospital) list = list.filter((p) => p.hospital === hospital);

  return list.filter((p) => {
    if (!p.phone) return false;
    switch (tab) {
      case 'ltfu':
        return p.status === 'ltfu';
      case 'overdue':
        return p.status === 'active' && isDue(p);
      case 'reminder':
        if (p.status !== 'active') return false;
        return daysUntilAppointment(p, cfg) >= 0 && daysUntilAppointment(p, cfg) <= 7;
      case 'all':
        return p.status === 'ltfu' || isActivePatientStatus(p.status);
      default:
        return true;
    }
  });
}

/**
 * Determine the SMS reason for a patient based on their current state.
 * Returns null if no SMS should be sent.
 */
export function getPatientSMSReason(
  patient: Patient,
  cfg: ClinicSettings,
  withinDays = 7
): SMSReason | null {
  if (!patient.phone) return null;

  if (patient.status === 'ltfu') return 'ltfu_warning';
  if (patient.status !== 'active') return null;

  const days = daysUntilAppointment(patient, cfg);
  if (days < 0) return 'missed_appointment';
  if (days <= withinDays) return 'reminder';
  if (!(patient.visits ?? []).length) return 'welcome';
  return null;
}

export function patientsNeedingReminders(
  patients: Patient[],
  cfg: ClinicSettings,
  withinDays = 7
): Patient[] {
  return patients.filter(
    (p) => getPatientSMSReason(p, cfg, withinDays) !== null
  );
}

// ── Log helpers (O(1) lookup) ─────────────────────────────────

/**
 * Build an index of last-sent timestamps per patient.
 * Call once per bulk operation — don't re-scan the log per patient.
 */
export function getLastSmsForPatient(
  log: SMSLogEntry[],
  patientId: number,
): SMSLogEntry | null {
  return log
    .filter((e) => e.ptId === patientId && (e.status === 'sent' || e.status === 'demo'))
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0] ?? null;
}

export function formatSmsSentLabel(entry: SMSLogEntry | null): string | null {
  if (!entry) return null;
  const days = Math.floor((Date.now() - new Date(entry.sentAt).getTime()) / 86_400_000);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
  const by = entry.sentBy ? ` · ${entry.sentBy}` : '';
  return `Sent ${when}${by}`;
}

function buildLastSentIndex(log: SMSLogEntry[]): Map<number, number> {
  const idx = new Map<number, number>();
  for (const entry of log) {
    if (entry.status === 'sent' && entry.sentAt) {
      const ts = new Date(entry.sentAt).getTime();
      const prev = idx.get(entry.ptId);
      if (!prev || ts > prev) idx.set(entry.ptId, ts);
    }
  }
  return idx;
}

export function smsAlreadySentRecently(
  patientId: number,
  withinDays = 3,
  lastSentIndex?: Map<number, number>
): boolean {
  // If an index was pre-built (bulk send), use it — O(1)
  if (lastSentIndex) {
    const ts = lastSentIndex.get(patientId);
    if (!ts) return false;
    return (Date.now() - ts) / 864e5 < withinDays;
  }
  // Single-patient path — scan is fine for one record
  const log = loadSMSLog();
  return log.some(
    (l) =>
      l.ptId === patientId &&
      l.status === 'sent' &&
      l.sentAt != null &&
      (Date.now() - new Date(l.sentAt).getTime()) / 864e5 < withinDays
  );
}

// ── Core send function ────────────────────────────────────────

const MAX_RETRIES = 2;
const BULK_RATE_MS = 200; // ~5 messages/second — safe for all providers

export async function sendSMS(
  patient: Patient,
  lang: 'en' | 'sw',
  cfg: SMSConfig,
  clinicCfg: ClinicSettings,
  reason?: SMSReason,
  sentBy?: string,
): Promise<SMSLogEntry> {
  const resolvedReason = reason ?? getPatientSMSReason(patient, clinicCfg) ?? 'reminder';
  const nextDate = getPatientNextDate(patient, clinicCfg);
  const message  = buildSMSMessage(patient, cfg, lang, nextDate, resolvedReason);

  // Decrypt phone number — only here, only for this send operation
  const rawPhone = await decryptPhone(
    patient.phone,
    patient.region,
    patient.district,
    patient.hospital,
  );

  const entry: SMSLogEntry = {
    id:          `sms${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ptId:        patient.id,
    ptCode:      patient.code,
    phone:       rawPhone ?? '',
    message,
    provider:    cfg.provider,
    reason:      resolvedReason,
    lang,
    sentAt:      new Date().toISOString(),
    status:      'queued',
    hospital:    patient.hospital,
    retryCount:  0,
    sentBy:      sentBy?.trim() || undefined,
  };

  if (!rawPhone) {
    entry.status = 'failed';
    entry.note   = 'Phone number could not be decrypted';
    appendToLog(entry);
    return entry;
  }

  // Send via Edge Function (handles CORS + keeps secrets server-side)
  let lastError = '';
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential back-off: 1s, 2s
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
    try {
      const facilityId = [patient.region, patient.district, patient.hospital]
        .join('_').toLowerCase().replace(/\s+/g, '_');

      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          provider:       cfg.provider,
          phone:          rawPhone,
          message,
          senderId:       cfg.senderId,
          facilityId,
          // Provider-specific extras
          atUsername:     cfg.atUsername,
          customEndpoint: cfg.customEndpoint,
          customHeaders:  cfg.customHeaders,
        },
      });

      if (error) throw new Error(error.message);

      entry.status    = data?.status === 'sent' ? 'sent' : 'failed';
      entry.messageId = data?.messageId;
      entry.cost      = data?.cost;
      entry.note      = data?.note;
      entry.retryCount = attempt;

      if (entry.status === 'sent') break;
      lastError = data?.note ?? 'Provider returned failure';
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
      entry.status = 'failed';
    }
  }

  if (entry.status === 'failed') {
    entry.note = lastError || 'Send failed after retries';
  }

  entry.sentAt = new Date().toISOString();
  appendToLog(entry);
  return entry;
}

export async function sendBulkSMS(
  patients: Patient[],
  lang: 'en' | 'sw',
  clinicCfg: ClinicSettings,
  withinDays = 7,
  sentBy?: string,
): Promise<{ sent: number; skipped: number; failed: number }> {
  const cfg = loadSMSConfig();
  const log  = loadSMSLog();
  const lastSentIndex = buildLastSentIndex(log);

  let sent = 0, skipped = 0, failed = 0;

  for (const p of patients) {
    if (!p.phone) { skipped++; continue; }

    const reason = getPatientSMSReason(p, clinicCfg, withinDays);
    if (!reason) { skipped++; continue; }

    // Skip if already sent recently (use pre-built index — O(1))
    if (smsAlreadySentRecently(p.id, 3, lastSentIndex)) { skipped++; continue; }

    const result = await sendSMS(p, lang, cfg, clinicCfg, reason, sentBy);

    if (result.status === 'sent' || result.status === 'demo') {
      sent++;
      // Update the in-memory index so subsequent patients in the same
      // bulk run don't get duplicates if we re-check mid-loop
      lastSentIndex.set(p.id, Date.now());
    } else {
      failed++;
    }

    // Rate limiting — respect gateway quotas
    await new Promise((r) => setTimeout(r, BULK_RATE_MS));
  }

  return { sent, skipped, failed };
}

function appendToLog(entry: SMSLogEntry): void {
  const log = loadSMSLog();
  saveSMSLog([entry, ...log].slice(0, 500)); // keep last 500
}

// ── CSV export ────────────────────────────────────────────────

export function exportSMSLogCSV(log: SMSLogEntry[]): string {
  const header = [
    'Patient', 'Phone (masked)', 'Reason', 'Message',
    'Provider', 'Status', 'Sent At', 'Message ID', 'Cost', 'Hospital',
  ];
  const rows = log.map((l) => [
    l.ptCode,
    maskPhoneForExport(l.phone),
    l.reason ?? 'reminder',
    `"${l.message.replace(/"/g, '""')}"`,
    l.provider,
    l.status,
    l.sentAt ?? '',
    l.messageId ?? '',
    l.cost ?? '',
    l.hospital ?? '',
  ]);
  return [header, ...rows].map((r) => r.join(',')).join('\r\n');
}

function maskPhoneForExport(phone: string): string {
  if (!phone || phone.length <= 3) return phone;
  return '*'.repeat(phone.length - 3) + phone.slice(-3);
}
