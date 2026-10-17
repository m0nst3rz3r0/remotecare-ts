-- Authorization comes from the server-mapped app identity, never user_metadata.
create or replace function public.current_user_claims()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object(
    'app_user_id', u.id, 'role', u.role, 'hospital', u.hospital,
    'region', u.region, 'district', u.district, 'is_super_admin', u.is_super_admin
  ) from public.users u
    where u.id::text = auth.jwt()->'app_metadata'->>'app_user_id'
      and u.deleted_at is null), '{}'::jsonb)
$$;

-- Offline verifiers are created locally after login; server password hashes
-- are not part of user-directory synchronization.
revoke select on public.users from authenticated;
grant select (id,username,role,display_name,hospital,region,district,is_super_admin,created_at,updated_at,deleted_at)
  on public.users to authenticated;

drop policy if exists "users: doctor read self" on public.users;
create policy "users: doctor read self" on public.users for select to authenticated
  using (public.claim('role') = 'doctor' and id::text = public.claim('app_user_id') and deleted_at is null);
drop policy if exists "users: admin insert non-super" on public.users;
create policy "users: admin insert non-super" on public.users for insert to authenticated
  with check (public.claim('role') = 'admin' and region = public.claim('region') and role = 'doctor' and not is_super_admin);
drop policy if exists "users: admin update non-super" on public.users;
create policy "users: admin update non-super" on public.users for update to authenticated
  using (public.claim('role') = 'admin' and region = public.claim('region') and role = 'doctor' and not is_super_admin)
  with check (public.claim('role') = 'admin' and region = public.claim('region') and role = 'doctor' and not is_super_admin);

-- Facility names alone need not be globally unique; scope doctors by all three.
drop policy if exists "patients: doctor hospital scope" on public.patients;
create policy "patients: doctor hospital scope" on public.patients for all to authenticated
  using (public.claim('role') = 'doctor' and hospital = public.claim('hospital') and region = public.claim('region') and district = public.claim('district') and deleted_at is null)
  with check (public.claim('role') = 'doctor' and hospital = public.claim('hospital') and region = public.claim('region') and district = public.claim('district'));

-- SECURITY DEFINER bypassed RLS in these earlier RPCs.
alter function public.sync_patients(timestamptz) security invoker;
alter function public.soft_delete_patient(bigint) security invoker;
revoke all on function public.sync_patients(timestamptz) from public, anon;
revoke all on function public.soft_delete_patient(bigint) from public, anon;
grant execute on function public.sync_patients(timestamptz) to authenticated;
grant execute on function public.soft_delete_patient(bigint) to authenticated;

create table if not exists public.device_registry (
  id text primary key,
  facility_id text not null,
  prefix text check (prefix ~ '^[A-Z]$'),
  device_info jsonb not null default '{}'::jsonb,
  assigned_doctor_id uuid references public.users(id),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists device_registry_facility_prefix_unique
  on public.device_registry(facility_id, prefix) where prefix is not null;
alter table public.device_registry enable row level security;

create or replace function public.can_access_facility(r text, d text, h text)
returns boolean language sql stable as $$
  select public.claim('is_super_admin') = 'true'
    or (public.claim('role') = 'admin' and r = public.claim('region'))
    or (public.claim('role') = 'doctor' and r = public.claim('region') and d = public.claim('district') and h = public.claim('hospital'))
$$;

-- Register/allocate under a facility lock so simultaneous provisioning cannot
-- give two devices the same letter. Never replace a previously assigned letter.
create or replace function public.provision_device(device_id text, r text, d text, h text, info jsonb default '{}'::jsonb, existing_prefix text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  facility text := lower(r) || '_' || lower(d) || '_' || regexp_replace(lower(h), '\s+', '_', 'g');
  letter text;
begin
  if auth.uid() is null or not coalesce(public.can_access_facility(r,d,h), false) then raise exception 'Facility access denied'; end if;
  if length(device_id) < 1 or length(device_id) > 200 then raise exception 'Invalid device ID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('device-id:' || device_id, 0));
  perform pg_advisory_xact_lock(hashtextextended('device:' || facility, 0));
  if exists(select 1 from device_registry where id = device_id and facility_id <> facility) then raise exception 'Device already provisioned for another facility'; end if;
  select prefix into letter from device_registry where id = device_id;
  if letter is null then
    if existing_prefix is not null then
      if existing_prefix !~ '^[A-Z]$' then raise exception 'Invalid device letter'; end if;
      letter := existing_prefix;
    else
      select chr(n) into letter from generate_series(65,90) n where not exists
        (select 1 from device_registry where facility_id = facility and prefix = chr(n)) order by n limit 1;
    end if;
    if letter is null then raise exception 'All device letters are allocated'; end if;
  elsif existing_prefix is not null and letter <> existing_prefix then
    raise exception 'Existing device letter differs; resolve before syncing';
  end if;
  insert into device_registry(id, facility_id, prefix, device_info) values(device_id, facility, letter, info)
    on conflict (id) do update set last_seen = now(), device_info = excluded.device_info, prefix = excluded.prefix;
  return letter;
end
$$;
revoke all on function public.provision_device(text,text,text,text,jsonb,text) from public, anon;
grant execute on function public.provision_device(text,text,text,text,jsonb,text) to authenticated;

-- Only provision_device writes device identity/letters. Existing admin device
-- assignment screens can still update assigned_doctor_id within their region.
revoke all on public.device_registry from anon, authenticated;
grant select on public.device_registry to authenticated;
grant all on public.device_registry to service_role;
grant update (assigned_doctor_id, last_seen) on public.device_registry to authenticated;
drop policy if exists "devices: scoped read" on public.device_registry;
create policy "devices: scoped read" on public.device_registry for select to authenticated using (
  public.claim('is_super_admin') = 'true' or exists (
    select 1 from public.hospitals h where facility_id = lower(h.region)||'_'||lower(h.district)||'_'||regexp_replace(lower(h.name),'\s+','_','g')
      and public.can_access_facility(h.region,h.district,h.name)));
drop policy if exists "devices: admin assignment" on public.device_registry;
create policy "devices: admin assignment" on public.device_registry for update to authenticated
  using (public.claim('role') = 'admin' and (public.claim('is_super_admin') = 'true' or exists (
    select 1 from public.hospitals h where h.region = public.claim('region') and facility_id = lower(h.region)||'_'||lower(h.district)||'_'||regexp_replace(lower(h.name),'\s+','_','g'))))
  with check (public.claim('role') = 'admin');
