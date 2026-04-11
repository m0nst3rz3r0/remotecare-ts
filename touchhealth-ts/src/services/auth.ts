// ════════════════════════════════════════════════════════════
// REMOTECARE · src/services/auth.ts
// Authentication & session management
//
// OFFLINE-FIRST STRATEGY:
// ─────────────────────────────────────────────────────────────
// • All writes go to localStorage FIRST — the app always works
//   without internet.
// • Supabase is used as a SYNC target only:
//     - Login: try Supabase first, fall back to localStorage cache
//     - User mutations (add / password reset / delete): write locally,
//       then fire-and-forget to Supabase (no crash if offline)
//     - A "pending_ops" queue stores any Supabase write that failed,
//       so the manual Sync button can replay them later
// • SMS: works normally when online, queues silently when offline
// ─────────────────────────────────────────────────────────────

import type { User, SessionUser, UserRole, Hospital } from '../types';
import { hashPassword, verifyPassword } from './crypto';
import { supabase } from './supabase';

// ── STORAGE KEYS ─────────────────────────────────────────────

const KEYS = {
  USERS:          'th_users',
  SESSION:        'th_session',
  HOSPITALS:      'th_hospitals',
  CACHED_USERS:   'th_cached_users',   // users pulled from Supabase for offline login
  PENDING_OPS:    'th_pending_ops',    // failed Supabase writes queued for next sync
} as const;

// ════════════════════════════════════════════════════════════
// PENDING OPERATIONS QUEUE
// Any Supabase write that fails while offline is stored here.
// Call flushPendingOps() from the manual Sync button.
// ════════════════════════════════════════════════════════════

type PendingOp =
  | { type: 'insert_user';   payload: Record<string, unknown> }
  | { type: 'update_password'; id: string; password: string }
  | { type: 'delete_user';   id: string }
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

/**
 * Replay all queued Supabase writes.
 * Called by the Sync button (SyncBar / BackupPanel).
 * Returns { flushed, failed } counts.
 */
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

/** How many ops are waiting to sync */
export function pendingOpsCount(): number {
  return loadPendingOps().length;
}

// ════════════════════════════════════════════════════════════
// LOCAL STORAGE HELPERS  (source of truth for all reads)
// ════════════════════════════════════════════════════════════

export function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(KEYS.USERS);
    return raw ? (JSON.parse(raw) as User[]) : [];
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
}

export function loadHospitals(): Hospital[] {
  try {
    const raw = localStorage.getItem(KEYS.HOSPITALS);
    return raw ? (JSON.parse(raw) as Hospital[]) : [];
  } catch {
    return [];
  }
}

export function saveHospitals(hospitals: Hospital[]): void {
  localStorage.setItem(KEYS.HOSPITALS, JSON.stringify(hospitals));
}

// ════════════════════════════════════════════════════════════
// OFFLINE USER CACHE
// A separate copy of users fetched from Supabase, keyed by
// username, used as fallback when Supabase is unreachable.
// ════════════════════════════════════════════════════════════

