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
// SMS8 is implemented in this repository. Other provider configurations are
// retained for compatibility and require separately deployed server adapters.
// SMS8 credentials and Android device selection are server-side only.
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
import { getPatientNextVisitDate, isDueWithSettings } from './clinical';
import { isActivePatientStatus } from './patients';
import { loadSMSConfig, loadSMSLog, saveSMSLog } from './storage';
import { today } from './clinical';
import { randomUUID } from '../utils/id';
import { getDeviceHardwareId } from './deviceManager';
import { getDevicePrefix } from './devicePrefix';
import { maskPhone } from '../utils/phone';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase, requireOnlineSession } from './supabase';

export type SmsPatientTab = 'ltfu' | 'overdue' | 'reminder' | 'all';

export interface SMSPreview {
  patient: Patient;
  reason: SMSReason;
  nextDate: Date;
  daysUntil: number;
  message: string;
  hasPhone: boolean;
}

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

  const dateStr = nextDate.toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const message = tpl
    .replace(/{name}/g,     patient.code)
    .replace(/{hospital}/g, patient.hospital ?? 'your clinic')
    .replace(/{date}/g,     dateStr);
  return cfg.provider === 'sms8' && patient.hospital && !message.includes(patient.hospital)
    ? `${patient.hospital}: ${message}` : message;
}

export function getPatientNextDate(patient: Patient, cfg: ClinicSettings): Date {
  if (!cfg) return new Date(patient.scheduledNext?.date ?? patient.enrol ?? today());
  return getPatientNextVisitDate(patient, cfg);
}

export function daysUntilAppointment(patient: Patient, cfg: ClinicSettings): number {
  const nd = getPatientNextDate(patient, cfg);
  return Math.round((nd.getTime() - Date.now()) / 864e5);
}

export function resolvePatientSMSReason(
  patient: Patient,
  cfg: ClinicSettings,
  overrideReason?: SMSReason | null,
  withinDays = 7,
): SMSReason | null {
  return overrideReason ?? getPatientSMSReason(patient, cfg, withinDays);
}

export function buildSMSPreview(
  patient: Patient,
  cfg: SMSConfig,
  clinicCfg: ClinicSettings,
  lang: 'en' | 'sw',
  overrideReason?: SMSReason | null,
): SMSPreview | null {
  const reason = resolvePatientSMSReason(patient, clinicCfg, overrideReason);
  if (!reason) return null;

  const nextDate = getPatientNextDate(patient, clinicCfg);
  return {
    patient,
    reason,
    nextDate,
    daysUntil: daysUntilAppointment(patient, clinicCfg),
    message: buildSMSMessage(patient, cfg, lang, nextDate, reason),
    hasPhone: !!patient.phone,
  };
}

export function getBulkSendCandidates(
  patients: Patient[],
  clinicCfg: ClinicSettings,
  overrides: Record<number, SMSReason> = {},
): Array<{ patient: Patient; reason: SMSReason }> {
  return patients.flatMap((patient) => {
    const reason = resolvePatientSMSReason(patient, clinicCfg, overrides[patient.id]);
    return patient.phone && reason ? [{ patient, reason }] : [];
  });
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
        return p.status === 'active' && isDueWithSettings(p, cfg);
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
  if (!(patient.visits ?? []).length && days >= 0 && days <= withinDays) return 'welcome';
  if (days < 0) return 'missed_appointment';
  if (days <= withinDays) return 'reminder';
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
    .filter((e) => e.ptId === patientId)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0] ?? null;
}

export function formatSmsSentLabel(entry: SMSLogEntry | null): string | null {
  if (!entry) return null;
  const days = Math.floor((Date.now() - new Date(entry.sentAt).getTime()) / 86_400_000);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
  const by = entry.sentBy ? ` · ${entry.sentBy}` : '';
  const label = entry.status === 'unknown' ? 'Uncertain' : entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
  return `${label} ${when}${by}`;
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
      (['queued', 'unknown'].includes(l.status) ||
        (['sent', 'delivered'].includes(l.status) && l.sentAt != null &&
          (Date.now() - new Date(l.sentAt).getTime()) / 864e5 < withinDays))
  );
}

// ── Core send function ────────────────────────────────────────

export interface SmsBatchResult { sent: number; queued: number; unknown: number; failed: number; skipped: number }
export interface SmsSendOptions { resendOverride?: boolean; requestId?: string }

export function smsOutcomeLabel(entry: SMSLogEntry): string {
  const label = entry.status === 'unknown' ? 'Uncertain ? check shared history before resending' : entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
  return (entry.duplicate ? 'Already requested: ' : '') + label + (entry.note ? ': ' + entry.note : '');
}

