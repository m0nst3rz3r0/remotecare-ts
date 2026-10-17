import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { loadPatients, savePatients, syncPatientsWithCloud } from './storage';
import { registerPatient, recordVisit } from './patients';

const mocks = vi.hoisted(() => ({ online: vi.fn(), from: vi.fn() }));
vi.mock('./supabase', () => ({ requireOnlineSession: mocks.online, supabase: { from: mocks.from } }));

const cloud = new Map<string, Map<string, Record<string, unknown>>>();
let duringPull: (() => void) | undefined;
let failVisits = false;
function deviceStorage() {
  const values = new Map<string, string>([['th_session', JSON.stringify({ role: 'doctor', sessionHospital: 'Clinic', sessionRegion: 'Kagera', sessionDistrict: 'Bukoba' })]]);
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}
beforeEach(() => {
  cloud.clear(); duringPull = undefined; failVisits = false;
  vi.stubGlobal('localStorage', deviceStorage());
  mocks.online.mockReset().mockResolvedValue(undefined);
  mocks.from.mockReset().mockImplementation((name: string) => {
    if (!cloud.has(name)) cloud.set(name, new Map());
    const table = cloud.get(name)!;
    return {
      upsert: async (payload: Record<string, unknown> | Array<Record<string, unknown>>) => {
        if (name === 'visits' && failVisits) return { error: { message: 'Push interrupted' } };
        for (const row of Array.isArray(payload) ? payload : [payload]) table.set(String(row.id ?? row.visit_id + ':' + row.name), { ...row });
        return { error: null };
      },
      select: async () => {
        if (name === 'patients') duringPull?.();
        return { data: [...table.values()], error: null };
      },
    };
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

function register(letter: string) {
  const result = registerPatient([], { region: 'Kagera', district: 'Bukoba', hospital: 'Clinic', sex: 'F', age: 45, cond: 'HTN', enrol: '2026-07-01', devicePrefix: letter, currentUser: null });
  if (!result.success) throw new Error(result.error);
  savePatients(recordVisit([result.patient], { patientId: result.patient.id, month: 7, date: '2026-07-01', attended: true, meds: [] }));
}

describe('manual synchronization of offline devices', () => {
  it('merges independent A and B registrations and visits after manual sync', async () => {
    const deviceA = deviceStorage(), deviceB = deviceStorage();
    vi.stubGlobal('localStorage', deviceA); register('A');
    vi.stubGlobal('localStorage', deviceB); register('B');
    expect(cloud.size).toBe(0); // Local work alone never starts a sync.
    vi.stubGlobal('localStorage', deviceA); expect((await syncPatientsWithCloud()).success).toBe(true);
    vi.stubGlobal('localStorage', deviceB); expect((await syncPatientsWithCloud()).success).toBe(true);
    expect(loadPatients()).toHaveLength(2);
    vi.stubGlobal('localStorage', deviceA); expect((await syncPatientsWithCloud()).success).toBe(true);
    expect(loadPatients()).toHaveLength(2);
    expect(loadPatients().every((p) => p.visits.length === 1)).toBe(true);
  });
  it('preserves unsynced local work when cloud access expires or a push fails', async () => {
    register('A'); const before = JSON.stringify(loadPatients());
    mocks.online.mockRejectedValue(new Error('Sign in online'));
    expect((await syncPatientsWithCloud()).success).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled(); expect(JSON.stringify(loadPatients())).toBe(before);
    mocks.online.mockResolvedValue(undefined); failVisits = true;
    expect((await syncPatientsWithCloud()).success).toBe(false);
    expect(JSON.stringify(loadPatients())).toBe(before);
  });
  it('preserves edits made while network requests are in flight', async () => {
    register('A');
    duringPull = () => { savePatients(loadPatients().map((p) => ({ ...p, address: 'Edited while syncing' }))); };
    expect((await syncPatientsWithCloud()).success).toBe(true);
    expect(loadPatients()[0].address).toBe('Edited while syncing');
  });

  it('keeps other facilities local records without pushing them under this account', async () => {
    register('A');
    const original = loadPatients()[0];
    savePatients([original, { ...original, id: original.id + 1, code: 'OTHER-B-F0001', hospital: 'Other', region: 'Other' }]);
    expect((await syncPatientsWithCloud()).success).toBe(true);
    expect(cloud.get('patients')?.size).toBe(1);
    expect(loadPatients()).toHaveLength(2);
  });
});