function loadCachedUsers(): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(KEYS.CACHED_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCachedUsers(users: Record<string, unknown>[]): void {
  localStorage.setItem(KEYS.CACHED_USERS, JSON.stringify(users));
}

/** Upsert one user into the offline cache */
function cacheUserForOffline(user: Record<string, unknown>): void {
  const cached = loadCachedUsers();
  const idx = cached.findIndex((u) => u['username'] === user['username']);
  const entry = {
    id:           user['id'],
    username:     user['username'],
    password:     user['password'],   // already hashed
    role:         user['role'],
    display_name: user['display_name'] ?? user['displayName'],
    hospital:     user['hospital'],
    region:       user['region'],
    district:     user['district'],
    is_super_admin: user['is_super_admin'] ?? user['isSuperAdmin'] ?? false,
    cachedAt:     new Date().toISOString(),
  };
  if (idx >= 0) {
    cached[idx] = entry;
  } else {
    cached.push(entry);
  }
  saveCachedUsers(cached);
}

/** Update the cached password for a user (called after password reset) */
function updateCachedPassword(userId: string, hashedPassword: string): void {
  const cached = loadCachedUsers().map((u) =>
    u['id'] === userId ? { ...u, password: hashedPassword } : u
  );
  saveCachedUsers(cached);
}

/** Remove a user from the offline cache */
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

// ════════════════════════════════════════════════════════════
// SEED DEFAULTS  (no auto-seeding — create via UI or Supabase)
// ════════════════════════════════════════════════════════════

export function seedDefaults(): void {
  // intentionally empty — no fake data in production
}

export function clearAndReseed(): void {
  localStorage.removeItem(KEYS.USERS);
  localStorage.removeItem(KEYS.HOSPITALS);
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

export function validateSession(): SessionUser | null {
  const session = getSession();
  if (!session) return null;
  // Session is valid as long as the user exists locally
  const stillExists = loadUsers().find(
    (u) => u.id === session.id && u.role === session.role
  );
  if (!stillExists) {
    // Also accept if they exist in offline cache (Supabase-sourced user)
    const inCache = findCachedUser(session.username);
    if (!inCache) { clearSession(); return null; }
  }
  return session;
}

// ════════════════════════════════════════════════════════════
// LOGIN  — Supabase first, localStorage cache fallback
// ════════════════════════════════════════════════════════════

export type LoginResult =
  | { success: true;  user: SessionUser; offline?: boolean }
  | { success: false; error: string };

export async function login(params: {
  username: string;
  password: string;
  role: UserRole;
  hospital?:  string;
  region?:    string;
  district?:  string;
}): Promise<LoginResult> {
  const { username, password, role, hospital = '', region = '', district = '' } = params;

  if (!username || !password) {
    return { success: false, error: 'Please enter your username and password.' };
  }

  let foundUser: Record<string, unknown> | null = null;
  let isOffline = false;

  // ── 1. Try Supabase (online) ──────────────────────────────
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase())
      .single();

    if (!error && data) {
      foundUser = data as Record<string, unknown>;
      // Refresh the offline cache so next offline login has latest password/role
      cacheUserForOffline(foundUser);
    } else {
      isOffline = true;
    }
  } catch {
    isOffline = true;
  }

  // ── 2. Fall back to offline cache ─────────────────────────
  if (!foundUser) {
    foundUser = findCachedUser(username);
    isOffline = true;
  }

  if (!foundUser) {
    return { success: false, error: 'Incorrect username or password. Please try again.' };
  }

  // ── 3. Verify password ────────────────────────────────────
  const storedHash = String(foundUser['password'] ?? '');
  const passwordOk = await verifyPassword(password, storedHash);
  if (!passwordOk) {
    return { success: false, error: 'Incorrect username or password. Please try again.' };
  }

  // ── 4. Role check ─────────────────────────────────────────
  const userRole = String(foundUser['role'] ?? '');
  if (userRole !== role) {
    const correctTab = userRole === 'admin' ? 'Admin' : 'Doctor';
    return {
      success: false,
      error: `Wrong tab selected. Please click the "${correctTab}" tab — your account is a ${userRole} account.`,
    };
  }

  // ── 5. Build session ──────────────────────────────────────
  const userId       = String(foundUser['id'] ?? '');
  const uname        = String(foundUser['username'] ?? '');
  const displayName  = String(foundUser['display_name'] ?? foundUser['displayName'] ?? uname);
  const userHospital = String(foundUser['hospital'] ?? '');
  const userRegion   = String(foundUser['region']   ?? '');
  const userDistrict = String(foundUser['district'] ?? '');
  const isSuperAdmin =
    foundUser['is_super_admin'] === true || foundUser['isSuperAdmin'] === true;

  if (role === 'doctor') {
    const resolvedHospital = hospital || userHospital;
    if (!resolvedHospital) {
      return { success: false, error: 'Please select your hospital from the list.' };
    }
    if (userHospital && resolvedHospital !== userHospital) {
      return {
        success: false,
        error: `Access Denied: You are not authorised for this facility. Your assigned hospital is: ${userHospital}`,
      };
    }
    const sessionUser: SessionUser = {
      id:              userId,
      username:        uname,
      displayName,
      role:            'doctor',
      hospital:        userHospital,
      sessionHospital: resolvedHospital,
      sessionRegion:   region   || userRegion,
      sessionDistrict: district || userDistrict,
      isSuperAdmin:    false,
      adminRegion:     '',
      adminDistrict:   '',
    };
    saveSession(sessionUser);
    return { success: true, user: sessionUser, offline: isOffline };
  }

  // Admin
  const sessionUser: SessionUser = {
    id:              userId,
    username:        uname,
    displayName,
    role:            'admin',
    hospital:        userHospital,
    sessionHospital: 'RemoteCare',
    sessionRegion:   userRegion,
    sessionDistrict: userDistrict,
    isSuperAdmin,
    adminRegion:     userRegion,
    adminDistrict:   userDistrict,
  };
  saveSession(sessionUser);
  return { success: true, user: sessionUser, offline: isOffline };
}

