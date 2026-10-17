import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const doctorId = '00000000-0000-4000-8000-000000000001';
const adminId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const authId = '00000000-0000-4000-8000-000000000010';
let db: PGlite;
async function identify(appId: string | null, metadata: Record<string, unknown> = {}) {
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: authId, role: 'authenticated', app_metadata: appId ? { app_user_id: appId } : {}, user_metadata: metadata })]);
  await db.exec('set role authenticated');
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
    grant usage on schema public, auth to anon, authenticated, service_role;`);
  for (const name of ['001_schema_baseline','002_rls_policies','003_soft_delete_sync','004_auth_and_devices','005_sms_ledger','006_nutrition_sync']) {
    await db.exec(readFileSync(new URL('../../../supabase/migrations/' + name + '.sql', import.meta.url), 'utf8'));
  }
  await db.exec(`grant all on all tables in schema public to service_role;
    insert into public.users(id,username,password,role,display_name,hospital,region,district) values
      ('${doctorId}','doctor','hash','doctor','Doctor','Clinic','Kagera','Bukoba'),
      ('${adminId}','admin','hash','admin','Admin','Clinic','Kagera','Bukoba'),
      ('${otherId}','other','hash','doctor','Other','Other Clinic','Other','Other');
    insert into hospitals(name,region,district) values ('Clinic','Kagera','Bukoba'),('Other Clinic','Other','Other');
    insert into patients(id,code,hospital,region,district) values (1,'KG-BK-CL-A-M0001','Clinic','Kagera','Bukoba'),(2,'OTHER','Other Clinic','Other','Other');`);
}, 60_000);
beforeEach(async () => { await db.exec('begin'); });
afterEach(async () => { await db.exec('rollback; reset role'); });
afterAll(async () => { await db?.close(); });

describe('database authorization and device provisioning', () => {
  it('supports legacy text patient IDs through sync, soft delete, and SMS setup', async () => {
    const legacy = new PGlite({ extensions: { pgcrypto } });
    try {
      await legacy.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth;
        create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
        create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
        create function auth.role() returns text language sql stable as $$ select 'anon' $$;`);
      for (const name of ['001_schema_baseline','002_rls_policies','003_soft_delete_sync','004_auth_and_devices','005_sms_ledger','006_nutrition_sync']) {
        let sql = readFileSync(new URL('../../../supabase/migrations/' + name + '.sql', import.meta.url), 'utf8');
        if (name === '001_schema_baseline') sql = sql.replace(/id\s+bigint\s+primary key/, 'id text primary key')
          .replace(/patient_id\s+bigint\s+not null/, 'patient_id text not null');
        await legacy.exec(sql);
      }
      await legacy.exec(`insert into patients(id,code,hospital,region,district) values ('123','LEGACY-A-M0001','Clinic','Kagera','Bukoba');
        insert into users(id,username,password,role,display_name) values ('${doctorId}','doctor','hash','doctor','Doctor');
        insert into device_registry(id,facility_id,prefix) values ('legacy-device','kagera_bukoba_clinic','A');`);
      await legacy.query('select sync_patients()');
      const payload = { id: '30000000-0000-4000-8000-000000000001', patient_id: 123, patient_code: 'LEGACY-A-M0001', region: 'Kagera', district: 'Bukoba', hospital: 'Clinic', actor_id: doctorId, actor_name: 'Doctor', device_id: 'legacy-device', device_letter: 'A', phone_masked: '********456', message: 'Clinic: reminder', reason: 'reminder', lang: 'en' };
      const reserved = await legacy.query<{ result: { kind: string; entry: { patient_id: string } } }>('select reserve_sms($1::jsonb) as result', [JSON.stringify(payload)]);
      expect(reserved.rows[0].result.kind).toBe('reserved');
      expect(reserved.rows[0].result.entry.patient_id).toBe('123');
      await legacy.query('select soft_delete_patient(123::bigint)');
      const patient = (await legacy.query<{ id: string; deleted_at: unknown }>('select id,deleted_at from patients')).rows[0];
      expect(patient.id).toBe('123'); expect(patient.deleted_at).not.toBeNull();
    } finally { await legacy.close(); }
  }, 30_000);

  it('upgrades missing legacy sync columns without deleting records and can rerun', async () => {
    const before = (await db.query('select id,code from patients order by id')).rows;
    await db.exec(`
      alter table patients drop column deleted_at cascade, drop column created_at cascade, drop column updated_at cascade;
      alter table users drop column deleted_at cascade, drop column created_at cascade, drop column updated_at cascade;
      alter table visits drop column created_at cascade, drop column updated_at cascade;
    `);
    const baseline = readFileSync(new URL('../../../supabase/migrations/001_schema_baseline.sql', import.meta.url), 'utf8');
    await db.exec(baseline);
    await db.exec(baseline);
    expect((await db.query('select id,code from patients order by id')).rows).toEqual(before);
    expect((await db.query('select deleted_at,created_at,updated_at from patients')).rows).toHaveLength(2);
    await db.query('select deleted_at,created_at,updated_at from users');
    await db.query('select created_at,updated_at from visits');
  });

  it('does not trust editable metadata or expose sync data to anonymous callers', async () => {
    await identify(null, { role: 'admin', region: 'Kagera', is_super_admin: true });
    expect((await db.query('select * from patients')).rows).toHaveLength(0);
    expect((await db.query<{ result: { patients: unknown } }>('select sync_patients() as result')).rows[0].result.patients).toBeNull();
    await db.exec('reset role; set role anon');
    await expect(db.query('select sync_patients()')).rejects.toThrow(/permission denied/);
  });

  it('maps self access to the app user and restricts cross-facility reads/deletes', async () => {
    await identify(doctorId);
    expect((await db.query('select id from users')).rows).toEqual([{ id: doctorId }]);
    expect((await db.query('select id from patients')).rows).toEqual([{ id: 1 }]);
    await db.query('select soft_delete_patient(2)');
    await db.exec('reset role');
    expect((await db.query<{ deleted_at: unknown }>('select deleted_at from patients where id=2')).rows[0].deleted_at).toBeNull();
  });

  it('prevents admins from promoting doctors or moving them outside their region', async () => {
    await identify(adminId);
    await expect(db.query("update users set role='admin' where id=$1", [doctorId])).rejects.toThrow(/row-level security/);
  });

  it('rejects admin writes outside the assigned region', async () => {
    await identify(adminId);
    await expect(db.query("update users set region='Other' where id=$1", [doctorId])).rejects.toThrow(/row-level security/);
  });

  it('does not expose server password hashes to directory readers', async () => {
    await identify(doctorId);
    await expect(db.query('select password from users')).rejects.toThrow(/permission denied/);
  });

  it('allocates A and B for a shared account and preserves letters on reconnect', async () => {
    await identify(doctorId);
    const provision = (id: string, letter: string | null = null) => db.query<{ letter: string }>("select provision_device($1,'Kagera','Bukoba','Clinic','{}',$2) as letter", [id, letter]);
    expect((await provision('device-a')).rows[0].letter).toBe('A');
    expect((await provision('device-b')).rows[0].letter).toBe('B');
    expect((await provision('device-a', 'A')).rows[0].letter).toBe('A');
    await expect(provision('device-c', 'A')).rejects.toThrow(/unique/);
  });
});

