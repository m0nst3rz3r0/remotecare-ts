import type {
  Patient, User, Hospital, ClinicSettings,
  StockoutReport, SMSConfig, SMSLogEntry,
} from '@/types';

// ════════════════════════════════════════════════════
// STORAGE SERVICE — localStorage abstraction
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

// ── Generic helpers ──────────────────────────────────

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
  return { days: [1,3,5], interval: 30, openHour: 7, closeHour: 18, autoLtfuDays: 21, ...saved };
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

// ── Seed defaults ─────────────────────────────────────
// No demo/seed data. All users and hospitals are managed
// via Supabase and the Admin UI.
export function seedDefaults(): void {
  // intentionally empty — no fake data in production
}