export async function sendSMS(
  patient: Patient, lang: 'en' | 'sw', cfg: SMSConfig, clinicCfg: ClinicSettings,
  reason?: SMSReason, sentBy?: string, options: SmsSendOptions = {},
): Promise<SMSLogEntry> {
  await requireOnlineSession();
  const resolvedReason = reason ?? getPatientSMSReason(patient, clinicCfg) ?? 'reminder';
  const message = buildSMSMessage(patient, cfg, lang, getPatientNextDate(patient, clinicCfg), resolvedReason);
  // Reuse an uncertain request's ID. Repeating the HTTP request cannot submit
  // a second SMS once the server has reserved that ID.
  const pending = loadSMSLog().find((e) => e.ptId === patient.id && e.status === 'unknown' && e.message === message && e.provider === cfg.provider);
  const entry: SMSLogEntry = {
    id: options.requestId ?? pending?.id ?? randomUUID(), ptId: patient.id, ptCode: patient.code,
    phone: patient.phone ? maskPhone(patient.phone) : '', message, provider: cfg.provider,
    reason: resolvedReason, lang, sentAt: pending?.sentAt ?? new Date().toISOString(),
    status: 'unknown', hospital: patient.hospital, sentBy,
    deviceId: getDeviceHardwareId(), deviceLetter: getDevicePrefix() ?? undefined,
  };
  appendToLog(entry);
  try {
    const { data, error } = await supabase.functions.invoke('send-sms', { body: {
      provider: cfg.provider, patientId: patient.id, patientCode: patient.code, message,
      reason: resolvedReason, lang, requestId: entry.id, deviceId: entry.deviceId,
      resendOverride: options.resendOverride === true,
    } });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const payload = await error.context.json().catch(() => ({}));
        const status = error.context.status;
        entry.status = [400,401,403,404,409,429].includes(status) ? 'failed' : 'unknown';
        entry.note = payload.error ?? 'Send interrupted. Check shared history.';
      } else {
        entry.note = 'Connection interrupted; acceptance is uncertain. Refresh shared history before resending.';
      }
    } else if (data?.entry) {
      Object.assign(entry, data.entry, { duplicate: data.duplicate === true });
    } else {
      entry.note = 'Missing server response. Refresh shared history before resending.';
    }
  } catch {
    entry.note = 'Connection interrupted; acceptance is uncertain. Refresh shared history before resending.';
  }
  appendToLog(entry);
  return entry;
}

export async function sendSMSBatch(
  candidates: Array<{ patient: Patient; reason: SMSReason }>, lang: 'en' | 'sw', cfg: SMSConfig,
  clinicCfg: ClinicSettings, sentBy?: string,
  controls: { isCancelled?: () => boolean; onProgress?: (current: number, total: number) => void; onEntry?: (entry: SMSLogEntry) => void } = {},
): Promise<SmsBatchResult> {
  await requireOnlineSession();
  const result: SmsBatchResult = { sent: 0, queued: 0, unknown: 0, failed: 0, skipped: 0 };
  for (let i = 0; i < candidates.length; i++) {
    if (controls.isCancelled?.()) { result.skipped += candidates.length - i; break; }
    controls.onProgress?.(i + 1, candidates.length);
    const { patient, reason } = candidates[i];
    if (!patient.phone || smsAlreadySentRecently(patient.id, 3)) { result.skipped++; continue; }
    try {
      const entry = await sendSMS(patient, lang, cfg, clinicCfg, reason, sentBy);
      if (entry.duplicate) result.skipped++;
      else if (entry.status === 'sent' || entry.status === 'delivered' || entry.status === 'demo') result.sent++;
      else result[entry.status]++;
      controls.onEntry?.(entry);
    } catch { result.failed++; }
    if (i < candidates.length - 1) await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  return result;
}

export async function sendBulkSMS(patients: Patient[], lang: 'en' | 'sw', clinicCfg: ClinicSettings, withinDays = 7, sentBy?: string): Promise<SmsBatchResult> {
  const candidates = patients.flatMap((patient) => {
    const reason = getPatientSMSReason(patient, clinicCfg, withinDays);
    return patient.phone && reason ? [{ patient, reason }] : [];
  });
  const result = await sendSMSBatch(candidates, lang, loadSMSConfig(), clinicCfg, sentBy);
  result.skipped += patients.length - candidates.length;
  return result;
}

function appendToLog(entry: SMSLogEntry): void {
  saveSMSLog([entry, ...loadSMSLog().filter((e) => e.id !== entry.id)].slice(0, 500));
}

export async function getSyncedPatientIds(): Promise<Set<number>> {
  await requireOnlineSession();
  const ids = new Set<number>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('patients').select('id').is('deleted_at', null).order('id').range(offset, offset + 999);
    if (error) throw new Error(error.message);
    for (const patient of data ?? []) ids.add(Number(patient.id));
    if (!data || data.length < 1000) return ids;
  }
}

export async function refreshSMSHistory(): Promise<SMSLogEntry[]> {
  await requireOnlineSession();
  const { data, error } = await supabase.from('sms_requests').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  const entries: SMSLogEntry[] = (data ?? []).map((r) => ({
    id: r.id, ptId: Number(r.patient_id), ptCode: r.patient_code, phone: r.phone_masked,
    message: r.message, provider: r.provider, reason: r.reason, lang: r.lang,
    sentAt: r.created_at, status: r.status, hospital: r.hospital, messageId: r.message_id,
    note: r.note, sentBy: r.actor_name, deviceId: r.device_id, deviceLetter: r.device_letter,
  }));
  const ids = new Set(entries.map((e) => e.id));
  saveSMSLog([...entries, ...loadSMSLog().filter((e) => !ids.has(e.id))].slice(0, 500));
  return loadSMSLog();
}

export async function refreshSMSStatus(requestId: string): Promise<SMSLogEntry> {
  await requireOnlineSession();
  const { data, error } = await supabase.functions.invoke('sms-status', { body: { requestId } });
  if (error || !data?.entry) throw new Error(data?.error ?? error?.message ?? 'Status refresh failed');
  const entry = { ...data.entry, note: data.warning ?? data.entry.note } as SMSLogEntry;
  appendToLog(entry);
  return entry;
}

export async function getSMS8Sender(): Promise<{ senderNumber: string; configured: boolean }> {
  await requireOnlineSession();
  const { data, error } = await supabase.functions.invoke('sms-status', { body: {} });
  if (error) throw new Error(error.message);
  return data;
}

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
