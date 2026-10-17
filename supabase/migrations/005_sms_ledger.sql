create table public.sms_requests (
  id uuid primary key,
  patient_code text not null,
  region text not null, district text not null, hospital text not null,
  actor_id uuid not null references public.users(id),
  actor_name text not null,
  device_id text not null references public.device_registry(id),
  device_letter text not null,
  phone_masked text not null,
  message text not null,
  provider text not null default 'sms8' check (provider = 'sms8'),
  reason text not null check (reason in ('reminder','missed_appointment','ltfu_warning','welcome')),
  lang text not null check (lang in ('en','sw')),
  status text not null default 'unknown' check (status in ('queued','sent','delivered','failed','unknown')),
  message_id text,
  note text,
  resend_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Preserve the actual patient ID type on older installations (text), as well
-- as the bigint baseline. No patient or visit IDs are converted or rewritten.
do $$
declare patient_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into patient_id_type
    from pg_attribute a
    where a.attrelid = 'public.patients'::regclass and a.attname = 'id' and not a.attisdropped;
  if patient_id_type is null then raise exception 'patients.id is missing'; end if;
  execute format('alter table public.sms_requests add column patient_id %s not null references public.patients(id)', patient_id_type);
end
$$;
create index sms_requests_patient_recent on public.sms_requests(patient_id,created_at desc);
alter table public.sms_requests enable row level security;
revoke all on public.sms_requests from anon, authenticated;
grant select on public.sms_requests to authenticated;
grant all on public.sms_requests to service_role;
create policy "sms: scoped history" on public.sms_requests for select to authenticated
  using (public.can_access_facility(region,district,hospital));

-- A service-only transactional reservation serializes concurrent requests,
-- enforces cross-device cooldown, and reserves an uncertain outcome BEFORE HTTP.
create or replace function public.reserve_sms(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare existing public.sms_requests; recent public.sms_requests;
begin
  perform pg_advisory_xact_lock(hashtextextended('sms:shared-gateway',0));
  select * into existing from sms_requests where id = (payload->>'id')::uuid;
  if found then
    if existing.patient_id::text <> payload->>'patient_id' or existing.actor_id::text <> payload->>'actor_id'
      or existing.message <> payload->>'message' or existing.reason <> payload->>'reason' or existing.lang <> payload->>'lang' then
      return jsonb_build_object('kind','conflict');
    end if;
    return jsonb_build_object('kind','existing','entry',to_jsonb(existing));
  end if;
  select * into recent from sms_requests where patient_id::text = payload->>'patient_id'
    and (status in ('queued','unknown') or (status in ('sent','delivered') and created_at > now()-interval '3 days'))
    order by created_at desc limit 1;
  if found and (recent.status in ('queued','unknown') or not coalesce((payload->>'resend_override')::boolean,false)) then
    return jsonb_build_object('kind','duplicate','entry',to_jsonb(recent));
  end if;
  if exists(select 1 from sms_requests where created_at > now()-interval '1 second') then
    return jsonb_build_object('kind','rate_limited');
  end if;
  insert into sms_requests(id, patient_id,patient_code,region,district,hospital,actor_id,actor_name,device_id,device_letter,phone_masked,message,reason,lang,resend_override,note)
  values ((payload->>'id')::uuid,(jsonb_populate_record(null::public.sms_requests,payload)).patient_id,payload->>'patient_code',payload->>'region',payload->>'district',payload->>'hospital',
    (payload->>'actor_id')::uuid,payload->>'actor_name',payload->>'device_id',payload->>'device_letter',payload->>'phone_masked',payload->>'message',payload->>'reason',payload->>'lang',
    coalesce((payload->>'resend_override')::boolean,false),'Submission reserved; acceptance not yet confirmed.') returning * into existing;
  return jsonb_build_object('kind','reserved','entry',to_jsonb(existing));
end
$$;
revoke all on function public.reserve_sms(jsonb) from public, anon, authenticated;
grant execute on function public.reserve_sms(jsonb) to service_role;
