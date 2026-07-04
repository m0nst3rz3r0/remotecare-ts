import { create } from 'zustand';
import { getProgrammeOverview } from '../services/analytics';
import { getPatientNextVisitDate, isDue } from '../services/clinical';
import {
  addHbA1cEntry,
  clearScheduledAppointment,
  confirmAllPredicted,
  deleteHbA1cEntry,
  deletePatient,
  deleteVisit,
  filterPatients,
  getVisiblePatients,
  loadPatients,
  recallFromLtfu,
  recordVisit,
  registerPatient,
  savePatients,
  scheduleAppointment,
  setPatientStatus,
  updateMedications,
  type RecordVisitParams,
  type RegisterPatientParams,
} from '../services/patients';
import type {
  ClinicSettings,
  HbA1cQuarter,
  Medication,
  Patient,
  PatientFilter,
  PatientStatus,
  SessionUser,
} from '../types';

interface PatientState {
  patients: Patient[];
  selectedId: number | null;
  filter: PatientFilter;
  searchQuery: string;
  loadFromStorage: () => void;
  registerPatient: (params: RegisterPatientParams) => { success: boolean; error?: string; patient?: Patient };
  recordVisit: (params: RecordVisitParams) => void;
  deleteVisit: (patientId: number, visitId: string) => void;
  deletePatient: (patientId: number) => void;
  setStatus: (patientId: number, status: PatientStatus) => void;
  recallPatient: (patientId: number, settings: ClinicSettings, by?: string) => void;
  updateMedications: (patientId: number, meds: Medication[]) => void;
  addHbA1c: (patientId: number, value: number, quarter: HbA1cQuarter, year: number, recordedBy: string) => void;
  removeHbA1c: (patientId: number, year: number, quarter: HbA1cQuarter) => void;
  scheduleNext: (patientId: number, date: string, note: string, by: string) => void;
  clearSchedule: (patientId: number) => void;
  confirmAllPredicted: (settings: ClinicSettings, by: string) => void;
  runAutoLtfu: (settings: ClinicSettings) => string[];
  selectPatient: (id: number | null) => void;
  setFilter: (filter: PatientFilter) => void;
  setSearch: (query: string) => void;
}

export const usePatientStore = create<PatientState>((set, get) => ({
  patients: [],
  selectedId: null,
  filter: 'all',
  searchQuery: '',

  loadFromStorage: () => {
    set({ patients: loadPatients() });
  },

  registerPatient: (params) => {
    const { patients } = get();
    const result = registerPatient(patients, params);
    if (!result.success) return { success: false, error: result.error };

    persistPatientsState(set, [...patients, result.patient], { selectedId: result.patient.id });
    return { success: true, patient: result.patient };
  },

  recordVisit: (params) => {
    persistPatientsState(set, recordVisit(get().patients, params));
  },

  deleteVisit: (patientId, visitId) => {
    persistPatientsState(set, deleteVisit(get().patients, patientId, visitId));
  },

  deletePatient: (patientId) => {
    persistPatientsState(set, deletePatient(get().patients, patientId), { selectedId: null });
  },

  setStatus: (patientId, status) => {
    persistPatientsState(set, setPatientStatus(get().patients, patientId, status));
  },

  recallPatient: (patientId, settings, by = '') => {
    persistPatientsState(set, recallFromLtfu(get().patients, patientId, settings, by));
  },

  updateMedications: (patientId, meds) => {
    persistPatientsState(set, updateMedications(get().patients, patientId, meds));
  },

  addHbA1c: (patientId, value, quarter, year, recordedBy) => {
    persistPatientsState(
      set,
      addHbA1cEntry(get().patients, patientId, {
        year,
        quarter,
        value,
        recordedBy,
      }),
    );
  },

  removeHbA1c: (patientId, year, quarter) => {
    persistPatientsState(set, deleteHbA1cEntry(get().patients, patientId, year, quarter));
  },

  scheduleNext: (patientId, date, note, by) => {
    persistPatientsState(set, scheduleAppointment(get().patients, patientId, date, note, by));
  },

  clearSchedule: (patientId) => {
    persistPatientsState(set, clearScheduledAppointment(get().patients, patientId));
  },

  confirmAllPredicted: (settings, by) => {
    persistPatientsState(
      set,
      confirmAllPredicted(get().patients, (patient) => getPatientNextVisitDate(patient, settings), by),
    );
  },

  runAutoLtfu: (settings) => {
    const { patients } = get();
    const now = new Date();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);
    const autoLtfuDays = settings.autoLtfuDays ?? 21;
    const marked: string[] = [];

    const updated = patients.map((patient) => {
      if (patient.status !== 'active') return patient;
      const nextVisit = getPatientNextVisitDate(patient, settings);
      nextVisit.setHours(0, 0, 0, 0);

      const daysOverdue = Math.round((todayMidnight.getTime() - nextVisit.getTime()) / 86400000);
      if (daysOverdue < autoLtfuDays) return patient;

      marked.push(patient.code);
      return { ...patient, status: 'ltfu' as PatientStatus };
    });

    if (marked.length > 0) persistPatientsState(set, updated);
    return marked;
  },

  selectPatient: (id) => set({ selectedId: id }),
  setFilter: (filter) => set({ filter }),
  setSearch: (query) => set({ searchQuery: query }),
}));

function persistPatientsState(
  set: (partial: Partial<PatientState>) => void,
  patients: Patient[],
  extra: Partial<PatientState> = {},
) {
  savePatients(patients);
  set({ patients, ...extra });
}

export const selectVisiblePatients = (patients: Patient[], user: SessionUser | null) =>
  getVisiblePatients(patients, user);

export const selectFilteredPatients = (
  patients: Patient[],
  filter: PatientFilter,
  query: string,
) => filterPatients(patients, filter, query, isDue);

export const selectSelectedPatient = (
  patients: Patient[],
  selectedId: number | null,
): Patient | null => (selectedId !== null ? patients.find((patient) => patient.id === selectedId) ?? null : null);

export const selectTopbarCounts = (patients: Patient[]) => {
  const overview = getProgrammeOverview(patients);
  return {
    total: overview.total,
    active: overview.active,
    due: overview.due,
    ltfu: overview.ltfu,
    controlled: overview.controlled,
  };
};
