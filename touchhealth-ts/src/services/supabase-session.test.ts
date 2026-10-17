import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { requireOnlineSession } from './supabase';

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: { getUser: mocks.getUser } })) }));
beforeEach(() => {
  const values = new Map<string, string>([['th_session', '{"id":"clinic-account"}'], ['zmz2_pts', '[{"code":"KG-BK-CL-A-M0001"}]']]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null });
  vi.stubGlobal('navigator', { onLine: true });
  mocks.getUser.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('online operations independent of local clinical access', () => {
  it('persists and refreshes each device session', () => {
    expect(vi.mocked(createClient).mock.calls.find(call=>call[2]?.auth?.persistSession)?.[2]).toMatchObject({ auth: { persistSession: true, autoRefreshToken: true } });
  });
  it('blocks offline or expired sessions without clearing patient records', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await expect(requireOnlineSession()).rejects.toThrow('Connect to the internet');
    expect(mocks.getUser).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', { onLine: true });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Expired') });
    await expect(requireOnlineSession()).rejects.toThrow('Sign in online again');
    expect(localStorage.getItem('zmz2_pts')).toContain('KG-BK-CL-A-M0001');
    expect(localStorage.getItem('th_session')).toContain('clinic-account');
  });
  it('requires the cloud identity to match the locally signed-in account', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { app_metadata: { app_user_id: 'other-account' } } }, error: null });
    await expect(requireOnlineSession()).rejects.toThrow('Sign in online again');
    mocks.getUser.mockResolvedValue({ data: { user: { app_metadata: { app_user_id: 'clinic-account' } } }, error: null });
    await expect(requireOnlineSession()).resolves.toBeUndefined();
  });
});

describe('reconnection without losing local work',()=>{
 it('uses an anonymous, non-persisting credential transport',()=>{
  const config=vi.mocked(createClient).mock.calls.find(call=>call[2]?.auth?.storageKey==='rc_login_gateway')?.[2];
  expect(config?.auth).toMatchObject({persistSession:false,autoRefreshToken:false});expect(config?.global?.fetch).toBeTypeOf('function');
 });
 it('distinguishes server reachability problems from missing credentials',async()=>{
  mocks.getUser.mockResolvedValue({data:{user:null},error:{name:'AuthRetryableFetchError',status:0}});
  await expect(requireOnlineSession()).rejects.toMatchObject({reason:'unavailable'});expect(localStorage.getItem('th_session')).toContain('clinic-account');
 });
 it('bounds session checks and keeps the local session after a timeout',async()=>{
  vi.useFakeTimers();mocks.getUser.mockImplementation(()=>new Promise(()=>{}));
  const pending=expect(requireOnlineSession()).rejects.toMatchObject({reason:'unavailable'});await vi.advanceTimersByTimeAsync(12001);await pending;
  expect(localStorage.getItem('th_session')).toContain('clinic-account');vi.useRealTimers();
 });
});
