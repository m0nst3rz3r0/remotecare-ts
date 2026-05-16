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
      // We manage our own session in localStorage (th_session).
      // Disable Supabase Auth auto-refresh so it does not
      // overwrite our session key or generate unexpected network
      // calls on every tab focus.
      persistSession: false,
      autoRefreshToken: false,
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
