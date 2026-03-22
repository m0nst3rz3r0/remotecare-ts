// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · DM/HTN NCD MANAGEMENT SYSTEM
// src/types/index.ts — All TypeScript type definitions
// Tanzania NCD Programme · Bukoba Municipal Council
// ════════════════════════════════════════════════════════════

// ── ENUMS ────────────────────────────────────────────────────

export type Sex = 'M' | 'F';

export type Condition = 'HTN' | 'DM' | 'DM+HTN';

export type PatientStatus = 'active' | 'ltfu' | 'completed';

export type UserRole = 'admin' | 'doctor';

export type SugarTestType = 'FBS' | 'RBS' | '2HPP';

export type HbA1cQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type StockoutStatus = 'out' | 'low' | 'adequate';

export type SMSStatus = 'queued' | 'sent' | 'failed' | 'demo';

export type SMSProvider = 'at' | 'twilio';

export type ExportFormat = 'csv' | 'json';

export type ClinicDayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun … 6=Sat

// ── GEOGRAPHY ────────────────────────────────────────────────

export interface TanzaniaGeo {
  [region: string]: string[];
}

// ── HOSPITAL ─────────────────────────────────────────────────

export interface Hospital {
  id: string;
  name: string;
  region: string;
  district: string;
}

// ── USER / AUTH ───────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
  hospital: string;
  region: string;
  district: string;
  isSuperAdmin?: boolean;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  hospital: string;
  sessionHospital: string;
  sessionRegion: string;
  sessionDistrict: string;
}

// ── MEDICATIONS ───────────────────────────────────────────────

export interface Medication {
  name: string;
  dose?: string;
  freq?: string;
}

export interface MedicationRecord {
  date: string;
  meds: Medication[];
}

// ── HbA1c ─────────────────────────────────────────────────────

export interface HbA1cEntry {
  year: number;
  quarter: HbA1cQuarter;
  value: number;
  date: string;
  recordedBy: string;
}

export interface HbA1cClassification {
  lbl: string;
  cls: string;
  bg: string;
  color: string;
  border: string;
  who: string;
}

// ── VISITS ────────────────────────────────────────────────────

export interface Visit {
  id: string;
  month: number;
  year: number;
  date: string;
  att: boolean;
  sbp: number | null;
  dbp: number | null;
  sugar: number | null;
  sugarType: SugarTestType | '';
  weight: number | null;
  height: number | null;
  bmi: number | null;
  notes: string;
  meds: Medication[];
  presentingComplaint?: string;
  physicalExam?: {
    generalAppearance?: string;
    pulseRate?: number;
    respiratoryRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
    oedema?: 'none' | 'mild' | 'moderate' | 'severe';
    fundoscopy?: string;
    footExamination?: 'normal' | 'abnormal' | 'ulcer' | 'amputation';
    otherFindings?: string;
  };
}

// ── DIAGNOSIS ────────────────────────────────────────────────

export interface Diagnosis {
  id: string;
  code: string;
  description: string;
  isPrimary?: boolean;
}

// ── INVESTIGATION RESULT ─────────────────────────────────────

export interface InvestigationResult {
  id: string;
  name: string;
  value: string;
  unit: string;
  reference: string;
  interpretation?: {
    level: 'normal' | 'low' | 'high' | 'critical';
    text: string;
    color?: string;
  };
}

// ── SCHEDULED APPOINTMENT ────────────────────────────────────

export interface ScheduledAppointment {
  date: string;
  note: string;
  scheduledOn: string;
  scheduledBy: string;
}

// ── CALL LOG ─────────────────────────────────────────────────

export interface CallLogEntry {
  date: string;
  note: string;
  by: string;
}

// ── PATIENT ───────────────────────────────────────────────────

export interface Patient {
  id: number;
  code: string;
  age: number;
  sex: Sex;
  cond: Condition;
  enrol: string;
  phone?: string;
  address?: string;
  status: PatientStatus;
  hospital: string;
  region: string;
  district: string;
  visits: Visit[];
  medications: MedicationRecord[];
  hba1c?: HbA1cEntry[];
  callLog?: CallLogEntry[];
  scheduledNext?: ScheduledAppointment;
}

// ── CLINICAL CLASSIFICATION ──────────────────────────────────

export interface BPClassification {
  cls: string;
  lbl: string;
  who: string;
}

