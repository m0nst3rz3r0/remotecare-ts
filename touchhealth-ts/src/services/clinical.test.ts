import { describe, expect, it } from 'vitest';
import {
  getAdherenceMonthState,
  getMonthlyAttendanceRate,
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
});
