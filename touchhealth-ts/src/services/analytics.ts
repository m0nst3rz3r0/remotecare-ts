import {
  bpClass,
  getMonthlyAttendanceRate,
  getMonthlyStats,
  isControlled,
  isDueWithSettings,
  isGlucoseControlled,
  sgClass,
} from './clinical';
import { isActivePatientStatus } from './patients';
import type { ClinicSettings, Hospital, Patient, User, Visit } from '../types';

export type MetricId =
  | 'enrolment'
  | 'bp_control'
  | 'attendance'
  | 'treatment_rate'
  | 'polypharmacy'
  | 'ltfu_rate'
  | 'dm_patients'
  | 'htn_patients'
  | 'htn_drug_combo'
  | 'dm_drug_combo'
  | 'bp_by_drug'
  | 'sugar_by_drug'
  | 'combo_therapy_rate'
  | 'drug_class_coverage';

export type ChartType = 'line' | 'bar';
export type MetricGroup = 'core' | 'drugs' | 'clinical';

export interface MetricDef {
  id: MetricId;
  label: string;
  color: string;
  fill: string;
  unit: string;
  type: ChartType;
  group: MetricGroup;
}

export interface BarData {
  label: string;
  value: number;
  controlRate?: number;
  color: string;
}

export interface ProgrammeOverview {
  total: number;
  active: number;
  ltfu: number;
  due: number;
  controlled: number;
  ctrlRate: number;
}

export interface FacilityOverviewRow {
  hospital: Hospital;
  total: number;
  activePct: number;
  ctrlRate: number | null;
  ltfu: number;
}

export interface DirectoryMetrics {
  patientCount: number;
  controlled: number;
  missed: number;
  attendPct: number;
  ltfu: number;
}

export interface HospitalAnalyticsRow extends DirectoryMetrics {
  hospital: Hospital;
}

export interface DoctorAnalyticsRow extends DirectoryMetrics {
  doctor: User;
}

export interface MonthlyVisitRow {
  patient: Patient;
  visit: Visit;
  bp: ReturnType<typeof bpClass> | null;
  sg: ReturnType<typeof sgClass> | null;
}

export interface MonthlyOverviewRow {
  month: number;
  label: string;
  enrolment: number;
  activePatients: number;
  activeDmPatients: number;
  activeHtnPatients: number;
  attendanceRate: number | null;
  bpControlRate: number | null;
  comboTherapyRate: number | null;
  ltfuRate: number | null;
}

export const ANALYTICS_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const ANALYTICS_METRICS: MetricDef[] = [
  { id: 'enrolment', label: 'Enrolment Velocity', color: '#10b981', fill: 'rgba(16,185,129,0.12)', unit: 'count', type: 'bar', group: 'core' },
  { id: 'bp_control', label: 'BP Control Rate', color: '#1a56db', fill: 'rgba(26,86,219,0.12)', unit: '%', type: 'line', group: 'core' },
  { id: 'attendance', label: 'Attendance Rate', color: '#8b5cf6', fill: 'rgba(139,92,246,0.12)', unit: '%', type: 'line', group: 'core' },
  { id: 'ltfu_rate', label: 'LTFU Rate', color: '#ef4444', fill: 'rgba(239,68,68,0.12)', unit: '%', type: 'line', group: 'core' },
  { id: 'dm_patients', label: 'Active DM Patients', color: '#06b6d4', fill: 'rgba(6,182,212,0.12)', unit: 'count', type: 'bar', group: 'core' },
  { id: 'htn_patients', label: 'Active HTN Patients', color: '#ec4899', fill: 'rgba(236,72,153,0.12)', unit: 'count', type: 'bar', group: 'core' },
  { id: 'treatment_rate', label: 'Treatment Rate', color: '#f59e0b', fill: 'rgba(245,158,11,0.12)', unit: '%', type: 'line', group: 'drugs' },
  { id: 'polypharmacy', label: 'Polypharmacy Rate (>=2)', color: '#f97316', fill: 'rgba(249,115,22,0.12)', unit: '%', type: 'line', group: 'drugs' },
  { id: 'combo_therapy_rate', label: 'Combination Therapy Rate', color: '#a78bfa', fill: 'rgba(167,139,250,0.12)', unit: '%', type: 'line', group: 'drugs' },
  { id: 'drug_class_coverage', label: 'Drug Class Coverage', color: '#34d399', fill: 'rgba(52,211,153,0.12)', unit: '%', type: 'bar', group: 'drugs' },
  { id: 'bp_by_drug', label: 'BP Control by Drug', color: '#0ea5e9', fill: 'rgba(14,165,233,0.12)', unit: '%', type: 'bar', group: 'clinical' },
  { id: 'sugar_by_drug', label: 'Sugar Control by Drug', color: '#d946ef', fill: 'rgba(217,70,239,0.12)', unit: '%', type: 'bar', group: 'clinical' },
  { id: 'htn_drug_combo', label: 'HTN Drug Combinations', color: '#64748b', fill: 'rgba(100,116,139,0.12)', unit: 'count', type: 'bar', group: 'clinical' },
  { id: 'dm_drug_combo', label: 'DM Drug Combinations', color: '#78716c', fill: 'rgba(120,113,108,0.12)', unit: 'count', type: 'bar', group: 'clinical' },
];