describe('SMS transactional reservation', () => {
  const payload = (id: string, override = false) => ({ id, patient_id: 1, patient_code: 'KG-BK-CL-A-M0001', region: 'Kagera', district: 'Bukoba', hospital: 'Clinic', actor_id: doctorId, actor_name: 'Doctor', device_id: 'device-a', device_letter: 'A', phone_masked: '*********456', message: 'Clinic: reminder', reason: 'reminder', lang: 'en', resend_override: override });
  const idA = '10000000-0000-4000-8000-000000000001';
  const idB = '10000000-0000-4000-8000-000000000002';
  async function reserve(id: string, override = false) {
    return (await db.query<{ result: { kind: string; entry: { id: string } } }>('select reserve_sms($1::jsonb) as result', [JSON.stringify(payload(id, override))])).rows[0].result;
  }
  beforeEach(async () => {
    await identify(doctorId);
    await db.query("select provision_device('device-a','Kagera','Bukoba','Clinic')");
    await db.exec('reset role; set role service_role');
  });

  it('reserves once, returns the existing request on repetition, and blocks another device request', async () => {
    expect((await reserve(idA)).kind).toBe('reserved');
    expect((await reserve(idA)).kind).toBe('existing');
    expect((await reserve(idB)).kind).toBe('duplicate');
    expect((await reserve(idB, true)).kind).toBe('duplicate'); // uncertain cannot be overridden
    expect((await db.query('select * from sms_requests')).rows).toHaveLength(1);
  });

  it('requires an explicit override for a confirmed recent send', async () => {
    await reserve(idA);
    await db.exec("update sms_requests set status='sent',created_at=now()-interval '2 seconds'");
    expect((await reserve(idB)).kind).toBe('duplicate');
    expect((await reserve(idB, true)).kind).toBe('reserved');
  });

  it('serializes simultaneous reservation requests for the same patient', async () => {
    const results = await Promise.all([reserve(idA), reserve(idB)]);
    expect(results.map((r) => r.kind).sort()).toEqual(['duplicate','reserved']);
    expect((await db.query('select * from sms_requests')).rows).toHaveLength(1);
  });

  it('keeps history scoped and prevents clients from reserving or rewriting outcomes', async () => {
    await reserve(idA);
    await db.exec('reset role'); await identify(otherId);
    expect((await db.query('select * from sms_requests')).rows).toHaveLength(0);
    await expect(db.query('select reserve_sms($1::jsonb)', [JSON.stringify(payload(idB))])).rejects.toThrow(/permission denied/);
  });
});

