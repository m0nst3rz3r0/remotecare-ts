import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { loadPatients, savePatients, syncPatientsWithCloud } from './storage';
import { resolveNutritionConflict } from './nutritionSync';
import { registerPatient, recordVisit } from './patients';

const mocks = vi.hoisted(() => ({ online: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock('./supabase', () => ({ requireOnlineSession: mocks.online, supabase: { from: mocks.from, rpc: mocks.rpc } }));

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
  mocks.rpc.mockReset().mockImplementation(async (_name: string, args: { patient_key: string; expected_revision: number; profile: unknown; plans: Record<string,unknown> }) => {
    const patient = cloud.get('patients')!.get(args.patient_key)!;
    const visits = cloud.get('visits')!;
    const plans = Object.fromEntries([...visits.values()].filter(v => String(v.patient_id) === args.patient_key && v.meal_plan).map(v => [String(v.id),v.meal_plan]));
    const revision = Number(patient.nutrition_revision ?? 0);
    if (revision !== args.expected_revision) return { data:{applied:false,revision,profile:patient.nutrition_profile,plans},error:null };
    patient.nutrition_revision=revision+1;patient.nutrition_profile=args.profile;
    for(const [id,plan] of Object.entries(args.plans))visits.get(id)!.meal_plan=plan;
    return {data:{applied:true,revision:revision+1,profile:args.profile,plans:args.plans},error:null};
  });
  mocks.from.mockReset().mockImplementation((name: string) => {
    if (!cloud.has(name)) cloud.set(name, new Map());
    const table = cloud.get(name)!;
    return {
      upsert: async (payload: Record<string, unknown> | Array<Record<string, unknown>>) => {
        if (name === 'visits' && failVisits) return { error: { message: 'Push interrupted' } };
        for (const row of Array.isArray(payload) ? payload : [payload]) table.set(String(row.id ?? row.visit_id + ':' + row.name), { ...table.get(String(row.id ?? row.visit_id + ':' + row.name)), ...row });
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

describe('nutrition drafts on two offline devices',()=>{
  it('manually transfers assessments, reports conflicts and preserves the chosen draft',async()=>{
    const a=deviceStorage(),b=deviceStorage();vi.stubGlobal('localStorage',a);register('A');
    let patient=loadPatients()[0];
    savePatients([{...patient,nutritionProfile:{bodyGoal:'maintain'},nutritionSync:{revision:0,dirty:true}}]);
    expect((await syncPatientsWithCloud()).success).toBe(true);
    vi.stubGlobal('localStorage',b);expect((await syncPatientsWithCloud()).success).toBe(true);
    expect(loadPatients()[0].nutritionProfile?.bodyGoal).toBe('maintain');
    vi.stubGlobal('localStorage',a);patient=loadPatients()[0];savePatients([{...patient,nutritionProfile:{bodyGoal:'lose_weight'},nutritionSync:{revision:1,dirty:true}}]);
    expect((await syncPatientsWithCloud()).success).toBe(true);
    vi.stubGlobal('localStorage',b);patient=loadPatients()[0];savePatients([{...patient,nutritionProfile:{bodyGoal:'gain_muscle'},nutritionSync:{revision:1,dirty:true}}]);
    const result=await syncPatientsWithCloud();expect(result.success).toBe(false);expect(result.error).toMatch(/conflict/i);
    expect(loadPatients()[0].nutritionProfile?.bodyGoal).toBe('gain_muscle');expect(loadPatients()[0].nutritionSync?.conflict?.revision).toBe(2);
    savePatients([resolveNutritionConflict(loadPatients()[0],'local')]);expect((await syncPatientsWithCloud()).success).toBe(true);
    expect(loadPatients()[0].nutritionSync).toMatchObject({revision:3,dirty:false});
    vi.stubGlobal('localStorage',a);expect((await syncPatientsWithCloud()).success).toBe(true);expect(loadPatients()[0].nutritionProfile?.bodyGoal).toBe('gain_muscle');
  });
  it('keeps nutrition drafts after RPC rejection and never syncs merely on reconnect',async()=>{
    register('A');const patient=loadPatients()[0];savePatients([{...patient,nutritionProfile:{bodyGoal:'maintain'},nutritionSync:{revision:0,dirty:true}}]);
    expect(mocks.rpc).not.toHaveBeenCalled();const before=JSON.stringify(loadPatients());
    mocks.rpc.mockResolvedValue({error:{message:'Connection lost'},data:null});expect((await syncPatientsWithCloud()).success).toBe(false);
    expect(JSON.stringify(loadPatients())).toBe(before);
  });
});
