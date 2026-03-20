// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · DM/HTN NCD MANAGEMENT SYSTEM
// src/services/clinical.ts — All clinical logic & calculations
// Tanzania NCD STG 2017 · WHO ISH/2023 BP Guidelines
// ════════════════════════════════════════════════════════════

import type {
  Patient,
  Visit,
  BPClassification,
  GlucoseClassification,
  HbA1cClassification,
  HbA1cEntry,
  HbA1cQuarter,
  ClinicSettings,
  ClinicDayIndex,
} from '../types';

// ── CONSTANTS ────────────────────────────────────────────────

export const HTN_MEDS: string[] = [
  'Amlodipine 5mg','Amlodipine 10mg','Nifedipine SR 20mg',
  'Atenolol 50mg','Atenolol 100mg','Hydrochlorothiazide 25mg',
  'Enalapril 5mg','Enalapril 10mg','Losartan 50mg','Losartan 100mg',
  'Lisinopril 5mg','Lisinopril 10mg','Methyldopa 250mg','Methyldopa 500mg',
  'Hydralazine 25mg','Hydralazine 50mg',
];

export const DM_MEDS: string[] = [
  'Metformin 500mg','Metformin 850mg','Metformin 1000mg',
  'Glibenclamide 2.5mg','Glibenclamide 5mg','Glipizide 5mg',
  'Glimepiride 2mg','Glimepiride 4mg',
  'Insulin Regular','Insulin NPH','Insulin Glargine','Insulin Mixtard 30/70',
  'Acarbose 50mg','Sitagliptin 50mg','Empagliflozin 10mg',
];

export const ALL_MEDS: string[] = [...HTN_MEDS, ...DM_MEDS];

export const MONTHS: string[] = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

export const DAYS_FULL: string[] = [
  'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday',
];

export const VISIT_INTERVAL_DAYS = 30;
export const OVERDUE_THRESHOLD_DAYS = 28;

// ── BP CLASSIFICATION ─────────────────────────────────────────

export function bpClass(sbp: number, dbp: number): BPClassification {
  if (!sbp || !dbp) return { cls: 'chip-gray', lbl: 'No data', who: '' };
  if (sbp < 90  || dbp < 60)  return { cls: 'chip-low',     lbl: 'Hypotension',  who: 'Low BP — monitor closely, review medications' };
  if (sbp < 120 && dbp < 80)  return { cls: 'chip-normal',  lbl: 'Normal',       who: 'Normal — no intervention needed' };
  if (sbp < 140 && dbp < 90)  return { cls: 'chip-elevated',lbl: 'High-Normal',  who: 'High-Normal — lifestyle modification recommended' };
  if (sbp < 160 && dbp < 100) return { cls: 'chip-elevated',lbl: 'Grade 1 HTN',  who: 'Grade 1 — consider pharmacotherapy if lifestyle fails' };
  if (sbp < 180 && dbp < 110) return { cls: 'chip-high',    lbl: 'Grade 2 HTN',  who: 'Grade 2 — drug treatment indicated' };
  return                              { cls: 'chip-crisis',  lbl: 'Grade 3 HTN',  who: 'Grade 3 — URGENT, immediate treatment required' };
}

export function isBPControlled(sbp: number | null, dbp: number | null): boolean {
  if (!sbp || !dbp) return false;
  return sbp < 140 && dbp < 90;
}

// ── GLUCOSE CLASSIFICATION ────────────────────────────────────

export function sgClass(
  value: number,
  testType: 'FBS' | 'RBS' | '2HPP'
): GlucoseClassification {
  if (!value) return { cls: 'chip-gray', lbl: 'No data', who: '' };

  if (testType === 'FBS') {
    if (value < 3.0)  return { cls: 'chip-crisis',  lbl: 'Severe Hypo',  who: 'Severe hypoglycaemia — URGENT, give glucose immediately' };
    if (value < 3.9)  return { cls: 'chip-low',     lbl: 'Hypoglycaemia',who: 'Hypoglycaemia — give glucose immediately' };
    if (value < 5.6)  return { cls: 'chip-normal',  lbl: 'Normal FBS',   who: 'Normal fasting glucose' };
    if (value < 7.0)  return { cls: 'chip-elevated',lbl: 'IFG',          who: 'Impaired Fasting Glucose — pre-diabetes' };
    if (value < 10.0) return { cls: 'chip-high',    lbl: 'DM fair ctrl', who: 'Diabetic range — fair control' };
    if (value < 16.7) return { cls: 'chip-high',    lbl: 'DM poor ctrl', who: 'Poor glycaemic control — intensify treatment' };
    return                   { cls: 'chip-crisis',  lbl: 'DM danger',    who: 'Hyperglycaemic danger zone — urgent review' };
  }

  // RBS or 2HPP
  if (value < 3.0)  return { cls: 'chip-crisis',  lbl: 'Severe Hypo',  who: 'Severe hypoglycaemia — URGENT' };
  if (value < 3.9)  return { cls: 'chip-low',     lbl: 'Hypoglycaemia',who: 'Hypo — give glucose immediately' };
  if (value < 7.8)  return { cls: 'chip-normal',  lbl: 'Normal',       who: 'Normal post-load glucose' };
  if (value < 11.1) return { cls: 'chip-elevated',lbl: 'IGT',          who: 'Impaired Glucose Tolerance' };
  if (value < 16.7) return { cls: 'chip-high',    lbl: 'DM poor ctrl', who: 'Diabetic range — poor control' };
  return                   { cls: 'chip-crisis',  lbl: 'DM danger',    who: 'Hyperglycaemic danger zone — urgent review' };
}

