// ════════════════════════════════════════════════════════════
// REMOTECARE · src/services/backup.ts
// Automated backup system
//
// SECURITY FIXES (v2.1)
// ─────────────────────────────────────────────────────────
// • User export strips password hashes — backup files no
//   longer allow offline dictionary attacks.
// • Phone numbers are stored as AES-GCM ciphertext in the
//   patients array; the backup preserves ciphertext only.
//   The decryption key is derived from facility identity
//   and is NOT stored anywhere — it is never exported.
// • Backup version bumped to 2.1 so restores can detect
//   old v2.0 files (which may contain hashes) and warn.
// ════════════════════════════════════════════════════════════

const BACKUP_META_KEY    = 'th_backup_meta';
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CURRENT_VERSION    = '2.1' as const;

export interface BackupMeta {
  lastBackupAt:   string | null;
  lastBackupSize: number;
  totalBackups:   number;
  nextBackupAt:   string | null;
}

export interface BackupData {
  version:      '2.0' | '2.1';
  exportedAt:   string;
  exportedBy:   string;
  organisation: 'RemoteCare Research Organisation';
  data: {
    patients:  unknown;
    users:     unknown;   // passwords always redacted in v2.1+
    hospitals: unknown;
    clinic:    unknown;
    smsLog:    unknown;
  };
}

// ── META ──────────────────────────────────────────────────────

export function loadBackupMeta(): BackupMeta {
  try {
    const raw = localStorage.getItem(BACKUP_META_KEY);
    return raw ? JSON.parse(raw) : defaultMeta();
  } catch {
    return defaultMeta();
  }
}

function defaultMeta(): BackupMeta {
  return { lastBackupAt: null, lastBackupSize: 0, totalBackups: 0, nextBackupAt: null };
}

function saveMeta(meta: BackupMeta): void {
  localStorage.setItem(BACKUP_META_KEY, JSON.stringify(meta));
}

// ── COLLECT DATA ──────────────────────────────────────────────

