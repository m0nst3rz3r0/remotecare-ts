import { useEffect, useMemo, useState } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import type { Hospital, Patient, User } from '../types';
import { usePatientStore } from '../store/usePatientStore';
import { useUIStore } from '../store/useUIStore';
import { TZ_GEO } from '../utils/geo';
import {
  addHospital,
  addUser,
  deleteHospital,
  deleteUser,
  getHospitalsByRegionDistrict,
  loadHospitals,
  loadUsers,
} from '../services/auth';
import { isControlled, isDue } from '../services/clinical';

import EnrolmentChart from '../components/charts/EnrolmentChart';
import BPControlChart from '../components/charts/BPControlChart';
import TrendsChart from '../components/charts/TrendsChart';

import Chip from '../components/ui/Chip';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function titleForAdminPage(page: string) {
  switch (page) {
    case 'overview':
      return 'Overview';
    case 'trends':
      return 'Trends';
    case 'doctors':
      return 'Doctors';
    case 'settings':
      return 'Settings';
    default:
      return 'Admin';
  }
}

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function GlucoseControlChart({ patients, year }: { patients: Patient[]; year: number }) {
  const labels = useMemo(() => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], []);

  const data = useMemo(() => {
    const amber = cssVar('--amber', 'var(--amber)');
    const amberPale = cssVar('--amber-pale', 'var(--amber-pale)');

    const rates = labels.map((_, idx) => {
      const m = idx + 1;
      const visits = patients.flatMap((p) => p.visits ?? []).filter(
        (v) => +v.month === m && (v.year ?? new Date().getFullYear()) === year,
      );
      const attended = visits.filter((v) => v.att);
      const measured = attended.filter((v) => typeof v.sugar === 'number');
      const controlled = measured.filter((v) => (v.sugar ?? 0) < 10);
      return measured.length ? Math.round((controlled.length / measured.length) * 100) : null;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Glucose Control %',
          data: rates,
          borderColor: amber,
          backgroundColor: amberPale,
          fill: false,
          tension: 0.25,
          spanGaps: true,
          pointRadius: 3,
        },
      ],
    };
  }, [labels, patients, year]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (v: any) => `${v}%` },
        },
      },
    }),
    [],
  );

  return (
    <div className="w-full h-[240px]">
      <Line data={data as any} options={options as any} />
    </div>
  );
}

