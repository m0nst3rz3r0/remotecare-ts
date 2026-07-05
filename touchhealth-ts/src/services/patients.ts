// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · DM/HTN NCD MANAGEMENT SYSTEM
// src/services/patients.ts — Patient CRUD, code generation,
//   visit management, HbA1c, status transitions
//
// FIX: loadPatients / savePatients are no longer defined here.
//      They are imported from storage.ts (single source of truth).
//      This eliminates the dual-write bug where two independent
//      copies operated against the same localStorage key.
// ════════════════════════════════════════════════════════════

import type {
  Patient,
  Visit,
  Medication,
  MedicationRecord,
  HbA1cEntry,
  HbA1cQuarter,
  PatientStatus,
  Sex,
  Condition,
  SessionUser,
  ScheduledAppointment,
  GeneratedCode,
  CodeComponents,
  ClinicSettings,
} from '../types';
import type { GeneratedMealPlan } from '../lib/clinical/types';
import { calculateBMI } from '../lib/clinical/calculators';
import { getNutritionRiskLevel } from '../lib/clinical/nutritionEngine';
import { resolvePatientCondition } from '../lib/clinical/conditions';
import { Diagnosis } from '../data/icd10';
import { InvestigationResult } from '../data/investigations';
import { today, getLastVisit, nextVisitDate } from './clinical';

// ── RE-EXPORT FROM STORAGE (single source of truth) ──────────
// All callers that previously imported loadPatients/savePatients
// from this file will still compile — they just get the canonical
// versions now.
export { loadPatients, savePatients } from './storage';

/** Patients still enrolled in routine follow-up (not LTFU or discharged). */
export const ACTIVE_PATIENT_STATUSES: ReadonlyArray<PatientStatus> = ['active'];

export function isActivePatientStatus(status: PatientStatus): boolean {
  return ACTIVE_PATIENT_STATUSES.includes(status);
}

/** Legacy: `completed` was wrongly used as a programme status; treat as still monitored. */
export function normalizeLegacyPatientStatus(status: PatientStatus): PatientStatus {
  return status === 'completed' ? 'active' : status;
}

export function isSeenToday(patient: Patient): boolean {
  const today = new Date().toISOString().split('T')[0];
  return (patient.visits ?? []).some((v) => v.att && v.date === today);
}

// ── PATIENT VISIBILITY ────────────────────────────────────────

/**
 * Returns patients visible to the current user.
 * Admins see all. Doctors see only their assigned hospital.
 */
export function getVisiblePatients(
  patients: Patient[],
  user: SessionUser | null
): Patient[] {
  if (!user || user.role === 'admin') return patients;
  const scope = user.sessionHospital || user.hospital;
  return scope ? patients.filter((p) => p.hospital === scope) : patients;
}

// ── AUTO-CODE GENERATION ──────────────────────────────────────

/**
 * Derive a consonant-heavy uppercase prefix of given length from a name.
 * Strips common noise words (City, Municipal, Town, etc.) first.
 *
 * Examples:
 *   mkPrefix('Kagera', 2)           → 'KG'
 *   mkPrefix('Bukoba Municipal', 2) → 'BK'
 *   mkPrefix('Zamzam Hospital', 3)  → 'ZMZ'
 */
export function mkPrefix(name: string, len: number): string {
  const NOISE = /\s+(City|Municipal|Town|Urban|Regional|District|Centre|Center|Health|Hospital)\b/gi;
  const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ';

  const clean = name.replace(NOISE, '').trim();
  const upper = clean.toUpperCase().replace(/[^A-Z]/g, '');

  let result = '';
  for (let i = 0; i < upper.length && result.length < len; i++) {
    if (i === 0 || CONSONANTS.includes(upper[i])) result += upper[i];
  }
  while (result.length < len) {
    result += upper[result.length] ?? 'X';
  }
  return result.slice(0, len);
}

/**
 * Build the location prefix: RG-DT-HSP
 *
 * Example: Kagera / Bukoba Municipal / Zamzam Hospital → 'KG-BK-ZMZ'
 */
export function buildLocationPrefix(
  region: string,
  district: string,
  hospitalName: string
): string {
  return [
    mkPrefix(region, 2),
    mkPrefix(district, 2),
    mkPrefix(hospitalName, 3),
  ].join('-');
}