const HTN_CLASSES: Record<string, string[]> = {
  'ACE Inhibitor': ['enalapril', 'lisinopril', 'captopril', 'ramipril', 'perindopril'],
  ARB: ['losartan', 'valsartan', 'irbesartan', 'candesartan', 'telmisartan'],
  CCB: ['amlodipine', 'nifedipine', 'felodipine', 'diltiazem', 'verapamil'],
  Diuretic: ['hydrochlorothiazide', 'furosemide', 'spironolactone', 'indapamide', 'chlorthalidone', 'hctz'],
  'Beta-blocker': ['atenolol', 'metoprolol', 'bisoprolol', 'carvedilol', 'propranolol'],
  'Alpha-blocker': ['doxazosin', 'prazosin', 'terazosin'],
};

const DM_CLASSES: Record<string, string[]> = {
  Metformin: ['metformin'],
  Sulfonylurea: ['glibenclamide', 'gliclazide', 'glimepiride', 'glipizide', 'tolbutamide'],
  Insulin: ['insulin', 'mixtard', 'actrapid', 'lantus', 'novomix', 'humulin', 'novorapid'],
  SGLT2i: ['dapagliflozin', 'empagliflozin', 'canagliflozin'],
  'DPP-4i': ['sitagliptin', 'saxagliptin', 'alogliptin', 'linagliptin'],
  'GLP-1': ['semaglutide', 'liraglutide', 'dulaglutide', 'exenatide'],
};

function detectClass(medName: string, classes: Record<string, string[]>): string | null {
  const lower = medName.toLowerCase();
  for (const [cls, drugs] of Object.entries(classes)) {
    if (drugs.some((drug) => lower.includes(drug))) return cls;
  }
  return null;
}

function getLastVisitMeds(patient: Patient): string[] {
  const visits = [...(patient.visits ?? [])].sort(
    (a, b) => new Date(b.date ?? '').getTime() - new Date(a.date ?? '').getTime(),
  );
  const last = visits.find((visit) => visit.att && (visit.meds ?? []).length > 0);
  return (last?.meds ?? []).map((med) => med.name ?? '');
}

function getVisitMeds(visit: Visit): string[] {
  return (visit.meds ?? []).map((med) => med.name ?? '');
}

function getActivePatients(patients: Patient[]) {
  return patients.filter((patient) => isActivePatientStatus(patient.status));
}

function getDirectoryMetrics(
  patients: Patient[],
  settings: ClinicSettings,
  month: number,
  year: number,
  now: Date = new Date(),
): DirectoryMetrics {
  const active = getActivePatients(patients);
  return {
    patientCount: patients.length,
    controlled: active.filter((patient) => isControlled(patient)).length,
    missed: active.filter((patient) => isDueWithSettings(patient, settings, now)).length,
    attendPct: getMonthlyAttendanceRate(patients, month, year, now) ?? 0,
    ltfu: patients.filter((patient) => patient.status === 'ltfu').length,
  };
}

export function getDirectorySummary(
  patients: Patient[],
  settings: ClinicSettings,
  month: number,
  year: number,
  now: Date = new Date(),
): DirectoryMetrics {
  return getDirectoryMetrics(patients, settings, month, year, now);
}

export function isBarMetric(metricId: MetricId) {
  return ANALYTICS_METRICS.find((metric) => metric.id === metricId)?.type === 'bar';
}

