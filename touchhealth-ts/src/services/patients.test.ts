import { describe, expect, it } from 'vitest';
import {
  countByCondition,
  countByStatus,
  filterPatients,
  isActivePatientStatus,
  isSeenToday,
  normalizeLegacyPatientStatus,
  recordVisit,
} from './patients';
import type { Patient, Visit } from '../types';

const mkPatient = (overrides: Partial<Patient>): Patient => ({
  id: 1,
  code: 'PT-001',
  age: 50,
  sex: 'F',
  cond: 'HTN',
  enrol: '2026-01-01',
  status: 'active',
  hospital: 'Facility A',
  region: 'Region A',
  district: 'District A',
  visits: [],
  medications: [],
  ...overrides,
});

const mkVisit = (overrides: Partial<Visit>): Visit => ({
  id: 'v1',
  month: 6,
  year: 2026,
  date: new Date().toISOString().split('T')[0],
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

describe('patient status semantics', () => {
  it('treats only active as enrolled in routine follow-up', () => {
    expect(isActivePatientStatus('active')).toBe(true);
    expect(isActivePatientStatus('completed')).toBe(false);
    expect(isActivePatientStatus('ltfu')).toBe(false);
  });

  it('maps legacy completed programme status back to active', () => {
    expect(normalizeLegacyPatientStatus('completed')).toBe('active');
    expect(normalizeLegacyPatientStatus('ltfu')).toBe('ltfu');
  });

  it('uses the same active definition in status counts and filters', () => {
    const patients = [
      mkPatient({ id: 1, status: 'active' }),
      mkPatient({ id: 2, status: 'completed' }),
      mkPatient({ id: 3, status: 'ltfu' }),
    ];
    const counts = countByStatus(patients);
    const filtered = filterPatients(patients, 'active', '', () => false);

    expect(counts.active).toBe(1);
    expect(filtered.map((p) => p.id)).toEqual([1]);
  });

  it('treats the completed filter as seen today, not programme status', () => {
    const today = new Date().toISOString().split('T')[0];
    const patients = [
      mkPatient({
        id: 1,
        visits: [mkVisit({ date: today })],
      }),
      mkPatient({ id: 2, status: 'completed' }),
    ];
    const filtered = filterPatients(patients, 'completed', '', () => false);

    expect(isSeenToday(patients[0])).toBe(true);
    expect(filtered.map((p) => p.id)).toEqual([1]);
  });

  it('reactivates a patient when an attended visit is recorded', () => {
    const patients = [mkPatient({ id: 10, status: 'ltfu' })];
    const updated = recordVisit(patients, {
      patientId: 10,
      month: 6,
      date: '2026-06-01',
      attended: true,
      meds: [],
    });

    expect(updated[0].status).toBe('active');
  });

  it('counts inferred DM+HTN patients even when the stored condition is incomplete', () => {
    const counts = countByCondition([
      mkPatient({
        id: 30,
        cond: 'HTN',
        visits: [mkVisit({
          sugar: 12,
          sugarType: 'RBS',
          meds: [{ name: 'Losartan 50mg' }, { name: 'Metformin 500mg' }] as any,
        })],
      }),
    ]);

    expect(counts).toEqual({
      htn: 0,
      dm: 0,
      dmHtn: 1,
    });
  });
});