/**
 * Find the next available sequence number for a given namespace prefix + gender.
 *
 * The namespace is: locationPrefix[-deviceLetter]-G
 * e.g.  'KG-BK-ZMZ-A-M' for Device A males at Zamzam.
 *
 * Because every device in a facility sees ALL patients (they sync),
 * this scan correctly avoids numbers already used by other devices
 * in the same device-letter namespace.
 */
export function nextPatientSeq(
  patients: Patient[],
  locationPrefix: string,
  genderChar: 'M' | 'F'
): number {
  const searchPrefix = `${locationPrefix}-${genderChar}`;
  const existing = patients
    .filter((p) => p.code?.startsWith(searchPrefix))
    .map((p) => {
      const parts = p.code.split('-');
      const last = parts[parts.length - 1];
      return parseInt(last.replace(/^[MF]/, ''), 10) || 0;
    })
    .filter((n) => !isNaN(n));

  return existing.length ? Math.max(...existing) + 1 : 1;
}

/**
 * Generate a full patient code.
 *
 * WITHOUT device prefix (legacy / single-device):
 *   KG-BK-ZMZ-M0001
 *
 * WITH device prefix (multi-device per facility):
 *   KG-BK-ZMZ-A-M0001  (Device A)
 *   KG-BK-ZMZ-B-M0001  (Device B — different namespace, no collision)
 *
 * All devices at the same facility share the RG-DT-HSP prefix so they
 * see each other's patients after sync. The device letter only creates
 * separate sequence namespaces to prevent same-number collisions when
 * two tablets register a patient simultaneously without connectivity.
 *
 * The sequence counter is derived from ALL patients in the store
 * (not just those with the same device letter), because the store
 * contains synced patients from every device in the facility.
 */
export function generatePatientCode(
  patients: Patient[],
  region: string,
  district: string,
  hospitalName: string,
  sex: Sex,
  devicePrefix?: string | null
): GeneratedCode {
  const genderChar = sex === 'M' ? 'M' : 'F';
  const baseLocationPrefix = buildLocationPrefix(region, district, hospitalName);

  // Namespace: RG-DT-HSP[-DeviceLetter]
  const locationPrefix = devicePrefix
    ? `${baseLocationPrefix}-${devicePrefix}`
    : baseLocationPrefix;

  const seq = nextPatientSeq(patients, locationPrefix, genderChar);
  const seqStr = String(seq).padStart(4, '0');
  const code = `${locationPrefix}-${genderChar}${seqStr}`;

  const components: CodeComponents = {
    regionPrefix:   mkPrefix(region, 2),
    districtPrefix: mkPrefix(district, 2),
    hospitalPrefix: mkPrefix(hospitalName, 3),
    devicePrefix:   devicePrefix ?? undefined,
    genderChar,
    sequence:       seq,
  };

  return { code, components };
}

/**
 * Safety check: ensure a generated code is truly unique across
 * all patients currently in the store.  Increments the trailing
 * sequence until no collision is found.
 */
export function ensureUniqueCode(patients: Patient[], code: string): string {
  let safe = code;
  while (patients.find((p) => p.code === safe)) {
    const parts = safe.split('-');
    const last = parts[parts.length - 1];
    const gChar = last[0];
    const num = parseInt(last.slice(1), 10) + 1;
    parts[parts.length - 1] = gChar + String(num).padStart(4, '0');
    safe = parts.join('-');
  }
  return safe;
}

// ── PATIENT REGISTRATION ──────────────────────────────────────

export type PatientResult =
  | { success: true;  patient: Patient }
  | { success: false; error: string };

export interface RegisterPatientParams {
  region: string;
  district: string;
  hospital: string;
  age: number;
  sex: Sex;
  cond: Condition;
  enrol: string;
  phone?: string;
  address?: string;
  currentUser: SessionUser | null;
  /** Single A–Z letter identifying this device within the facility. */
  devicePrefix?: string | null;
}

