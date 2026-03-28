// ════════════════════════════════════════════════════════════
// REMOTECARE · src/services/crypto.ts
// Password hashing using Web Crypto API (built into all browsers)
// No npm packages needed — works fully offline
// PBKDF2 + SHA-256, 100,000 iterations
// ════════════════════════════════════════════════════════════

const ITERATIONS = 100_000;
const KEY_LENGTH  = 256;
const ALGORITHM   = 'SHA-256';

/**
 * Hash a plain-text password.
 * Returns a string in format: "pbkdf2:salt:hash"
 * Safe to store in localStorage.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt   = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = btoa(String.fromCharCode(...salt));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plain),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name:       'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash:       ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH,
  );

  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return `pbkdf2:${saltB64}:${hashB64}`;
}

/**
 * Verify a plain-text password against a stored hash.
 * Also returns true for legacy plain-text passwords (migration support).
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // Legacy plain-text password — still works during migration
  if (!stored.startsWith('pbkdf2:')) {
    return plain === stored;
  }

  const parts = stored.split(':');
  if (parts.length !== 3) return false;

  const [, saltB64, hashB64] = parts;
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plain),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name:       'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash:       ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH,
  );

  const computed = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return computed === hashB64;
}

/**
 * Check if a stored password is already hashed.
 * Used during migration to avoid double-hashing.
 */
export function isHashed(stored: string): boolean {
  return stored.startsWith('pbkdf2:');
}

/**
 * Migrate all plain-text passwords in localStorage to hashed versions.
 * Called once on app init. Safe to call multiple times.
 */
export async function migratePasswords(): Promise<void> {
  const USERS_KEY = 'th_users';
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return;

    const users = JSON.parse(raw) as Array<{ password: string; [key: string]: unknown }>;
    let changed = false;

    const updated = await Promise.all(
      users.map(async (u) => {
        if (!isHashed(u.password)) {
          changed = true;
          return { ...u, password: await hashPassword(u.password) };
        }
        return u;
      }),
    );

    if (changed) {
      localStorage.setItem(USERS_KEY, JSON.stringify(updated));
      console.info('[RemoteCare] Passwords migrated to PBKDF2 hashing.');
    }
  } catch (e) {
    console.error('[RemoteCare] Password migration failed:', e);
  }
}
