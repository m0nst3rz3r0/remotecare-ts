// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · src/store/useUIStore.ts
// Zustand store — navigation, modal state, clinic settings
// ════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { PageId, ClinicSettings, ClinicDayIndex } from '../types';

// ── CLINIC SETTINGS STORAGE ───────────────────────────────────

const CLINIC_KEY = 'th_clinic';

const CLINIC_DEFAULTS: ClinicSettings = {
  days: [1, 3, 5], interval: 30,
  openHour: 8, closeHour: 17, autoLtfuDays: 21,
};

function loadClinicSettings(): ClinicSettings {
  try {
    const raw = localStorage.getItem(CLINIC_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<ClinicSettings>) : {};
    return { ...CLINIC_DEFAULTS, ...saved };
  } catch {
    return { ...CLINIC_DEFAULTS };
  }
}

function saveClinicSettings(settings: ClinicSettings): void {
  localStorage.setItem(CLINIC_KEY, JSON.stringify(settings));
}

// ── STATE SHAPE ───────────────────────────────────────────────

interface UIState {
  // Navigation
  activePage: PageId;

  // Modals
  visitModalOpen:    boolean;
  visitModalPatientId: number | null;
  medModalOpen:      boolean;
  medModalPatientId: number | null;
  stockoutModalOpen: boolean;

  // Clinic settings
  clinicSettings: ClinicSettings;

  // Actions — navigation
  navigateTo: (page: PageId) => void;

  // Actions — modals
  openVisitModal:    (patientId: number) => void;
  closeVisitModal:   () => void;
  openMedModal:      (patientId: number) => void;
  closeMedModal:     () => void;
  openStockoutModal: () => void;
  closeStockoutModal:() => void;

  // Actions — clinic settings
  toggleClinicDay:      (day: ClinicDayIndex) => void;
  setClinicInterval:    (days: number) => void;
  updateClinicHours:    (openHour: number, closeHour: number) => void;
  updateAutoLtfuDays:   (days: number) => void;
}

// ── STORE ─────────────────────────────────────────────────────

export const useUIStore = create<UIState>((set, get) => ({
  activePage:            'patients',
  visitModalOpen:        false,
  visitModalPatientId:   null,
  medModalOpen:          false,
  medModalPatientId:     null,
  stockoutModalOpen:     false,
  clinicSettings:        loadClinicSettings(),

  navigateTo: (page) => set({ activePage: page }),

  openVisitModal: (patientId) =>
    set({ visitModalOpen: true, visitModalPatientId: patientId }),

  closeVisitModal: () =>
    set({ visitModalOpen: false, visitModalPatientId: null }),

  openMedModal: (patientId) =>
    set({ medModalOpen: true, medModalPatientId: patientId }),

  closeMedModal: () =>
    set({ medModalOpen: false, medModalPatientId: null }),

  openStockoutModal:  () => set({ stockoutModalOpen: true }),
  closeStockoutModal: () => set({ stockoutModalOpen: false }),

  toggleClinicDay: (day) => {
    const { clinicSettings } = get();
    const days = clinicSettings.days.includes(day)
      ? clinicSettings.days.filter((d) => d !== day)
      : ([...clinicSettings.days, day].sort((a, b) => a - b) as ClinicDayIndex[]);
    const updated = { ...clinicSettings, days };
    saveClinicSettings(updated);
    set({ clinicSettings: updated });
  },

  setClinicInterval: (interval) => {
    const { clinicSettings } = get();
    const updated = { ...clinicSettings, interval };
    saveClinicSettings(updated);
    set({ clinicSettings: updated });
  },

  updateClinicHours: (openHour, closeHour) => {
    const { clinicSettings } = get();
    const updated = { ...clinicSettings, openHour, closeHour };
    saveClinicSettings(updated);
    set({ clinicSettings: updated });
  },

  updateAutoLtfuDays: (days) => {
    const { clinicSettings } = get();
    const updated = { ...clinicSettings, autoLtfuDays: days };
    saveClinicSettings(updated);
    set({ clinicSettings: updated });
  },
}));