function OverviewView({ patients, hospitals, year }: { patients: Patient[]; hospitals: Hospital[]; year: number }) {
  const stats = useMemo(() => {
    const total = patients.length;
    const active = patients.filter((p) => p.status === 'active').length;
    const ltfu = patients.filter((p) => p.status === 'ltfu').length;
    const due = patients.filter((p) => isDue(p)).length;
    const controlled = patients.filter((p) => isControlled(p)).length;
    return { total, active, ltfu, due, controlled };
  }, [patients]);

  const facilityRows = useMemo(() => {
    return hospitals.map((h) => {
      const pts = patients.filter((p) => p.hospital === h.name);
      const active = pts.filter((p) => p.status === 'active');
      const ctrlCount = active.filter((p) => isControlled(p)).length;
      const ctrlRate = active.length ? Math.round((ctrlCount / active.length) * 100) : null;
      const ltfu = pts.filter((p) => p.status === 'ltfu').length;
      return { h, patients: pts.length, ctrlRate, ltfu };
    });
  }, [patients, hospitals]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4 text-center">
          <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)]">Total</div>
          <div className="mono text-[22px] font-extrabold text-[var(--teal)]">{stats.total}</div>
        </div>
        <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4 text-center">
          <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)]">Active</div>
          <div className="mono text-[22px] font-extrabold text-[var(--emerald)]">{stats.active}</div>
        </div>
        <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4 text-center">
          <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)]">LTFU</div>
          <div className="mono text-[22px] font-extrabold text-[var(--rose)]">{stats.ltfu}</div>
        </div>
        <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4 text-center">
          <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)]">Due</div>
          <div className="mono text-[22px] font-extrabold text-[var(--amber)]">{stats.due}</div>
        </div>
        <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4 text-center md:col-span-1">
          <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)]">Controlled</div>
          <div className="mono text-[22px] font-extrabold text-[var(--teal)]">{stats.controlled}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4">
          <div className="font-syne font-extrabold text-[14px] mb-2">Monthly New Registrations</div>
          <EnrolmentChart patients={patients} year={year} />
        </div>
        <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4">
          <div className="font-syne font-extrabold text-[14px] mb-2">BP Control %</div>
          <BPControlChart patients={patients} year={year} />
        </div>
        <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4 lg:col-span-2">
          <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
            <div className="font-syne font-extrabold text-[14px]">Glucose Control %</div>
            <div className="text-[12px] font-bold text-[var(--slate)]">Targeted by programme rule</div>
          </div>
          <GlucoseControlChart patients={patients} year={year} />
        </div>
      </div>

      <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4">
        <div className="font-syne font-extrabold text-[14px] mb-3">Facility Breakdown</div>
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.5px] font-extrabold text-[var(--slate)]">
                <th className="pb-2 px-2">Hospital</th>
                <th className="pb-2 px-2 text-center">Patients</th>
                <th className="pb-2 px-2 text-center">Control rate</th>
                <th className="pb-2 px-2 text-center">LTFU</th>
              </tr>
            </thead>
            <tbody>
              {facilityRows.map((r, idx) => (
                <tr key={r.h.id} style={{ background: idx % 2 ? 'var(--cream)' : undefined }}>
                  <td className="px-2 py-2 font-extrabold text-[12px]">{r.h.name}</td>
                  <td className="px-2 py-2 text-center font-extrabold text-[12px] text-[var(--teal)]">{r.patients}</td>
                  <td className="px-2 py-2 text-center font-extrabold text-[12px] text-[var(--emerald)]">
                    {r.ctrlRate === null ? '—' : `${r.ctrlRate}%`}
                  </td>
                  <td className="px-2 py-2 text-center font-extrabold text-[12px] text-[var(--rose)]">{r.ltfu}</td>
                </tr>
              ))}
              {!facilityRows.length ? (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-[var(--slate)] font-bold">
                    No facilities configured.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DoctorsView({ patients }: { patients: Patient[] }) {
  const [doctors, setDoctors] = useState<User[]>([]);

  useEffect(() => {
    setDoctors(loadUsers().filter((u) => u.role === 'doctor'));
  }, []);

  const rows = useMemo(() => {
    return doctors.map((doc) => {
      const dp = patients.filter((p) => p.hospital === doc.hospital);
      const allVisits = dp.flatMap((p) => p.visits ?? []);
      const attended = allVisits.filter((v) => v.att).length;
      const missed = allVisits.length - attended;
      const pct = allVisits.length ? Math.round((attended / allVisits.length) * 100) : 0;
      return { doc, patients: dp.length, attended, missed, pct };
    });
  }, [doctors, patients]);

  return (
    <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4 overflow-auto">
      <div className="font-syne font-extrabold text-[14px] mb-3">Doctor Activity</div>
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.5px] font-extrabold text-[var(--slate)]">
            <th className="pb-2 px-2">Doctor</th>
            <th className="pb-2 px-2">Hospital</th>
            <th className="pb-2 px-2 text-center">Patients</th>
            <th className="pb-2 px-2 text-center">Attended</th>
            <th className="pb-2 px-2 text-center">Missed</th>
            <th className="pb-2 px-2 text-center">Attend %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.doc.id} style={{ background: idx % 2 ? 'var(--cream)' : undefined }}>
              <td className="px-2 py-2 font-extrabold text-[12px]">{r.doc.displayName}</td>
              <td className="px-2 py-2 text-[12px] text-[var(--slate)]">{r.doc.hospital || '—'}</td>
              <td className="px-2 py-2 text-center font-extrabold text-[12px] text-[var(--teal)]">{r.patients}</td>
              <td className="px-2 py-2 text-center font-extrabold text-[12px] text-[var(--emerald)]">{r.attended}</td>
              <td className="px-2 py-2 text-center font-extrabold text-[12px] text-[var(--rose)]">{r.missed}</td>
              <td className="px-2 py-2 text-center">
                <div className="font-extrabold text-[12px] text-[var(--teal)]">{r.pct}%</div>
                <div className="mt-1 h-[8px] rounded-[999px] bg-[var(--border)] overflow-hidden">
                  <div className="h-full" style={{ width: `${r.pct}%`, background: 'var(--teal)' }} />
                </div>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={6} className="px-2 py-4 text-center text-[var(--slate)] font-bold">
                No doctors registered.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function SettingsView() {
  const [hospitals, setHospitals] = useState<Hospital[]>(() => loadHospitals());
  const [users, setUsers] = useState<User[]>(() => loadUsers());

  const regions = useMemo(() => Object.keys(TZ_GEO).sort(), []);

  // Hospital add
  const [hRegion, setHRegion] = useState('');
  const [hDistrict, setHDistrict] = useState('');
  const [hName, setHName] = useState('');
  const [hErr, setHErr] = useState<string | null>(null);

  // Doctor/admin add
  const [uRole, setURole] = useState<User['role']>('doctor');
  const [uName, setUName] = useState('');
  const [uUser, setUUser] = useState('');
  const [uPass, setUPass] = useState('');

  const [dRegion, setDRegion] = useState('');
  const [dDistrict, setDDistrict] = useState('');
  const [dHospital, setDHospital] = useState('');

  const [uErr, setUErr] = useState<string | null>(null);

  const refresh = () => {
    setHospitals(loadHospitals());
    setUsers(loadUsers());
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const districtOptions = useMemo(() => {
    if (!hRegion) return [];
    return TZ_GEO[hRegion] ?? [];
  }, [hRegion]);

  const docDistrictOptions = useMemo(() => {
    if (!dRegion) return [];
    return TZ_GEO[dRegion] ?? [];
  }, [dRegion]);

  const docHospitalOptions = useMemo(() => {
    if (!dRegion || !dDistrict) return [];
    return getHospitalsByRegionDistrict(dRegion, dDistrict);
  }, [dRegion, dDistrict]);

  const canDeleteUser = (u: User) => !(u.username === 'admin' || u.username === 'alexalpha360' || !!u.isSuperAdmin);

  const onAddHospital = () => {
    setHErr(null);
    const res = addHospital({ name: hName.trim(), region: hRegion, district: hDistrict });
    if (!res.success) {
      setHErr(res.error);
      return;
    }
    setHRegion('');
    setHDistrict('');
    setHName('');
    refresh();
  };

  const onDeleteHospital = (id: string) => {
    deleteHospital(id);
    refresh();
  };

  const onAddUser = () => {
    setUErr(null);
    const res =
      uRole === 'doctor'
        ? addUser({
            displayName: uName.trim(),
            username: uUser.trim(),
            password: uPass,
            role: 'doctor',
            hospital: dHospital,
            region: dRegion,
            district: dDistrict,
          })
        : addUser({
            displayName: uName.trim(),
            username: uUser.trim(),
            password: uPass,
            role: 'admin',
          });

    if (!res.success) {
      setUErr(res.error);
      return;
    }

    setUName('');
    setUUser('');
    setUPass('');
    setURole('doctor');
    setDRegion('');
    setDDistrict('');
    setDHospital('');
    refresh();
  };

  const onDeleteUser = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    if (!canDeleteUser(target)) return;
    deleteUser(id);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4">
        <div className="font-syne font-extrabold text-[14px] mb-2">Hospital Management</div>

        {hErr ? <Alert variant="red">Could not add hospital: {hErr}</Alert> : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Region</div>
            <select
              value={hRegion}
              onChange={(e) => {
                setHRegion(e.target.value);
                setHDistrict('');
              }}
              className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
            >
              <option value="">— Select —</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">District</div>
            <select
              value={hDistrict}
              onChange={(e) => setHDistrict(e.target.value)}
              disabled={!hRegion}
              className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white disabled:opacity-50"
            >
              <option value="">— Select —</option>
              {districtOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Hospital name</div>
            <input
              value={hName}
              onChange={(e) => setHName(e.target.value)}
              className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
              placeholder="e.g. Bukoba Regional Hospital"
            />
          </div>
        </div>

        <div className="mt-3">
          <Button size="md" variant="primary" label="Add Hospital" onClick={onAddHospital} />
        </div>

        <div className="mt-4 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.5px] font-extrabold text-[var(--slate)]">
                <th className="pb-2 px-2">Name</th>
                <th className="pb-2 px-2">Region</th>
                <th className="pb-2 px-2">District</th>
                <th className="pb-2 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((h) => (
                <tr key={h.id} style={{ background: 'var(--cream)' }}>
                  <td className="px-2 py-2 font-extrabold text-[12px]">{h.name}</td>
                  <td className="px-2 py-2 text-[12px] text-[var(--slate)]">{h.region}</td>
                  <td className="px-2 py-2 text-[12px] text-[var(--slate)]">{h.district}</td>
                  <td className="px-2 py-2 text-right">
                    <Button size="sm" variant="danger" label="Delete" onClick={() => onDeleteHospital(h.id)} />
                  </td>
                </tr>
              ))}
              {!hospitals.length ? (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-[var(--slate)] font-bold">
                    No hospitals configured.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4">
        <div className="font-syne font-extrabold text-[14px] mb-2">User Management</div>

        {uErr ? <Alert variant="red">Could not add user: {uErr}</Alert> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Role</div>
            <select
              value={uRole}
              onChange={(e) => setURole(e.target.value as User['role'])}
              className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
            >
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Display name</div>
            <input
              value={uName}
              onChange={(e) => setUName(e.target.value)}
              className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
              placeholder="e.g. Dr. John"
            />
          </div>

          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Username</div>
            <input
              value={uUser}
              onChange={(e) => setUUser(e.target.value)}
              className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
              placeholder="doctor_username"
              autoComplete="username"
            />
          </div>

          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Password</div>
            <input
              value={uPass}
              onChange={(e) => setUPass(e.target.value)}
              type="password"
              className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
              placeholder="••••••"
              autoComplete="new-password"
            />
          </div>
        </div>

        {uRole === 'doctor' ? (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Region</div>
              <select
                value={dRegion}
                onChange={(e) => {
                  setDRegion(e.target.value);
                  setDDistrict('');
                  setDHospital('');
                }}
                className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
              >
                <option value="">— Select —</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">District</div>
              <select
                value={dDistrict}
                onChange={(e) => {
                  setDDistrict(e.target.value);
                  setDHospital('');
                }}
                disabled={!dRegion}
                className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white disabled:opacity-50"
              >
                <option value="">— Select —</option>
                {docDistrictOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Hospital</div>
              <select
                value={dHospital}
                onChange={(e) => setDHospital(e.target.value)}
                disabled={!dRegion || !dDistrict}
                className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white disabled:opacity-50"
              >
                <option value="">— Select —</option>
                {docHospitalOptions.map((h) => (
                  <option key={h.id} value={h.name}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        <div className="mt-3">
          <Button size="md" variant="primary" label="Add User" onClick={onAddUser} />
        </div>

        <div className="mt-4 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.5px] font-extrabold text-[var(--slate)]">
                <th className="pb-2 px-2">User</th>
                <th className="pb-2 px-2">Role</th>
                <th className="pb-2 px-2">Hospital</th>
                <th className="pb-2 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ background: 'var(--cream)' }}>
                  <td className="px-2 py-2">
                    <div className="font-extrabold text-[12px]">{u.displayName}</div>
                    <div className="text-[11px] text-[var(--slate)] font-bold">@{u.username}</div>
                  </td>
                  <td className="px-2 py-2">
                    <Chip cls="chip-gray">{u.role}</Chip>
                  </td>
                  <td className="px-2 py-2 text-[12px] text-[var(--slate)]">{u.hospital || '—'}</td>
                  <td className="px-2 py-2 text-right">
                    {canDeleteUser(u) ? (
                      <Button size="sm" variant="danger" label="Delete" onClick={() => onDeleteUser(u.id)} />
                    ) : (
                      <span className="text-[11px] font-bold text-[var(--slate)]">Protected</span>
                    )}
                  </td>
                </tr>
              ))}
              {!users.length ? (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-[var(--slate)] font-bold">
                    No users configured.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const activePage = useUIStore((s) => s.activePage);
  const patients = usePatientStore((s) => s.patients);

  const [hospitals, setHospitals] = useState<Hospital[]>(() => loadHospitals());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  useEffect(() => {
    setHospitals(loadHospitals());
  }, [activePage]);

  return (
    <PageWrapper title={titleForAdminPage(activePage)}>
      {activePage === 'overview' ? <OverviewView patients={patients} hospitals={hospitals} year={selectedYear} /> : null}
      {activePage === 'trends' ? (
        <div className="space-y-4">
          <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <div className="font-syne font-extrabold text-[16px] text-[var(--ink)]">Trends</div>
                <div className="text-[12px] text-[var(--slate)] mt-1">Monthly enrolment, BP control, attendance, and drug usage.</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Year</div>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
                >
                  {Array.from({ length: 6 }).map((_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <TrendsChart patients={patients} year={selectedYear} />
        </div>
      ) : null}
      {activePage === 'doctors' ? <DoctorsView patients={patients} /> : null}
      {activePage === 'settings' ? <SettingsView /> : null}
    </PageWrapper>
  );
}