export function isGlucoseControlled(value: number | null): boolean {
  if (!value) return false;
  return value < 10;
}

// ── HbA1c CLASSIFICATION ──────────────────────────────────────

export function hba1cClass(value: number): HbA1cClassification {
  if (!value) return { lbl: '—', cls: 'chip-gray', bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0', who: '' };
  if (value < 5.7)  return { lbl: 'Normal',          cls: 'chip-normal',   bg: '#dcfce7', color: '#14532d', border: '#86efac', who: 'No diabetes — normal HbA1c' };
  if (value < 6.5)  return { lbl: 'Pre-diabetes',    cls: 'chip-elevated', bg: '#fef3c7', color: '#78350f', border: '#fcd34d', who: 'Pre-diabetes — lifestyle intervention recommended' };
  if (value < 7.0)  return { lbl: 'DM – Excellent',  cls: 'chip-normal',   bg: '#dcfce7', color: '#14532d', border: '#86efac', who: 'Excellent DM control — maintain current therapy' };
  if (value < 8.0)  return { lbl: 'DM – At Target',  cls: 'chip-blue',     bg: '#e4f6fb', color: '#0c4a6e', border: '#7dd3fc', who: 'At HbA1c target (≤8%) — continue current therapy' };
  if (value < 9.0)  return { lbl: 'DM – Above Target',cls:'chip-elevated', bg: '#fef3c7', color: '#78350f', border: '#fcd34d', who: 'Above target — consider intensifying therapy' };
  if (value < 10.0) return { lbl: 'DM – Poor Control',cls:'chip-high',     bg: '#fee2e2', color: '#7f1d1d', border: '#fca5a5', who: 'Poor glycaemic control — intensify treatment now' };
  return                   { lbl: 'DM – Danger Zone', cls: 'chip-crisis',  bg: '#7f1d1d', color: '#fef2f2', border: '#dc2626', who: 'Very poor control — urgent clinical review required' };
}

export function isHbA1cAtTarget(value: number | null): boolean {
  if (!value) return false;
  return value < 8.0;
}

// ── PATIENT HELPERS ───────────────────────────────────────────

export function getLastVisit(patient: Patient): Visit | null {
  const attended = (patient.visits ?? []).filter((v) => v.att);
  if (!attended.length) return null;
  return [...attended].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
}

export function isDue(patient: Patient): boolean {
  if (patient.status !== 'active') return false;
  const lv = getLastVisit(patient);
  const ref = lv
    ? new Date(lv.date)
    : new Date(patient.enrol ?? new Date().toISOString());
  return (Date.now() - ref.getTime()) / 86_400_000 >= OVERDUE_THRESHOLD_DAYS;
}

export function isControlled(patient: Patient): boolean {
  const lv = getLastVisit(patient);
  if (!lv) return false;
  return (
    (!lv.sbp || isBPControlled(lv.sbp, lv.dbp)) &&
    (!lv.sugar || isGlucoseControlled(lv.sugar))
  );
}

export function getCurrentMeds(patient: Patient) {
  if (patient.medications?.length) {
    const sorted = [...patient.medications].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sorted[0].meds ?? [];
  }
  return getLastVisit(patient)?.meds ?? [];
}

// ── BMI ───────────────────────────────────────────────────────

export function calculateBMI(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const hM = heightCm / 100;
  return parseFloat((weightKg / (hM * hM)).toFixed(1));
}

export function bmiClass(bmi: number | null): { lbl: string; cls: string } {
  if (!bmi)      return { lbl: '—',         cls: 'chip-gray' };
  if (bmi < 18.5)return { lbl: 'Underweight',cls: 'chip-low' };
  if (bmi < 25.0)return { lbl: 'Normal',     cls: 'chip-normal' };
  if (bmi < 30.0)return { lbl: 'Overweight', cls: 'chip-elevated' };
  if (bmi < 35.0)return { lbl: 'Obese I',    cls: 'chip-high' };
  return               { lbl: 'Obese II+',  cls: 'chip-crisis' };
}

// ── CLINIC SCHEDULE ───────────────────────────────────────────

/**
 * Calculate next visit date.
 * Hard deadline = fromDate + intervalDays (NEVER exceeded).
 * Snaps backward to nearest configured clinic day (max 7 days back).
 */
export function nextVisitDate(
  fromDate: Date,
  intervalDays: number = VISIT_INTERVAL_DAYS,
  clinicDays: ClinicDayIndex[] = []
): Date {
  const deadline = new Date(fromDate);
  deadline.setDate(deadline.getDate() + intervalDays);

  if (!clinicDays.length) return deadline;

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(deadline);
    candidate.setDate(candidate.getDate() - offset);
    if (clinicDays.includes(candidate.getDay() as ClinicDayIndex)) {
      return candidate;
    }
  }
  return deadline;
}

