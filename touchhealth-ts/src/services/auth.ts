// ════════════════════════════════════════════════════════════
// REMOTECARE · src/services/auth.ts
// Authentication & session management
//
// FIXES in this version
// ─────────────────────────────────────────────────────────
// 1. validateSession() cold-start bug: on a fresh page load
//    before sync runs, loadUsers() returns [] so every session
//    was silently invalidated, logging the user out on refresh.
//    Fix: fall back to cached users before giving up — the cache
//    is always populated at login and persists across restarts.
// 2. login() accepted region/district params that were
//    immediately discarded (TS build workaround comment).
//    Removed them from the signature so callers are not misled.
// 3. checkSupabaseConnection() moved to storage.ts where it
//    uses a safe ping() RPC instead of querying the users table.
//
// OFFLINE-FIRST STRATEGY (unchanged)
// ─────────────────────────────────────────────────────────
// • All writes go to localStorage FIRST.
// • Supabase is a SYNC target only.
// • A pending_ops queue stores any Supabase write that failed,
//   so the manual Sync button can replay them later.
// ════════════════════════════════════════════════════════════

import type { User, SessionUser, UserRole, Hospital } from '../types';
import { randomUUID } from '../utils/id';
import { hashPassword, verifyPassword } from './crypto';
import { supabase } from './supabase';
import { registerDevice } from './deviceManager';
import {
  loadUsers,    saveUsers,
  loadHospitals, saveHospitals,
  loadCachedUsers, saveCachedUsers,
} from './storage';

// ── STORAGE KEYS ─────────────────────────────────────────────

const KEYS = {
  SESSION:     'th_session',
  PENDING_OPS: 'th_pending_ops',
} as const;

// ════════════════════════════════════════════════════════════
// PENDING OPERATIONS QUEUE
// ════════════════════════════════════════════════════════════

type PendingOp =
  | { type: 'insert_user';     payload: Record<string, unknown> }
  | { type: 'update_password'; id: string; password: string }
  | { type: 'delete_user';     id: string }
  | { type: 'insert_hospital'; payload: Record<string, unknown> }
  | { type: 'delete_hospital'; id: string };

