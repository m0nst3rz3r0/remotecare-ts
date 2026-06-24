-- ═══════════════════════════════════════════════════════════════
-- REMOTECARE · Migration 002 — Row Level Security
--
-- DESIGN
-- ──────
-- Authentication uses Supabase Auth (via Edge Function login).
-- After the login Edge Function validates the password, it calls
-- supabase.auth.admin.generateLink() or signs a custom JWT that
-- carries these claims in app_metadata:
--
--   { "role": "doctor", "hospital": "Bugando MC",
--     "region": "Lake", "district": "Mwanza",
--     "is_super_admin": false }
--
-- All RLS policies read those claims via auth.jwt() ->> 'key'.
-- The anon key gets zero data access after these policies are applied.
-- ═══════════════════════════════════════════════════════════════

-- ── Enable RLS on all tables ─────────────────────────────────────
alter table public.users        enable row level security;
alter table public.hospitals    enable row level security;
alter table public.patients     enable row level security;
alter table public.visits       enable row level security;
alter table public.medications  enable row level security;
alter table public.audit_log    enable row level security;

-- ── Helper: extract facility claims from current JWT ─────────────
-- Returns the user's hospital, region, district, role, super_admin flag.
create or replace function public.current_user_claims()
returns jsonb language sql stable security definer as $$
  select coalesce(
    auth.jwt() -> 'app_metadata',
    auth.jwt() -> 'user_metadata',
    '{}'::jsonb
  )
$$;

create or replace function public.claim(key text)
returns text language sql stable security definer as $$
  select public.current_user_claims() ->> key
$$;

-- ════════════════════════════════════════════════════════════════
-- USERS TABLE
-- ─────────────────────────────────────────────────────────────
-- • anon:        no access
-- • doctor:      read own row only
-- • admin:       read all non-superadmin users in their region
-- • superadmin:  full access
-- ════════════════════════════════════════════════════════════════

drop policy if exists "users: superadmin full access"    on public.users;
drop policy if exists "users: admin read region"         on public.users;
drop policy if exists "users: doctor read self"          on public.users;
drop policy if exists "users: admin insert non-super"    on public.users;
drop policy if exists "users: admin update non-super"    on public.users;
drop policy if exists "users: superadmin insert"         on public.users;
drop policy if exists "users: superadmin delete"         on public.users;

create policy "users: superadmin full access"
  on public.users for all
  using  (public.claim('is_super_admin') = 'true')
  with check (public.claim('is_super_admin') = 'true');

create policy "users: admin read region"
  on public.users for select
  using (
    public.claim('role') = 'admin'
    and is_super_admin = false
    and deleted_at is null
    and (
      public.claim('is_super_admin') = 'true'
      or region = public.claim('region')
    )
  );

create policy "users: doctor read self"
  on public.users for select
  using (
    public.claim('role') = 'doctor'
    and id = auth.uid()
    and deleted_at is null
  );

create policy "users: admin insert non-super"
  on public.users for insert
  with check (
    public.claim('role') = 'admin'
    and is_super_admin = false
  );

create policy "users: admin update non-super"
  on public.users for update
  using  (public.claim('role') = 'admin' and is_super_admin = false)
  with check (public.claim('role') = 'admin' and is_super_admin = false);

-- ════════════════════════════════════════════════════════════════
-- HOSPITALS TABLE
-- ─────────────────────────────────────────────────────────────
-- • Any authenticated user can read hospitals (needed for dropdowns).
-- • Only admin+ can create/delete.
-- ════════════════════════════════════════════════════════════════

drop policy if exists "hospitals: authenticated read"   on public.hospitals;
drop policy if exists "hospitals: admin write"          on public.hospitals;
drop policy if exists "hospitals: superadmin delete"    on public.hospitals;

create policy "hospitals: authenticated read"
  on public.hospitals for select
  using (auth.role() = 'authenticated');

create policy "hospitals: admin write"
  on public.hospitals for insert
  with check (public.claim('role') = 'admin');

create policy "hospitals: superadmin delete"
  on public.hospitals for delete
  using (public.claim('is_super_admin') = 'true');