export function registerPatient(
  patients: Patient[],
  params: RegisterPatientParams
): PatientResult {
  const { region, district, hospital, age, sex, cond, enrol, phone, address } = params;

  if (!region || !district || !hospital) {
    return { success: false, error: 'Please select Region, District and Facility.' };
  }
  if (!age || age < 1 || age > 120) {
    return { success: false, error: 'Please enter a valid age (1–120).' };
  }
  if (!sex) {
    return { success: false, error: 'Please select sex.' };
  }
  if (!cond) {
    return { success: false, error: 'Please select the patient condition.' };
  }
  if (!enrol) {
    return { success: false, error: 'Please enter the enrolment date.' };
  }

  const { devicePrefix } = params;
  const { code: rawCode } = generatePatientCode(patients, region, district, hospital, sex, devicePrefix);
  const code = ensureUniqueCode(patients, rawCode);

  const newPatient: Patient = {
    id:          Date.now(),
    code,
    age,
    sex,
    cond,
    enrol,
    phone:       phone?.trim() || undefined,
    address:     address?.trim() || undefined,
    status:      'active',
    hospital,
    region,
    district,
    visits:      [],
    medications: [],
    hba1c:       [],
    callLog:     [],
  };

  return { success: true, patient: newPatient };
}

// ── PATIENT STATUS ────────────────────────────────────────────

export function setPatientStatus(
  patients: Patient[],
  patientId: number,
  status: PatientStatus
): Patient[] {
  const next = normalizeLegacyPatientStatus(status);
  return patients.map((p) =>
    p.id === patientId ? { ...p, status: next } : p
  );
}

/** Recall from LTFU: reactivate and schedule a near-term follow-up so auto-LTFU does not immediately re-fire. */
export function recallFromLtfu(
  patients: Patient[],
  patientId: number,
  settings: ClinicSettings,
  scheduledBy = '',
): Patient[] {
  const recallDate = nextVisitDate(new Date(), 14, settings.days);
  return patients.map((p) => {
    if (p.id !== patientId) return p;
    return {
      ...p,
      status: 'active',
      scheduledNext: {
        date: recallDate.toISOString().split('T')[0],
        note: 'Recalled from LTFU — schedule follow-up',
        scheduledOn: today(),
        scheduledBy,
      },
    };
  });
}

export function deletePatient(
  patients: Patient[],
  patientId: number
): Patient[] {
  return patients.filter((p) => p.id !== patientId);
}

// ── VISIT MANAGEMENT ──────────────────────────────────────────

export interface RecordVisitParams {
  patientId:    number;
  month:        number;
  date:         string;
  attended:     boolean;
  sbp?:         number;
  dbp?:         number;
  sugar?:       number;
  sugarType?:   'FBS' | 'RBS' | '2HPP';
  weight?:      number;
  height?:      number;
  bmi?:         number;
  notes?:       string;
  meds:         Medication[];
  nextDate?:    string;
  nextNote?:    string;
  scheduledBy?: string;
  clinicalNotes?: string;
  differentialDx?: string;
  diagnoses?: Diagnosis[];
  investigations?: InvestigationResult[];
  drugWarnings?: string[];
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
  hba1cValue?:   number;
  hba1cQuarter?: HbA1cQuarter;
  hba1cYear?:    number;
  mealPlan?:     GeneratedMealPlan;
}

function nowIso() {
  return new Date().toISOString();
}

