import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { sendSMS, sendSMSBatch, refreshSMSStatus } from './sms';
import { loadSMSConfig, loadSMSLog } from './storage';
import type { Patient, ClinicSettings } from '../types';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), requireOnline: vi.fn() }));
vi.mock('./supabase', () => ({ requireOnlineSession: mocks.requireOnline, supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('./deviceManager', () => ({ getDeviceHardwareId: () => 'device-a' }));

const patient: Patient = { id: 1, code: 'KG-BK-CL-A-M0001', hospital: 'Clinic', region: 'Kagera', district: 'Bukoba', phone: '0744123456', status: 'active', sex: 'M', age: 50, cond: 'HTN', enrol: '2026-07-01', visits: [], medications: [] };
const clinic: ClinicSettings = { days: [1,3,5], interval: 30, openHour: 7, closeHour: 18, autoLtfuDays: 21 };
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.clearAllMocks(); mocks.requireOnline.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('manual SMS submissions', () => {
  it('submits patient identity rather than browser phone or provider credentials', async () => {
    mocks.invoke.mockResolvedValue({ data: { entry: { status: 'queued', messageId: '8' } }, error: null });
    const result = await sendSMS(patient, 'en', loadSMSConfig(), clinic);
    expect(result.status).toBe('queued');
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.patientId).toBe(1); expect(body.phone).toBeUndefined(); expect(body.apiKey).toBeUndefined();
    expect(body.message).toContain('Clinic');
    expect(loadSMSLog()[0].phone).not.toBe(patient.phone);
  });

  it('reuses the same request ID after an interrupted response and never retries automatically', async () => {
    mocks.invoke.mockRejectedValue(new Error('network'));
    const first = await sendSMS(patient, 'sw', loadSMSConfig(), clinic);
    expect(first.status).toBe('unknown'); expect(mocks.invoke).toHaveBeenCalledTimes(1);
    const second = await sendSMS(patient, 'sw', loadSMSConfig(), clinic);
    expect(second.id).toBe(first.id); expect(loadSMSLog()).toHaveLength(1);
  });

  it('keeps queued messages separate from sent totals and skips recent requests', async () => {
    mocks.invoke.mockResolvedValue({ data: { entry: { status: 'queued', messageId: '8' } } });
    expect(await sendSMSBatch([{ patient, reason: 'reminder' }], 'en', loadSMSConfig(), clinic)).toMatchObject({ queued: 1, sent: 0, failed: 0 });
    expect(await sendSMSBatch([{ patient, reason: 'reminder' }], 'en', loadSMSConfig(), clinic)).toMatchObject({ skipped: 1 });
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it('blocks disconnected sending before creating any request', async () => {
    mocks.requireOnline.mockRejectedValue(new Error('Sign in online'));
    await expect(sendSMS(patient, 'en', loadSMSConfig(), clinic)).rejects.toThrow('Sign in online');
    expect(mocks.invoke).not.toHaveBeenCalled(); expect(loadSMSLog()).toHaveLength(0);
  });

  it('scrubs legacy plaintext logs and updates delivery without submitting another message', async () => {
    localStorage.setItem('th_sms_log', JSON.stringify([{ id: 'request-1', phone: '0744123456', status: 'queued', ptId: 1 }]));
    expect(loadSMSLog()[0].phone).toContain('*');
    expect(localStorage.getItem('th_sms_log')).not.toContain('0744123456');
    mocks.invoke.mockResolvedValue({ data: { entry: { id: 'request-1', phone: '********456', status: 'delivered', ptId: 1 } } });
    expect((await refreshSMSStatus('request-1')).status).toBe('delivered');
    expect(mocks.invoke).toHaveBeenCalledWith('sms-status', { body: { requestId: 'request-1' } });
    expect(loadSMSLog()).toHaveLength(1);
  });
});
