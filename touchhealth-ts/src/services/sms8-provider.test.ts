import { describe, expect, it, vi } from 'vitest';
import { callSMS8, normalizePhone, parseSMS8, readPatientPhone } from '../../../supabase/functions/_shared/sms8';
import { encryptPhone } from './phoneEncryption';

describe('SMS8 gateway contract', () => {
  it('normalizes Tanzanian local numbers and rejects invalid recipients', () => {
    expect(normalizePhone('0744 123 456')).toBe('+255744123456');
    expect(normalizePhone('255744123456')).toBe('+255744123456');
    expect(normalizePhone('00255744123456')).toBe('+255744123456');
    expect(normalizePhone('+255744123456')).toBe('+255744123456');
    expect(normalizePhone('not a number')).toBeNull();
    expect(normalizePhone('0744123')).toBeNull();
    expect(normalizePhone('+255744123')).toBeNull();
  });

  it('reads existing encrypted records without changing them', async () => {
    const phone = await encryptPhone('0744123456', 'Kagera', 'Bukoba', 'Clinic');
    expect(await readPatientPhone({ phone: phone ?? null, region: 'Kagera', district: 'Bukoba', hospital: 'Clinic' })).toBe('+255744123456');
    expect(await readPatientPhone({ phone: phone ?? null, region: 'Kagera', district: 'Bukoba', hospital: 'Other' })).toBeNull();
  });

  it('accepts both documented envelopes and preserves queued versus delivered', () => {
    expect(parseSMS8({ success: true, data: [{ ID: 1, status: 'Pending' }] })).toEqual({ status: 'queued', messageId: '1', note: undefined });
    expect(parseSMS8({ success: true, data: { messages: [{ ID: 1, status: 'Delivered' }] } })).toMatchObject({ status: 'delivered', messageId: '1' });
    expect(parseSMS8({ success: false, error: { message: 'Rejected' } }).status).toBe('failed');
    expect(parseSMS8({ success: true, data: [] }).status).toBe('unknown');
    expect(parseSMS8({ success: true, data: [{ ID: 2, status: 'Sent' }] }, '1').status).toBe('unknown');
  });

  it('sends form-encoded JSON messages through one fixed device', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [{ ID: 8, status: 'Pending' }] })));
    const messages = JSON.stringify([{ number: '+255744123456', message: 'Clinic: hello', type: 'sms' }]);
    expect(await callSMS8('secret', { messages, option: '0', devices: '["12"]' }, false, fetcher)).toMatchObject({ status: 'queued', messageId: '8' });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://app.sms8.io/api/v1/messages');
    const form = options?.body as URLSearchParams;
    expect(form.get('key')).toBe('secret');
    expect(form.get('messages')).toBe(messages);
    expect(form.get('devices')).toBe('["12"]');
  });

  it('never retries timeouts, malformed responses, or HTTP failures', async () => {
    for (const response of [new Response('broken'), new Response('unavailable', { status: 503 })]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      expect((await callSMS8('secret', {}, false, fetcher)).status).toBe('unknown');
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));
    expect((await callSMS8('secret', {}, false, fetcher)).status).toBe('unknown');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
