# RemoteCare — Supabase backend

This directory contains all server-side code and migrations to harden the app
for production.

## Directory layout

```
supabase/
  migrations/
    001_schema_baseline.sql   — table definitions, indexes, triggers
    002_rls_policies.sql      — Row Level Security (closes the PHI leak)
    003_soft_delete_sync.sql  — soft deletes + incremental sync RPC
  functions/
    login/
      index.ts    — Edge Function: server-side password check, JWT issuance
      DEPLOY.md   — deployment instructions
```

## How to apply

### Option A: Supabase Dashboard (no CLI)
Paste each `.sql` file into **Dashboard → SQL Editor** and run them in order (001, 002, 003).

### Option B: Supabase CLI
```bash
supabase db push                        # applies all migrations
supabase functions deploy login --no-verify-jwt
```

## What each migration does

| File | Purpose |
|---|---|
| `001_schema_baseline.sql` | Creates tables with `deleted_at` + `updated_at`, audit_log, ping() RPC |
| `002_rls_policies.sql` | Enables RLS; doctors see only their hospital, admins see their region, anon sees nothing |
| `003_soft_delete_sync.sql` | Incremental sync RPC `sync_patients(since_ts)`, soft-delete helper, upsert conflict resolution |

## Client integration

Once deployed, swap the login() in `src/services/auth.ts`:

```ts
// auth.ts  — change this one line
export { loginV2 as login } from './authV2';
```

`authV2.ts` calls the Edge Function for online auth and falls back to
cached credentials when offline, exactly like the current flow — but
the browser never touches the `users` table or password hashes.

## Environment variables required (Vercel)

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose — RLS blocks everything) |

The `SUPABASE_SERVICE_ROLE_KEY` is set **only** in the Supabase dashboard for
Edge Functions. It must never appear in the Vite build.
