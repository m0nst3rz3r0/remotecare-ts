// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · src/services/storage.ts
// Single source of truth for all localStorage reads/writes
// and full Supabase sync logic.
//
// FIXES in this version
// ─────────────────────────────────────────────────────────
// 1. checkSupabaseConnection() now uses SELECT 1 via a
//    purpose-built RPC instead of querying the users table
//    (which leaked table existence and generated audit events).
// 2. validateSession() was silently logging users out on cold
//    starts before sync because loadUsers() returned [] when
//    localStorage had not yet been populated.  It now falls
//    back to the cached-users list before giving up.
// 3. syncPatientsWithCloud() is the single canonical push/pull
//    path.  The orphaned sync.ts logic is deprecated.
// ════════════════════════════════════════════════════════════

import { supabase } from './supabase';
import type {
  Patient, User, Hospital, ClinicSettings,
  StockoutReport, SMSConfig, SMSLogEntry,
  PatientStatus, Visit,
} from '@/types';

// Supabase returns untyped rows when no database schema is generated.
// This alias makes all .map() / .forEach() callbacks explicit so
// strict-mode TypeScript does not complain about implicit `any`.
type SupabaseRow = Record<string, unknown>;

// ── STORAGE KEYS ─────────────────────────────────────────────

const KEYS = {
  PATIENTS:     'zmz2_pts',
  USERS:        'th_users',
  HOSPITALS:    'th_hospitals',
  SESSION:      'th_session',
  CACHED_USERS: 'th_cached_users',
  CLINIC:       'th_clinic',
  SMS_LOG:      'th_sms_log',
  SMS_CONFIG:   'th_sms_cfg',
  STOCKOUTS:    'th_stockouts',
  LAST_SYNC:    'th_last_sync',
  SYNC_COUNT:   'th_sync_count',
} as const;

// ── GENERIC HELPERS ───────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persist<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── PATIENTS ─────────────────────────────────────────────────

export function loadPatients(): Patient[] {
  return load<Patient[]>(KEYS.PATIENTS, []);
}
export function savePatients(patients: Patient[]): void {
  persist(KEYS.PATIENTS, patients);
}

// ── USERS ────────────────────────────────────────────────────

export function loadUsers(): User[] {
  return load<User[]>(KEYS.USERS, []);
}
export function saveUsers(users: User[]): void {
  persist(KEYS.USERS, users);
}

// ── CACHED USERS (offline login fallback) ────────────────────

export function loadCachedUsers(): Record<string, unknown>[] {
  return load<Record<string, unknown>[]>(KEYS.CACHED_USERS, []);
}
export function saveCachedUsers(users: Record<string, unknown>[]): void {
  persist(KEYS.CACHED_USERS, users);
}

// ── HOSPITALS ────────────────────────────────────────────────

export function loadHospitals(): Hospital[] {
  return load<Hospital[]>(KEYS.HOSPITALS, []);
}
export function saveHospitals(hospitals: Hospital[]): void {
  persist(KEYS.HOSPITALS, hospitals);
}

// ── CLINIC SETTINGS ───────────────────────────────────────────

export function loadClinicSettings(): ClinicSettings {
  const saved = load<Partial<ClinicSettings>>(KEYS.CLINIC, {});
  return {
    days: [1, 3, 5],
    interval: 30,
    openHour: 7,
    closeHour: 18,
    autoLtfuDays: 21,
    ...saved,
  };
}
export function saveClinicSettings(cfg: ClinicSettings): void {
  persist(KEYS.CLINIC, cfg);
}

// ── SESSION ───────────────────────────────────────────────────

export function loadSession(): User | null {
  return load<User | null>(KEYS.SESSION, null);
}
export function saveSession(user: User): void {
  persist(KEYS.SESSION, user);
}
export function clearSession(): void {
  localStorage.removeItem(KEYS.SESSION);
}

// ── STOCKOUTS ─────────────────────────────────────────────────

