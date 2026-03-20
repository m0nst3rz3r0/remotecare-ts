// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · src/store/usePatientStore.ts
// Zustand store — patient state, visit recording, HbA1c
// ════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type {
  Patient,
  PatientStatus,
  Medication,
  HbA1cQuarter,
  SessionUser,
  PatientFilter,
} from '../types';
import {
  loadPatients,
  savePatients,
  getVisiblePatients,
  registerPatient,
  recordVisit,
  deleteVisit,
  deletePatient,
  setPatientStatus,
  updateMedications,
  addHbA1cEntry,
  deleteHbA1cEntry,
  scheduleAppointment,
  clearScheduledAppointment,
  confirmAllPredicted,
  filterPatients,
  type RegisterPatientParams,
  type RecordVisitParams,
} from '../services/patients';
import { isDue, getPatientNextVisitDate } from '../services/clinical';
import type { ClinicSettings } from '../types';

// ── STATE SHAPE ───────────────────────────────────────────────

interface PatientState {
  // Raw data
  patients: Patient[];

  // UI state
  selectedId: number | null;
  filter: PatientFilter;
  searchQuery: string;

  // Computed / derived (call selectors below)
  // (not stored — computed on demand)

  // Actions — data
  loadFromStorage: () => void;
  registerPatient: (params: RegisterPatientParams) => { success: boolean; error?: string; patient?: Patient };
  recordVisit: (params: RecordVisitParams) => void;
  deleteVisit: (patientId: number, visitId: string) => void;
  deletePatient: (patientId: number) => void;
  setStatus: (patientId: number, status: PatientStatus) => void;
  updateMedications: (patientId: number, meds: Medication[]) => void;

  // HbA1c
  addHbA1c: (patientId: number, value: number, quarter: HbA1cQuarter, year: number, recordedBy: string) => void;
  removeHbA1c: (patientId: number, year: number, quarter: HbA1cQuarter) => void;

  // Appointments
  scheduleNext: (patientId: number, date: string, note: string, by: string) => void;
  clearSchedule: (patientId: number) => void;
  confirmAllPredicted: (settings: ClinicSettings, by: string) => void;

  // UI actions
  selectPatient: (id: number | null) => void;
  setFilter: (filter: PatientFilter) => void;
  setSearch: (query: string) => void;
}

// ── STORE ─────────────────────────────────────────────────────

export const usePatientStore = create<PatientState>((set, get) => ({
  patients:    [],
  selectedId:  null,
  filter:      'all',
  searchQuery: '',

  loadFromStorage: () => {
    set({ patients: loadPatients() });
  },

  registerPatient: (params) => {
    const { patients } = get();
    const result = registerPatient(patients, params);
    if (!result.success) return { success: false, error: result.error };
    const updated = [...patients, result.patient];
    savePatients(updated);
    set({ patients: updated, selectedId: result.patient.id });
    return { success: true, patient: result.patient };
  },

  recordVisit: (params) => {
    const updated = recordVisit(get().patients, params);
    savePatients(updated);
    set({ patients: updated });
  },

  deleteVisit: (patientId, visitId) => {
    const updated = deleteVisit(get().patients, patientId, visitId);
    savePatients(updated);
    set({ patients: updated });
  },

  deletePatient: (patientId) => {
    const updated = deletePatient(get().patients, patientId);
    savePatients(updated);
    set({ patients: updated, selectedId: null });
  },

  setStatus: (patientId, status) => {
    const updated = setPatientStatus(get().patients, patientId, status);
    savePatients(updated);
    set({ patients: updated });
  },

  updateMedications: (patientId, meds) => {
    const updated = updateMedications(get().patients, patientId, meds);
    savePatients(updated);
    set({ patients: updated });
  },

  addHbA1c: (patientId, value, quarter, year, recordedBy) => {
    const updated = addHbA1cEntry(get().patients, patientId, {
      year, quarter, value, recordedBy,
    });
    savePatients(updated);
    set({ patients: updated });
  },

  removeHbA1c: (patientId, year, quarter) => {
    const updated = deleteHbA1cEntry(get().patients, patientId, year, quarter);
    savePatients(updated);
    set({ patients: updated });
  },

  scheduleNext: (patientId, date, note, by) => {
    const updated = scheduleAppointment(get().patients, patientId, date, note, by);
    savePatients(updated);
    set({ patients: updated });
  },

  clearSchedule: (patientId) => {
    const updated = clearScheduledAppointment(get().patients, patientId);
    savePatients(updated);
    set({ patients: updated });
  },

  confirmAllPredicted: (settings, by) => {
    const updated = confirmAllPredicted(
      get().patients,
      (p) => getPatientNextVisitDate(p, settings),
      by
    );
    savePatients(updated);
    set({ patients: updated });
  },

  selectPatient: (id) => set({ selectedId: id }),
  setFilter:     (filter) => set({ filter }),
  setSearch:     (query) => set({ searchQuery: query }),
}));

// ── SELECTORS ─────────────────────────────────────────────────

/** Patients visible to the current user (admin sees all, doctor sees hospital) */
export const selectVisiblePatients = (
  patients: Patient[],
  user: SessionUser | null
) => getVisiblePatients(patients, user);

/** Filtered + searched patient list for the sidebar */
export const selectFilteredPatients = (
  patients: Patient[],
  filter: PatientFilter,
  query: string
) => filterPatients(patients, filter, query, isDue);

/** Currently selected patient object */
export const selectSelectedPatient = (
  patients: Patient[],
  selectedId: number | null
): Patient | null =>
  selectedId !== null
    ? (patients.find((p) => p.id === selectedId) ?? null)
    : null;

/** Summary counts for topbar */
export const selectTopbarCounts = (patients: Patient[]) => ({
  total:      patients.length,
  active:     patients.filter((p) => p.status === 'active').length,
  due:        patients.filter((p) => isDue(p)).length,
  ltfu:       patients.filter((p) => p.status === 'ltfu').length,
  controlled: patients.filter((p) => {
    const lv = p.visits?.filter((v) => v.att).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    if (!lv) return false;
    const bpOk = !lv.sbp || (lv.sbp < 140 && (lv.dbp ?? 0) < 90);
    const sgOk = !lv.sugar || lv.sugar < 10;
    return bpOk && sgOk;
  }).length,
});
