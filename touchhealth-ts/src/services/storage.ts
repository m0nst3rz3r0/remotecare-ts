import { supabase } from './supabase';
import type {
  Patient, User, Hospital, ClinicSettings,
  StockoutReport, SMSConfig, SMSLogEntry,
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
    
    const localPatients = loadPatients();

    // 1. PUSH PATIENTS — only the scalar columns Supabase expects
    if (localPatients.length > 0) {
      const patientRows = localPatients.map(p => ({
        id: Number(p.id),
        code: p.code,
        age: p.age,
        sex: p.sex,
        cond: p.cond,
        enrol: p.enrol,
        phone: p.phone,
        address: p.address,
        status: p.status,
        hospital: p.hospital,
        region: p.region,
        district: p.district,
      }));

      const { error: pushError } = await supabase
        .from('patients')
        .upsert(patientRows, { onConflict: 'id' });

      if (pushError) {
        console.error('Patient push error:', pushError);
        throw new Error(`Patient push failed: ${pushError.message}`);
      }

      // 1b. PUSH VISITS + MEDICATIONS for every local patient
      for (const patient of localPatients) {
        if (!patient.visits?.length) continue;

        for (const visit of patient.visits) {
          const { error: visitError } = await supabase
            .from('visits')
            .upsert({
              id: visit.id,
              patient_id: patient.id,
              month: visit.month,
              year: visit.year,
              date: visit.date,
              att: visit.att,
              sbp: visit.sbp,
              dbp: visit.dbp,
              sugar: visit.sugar,
              sugar_type: visit.sugarType,
              weight: visit.weight,
              height: visit.height,
              bmi: visit.bmi,
              notes: visit.notes,
              presenting_complaint: visit.presentingComplaint,
              physical_exam: visit.physicalExam,
              diagnoses: visit.diagnoses,
              investigations: visit.investigations,
              drug_warnings: visit.drugWarnings,
            }, { onConflict: 'id' });

          if (visitError) {
            console.error('Visit push error:', visitError);
          }

          if (visit.meds?.length) {
            for (const med of visit.meds) {
              const { error: medError } = await supabase
                .from('medications')
                .upsert({
                  visit_id: visit.id,
                  name: med.name,
                  dose: med.dose,
                  freq: med.freq,
                  instructions: med.instructions,
                }, { onConflict: 'visit_id,name' });

              if (medError) {
                console.error('Medication push error:', medError);
              }
            }
          }
        }
      }
    }

    // 2. PULL ALL PATIENTS + VISITS + MEDICATIONS from Supabase
    const { data: pUpdates, error: pError } = await supabase.from('patients').select('*');
    if (pError) throw new Error(`Patient pull failed: ${pError.message}`);

    if (pUpdates && pUpdates.length > 0) {
      const normalize = (id: any): number => Number(id);
      const currentList = loadPatients();
      const patientMap = new Map(currentList.map(p => [normalize(p.id), p]));

      // Pull all visits for all patients in one query
      const { data: allVisits } = await supabase.from('visits').select('*');
      // Pull all medications in one query
      const { data: allMeds } = await supabase.from('medications').select('*');

      // Group meds by visit_id for fast lookup
      const medsByVisit = new Map<string, any[]>();
      (allMeds ?? []).forEach((m: any) => {
        const key = String(m.visit_id);
        if (!medsByVisit.has(key)) medsByVisit.set(key, []);
        medsByVisit.get(key)!.push(m);
      });

      // Group visits by patient_id for fast lookup
      const visitsByPatient = new Map<number, any[]>();
      (allVisits ?? []).forEach((v: any) => {
        const key = normalize(v.patient_id);
        if (!visitsByPatient.has(key)) visitsByPatient.set(key, []);
        visitsByPatient.get(key)!.push({
          ...v,
          sugarType: v.sugar_type,
          presentingComplaint: v.presenting_complaint,
          physicalExam: v.physical_exam,
          drugWarnings: v.drug_warnings,
          meds: medsByVisit.get(String(v.id)) ?? [],
        });
      });

      pUpdates.forEach((up: any) => {
        const normId = normalize(up.id);
        const cloudVisits = visitsByPatient.get(normId) ?? [];
        const existing = patientMap.get(normId);

        // Merge visits: prefer cloud visits but keep any local-only visits not yet pushed
        const cloudVisitIds = new Set(cloudVisits.map((v: any) => String(v.id)));
        const localOnlyVisits = (existing?.visits ?? []).filter(
          (v: any) => !cloudVisitIds.has(String(v.id))
        );

        patientMap.set(normId, {
          ...up,
          id: normId,
          visits: [...cloudVisits, ...localOnlyVisits],
        } as Patient);
      });

      savePatients(Array.from(patientMap.values()));
    }

    // 3. PULL USERS
    const { data: cloudUsers, error: uError } = await supabase
      .from('users')
      .select('*');
    
    if (uError) console.warn('User sync failed:', uError.message);
    if (cloudUsers) {
      saveUsers(cloudUsers as User[]);
      console.log(`✅ Synced ${cloudUsers.length} users.`);
    }

    // 4. PULL HOSPITALS
    const { data: cloudHospitals, error: hError } = await supabase
      .from('hospitals')
      .select('*');
    
    if (hError) console.warn('Hospital sync failed:', hError.message);
    if (cloudHospitals) {
      saveHospitals(cloudHospitals as Hospital[]);
    }

    // Update global sync timestamp (stored locally — this is per-device by design)
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
    const patients = loadPatients();

    // Group by code — keep the one with the most visits
    const byCode = new Map<string, Patient>();
    for (const p of patients) {
      const existing = byCode.get(p.code);
      if (!existing || (p.visits?.length ?? 0) > (existing.visits?.length ?? 0)) {
        byCode.set(p.code, p);
      }
    }

    const canonical = Array.from(byCode.values());
    const duplicatesRemoved = patients.length - canonical.length;

    if (duplicatesRemoved === 0) {
      return { fixed: 0 };
    }

    // Save deduplicated list locally first
    savePatients(canonical);

    // Get IDs of ghost patients (those not kept)
    const canonicalIds = new Set(canonical.map(p => Number(p.id)));
    const ghostIds = patients
      .map(p => Number(p.id))
      .filter(id => !canonicalIds.has(id));

    // Delete ghost visits and patients from Supabase
    if (ghostIds.length > 0) {
      await supabase.from('medications').delete().in(
        'visit_id',
        // get visit ids belonging to ghost patients by fetching them first
        (await supabase.from('visits').select('id').in('patient_id', ghostIds))
          .data?.map((v: any) => v.id) ?? []
      );
      await supabase.from('visits').delete().in('patient_id', ghostIds);
      await supabase.from('patients').delete().in('id', ghostIds);
    }

    // For canonical patients, also deduplicate visits in Supabase by month+year
    // keeping the visit that has vitals (sbp/dbp/att data)
    for (const p of canonical) {
      // Deduplicate local visits by month+year — keep the one with vitals
      const visitsByMonthYear = new Map<string, typeof p.visits[0]>();
      for (const v of p.visits ?? []) {
        const key = `${v.year}-${v.month}`;
        const existing = visitsByMonthYear.get(key);
        const hasVitals = (v.sbp != null || v.dbp != null || v.att === true);
        const existingHasVitals = existing
          ? (existing.sbp != null || existing.dbp != null || existing.att === true)
          : false;
        if (!existing || (hasVitals && !existingHasVitals)) {
          visitsByMonthYear.set(key, v);
        }
      }
      const canonicalVisits = Array.from(visitsByMonthYear.values());

      // Find visit IDs to delete (the ghost visit duplicates for this patient)
      const keepVisitIds = new Set(canonicalVisits.map(v => String(v.id)));
      const allPatientVisits = await supabase
        .from('visits').select('id').eq('patient_id', Number(p.id));
      const ghostVisitIds = (allPatientVisits.data ?? [])
        .map((v: any) => String(v.id))
        .filter(id => !keepVisitIds.has(id));

      if (ghostVisitIds.length > 0) {
        await supabase.from('medications').delete().in('visit_id', ghostVisitIds);
        await supabase.from('visits').delete().in('id', ghostVisitIds);
      }

      // Re-push canonical patient
      await supabase.from('patients').upsert({
        id: Number(p.id), code: p.code, age: p.age, sex: p.sex,
        cond: p.cond, enrol: p.enrol, phone: p.phone, address: p.address,
        status: p.status, hospital: p.hospital, region: p.region, district: p.district,
      }, { onConflict: 'id' });

      // Re-push canonical visits with full vitals
      for (const v of canonicalVisits) {
        await supabase.from('visits').upsert({
          id: v.id, patient_id: Number(p.id), month: v.month, year: v.year,
          date: v.date, att: v.att, sbp: v.sbp, dbp: v.dbp, sugar: v.sugar,
          sugar_type: v.sugarType, weight: v.weight, height: v.height, bmi: v.bmi,
          notes: v.notes, presenting_complaint: v.presentingComplaint,
          physical_exam: v.physicalExam, diagnoses: v.diagnoses,
          investigations: v.investigations, drug_warnings: v.drugWarnings,
        }, { onConflict: 'id' });

        for (const m of v.meds ?? []) {
          await supabase.from('medications').upsert({
            visit_id: v.id, name: m.name, dose: m.dose,
            freq: m.freq, instructions: m.instructions,
          }, { onConflict: 'visit_id,name' });
        }
      }

      // Update local patient with deduplicated visits too
      const idx = canonical.findIndex(c => c.id === p.id);
      if (idx !== -1) canonical[idx] = { ...p, visits: canonicalVisits };
    }

    savePatients(canonical);
    setLastSync();
    return { fixed: duplicatesRemoved };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Repair failed';
    console.error('Repair error:', msg);
    return { fixed: 0, error: msg };
  }
}