export function recordVisit(
  patients: Patient[],
  params: RecordVisitParams
): Patient[] {
  return patients.map((p) => {
    if (p.id !== params.patientId) return p;

    const {
      month, date, attended: att, sbp, dbp, sugar, sugarType,
      weight, height, bmi, notes, meds,
      nextDate, nextNote, scheduledBy,
      hba1cValue, hba1cQuarter, hba1cYear,
      presentingComplaint, physicalExam,
      diagnoses, investigations, drugWarnings,
      mealPlan,
    } = params;

    const visit: Visit = {
      id:        'v' + Date.now(),
      month,
      year:      new Date(date).getFullYear(),
      date,
      att,
      sbp:       att ? sbp ?? null : null,
      dbp:       att ? dbp ?? null : null,
      sugar:     att ? sugar ?? null : null,
      sugarType: att ? sugarType ?? '' : '',
      weight:    att ? weight ?? null : null,
      height:    att ? height ?? null : null,
      bmi:       att ? bmi ?? null : null,
      notes:     att ? notes ?? '' : '',
      meds:      att ? meds : [],
      presentingComplaint: att ? presentingComplaint ?? undefined : undefined,
      physicalExam:        att ? physicalExam        ?? undefined : undefined,
      diagnoses:           att ? diagnoses            ?? undefined : undefined,
      investigations:      att ? investigations       ?? undefined : undefined,
      drugWarnings:        att ? drugWarnings         ?? undefined : undefined,
      mealPlan:            att ? mealPlan             ?? undefined : undefined,
    };

    const visits = [
      ...(p.visits ?? []).filter((v) => v.date !== date),
      visit,
    ];

    let medications = [...(p.medications ?? [])];
    if (att && meds.length) {
      medications = medications.filter((m) => m.date !== date);
      medications.push({ date, changedAt: nowIso(), changedBy: scheduledBy ?? '', meds });
    }

    let scheduledNext: ScheduledAppointment | undefined = p.scheduledNext;
    if (nextDate) {
      scheduledNext = {
        date:        nextDate,
        note:        nextNote ?? '',
        scheduledOn: date,
        scheduledBy: scheduledBy ?? '',
      };
    }

    let hba1c = [...(p.hba1c ?? [])];
    if (att && hba1cValue && hba1cQuarter && (p.cond === 'DM' || p.cond === 'DM+HTN')) {
      const yr = hba1cYear ?? new Date(date).getFullYear();
      hba1c = hba1c.filter(
        (h) => !(h.year === yr && h.quarter === hba1cQuarter)
      );
      const entry: HbA1cEntry = {
        year:       yr,
        quarter:    hba1cQuarter,
        value:      hba1cValue,
        date,
        recordedBy: scheduledBy ?? '',
      };
      hba1c.push(entry);
    }

    const nextStatus: PatientStatus = att ? 'active' : p.status;

    let nutritionProfile = p.nutritionProfile;
    if (att && mealPlan) {
      const bmiVal = weight && height ? calculateBMI(weight, height) : 0;
      nutritionProfile = {
        ...p.nutritionProfile,
        nutritionTargetKcal: mealPlan.targets.tdee,
        nutritionProteinG: mealPlan.targets.proteinG,
        nutritionSodiumMg: mealPlan.targets.sodiumMg,
        nutritionRiskLevel: getNutritionRiskLevel(
          mealPlan.diagnosis.split(',').map(s => s.trim()).filter(Boolean),
          bmiVal,
          mealPlan.targets.sodiumMg,
        ),
        drugFoodAlertCount: mealPlan.drugAlerts.length,
        lastMealPlanDate: mealPlan.date,
      };
    }

    return { ...p, visits, medications, scheduledNext, hba1c, status: nextStatus, nutritionProfile };
  });
}

export function deleteVisit(
  patients: Patient[],
  patientId: number,
  visitId: string
): Patient[] {
  return patients.map((p) =>
    p.id !== patientId
      ? p
      : { ...p, visits: (p.visits ?? []).filter((v) => v.id !== visitId) }
  );
}

// ── SCHEDULED APPOINTMENTS ────────────────────────────────────

export function scheduleAppointment(
  patients: Patient[],
  patientId: number,
  date: string,
  note: string,
  scheduledBy: string
): Patient[] {
  return patients.map((p) =>
    p.id !== patientId
      ? p
      : {
          ...p,
          scheduledNext: {
            date,
            note,
            scheduledOn: today(),
            scheduledBy,
          },
        }
  );
}

export function clearScheduledAppointment(
  patients: Patient[],
  patientId: number
): Patient[] {
  return patients.map((p) => {
    if (p.id !== patientId) return p;
    const { scheduledNext: _scheduledNext, ...rest } = p;
    return rest as Patient;
  });
}

export function confirmAllPredicted(
  patients: Patient[],
  getNextDate: (patient: Patient) => Date,
  scheduledBy: string
): Patient[] {
  return patients.map((p) => {
    if (p.status !== 'active' || p.scheduledNext) return p;
    const nd = getNextDate(p);
    return {
      ...p,
      scheduledNext: {
        date:        nd.toISOString().split('T')[0],
        note:        '',
        scheduledOn: today(),
        scheduledBy,
      },
    };
  });
}

// ── MEDICATION MANAGEMENT ─────────────────────────────────────

export function updateMedications(
  patients: Patient[],
  patientId: number,
  meds: Medication[],
  changedBy: string = ''
): Patient[] {
  return patients.map((p) => {
    if (p.id !== patientId) return p;
    const record: MedicationRecord = {
      date: today(),
      changedAt: nowIso(),
      changedBy,
      meds,
    };
    return {
      ...p,
      medications: [...(p.medications ?? []), record],
    };
  });
}

