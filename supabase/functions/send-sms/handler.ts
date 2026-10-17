import { cors, json } from '../_shared/http.ts';
import { smsContext, canAccess, publicEntry } from '../_shared/sms-context.ts';
import { callSMS8, maskPhone, readPatientPhone } from '../_shared/sms8.ts';

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { db, actor } = await smsContext(req);
    let body;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400);
    if (body.provider !== 'sms8') return json({ error: 'This provider adapter is not installed. Select SMS8 or deploy its server adapter.' }, 400);
    if (!Number.isSafeInteger(body.patientId) || body.patientId <= 0 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId ?? '') ||
        typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1600 ||
        !['en','sw'].includes(body.lang) || !['reminder','missed_appointment','ltfu_warning','welcome'].includes(body.reason) ||
        typeof body.deviceId !== 'string' || body.deviceId.length > 200 || (body.resendOverride !== undefined && typeof body.resendOverride !== 'boolean')) {
      return json({ error: 'Invalid patient, message, device, or request ID.' }, 400);
    }
    const { data: patient, error: patientError } = await db.from('patients').select('id,code,phone,region,district,hospital,status').eq('id', body.patientId).is('deleted_at', null).single();
    if (patientError || !patient || !canAccess(actor, patient) || patient.code !== body.patientCode) return json({ error: 'Sync this patient first, or check facility access.', code: 'PATIENT_NOT_SYNCED' }, 409);
    if (patient.status === 'discharged') return json({ error: 'Discharged patients cannot receive reminders.' }, 400);
    const { data: device } = await db.from('device_registry').select('id,prefix,facility_id').eq('id', body.deviceId).single();
    // Admins can select patients in other facilities. The originating device
    // must still be provisioned at a facility the actor is allowed to access.
    const { data: facilities } = await db.from('hospitals').select('name,region,district');
    const ownDevice = facilities?.some((h) => canAccess(actor, { ...h, hospital: h.name }) && device?.facility_id === `${h.region.toLowerCase()}_${h.district.toLowerCase()}_${h.name.toLowerCase().replace(/\s+/g, '_')}`);
    if (!device?.prefix || !ownDevice) return json({ error: 'Provision this device online before sending SMS.' }, 403);
    const key = Deno.env.get('SMS8_API_KEY');
    const deviceId = Deno.env.get('SMS8_DEVICE_ID');
    if (!key || !deviceId) return json({ error: 'SMS8 is not configured on the server.' }, 503);
    const phone = await readPatientPhone(patient);
    if (!phone) return json({ error: 'Patient phone number is invalid or cannot be decrypted.' }, 400);
    const message = body.message.includes(patient.hospital) ? body.message.trim() : `${patient.hospital}: ${body.message.trim()}`;
    if (message.length > 1600) return json({ error: 'Message is too long after adding the facility name.' }, 400);
    const { data: reservation, error: reserveError } = await db.rpc('reserve_sms', { payload: {
      id: body.requestId, patient_id: patient.id, patient_code: patient.code,
      region: patient.region, district: patient.district, hospital: patient.hospital,
      actor_id: actor.id, actor_name: actor.display_name, device_id: device.id, device_letter: device.prefix,
      phone_masked: maskPhone(phone), message, reason: body.reason, lang: body.lang, resend_override: body.resendOverride === true,
    } });
    if (reserveError) return json({ error: 'Could not reserve the SMS request. No submission was made.' }, 503);
    if (reservation.kind === 'conflict') return json({ error: 'Request ID already used for another message.' }, 409);
    if (reservation.kind === 'rate_limited') return json({ error: 'Gateway is busy. Wait one second and try again.', code: 'RATE_LIMITED' }, 429);
    if (reservation.kind !== 'reserved') return json({ entry: publicEntry(reservation.entry), duplicate: reservation.kind === 'duplicate' });
    const result = await callSMS8(key, {
      messages: JSON.stringify([{ number: phone, message, type: 'sms' }]),
      option: '0', devices: JSON.stringify([deviceId]),
    });
    const { data: saved, error: saveError } = await db.from('sms_requests').update({
      status: result.status, message_id: result.messageId ?? null, note: result.note ?? null, updated_at: new Date().toISOString(),
    }).eq('id', body.requestId).select().single();
    if (saveError || !saved) return json({ entry: publicEntry({ ...reservation.entry, status: 'unknown', message_id: result.messageId, note: 'Gateway contacted but status could not be saved. Do not resubmit.' }) });
    return json({ entry: publicEntry(saved) });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: 'SMS request interrupted. Check shared history before trying again.' }, 503);
  }
}
