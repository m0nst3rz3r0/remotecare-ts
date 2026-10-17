import { handler as send } from '../send-sms/handler.ts';
import { handler as status } from '../sms-status/handler.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

const accountId = '00000000-0000-4000-8000-000000000001';
const requestId = '10000000-0000-4000-8000-000000000001';
const actor = { id: accountId, display_name: 'Clinic account', role: 'doctor', hospital: 'Clinic', region: 'Kagera', district: 'Bukoba', is_super_admin: false };
const patient = { id: 1, code: 'KG-BK-CL-A-M0001', hospital: 'Clinic', region: 'Kagera', district: 'Bukoba', status: 'active', phone: '0744123456' };
const body = { provider: 'sms8', requestId, patientId: 1, patientCode: patient.code, message: 'Clinic: Reminder', reason: 'reminder', lang: 'sw', deviceId: 'device-a' };
const request = (payload: unknown) => new Request('https://example.test/functions/v1/send-sms', { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

async function withGateway(test: (state: { calls: number; entry: Record<string, unknown> | null; invalidAuth: boolean; otherFacility: boolean; malformed: boolean }) => Promise<void>) {
  const original = globalThis.fetch;
  const state = { calls: 0, entry: null as Record<string, unknown> | null, invalidAuth: false, otherFacility: false, malformed: false };
  const names = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SMS8_API_KEY','SMS8_DEVICE_ID'];
  const oldValues = names.map((name) => Deno.env.get(name));
  for (const [name, value] of Object.entries({ SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'test-service', SMS8_API_KEY: 'fake-provider-key', SMS8_DEVICE_ID: '12' })) Deno.env.set(name, value);
  const reply = (data: unknown, code = 200) => new Response(JSON.stringify(data), { status: code, headers: { 'Content-Type': 'application/json' } });
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname === 'app.sms8.io') {
      state.calls++;
      const fields = init?.body as URLSearchParams;
      assert(fields.get('key') === 'fake-provider-key');
      if (url.pathname.endsWith('/read')) return reply({ success: true, data: [{ ID: '8', status: 'Delivered' }] });
      assert(fields.get('devices') === '["12"]');
      assert(JSON.parse(fields.get('messages')!)[0].number === '+255744123456');
      if (state.malformed) return new Response('interrupted');
      return reply({ success: true, data: [{ ID: '8', status: 'Pending' }] });
    }
    if (url.pathname === '/auth/v1/user') return state.invalidAuth ? reply({ message: 'invalid' }, 401) : reply({ id: 'auth-user', app_metadata: { app_user_id: accountId } });
    if (url.pathname === '/rest/v1/users') return reply(actor);
    if (url.pathname === '/rest/v1/patients') return reply(state.otherFacility ? { ...patient, hospital: 'Other' } : patient);
    if (url.pathname === '/rest/v1/device_registry') return reply({ id: 'device-a', prefix: 'A', facility_id: 'kagera_bukoba_clinic' });
    if (url.pathname === '/rest/v1/hospitals') return reply([{ name: 'Clinic', region: 'Kagera', district: 'Bukoba' }]);
    if (url.pathname === '/rest/v1/rpc/reserve_sms') {
      const payload = JSON.parse(String(init?.body)).payload;
      if (state.entry) return reply({ kind: state.entry.id === payload.id ? 'existing' : 'duplicate', entry: state.entry });
      state.entry = { ...payload, status: 'unknown', provider: 'sms8', created_at: '2026-10-15T09:00:00Z' };
      return reply({ kind: 'reserved', entry: state.entry });
    }
    if (url.pathname === '/rest/v1/sms_requests') {
      if (init?.method === 'PATCH') state.entry = { ...state.entry, ...JSON.parse(String(init.body)) };
      return reply(state.entry);
    }
    throw new Error('Unexpected network request: ' + url.origin + url.pathname);
  };
  try { await test(state); }
  finally {
    globalThis.fetch = original;
    names.forEach((name, i) => oldValues[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, oldValues[i]!));
  }
}

Deno.test('invalid sessions and cross-facility sends never contact SMS8', async () => {
  await withGateway(async (state) => {
    state.invalidAuth = true;
    assert((await send(request(body))).status === 401);
    state.invalidAuth = false; state.otherFacility = true;
    assert((await send(request(body))).status === 409);
    assert(state.calls === 0);
  });
});

Deno.test('accepted requests are queued, idempotent, masked, and refresh to delivered', async () => {
  await withGateway(async (state) => {
    const first = await (await send(request(body))).json();
    assert(first.entry.status === 'queued'); assert(first.entry.phone.includes('*'));
    assert(first.entry.deviceLetter === 'A'); assert(first.entry.sentBy === actor.display_name);
    await send(request(body));
    await send(request({ ...body, requestId: '20000000-0000-4000-8000-000000000001' }));
    assert(state.calls === 1, 'A repeat must not submit a second message');
    const refreshed = await (await status(request({ requestId }))).json();
    assert(refreshed.entry.status === 'delivered');
  });
});

Deno.test('an interrupted provider response stays uncertain and cannot resubmit', async () => {
  await withGateway(async (state) => {
    state.malformed = true;
    const first = await (await send(request(body))).json();
    assert(first.entry.status === 'unknown');
    await send(request(body));
    assert(state.calls === 1);
  });
});
