// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · DM/HTN NCD MANAGEMENT SYSTEM
// src/services/auth.ts — Authentication & session management
// ════════════════════════════════════════════════════════════

import type { User, SessionUser, UserRole, Hospital } from '../types';

// ── STORAGE KEYS ─────────────────────────────────────────────

const KEYS = {
  USERS:     'th_users',
  SESSION:   'th_session',
  HOSPITALS: 'th_hospitals',
} as const;

// ── DEFAULT SEED DATA ─────────────────────────────────────────

const DEFAULT_USERS: User[] = [
  {
    id: 'u0',
    username: 'superadmin',
    password: 'super123',
    role: 'admin',
    displayName: 'Super Admin',
    hospital: '',
    region: '',
    district: '',
    isSuperAdmin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u1',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    displayName: 'System Admin',
    hospital: '',
    region: 'Kagera',
    district: 'Bukoba Municipal',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u2',
    username: 'doctor',
    password: 'doctor123',
    role: 'doctor',
    displayName: 'Dr. John Smith',
    hospital: 'Bukoba Regional Hospital',
    region: 'Kagera',
    district: 'Bukoba Municipal',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_HOSPITALS: Hospital[] = [
  { id: 'h1', name: 'Zamzam Hospital',         region: 'Kagera', district: 'Bukoba Municipal' },
  { id: 'h2', name: 'Bukoba Regional Hospital', region: 'Kagera', district: 'Bukoba Municipal' },
  { id: 'h3', name: 'BMC Health Centre',        region: 'Kagera', district: 'Bukoba Municipal' },
];

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

export function seedDefaults(): void {
  if (!loadUsers().length)     saveUsers(DEFAULT_USERS);
  if (!loadHospitals().length) saveHospitals(DEFAULT_HOSPITALS);
}

export function clearAndReseed(): void {
  localStorage.removeItem(KEYS.USERS);
  localStorage.removeItem(KEYS.HOSPITALS);
  localStorage.removeItem(KEYS.SESSION);
  saveUsers(DEFAULT_USERS);
  saveHospitals(DEFAULT_HOSPITALS);
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
  | { success: true;  user: SessionUser }
  | { success: false; error: string };

export function login(params: {
  username: string;
  password: string;
  role: UserRole;
  hospital?: string;
  region?: string;
  district?: string;
}): LoginResult {
  const { username, password, role, hospital = '', region = '', district = '' } = params;

  if (!username || !password) {
    return { success: false, error: 'Please enter your username and password.' };
  }

  const users = loadUsers();
  const anyMatch = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password,
  );

  if (!anyMatch) {
    return { success: false, error: 'Incorrect username or password. Please try again.' };
  }

  if (anyMatch.role !== role) {
    const correctTab = anyMatch.role === 'admin' ? 'Admin' : 'Doctor';
    return {
      success: false,
      error: `Wrong tab selected. Please click the "${correctTab}" tab — your account is a ${anyMatch.role} account.`,
    };
  }

  // Doctor: validate hospital assignment
  if (role === 'doctor') {
    const resolvedHospital = hospital || anyMatch.hospital;
    if (!resolvedHospital) {
      return { success: false, error: 'Please select your hospital from the list.' };
    }
    if (anyMatch.hospital && resolvedHospital !== anyMatch.hospital) {
      return {
        success: false,
        error: `Access Denied: You are not authorised for this facility. Your assigned hospital is: ${anyMatch.hospital}`,
      };
    }
    const sessionUser: SessionUser = {
      id:              anyMatch.id,
      username:        anyMatch.username,
      displayName:     anyMatch.displayName,
      role:            anyMatch.role,
      hospital:        anyMatch.hospital,
      sessionHospital: resolvedHospital,
      sessionRegion:   region || anyMatch.region,
      sessionDistrict: district || anyMatch.district,
      isSuperAdmin:    false,
      adminRegion:     '',
      adminDistrict:   '',
    };
    saveSession(sessionUser);
    return { success: true, user: sessionUser };
  }

  // Admin login — carry region/district and superadmin flag
  const sessionUser: SessionUser = {
    id:              anyMatch.id,
    username:        anyMatch.username,
    displayName:     anyMatch.displayName,
    role:            anyMatch.role,
    hospital:        anyMatch.hospital,
    sessionHospital: 'RemoteCare',
    sessionRegion:   anyMatch.region   ?? '',
    sessionDistrict: anyMatch.district ?? '',
    isSuperAdmin:    anyMatch.isSuperAdmin === true,
    adminRegion:     anyMatch.region   ?? '',
    adminDistrict:   anyMatch.district ?? '',
  };
  saveSession(sessionUser);
  return { success: true, user: sessionUser };
}

// ── LOGOUT ────────────────────────────────────────────────────

export function logout(): void {
  clearSession();
}

// ── USER MANAGEMENT ───────────────────────────────────────────

export type MutationResult =
  | { success: true }
  | { success: false; error: string };

export function addUser(params: {
  displayName: string;
  username: string;
  password: string;
  role: UserRole;
  hospital?: string;
  region?: string;
  district?: string;
  isSuperAdmin?: boolean;
  createdBy?: SessionUser | null;  // who is creating this user
}): MutationResult {
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
    // Only superadmin can create admins
    if (!createdBy?.isSuperAdmin) {
      return { success: false, error: 'Only superadmin can create admin accounts.' };
    }
  }
  if (role === 'doctor') {
    // Only admin (or superadmin) can create doctors
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

  const newUser: User = {
    id:           'u' + Date.now(),
    displayName,
    username:     username.toLowerCase(),
    password,
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

export function updateUserPassword(
  targetId: string,
  newPassword: string,
  requestedBy: SessionUser | null,
): MutationResult {
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

  // Superadmin can reset any admin password
  // Admin can reset any doctor password
  // Nobody can reset a superadmin password (except themselves via profile — future feature)
  if (target.isSuperAdmin) {
    return { success: false, error: 'Superadmin password cannot be reset here.' };
  }
  if (target.role === 'admin' && !requestedBy.isSuperAdmin) {
    return { success: false, error: 'Only superadmin can reset admin passwords.' };
  }
  if (target.role === 'doctor' && requestedBy.role !== 'admin') {
    return { success: false, error: 'Only admins can reset doctor passwords.' };
  }

  saveUsers(users.map((u) => (u.id === targetId ? { ...u, password: newPassword } : u)));
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
