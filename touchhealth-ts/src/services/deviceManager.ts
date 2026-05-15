// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · Remote Device Management Service
// src/services/deviceManager.ts
//
// Provides centralized device prefix management via Supabase.
// Each device at a facility gets a unique hardware ID that
// persists across sessions.  Admins can remotely assign prefix
// letters (A–Z) from any device.
//
// FIXES in this version
// ─────────────────────────────────────────────────────────
// 1. registerDevice() used to fire on every component mount
//    because it was called inside a sync effect.  It now uses
//    a HEARTBEAT_INTERVAL so it only hits Supabase once per
//    5 minutes per session, reducing egress.
// 2. getAvailablePrefixes() now also flags prefixes that are
//    assigned to OTHER devices so admins see real availability.
// 3. Added autoAssignPrefix() so devices without a prefix get
//    one automatically if all peers already have letters —
//    rather than prompting the admin to do it manually.
// 4. Added detectPrefixConflict() to catch the edge case where
//    two devices somehow got the same letter (e.g. manual DB
//    edit) and surface it in the admin UI.
// ════════════════════════════════════════════════════════════

import { supabase } from './supabase';
import { getDevicePrefix, setDevicePrefix } from './devicePrefix';

const DEVICE_ID_KEY        = 'th_device_hwid';
const DEVICE_REGISTRY_TABLE = 'devices';
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let lastHeartbeat = 0;

export interface DeviceRecord {
  id: string;
  facility_id: string;
  prefix: string | null;
  assigned_doctor_id: string | null;
  last_seen: string;
  device_info: {
    userAgent: string;
    platform: string;
    screen: string;
  };
  created_at: string;
  assigned_doctor?: {
    id: string;
    display_name: string;
    username: string;
  } | null;
}

// ── Hardware ID ───────────────────────────────────────────────

