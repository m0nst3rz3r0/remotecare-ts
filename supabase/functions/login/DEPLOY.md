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
SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
```

## What to set in Supabase Dashboard after deploy
1. Dashboard → Authentication → Providers → Enable "Email" (no confirm required)
2. Dashboard → Authentication → URL Configuration → set Site URL to your Vercel URL
3. Dashboard → Project Settings → API → confirm anon key is still in VITE_SUPABASE_ANON_KEY

## Client integration
See `src/services/authV2.ts` for the updated login() that calls this function.
The old login() in auth.ts reads the users table directly — replace it once
this function is deployed and tested.