// ════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════

export function logout(): void {
  clearSession();
}

// ════════════════════════════════════════════════════════════
// USER MANAGEMENT
// Write pattern: localStorage first → Supabase fire-and-forget
//   → on failure, enqueue in pending ops for manual sync
// ════════════════════════════════════════════════════════════

export type MutationResult =
  | { success: true }
  | { success: false; error: string };

export async function addUser(params: {
  displayName:  string;
  username:     string;
  password:     string;
  role:         UserRole;
  hospital?:    string;
  region?:      string;
  district?:    string;
  isSuperAdmin?: boolean;
  createdBy?:   SessionUser | null;
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

  // Permission checks
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

  const hashed  = await hashPassword(password);
  const userId  = crypto.randomUUID();

  const newUser: User = {
    id:          userId,
    displayName,
    username:    username.toLowerCase(),
    password:    hashed,
    role,
    hospital,
    region,
    district,
    isSuperAdmin: newUserIsSuperAdmin,
    createdAt:   new Date().toISOString(),
  };

  // ── 1. Save locally (always succeeds) ─────────────────────
  saveUsers([...users, newUser]);

  // ── 2. Update offline cache ───────────────────────────────
  cacheUserForOffline({
    id:           userId,
    username:     username.toLowerCase(),
    password:     hashed,
    role,
    display_name: displayName,
    hospital,
    region,
    district,
    is_super_admin: newUserIsSuperAdmin,
  });

  // ── 3. Try Supabase; queue on failure ─────────────────────
  const supabasePayload = {
    id:           userId,
    username:     username.toLowerCase(),
    password:     hashed,
    role,
    display_name: displayName,
    hospital,
    region,
    district,
    is_super_admin: newUserIsSuperAdmin,
  };

  try {
    const { error } = await supabase.from('users').insert(supabasePayload);
    if (error) throw error;
  } catch {
    enqueuePendingOp({ type: 'insert_user', payload: supabasePayload });
  }

  return { success: true };
}

export function deleteUser(id: string): void {
  // ── 1. Remove locally ─────────────────────────────────────
  saveUsers(loadUsers().filter((u) => u.id !== id));
  removeCachedUser(id);

  // ── 2. Try Supabase; queue on failure ─────────────────────
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
// Fixed: now updates localStorage + Supabase + offline cache
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
  if (!target) {
    return { success: false, error: 'User not found.' };
  }

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

  // ── 1. Update localStorage ────────────────────────────────
  saveUsers(users.map((u) => (u.id === targetId ? { ...u, password: hashed } : u)));

  // ── 2. Update offline cache ───────────────────────────────
  updateCachedPassword(targetId, hashed);

  // ── 3. Try Supabase; queue on failure ─────────────────────
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
// Same offline-first pattern: local first, Supabase secondary
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

  const id = crypto.randomUUID();

  // ── 1. Save locally ───────────────────────────────────────
  saveHospitals([...hospitals, { id, name, region, district }]);

  // ── 2. Try Supabase; queue on failure ─────────────────────
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
  // ── 1. Remove locally ─────────────────────────────────────
  saveHospitals(loadHospitals().filter((h) => h.id !== id));

  // ── 2. Try Supabase; queue on failure ─────────────────────
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
