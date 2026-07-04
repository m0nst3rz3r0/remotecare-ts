import { describe, expect, it } from 'vitest';
import { buildSMSMessage, buildSMSPreview, filterPatientsForSmsTab, getBulkSendCandidates, getPatientSMSReason, resolvePatientSMSReason } from './sms';
import type { ClinicSettings, Patient, SMSConfig, Visit } from '../types';

const clinicCfg: ClinicSettings = {
  days: [1, 3, 5],
  interval: 30,
  openHour: 7,
  closeHour: 18,
  autoLtfuDays: 21,
};

const smsCfg: SMSConfig = {
  provider: 'at',
  senderId: 'RemoteCare',
  template: 'Dear {name}, your appointment at {hospital} is on {date}.',
  templateSw: 'Habari {name}, miadi yako {hospital} ni tarehe {date}.',
  templateMissed: 'Dear {name}, you missed clinic at {hospital}. Please come back.',
  templateMissedSw: 'Habari {name}, ulikosa kliniki {hospital}. Tafadhali rudi.',
  templateLtfu: 'Dear {name}, we have missed you at {hospital}.',
  templateLtfuSw: 'Habari {name}, tumekukosa katika {hospital}.',
  templateWelcome: 'Welcome {name}, your first clinic at {hospital} is on {date}.',
  templateWelcomeSw: 'Karibu {name}, kliniki yako ya kwanza {hospital} ni tarehe {date}.',
};

const mkVisit = (overrides: Partial<Visit>): Visit => ({
  id: 'v1',
  month: 7,
  year: 2026,
  date: '2026-07-01',
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
  enrol: '2026-07-01',
  status: 'active',
  phone: '255700000000',
  hospital: 'Facility A',
  region: 'Region A',
  district: 'District A',
  visits: [],
  medications: [],
  ...overrides,
});

describe('sms logic', () => {
  it('uses welcome for first upcoming appointment instead of generic reminder', () => {
    const patient = mkPatient({
      scheduledNext: {
        date: '2026-07-05',
        note: 'Initial booking',
        scheduledOn: '2026-07-01',
        scheduledBy: 'Admin',
      },
    });

    expect(getPatientSMSReason(patient, clinicCfg, 7)).toBe('welcome');
  });

  it('uses missed appointment for overdue active patients based on scheduled date', () => {
    const patient = mkPatient({
      scheduledNext: {
        date: '2026-06-01',
        note: 'Follow-up',
        scheduledOn: '2026-05-01',
        scheduledBy: 'Admin',
      },
    });

    expect(getPatientSMSReason(patient, clinicCfg, 7)).toBe('missed_appointment');
    expect(filterPatientsForSmsTab([patient], 'overdue', clinicCfg)).toEqual([patient]);
  });

  it('keeps ltfu patients on the ltfu workflow', () => {
    const patient = mkPatient({
      status: 'ltfu',
      visits: [mkVisit({ date: '2026-05-01', month: 5 })],
    });

    expect(getPatientSMSReason(patient, clinicCfg, 7)).toBe('ltfu_warning');
  });

  it('builds swahili message with the matching template', () => {
    const patient = mkPatient({});
    const message = buildSMSMessage(
      patient,
      smsCfg,
      'sw',
      new Date('2026-07-05T00:00:00Z'),
      'missed_appointment',
    );

    expect(message).toContain('ulikosa kliniki');
    expect(message).toContain('Facility A');
  });

  it('builds a preview using an override reason', () => {
    const patient = mkPatient({});
    const preview = buildSMSPreview(patient, smsCfg, clinicCfg, 'en', 'ltfu_warning');

    expect(preview?.reason).toBe('ltfu_warning');
    expect(preview?.message).toContain('we have missed you');
    expect(preview?.hasPhone).toBe(true);
  });

  it('resolves override reason before automatic classification', () => {
    const patient = mkPatient({
      scheduledNext: {
        date: '2026-06-01',
        note: 'Follow-up',
        scheduledOn: '2026-05-01',
        scheduledBy: 'Admin',
      },
    });

    expect(resolvePatientSMSReason(patient, clinicCfg, 'reminder')).toBe('reminder');
  });

  it('builds bulk send candidates from shared rules', () => {
    const due = mkPatient({
      id: 1,
      scheduledNext: {
        date: '2026-06-01',
        note: 'Follow-up',
        scheduledOn: '2026-05-01',
        scheduledBy: 'Admin',
      },
    });
    const noPhone = mkPatient({ id: 2, phone: undefined });

    const candidates = getBulkSendCandidates([due, noPhone], clinicCfg);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.patient.id).toBe(1);
    expect(candidates[0]?.reason).toBe('missed_appointment');
  });
});