export function getProgrammeOverview(
  patients: Patient[],
  settings?: ClinicSettings,
  now: Date = new Date(),
): ProgrammeOverview {
  const activePatients = getActivePatients(patients);
  const controlled = activePatients.filter((patient) => isControlled(patient)).length;
  const due = activePatients.filter((patient) => isDueWithSettings(patient, settings, now)).length;
  return {
    total: patients.length,
    active: activePatients.length,
    ltfu: patients.filter((patient) => patient.status === 'ltfu').length,
    due,
    controlled,
    ctrlRate: activePatients.length ? Math.round((controlled / activePatients.length) * 100) : 0,
  };
}

export function getFacilityOverviewRows(
  hospitals: Hospital[],
  patients: Patient[],
): FacilityOverviewRow[] {
  return hospitals.map((hospital) => {
    const facilityPatients = patients.filter((patient) => patient.hospital === hospital.name);
    const activePatients = getActivePatients(facilityPatients);
    const controlled = activePatients.filter((patient) => isControlled(patient)).length;
    return {
      hospital,
      total: facilityPatients.length,
      activePct: facilityPatients.length ? Math.round((activePatients.length / facilityPatients.length) * 100) : 0,
      ctrlRate: activePatients.length ? Math.round((controlled / activePatients.length) * 100) : null,
      ltfu: facilityPatients.filter((patient) => patient.status === 'ltfu').length,
    };
  });
}

export function getHospitalAnalyticsRows(
  hospitals: Hospital[],
  patients: Patient[],
  settings: ClinicSettings,
  month: number,
  year: number,
  now: Date = new Date(),
): HospitalAnalyticsRow[] {
  return hospitals.map((hospital) => {
    const facilityPatients = patients.filter((patient) => patient.hospital === hospital.name);
    return {
      hospital,
      ...getDirectoryMetrics(facilityPatients, settings, month, year, now),
    };
  });
}

export function getDoctorAnalyticsRows(
  doctors: User[],
  patients: Patient[],
  settings: ClinicSettings,
  month: number,
  year: number,
  now: Date = new Date(),
): DoctorAnalyticsRow[] {
  return doctors.map((doctor) => {
    const facilityPatients = patients.filter((patient) => patient.hospital === doctor.hospital);
    return {
      doctor,
      ...getDirectoryMetrics(facilityPatients, settings, month, year, now),
    };
  });
}

export function getMonthlyVisitRows(
  patients: Patient[],
  month: number,
  year: number,
): MonthlyVisitRow[] {
  const rows: MonthlyVisitRow[] = [];

  for (const patient of patients) {
    for (const visit of patient.visits ?? []) {
      if (+visit.month !== month || +(visit.year ?? year) !== year) continue;
      rows.push({
        patient,
        visit,
        bp: visit.att && visit.sbp && visit.dbp ? bpClass(visit.sbp, visit.dbp) : null,
        sg: visit.att && visit.sugar && visit.sugarType
          ? sgClass(visit.sugar, visit.sugarType)
          : null,
      });
    }
  }

  rows.sort((a, b) => new Date(b.visit.date).getTime() - new Date(a.visit.date).getTime());
  return rows;
}