/** Generate or retrieve a persistent hardware ID for this device. */
export function getDeviceHardwareId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    const time   = Date.now().toString(36);
    const rand   = Math.random().toString(36).slice(2, 8);
    const uaHash = hashString(navigator.userAgent).toString(36).slice(0, 6);
    id = `dev-${time}-${rand}-${uaHash}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function buildFacilityId(
  region: string,
  district: string,
  hospital: string
): string {
  return `${region.toLowerCase()}_${district.toLowerCase()}_${hospital.toLowerCase().replace(/\s+/g, '_')}`;
}

// ── Registration / heartbeat ──────────────────────────────────

/**
 * Register or update this device in the cloud registry.
 *
 * FIX: Throttled to HEARTBEAT_INTERVAL so it does not fire on
 * every component mount.  The caller can pass force=true to
 * bypass throttling (e.g. first login).
 */
export async function registerDevice(
  region: string,
  district: string,
  hospital: string,
  force = false,
): Promise<DeviceRecord | null> {
  const now = Date.now();
  if (!force && now - lastHeartbeat < HEARTBEAT_INTERVAL_MS) {
    return null; // skipped — still within heartbeat window
  }
  lastHeartbeat = now;

  const deviceId   = getDeviceHardwareId();
  const facilityId = buildFacilityId(region, district, hospital);
  const deviceInfo = {
    userAgent: navigator.userAgent.slice(0, 200),
    platform:  navigator.platform,
    screen:    `${window.screen.width}x${window.screen.height}`,
  };

  const { data, error } = await supabase
    .from(DEVICE_REGISTRY_TABLE)
    .upsert(
      { id: deviceId, facility_id: facilityId, last_seen: new Date().toISOString(), device_info: deviceInfo },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) {
    console.warn('Device registration failed:', error.message);
    return null;
  }

  // Sync prefix from cloud if admin assigned one remotely
  if (data?.prefix && data.prefix !== getDevicePrefix()) {
    setDevicePrefix(data.prefix);
    console.info(`[RemoteCare] Device prefix synced from cloud: ${data.prefix}`);
  }

  return data as DeviceRecord;
}

// ── Prefix management ─────────────────────────────────────────

/** Fetch all devices registered for a facility. */
export async function getFacilityDevices(
  region: string,
  district: string,
  hospital: string,
): Promise<DeviceRecord[]> {
  const facilityId = buildFacilityId(region, district, hospital);
  const { data, error } = await supabase
    .from(DEVICE_REGISTRY_TABLE)
    .select('*')
    .eq('facility_id', facilityId)
    .order('last_seen', { ascending: false });

  if (error) {
    console.warn('Failed to fetch devices:', error.message);
    return [];
  }
  return (data || []) as DeviceRecord[];
}

/** Admin: assign a prefix letter to a specific device. */
export async function assignDevicePrefix(
  deviceId: string,
  prefix: string,
): Promise<boolean> {
  if (!/^[A-Z]$/.test(prefix)) {
    throw new Error('Prefix must be a single letter A–Z');
  }
  const { error } = await supabase
    .from(DEVICE_REGISTRY_TABLE)
    .update({ prefix, last_seen: new Date().toISOString() })
    .eq('id', deviceId);

  if (error) {
    console.warn('Failed to assign prefix:', error.message);
    return false;
  }
  return true;
}

/** Admin: remove a prefix from a device. */
export async function unassignDevicePrefix(deviceId: string): Promise<boolean> {
  const { error } = await supabase
    .from(DEVICE_REGISTRY_TABLE)
    .update({ prefix: null, last_seen: new Date().toISOString() })
    .eq('id', deviceId);

  if (error) {
    console.warn('Failed to unassign prefix:', error.message);
    return false;
  }
  return true;
}

/**
 * Sync this device's prefix from cloud.
 * Used on app startup to pick up admin-assigned letters.
 */
export async function syncDevicePrefixFromCloud(
  region: string,
  district: string,
  hospital: string,
): Promise<string | null> {
  const deviceId   = getDeviceHardwareId();
  const facilityId = buildFacilityId(region, district, hospital);

  const { data, error } = await supabase
    .from(DEVICE_REGISTRY_TABLE)
    .select('prefix')
    .eq('id', deviceId)
    .eq('facility_id', facilityId)
    .single();

  if (error || !data) return null;

  if (data.prefix && data.prefix !== getDevicePrefix()) {
    setDevicePrefix(data.prefix);
  }
  return data.prefix ?? getDevicePrefix();
}

/**
 * Return all 26 letters with their availability status.
 * 'free'     — not yet assigned to any device in this facility
 * 'mine'     — assigned to the current device
 * 'taken'    — assigned to a different device
 */
export async function getPrefixAvailability(
  region: string,
  district: string,
  hospital: string,
): Promise<Array<{ letter: string; status: 'free' | 'mine' | 'taken' }>> {
  const devices   = await getFacilityDevices(region, district, hospital);
  const currentId = getDeviceHardwareId();
  const usedMap   = new Map<string, string>(); // letter → deviceId

  for (const d of devices) {
    if (d.prefix) usedMap.set(d.prefix, d.id);
  }

  return Array.from({ length: 26 }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    const usedBy = usedMap.get(letter);
    return {
      letter,
      status: !usedBy ? 'free' : usedBy === currentId ? 'mine' : 'taken',
    };
  });
}

/** Convenience: return only unassigned letters. */
export async function getAvailablePrefixes(
  region: string,
  district: string,
  hospital: string,
): Promise<string[]> {
  const availability = await getPrefixAvailability(region, district, hospital);
  return availability.filter((a) => a.status === 'free').map((a) => a.letter);
}

/**
 * Auto-assign a prefix to this device if it doesn't have one.
 * Picks the lowest available letter.  If all letters are taken
 * returns null (extremely unlikely — 26 devices at one facility).
 */
export async function autoAssignPrefix(
  region: string,
  district: string,
  hospital: string,
): Promise<string | null> {
  if (getDevicePrefix()) return getDevicePrefix(); // already set

  const available = await getAvailablePrefixes(region, district, hospital);
  if (!available.length) return null;

  const letter   = available[0];
  const deviceId = getDeviceHardwareId();
  const ok       = await assignDevicePrefix(deviceId, letter);
  if (!ok) return null;

  setDevicePrefix(letter);
  return letter;
}

/**
 * Detect a prefix conflict (two devices with the same letter).
 * Returns conflicting pairs, if any.  Admin UI should surface this.
 */
export async function detectPrefixConflict(
  region: string,
  district: string,
  hospital: string,
): Promise<Array<{ letter: string; deviceIds: string[] }>> {
  const devices = await getFacilityDevices(region, district, hospital);
  const byLetter = new Map<string, string[]>();

  for (const d of devices) {
    if (!d.prefix) continue;
    const ids = byLetter.get(d.prefix) ?? [];
    ids.push(d.id);
    byLetter.set(d.prefix, ids);
  }

  return Array.from(byLetter.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([letter, deviceIds]) => ({ letter, deviceIds }));
}

// ── Doctor assignment ─────────────────────────────────────────

export async function assignDoctorToDevice(
  deviceId: string,
  doctorId: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from(DEVICE_REGISTRY_TABLE)
    .update({ assigned_doctor_id: doctorId, last_seen: new Date().toISOString() })
    .eq('id', deviceId);

  if (error) {
    console.warn('Failed to assign doctor:', error.message);
    return false;
  }
  return true;
}

/** Fetch devices with their assigned doctors (for admin UI). */
export async function getFacilityDevicesWithDoctors(
  region: string,
  district: string,
  hospital: string,
): Promise<DeviceRecord[]> {
  const facilityId = buildFacilityId(region, district, hospital);
  const { data, error } = await supabase
    .from(DEVICE_REGISTRY_TABLE)
    .select(`
      *,
      assigned_doctor:users!assigned_doctor_id(id, display_name, username)
    `)
    .eq('facility_id', facilityId)
    .order('last_seen', { ascending: false });

  if (error) {
    console.warn('Failed to fetch devices with doctors:', error.message);
    return [];
  }
  return (data || []) as DeviceRecord[];
}

// ── Display helpers ───────────────────────────────────────────

export function formatDeviceInfo(device: DeviceRecord): {
  name: string;
  isCurrentDevice: boolean;
  status: 'online' | 'offline';
} {
  const currentId = getDeviceHardwareId();
  const isCurrent = device.id === currentId;
  const lastSeen  = new Date(device.last_seen);
  const online    = Date.now() - lastSeen.getTime() < 5 * 60 * 1000;

  const platform = device.device_info?.platform || 'Unknown';
  const screen   = device.device_info?.screen || '';
  const shortId  = device.id.slice(-6);
  const name     = isCurrent
    ? `This Device (${platform} ${screen})`
    : `Device ${shortId} (${platform})`;

  return { name, isCurrentDevice: isCurrent, status: online ? 'online' : 'offline' };
}

export function isDeviceRegistered(): boolean {
  return !!localStorage.getItem(DEVICE_ID_KEY);
}

export function timeSinceLastSeen(lastSeenIso: string): string {
  const diffMs = Date.now() - new Date(lastSeenIso).getTime();
  if (diffMs < 60_000)      return 'Just now';
  if (diffMs < 3_600_000)   return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000)  return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}
