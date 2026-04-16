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
    const lastSyncTimestamp = getLastSync(); 

    // 1. PUSH PATIENTS (On-Demand)
    if (localPatients.length > 0) {
      const { error: pushError } = await supabase
        .from('patients')
        .upsert(localPatients, { onConflict: 'id' });

      if (pushError) throw pushError;
    }

    // 2. SELECTIVE PULL PATIENTS (Data Minimization)
    let pQuery = supabase.from('patients').select('*');
    if (lastSyncTimestamp) {
      pQuery = pQuery.gt('updated_at', lastSyncTimestamp);
    }
    const { data: pUpdates, error: pError } = await pQuery;
    if (pError) throw pError;

    // Merge patient updates
    if (pUpdates && pUpdates.length > 0) {
      const currentList = loadPatients();
      const patientMap = new Map(currentList.map(p => [p.id, p]));
      pUpdates.forEach((up: any) => patientMap.set(up.id, up as Patient));
      savePatients(Array.from(patientMap.values()));
    }

    // 3. PULL USERS (For Admin Directory/Stats)
    // We pull all users so the Admin Directory is always accurate
    const { data: cloudUsers, error: uError } = await supabase
      .from('users')
      .select('*');
    
    if (uError) console.warn('User sync failed:', uError.message);
    if (cloudUsers) {
      saveUsers(cloudUsers as User[]);
      console.log(`✅ Synced ${cloudUsers.length} users.`);
    }

    // 4. PULL HOSPITALS (For Facility Matrix)
    const { data: cloudHospitals, error: hError } = await supabase
      .from('hospitals')
      .select('*');
    
    if (hError) console.warn('Hospital sync failed:', hError.message);
    if (cloudHospitals) {
      saveHospitals(cloudHospitals as Hospital[]);
    }

    // Update global sync timestamp
    setLastSync(); 
    return { success: true };

  } catch (err) {
    console.error('⚠️ Sync System Error:', err);
    return { success: false, error: 'Network or internal error' };
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

export function seedDefaults(): void {}
