import { supabase } from './supabase';
import type {
  Patient, User, Hospital, ClinicSettings,
  StockoutReport, SMSConfig, SMSLogEntry,
  PatientStatus, Visit,
} from '@/types';

// ════════════════════════════════════════════════════
// STORAGE KEYS
// ════════════════════════════════════════════════════

const KEYS = {
  PATIENTS:   'zmz2_pts',
  USERS:      'th_users',
  HOSPITALS:  'th_hospitals',
  SESSION:    'th_session',
  CLINIC:     'th_clinic',
  SMS_LOG:    'th_sms_log',
  SMS_CONFIG: 'th_sms_cfg',
  STOCKOUTS:  'th_stockouts',
  LAST_SYNC:  'th_last_sync',
  SYNC_COUNT: 'th_sync_count',
} as const;

// ════════════════════════════════════════════════════
// FULL SYSTEM SYNC (Patients, Users, & Hospitals)
// ════════════════════════════════════════════════════

export async function syncPatientsWithCloud() {
  try {
    console.log('🔄 Full System Sync initiated...');

    // ── Deduplicate local patients by code before pushing ──────
    // This prevents ghost patients from ever reaching Supabase
    const rawLocal = loadPatients();
    const localByCode = new Map<string, Patient>();
    for (const p of rawLocal) {
      const existing = localByCode.get(p.code);
      if (!existing || (p.visits?.length ?? 0) > (existing.visits?.length ?? 0)) {
        localByCode.set(p.code, p);
      }
    }
    const localPatients = Array.from(localByCode.values());
    // Save the deduplicated list immediately
    if (localPatients.length < rawLocal.length) {
      savePatients(localPatients);
    }

    // ── 1. PUSH patients ───────────────────────────────────────
    if (localPatients.length > 0) {
      const patientRows = localPatients.map(p => ({
        id: String(p.id),
        code: p.code,
        age: p.age,
        sex: p.sex,
        cond: p.cond,
        enrol: p.enrol,
        phone: p.phone ?? null,
        address: p.address ?? null,
        status: p.status,
        hospital: p.hospital,
        region: p.region,
        district: p.district,
      }));

      const { error: pushError } = await supabase
        .from('patients')
        .upsert(patientRows, { onConflict: 'id' });
      if (pushError) throw new Error(`Patient push failed: ${pushError.message}`);

      // ── 1b. PUSH visits + medications ─────────────────────────
      for (const patient of localPatients) {
        for (const visit of patient.visits ?? []) {
          const { error: visitError } = await supabase
            .from('visits')
            .upsert({
              id: visit.id,
              patient_id: String(patient.id),
              month: visit.month,
              year: visit.year,
              date: visit.date,
              att: visit.att,
              sbp: visit.sbp ?? null,
              dbp: visit.dbp ?? null,
              sugar: visit.sugar ?? null,
              sugar_type: visit.sugarType ?? null,
              weight: visit.weight ?? null,
              height: visit.height ?? null,
              bmi: visit.bmi ?? null,
              notes: visit.notes ?? '',
              presenting_complaint: visit.presentingComplaint ?? null,
              physical_exam: visit.physicalExam ?? null,
              diagnoses: visit.diagnoses ?? null,
              investigations: visit.investigations ?? null,
              drug_warnings: visit.drugWarnings ?? null,
            }, { onConflict: 'id' });
          if (visitError) console.error('Visit push error:', visitError.message);

          for (const med of visit.meds ?? []) {
            const { error: medError } = await supabase
              .from('medications')
              .upsert({
                visit_id: visit.id,
                name: med.name,
                dose: med.dose ?? null,
                freq: med.freq ?? null,
                instructions: med.instructions ?? null,
              }, { onConflict: 'visit_id,name' });
            if (medError) console.error('Med push error:', medError.message);
          }
        }
      }
    }

    // ── 2. PULL patients + visits + medications from Supabase ──
    const { data: cloudPatients, error: pError } = await supabase.from('patients').select('*');
    if (pError) throw new Error(`Patient pull failed: ${pError.message}`);

    if (cloudPatients && cloudPatients.length > 0) {
      const normalize = (id: any): number => Number(id);

      // Deduplicate cloud patients by code too — keep the one matching our local canonical
      const cloudByCode = new Map<string, any>();
      for (const cp of cloudPatients) {
        const existing = cloudByCode.get(cp.code);
        const localMatch = localByCode.get(cp.code);
        const cpMatchesLocal = localMatch && normalize(cp.id) === normalize(localMatch.id);
        const existMatchesLocal = existing && localMatch && normalize(existing.id) === normalize(localMatch.id);
        if (!existing || (cpMatchesLocal && !existMatchesLocal)) {
          cloudByCode.set(cp.code, cp);
        }
      }
      const canonicalCloud = Array.from(cloudByCode.values());

      // Delete ghost patients from Supabase that lost the dedup
      const keepIds = new Set(canonicalCloud.map((p: any) => normalize(p.id)));
      const ghostIds = cloudPatients
        .map((p: any) => normalize(p.id))
        .filter(id => !keepIds.has(id));
      if (ghostIds.length > 0) {
        const { data: gv } = await supabase.from('visits').select('id').in('patient_id', ghostIds);
        const gvIds = (gv ?? []).map((v: any) => v.id);
        if (gvIds.length > 0) {
          await supabase.from('medications').delete().in('visit_id', gvIds);
          await supabase.from('visits').delete().in('id', gvIds);
        }
        await supabase.from('patients').delete().in('id', ghostIds);
      }

      // Pull all visits + meds for canonical patients
      const { data: allVisits } = await supabase.from('visits').select('*');
      const { data: allMeds } = await supabase.from('medications').select('*');

      const medsByVisit = new Map<string, any[]>();
      (allMeds ?? []).forEach((m: any) => {
        const key = String(m.visit_id);
        if (!medsByVisit.has(key)) medsByVisit.set(key, []);
        medsByVisit.get(key)!.push(m);
      });

      // Use string keys throughout to avoid any numeric precision issues with large IDs
      const visitsByPatient = new Map<string, any[]>();
      (allVisits ?? []).forEach((v: any) => {
        const key = String(v.patient_id);
        if (!visitsByPatient.has(key)) visitsByPatient.set(key, []);

        visitsByPatient.get(key)!.push({
          ...v,
          att: v.att === true || v.att === 'true' || v.att === 1,
          sugarType: v.sugar_type ?? '',
          presentingComplaint: v.presenting_complaint ?? '',
          physicalExam: v.physical_exam ?? undefined,
          diagnoses: v.diagnoses ?? [],
          investigations: v.investigations ?? [],
          drugWarnings: v.drug_warnings ?? [],
          meds: medsByVisit.get(String(v.id)) ?? [],
        } as Visit);
      });

      // Build final patient list — canonical cloud + local-only patients not yet in cloud
      const cloudIds = new Set(canonicalCloud.map((p: any) => normalize(p.id)));
      const localOnlyPatients = localPatients.filter(p => !cloudIds.has(normalize(p.id)));

      const mergedPatients: Patient[] = [
        ...canonicalCloud.map((cp: any) => {
          const normId = normalize(cp.id);
          const cloudVisits = visitsByPatient.get(String(normId)) ?? [];
          const localMatch = localByCode.get(cp.code);
          const cloudVisitIds = new Set(cloudVisits.map((v: any) => String(v.id)));
          const localOnlyVisits = (localMatch?.visits ?? []).filter(
            v => !cloudVisitIds.has(String(v.id))
          );
          return {
            ...cp,
            id: normId,
            status: cp.status as PatientStatus,
            visits: [...cloudVisits, ...localOnlyVisits],
            medications: localMatch?.medications ?? [],
            hba1c: localMatch?.hba1c ?? [],
            callLog: localMatch?.callLog ?? [],
            scheduledNext: localMatch?.scheduledNext,
          } as Patient;
        }),
        ...localOnlyPatients,
      ];

      savePatients(mergedPatients);
    }

    // ── 3. PULL users ──────────────────────────────────────────
    const { data: cloudUsers, error: uError } = await supabase.from('users').select('*');
    if (uError) console.warn('User sync failed:', uError.message);
    if (cloudUsers) saveUsers(cloudUsers as User[]);

    // ── 4. PULL hospitals ──────────────────────────────────────
    const { data: cloudHospitals, error: hError } = await supabase.from('hospitals').select('*');
    if (hError) console.warn('Hospital sync failed:', hError.message);
    if (cloudHospitals) saveHospitals(cloudHospitals as Hospital[]);

    setLastSync();
    return { success: true };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network or internal error';
    console.error('⚠️ Sync System Error:', msg);
    return { success: false, error: msg };
  }
}