export function getPatientNextVisitDate(patient: Patient, settings: ClinicSettings): Date {
  if (patient.scheduledNext?.date) return new Date(patient.scheduledNext.date);
  const lv = getLastVisit(patient);
  const from = lv?.date
    ? new Date(lv.date)
    : new Date(patient.enrol ?? new Date().toISOString());
  return nextVisitDate(from, VISIT_INTERVAL_DAYS, settings.days);
}

export function getDaysUntilVisit(patient: Patient, settings: ClinicSettings): number {
  const nd = getPatientNextVisitDate(patient, settings);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((nd.getTime() - today.getTime()) / 86_400_000);
}

// ── HbA1c HELPERS ─────────────────────────────────────────────

const Q_ORDER: HbA1cQuarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export function getLatestHbA1c(patient: Patient, year: number | null = null): HbA1cEntry | null {
  if (!patient.hba1c?.length) return null;
  let entries = year ? patient.hba1c.filter((h) => h.year === year) : patient.hba1c;
  if (!entries.length) entries = patient.hba1c;
  return [...entries].sort(
    (a, b) =>
      (b.year * 10 + Q_ORDER.indexOf(b.quarter)) -
      (a.year * 10 + Q_ORDER.indexOf(a.quarter))
  )[0] ?? null;
}

export function getHbA1cTrend(
  patient: Patient,
  year: number
): 'improving' | 'worsening' | 'stable' | 'insufficient-data' {
  const entries = (patient.hba1c ?? [])
    .filter((h) => h.year === year)
    .sort((a, b) => Q_ORDER.indexOf(a.quarter) - Q_ORDER.indexOf(b.quarter));
  if (entries.length < 2) return 'insufficient-data';
  const diff = entries[entries.length - 1].value - entries[0].value;
  if (diff < -0.5) return 'improving';
  if (diff > 0.5)  return 'worsening';
  return 'stable';
}

export function avgHbA1cForQuarter(
  patients: Patient[],
  year: number,
  quarter: HbA1cQuarter
): number | null {
  const values = patients
    .map((p) => (p.hba1c ?? []).find((h) => h.year === year && h.quarter === quarter))
    .filter((e): e is HbA1cEntry => !!e)
    .map((e) => e.value);
  if (!values.length) return null;
  return parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1));
}

export function getCurrentQuarter(): HbA1cQuarter {
  const m = new Date().getMonth();
  if (m < 3) return 'Q1';
  if (m < 6) return 'Q2';
  if (m < 9) return 'Q3';
  return 'Q4';
}

// ── PROGRAMME STATS ───────────────────────────────────────────

export function getProgrammeSummary(patients: Patient[]) {
  const active     = patients.filter((p) => p.status === 'active');
  const ltfu       = patients.filter((p) => p.status === 'ltfu');
  const due        = patients.filter((p) => isDue(p));
  const controlled = patients.filter((p) => isControlled(p));
  const dm         = patients.filter((p) => p.cond === 'DM' || p.cond === 'DM+HTN');
  const htn        = patients.filter((p) => p.cond === 'HTN' || p.cond === 'DM+HTN');
  return {
    total: patients.length, active: active.length,
    ltfu: ltfu.length, due: due.length,
    controlled: controlled.length, dm: dm.length, htn: htn.length,
    controlRate: active.length ? Math.round((controlled.length / active.length) * 100) : null,
    ltfuRate: patients.length ? Math.round((ltfu.length / patients.length) * 100) : null,
  };
}

export function getMonthlyStats(patients: Patient[], month: number) {
  const visits = patients.flatMap((p) => p.visits ?? []).filter((v) => +v.month === month);
  const attended = visits.filter((v) => v.att);
  const withBP   = attended.filter((v) => v.sbp && v.dbp);
  const bpCtrl   = withBP.filter((v) => isBPControlled(v.sbp, v.dbp));
  const withSG   = attended.filter((v) => v.sugar);
  const sgCtrl   = withSG.filter((v) => isGlucoseControlled(v.sugar));
  return {
    total: visits.length, attended: attended.length,
    missed: visits.length - attended.length,
    attendanceRate: visits.length ? Math.round((attended.length / visits.length) * 100) : null,
    bpMeasured: withBP.length, bpControlled: bpCtrl.length,
    bpControlRate: withBP.length ? Math.round((bpCtrl.length / withBP.length) * 100) : null,
    glucoseMeasured: withSG.length, glucoseControlled: sgCtrl.length,
    glucoseControlRate: withSG.length ? Math.round((sgCtrl.length / withSG.length) * 100) : null,
  };
}

// ── DATE UTILITIES ────────────────────────────────────────────

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}