-- ════════════════════════════════════════════════════════════════
-- PATIENTS TABLE
-- ─────────────────────────────────────────────────────────────
-- • doctor:     see/edit only patients at their hospital
-- • admin:      see/edit patients in their region
-- • superadmin: everything
--
-- NOTE: soft-deleted rows (deleted_at IS NOT NULL) are always
-- invisible to doctors and admins. Superadmin can see them via a
-- separate policy or by calling a server function.
-- ════════════════════════════════════════════════════════════════

drop policy if exists "patients: doctor hospital scope"   on public.patients;
drop policy if exists "patients: admin region scope"      on public.patients;
drop policy if exists "patients: superadmin full"         on public.patients;

create policy "patients: doctor hospital scope"
  on public.patients for all
  using (
    public.claim('role') = 'doctor'
    and hospital = public.claim('hospital')
    and deleted_at is null
  )
  with check (
    public.claim('role') = 'doctor'
    and hospital = public.claim('hospital')
  );

create policy "patients: admin region scope"
  on public.patients for all
  using (
    public.claim('role') = 'admin'
    and region = public.claim('region')
    and deleted_at is null
  )
  with check (
    public.claim('role') = 'admin'
    and region = public.claim('region')
  );

create policy "patients: superadmin full"
  on public.patients for all
  using  (public.claim('is_super_admin') = 'true')
  with check (public.claim('is_super_admin') = 'true');

-- ════════════════════════════════════════════════════════════════
-- VISITS TABLE
-- ─────────────────────────────────────────────────────────────
-- Joins through patients for scope — if a patient is visible,
-- its visits are visible. We use a subquery for correctness
-- (avoids the policy referencing a different table directly).
-- ════════════════════════════════════════════════════════════════

drop policy if exists "visits: scoped via patients" on public.visits;

create policy "visits: scoped via patients"
  on public.visits for all
  using (
    exists (
      select 1 from public.patients p
      where  p.id = visits.patient_id
      -- The patients policies above apply here automatically.
      -- No need to re-state the scope — the row-level check
      -- on patients propagates via the subquery.
    )
  )
  with check (
    exists (
      select 1 from public.patients p
      where p.id = visits.patient_id
    )
  );

-- ════════════════════════════════════════════════════════════════
-- MEDICATIONS TABLE
-- ─────────────────────────────────────────────────────────────
-- Same pattern: scope via visits → patients.
-- ════════════════════════════════════════════════════════════════

drop policy if exists "medications: scoped via visits" on public.medications;

create policy "medications: scoped via visits"
  on public.medications for all
  using (
    exists (
      select 1 from public.visits v
      join   public.patients p on p.id = v.patient_id
      where  v.id = medications.visit_id
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      join   public.patients p on p.id = v.patient_id
      where  v.id = medications.visit_id
    )
  );

-- ════════════════════════════════════════════════════════════════
-- AUDIT LOG
-- ─────────────────────────────────────────────────────────────
-- No direct client reads or writes. Always written by Edge Functions
-- (service role key).  The anon/authenticated role gets nothing.
-- ════════════════════════════════════════════════════════════════

drop policy if exists "audit_log: no client access" on public.audit_log;

create policy "audit_log: no client access"
  on public.audit_log for all
  using (false);

-- ── REVOKE default public access from anon/authenticated roles ──
-- Belt-and-suspenders: even if RLS is accidentally disabled on a
-- table, the GRANT ensures no data leaks.
revoke all on public.users       from anon, authenticated;
revoke all on public.patients    from anon, authenticated;
revoke all on public.visits      from anon, authenticated;
revoke all on public.medications from anon, authenticated;
revoke all on public.audit_log   from anon, authenticated;

-- Re-grant exactly what each role legitimately needs.
-- Policies above then narrow it further per-row.
grant select, insert, update         on public.users        to authenticated;
grant select                         on public.hospitals     to authenticated;
grant insert                         on public.hospitals     to authenticated;
grant select, insert, update, delete on public.patients     to authenticated;
grant select, insert, update, delete on public.visits       to authenticated;
grant select, insert, update, delete on public.medications  to authenticated;