// ════════════════════════════════════════════════════
// LOCAL STORAGE HELPERS
// ════════════════════════════════════════════════════

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

// ── Patients ─────────────────────────────────────────
export function loadPatients(): Patient[] {
  return load<Patient[]>(KEYS.PATIENTS, []);
}
export function savePatients(patients: Patient[]): void {
  persist(KEYS.PATIENTS, patients);
}

// ── Users ────────────────────────────────────────────
export function loadUsers(): User[] {
  return load<User[]>(KEYS.USERS, []);
}
export function saveUsers(users: User[]): void {
  persist(KEYS.USERS, users);
}

// ── Hospitals ────────────────────────────────────────
export function loadHospitals(): Hospital[] {
  return load<Hospital[]>(KEYS.HOSPITALS, []);
}
export function saveHospitals(hospitals: Hospital[]): void {
  persist(KEYS.HOSPITALS, hospitals);
}

// ── Clinic Settings ───────────────────────────────────
export function loadClinicSettings(): ClinicSettings {
  const saved = load<Partial<ClinicSettings>>(KEYS.CLINIC, {});
  return { 
    days: [1,3,5], 
    interval: 30, 
    openHour: 7, 
    closeHour: 18, 
    autoLtfuDays: 21, 
    ...saved 
  };
}
export function saveClinicSettings(cfg: ClinicSettings): void {
  persist(KEYS.CLINIC, cfg);
}

