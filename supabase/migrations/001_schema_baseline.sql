-- ═══════════════════════════════════════════════════════════════
-- REMOTECARE · Migration 001 — baseline schema
-- Run once against a fresh project, OR read-only reference if tables
-- already exist.
-- ═══════════════════════════════════════════════════════════════

-- ── EXTENSIONS ──────────────────────────────────────────────────
create extension if not exists "pgcrypto";  -- gen_random_uuid(), crypt()

-- ── USERS ───────────────────────────────────────────────────────
create table if not exists public.users (
  id            uuid        primary key default gen_random_uuid(),
  username      text        not null unique,
  password      text        not null,          -- pbkdf2:salt:hash
  role          text        not null check (role in ('admin', 'doctor')),
  display_name  text        not null default '',
  hospital      text        not null default '',
  region        text        not null default '',
  district      text        not null default '',
  is_super_admin boolean    not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz           -- soft-delete (NULL = active)
);

-- ── HOSPITALS ───────────────────────────────────────────────────
create table if not exists public.hospitals (
  id        uuid  primary key default gen_random_uuid(),
  name      text  not null unique,
  region    text  not null default '',
  district  text  not null default ''
);

-- ── PATIENTS ────────────────────────────────────────────────────
create table if not exists public.patients (
  id         bigint      primary key,   -- Date.now() style, keep for backward compat
  code       text        not null,
  sex        text,
  age        int,
  cond       text,
  enrol      date,
  phone      text,                      -- "enc:v1:..." ciphertext
  address    text,
  status     text        not null default 'active',
  hospital   text        not null default '',
  region     text        not null default '',
  district   text        not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz               -- soft-delete
);

-- index for facility scoping
create index if not exists patients_hospital_idx on public.patients (hospital) where deleted_at is null;
create index if not exists patients_region_idx   on public.patients (region)   where deleted_at is null;

-- ── VISITS ──────────────────────────────────────────────────────
create table if not exists public.visits (
  id                   text        primary key,
  patient_id           bigint      not null references public.patients(id) on delete cascade,
  month                int,
  year                 int,
  date                 date,
  att                  boolean,
  sbp                  int,
  dbp                  int,
  sugar                numeric,
  sugar_type           text,
  weight               numeric,
  height               numeric,
  bmi                  numeric,
  notes                text        default '',
  presenting_complaint text,
  physical_exam        text,
  diagnoses            text[],
  investigations       jsonb,
  drug_warnings        text[],
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists visits_patient_idx on public.visits (patient_id);

-- ── MEDICATIONS ─────────────────────────────────────────────────
create table if not exists public.medications (
  id           bigserial   primary key,
  visit_id     text        not null references public.visits(id) on delete cascade,
  name         text        not null,
  dose         text,
  freq         text,
  instructions text,
  unique (visit_id, name)
);

-- ── AUDIT LOG ───────────────────────────────────────────────────
-- Append-only record of every mutation. Never expose to anon.
create table if not exists public.audit_log (
  id          bigserial   primary key,
  ts          timestamptz not null default now(),
  actor_id    uuid,        -- auth.uid() of the user making the change
  actor_name  text,        -- display name at time of action
  action      text        not null,  -- 'login' | 'create_patient' | 'update_visit' | …
  table_name  text,
  row_id      text,        -- id of the affected row (cast to text)
  old_data    jsonb,
  new_data    jsonb,
  facility    text         -- region||district||hospital for easy filtering
);

-- ── FUNCTION: updated_at trigger ────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger patients_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

create or replace trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create or replace trigger visits_updated_at
  before update on public.visits
  for each row execute function public.set_updated_at();

-- ── FUNCTION: ping (lightweight connectivity check) ─────────────
create or replace function public.ping()
returns boolean language sql security definer
as $$ select true $$;

grant execute on function public.ping() to anon;
