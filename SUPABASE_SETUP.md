# RemoteCare · Supabase Setup Guide

## Quick Start (No local env file - use Vercel instead)

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **Anon Key** (Settings → API)

### 2. Run SQL Schema
1. In Supabase Dashboard → SQL Editor
2. Copy contents of `/supabase/schema.sql`
3. Run the SQL to create all tables

### 3. Create Superadmin (Two Options)

#### Option A: Via SQL (Recommended)
```sql
-- Generate password hash first using bcrypt
-- Then insert superadmin:
INSERT INTO users (id, username, password, role, display_name, is_super_admin)
VALUES (
    uuid_generate_v4(),
    'superadmin',
    '$2a$10$YOUR_BCRYPT_HASH_HERE', -- Generate this first
    'admin',
    'Super Admin',
    TRUE
);
```

#### Option B: Via First-Time Registration
The app will auto-detect if no users exist and show a "First Setup" screen.

### 4. Configure Vercel Environment Variables

In your Vercel project dashboard:

| Variable | Value | Example |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Your Supabase URL | `https://abcdef123456.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon public key | `eyJhbGciOiJIUzI1NiIs...` |
| `VITE_APP_VERSION` | App version | `2.0.0` |

### 5. Deploy
Push to GitHub → Vercel auto-deploys with environment variables

## Database Schema Overview

| Table | Purpose |
|-------|---------|
| `users` | Admin & doctor accounts |
| `hospitals` | Hospital registry |
| `patients` | Patient demographics |
| `visits` | Clinical visits |
| `medications` | Prescribed drugs |
| `hba1c` | Quarterly HbA1c readings |
| `call_logs` | Patient follow-up calls |
| `scheduled_appointments` | Future visit bookings |
| `sms_logs` | SMS notification history |
| `stockout_reports` | Drug supply alerts |
| `clinic_settings` | Per-hospital config |

## Removed from This Version

✗ No `.env` files (use Vercel dashboard instead)  
✗ No fake hospitals (Zamzam, Bukoba Regional, etc. removed)  
✗ No hardcoded superadmin password  
✗ No localStorage fallback for production

## Next Steps

1. Test login with superadmin credentials
2. Create hospitals via Admin → Directory → Hospitals
3. Create doctors/admins via User Management
4. Start enrolling patients
