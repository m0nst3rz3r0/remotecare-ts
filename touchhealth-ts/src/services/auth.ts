// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · DM/HTN NCD MANAGEMENT SYSTEM
// src/services/auth.ts — Authentication & session management
// ════════════════════════════════════════════════════════════

import type { User, SessionUser, UserRole, Hospital } from '../types';
import { hashPassword, verifyPassword } from './crypto';
import { supabase } from './supabase';

// ── STORAGE KEYS ─────────────────────────────────────────────

const KEYS = {
  USERS:     'th_users',
  SESSION:   'th_session',
  HOSPITALS: 'th_hospitals',
} as const;

// ════════════════════════════════════════════════════════════
// SUPABASE MIGRATION NOTE:
// All localStorage usage below is being replaced with Supabase.
// See: src/services/supabase.ts for new implementation
// ════════════════════════════════════════════════════════════

// ── NO DEFAULT SEED DATA ─────────────────────────────────────
// No fake hospitals, no default users. Create superadmin via Supabase
// dashboard SQL Editor or first-time registration flow.

// ── STORAGE HELPERS ───────────────────────────────────────────

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

// ── SEED DEFAULTS ─────────────────────────────────────────────
// NO AUTO-SEEDING: All users and hospitals must be created via the app UI
// Superadmin must be created through first-time registration or Supabase dashboard

export function seedDefaults(): void {
  // No automatic seeding - prevents fake data in production
  // First superadmin should be created via registration flow
}

export function clearAndReseed(): void {
  localStorage.removeItem(KEYS.USERS);
  localStorage.removeItem(KEYS.HOSPITALS);
  localStorage.removeItem(KEYS.SESSION);
  // No automatic reseeding - prevents fake data
}

// ── SESSION ───────────────────────────────────────────────────

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
  const stillExists = loadUsers().find(
    (u) => u.id === session.id && u.role === session.role,
  );
  if (!stillExists) { clearSession(); return null; }
  return session;
}

// ── LOGIN ─────────────────────────────────────────────────────

export type LoginResult =
  | { success: true; user: SessionUser; offline?: boolean }
  | { success: false; error: string };

// CHANGED: Hybrid login - checks Supabase first, caches to localStorage for offline
export async function login(params: {
  username: string;
  password: string;
  role: UserRole;
  hospital?: string;
  region?: string;
  district?: string;
}): Promise<LoginResult> {
  const { username, password, role, hospital = '', region = '', district = '' } = params;

  if (!username || !password) {
    return { success: false, error: 'Please enter your username and password.' };
  }

  let foundUser: any = null;
  let isOffline = false;

  // Try Supabase first (online mode)
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase())
      .single();

    if (!error && data) {
      foundUser = data;
      // Cache user to localStorage for offline login
      cacheUserForOffline(foundUser);
    } else {
      // If Supabase fails, try localStorage (offline mode)
      isOffline = true;
      foundUser = findCachedUser(username);
    }
  } catch (e) {
    // Network error - use localStorage fallback
    isOffline = true;
    foundUser = findCachedUser(username);
  }

  if (!foundUser) {
    return { success: false, error: 'Incorrect username or password. Please try again.' };
  }

  // Verify password
  const passwordOk = await verifyPassword(password, foundUser.password);
  if (!passwordOk) {
    return { success: false, error: 'Incorrect username or password. Please try again.' };
  }

  if (foundUser.role !== role) {
    const correctTab = foundUser.role === 'admin' ? 'Admin' : 'Doctor';
    return {
      success: false,
      error: `Wrong tab selected. Please click the "${correctTab}" tab — your account is a ${foundUser.role} account.`,
    };
  }

  // Doctor: validate hospital assignment
  if (role === 'doctor') {
    const resolvedHospital = hospital || foundUser.hospital;
    if (!resolvedHospital) {
      return { success: false, error: 'Please select your hospital from the list.' };
    }
    if (foundUser.hospital && resolvedHospital !== foundUser.hospital) {
      return {
        success: false,
        error: `Access Denied: You are not authorised for this facility. Your assigned hospital is: ${foundUser.hospital}`,
      };
    }
    const sessionUser: SessionUser = {
      id:              foundUser.id,
      username:        foundUser.username,
      displayName:     foundUser.display_name,
      role:            foundUser.role,
      hospital:        foundUser.hospital,
      sessionHospital: resolvedHospital,
      sessionRegion:   region || foundUser.region,
      sessionDistrict: district || foundUser.district,
      isSuperAdmin:    false,
      adminRegion:     '',
      adminDistrict:   '',
    };
    saveSession(sessionUser);
    return { success: true, user: sessionUser, offline: isOffline };
  }

  // Admin login
  const sessionUser: SessionUser = {
    id:              foundUser.id,
    username:        foundUser.username,
    displayName:     foundUser.display_name,
    role:            foundUser.role,
    hospital:        foundUser.hospital,
    sessionHospital: 'RemoteCare',
    sessionRegion:   foundUser.region   ?? '',
    sessionDistrict: foundUser.district ?? '',
    isSuperAdmin:    foundUser.is_super_admin === true,
    adminRegion:     foundUser.region   ?? '',
    adminDistrict:   foundUser.district ?? '',
  };
  saveSession(sessionUser);
  return { success: true, user: sessionUser, offline: isOffline };
}

