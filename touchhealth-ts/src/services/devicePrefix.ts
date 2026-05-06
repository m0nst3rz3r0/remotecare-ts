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
// All devices at the same facility share the same hospital
// prefix (KG-BK-ZMZ), so they see ALL patients for that
// facility regardless of which device registered them.
// Collision is impossible because the device letter makes
// each sequence namespace unique.
//
// The prefix is set ONCE by admin/doctor in Settings and
// persisted in localStorage. It never changes unless manually
// reset (which would require re-coding patients — not allowed).
// ════════════════════════════════════════════════════════════

const DEVICE_PREFIX_KEY = 'th_device_prefix';

export type DevicePrefix = string; // single A–Z char

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
    throw new Error(`Device prefix must be a single letter A–Z, got: "${letter}"`);
  }
  localStorage.setItem(DEVICE_PREFIX_KEY, clean);
}

/** Clear the device prefix (admin-only, use with caution). */
export function clearDevicePrefix(): void {
  localStorage.removeItem(DEVICE_PREFIX_KEY);
}

/**
 * Returns true if the patient code belongs to this device.
 * Used to distinguish "my registrations" from "facility-wide" patients.
 */
export function isOwnDeviceCode(code: string, prefix: DevicePrefix | null): boolean {
  if (!prefix) return true; // legacy: no prefix set, own everything
  // Code format: RG-DT-HSP-{prefix}-G####
  const parts = code.split('-');
  // Device prefix occupies index 3 (0-based) in the new format
  return parts.length >= 5 && parts[3] === prefix;
}

/**
 * Build the location prefix including device letter.
 * New format: RG-DT-HSP-{DeviceLetter}
 * Legacy (no prefix set): RG-DT-HSP  (backwards-compatible)
 */
export function buildLocationPrefixWithDevice(
  locationPrefix: string,   // output of buildLocationPrefix() e.g. 'KG-BK-ZMZ'
  devicePrefix: DevicePrefix | null
): string {
  return devicePrefix ? `${locationPrefix}-${devicePrefix}` : locationPrefix;
}
