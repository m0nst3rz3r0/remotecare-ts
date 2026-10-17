// ════════════════════════════════════════════════════════════
// REMOTECARE · src/services/supabase.ts
//
// SECURITY FIX
// ─────────────────────────────────────────────────────────
// checkSupabaseConnection() previously queried the 'users'
// table which:
//   • Generated audit events on every connectivity probe
//   • Leaked the table's existence to network observers
//   • Failed once RLS was added (anon SELECT on users blocked)
//
// Replaced with a lightweight ping() RPC that returns true
// and has zero side effects.  Create it once in SQL editor:
//
//   create or replace function public.ping()
//   returns boolean language sql security definer
//   as $$ select true $$;
//   grant execute on function public.ping() to anon;
// ════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = (import.meta as any).env.VITE_SUPABASE_URL     as string | undefined;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string | undefined;

async function boundedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try { return await fetch(input, { ...init, signal: init?.signal ?? controller.signal }); }
  finally { clearTimeout(timer); }
}

// Credential exchange must not inherit a stale user's bearer token or wait
// for their refresh lock. This client never persists an online identity.
export const loginGateway = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'rc_login_gateway' },
  global: { fetch: boundedFetch, headers: { 'x-application': 'remotecare-pwa' } },
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[RemoteCare] Missing Supabase environment variables. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel dashboard.'
  );
}

export const supabase = createClient(
  supabaseUrl    ?? '',
  supabaseAnonKey ?? '',
  {
    auth: {
      // Each browser/device owns its own refresh session. Local clinical access
      // is restored separately from th_session, including when cloud auth expires.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-application': 'remotecare-pwa',
      },
    },
  }
);

/**
 * Lightweight connectivity check using a no-side-effect RPC.
 *
 * Falls back gracefully:
 *   - If ping() RPC does not exist yet: tries a HEAD request
 *     to the Supabase URL instead.
 *   - Never queries a real data table.
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('ping');
    if (!error) return true;

    // ping() not yet created — fall back to a network reachability check
    if (error.code === 'PGRST202' || error.message?.includes('does not exist')) {
      const res = await fetch(supabaseUrl + '/rest/v1/', { method: 'HEAD' });
      return res.ok || res.status === 401; // 401 = reachable but not authed
    }

    return false;
  } catch {
    return false;
  }
}

/** Cloud operations require a verified session matching the local account. */
export async function requireOnlineSession(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new OnlineAccessError('offline', 'Connect to the internet to sync or send SMS. Local work is saved.');
  let local: { id?: string } | null = null;
  try { local = JSON.parse(localStorage.getItem('th_session') ?? 'null'); } catch { /* Require sign-in below. */ }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const { data, error } = await Promise.race([
    supabase.auth.getUser(),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new OnlineAccessError('unavailable', 'Cannot reach the server. Your local work is saved. Check your connection and try again.')), 12000); }),
  ]).catch(error => {
    if (error instanceof OnlineAccessError) throw error;
    throw new OnlineAccessError('unavailable', 'Cannot reach the server. Your local work is saved. Check your connection and try again.');
  }).finally(() => clearTimeout(timer));
  if (error && (error.name === 'AuthRetryableFetchError' || error instanceof TypeError || ('status' in error && error.status === 0))) {
    throw new OnlineAccessError('unavailable', 'Cannot reach the server. Your local work is saved. Check your connection and try again.');
  }
  if (error || !data.user || !local?.id || data.user.app_metadata.app_user_id !== local.id) {
    throw new OnlineAccessError('signin', 'Sign in online again to sync or send SMS. Your offline work is saved.');
  }
}

export class OnlineAccessError extends Error {
  constructor(readonly reason: 'offline' | 'unavailable' | 'signin', message: string) { super(message); this.name = 'OnlineAccessError'; }
}
