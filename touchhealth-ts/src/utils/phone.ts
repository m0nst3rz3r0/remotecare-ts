// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · Phone Privacy Utilities
// src/utils/phone.ts
//
// Phones are sensitive PII. In the UI we show a masked form.
// The raw number is stored in localStorage/Supabase and is
// ONLY accessed by the SMS service at send time.
//
// Masking rules (Tanzanian +255 or 0XXX format):
//   +255 744 123 456  →  +255 *** *** 456
//   0744123456        →  074*****456
// ════════════════════════════════════════════════════════════

/**
 * Mask a phone number for display.
 * Always keeps the last 3 digits visible so staff can
 * confirm the right patient without exposing the full number.
 */
export function maskPhone(phone: string | undefined): string {
  if (!phone) return '—';
  const t = phone.trim();

  // International format: +255 7XX XXX XXX  (15 chars)
  const intl = t.match(/^(\+255\s?)(\d{3})\s?(\d{3})\s?(\d{3})$/);
  if (intl) {
    return `${intl[1]}*** *** ${intl[4]}`;
  }

  // Local 10-digit: 07XXXXXXXX
  const local = t.match(/^(0\d{2})(\d+)(\d{3})$/);
  if (local) {
    const hidden = '*'.repeat(local[2].length);
    return `${local[1]}${hidden}${local[3]}`;
  }

  // Fallback: hide everything except last 3
  if (t.length <= 3) return t;
  return '*'.repeat(t.length - 3) + t.slice(-3);
}

/**
 * Placeholder shown in search inputs — reminds user that
 * full phone search still works (matching on raw data).
 */
export const PHONE_SEARCH_HINT = 'Search code or last 3 digits of phone…';
