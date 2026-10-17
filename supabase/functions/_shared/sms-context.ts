import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { json } from './http.ts';

export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function smsContext(req: Request) {
  const db = serviceClient();
  const bearer = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) throw json({ error: 'Sign in online before sending or refreshing SMS.' }, 401);
  const { data, error } = await db.auth.getUser(bearer);
  const appId = data.user?.app_metadata?.app_user_id;
  if (error || !appId) throw json({ error: 'Online session expired. Sign in again; your offline work is saved.' }, 401);
  const { data: actor, error: actorError } = await db.from('users').select('id,display_name,role,region,district,hospital,is_super_admin').eq('id', appId).is('deleted_at', null).single();
  if (actorError || !actor || !['doctor', 'admin'].includes(actor.role)) throw json({ error: 'Account access denied.' }, 403);
  return { db, actor };
}

export function canAccess(actor: { role: string; region: string; district: string; hospital: string; is_super_admin: boolean }, facility: { region: string; district: string; hospital: string }): boolean {
  return actor.is_super_admin || (actor.region === facility.region && (actor.role === 'admin' || (actor.role === 'doctor' && actor.district === facility.district && actor.hospital === facility.hospital)));
}

export function publicEntry(row: Record<string, unknown>) {
  return {
    id: row.id, ptId: Number(row.patient_id), ptCode: row.patient_code,
    phone: row.phone_masked, message: row.message, provider: row.provider,
    reason: row.reason, lang: row.lang, sentAt: row.created_at, status: row.status,
    hospital: row.hospital, note: row.note, messageId: row.message_id,
    sentBy: row.actor_name, deviceId: row.device_id, deviceLetter: row.device_letter,
  };
}
