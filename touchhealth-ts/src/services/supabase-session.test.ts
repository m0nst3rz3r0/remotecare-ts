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
    expect(vi.mocked(createClient).mock.calls[0][2]).toMatchObject({ auth: { persistSession: true, autoRefreshToken: true } });
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
