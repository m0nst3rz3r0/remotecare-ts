// ════════════════════════════════════════════════════════════
// REMOTECARE · src/utils/html.ts
// HTML escaping for any string interpolated into a raw HTML
// document (print/export windows opened via document.write).
//
// Patient-entered data (names, notes, medication names, food
// names) flows into these templates. Without escaping, a value
// like `<img src=x onerror=…>` would execute script in the
// print window. Always wrap interpolated values with escapeHtml().
// ════════════════════════════════════════════════════════════

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a value for safe interpolation into HTML text/attributes. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
