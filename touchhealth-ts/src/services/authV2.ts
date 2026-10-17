import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import type { SessionUser } from '../types';
import { supabase, loginGateway } from './supabase';
import { saveSession, type LoginParams, type LoginResult } from './auth';
import { registerDevice } from './deviceManager';
import { hashPassword, verifyPassword } from './crypto';
import { loadCachedUsers, saveCachedUsers } from './storage';

interface ServerUser {
  id: string; displayName: string; role: 'admin' | 'doctor'; hospital: string;
  region: string; district: string; isSuperAdmin: boolean;
}

function localUser(user: ServerUser, username: string): SessionUser {
  return {
    id: user.id, username: username.toLowerCase().trim(), displayName: user.displayName,
    role: user.role, hospital: user.hospital, sessionHospital: user.hospital,
    sessionRegion: user.region, sessionDistrict: user.district,
    isSuperAdmin: user.isSuperAdmin, adminRegion: user.region, adminDistrict: user.district,
  };
}

export async function loginV2(params: LoginParams): Promise<LoginResult> {
  const username = params.username.toLowerCase().trim();
  if (!username || !params.password) return { success: false, error: 'Please enter your username and password.' };
  // Offline mode authenticates only against this device's provisioned cache.
  if (params.mode === 'offline') return loginOfflineFallback({ ...params, username });
  if (typeof navigator !== 'undefined' && !navigator.onLine) return params.mode === 'online'
    ? { success:false,error:'No internet connection. You can keep working on this device and sync later.' }
    : loginOfflineFallback({ ...params, username });
  let data: { session: { access_token: string; refresh_token: string }; user: ServerUser };
  try {
    const result = await loginGateway.functions.invoke('login', { body: { username, password: params.password } });
    if (result.error) {
      // A server rejection must never fall back to stale cached credentials.
      if (result.error instanceof FunctionsHttpError) {
        const status = result.error.context.status;
        const body = await result.error.context.clone().json().catch(() => ({}));
        const gatewayFailure = status === 401 && !('error' in body) && /jwt|authorization/i.test(String(body.message ?? ''));
        return { success: false, error: status === 429 ? 'Too many attempts. Try again in 15 minutes.' : gatewayFailure || status === 404 ? 'Online sign-in needs a server update. Please contact your administrator; local records remain saved.' : status === 401 ? 'Incorrect username or password.' : 'The sign-in server is unavailable. Please try again; your local records are saved.' };
      }
      if (result.error instanceof FunctionsFetchError) return params.mode === 'online'
        ? { success:false,error:'Cannot reach online sign-in. Check your connection and retry. Your local records are saved.' }
        : loginOfflineFallback({ ...params, username });
      return { success: false, error: 'Server login unavailable. Please try again.' };
    }
    data = result.data;
  } catch {
    return { success: false, error: 'Could not reach the sign-in server. Your local records are saved. Check your connection and retry.' };
  }
  if (!data?.session?.access_token || !data.session.refresh_token || !data.user || typeof data.user.id !== 'string' || !data.user.id || !['doctor','admin'].includes(data.user.role)) {
    return { success: false, error: 'Invalid server session. Please deploy the updated login function.' };
  }
  if (params.expectedUserId && params.expectedUserId !== data.user.id) return { success:false,error:'This account has changed. Ask your administrator to check it before syncing. Your local records are saved.' };
  if (params.role !== 'auto' && params.role !== data.user.role) return { success: false, error: 'This account does not have the expected role. Contact your administrator.' };
  const { error } = await supabase.auth.setSession(data.session);
  if (error) return { success: false, error: 'Could not establish your online session. Your local work is saved.' };
  const sessionUser = localUser(data.user, username);
  // Cache a fresh device-local verifier only AFTER successful online login.
  // Never download the server's password hash or cache the plaintext password.
  const cached = loadCachedUsers().filter((u) => u.username !== username);
  saveCachedUsers([...cached, {
    ...data.user, username, password: await hashPassword(params.password),
    display_name: data.user.displayName, is_super_admin: data.user.isSuperAdmin,
    cachedAt: new Date().toISOString(),
  }]);
  saveSession(sessionUser);
  // Provisioning errors do not prevent offline access; registration displays
  // a setup action until a unique letter has been reserved successfully.
  void registerDevice(sessionUser.sessionRegion, sessionUser.sessionDistrict, sessionUser.sessionHospital, true)
    .catch(() => console.warn('Device provisioning is pending; existing device letters and local records are retained.'));
  return { success: true, user: sessionUser };
}

async function loginOfflineFallback(params: LoginParams): Promise<LoginResult> {
  const username = params.username.toLowerCase().trim();
  const cached = loadCachedUsers().find((u) => u.username === username);
  if (!cached) return { success: false, error: 'Connect and sign in once on this device to enable offline access.' };
  if (!await verifyPassword(params.password, String(cached.password ?? ''))) return { success: false, error: 'Incorrect username or password.' };
  const role = cached.role as 'doctor' | 'admin';
  if (!['doctor','admin'].includes(role) || (params.role !== 'auto' && params.role !== role)) return { success: false, error: 'Please use the correct role tab.' };
  // Drop any previous online identity without revoking other devices' sessions.
  await supabase.auth.signOut({ scope: 'local' });
  const user = localUser({
    id: String(cached.id), displayName: String(cached.display_name ?? cached.displayName ?? ''), role,
    hospital: String(cached.hospital ?? ''), region: String(cached.region ?? ''), district: String(cached.district ?? ''),
    isSuperAdmin: cached.is_super_admin === true || cached.isSuperAdmin === true,
  }, username);
  saveSession(user);
  return { success: true, user, offline: true };
}
