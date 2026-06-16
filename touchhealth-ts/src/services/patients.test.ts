import { describe, expect, it } from 'vitest';
import { countByStatus, filterPatients, isActivePatientStatus, recordVisit } from './patients';
import type { Patient } from '../types';

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

describe('patient status semantics', () => {
  it('treats active and completed as active-programme statuses', () => {
    expect(isActivePatientStatus('active')).toBe(true);
    expect(isActivePatientStatus('completed')).toBe(true);
    expect(isActivePatientStatus('ltfu')).toBe(false);
  });

  it('uses the same active definition in status counts and filters', () => {
    const patients = [
      mkPatient({ id: 1, status: 'active' }),
      mkPatient({ id: 2, status: 'completed' }),
      mkPatient({ id: 3, status: 'ltfu' }),
    ];
    const counts = countByStatus(patients);
    const filtered = filterPatients(patients, 'active', '', () => false);

    expect(counts.active).toBe(2);
    expect(filtered.map((p) => p.id)).toEqual([1, 2]);
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
});