// Helper: Cache user credentials for offline login
function cacheUserForOffline(user: any): void {
  const cachedUsers = JSON.parse(localStorage.getItem('th_cached_users') || '[]');
  const existingIndex = cachedUsers.findIndex((u: any) => u.username === user.username);
  
  const cacheData = {
    id: user.id,
    username: user.username,
    password: user.password, // Already hashed
    role: user.role,
    displayName: user.display_name,
    hospital: user.hospital,
    region: user.region,
    district: user.district,
    isSuperAdmin: user.is_super_admin,
    cachedAt: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    cachedUsers[existingIndex] = cacheData;
  } else {
    cachedUsers.push(cacheData);
  }
  
  localStorage.setItem('th_cached_users', JSON.stringify(cachedUsers));
}

// Helper: Find cached user for offline login
function findCachedUser(username: string): any {
  const cachedUsers = JSON.parse(localStorage.getItem('th_cached_users') || '[]');
  return cachedUsers.find((u: any) => u.username.toLowerCase() === username.toLowerCase()) || null;
}

// ── LOGOUT ────────────────────────────────────────────────────

export function logout(): void {
  clearSession();
}

// ── USER MANAGEMENT ───────────────────────────────────────────

export type MutationResult =
  | { success: true }
  | { success: false; error: string };

// CHANGED: addUser is now async to hash the password before saving
export async function addUser(params: {
  displayName: string;
  username: string;
  password: string;
  role: UserRole;
  hospital?: string;
  region?: string;
  district?: string;
  isSuperAdmin?: boolean;
  createdBy?: SessionUser | null;
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

  // ── Permission checks ──────────────────────────────────────
  if (role === 'admin') {
    if (!createdBy?.isSuperAdmin) {
      return { success: false, error: 'Only superadmin can create admin accounts.' };
    }
  }
  if (role === 'doctor') {
    if (createdBy && createdBy.role !== 'admin') {
      return { success: false, error: 'Only admins can create doctor accounts.' };
    }
  }

  const users = loadUsers();
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'Username already taken.' };
  }
  if (role === 'doctor' && !hospital) {
    return { success: false, error: 'You must assign a hospital to this doctor.' };
  }

  // CHANGED: hash password before saving
  const hashed = await hashPassword(password);

  const newUser: User = {
    id:           'u' + Date.now(),
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

  saveUsers([...users, newUser]);
  return { success: true };
}

export function deleteUser(id: string): void {
  saveUsers(loadUsers().filter((u) => u.id !== id));
}

// ── PASSWORD RESET ────────────────────────────────────────────

// CHANGED: updateUserPassword is now async to hash the new password
export async function updateUserPassword(
  targetId: string,
  newPassword: string,
  requestedBy: SessionUser | null,
): Promise<MutationResult> {
  if (!requestedBy) {
    return { success: false, error: 'You must be signed in to reset passwords.' };
  }
  if (newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const users = loadUsers();
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

  // CHANGED: hash the new password before saving
  const hashed = await hashPassword(newPassword);
  saveUsers(users.map((u) => (u.id === targetId ? { ...u, password: hashed } : u)));
  return { success: true };
}

// ── HOSPITAL MANAGEMENT ───────────────────────────────────────

export function addHospital(params: {
  name: string;
  region: string;
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
  saveHospitals([...hospitals, { id: 'h' + Date.now(), name, region, district }]);
  return { success: true };
}

export function deleteHospital(id: string): void {
  saveHospitals(loadHospitals().filter((h) => h.id !== id));
}

export function getHospitalsByRegionDistrict(region: string, district: string): Hospital[] {
  return loadHospitals().filter(
    (h) =>
      (!region   || h.region   === region) &&
      (!district || h.district === district),
  );
}

// ── PERMISSION HELPERS ────────────────────────────────────────

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
