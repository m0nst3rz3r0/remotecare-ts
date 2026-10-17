import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { loginV2 } from './authV2';
import { validateSession, logout } from './auth';
import { loadCachedUsers, saveCachedUsers } from './storage';
import { hashPassword } from './crypto';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), setSession: vi.fn(), signOut: vi.fn(), register: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: mocks.invoke }, auth: { setSession: mocks.setSession, signOut: mocks.signOut } } }));
vi.mock('./deviceManager', () => ({ registerDevice: mocks.register }));

const user = { id: 'account-1', displayName: 'Clinic', role: 'doctor', hospital: 'Clinic', region: 'Kagera', district: 'Bukoba', isSuperAdmin: false };
const params = { username: 'clinic', password: 'correct-password', role: 'doctor' as const };
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.stubGlobal('navigator', { onLine: true });
  vi.clearAllMocks();
  mocks.setSession.mockResolvedValue({ error: null }); mocks.signOut.mockResolvedValue({ error: null }); mocks.register.mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('online provisioning and offline account access', () => {
  it('establishes distinct tokens, caches a local verifier, and restores offline after restart', async () => {
    localStorage.setItem('th_device_prefix', 'B');
    localStorage.setItem('zmz2_pts', '[{"code":"KG-BK-CL-B-M0001"}]');
    mocks.invoke.mockResolvedValue({ data: { user, session: { access_token: 'access', refresh_token: 'refresh' } }, error: null });
    expect((await loginV2(params)).success).toBe(true);
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' });
    expect(loadCachedUsers()[0].password).toMatch(/^pbkdf2:/);
    expect(loadCachedUsers()[0].password).not.toBe(params.password);
    expect(validateSession()?.id).toBe(user.id);
    vi.stubGlobal('navigator', { onLine: false });
    expect(await loginV2(params)).toMatchObject({ success: true, offline: true });
    expect(localStorage.getItem('th_device_prefix')).toBe('B');
    expect(localStorage.getItem('zmz2_pts')).toContain('KG-BK-CL-B-M0001');
    logout();
    expect(mocks.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
    expect(validateSession()).toBeNull();
    expect(localStorage.getItem('th_device_prefix')).toBe('B');
  });

  it('rejects invalid online sessions without provisioning offline credentials', async () => {
    mocks.invoke.mockResolvedValue({ data: { user, session: { access_token: 'a', refresh_token: 'r' } }, error: null });
    mocks.setSession.mockResolvedValue({ error: new Error('Invalid token') });
    expect(await loginV2(params)).toMatchObject({ success: false });
    expect(loadCachedUsers()).toHaveLength(0);
  });

  it('never treats a server rejection as an offline login', async () => {
    saveCachedUsers([{ ...user, username: params.username, password: await hashPassword(params.password) }]);
    mocks.invoke.mockResolvedValue({ error: new FunctionsHttpError(new Response('{}', { status: 401 })) });
    expect(await loginV2(params)).toMatchObject({ success: false, error: 'Incorrect username or password.' });
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it('allows cached login on transport failure but requires first-time online provisioning', async () => {
    mocks.invoke.mockResolvedValue({ error: new FunctionsFetchError(new Error('network')) });
    expect(await loginV2(params)).toMatchObject({ success: false });
    saveCachedUsers([{ ...user, username: params.username, password: await hashPassword(params.password) }]);
    expect(await loginV2(params)).toMatchObject({ success: true, offline: true });
  });
});
