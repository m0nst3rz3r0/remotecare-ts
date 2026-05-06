// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · Remote Device Management Service
// src/services/deviceManager.ts
//
// Provides centralized device prefix management via Supabase.
// Each device gets a unique hardware ID that persists across sessions.
// Admins can remotely assign prefixes (A-Z) to devices from any device.
// ════════════════════════════════════════════════════════════

import { supabase } from './supabase';
import { getDevicePrefix, setDevicePrefix } from './devicePrefix';

const DEVICE_ID_KEY = 'th_device_hwid';
const DEVICE_REGISTRY_TABLE = 'devices';

export interface DeviceRecord {
  id: string;
  facility_id: string;
  prefix: string | null;
  last_seen: string;
  device_info: {
    userAgent: string;
    platform: string;
    screen: string;
  };
  created_at: string;
}

/** Generate or retrieve persistent hardware ID for this device */
export function getDeviceHardwareId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    const time = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    const uaHash = hashString(navigator.userAgent).toString(36).slice(0, 6);
    id = `dev-${time}-${rand}-${uaHash}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function buildFacilityId(region: string, district: string, hospital: string): string {
  return `${region.toLowerCase()}_${district.toLowerCase()}_${hospital.toLowerCase().replace(/\s+/g, '_')}`;
}

/** Register or update this device in the cloud registry */
export async function registerDevice(
  region: string,
  district: string,
  hospital: string
): Promise<DeviceRecord | null> {
  const deviceId = getDeviceHardwareId();
  const facilityId = buildFacilityId(region, district, hospital);

  const deviceInfo = {
    userAgent: navigator.userAgent.slice(0, 200),
    platform: navigator.platform,
    screen: `${window.screen.width}x${window.screen.height}`,
  };

  const record = {
    id: deviceId,
    facility_id: facilityId,
    last_seen: new Date().toISOString(),
    device_info: deviceInfo,
  };

  const { data, error } = await supabase
    .from(DEVICE_REGISTRY_TABLE)
    .upsert(record, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Device registration failed:', error);
    return null;
  }

  if (data?.prefix && data.prefix !== getDevicePrefix()) {
    setDevicePrefix(data.prefix);
    console.log(`Device prefix synced from cloud: ${data.prefix}`);
  }

  return data as DeviceRecord;
}

/** Fetch all devices for a facility */
export async function getFacilityDevices(
  region: string,
  district: string,
  hospital: string
): Promise<DeviceRecord[]> {
  const facilityId = buildFacilityId(region, district, hospital);

  const { data, error } = await supabase
    .from(DEVICE_REGISTRY_TABLE)
    .select('*')
    .eq('facility_id', facilityId)
    .order('last_seen', { ascending: false });

  if (error) {
    console.error('Failed to fetch devices:', error);
    return [];
  }

  return (data || []) as DeviceRecord[];
}

/** Admin: assign prefix to a specific device */
export async function assignDevicePrefix(deviceId: string, prefix: string): Promise<boolean> {
  if (!/^[A-Z]$/.test(prefix)) {
    throw new Error('Prefix must be single letter A-Z');
  }

  const { error } = await supabase
    .from(DEVICE_REGISTRY_TABLE)
    .update({ prefix, last_seen: new Date().toISOString() })
    .eq('id', deviceId);

  if (error) {
    console.error('Failed to assign prefix:', error);
    return false;
  }

  return true;
}

/** Admin: remove prefix from a device */
export async function unassignDevicePrefix(deviceId: string): Promise<boolean> {
  const { error } = await supabase
    .from(DEVICE_REGISTRY_TABLE)
    .update({ prefix: null, last_seen: new Date().toISOString() })
    .eq('id', deviceId);

  if (error) {
    console.error('Failed to unassign prefix:', error);
    return false;
  }

  return true;
}

/** Sync device prefix from cloud */
export async function syncDevicePrefixFromCloud(
  region: string,
  district: string,
  hospital: string
): Promise<string | null> {
  const deviceId = getDeviceHardwareId();
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
    return data.prefix;
  }

  return getDevicePrefix();
}

/** Get available letters */
export async function getAvailablePrefixes(
  region: string,
  district: string,
  hospital: string
): Promise<string[]> {
  const devices = await getFacilityDevices(region, district, hospital);
  const used = new Set(devices.map(d => d.prefix).filter(Boolean));
  const all = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  return all.filter(letter => !used.has(letter));
}

/** Format device info for display */
export function formatDeviceInfo(device: DeviceRecord): {
  name: string;
  isCurrentDevice: boolean;
  status: 'online' | 'offline' | 'unknown';
} {
  const currentId = getDeviceHardwareId();
  const isCurrent = device.id === currentId;

  const lastSeen = new Date(device.last_seen);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const status = lastSeen > fiveMinutesAgo ? 'online' : 'offline';

  const platform = device.device_info?.platform || 'Unknown';
  const screen = device.device_info?.screen || '';
  const shortId = device.id.slice(-6);

  const name = isCurrent
    ? `This Device (${platform} ${screen})`
    : `Device ${shortId} (${platform})`;

  return { name, isCurrentDevice: isCurrent, status };
}

/** Check if current device is registered */
export function isDeviceRegistered(): boolean {
  return !!localStorage.getItem(DEVICE_ID_KEY);
}

/** Get time since last seen in human readable format */
export function timeSinceLastSeen(lastSeenIso: string): string {
  const lastSeen = new Date(lastSeenIso);
  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();

  if (diffMs < 60000) return 'Just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}
