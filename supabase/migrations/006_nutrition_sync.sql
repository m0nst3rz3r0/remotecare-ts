-- Additive nutrition storage; patient/visit ID columns are never converted.
alter table public.patients add column if not exists nutrition_profile jsonb;
alter table public.patients add column if not exists nutrition_revision bigint not null default 0;
alter table public.visits add column if not exists meal_plan jsonb;

-- Revision changes must not be discarded by the legacy timestamp trigger.
create or replace function public.patients_upsert_newer()
returns trigger language plpgsql as $$
begin
  if new.updated_at <= old.updated_at and new.nutrition_revision = old.nutrition_revision then return old; end if;
  return new;
end;
$$;

-- Nutrition writes must use the revision-checked RPC. Keep ordinary clinical
-- columns writable under their existing RLS policies.
do $$
declare columns text;
begin
  select string_agg(quote_ident(attname), ',') into columns from pg_attribute
    where attrelid = 'public.patients'::regclass and attnum > 0 and not attisdropped
      and attname not in ('nutrition_profile','nutrition_revision');
  revoke insert, update on public.patients from authenticated;
  execute format('grant insert (%s), update (%s) on public.patients to authenticated', columns, columns);
  select string_agg(quote_ident(attname), ',') into columns from pg_attribute
    where attrelid = 'public.visits'::regclass and attnum > 0 and not attisdropped and attname <> 'meal_plan';
  revoke insert, update on public.visits from authenticated;
  execute format('grant insert (%s), update (%s) on public.visits to authenticated', columns, columns);
end
$$;

create or replace function public.sync_nutrition(patient_key text, expected_revision bigint, profile jsonb, plans jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.patients; current_plans jsonb; item record; old_plan jsonb; next_revision bigint;
begin
  if auth.uid() is null then raise exception 'Online authentication required'; end if;
  if expected_revision is null or expected_revision < 0 or jsonb_typeof(plans) is distinct from 'object'
    or (profile is not null and jsonb_typeof(profile) <> 'object') then raise exception 'Invalid nutrition payload'; end if;
  select * into p from public.patients where id::text = patient_key and deleted_at is null for update;
  if not found or not coalesce(public.can_access_facility(p.region,p.district,p.hospital),false) then raise exception 'Patient access denied'; end if;
  select coalesce(jsonb_object_agg(v.id::text, v.meal_plan),'{}'::jsonb) into current_plans
    from public.visits v where v.patient_id::text = patient_key and v.meal_plan is not null;
  if p.nutrition_profile is not distinct from profile and current_plans = plans then
    return jsonb_build_object('applied',true,'revision',p.nutrition_revision,'profile',p.nutrition_profile,'plans',current_plans);
  end if;
  if p.nutrition_revision <> expected_revision then
    return jsonb_build_object('applied',false,'revision',p.nutrition_revision,'profile',p.nutrition_profile,'plans',current_plans);
  end if;
  -- Full snapshot submission cannot silently remove an older plan.
  if exists(select 1 from jsonb_object_keys(current_plans) k where not plans ? k) then raise exception 'Existing plans must be preserved'; end if;
  for item in select key, value from jsonb_each(plans) loop
    if jsonb_typeof(item.value) <> 'object' or not exists(select 1 from public.visits v where v.id::text = item.key and v.patient_id::text = patient_key) then raise exception 'Sync the visit before its nutrition plan'; end if;
    old_plan := current_plans -> item.key;
    if not (coalesce(item.value->'history','[]'::jsonb) @> coalesce(old_plan->'history','[]'::jsonb)) then raise exception 'Preserve previous approved history'; end if;
    if old_plan->'approval' is not null and old_plan->'approval' <> 'null'::jsonb and old_plan is distinct from item.value
      and not (coalesce(item.value->'history','[]'::jsonb) @> jsonb_build_array(old_plan - 'history')) then raise exception 'Preserve the previous approved plan snapshot'; end if;
    if item.value->'approval' is not null and item.value->'approval' <> 'null'::jsonb
      and item.value->'approval' is distinct from old_plan->'approval'
      and item.value->'approval'->>'accountId' is distinct from public.claim('app_user_id') then raise exception 'Approval must identify the signed-in account'; end if;
    update public.visits set meal_plan = item.value where id::text = item.key and patient_id::text = patient_key;
  end loop;
  next_revision := p.nutrition_revision + 1;
  update public.patients set nutrition_profile = profile, nutrition_revision = next_revision where id::text = patient_key;
  return jsonb_build_object('applied',true,'revision',next_revision,'profile',profile,'plans',plans);
end
$$;
revoke all on function public.sync_nutrition(text,bigint,jsonb,jsonb) from public, anon;
grant execute on function public.sync_nutrition(text,bigint,jsonb,jsonb) to authenticated;