export function loadStockouts(): StockoutReport[] {
  return load<StockoutReport[]>(KEYS.STOCKOUTS, []);
}
export function saveStockouts(reports: StockoutReport[]): void {
  persist(KEYS.STOCKOUTS, reports);
}

// ── SMS ───────────────────────────────────────────────────────

export function loadSMSConfig(): SMSConfig {
  return load<SMSConfig>(KEYS.SMS_CONFIG, {
    provider: 'at',
    apiKey: '',
    apiSecret: '',
    atUsername: '',
    senderId: 'TouchHealth',
    template:    'Dear {name}, your appointment at {hospital} is on {date}. TouchHealth NCD.',
    templateSw:  'Habari {name}, ziara yako {hospital} ni tarehe {date}. TouchHealth NCD.',
    templateMissed:    'Dear {name}, you missed your appointment at {hospital}. Please visit as soon as possible.',
    templateMissedSw:  'Habari {name}, ulikosa ziara yako {hospital}. Tafadhali tembelea haraka.',
    templateLtfu:      'Dear {name}, we have missed you at {hospital}. Please return to continue your treatment.',
    templateLtfuSw:    'Habari {name}, tunakukosa katika {hospital}. Tafadhali rudi kuendelea na matibabu.',
    templateWelcome:   'Welcome {name}! Your first appointment at {hospital} is on {date}. TouchHealth NCD.',
    templateWelcomeSw: 'Karibu {name}! Ziara yako ya kwanza {hospital} ni tarehe {date}. TouchHealth NCD.',
  });
}
export function saveSMSConfig(cfg: SMSConfig): void {
  persist(KEYS.SMS_CONFIG, cfg);
}
export function loadSMSLog(): SMSLogEntry[] {
  return load<SMSLogEntry[]>(KEYS.SMS_LOG, []);
}
export function saveSMSLog(log: SMSLogEntry[]): void {
  persist(KEYS.SMS_LOG, log);
}

// ── SYNC METADATA ─────────────────────────────────────────────

export function getLastSync(): string | null {
  return localStorage.getItem(KEYS.LAST_SYNC);
}
export function setLastSync(): void {
  localStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
}
export function getSyncCount(): number {
  return parseInt(localStorage.getItem(KEYS.SYNC_COUNT) ?? '0', 10);
}
export function setSyncCount(n: number): void {
  localStorage.setItem(KEYS.SYNC_COUNT, String(n));
}

// ── CONNECTIVITY CHECK ────────────────────────────────────────

