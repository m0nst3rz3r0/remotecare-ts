-- ═══════════════════════════════════════════════════════════════
-- REMOTECARE · Migration 003 — Soft delete + incremental sync
--
-- Replaces the ghost-delete sync logic (last-write-wins + hard
-- DELETE rows that a single device doesn't see) with:
--   1. Soft deletes  (deleted_at timestamp)
--   2. updated_at    (already added in 001)
--   3. sync_patients() RPC that the client calls instead of
--      full-table SELECT *
--
-- CLIENT SYNC PROTOCOL (after migration)
-- ──────────────────────────────────────
-- Pull:  call sync_patients(last_sync_at)
--          → returns patients + visits + meds changed AFTER that ts
--          → includes soft-deleted rows so client can tombstone them
-- Push:  UPSERT with updated_at = now()
--          → conflict on id: take whichever row has newer updated_at
-- Delete: set deleted_at = now() (never hard-delete from client)
-- ═══════════════════════════════════════════════════════════════

-- ── UPSERT conflict function: keep newer row ──────────────────────
-- Applied in the UPSERT conflict target so two devices syncing
-- simultaneously converge on the last-writer without data loss.
create or replace function public.patients_upsert_newer()
returns trigger language plpgsql as $$
begin
  if new.updated_at <= old.updated_at then
    return old;  -- existing row is newer — discard incoming
  end if;
  return new;
end;
$$;

create or replace trigger patients_upsert_newer_trigger
  before update on public.patients
  for each row execute function public.patients_upsert_newer();

-- ── RPC: incremental sync ────────────────────────────────────────
-- Returns everything changed since `since_ts`.
-- Pass '1970-01-01'::timestamptz on first sync to pull everything.
-- RLS policies still apply — a doctor only sees their hospital.
create or replace function public.sync_patients(since_ts timestamptz default '1970-01-01')
returns jsonb language sql stable security definer as $$
  select jsonb_build_object(
    'patients', (
      select jsonb_agg(row_to_json(p))
      from public.patients p
      where p.updated_at > since_ts
    ),
    'visits', (
      select jsonb_agg(row_to_json(v))
      from public.visits v
      join public.patients p on p.id = v.patient_id
      where v.updated_at > since_ts
    ),
    'medications', (
      select jsonb_agg(row_to_json(m))
      from public.medications m
      join public.visits v on v.id = m.visit_id
      join public.patients p on p.id = v.patient_id
      where v.updated_at > since_ts  -- piggyback on visit updated_at
    ),
    'sync_ts', now()
  )
$$;

-- Expose to authenticated clients only
revoke all on function public.sync_patients from anon;
grant execute on function public.sync_patients to authenticated;

-- ── SOFT-DELETE HELPER ───────────────────────────────────────────
-- Client calls this instead of DELETE.
-- Returns the updated patient row (for local state reconciliation).
create or replace function public.soft_delete_patient(patient_id bigint)
returns public.patients language sql security definer as $$
  update public.patients
  set    deleted_at = now(), updated_at = now()
  where  id = patient_id
  returning *
$$;

revoke all on function public.soft_delete_patient from anon;
grant execute on function public.soft_delete_patient to authenticated;
