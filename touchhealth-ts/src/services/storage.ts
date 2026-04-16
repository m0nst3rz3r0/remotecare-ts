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
// SUPABASE SELECTIVE SYNC (Optimized for Low Egress)
// ════════════════════════════════════════════════════

export async function syncPatientsWithCloud() {
  try {
    console.log('🔄 Selective Sync initiated (Pull-on-Demand)...');
    
    const localPatients = loadPatients();
    const lastSyncTimestamp = getLastSync(); 

    // 1. PUSH (On-Demand Backup)
    // Only pushes if there is data. Postgres UPSERT handles creation vs updates.
    if (localPatients.length > 0) {
      const { error: pushError } = await supabase
        .from('patients')
        .upsert(localPatients, { onConflict: 'id' });

      if (pushError) {
        console.error('❌ Push failed:', pushError.message);
        return { success: false, error: pushError.message };
      }
    }

    // 2. SELECTIVE PULL (Data Minimization)
    // Only requests rows modified AFTER the last successful sync.
    let query = supabase.from('patients').select('*');
    
    if (lastSyncTimestamp) {
      // GT = Greater Than. We only fetch updates, reducing egress.
      query = query.gt('updated_at', lastSyncTimestamp);
    }

    const { data: remoteUpdates, error: pullError } = await query;

    if (pullError) {
      console.error('❌ Pull failed:', pullError.message);
      return { success: false, error: pullError.message };
    }

    // 3. SMART MERGE
    // Instead of replacing everything, we merge the specific updates into our local list.
    if (remoteUpdates && remoteUpdates.length > 0) {
      const currentList = loadPatients();
      
      // Use a Map for O(1) lookup performance
      const patientMap = new Map(currentList.map(p => [p.id, p]));
      
      remoteUpdates.forEach((updatedPatient: any) => {
        patientMap.set(updatedPatient.id, updatedPatient as Patient);
      });

      savePatients(Array.from(patientMap.values()));
      console.log(`✅ Synced ${remoteUpdates.length} updates.`);
    } else {
      console.log('✅ Local data is already up to date. No egress used.');
    }

    // Update the sync timestamp to current ISO string
    setLastSync(); 
    return { success: true };

  } catch (err) {
    console.error('⚠️ Critical Sync Failure:', err);
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