// ── HbA1c MANAGEMENT ──────────────────────────────────────────

export function addHbA1cEntry(
  patients: Patient[],
  patientId: number,
  entry: Omit<HbA1cEntry, 'date'> & { date?: string }
): Patient[] {
  return patients.map((p) => {
    if (p.id !== patientId) return p;
    if (p.cond !== 'DM' && p.cond !== 'DM+HTN') return p;

    const fullEntry: HbA1cEntry = {
      ...entry,
      date: entry.date ?? today(),
    };

    const hba1c = [
      ...(p.hba1c ?? []).filter(
        (h) => !(h.year === fullEntry.year && h.quarter === fullEntry.quarter)
      ),
      fullEntry,
    ];

    return { ...p, hba1c };
  });
}

export function deleteHbA1cEntry(
  patients: Patient[],
  patientId: number,
  year: number,
  quarter: HbA1cQuarter
): Patient[] {
  return patients.map((p) =>
    p.id !== patientId
      ? p
      : {
          ...p,
          hba1c: (p.hba1c ?? []).filter(
            (h) => !(h.year === year && h.quarter === quarter)
          ),
        }
  );
}

// ── FILTERING & SEARCH ────────────────────────────────────────

export type PatientFilterType = 'all' | 'active' | 'due' | 'ltfu' | 'completed';

export function filterPatients(
  patients: Patient[],
  filter: PatientFilterType,
  searchQuery: string,
  isDueFn: (p: Patient) => boolean
): Patient[] {
  const q = searchQuery.toLowerCase().trim();

  return patients
    .filter((p) => {
      switch (filter) {
        case 'active':    return isActivePatientStatus(p.status);
        case 'ltfu':      return p.status === 'ltfu';
        case 'due':       return isDueFn(p);
        case 'completed': return isActivePatientStatus(p.status) && isSeenToday(p);
        default:          return true;
      }
    })
    .filter((p) => {
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        (p.phone ?? '').includes(q) ||
        (p.address ?? '').toLowerCase().includes(q) ||
        (p.region ?? '').toLowerCase().includes(q) ||
        (p.district ?? '').toLowerCase().includes(q)
      );
    });
}

// ── STATS HELPERS ─────────────────────────────────────────────

export function countByCondition(patients: Patient[]) {
  const resolved = patients.map((patient) => resolvePatientCondition(patient));
  return {
    htn:    resolved.filter((condition) => condition === 'HTN').length,
    dm:     resolved.filter((condition) => condition === 'DM').length,
    dmHtn:  resolved.filter((condition) => condition === 'DM+HTN').length,
  };
}

export function countByStatus(patients: Patient[]) {
  return {
    active:     patients.filter((p) => isActivePatientStatus(p.status)).length,
    ltfu:       patients.filter((p) => p.status === 'ltfu').length,
    seenToday:  patients.filter((p) => isActivePatientStatus(p.status) && isSeenToday(p)).length,
    discharged: patients.filter((p) => p.status === 'discharged').length,
  };
}

export function countBySex(patients: Patient[]) {
  return {
    male:   patients.filter((p) => p.sex === 'M').length,
    female: patients.filter((p) => p.sex === 'F').length,
  };
}

export function enrolledInYear(patients: Patient[], year: number): Patient[] {
  return patients.filter(
    (p) => p.enrol && new Date(p.enrol).getFullYear() === year
  );
}

export function patientsToAggregateRows(
  patients: Patient[],
  year: number,
  month: number | null
) {
  void year;
  void month;
  return patients.map((p) => {
    const lv = getLastVisit(p);
    return {
      code:       p.code,
      sex:        p.sex,
      age:        p.age,
      condition:  p.cond,
      status:     p.status,
      hospital:   p.hospital,
      region:     p.region,
      district:   p.district,
      enrolYear:  p.enrol ? new Date(p.enrol).getFullYear() : null,
      lastVisit:  lv?.date ?? null,
      lastSBP:    lv?.sbp ?? null,
      lastDBP:    lv?.dbp ?? null,
      lastSugar:  lv?.sugar ?? null,
      visitCount: (p.visits ?? []).filter((v) => v.att).length,
    };
  });
}
