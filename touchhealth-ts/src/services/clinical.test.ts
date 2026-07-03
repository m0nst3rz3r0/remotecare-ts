import { describe, expect, it } from 'vitest';
import {
  getAdherenceMonthState,
  getMonthlyAttendanceRate,
  getMonthlyStats,
} from './clinical';
import type { Patient, Visit } from '../types';

const mkVisit = (overrides: Partial<Visit>): Visit => ({
  id: 'v1',
  month: 4,
  year: 2026,
  date: '2026-04-27',
  att: true,
  sbp: null,
  dbp: null,
  sugar: null,
  sugarType: '',
  weight: null,
  height: null,
  bmi: null,
  notes: '',
  meds: [],
  ...overrides,
});

const mkPatient = (overrides: Partial<Patient>): Patient => ({
  id: 1,
  code: 'PT-001',
  age: 50,
  sex: 'F',
  cond: 'HTN',
  enrol: '2026-04-27',
  status: 'ltfu',
  hospital: 'Facility A',
  region: 'Region A',
  district: 'District A',
  visits: [mkVisit({})],
  medications: [],
  ...overrides,
});

describe('programme attendance metrics', () => {
  it('counts missed follow-up months against attendance rate', () => {
    const patients = [mkPatient({ status: 'ltfu' })];
    expect(getMonthlyAttendanceRate(patients, 4, 2026)).toBe(100);
    expect(getMonthlyAttendanceRate(patients, 5, 2026)).toBe(0);
  });

  it('marks months after last attended visit as missed on the grid', () => {
    const patient = mkPatient({ status: 'ltfu' });
    expect(getAdherenceMonthState(patient, 4, 2026)).toBe('attended');
    expect(getAdherenceMonthState(patient, 5, 2026)).toBe('missed');
  });

  it('does not project attendance into future months', () => {
    const patients = [mkPatient({ status: 'ltfu' })];
    const now = new Date(2026, 5, 19);
    expect(getMonthlyAttendanceRate(patients, 5, 2026, now)).toBe(0);
    expect(getMonthlyAttendanceRate(patients, 7, 2026, now)).toBeNull();
  });

  it('keeps monthly stats scoped to the selected year', () => {
    const patients = [
      mkPatient({
        visits: [
          mkVisit({ id: 'v-2025', date: '2025-04-12', month: 4, year: 2025, sbp: 150, dbp: 95 }),
          mkVisit({ id: 'v-2026', date: '2026-04-12', month: 4, year: 2026, sbp: 130, dbp: 80 }),
        ],
      }),
    ];

    const stats2025 = getMonthlyStats(patients, 4, 2025, new Date(2026, 5, 19));
    const stats2026 = getMonthlyStats(patients, 4, 2026, new Date(2026, 5, 19));

    expect(stats2025.bpControlRate).toBe(0);
    expect(stats2026.bpControlRate).toBe(100);
  });
});