export function getMetricSeries(
  metricId: MetricId,
  patients: Patient[],
  year: number,
): (number | null)[] {
  return ANALYTICS_MONTHS.map((_, index) => {
    const month = index + 1;

    switch (metricId) {
      case 'enrolment':
        return patients.filter((patient) => {
          if (!patient.enrol) return false;
          const enrolledAt = new Date(patient.enrol);
          return enrolledAt.getFullYear() === year && enrolledAt.getMonth() + 1 === month;
        }).length;

      case 'bp_control':
        return getMonthlyStats(
          patients.filter((patient) =>
            patient.visits?.some((visit) => +visit.month === month && +(visit.year ?? year) === year),
          ),
          month,
          year,
        ).bpControlRate;

      case 'attendance':
        return getMonthlyAttendanceRate(patients, month, year);

      case 'treatment_rate': {
        const activePatients = getActivePatients(patients);
        if (!activePatients.length) return null;
        const onTreatment = activePatients.filter((patient) =>
          patient.visits?.some(
            (visit) => +visit.month === month && +(visit.year ?? year) === year && visit.att && (visit.meds ?? []).length > 0,
          ),
        );
        return Math.round((onTreatment.length / activePatients.length) * 100);
      }

      case 'polypharmacy': {
        const attendedVisits = patients
          .flatMap((patient) => patient.visits ?? [])
          .filter((visit) => +visit.month === month && +(visit.year ?? year) === year && visit.att);
        if (!attendedVisits.length) return null;
        return Math.round((attendedVisits.filter((visit) => (visit.meds ?? []).length >= 2).length / attendedVisits.length) * 100);
      }

      case 'combo_therapy_rate': {
        const attendedVisits = patients
          .flatMap((patient) => patient.visits ?? [])
          .filter((visit) => +visit.month === month && +(visit.year ?? year) === year && visit.att);
        if (!attendedVisits.length) return null;
        const withCombo = attendedVisits.filter((visit) => {
          const meds = getVisitMeds(visit);
          const allClasses = { ...HTN_CLASSES, ...DM_CLASSES };
          const classes = new Set(meds.map((med) => detectClass(med, allClasses)).filter(Boolean));
          return classes.size >= 2;
        });
        return Math.round((withCombo.length / attendedVisits.length) * 100);
      }

      case 'ltfu_rate': {
        const enrolled = patients
          .filter((patient) => {
            const enrolledAt = new Date(patient.enrol ?? '');
            return enrolledAt.getFullYear() < year || (enrolledAt.getFullYear() === year && enrolledAt.getMonth() + 1 <= month);
          })
          .filter((patient) => patient.status !== 'discharged');
        if (!enrolled.length) return null;
        return Math.round((enrolled.filter((patient) => patient.status === 'ltfu').length / enrolled.length) * 100);
      }

      case 'dm_patients':
        return patients.filter((patient) =>
          (patient.cond === 'DM' || patient.cond === 'DM+HTN')
          && isActivePatientStatus(patient.status)
          && patient.visits?.some((visit) => +visit.month === month && +(visit.year ?? year) === year),
        ).length || null;

      case 'htn_patients':
        return patients.filter((patient) =>
          (patient.cond === 'HTN' || patient.cond === 'DM+HTN')
          && isActivePatientStatus(patient.status)
          && patient.visits?.some((visit) => +visit.month === month && +(visit.year ?? year) === year),
        ).length || null;

      case 'drug_class_coverage':
      case 'bp_by_drug':
      case 'sugar_by_drug':
      case 'htn_drug_combo':
      case 'dm_drug_combo':
        return null;
    }
  });
}