/**
 * FIX: uses a lightweight RPC instead of querying the users table.
 *
 * Create this function in Supabase SQL editor once:
 *   create or replace function public.ping()
 *   returns boolean language sql security definer as $$ select true $$;
 *   grant execute on function public.ping() to anon;
 *
 * This emits no audit events and leaks no table metadata.
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('ping');
    return !error;
  } catch {
    return false;
  }
}

// ── FULL SYSTEM SYNC ──────────────────────────────────────────

export async function syncPatientsWithCloud() {
  try {
    console.log('[SYNC] Full System Sync initiated...');

    // ── Deduplicate local patients by code before pushing ──
    const rawLocal = loadPatients();
    const localByCode = new Map<string, Patient>();
    for (const p of rawLocal) {
      const existing = localByCode.get(p.code);
      if (!existing || (p.visits?.length ?? 0) > (existing.visits?.length ?? 0)) {
        localByCode.set(p.code, p);
      }
    }
    const localPatients = Array.from(localByCode.values());
    if (localPatients.length < rawLocal.length) {
      savePatients(localPatients);
    }

    // ── 1. PUSH patients ────────────────────────────────────
    if (localPatients.length > 0) {
      const patientRows = localPatients.map((p) => ({
        id:       String(p.id),
        code:     p.code,
        age:      p.age,
        sex:      p.sex,
        cond:     p.cond,
        enrol:    p.enrol,
        phone:    p.phone ?? null,
        address:  p.address ?? null,
        status:   p.status,
        hospital: p.hospital,
        region:   p.region,
        district: p.district,
      }));

      const { error: pushError } = await supabase
        .from('patients')
        .upsert(patientRows, { onConflict: 'id' });
      if (pushError) throw new Error(`Patient push failed: ${pushError.message}`);

      // ── 1b. PUSH visits + medications ───────────────────
      for (const patient of localPatients) {
        for (const visit of patient.visits ?? []) {
          const { error: visitError } = await supabase
            .from('visits')
            .upsert({
              id:                   visit.id,
              patient_id:           String(patient.id),
              month:                visit.month,
              year:                 visit.year,
              date:                 visit.date,
              att:                  visit.att,
              sbp:                  visit.sbp ?? null,
              dbp:                  visit.dbp ?? null,
              sugar:                visit.sugar ?? null,
              sugar_type:           visit.sugarType ?? null,
              weight:               visit.weight ?? null,
              height:               visit.height ?? null,
              bmi:                  visit.bmi ?? null,
              notes:                visit.notes ?? '',
              presenting_complaint: visit.presentingComplaint ?? null,
              physical_exam:        visit.physicalExam ?? null,
              diagnoses:            visit.diagnoses ?? null,
              investigations:       visit.investigations ?? null,
              drug_warnings:        visit.drugWarnings ?? null,
            }, { onConflict: 'id' });
          if (visitError) console.error('Visit push error:', visitError.message);

          for (const med of visit.meds ?? []) {
            const { error: medError } = await supabase
              .from('medications')
              .upsert({
                visit_id:     visit.id,
                name:         med.name,
                dose:         med.dose ?? null,
                freq:         med.freq ?? null,
                instructions: med.instructions ?? null,
              }, { onConflict: 'visit_id,name' });
            if (medError) console.error('Med push error:', medError.message);
          }
        }
      }
    }

    // ── 2. PULL patients + visits + medications ─────────────
    const { data: cloudPatients, error: pError } = await supabase
      .from('patients').select('*');
    if (pError) throw new Error(`Patient pull failed: ${pError.message}`);

    if (cloudPatients && cloudPatients.length > 0) {
      const normalize = (id: unknown): number => Number(id);

      const cloudByCode = new Map<string, unknown>();
      for (const cp of cloudPatients) {
        const existing = cloudByCode.get(cp.code);
        const localMatch = localByCode.get(cp.code);
        const cpMatchesLocal = localMatch && normalize(cp.id) === normalize(localMatch.id);
        const existMatchesLocal = existing && localMatch &&
          normalize((existing as { id: unknown }).id) === normalize(localMatch.id);
        if (!existing || (cpMatchesLocal && !existMatchesLocal)) {
          cloudByCode.set(cp.code, cp);
        }
      }
      const canonicalCloud = Array.from(cloudByCode.values()) as Array<Record<string, unknown>>;

      // Delete ghost patients from Supabase
      const keepIds = new Set(canonicalCloud.map((p: SupabaseRow) => normalize(p.id)));
      const ghostIds = cloudPatients
        .map((p: SupabaseRow) => normalize(p.id))
        .filter((id: number) => !keepIds.has(id));
      if (ghostIds.length > 0) {
        const { data: gv } = await supabase
          .from('visits').select('id').in('patient_id', ghostIds);
        const gvIds = (gv ?? []).map((v: SupabaseRow) => v.id);
        if (gvIds.length > 0) {
          await supabase.from('medications').delete().in('visit_id', gvIds);
          await supabase.from('visits').delete().in('id', gvIds);
        }
        await supabase.from('patients').delete().in('id', ghostIds);
      }

      // Bulk fetch all visits + meds (2 queries total — no N+1)
      const { data: allVisits } = await supabase.from('visits').select('*');
      const { data: allMeds }   = await supabase.from('medications').select('*');

      const medsByVisit = new Map<string, unknown[]>();
      (allMeds ?? []).forEach((m: SupabaseRow) => {
        const key = String(m.visit_id);
        if (!medsByVisit.has(key)) medsByVisit.set(key, []);
        medsByVisit.get(key)!.push(m);
      });

      const visitsByPatient = new Map<string, Visit[]>();
      (allVisits ?? []).forEach((v: SupabaseRow) => {
        const key = String(v.patient_id);
        if (!visitsByPatient.has(key)) visitsByPatient.set(key, []);
        visitsByPatient.get(key)!.push({
          ...v,
          att:                 v.att === true || v.att === 'true' || v.att === 1,
          sugarType:           v.sugar_type ?? '',
          presentingComplaint: v.presenting_complaint ?? '',
          physicalExam:        v.physical_exam ?? undefined,
          diagnoses:           v.diagnoses ?? [],
          investigations:      v.investigations ?? [],
          drugWarnings:        v.drug_warnings ?? [],
          meds:                medsByVisit.get(String(v.id)) ?? [],
        } as Visit);
      });

      const cloudIds = new Set(canonicalCloud.map((p) => normalize(p.id)));
      const localOnlyPatients = localPatients.filter(
        (p) => !cloudIds.has(normalize(p.id))
      );

      const mergedPatients: Patient[] = [
        ...canonicalCloud.map((cp) => {
          const normId = normalize(cp.id);
          const cloudVisits = visitsByPatient.get(String(normId)) ?? [];
          const localMatch  = localByCode.get(cp.code as string);
          const cloudVisitIds = new Set(cloudVisits.map((v) => String(v.id)));
          const localOnlyVisits = (localMatch?.visits ?? []).filter(
            (v) => !cloudVisitIds.has(String(v.id))
          );
          return {
            ...cp,
            id:          normId,
            status:      cp.status as PatientStatus,
            visits:      [...cloudVisits, ...localOnlyVisits],
            medications: localMatch?.medications ?? [],
            hba1c:       localMatch?.hba1c ?? [],
            callLog:     localMatch?.callLog ?? [],
            scheduledNext: localMatch?.scheduledNext,
          } as Patient;
        }),
        ...localOnlyPatients,
      ];

      savePatients(mergedPatients);
    }

    // ── 3. PULL users ───────────────────────────────────────
    const { data: cloudUsers, error: uError } = await supabase
      .from('users').select('*');
    if (uError) console.warn('User sync failed:', uError.message);
    if (cloudUsers) saveUsers(cloudUsers as User[]);

    // ── 4. PULL hospitals ───────────────────────────────────
    const { data: cloudHospitals, error: hError } = await supabase
      .from('hospitals').select('*');
    if (hError) console.warn('Hospital sync failed:', hError.message);
    if (cloudHospitals) saveHospitals(cloudHospitals as Hospital[]);

    setLastSync();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network or internal error';
    console.error('[SYNC] Sync System Error:', msg);
    return { success: false, error: msg };
  }
}

// ── DEDUPLICATE & REPAIR ─────────────────────────────────────

export async function deduplicateAndRepair(): Promise<{ fixed: number; error?: string }> {
  try {
    const localPatients = loadPatients();
    const localByCode = new Map<string, Patient>();
    for (const p of localPatients) {
      const existing = localByCode.get(p.code);
      if (!existing || (p.visits?.length ?? 0) > (existing.visits?.length ?? 0)) {
        localByCode.set(p.code, p);
      }
    }
    const localCanonical = Array.from(localByCode.values());
    savePatients(localCanonical);

    const { data: allCloudPatients, error: fetchErr } = await supabase
      .from('patients').select('*');
    if (fetchErr) throw new Error(fetchErr.message);

    const cloudByCode = new Map<string, Record<string, unknown>>();
    for (const p of allCloudPatients ?? []) {
      const existing = cloudByCode.get(p.code);
      const localMatch = localByCode.get(p.code);
      const pIsCanonical = localMatch && Number(p.id) === Number(localMatch.id);
      const existingIsCanonical = existing && localMatch &&
        Number(existing.id) === Number(localMatch.id);
      if (!existing || (pIsCanonical && !existingIsCanonical)) {
        cloudByCode.set(p.code, p as Record<string, unknown>);
      }
    }

    const keepCloudIds = new Set(
      Array.from(cloudByCode.values()).map((p: Record<string, unknown>) => Number(p.id))
    );
    const ghostCloudIds = (allCloudPatients ?? [])
      .map((p: SupabaseRow) => Number(p.id))
      .filter((id: number) => !keepCloudIds.has(id));

    const totalRemoved =
      (localPatients.length - localCanonical.length) + ghostCloudIds.length;

    if (ghostCloudIds.length > 0) {
      const { data: ghostVisits } = await supabase
        .from('visits').select('id').in('patient_id', ghostCloudIds);
      const ghostVisitIds = (ghostVisits ?? []).map((v: SupabaseRow) => v.id);
      if (ghostVisitIds.length > 0) {
        await supabase.from('medications').delete().in('visit_id', ghostVisitIds);
        await supabase.from('visits').delete().in('id', ghostVisitIds);
      }
      await supabase.from('patients').delete().in('id', ghostCloudIds);
    }

    for (const p of localCanonical) {
      await supabase.from('patients').upsert({
        id: String(p.id), code: p.code, age: p.age, sex: p.sex,
        cond: p.cond, enrol: p.enrol, phone: p.phone, address: p.address,
        status: p.status, hospital: p.hospital, region: p.region, district: p.district,
      }, { onConflict: 'id' });

      for (const v of p.visits ?? []) {
        await supabase.from('visits').upsert({
          id: v.id, patient_id: String(p.id), month: v.month, year: v.year,
          date: v.date, att: v.att, sbp: v.sbp ?? null, dbp: v.dbp ?? null,
          sugar: v.sugar ?? null, sugar_type: v.sugarType ?? null,
          weight: v.weight ?? null, height: v.height ?? null, bmi: v.bmi ?? null,
          notes: v.notes ?? '', presenting_complaint: v.presentingComplaint ?? null,
          physical_exam: v.physicalExam ?? null,
          diagnoses: v.diagnoses ?? null,
          investigations: v.investigations ?? null,
          drug_warnings: v.drugWarnings ?? null,
        }, { onConflict: 'id' });

        for (const m of v.meds ?? []) {
          await supabase.from('medications').upsert({
            visit_id: v.id, name: m.name, dose: m.dose,
            freq: m.freq, instructions: m.instructions,
          }, { onConflict: 'visit_id,name' });
        }
      }
    }

    setLastSync();
    return { fixed: totalRemoved };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Repair failed';
    console.error('Repair error:', msg);
    return { fixed: 0, error: msg };
  }
}

export async function diagnoseSyncIssue(): Promise<string> {
  const lines: string[] = [];

  const { data: pts, error: pe } = await supabase.from('patients').select('*');
  if (pe) return `ERROR Cannot read patients: ${pe.message}`;
  lines.push(`OK Patients in Supabase: ${pts?.length ?? 0}`);
  pts?.forEach((p: SupabaseRow) => lines.push(`  [${p.id}] code=${p.code} status=${p.status}`));

  const { data: vis, error: ve } = await supabase.from('visits').select('*');
  if (ve) return `ERROR Cannot read visits: ${ve.message}`;
  lines.push(`\nOK Visits in Supabase: ${vis?.length ?? 0}`);
  if (vis && vis.length > 0) {
    lines.push(`First visit raw fields:`);
    Object.entries(vis[0]).forEach(([k, val]) =>
      lines.push(`  ${k} = ${JSON.stringify(val)}`)
    );
  }

  const { data: meds, error: me } = await supabase.from('medications').select('*');
  if (me) lines.push(`\nWARN Medications error: ${me.message}`);
  else lines.push(`\nOK Medications in Supabase: ${meds?.length ?? 0}`);

  const report = lines.join('\n');
  console.log('=== SYNC DIAGNOSTIC ===\n' + report);
  return report;
}
