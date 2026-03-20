// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · DM/HTN NCD MANAGEMENT SYSTEM
// src/services/patients.ts — Patient CRUD, code generation,
//   visit management, HbA1c, status transitions
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
} from '../types';
import { today, getLastVisit } from './clinical';

// ── STORAGE KEY ───────────────────────────────────────────────

const PATIENTS_KEY = 'zmz2_pts';

// ── STORAGE HELPERS ───────────────────────────────────────────

export function loadPatients(): Patient[] {
  try {
    const raw = localStorage.getItem(PATIENTS_KEY);
    return raw ? (JSON.parse(raw) as Patient[]) : [];
  } catch {
    return [];
  }
}

export function savePatients(patients: Patient[]): void {
  localStorage.setItem(PATIENTS_KEY, JSON.stringify(patients));
}

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
  // Pad with remaining chars if still short
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
 * Find the next available sequence number for a given location prefix + gender.
 * Scans all existing patients to prevent collisions.
 *
 * Format searched: 'KG-BK-ZMZ-M####'
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
      // Strip leading gender char, parse number
      return parseInt(last.replace(/^[MF]/, ''), 10) || 0;
    })
    .filter((n) => !isNaN(n));

  return existing.length ? Math.max(...existing) + 1 : 1;
}

/**
 * Generate a full patient code.
 * Format: [Region2]-[District2]-[Hospital3]-[G][NNNN]
 *
 * Examples:
 *   KG-BK-ZMZ-M0001  (1st male, Zamzam, Bukoba, Kagera)
 *   KG-BK-ZMZ-F0001  (1st female, same location)
 *   DS-IL-MHN-M0042  (42nd male, Muhimbili, Ilala, Dar es Salaam)
 */
export function generatePatientCode(
  patients: Patient[],
  region: string,
  district: string,
  hospitalName: string,
  sex: Sex
): GeneratedCode {
  const genderChar = sex === 'M' ? 'M' : 'F';
  const locationPrefix = buildLocationPrefix(region, district, hospitalName);
  const seq = nextPatientSeq(patients, locationPrefix, genderChar);
  const seqStr = String(seq).padStart(4, '0');
  const code = `${locationPrefix}-${genderChar}${seqStr}`;

  const components: CodeComponents = {
    regionPrefix:   mkPrefix(region, 2),
    districtPrefix: mkPrefix(district, 2),
    hospitalPrefix: mkPrefix(hospitalName, 3),
    genderChar,
    sequence:       seq,
  };

  return { code, components };
}

/**
 * Safety check: ensure a generated code is truly unique.
 * Increments sequence until no collision found.
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
}

export function registerPatient(
  patients: Patient[],
  params: RegisterPatientParams
): PatientResult {
  const { region, district, hospital, age, sex, cond, enrol, phone, address } = params;

  // Validation
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

  // Generate code
  const { code: rawCode } = generatePatientCode(patients, region, district, hospital, sex);
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
    hospital:    hospital,
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
  return patients.map((p) =>
    p.id === patientId ? { ...p, status } : p
  );
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
  // HbA1c (DM patients only)
  hba1cValue?:   number;
  hba1cQuarter?: HbA1cQuarter;
  hba1cYear?:    number;
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
    } = params;

    // Build visit record
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
    };

    // Remove existing entry for same month, then add new
    const visits = [
      ...(p.visits ?? []).filter((v) => v.month !== month),
      visit,
    ];

    // Sync medications
    let medications = [...(p.medications ?? [])];
    if (att && meds.length) {
      medications = medications.filter((m) => m.date !== date);
      medications.push({ date, meds });
    }

    // Scheduled next appointment
    let scheduledNext: ScheduledAppointment | undefined = p.scheduledNext;
    if (nextDate) {
      scheduledNext = {
        date:        nextDate,
        note:        nextNote ?? '',
        scheduledOn: date,
        scheduledBy: scheduledBy ?? '',
      };
    }

    // HbA1c entry (DM / DM+HTN only, if value provided)
    let hba1c = [...(p.hba1c ?? [])];
    if (att && hba1cValue && hba1cQuarter && (p.cond === 'DM' || p.cond === 'DM+HTN')) {
      const yr = hba1cYear ?? new Date(date).getFullYear();
      // Replace existing entry for same year+quarter
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

    return { ...p, visits, medications, scheduledNext, hba1c };
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
    const { scheduledNext, ...rest } = p;
    return rest as Patient;
  });
}

/**
 * Bulk-confirm all predicted appointments for active patients
 * that don't yet have a manual schedule.
 */
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
  meds: Medication[]
): Patient[] {
  return patients.map((p) => {
    if (p.id !== patientId) return p;
    const record: MedicationRecord = { date: today(), meds };
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

    // Only allow for DM / DM+HTN patients
    if (p.cond !== 'DM' && p.cond !== 'DM+HTN') return p;

    const fullEntry: HbA1cEntry = {
      ...entry,
      date: entry.date ?? today(),
    };

    // Replace existing entry for same year + quarter
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
        case 'active':    return p.status === 'active';
        case 'ltfu':      return p.status === 'ltfu';
        case 'due':       return isDueFn(p);
        case 'completed': return p.status === 'completed';
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
  return {
    htn:    patients.filter((p) => p.cond === 'HTN').length,
    dm:     patients.filter((p) => p.cond === 'DM').length,
    dmHtn:  patients.filter((p) => p.cond === 'DM+HTN').length,
  };
}

export function countByStatus(patients: Patient[]) {
  return {
    active:    patients.filter((p) => p.status === 'active').length,
    ltfu:      patients.filter((p) => p.status === 'ltfu').length,
    completed: patients.filter((p) => p.status === 'completed').length,
  };
}

export function countBySex(patients: Patient[]) {
  return {
    male:   patients.filter((p) => p.sex === 'M').length,
    female: patients.filter((p) => p.sex === 'F').length,
  };
}

/** Patients enrolled in a given calendar year */
export function enrolledInYear(patients: Patient[], year: number): Patient[] {
  return patients.filter(
    (p) => p.enrol && new Date(p.enrol).getFullYear() === year
  );
}

// ── EXPORT / CSV HELPERS ──────────────────────────────────────

/**
 * Flatten a patient list to CSV-ready rows (de-identified for DHIS2).
 * No patient names, phone numbers, or addresses included.
 */
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