function loadPendingOps(): PendingOp[] {
  try {
    const raw = localStorage.getItem(KEYS.PENDING_OPS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingOps(ops: PendingOp[]): void {
  localStorage.setItem(KEYS.PENDING_OPS, JSON.stringify(ops));
}

function enqueuePendingOp(op: PendingOp): void {
  savePendingOps([...loadPendingOps(), op]);
}

export async function flushPendingOps(): Promise<{ flushed: number; failed: number }> {
  const ops = loadPendingOps();
  if (!ops.length) return { flushed: 0, failed: 0 };

  let flushed = 0;
  const remaining: PendingOp[] = [];

  for (const op of ops) {
    try {
      switch (op.type) {
        case 'insert_user':
          await supabase.from('users').upsert(op.payload);
          break;
        case 'update_password':
          await supabase.from('users').update({ password: op.password }).eq('id', op.id);
          break;
        case 'delete_user':
          await supabase.from('users').delete().eq('id', op.id);
          break;
        case 'insert_hospital':
          await supabase.from('hospitals').upsert(op.payload);
          break;
        case 'delete_hospital':
          await supabase.from('hospitals').delete().eq('id', op.id);
          break;
      }
      flushed++;
    } catch {
      remaining.push(op);
    }
  }

  savePendingOps(remaining);
  return { flushed, failed: remaining.length };
}

export function pendingOpsCount(): number {
  return loadPendingOps().length;
}

// ════════════════════════════════════════════════════════════
// OFFLINE USER CACHE  (re-exported helpers from storage.ts)
// ════════════════════════════════════════════════════════════

function cacheUserForOffline(user: Record<string, unknown>): void {
  const cached = loadCachedUsers();
  const idx = cached.findIndex((u) => u['username'] === user['username']);
  const entry = {
    id:             user['id'],
    username:       user['username'],
    password:       user['password'],
    role:           user['role'],
    display_name:   user['display_name'] ?? user['displayName'],
    hospital:       user['hospital'],
    region:         user['region'],
    district:       user['district'],
    is_super_admin: user['is_super_admin'] ?? user['isSuperAdmin'] ?? false,
    cachedAt:       new Date().toISOString(),
  };
  if (idx >= 0) cached[idx] = entry;
  else cached.push(entry);
  saveCachedUsers(cached);
}

function updateCachedPassword(userId: string, hashedPassword: string): void {
  const cached = loadCachedUsers().map((u) =>
    u['id'] === userId ? { ...u, password: hashedPassword } : u
  );
  saveCachedUsers(cached);
}

function removeCachedUser(userId: string): void {
  saveCachedUsers(loadCachedUsers().filter((u) => u['id'] !== userId));
}

function findCachedUser(username: string): Record<string, unknown> | null {
  return (
    loadCachedUsers().find(
      (u) => String(u['username']).toLowerCase() === username.toLowerCase()
    ) ?? null
  );
}

export function seedDefaults(): void {}

export function clearAndReseed(): void {
  localStorage.removeItem('th_users');
  localStorage.removeItem('th_hospitals');
  localStorage.removeItem(KEYS.SESSION);
}

// ════════════════════════════════════════════════════════════
// SESSION
// ════════════════════════════════════════════════════════════

export function getSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(KEYS.SESSION);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function saveSession(user: SessionUser): void {
  localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(KEYS.SESSION);
}

/**
 * FIX: validateSession cold-start bug.
 *
 * Previously: checked loadUsers() which returns [] before sync →
 * session always invalid → user logged out on every page refresh.
 *
 * Now: if loadUsers() is empty (pre-sync), fall back to the
 * cached-users list which is always populated at login time.
 */
export function validateSession(): SessionUser | null {
  const session = getSession();
  if (!session) return null;

  // Primary check — local user list (populated after sync)
  const localUsers = loadUsers();
  if (localUsers.length > 0) {
    const stillExists = localUsers.find(
      (u) => u.id === session.id && u.role === session.role
    );
    if (!stillExists) {
      // User was deleted — invalidate
      clearSession();
      return null;
    }
    return session;
  }

  // Fallback — cached users (pre-sync cold start)
  const inCache = findCachedUser(session.username);
  if (!inCache) {
    clearSession();
    return null;
  }
  return session;
}

// ════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════

export type LoginResult =
  | { success: true;  user: SessionUser; offline?: boolean }
  | { success: false; error: string };

export async function login(params: {
  username: string;
  password: string;
  role: UserRole;
  hospital?: string;
}): Promise<LoginResult> {
  const { username, password, role, hospital = '' } = params;

  if (!username || !password) {
    return { success: false, error: 'Please enter your username and password.' };
  }

  let foundUser: Record<string, unknown> | null = null;
  let isOffline = false;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase())
      .single();

    if (!error && data) {
      foundUser = data as Record<string, unknown>;
      cacheUserForOffline(foundUser);
    } else {
      isOffline = true;
    }
  } catch {
    isOffline = true;
  }

  if (!foundUser) {
    foundUser = findCachedUser(username);
    isOffline = true;
  }

  if (!foundUser) {
    return { success: false, error: 'Incorrect username or password. Please try again.' };
  }

  const storedHash = String(foundUser['password'] ?? '');
  const passwordOk = await verifyPassword(password, storedHash);
  if (!passwordOk) {
    return { success: false, error: 'Incorrect username or password. Please try again.' };
  }

  const userRole = String(foundUser['role'] ?? '');
  if (role !== 'auto' && userRole !== role) {
    const correctTab = userRole === 'admin' ? 'Admin' : 'Doctor';
    return { success: false, error: `Wrong tab selected. Please use the ${correctTab} tab.` };
  }

  const resolvedRole = userRole as 'admin' | 'doctor';
  const isSuperAdmin = foundUser['is_super_admin'] === true || foundUser['isSuperAdmin'] === true;

  const sessionUser: SessionUser = {
    id:              String(foundUser['id'] ?? ''),
    username:        String(foundUser['username'] ?? ''),
    displayName:     String(foundUser['display_name'] ?? foundUser['displayName'] ?? ''),
    role:            resolvedRole,
    hospital:        String(foundUser['hospital'] ?? ''),
    sessionHospital: hospital || String(foundUser['hospital'] ?? ''),
    sessionRegion:   String(foundUser['region'] ?? ''),
    sessionDistrict: String(foundUser['district'] ?? ''),
    isSuperAdmin,
    adminRegion:     String(foundUser['region'] ?? ''),
    adminDistrict:   String(foundUser['district'] ?? ''),
  };

  saveSession(sessionUser);

  registerDevice(
    sessionUser.sessionRegion,
    sessionUser.sessionDistrict,
    sessionUser.sessionHospital,
  ).catch((err) => console.warn('Device registration failed:', err));

  return { success: true, user: sessionUser, offline: isOffline };
}

export function logout(): void {
  clearSession();
}

// ════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ════════════════════════════════════════════════════════════

export type MutationResult =
  | { success: true }
  | { success: false; error: string };

export async function addUser(params: {
  displayName:   string;
  username:      string;
  password:      string;
  role:          UserRole;
  hospital?:     string;
  region?:       string;
  district?:     string;
  isSuperAdmin?: boolean;
  createdBy?:    SessionUser | null;
}): Promise<MutationResult> {
  const {
    displayName, username, password, role,
    hospital = '', region = '', district = '',
    isSuperAdmin: newUserIsSuperAdmin = false,
    createdBy = null,
  } = params;

  if (!displayName || !username || !password) {
    return { success: false, error: 'Name, username and password are required.' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  if (role === 'admin' && !createdBy?.isSuperAdmin) {
    return { success: false, error: 'Only superadmin can create admin accounts.' };
  }
  if (role === 'doctor' && createdBy && createdBy.role !== 'admin') {
    return { success: false, error: 'Only admins can create doctor accounts.' };
  }

  const users = loadUsers();
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'Username already taken.' };
  }
  if (role === 'doctor' && !hospital) {
    return { success: false, error: 'You must assign a hospital to this doctor.' };
  }

  const hashed = await hashPassword(password);
  const userId = randomUUID();

  const supabasePayload = {
    id:             userId,
    username:       username.toLowerCase(),
    password:       hashed,
    role,
    display_name:   displayName,
    hospital,
    region,
    district,
    is_super_admin: newUserIsSuperAdmin,
  };

  const localUser: User = {
    id:           userId,
    displayName,
    username:     username.toLowerCase(),
    password:     hashed,
    role,
    hospital,
    region,
    district,
    isSuperAdmin: newUserIsSuperAdmin,
    createdAt:    new Date().toISOString(),
  };

  saveUsers([...users, localUser]);
  cacheUserForOffline(supabasePayload);

  try {
    const { error } = await supabase.from('users').insert(supabasePayload);
    if (error) throw error;
  } catch {
    enqueuePendingOp({ type: 'insert_user', payload: supabasePayload });
  }

  return { success: true };
}

export function deleteUser(id: string): void {
  saveUsers(loadUsers().filter((u) => u.id !== id));
  removeCachedUser(id);

  void Promise.resolve(
    supabase.from('users').delete().eq('id', id)
  ).then(({ error }) => {
    if (error) enqueuePendingOp({ type: 'delete_user', id });
  }).catch(() => {
    enqueuePendingOp({ type: 'delete_user', id });
  });
}

// ════════════════════════════════════════════════════════════
// PASSWORD RESET
// ════════════════════════════════════════════════════════════

export async function updateUserPassword(
  targetId:    string,
  newPassword: string,
  requestedBy: SessionUser | null,
): Promise<MutationResult> {
  if (!requestedBy) {
    return { success: false, error: 'You must be signed in to reset passwords.' };
  }
  if (newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const users  = loadUsers();
  const target = users.find((u) => u.id === targetId);
  if (!target) return { success: false, error: 'User not found.' };

  if (target.isSuperAdmin) {
    return { success: false, error: 'Superadmin password cannot be reset here.' };
  }
  if (target.role === 'admin' && !requestedBy.isSuperAdmin) {
    return { success: false, error: 'Only superadmin can reset admin passwords.' };
  }
  if (target.role === 'doctor' && requestedBy.role !== 'admin') {
    return { success: false, error: 'Only admins can reset doctor passwords.' };
  }

  const hashed = await hashPassword(newPassword);

  saveUsers(users.map((u) => (u.id === targetId ? { ...u, password: hashed } : u)));
  updateCachedPassword(targetId, hashed);

  try {
    const { error } = await supabase
      .from('users')
      .update({ password: hashed })
      .eq('id', targetId);
    if (error) throw error;
  } catch {
    enqueuePendingOp({ type: 'update_password', id: targetId, password: hashed });
  }

  return { success: true };
}

// ════════════════════════════════════════════════════════════
// HOSPITAL MANAGEMENT
// ════════════════════════════════════════════════════════════

export function addHospital(params: {
  name:     string;
  region:   string;
  district: string;
}): MutationResult {
  const { name, region, district } = params;
  if (!name || !region) {
    return { success: false, error: 'Hospital name and region are required.' };
  }
  const hospitals = loadHospitals();
  if (hospitals.find((h) => h.name.toLowerCase() === name.toLowerCase())) {
    return { success: false, error: 'A hospital with this name already exists.' };
  }

  const id = randomUUID();
  saveHospitals([...hospitals, { id, name, region, district }]);

  const payload = { id, name, region, district };
  void Promise.resolve(
    supabase.from('hospitals').insert(payload)
  ).then(({ error }) => {
    if (error) enqueuePendingOp({ type: 'insert_hospital', payload });
  }).catch(() => {
    enqueuePendingOp({ type: 'insert_hospital', payload });
  });

  return { success: true };
}

export function deleteHospital(id: string): void {
  saveHospitals(loadHospitals().filter((h) => h.id !== id));

  void Promise.resolve(
    supabase.from('hospitals').delete().eq('id', id)
  ).then(({ error }) => {
    if (error) enqueuePendingOp({ type: 'delete_hospital', id });
  }).catch(() => {
    enqueuePendingOp({ type: 'delete_hospital', id });
  });
}

export function getHospitalsByRegionDistrict(region: string, district: string): Hospital[] {
  return loadHospitals().filter(
    (h) =>
      (!region   || h.region   === region) &&
      (!district || h.district === district),
  );
}

// ════════════════════════════════════════════════════════════
// PERMISSION HELPERS
// ════════════════════════════════════════════════════════════

export function isSuperAdmin(user: SessionUser | null): boolean {
  return user?.isSuperAdmin === true;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === 'admin';
}

export function isDoctor(user: SessionUser | null): boolean {
  return user?.role === 'doctor';
}

export function getHospitalScope(user: SessionUser | null): string | null {
  if (!user || user.role === 'admin') return null;
  return user.sessionHospital || user.hospital || null;
}

export function getUserInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── Re-exports for backward compatibility ─────────────────────
// loadUsers, saveUsers, loadHospitals, saveHospitals moved to
// storage.ts (single source of truth).  Re-exported here so
// every existing caller (AdminPage, AuthPage, DirectoryPage,
// NavTabs, Sidebar) compiles without touching those files.
export {
  loadUsers,
  saveUsers,
  loadHospitals,
  saveHospitals,
} from './storage';
