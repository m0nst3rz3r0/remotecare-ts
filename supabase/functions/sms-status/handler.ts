import { cors, json } from '../_shared/http.ts';
import { smsContext, canAccess, publicEntry } from '../_shared/sms-context.ts';
import { callSMS8 } from '../_shared/sms8.ts';

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { db, actor } = await smsContext(req);
    let body;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400);
    const key = Deno.env.get('SMS8_API_KEY');
    // Empty request returns sender metadata only, never credentials/device IDs.
    if (!body.requestId) return json({ senderNumber: Deno.env.get('SMS8_SENDER_NUMBER') ?? '', configured: !!key && !!Deno.env.get('SMS8_DEVICE_ID') });
    if (typeof body.requestId !== 'string') return json({ error: 'Invalid request ID' }, 400);
    const { data: entry, error } = await db.from('sms_requests').select('*').eq('id', body.requestId).single();
    if (error || !entry || !canAccess(actor, entry)) return json({ error: 'Message not found or facility access denied.' }, 404);
    if (!key) return json({ error: 'SMS8 is not configured.' }, 503);
    if (!entry.message_id || ['delivered','failed'].includes(entry.status)) return json({ entry: publicEntry(entry) });
    const result = await callSMS8(key, { 'ids[]': entry.message_id }, true);
    // A read failure must not turn a previously accepted message into a failure.
    if (!result.messageId) return json({ entry: publicEntry(entry), warning: result.note ?? 'Status refresh unavailable.' });
    const rank = { unknown: 0, queued: 1, sent: 2, delivered: 3, failed: 3 };
    const status = rank[result.status] >= (rank[entry.status as keyof typeof rank] ?? 0) ? result.status : entry.status;
    const { data: saved, error: saveError } = await db.from('sms_requests').update({ status, note: result.note ?? null, updated_at: new Date().toISOString() }).eq('id', entry.id).eq('status', entry.status).select().maybeSingle();
    if (saveError) return json({ error: 'Could not save refreshed status.' }, 503);
    if (!saved) {
      const { data: current } = await db.from('sms_requests').select('*').eq('id', entry.id).single();
      return json({ entry: publicEntry(current ?? entry) });
    }
    return json({ entry: publicEntry(saved) });
  } catch (error) {
    return error instanceof Response ? error : json({ error: 'Status refresh failed; no SMS was submitted.' }, 503);
  }
}