function safeRead(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Redact password hashes from user records before export.
 * Passwords are PBKDF2 hashes — not recoverable — but they
 * allow offline brute-force attacks.  Strip them entirely.
 * On restore, affected users will need a password reset.
 */
function sanitiseUsers(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((u: Record<string, unknown>) => ({
    ...u,
    password: '[redacted-for-security]',
  }));
}

/**
 * Redact phone field from SMS log entries.
 * The log stores the raw decrypted number at send-time —
 * mask to last 3 digits on export.
 */
function sanitiseSmsLog(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((entry: Record<string, unknown>) => {
    const phone = String(entry.phone ?? '');
    return {
      ...entry,
      phone: phone.length > 3
        ? '*'.repeat(phone.length - 3) + phone.slice(-3)
        : '***',
    };
  });
}

function collectAllData(exportedBy: string): BackupData {
  const rawUsers  = safeRead('th_users');
  const rawSmsLog = safeRead('th_sms_log');

  return {
    version:      CURRENT_VERSION,
    exportedAt:   new Date().toISOString(),
    exportedBy,
    organisation: 'RemoteCare Research Organisation',
    data: {
      patients:  safeRead('zmz2_pts'),           // ciphertext phones — safe
      users:     sanitiseUsers(rawUsers),         // passwords redacted
      hospitals: safeRead('th_hospitals'),
      clinic:    safeRead('th_clinic'),
      smsLog:    sanitiseSmsLog(rawSmsLog),       // phone numbers masked
    },
  };
}

// ── EXPORT (DOWNLOAD) ─────────────────────────────────────────

/**
 * Export all data as a downloadable JSON file.
 * Returns the file size in bytes.
 *
 * NOTE: Phones are stored as AES-GCM ciphertext inside the patients
 * array.  They are safe to export.  The decryption key is derived
 * from facility identity at runtime and is never stored or exported.
 */
export function exportBackup(exportedBy: string): number {
  const data     = collectAllData(exportedBy);
  const json     = JSON.stringify(data, null, 2);
  const bytes    = new TextEncoder().encode(json).length;
  const dateStr  = new Date().toISOString().slice(0, 10);
  const filename = `RemoteCare_Backup_${dateStr}.json`;

  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const meta = loadBackupMeta();
  const now  = new Date();
  const next = new Date(now.getTime() + BACKUP_INTERVAL_MS);
  saveMeta({
    lastBackupAt:   now.toISOString(),
    lastBackupSize: bytes,
    totalBackups:   meta.totalBackups + 1,
    nextBackupAt:   next.toISOString(),
  });

  return bytes;
}

// ── AUTO BACKUP ───────────────────────────────────────────────

/**
 * Check if a backup is due and trigger one automatically.
 * Call this on app startup — AFTER the user has logged in so
 * the displayName is available and the download is attributed.
 */
export function checkAutoBackup(exportedBy: string): boolean {
  const meta = loadBackupMeta();
  if (!meta.lastBackupAt) return false; // first session — skip

  const isDue =
    Date.now() - new Date(meta.lastBackupAt).getTime() > BACKUP_INTERVAL_MS;

  if (isDue) {
    exportBackup(exportedBy);
    return true;
  }
  return false;
}

/**
 * Schedule an auto-backup check every hour.
 * Returns a cleanup function — call it on component unmount.
 */
export function startAutoBackupScheduler(exportedBy: string): () => void {
  const interval = setInterval(() => {
    checkAutoBackup(exportedBy);
  }, 60 * 60 * 1000);
  return () => clearInterval(interval);
}

// ── RESTORE ───────────────────────────────────────────────────

export type RestoreResult =
  | { success: true;  message: string; counts: Record<string, number>; warnings: string[] }
  | { success: false; error: string };

/**
 * Restore data from a backup JSON file.
 *
 * v2.0 files: passwords were NOT redacted — restored users will
 *   have their hash restored but it still works for login.
 *   A warning is shown so the admin knows to reset passwords.
 *
 * v2.1+ files: passwords are '[redacted-for-security]'.
 *   Restored users must have passwords reset by a superadmin.
 */
export async function restoreFromFile(file: File): Promise<RestoreResult> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as BackupData;

    if (!data.version || !data.data) {
      return { success: false, error: 'Invalid backup file. Please use a RemoteCare backup file.' };
    }
    if (data.version !== '2.0' && data.version !== '2.1') {
      return { success: false, error: `Unsupported backup version: ${data.version}. Please update the app.` };
    }

    const warnings: string[] = [];
    if (data.version === '2.0') {
      warnings.push(
        'This backup was created before security hardening (v2.0). ' +
        'User passwords have been restored from hashes. ' +
        'Ask a superadmin to reset all passwords after restore.'
      );
    }

    const exportDate = new Date(data.exportedAt).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    const confirmMsg =
      `This will REPLACE all current data with the backup from ${exportDate}.\n\n` +
      `Exported by: ${data.exportedBy}\n\n` +
      `Are you sure you want to restore? This cannot be undone.`;

    if (!window.confirm(confirmMsg)) {
      return { success: false, error: 'Restore cancelled.' };
    }

    const counts: Record<string, number> = {};

    if (data.data.patients) {
      localStorage.setItem('zmz2_pts', JSON.stringify(data.data.patients));
      counts.patients = (data.data.patients as unknown[]).length;
    }
    if (data.data.users) {
      localStorage.setItem('th_users', JSON.stringify(data.data.users));
      counts.users = (data.data.users as unknown[]).length;
    }
    if (data.data.hospitals) {
      localStorage.setItem('th_hospitals', JSON.stringify(data.data.hospitals));
      counts.hospitals = (data.data.hospitals as unknown[]).length;
    }
    if (data.data.clinic) {
      localStorage.setItem('th_clinic', JSON.stringify(data.data.clinic));
    }
    if (data.data.smsLog) {
      localStorage.setItem('th_sms_log', JSON.stringify(data.data.smsLog));
    }

    return {
      success: true,
      message: `Restore successful. Data from ${exportDate} has been restored.`,
      counts,
      warnings,
    };
  } catch (e) {
    return { success: false, error: `Failed to restore: ${String(e)}` };
  }
}

// ── BACKUP STATUS ─────────────────────────────────────────────

export function backupStatus(): {
  isDue:           boolean;
  lastBackupAt:    string | null;
  nextBackupAt:    string | null;
  daysSinceBackup: number | null;
} {
  const meta = loadBackupMeta();
  if (!meta.lastBackupAt) {
    return { isDue: false, lastBackupAt: null, nextBackupAt: null, daysSinceBackup: null };
  }
  const daysSince = Math.floor(
    (Date.now() - new Date(meta.lastBackupAt).getTime()) / 86400000
  );
  return {
    isDue:           daysSince >= 1,
    lastBackupAt:    meta.lastBackupAt,
    nextBackupAt:    meta.nextBackupAt,
    daysSinceBackup: daysSince,
  };
}

// ── FORMAT HELPERS ────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
