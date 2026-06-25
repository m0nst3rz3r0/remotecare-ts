import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInvoke, mockSetSession } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockSetSession: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    auth: { setSession: mockSetSession },
  },
}));

vi.mock('./auth', () => ({ saveSession: vi.fn() }));

vi.mock('./deviceManager', () => ({
  registerDevice: vi.fn().mockResolvedValue(undefined),
}));

import { loginV2 } from './authV2';

const FAKE_USER = {
  id: 'u1', displayName: 'Dr One', role: 'doctor',
  hospital: 'H1', region: 'R1', district: 'D1', isSuperAdmin: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSetSession.mockResolvedValue({ error: null });
});

describe('loginV2', () => {
  it('calls Edge Function and sets session on success', async () => {
    mockInvoke.mockResolvedValue({ data: { token: 'jwt-tok', user: FAKE_USER }, error: null });

    const result = await loginV2({ username: 'doc1', password: 'pw', hospital: 'H1', role: 'doctor' });

    expect(mockInvoke).toHaveBeenCalledWith('login', expect.objectContaining({ body: expect.objectContaining({ username: 'doc1' }) }));
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'jwt-tok', refresh_token: 'jwt-tok' });
    expect(result.success).toBe(true);
  });

  it('returns invalid-credentials error from Edge Function', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Invalid credentials' } });

    const result = await loginV2({ username: 'doc1', password: 'bad', hospital: 'H1', role: 'doctor' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/password/i);
  });

  it('returns error for empty username', async () => {
    const result = await loginV2({ username: '', password: 'pw', role: 'doctor' });
    expect(result.success).toBe(false);
  });

  it('returns error when network is completely down (no offline fallback without cache)', async () => {
    // Simulate a generic fetch error (not an 'offline' tagged error from the function)
    mockInvoke.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await loginV2({ username: 'doc1', password: 'pw', hospital: 'H1', role: 'doctor' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/server|connection/i);
  });
});
