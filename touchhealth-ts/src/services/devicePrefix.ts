// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · Device Prefix Service
// src/services/devicePrefix.ts
//
// PROBLEM: Two tablets at the same facility both generate
//   KG-BK-ZMZ-M0001 for the first male patient — collision.
//
// SOLUTION: Each device is assigned a single uppercase letter
//   (A–Z) that is embedded in the patient code:
//     KG-BK-ZMZ-A-M0001  (Device A)
//     KG-BK-ZMZ-B-M0001  (Device B)
//
// SHARED FACILITY VISIBILITY (important):
//   All devices at the same facility share the hospital prefix
//   (KG-BK-ZMZ), so after sync they ALL see every patient
//   regardless of which device registered them.  The device
//   letter ONLY creates separate sequence namespaces — it does
//   not restrict which patients a device can view or edit.
//
//   This means a doctor on Device B can open, update and sync
//   patients originally registered on Device A without any
//   extra permission logic.
//
// COLLISION PROOF:
//   Because each device owns its own letter-prefix sequence,
//   two devices can register patients simultaneously (even
//   without connectivity) and the codes will never collide.
//   When they sync, patients from both devices appear side by
//   side in the facility list.
//
// PERSISTENCE:
//   The prefix is set ONCE (by admin in Settings or
//   auto-assigned from cloud via deviceManager.ts) and stored
//   in localStorage.  It MUST NOT be changed after patients
//   have been registered — doing so would require re-coding
//   all existing patients, which is not supported.
// ════════════════════════════════════════════════════════════

const DEVICE_PREFIX_KEY = 'th_device_prefix';

export type DevicePrefix = string; // single A–Z char

// ── Read / Write ──────────────────────────────────────────────

/** Read the configured device prefix, or null if not yet set. */
export function getDevicePrefix(): DevicePrefix | null {
  return localStorage.getItem(DEVICE_PREFIX_KEY);
}

/**
 * Persist the device prefix.
 * @throws if prefix is not a single A–Z letter.
 */
export function setDevicePrefix(letter: string): void {
  const clean = letter.trim().toUpperCase();
  if (!/^[A-Z]$/.test(clean)) {
    throw new Error(
      `Device prefix must be a single letter A–Z, got: "${letter}"`
    );
  }
  localStorage.setItem(DEVICE_PREFIX_KEY, clean);
}

/** Clear the device prefix (admin-only; use with extreme caution). */
export function clearDevicePrefix(): void {
  localStorage.removeItem(DEVICE_PREFIX_KEY);
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Returns true if the patient code belongs to this specific device.
 * Used to distinguish "registered here" from "synced from another device".
 *
 * Note: even if this returns false, the patient is still fully
 * accessible — ownership tracking is informational only.
 */
export function isOwnDeviceCode(
  code: string,
  prefix: DevicePrefix | null
): boolean {
  if (!prefix) return true; // legacy: no prefix set, treat all as own
  // New format: RG-DT-HSP-{DeviceLetter}-G####
  const parts = code.split('-');
  return parts.length >= 5 && parts[3] === prefix;
}

/**
 * Build the full location prefix including the device letter.
 *
 * New format:    RG-DT-HSP-{DeviceLetter}   e.g. 'KG-BK-ZMZ-A'
 * Legacy format: RG-DT-HSP                  e.g. 'KG-BK-ZMZ'
 *
 * The legacy format (no device prefix) is still used for single-device
 * deployments and is fully supported by the code-generation logic.
 */
export function buildLocationPrefixWithDevice(
  locationPrefix: string,   // output of buildLocationPrefix() e.g. 'KG-BK-ZMZ'
  devicePrefix: DevicePrefix | null
): string {
  return devicePrefix ? `${locationPrefix}-${devicePrefix}` : locationPrefix;
}

/**
 * Parse the device letter from a patient code, if present.
 * Returns null for legacy codes without a device prefix.
 *
 * Examples:
 *   'KG-BK-ZMZ-A-M0001' → 'A'
 *   'KG-BK-ZMZ-M0001'   → null  (legacy)
 */
export function parseDeviceLetterFromCode(code: string): string | null {
  const parts = code.split('-');
  if (parts.length < 5) return null;
  const candidate = parts[3];
  return /^[A-Z]$/.test(candidate) ? candidate : null;
}

/**
 * Return a display label for a device prefix.
 * e.g. 'A' → 'Device A'  |  null → 'Default (no prefix)'
 */
export function devicePrefixLabel(prefix: DevicePrefix | null): string {
  return prefix ? `Device ${prefix}` : 'Default (no prefix)';
}
