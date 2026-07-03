import { describe, expect, it } from 'vitest';
import {
  getDirectorySummary,
  getMonthlyVisitRows,
  getProgrammeOverview,
} from './analytics';
import type { ClinicSettings, Patient, Visit } from '../types';

const settings: ClinicSettings = {
  days: [1, 3, 5],
  interval: 30,
  openHour: 8,
  closeHour: 16,
  autoLtfuDays: 21,
};

const mkVisit = (overrides: Partial<Visit>): Visit => ({
  id: 'v1',
  month: 4,
  year: 2026,
  date: '2026-04-15',
  att: true,
  sbp: 130,
  dbp: 80,
  sugar: 8,
  sugarType: 'FBS',
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
  age: 54,
  sex: 'F',
  cond: 'HTN',
  enrol: '2026-01-10',
  status: 'active',
  hospital: 'Facility A',
  region: 'Region A',
  district: 'District A',
  visits: [mkVisit({})],
  medications: [],
  ...overrides,
});

describe('analytics service', () => {
  it('keeps monthly report rows scoped to the selected year', () => {
    const rows = getMonthlyVisitRows([
      mkPatient({
        visits: [
          mkVisit({ id: 'v-2025', date: '2025-04-12', month: 4, year: 2025 }),
          mkVisit({ id: 'v-2026', date: '2026-04-12', month: 4, year: 2026 }),
        ],
      }),
    ], 4, 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0].visit.id).toBe('v-2026');
  });

  it('uses the shared active/due/controlled rules for overview and directory summaries', () => {
    const now = new Date('2026-07-03T00:00:00.000Z');
    const patients = [
      mkPatient({
        id: 1,
        code: 'ACTIVE-CONTROLLED',
        visits: [mkVisit({ date: '2026-06-01', month: 6, year: 2026, sbp: 130, dbp: 80, sugar: 8 })],
      }),
      mkPatient({
        id: 2,
        code: 'ACTIVE-DUE',
        visits: [mkVisit({ date: '2026-05-01', month: 5, year: 2026, sbp: 155, dbp: 98, sugar: 12 })],
      }),
      mkPatient({
        id: 3,
        code: 'LTFU',
        status: 'ltfu',
        visits: [mkVisit({ date: '2026-04-01', month: 4, year: 2026 })],
      }),
    ];

    const overview = getProgrammeOverview(patients, settings, now);
    const summary = getDirectorySummary(patients, settings, 6, 2026, now);

    expect(overview).toMatchObject({
      total: 3,
      active: 2,
      ltfu: 1,
      due: 2,
      controlled: 1,
      ctrlRate: 50,
    });
    expect(summary).toMatchObject({
      patientCount: 3,
      controlled: 1,
      missed: 2,
      ltfu: 1,
    });
  });
});
