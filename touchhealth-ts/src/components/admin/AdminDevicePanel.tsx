import React, { useState } from 'react';
import type { User } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { getDevicePrefix, setDevicePrefix } from '../../services/devicePrefix';
import {
  getFacilityDevicesWithDoctors,
  assignDevicePrefix,
  unassignDevicePrefix,
  assignDoctorToDevice,
  formatDeviceInfo,
  timeSinceLastSeen,
  getAvailablePrefixes,
  type DeviceRecord,
} from '../../services/deviceManager';

export default function AdminDevicePanel({ users }: { users: User[] }) {
  const currentUser = useAuthStore((s) => s.currentUser);

  const [dpValue, setDpValue] = useState(() => getDevicePrefix() ?? '');
  const [dpErr, setDpErr] = useState<string | null>(null);
  const [dpOk, setDpOk] = useState<string | null>(null);
  const savedPrefix = getDevicePrefix();

  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceErr, setDeviceErr] = useState<string | null>(null);
  const [availablePrefixes, setAvailablePrefixes] = useState<string[]>([]);

  const loadDevices = async () => {
    if (!currentUser?.sessionRegion || !currentUser?.sessionDistrict || !currentUser?.sessionHospital) return;
    setDeviceLoading(true);
    setDeviceErr(null);
    try {
      const facilityDevices = await getFacilityDevicesWithDoctors(
        currentUser.sessionRegion,
        currentUser.sessionDistrict,
        currentUser.sessionHospital,
      );
      setDevices(facilityDevices);
      const available = await getAvailablePrefixes(
        currentUser.sessionRegion,
        currentUser.sessionDistrict,
        currentUser.sessionHospital,
      );
      setAvailablePrefixes(available);
    } catch (e) {
      setDeviceErr(e instanceof Error ? e.message : 'Failed to load devices');
    } finally {
      setDeviceLoading(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <div className="font-sans font-bold text-slate-800 text-[13px] mb-1 flex items-center gap-2">
          <span>Device Prefix</span>
          {savedPrefix && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              Active: <span className="font-mono">{savedPrefix}</span>
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
          Assign a unique letter (A-Z) to this device so patient codes never collide with a second tablet at the same facility.
          <strong> Example:</strong> Device A generates <code className="bg-slate-100 px-1 rounded">KG-BK-ZMZ-A-M0001</code>,
          Device B generates <code className="bg-slate-100 px-1 rounded">KG-BK-ZMZ-B-M0001</code>.
          Both devices still see <em>all</em> patients at the facility.
        </p>
        {dpErr && <div className="text-[11px] text-red-600 font-semibold mb-2">{dpErr}</div>}
        {dpOk && <div className="text-[11px] text-emerald-700 font-semibold mb-2">{dpOk}</div>}
        <div className="flex items-center gap-3">
          <input
            type="text"
            maxLength={1}
            placeholder="e.g. A"
            value={dpValue}
            onChange={(e) => {
              setDpValue(e.target.value.toUpperCase());
              setDpErr(null);
              setDpOk(null);
            }}
            className="w-16 border border-slate-300 rounded px-3 py-1.5 text-center font-mono text-lg font-bold uppercase bg-slate-50 focus:outline-none focus:border-teal-500"
          />
          <button
            className="px-4 py-1.5 rounded bg-teal-700 text-white text-[12px] font-bold hover:bg-teal-800"
            onClick={() => {
              try {
                setDevicePrefix(dpValue);
                setDpOk(`Device prefix set to "${dpValue.toUpperCase()}" - new patients will use this prefix.`);
                setDpErr(null);
              } catch (e: unknown) {
                setDpErr(e instanceof Error ? e.message : 'Invalid prefix');
              }
            }}
          >
            Save Prefix
          </button>
          {savedPrefix && (
            <span className="text-[10px] text-slate-400 italic">
              Changing prefix does not rename existing patients.
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <div className="font-sans font-bold text-slate-800 text-[13px] mb-1 flex items-center gap-2">
          <span>Remote Device Management</span>
        </div>
        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
          Manage all devices at this facility remotely. Assign prefixes (A-Z) to each device from any admin dashboard.
          Devices automatically receive their prefix on next sync.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <button
            className="px-4 py-1.5 rounded bg-teal-700 text-white text-[12px] font-bold hover:bg-teal-800 disabled:opacity-50"
            onClick={loadDevices}
            disabled={deviceLoading}
          >
            {deviceLoading ? 'Loading...' : 'Refresh Devices'}
          </button>
          {availablePrefixes.length > 0 && (
            <span className="text-[11px] text-slate-500">
              Available: {availablePrefixes.join(', ')}
            </span>
          )}
        </div>

        {deviceErr && <div className="text-[11px] text-red-600 font-semibold mb-2">{deviceErr}</div>}

        {devices.length > 0 ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Device</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Last Seen</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Prefix</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Action</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Doctor</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => {
                  const info = formatDeviceInfo(device);
                  const assignedDoctor = device.assigned_doctor;
                  return (
                    <tr key={device.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{info.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{device.id.slice(-12)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          info.status === 'online'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {info.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{timeSinceLastSeen(device.last_seen)}</td>
                      <td className="px-3 py-2">
                        {device.prefix ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-[12px] font-bold border border-teal-200">
                            Device {device.prefix}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not assigned</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <select
                            className="border border-slate-300 rounded px-2 py-1 text-[12px] bg-white"
                            value={device.prefix || ''}
                            onChange={async (e) => {
                              const prefix = e.target.value;
                              if (prefix) {
                                await assignDevicePrefix(device.id, prefix);
                                loadDevices();
                              }
                            }}
                          >
                            <option value="">Assign...</option>
                            {availablePrefixes.map((letter) => (
                              <option key={letter} value={letter}>{letter}</option>
                            ))}
                          </select>
                          {device.prefix && (
                            <button
                              className="text-[10px] text-red-600 hover:text-red-800 font-semibold"
                              onClick={async () => {
                                await unassignDevicePrefix(device.id);
                                loadDevices();
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {assignedDoctor ? (
                            <span className="text-[11px] text-slate-700 font-medium">
                              Dr. {assignedDoctor.display_name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                          )}
                          <select
                            className="border border-slate-300 rounded px-2 py-1 text-[11px] bg-white w-full"
                            value={device.assigned_doctor_id || ''}
                            onChange={async (e: React.ChangeEvent<HTMLSelectElement>) => {
                              const doctorId = e.target.value || null;
                              await assignDoctorToDevice(device.id, doctorId);
                              loadDevices();
                            }}
                          >
                            <option value="">Assign Doctor...</option>
                            {users
                              .filter((user) => user.role === 'doctor')
                              .map((doctor) => (
                                <option key={doctor.id} value={doctor.id}>
                                  Dr. {doctor.displayName}
                                </option>
                              ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-[12px]">
            No devices registered yet. Devices will appear here after they log in and sync.
          </div>
        )}
      </div>
    </>
  );
}
