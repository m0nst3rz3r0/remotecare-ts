// ═══════════════════════════════════════════════════════════════
// REMOTECARE · Supabase Edge Function: login
// Deno runtime — deployed via: supabase functions deploy login
//
// WHY THIS EXISTS
// ───────────────
// The browser must never read the `users` table or touch password
// hashes. All credential verification happens here (server-side).
// On success we issue a Supabase Auth JWT that carries facility
// claims in app_metadata so RLS policies can scope every query.
//
// REQUEST  POST /functions/v1/login
// BODY     { username: string, password: string }
//
// RESPONSE 200  { session: { access_token, refresh_token }, user: { id, displayName, role, hospital,
//                               region, district, isSuperAdmin } }
//          401  { error: "Invalid credentials" }
//          400  { error: "Missing username or password" }
//          500  { error: "Internal error" }
//
// ENVIRONMENT VARIABLES (set in Supabase dashboard)
//   SUPABASE_URL            — your project URL (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY — service role key (auto-injected)
// ═══════════════════════════════════════════════════════════════

import { PBKDF2Hash } from './hash.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── PBKDF2 password verification (mirrors src/services/crypto.ts) ─
async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored.startsWith('pbkdf2:')) {
    // Legacy plain-text (migration period only)
    return plain === stored;
  }

  const parts = stored.split(':');
  if (parts.length !== 3) return false;

  const [, saltB64, hashB64] = parts;
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plain),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  const computed = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return computed === hashB64;
}

// ── Rate-limiting: simple in-memory per-IP counter ───────────────
// For production, replace with a Redis/KV-backed counter.
// This still stops naive brute-force within a single Edge instance.
const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS    = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) { failedAttempts.delete(ip); return false; }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const entry = failedAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    failedAttempts.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count++;
  }
}

function clearFailures(ip: string): void {
  failedAttempts.delete(ip);
}

// ── Handler ──────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown';

  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({ error: 'Too many failed attempts. Try again in 15 minutes.' }),
      { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { username, password } = body;
  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Missing username or password' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Use service-role client — bypasses RLS to read the users table
  // (this is the ONLY place that ever needs to do so)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, username, password, role, display_name, hospital, region, district, is_super_admin, deleted_at')
    .eq('username', username.toLowerCase().trim())
    .single();

  if (fetchError || !user) {
    recordFailure(clientIp);
    // Constant-time-ish — always try verify even on miss to prevent timing attacks
    await verifyPassword(password, 'pbkdf2:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (user.deleted_at) {
    recordFailure(clientIp);
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const passwordOk = await verifyPassword(password, user.password);
  if (!passwordOk) {
    recordFailure(clientIp);
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  clearFailures(clientIp);

  // ── Upgrade plain-text password in the background ───────────────
  // (Migration period: if legacy plain-text password was accepted)
  if (!user.password.startsWith('pbkdf2:')) {
    const { PBKDF2Hash } = await import('./hash.ts');
    const hashed = await PBKDF2Hash(password);
    const { error: upgradeError } = await supabase.from('users').update({ password: hashed }).eq('id', user.id);
    if (upgradeError) return new Response(JSON.stringify({ error: 'Credential migration failed' }), { status: 500, headers: CORS_HEADERS });
  }

  // ── Issue a Supabase Auth JWT carrying facility claims ───────────
  // We create/get a Supabase Auth user that shadows the app user.
  // The Auth user email is `<app_user_id>@remotecare.internal` (stable, not real).
  const authEmail = `${user.id}@remotecare.internal`;

  // generateLink provisions a missing shadow user without sending email.
  const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: authEmail });
  if (signInError || !signInData?.user || !signInData.properties?.hashed_token) {
    return new Response(JSON.stringify({ error: 'Could not issue session' }), { status: 500, headers: CORS_HEADERS });
  }
  const { error: claimsError } = await supabase.auth.admin.updateUserById(signInData.user.id, {
    app_metadata: {
      role: user.role, hospital: user.hospital, region: user.region, district: user.district,
      is_super_admin: user.is_super_admin, app_user_id: user.id,
    },
  });
  if (claimsError) return new Response(JSON.stringify({ error: 'Could not configure session' }), { status: 500, headers: CORS_HEADERS });
  // Use a separate public client so the service client's Authorization is never
  // replaced by a user's session. This exchange returns real, distinct tokens.
  const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: verifyError } = await auth.auth.verifyOtp({ token_hash: signInData.properties.hashed_token, type: 'email' });
  if (verifyError || !verified.session) return new Response(JSON.stringify({ error: 'Could not establish session' }), { status: 500, headers: CORS_HEADERS });

  // Write audit log
  await supabase.from('audit_log').insert({
    actor_id:   user.id,
    actor_name: user.display_name,
    action:     'login',
    facility:   [user.region, user.district, user.hospital].join('||'),
  });

  const responsePayload = {
    session: { access_token: verified.session.access_token, refresh_token: verified.session.refresh_token },
    user: {
      id:          user.id,
      displayName: user.display_name,
      role:        user.role,
      hospital:    user.hospital,
      region:      user.region,
      district:    user.district,
      isSuperAdmin: user.is_super_admin,
    },
  };

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
