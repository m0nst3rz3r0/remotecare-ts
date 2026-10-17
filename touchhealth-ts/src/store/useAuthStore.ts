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
  isSigningIn: boolean;
  loginError:   string | null;

  // Actions
  init:    () => void;
  // CHANGED: signIn is now async because login() is async
  signIn:  (params: {
    mode?: 'auto' | 'online' | 'offline';
    expectedUserId?: string;
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

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  isLoading:   true,
  isSigningIn: false,
  loginError:  null,

  /** Called once on app mount — seeds defaults and restores session */
  init: () => {
    seedDefaults();
    const session = validateSession();
    set({ currentUser: session, isLoading: false });
  },

  // CHANGED: signIn is now async — awaits the async login() function
  signIn: async (params) => {
    if(get().isSigningIn)return {success:false,error:'Sign-in is already in progress.'};
    set({isSigningIn:true,loginError:null});
    try {
      const result=await login(params);
      if(result.success)set({currentUser:result.user,loginError:null});
      else set({loginError:result.error});
      return result;
    } catch {
      const error='Sign-in could not finish. Please retry. Your local work is saved.';
      set({loginError:error});return {success:false,error};
    } finally {set({isSigningIn:false});}
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
  user?.isSuperAdmin === true;
