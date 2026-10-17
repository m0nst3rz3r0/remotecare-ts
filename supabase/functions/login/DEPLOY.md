# Login Edge Function — Deployment

## Deploy
```bash
supabase functions deploy login --no-verify-jwt
```
`--no-verify-jwt` is correct here: this function IS the login endpoint,
so it runs before any JWT exists. The function validates credentials itself.

## Required environment variables (set in Supabase Dashboard → Settings → Edge Functions)
```
SUPABASE_URL             (auto-injected by Supabase)
SUPABASE_ANON_KEY        (auto-injected by Supabase)
SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
```

## What to set in Supabase Dashboard after deploy
1. Dashboard → Authentication → Providers → Enable "Email" (no confirm required)
2. Dashboard → Authentication → URL Configuration → set Site URL to your Vercel URL
3. Dashboard → Project Settings → API → confirm anon key is still in VITE_SUPABASE_ANON_KEY

## Client integration

The client now always uses the server login endpoint for online authentication.
Deploy all migrations and functions before deploying the frontend. The endpoint
exchanges the generated token hash for actual access/refresh tokens and sets
server-controlled app metadata. Each device has its own session and offline
credential cache; keep single-session-per-user enforcement disabled.

See [SMS8 setup and verification](../../SMS8_SETUP.md) for the complete workflow.
