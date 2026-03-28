// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · src/store/useAuthStore.ts
// Zustand store — auth, session, current user
// ════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { SessionUser, UserRole } from '../types';
import {
  login,
  logout,
  validateSession,
  seedDefaults,
  type LoginResult,
} from '../services/auth';

// ── STATE SHAPE ───────────────────────────────────────────────

interface AuthState {
  currentUser:  SessionUser | null;
  isLoading:    boolean;
  loginError:   string | null;

  // Actions
  init:    () => void;
  // CHANGED: signIn is now async because login() is async
  signIn:  (params: {
    username: string;
    password: string;
    role:     UserRole;
    hospital?: string;
    region?:   string;
    district?: string;
  }) => Promise<LoginResult>;
  signOut: () => void;
  clearError: () => void;
}

// ── STORE ─────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  isLoading:   true,
  loginError:  null,

  /** Called once on app mount — seeds defaults and restores session */
  init: () => {
    seedDefaults();
    const session = validateSession();
    set({ currentUser: session, isLoading: false });
  },

  // CHANGED: signIn is now async — awaits the async login() function
  signIn: async (params) => {
    const result = await login(params);
    if (result.success) {
      set({ currentUser: result.user, loginError: null });
    } else {
      set({ loginError: result.error });
    }
    return result;
  },

  signOut: () => {
    logout();
    set({ currentUser: null, loginError: null });
  },

  clearError: () => set({ loginError: null }),
}));

// ── SELECTORS ─────────────────────────────────────────────────

export const selectIsAdmin  = (user: SessionUser | null) => user?.role === 'admin';
export const selectIsDoctor = (user: SessionUser | null) => user?.role === 'doctor';
export const selectIsSuperAdmin = (user: SessionUser | null) =>
  user?.username === 'alexalpha360';