export function getMetricBarData(metricId: MetricId, patients: Patient[]): BarData[] | null {
  const colors = ['#1a56db', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#a78bfa', '#34d399'];

  if (metricId === 'drug_class_coverage') {
    const activePatients = getActivePatients(patients);
    if (!activePatients.length) return null;
    const allClasses = { ...HTN_CLASSES, ...DM_CLASSES };
    return Object.keys(allClasses).map((cls, index) => ({
      label: cls,
      value: Math.round(
        (activePatients.filter((patient) => getLastVisitMeds(patient).some((med) => detectClass(med, allClasses) === cls)).length / activePatients.length) * 100,
      ),
      color: colors[index % colors.length],
    }));
  }

  if (metricId === 'bp_by_drug') {
    const htnPatients = patients.filter((patient) => patient.cond === 'HTN' || patient.cond === 'DM+HTN');
    if (!htnPatients.length) return null;
    return Object.keys(HTN_CLASSES)
      .map((cls, index) => {
        const onDrug = htnPatients.filter((patient) => getLastVisitMeds(patient).some((med) => detectClass(med, HTN_CLASSES) === cls));
        if (!onDrug.length) return { label: cls, value: 0, color: colors[index] };
        const controlled = onDrug.filter((patient) => isControlled(patient));
        return { label: cls, value: Math.round((controlled.length / onDrug.length) * 100), color: colors[index] };
      })
      .filter((row) => row.value > 0 || patients.some((patient) => getLastVisitMeds(patient).some((med) => detectClass(med, HTN_CLASSES) === row.label)));
  }

  if (metricId === 'sugar_by_drug') {
    const dmPatients = patients.filter((patient) => patient.cond === 'DM' || patient.cond === 'DM+HTN');
    if (!dmPatients.length) return null;
    return Object.keys(DM_CLASSES)
      .map((cls, index) => {
        const onDrug = dmPatients.filter((patient) => getLastVisitMeds(patient).some((med) => detectClass(med, DM_CLASSES) === cls));
        if (!onDrug.length) return null;
        const controlled = onDrug.filter((patient) => {
          const last = [...(patient.visits ?? [])]
            .sort((a, b) => new Date(b.date ?? '').getTime() - new Date(a.date ?? '').getTime())
            .find((visit) => visit.att && visit.sugar != null);
          return last ? isGlucoseControlled(last.sugar) : false;
        });
        return { label: cls, value: Math.round((controlled.length / onDrug.length) * 100), color: colors[index] };
      })
      .filter(Boolean) as BarData[];
  }

  if (metricId === 'htn_drug_combo' || metricId === 'dm_drug_combo') {
    const isHtn = metricId === 'htn_drug_combo';
    const cohort = patients.filter((patient) =>
      (isHtn ? patient.cond === 'HTN' || patient.cond === 'DM+HTN' : patient.cond === 'DM' || patient.cond === 'DM+HTN')
      && isActivePatientStatus(patient.status),
    );
    if (!cohort.length) return null;
    const comboMap = new Map<string, Patient[]>();
    const classes = isHtn ? HTN_CLASSES : DM_CLASSES;

    cohort.forEach((patient) => {
      const meds = getLastVisitMeds(patient);
      const combo = [...new Set(meds.map((med) => detectClass(med, classes)).filter(Boolean))].sort();
      if (!combo.length) return;
      const key = combo.length === 1 ? combo[0]! : combo.join(' + ');
      if (!comboMap.has(key)) comboMap.set(key, []);
      comboMap.get(key)!.push(patient);
    });

    return Array.from(comboMap.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8)
      .map(([label, comboPatients], index) => ({
        label,
        value: comboPatients.length,
        controlRate: comboPatients.length
          ? Math.round((comboPatients.filter((patient) => (
            isHtn
              ? isControlled(patient)
              : (() => {
                  const last = [...(patient.visits ?? [])]
                    .sort((a, b) => new Date(b.date ?? '').getTime() - new Date(a.date ?? '').getTime())
                    .find((visit) => visit.att && visit.sugar != null);
                  return last ? isGlucoseControlled(last.sugar) : false;
                })()
          )).length / comboPatients.length) * 100)
          : 0,
        color: colors[index % colors.length],
      }));
  }

  return null;
}

export function getMonthlyOverviewRows(
  patients: Patient[],
  year: number,
): MonthlyOverviewRow[] {
  const enrolmentSeries = getMetricSeries('enrolment', patients, year);
  const attendanceSeries = getMetricSeries('attendance', patients, year);
  const bpControlSeries = getMetricSeries('bp_control', patients, year);
  const comboTherapySeries = getMetricSeries('combo_therapy_rate', patients, year);
  const ltfuSeries = getMetricSeries('ltfu_rate', patients, year);
  const dmPatientSeries = getMetricSeries('dm_patients', patients, year);
  const htnPatientSeries = getMetricSeries('htn_patients', patients, year);

  return ANALYTICS_MONTHS.map((label, index) => {
    const month = index + 1;
    const enrolment = enrolmentSeries[index] ?? 0;
    const attendanceRate = attendanceSeries[index];
    const bpControlRate = bpControlSeries[index];
    const comboTherapyRate = comboTherapySeries[index];
    const ltfuRate = ltfuSeries[index];
    const activePatients = patients.filter((patient) => {
      if (!isActivePatientStatus(patient.status)) return false;
      return patient.visits?.some((visit) => +visit.month === month && +(visit.year ?? year) === year);
    }).length;

    return {
      month,
      label,
      enrolment,
      activePatients,
      activeDmPatients: dmPatientSeries[index] ?? 0,
      activeHtnPatients: htnPatientSeries[index] ?? 0,
      attendanceRate,
      bpControlRate,
      comboTherapyRate,
      ltfuRate,
    };
  });
}

export function getAttendanceSeries(patients: Patient[], year: number) {
  return getMetricSeries('attendance', patients, year);
}

export function getDrugUsageSeries(patients: Patient[], year: number) {
  return getMetricSeries('treatment_rate', patients, year);
}

export function getBpControlSeries(patients: Patient[], year: number) {
  return getMetricSeries('bp_control', patients, year);
}

export function getGlucoseControlSeries(patients: Patient[], year: number) {
  return ANALYTICS_MONTHS.map((_, index) => {
    const month = index + 1;
    const visits = patients
      .flatMap((patient) => patient.visits ?? [])
      .filter((visit) => +visit.month === month && +(visit.year ?? year) === year && visit.att);
    const measured = visits.filter((visit) => typeof visit.sugar === 'number' && visit.sugar !== null);
    const controlled = measured.filter((visit) => isGlucoseControlled(visit.sugar as number));
    return measured.length ? Math.round((controlled.length / measured.length) * 100) : null;
  });
}