export interface GlucoseClassification {
  cls: string;
  lbl: string;
  who: string;
}

// ── CLINIC SETTINGS ───────────────────────────────────────────

export interface ClinicSettings {
  days: ClinicDayIndex[];
  interval: number;
}

// ── PATIENT CODE GENERATION ───────────────────────────────────

export interface CodeComponents {
  regionPrefix: string;
  districtPrefix: string;
  hospitalPrefix: string;
  genderChar: 'M' | 'F';
  sequence: number;
}

export interface GeneratedCode {
  code: string;
  components: CodeComponents;
}

// ── SMS ───────────────────────────────────────────────────────

export interface SMSConfig {
  provider: SMSProvider;
  apiKey: string;
  apiSecret: string;
  senderId: string;
  template: string;
  templateSw: string;
}

export interface SMSLogEntry {
  id: string;
  ptId: number;
  ptCode: string;
  phone: string;
  message: string;
  provider: SMSProvider;
  lang: 'en' | 'sw';
  sentAt: string;
  status: SMSStatus;
  hospital: string;
  note?: string;
}

// ── DRUG SUPPLY / STOCKOUT ────────────────────────────────────

export interface StockoutReport {
  id: string;
  med: string;
  status: StockoutStatus;
  daysRemaining: number;
  hospital: string;
  region: string;
  flaggedBy: string;
  flaggedAt: string;
  notes: string;
  resolved: boolean;
}

// ── DHIS2 / AGGREGATE EXPORT ──────────────────────────────────

export interface AggregateData {
  period: string;
  year: number;
  month: number;
  facility: string;
  enrolled: number;
  newRegistrations: number;
  active: number;
  ltfu: number;
  visitsAttended: number;
  visitsMissed: number;
  attendanceRate: number | null;
  bpMeasured: number;
  bpControlled: number;
  bpControlRate: number | null;
  grade3HTN: number;
  glucoseMeasured: number;
  glucoseControlled: number;
  glucoseControlRate: number | null;
  dmPatients: number;
  htnPatients: number;
  generatedAt: string;
  generatedBy: string;
}

export interface DHIS2DataValue {
  dataElement: string;
  period: string;
  orgUnit: string;
  value: number | null;
}

export interface DHIS2Payload {
  dataValues: DHIS2DataValue[];
  meta: {
    generatedAt: string;
    source: string;
    schema: string;
    dhis2Endpoint: string;
  };
}

// ── REPORT ────────────────────────────────────────────────────

export interface MonthlyReportRow {
  hospital: string;
  region: string;
  district: string;
  enrolled: number;
  attended: number;
  missed: number;
  ctrPct: number | null;
  contPct: number | null;
  enr: number;
}

// ── ADMIN STATS ───────────────────────────────────────────────

export interface ProgrammeSummary {
  totalPatients: number;
  activePatients: number;
  ltfuPatients: number;
  duePatients: number;
  controlledPatients: number;
  totalHospitals: number;
  totalDoctors: number;
}

// ── NAVIGATION ────────────────────────────────────────────────

export type PageId =
  | 'patients'
  | 'ltfu'
  | 'reports'
  | 'clinic'
  | 'overview'
  | 'trends'
  | 'doctors'
  | 'settings';

// ── FILTER STATE ─────────────────────────────────────────────

export type PatientFilter = 'all' | 'active' | 'due' | 'ltfu' | 'completed';

export type LTFUFilter = 'all' | 'ltfu' | 'due';

export type HbA1cFilter = 'all' | 'no-record' | 'poor' | 'target';

export type ClinicFilter = 'all' | 'upcoming' | 'due';

export type SMSQueueFilter = 'pending' | 'all' | 'no-phone';

// ── FORM VALUES ───────────────────────────────────────────────

export interface PatientRegistrationForm {
  region: string;
  district: string;
  hospital: string;
  age: number;
  sex: Sex;
  cond: Condition;
  enrol: string;
  phone?: string;
  address?: string;
}

export interface VisitForm {
  date: string;
  month: number;
  att: boolean;
  sbp?: number;
  dbp?: number;
  sugar?: number;
  sugarType: SugarTestType;
  weight?: number;
  height?: number;
  notes?: string;
  meds: Medication[];
  hba1cValue?: number;
  hba1cQuarter?: HbA1cQuarter;
  nextDate?: string;
  nextNote?: string;
}
