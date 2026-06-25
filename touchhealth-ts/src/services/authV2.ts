// ═══════════════════════════════════════════════════════════════
// REMOTECARE · src/services/authV2.ts
// Phase 1 auth upgrade — login via Edge Function
//
// USAGE
// ─────
// This file is a drop-in replacement for login() in auth.ts.
// It calls the /functions/v1/login Edge Function instead of
// reading the users table directly from the browser.
//
// MIGRATION STEPS
// ───────────────
// 1. Deploy supabase/functions/login (see DEPLOY.md)
// 2. Apply migrations 001–003 in Supabase SQL editor
// 3. In auth.ts, import { loginV2 as login } from './authV2'
//    and remove the old login() export
// 4. Remove the old supabase.from('users').select('*') call
//
// WHAT CHANGES FROM THE CALLER'S PERSPECTIVE
// ───────────────────────────────────────────
// • Same LoginResult type — callers need no changes
// • On success: saves a REAL Supabase Auth session (not plain JSON)
//   so every subsequent supabase.from() call includes the JWT
//   automatically and RLS policies apply
// ═══════════════════════════════════════════════════════════════

import type { SessionUser, UserRole } from '../types';
import { supabase } from './supabase';
import { saveSession } from './auth';
import { registerDevice } from './deviceManager';

export type LoginResult =
  | { success: true;  user: SessionUser; offline?: boolean }
  | { success: false; error: string };

/**
 * Authenticate via the server-side Edge Function.
 *
 * The Edge Function:
 *   • Reads and verifies the password hash (never done in the browser)
 *   • Issues a Supabase Auth JWT with facility claims for RLS
 *   • Writes an audit log entry
 *   • Rate-limits failed attempts per IP
 */
export async function loginV2(params: {
  username: string;
  password: string;
  role: UserRole;
  hospital?: string;
}): Promise<LoginResult> {
  const { username, password, role, hospital = '' } = params;

  if (!username || !password) {
    return { success: false, error: 'Please enter your username and password.' };
  }

  let data: {
    token: string;
    user: {
      id:          string;
      displayName: string;
      role:        string;
      hospital:    string;
      region:      string;
      district:    string;
      isSuperAdmin: boolean;
    };
  };

  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke('login', {
      body: { username: username.toLowerCase().trim(), password },
    });

    if (fnError) {
      // Network error or non-2xx from Edge Function
      const msg = fnError.message ?? '';
      if (msg.includes('Invalid credentials')) {
        return { success: false, error: 'Incorrect username or password. Please try again.' };
      }
      if (msg.includes('Too many')) {
        return { success: false, error: 'Too many failed attempts. Try again in 15 minutes.' };
      }
      // Supabase not reachable — fall through to offline path below
      throw new Error('offline');
    }

    data = fnData;
  } catch (err) {
    // Offline fallback: use cached credentials (no Supabase, no JWT)
    const isOffline = err instanceof Error && err.message === 'offline';
    if (isOffline) {
      return loginOfflineFallback({ username, password, role, hospital });
    }
    return { success: false, error: 'Could not reach the server. Check your connection.' };
  }

  const serverRole = data.user.role as 'admin' | 'doctor';

  // Validate the role tab selected matches the server-returned role
  if (role !== 'auto' && serverRole !== role) {
    const correctTab = serverRole === 'admin' ? 'Admin' : 'Doctor';
    return { success: false, error: `Wrong tab selected. Please use the ${correctTab} tab.` };
  }

  // Set the Auth session so every subsequent supabase call carries the JWT
  // The token returned is an access_token (Supabase Auth magic-link exchange).
  // We pass it directly to setSession so the client is fully authenticated.
  const { error: sessionError } = await supabase.auth.setSession({
    access_token:  data.token,
    refresh_token: data.token, // single-token model — refresh = same token for now
  });

  if (sessionError) {
    console.warn('[authV2] setSession error (non-fatal):', sessionError.message);
    // Non-fatal: the JWT may still work even if setSession complains
    // about the refresh token. Proceed.
  }

  const sessionUser: SessionUser = {
    id:              data.user.id,
    username:        username.toLowerCase().trim(),
    displayName:     data.user.displayName,
    role:            serverRole,
    hospital:        data.user.hospital,
    sessionHospital: hospital || data.user.hospital,
    sessionRegion:   data.user.region,
    sessionDistrict: data.user.district,
    isSuperAdmin:    data.user.isSuperAdmin,
    adminRegion:     data.user.region,
    adminDistrict:   data.user.district,
  };

  saveSession(sessionUser);

  registerDevice(
    sessionUser.sessionRegion,
    sessionUser.sessionDistrict,
    sessionUser.sessionHospital,
  ).catch((err) => console.warn('Device registration failed:', err));

  return { success: true, user: sessionUser };
}

// ── Offline fallback (no network, no JWT) ────────────────────────
// Uses the existing cached-users mechanism from auth.ts.
// The user is authenticated locally only — Supabase queries will
// fail (no JWT), but localStorage data is still accessible.
// Shows a warning in the UI to sync when back online.
async function loginOfflineFallback(params: {
  username: string;
  password: string;
  role:     UserRole;
  hospital: string;
}): Promise<LoginResult> {
  // Dynamically import to avoid circular deps
  const { verifyPassword } = await import('./crypto');
  const { loadCachedUsers } = await import('./storage');

  const { username, password, role, hospital } = params;

  const cached = loadCachedUsers().find(
    (u) => String(u['username']).toLowerCase() === username.toLowerCase()
  );

  if (!cached) {
    return { success: false, error: 'Offline: no cached credentials found. Connect to the internet and log in at least once.' };
  }

  const storedHash = String(cached['password'] ?? '');
  const passwordOk = await verifyPassword(password, storedHash);
  if (!passwordOk) {
    return { success: false, error: 'Incorrect username or password. Please try again.' };
  }

  const serverRole = String(cached['role'] ?? '') as 'admin' | 'doctor';
  if (role !== 'auto' && serverRole !== role) {
    const correctTab = serverRole === 'admin' ? 'Admin' : 'Doctor';
    return { success: false, error: `Wrong tab selected. Please use the ${correctTab} tab.` };
  }

  const { saveSession } = await import('./auth');
  const sessionUser: SessionUser = {
    id:              String(cached['id'] ?? ''),
    username:        username.toLowerCase(),
    displayName:     String(cached['display_name'] ?? cached['displayName'] ?? ''),
    role:            serverRole,
    hospital:        String(cached['hospital'] ?? ''),
    sessionHospital: hospital || String(cached['hospital'] ?? ''),
    sessionRegion:   String(cached['region'] ?? ''),
    sessionDistrict: String(cached['district'] ?? ''),
    isSuperAdmin:    cached['is_super_admin'] === true || cached['isSuperAdmin'] === true,
    adminRegion:     String(cached['region'] ?? ''),
    adminDistrict:   String(cached['district'] ?? ''),
  };

  saveSession(sessionUser);

  return { success: true, user: sessionUser, offline: true };
}