describe('nutrition revision synchronization', () => {
  beforeEach(async () => {
    await db.exec("insert into visits(id,patient_id,date) values ('nutrition-visit',1,'2026-10-01')");
    await identify(doctorId);
  });
  const sync = async (revision: number, profile: unknown, plans: unknown = {}) => {
    const response = await db.query<{result:{applied:boolean;revision:number;profile:unknown;plans:unknown}}>('select sync_nutrition($1,$2,$3::jsonb,$4::jsonb) as result',['1',revision,JSON.stringify(profile),JSON.stringify(plans)]);
    return response.rows[0].result;
  };
  it('accepts one device revision, preserves the second draft as a conflict and supports explicit resolution', async () => {
    expect(await sync(0,{assessment:{activityLevel:'Light'}})).toMatchObject({applied:true,revision:1});
    const conflict=await sync(0,{assessment:{activityLevel:'Active'}});
    expect(conflict).toMatchObject({applied:false,revision:1,profile:{assessment:{activityLevel:'Light'}}});
    expect(await sync(1,{assessment:{activityLevel:'Active'}})).toMatchObject({applied:true,revision:2});
    expect(await sync(0,{assessment:{activityLevel:'Active'}})).toMatchObject({applied:true,revision:2});
  });
  it('serializes two device updates at the same revision', async()=>{
    const results=await Promise.all([sync(0,{assessment:{activityLevel:'Light'}}),sync(0,{assessment:{activityLevel:'Active'}})]);
    expect(results.filter(r=>r.applied)).toHaveLength(1);
    expect(results.filter(r=>!r.applied)).toHaveLength(1);
  });
  it('preserves an approved snapshot when replacing a plan', async()=>{
    const approved={schemaVersion:2,approval:{accountId:doctorId,note:'Reviewed'},meals:[]};
    expect(await sync(0,{}, {'nutrition-visit':approved})).toMatchObject({applied:true,revision:1});
    const draft={schemaVersion:2,meals:[],history:[approved]};
    expect(await sync(1,{}, {'nutrition-visit':draft})).toMatchObject({applied:true,revision:2});
    const saved=await db.query<{meal_plan:unknown}>("select meal_plan from visits where id='nutrition-visit'");
    expect(saved.rows[0].meal_plan).toEqual(draft);
  });
  it('rejects cross-facility access',async()=>{
    await db.exec('reset role');await identify(otherId);
    await expect(sync(0,{})).rejects.toThrow(/access denied/);
  });
  it('prevents bypassing revision checks with direct patient writes',async()=>{
    await expect(db.query("update patients set nutrition_profile='{}' where id=1")).rejects.toThrow(/permission denied/);
  });
  it('prevents bypassing revision checks with direct visit writes',async()=>{
    await expect(db.query("update visits set meal_plan='{}' where id='nutrition-visit'")).rejects.toThrow(/permission denied/);
  });
  it('rejects plans for a visit that has not synchronized',async()=>{
    await expect(sync(0,{}, {'missing-visit':{schemaVersion:2}})).rejects.toThrow(/Sync the visit/);
  });
  it('rejects rewriting an approved snapshot without retaining it',async()=>{
    const approved={schemaVersion:2,approval:{accountId:doctorId},meals:[]};await sync(0,{}, {'nutrition-visit':approved});
    await expect(sync(1,{}, {'nutrition-visit':{schemaVersion:2,meals:[]}})).rejects.toThrow(/Preserve the previous/);
  });
});
