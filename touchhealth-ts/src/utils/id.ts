// ════════════════════════════════════════════════════════════
// REMOTECARE · src/utils/id.ts
// crypto.randomUUID() is only available in a secure context
// (HTTPS or localhost). On a clinic LAN served over plain HTTP
// it throws, which previously broke addUser()/addHospital().
// This helper falls back to a getRandomValues-based UUID v4.
// ════════════════════════════════════════════════════════════

export function randomUUID(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to manual generation
  }

  // RFC 4122 v4 via getRandomValues (works in non-secure contexts)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') +
    '-' + hex.slice(4, 6).join('') +
    '-' + hex.slice(6, 8).join('') +
    '-' + hex.slice(8, 10).join('') +
    '-' + hex.slice(10, 16).join('')
  );
}