// ── Session ───────────────────────────────────────────
export function loadSession(): User | null {
  return load<User | null>(KEYS.SESSION, null);
}
export function saveSession(user: User): void {
  persist(KEYS.SESSION, user);
}
export function clearSession(): void {
  localStorage.removeItem(KEYS.SESSION);
}

// ── Stockouts ─────────────────────────────────────────
export function loadStockouts(): StockoutReport[] {
  return load<StockoutReport[]>(KEYS.STOCKOUTS, []);
}
export function saveStockouts(reports: StockoutReport[]): void {
  persist(KEYS.STOCKOUTS, reports);
}

// ── SMS ───────────────────────────────────────────────
export function loadSMSConfig(): SMSConfig {
  return load<SMSConfig>(KEYS.SMS_CONFIG, {
    provider: 'at',
    apiKey: '',
    apiSecret: '',
    senderId: 'TouchHealth',
    template: 'Karibu {name}. Appointment at {hospital} on {date}. TouchHealth NCD.',
    templateSw: 'Habari {name}. Ziara yako katika {hospital} ni tarehe {date}. TouchHealth NCD.',
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

// ── Sync Metadata ─────────────────────────────────────
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

/**
 * ONE-TIME REPAIR: Deduplicate patients by code, keeping the copy with the most
 * visits (i.e. the real record). Also deletes ghost rows from Supabase and
 * re-pushes the canonical records with their visits.
 */
export async function deduplicateAndRepair(): Promise<{ fixed: number; error?: string }> {
  try {
    // ── STEP 1: Deduplicate LOCAL storage by code ──────────────
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

    // ── STEP 2: Fetch ALL patients from Supabase and deduplicate by code there too ──
    const { data: allCloudPatients, error: fetchErr } = await supabase
      .from('patients').select('*');
    if (fetchErr) throw new Error(fetchErr.message);

    const cloudByCode = new Map<string, any>();
    for (const p of allCloudPatients ?? []) {
      const existing = cloudByCode.get(p.code);
      // Prefer the one whose ID matches our local canonical (it has visits)
      const localMatch = localByCode.get(p.code);
      const pIsCanonical = localMatch && Number(p.id) === Number(localMatch.id);
      const existingIsCanonical = existing && localMatch && Number(existing.id) === Number(localMatch.id);
      if (!existing || pIsCanonical && !existingIsCanonical) {
        cloudByCode.set(p.code, p);
      }
    }

    // IDs to keep in Supabase
    const keepCloudIds = new Set(Array.from(cloudByCode.values()).map((p: any) => Number(p.id)));
    // Ghost IDs = everything in Supabase NOT in the keep set
    const ghostCloudIds = (allCloudPatients ?? [])
      .map((p: any) => Number(p.id))
      .filter(id => !keepCloudIds.has(id));

    const totalRemoved = (localPatients.length - localCanonical.length) + ghostCloudIds.length;

    // ── STEP 3: Delete all ghost rows from Supabase ────────────
    if (ghostCloudIds.length > 0) {
      const { data: ghostVisits } = await supabase
        .from('visits').select('id').in('patient_id', ghostCloudIds);
      const ghostVisitIds = (ghostVisits ?? []).map((v: any) => v.id);
      if (ghostVisitIds.length > 0) {
        await supabase.from('medications').delete().in('visit_id', ghostVisitIds);
        await supabase.from('visits').delete().in('id', ghostVisitIds);
      }
      await supabase.from('patients').delete().in('id', ghostCloudIds);
    }

    // ── STEP 4: Re-push canonical patients + visits + meds ─────
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

/** DIAGNOSTIC: Reads data directly from Supabase and shows all fields */
export async function diagnoseSyncIssue(): Promise<string> {
  const lines: string[] = [];

  const { data: pts, error: pe } = await supabase.from('patients').select('*');
  if (pe) return `❌ Cannot read patients: ${pe.message}`;
  lines.push(`✅ Patients in Supabase: ${pts?.length ?? 0}`);
  pts?.forEach((p: any) => lines.push(`  [${p.id}] code=${p.code} status=${p.status}`));

  const { data: vis, error: ve } = await supabase.from('visits').select('*');
  if (ve) return `❌ Cannot read visits: ${ve.message}`;
  lines.push(`\n✅ Visits in Supabase: ${vis?.length ?? 0}`);
  if (vis && vis.length > 0) {
    lines.push(`First visit raw fields:`);
    Object.entries(vis[0]).forEach(([k, val]) =>
      lines.push(`  ${k} = ${JSON.stringify(val)}`)
    );
  }

  const { data: meds, error: me } = await supabase.from('medications').select('*');
  if (me) lines.push(`\n⚠️ Medications error: ${me.message}`);
  else lines.push(`\n✅ Medications in Supabase: ${meds?.length ?? 0}`);

  const report = lines.join('\n');
  console.log('=== SYNC DIAGNOSTIC ===\n' + report);
  return report;
}
