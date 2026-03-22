import { useEffect, useMemo, useState } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import type { Hospital, Patient, User } from '../types';
import { usePatientStore } from '../store/usePatientStore';
import { useAuthStore } from '../store/useAuthStore';
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
  updateUserPassword,
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

// ── Design tokens ────────────────────────────────────────────
const INK   = '#0f1f26';
const TEAL  = '#0d6e87';
const PRIMARY = '#005469';

function titleForAdminPage(page: string) {
  switch (page) {
    case 'overview': return 'Overview';
    case 'trends':   return 'Trends';
    case 'doctors':  return 'Doctors';
    case 'settings': return 'Settings';
    default:         return 'Admin';
  }
}

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// ── Shared UI helpers ────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ background: INK, height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center' }}>
      <span style={{ color: '#fff', fontFamily: 'Syne, sans-serif', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
        {title}
      </span>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(15,31,38,0.05)', border: '1px solid rgba(191,200,205,0.15)', marginBottom: '16px' }}>
      {title && <SectionHeader title={title} />}
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

function RiskBadge({ ctrlRate }: { ctrlRate: number | null }) {
  if (ctrlRate === null) return <span style={{ color: '#64748b', fontSize: '12px' }}>—</span>;
  if (ctrlRate >= 65) return <span style={{ padding: '3px 10px', background: '#d1fae5', color: '#065f46', fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700, borderRadius: '999px', textTransform: 'uppercase' }}>Stable</span>;
  if (ctrlRate >= 45) return <span style={{ padding: '3px 10px', background: '#fef3c7', color: '#92400e', fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700, borderRadius: '999px', textTransform: 'uppercase' }}>Moderate</span>;
  return <span style={{ padding: '3px 10px', background: '#ffe4e6', color: '#9f1239', fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700, borderRadius: '999px', textTransform: 'uppercase' }}>High Risk</span>;
}

function StatCard({ title, value, sub, valueColor }: { title: string; value: number | string; sub?: string; valueColor: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(15,31,38,0.05)', border: '1px solid rgba(191,200,205,0.15)' }}>
      <div style={{ background: INK, height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#fff', fontFamily: 'Syne, sans-serif', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>{title}</span>
      </div>
      <div style={{ padding: '20px' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '36px', fontWeight: 700, color: valueColor, lineHeight: 1 }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {sub && <div style={{ marginTop: '8px', fontSize: '12px', color: '#516169', fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Glucose control chart ────────────────────────────────────
function GlucoseControlChart({ patients, year }: { patients: Patient[]; year: number }) {
  const labels = useMemo(() => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], []);
  const data = useMemo(() => {
    const amber = cssVar('--amber', '#f59e0b');
    const rates = labels.map((_, idx) => {
      const m = idx + 1;
      const visits = patients.flatMap((p) => p.visits ?? []).filter((v) => +v.month === m && (v.year ?? new Date().getFullYear()) === year);
      const attended = visits.filter((v) => v.att);
      const measured = attended.filter((v) => typeof v.sugar === 'number');
      const controlled = measured.filter((v) => (v.sugar ?? 0) < 10);
      return measured.length ? Math.round((controlled.length / measured.length) * 100) : null;
    });
    return { labels, datasets: [{ label: 'Glucose Control %', data: rates, borderColor: amber, fill: false, tension: 0.25, spanGaps: true, pointRadius: 3 }] };
  }, [labels, patients, year]);
  const options = useMemo(() => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v: any) => `${v}%` } } } }), []);
  return <div style={{ width: '100%', height: '220px' }}><Line data={data as any} options={options as any} /></div>;
}

// ── Overview view ────────────────────────────────────────────
function OverviewView({ patients, hospitals, year, scopeLabel }: { patients: Patient[]; hospitals: Hospital[]; year: number; scopeLabel: string }) {
  const stats = useMemo(() => {
    const total      = patients.length;
    const active     = patients.filter((p) => p.status === 'active').length;
    const ltfu       = patients.filter((p) => p.status === 'ltfu').length;
    const due        = patients.filter((p) => isDue(p)).length;
    const controlled = patients.filter((p) => isControlled(p)).length;
    const ctrlRate   = active ? Math.round((controlled / active) * 100) : 0;
    return { total, active, ltfu, due, controlled, ctrlRate };
  }, [patients]);

  const facilityRows = useMemo(() => hospitals.map((h) => {
    const pts      = patients.filter((p) => p.hospital === h.name);
    const active   = pts.filter((p) => p.status === 'active');
    const ctrlCount = active.filter((p) => isControlled(p)).length;
    const ctrlRate = active.length ? Math.round((ctrlCount / active.length) * 100) : null;
    const ltfu     = pts.filter((p) => p.status === 'ltfu').length;
    const activeP  = pts.length ? Math.round((active.length / pts.length) * 100) : 0;
    return { h, total: pts.length, activeP, ctrlRate, ltfu };
  }), [patients, hospitals]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 800, color: INK, marginBottom: '4px' }}>Admin Overview</h2>
        <p style={{ fontSize: '14px', color: '#516169' }}>Regional clinical performance · <strong>{scopeLabel}</strong></p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <StatCard title="Total Enrollment"  value={stats.total}      valueColor={TEAL}      sub={`${stats.active} active patients`} />
        <StatCard title="Active Status"     value={stats.active}     valueColor={TEAL}      sub={`${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}% of total`} />
        <StatCard title="LTFU (3+ Months)"  value={stats.ltfu}       valueColor="#ba1a1a"   sub={`${stats.total ? Math.round((stats.ltfu / stats.total) * 100) : 0}% rate`} />
        <StatCard title="Due This Month"    value={stats.due}        valueColor="#d97706"   sub="Appointments pending" />
        <StatCard title="Controlled BP"     value={stats.controlled} valueColor="#16a34a"   sub={`${stats.ctrlRate}% control rate`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Card title="Enrollment Velocity"><EnrolmentChart patients={patients} year={year} /></Card>
        <Card title="BP Control Trend (%)"><BPControlChart patients={patients} year={year} /></Card>
      </div>

      <Card title="Glucose Control %"><GlucoseControlChart patients={patients} year={year} /></Card>

      <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(15,31,38,0.05)', border: '1px solid rgba(191,200,205,0.15)' }}>
        <div style={{ background: INK, height: '44px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontFamily: 'Syne, sans-serif', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Regional Facility Matrix</span>
          <span style={{ color: '#85d1ed', fontFamily: 'Syne, sans-serif', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{scopeLabel}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e3e1' }}>
                {['Facility Name', 'Total Patients', 'Active %', 'Control Rate', 'Risk Status', 'LTFU'].map((h) => (
                  <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#516169', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facilityRows.map((r, idx) => (
                <tr key={r.h.id} style={{ borderBottom: '1px solid #f4f4f2', background: idx % 2 === 0 ? '#fff' : '#fafaf8' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 700, fontSize: '14px', color: INK }}>{r.h.name}</td>
                  <td style={{ padding: '16px 24px', fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', color: '#516169' }}>{r.total.toLocaleString()}</td>
                  <td style={{ padding: '16px 24px', fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 700, color: TEAL }}>{r.total ? `${r.activeP}%` : '—'}</td>
                  <td style={{ padding: '16px 24px', fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 700, color: r.ctrlRate !== null && r.ctrlRate >= 65 ? '#16a34a' : r.ctrlRate !== null && r.ctrlRate >= 45 ? '#d97706' : '#ba1a1a' }}>{r.ctrlRate !== null ? `${r.ctrlRate}%` : '—'}</td>
                  <td style={{ padding: '16px 24px' }}><RiskBadge ctrlRate={r.ctrlRate} /></td>
                  <td style={{ padding: '16px 24px', fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 700, color: r.ltfu > 0 ? '#ba1a1a' : '#516169' }}>{r.ltfu}</td>
                </tr>
              ))}
              {!facilityRows.length && (
                <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#516169', fontWeight: 700 }}>No facilities configured. Add hospitals in Settings.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Doctors view ─────────────────────────────────────────────
function DoctorsView({ patients }: { patients: Patient[] }) {
  const [doctors, setDoctors] = useState<User[]>([]);
  useEffect(() => { setDoctors(loadUsers().filter((u) => u.role === 'doctor')); }, []);
  const rows = useMemo(() => doctors.map((doc) => {
    const dp = patients.filter((p) => p.hospital === doc.hospital);
    const allVisits = dp.flatMap((p) => p.visits ?? []);
    const attended = allVisits.filter((v) => v.att).length;
    const missed = allVisits.length - attended;
    const pct = allVisits.length ? Math.round((attended / allVisits.length) * 100) : 0;
    return { doc, patients: dp.length, attended, missed, pct };
  }), [doctors, patients]);

  return (
    <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4 overflow-auto">
      <div className="font-syne font-extrabold text-[14px] mb-3">Doctor Activity</div>
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.5px] font-extrabold text-[var(--slate)]">
            <th className="pb-2 px-2">Doctor</th><th className="pb-2 px-2">Hospital</th>
            <th className="pb-2 px-2 text-center">Patients</th><th className="pb-2 px-2 text-center">Attended</th>
            <th className="pb-2 px-2 text-center">Missed</th><th className="pb-2 px-2 text-center">Attend %</th>
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
          {!rows.length ? <tr><td colSpan={6} className="px-2 py-4 text-center text-[var(--slate)] font-bold">No doctors registered.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

// ── Settings view ────────────────────────────────────────────
function SettingsView() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const superAdmin  = currentUser?.isSuperAdmin === true;

  const [hospitals, setHospitals] = useState<Hospital[]>(() => loadHospitals());
  const [users,     setUsers]     = useState<User[]>(() => loadUsers());
  const regions = useMemo(() => Object.keys(TZ_GEO).sort(), []);

  // Hospital form
  const [hRegion,   setHRegion]   = useState('');
  const [hDistrict, setHDistrict] = useState('');
  const [hName,     setHName]     = useState('');
  const [hErr,      setHErr]      = useState<string | null>(null);

  // User form — superadmin adds admins, admin adds doctors
  const [uName,     setUName]     = useState('');
  const [uUser,     setUUser]     = useState('');
  const [uPass,     setUPass]     = useState('');
  const [dRegion,   setDRegion]   = useState('');
  const [dDistrict, setDDistrict] = useState('');
  const [dHospital, setDHospital] = useState('');
  const [uErr,      setUErr]      = useState<string | null>(null);
  const [uOk,       setUOk]       = useState<string | null>(null);

  // Password reset
  const [pwTargetId, setPwTargetId] = useState('');
  const [pwNew,      setPwNew]      = useState('');
  const [pwErr,      setPwErr]      = useState<string | null>(null);
  const [pwOk,       setPwOk]       = useState<string | null>(null);

  const refresh = () => { setHospitals(loadHospitals()); setUsers(loadUsers()); };
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  const districtOptions    = useMemo(() => hRegion  ? TZ_GEO[hRegion]  ?? [] : [], [hRegion]);
  const docDistrictOptions = useMemo(() => dRegion  ? TZ_GEO[dRegion]  ?? [] : [], [dRegion]);
  const docHospitalOptions = useMemo(() => (dRegion && dDistrict) ? getHospitalsByRegionDistrict(dRegion, dDistrict) : [], [dRegion, dDistrict]);

  // Who can be deleted
  const canDeleteUser = (u: User) => !(u.isSuperAdmin || u.username === 'admin' || u.username === 'alexalpha360');

  // Who shows in password reset list
  // Superadmin resets admins; admin resets doctors
  const pwCandidates = useMemo(() => {
    if (superAdmin) return users.filter((u) => u.role === 'admin' && !u.isSuperAdmin);
    return users.filter((u) => u.role === 'doctor');
  }, [users, superAdmin]);

  const onAddHospital = () => {
    setHErr(null);
    const res = addHospital({ name: hName.trim(), region: hRegion, district: hDistrict });
    if (!res.success) { setHErr(res.error); return; }
    setHRegion(''); setHDistrict(''); setHName(''); refresh();
  };

  const onDeleteHospital = (id: string) => { deleteHospital(id); refresh(); };

  const onAddUser = () => {
    setUErr(null); setUOk(null);
    const role: 'admin' | 'doctor' = superAdmin ? 'admin' : 'doctor';
    const res = addUser({
      displayName: uName.trim(),
      username:    uUser.trim(),
      password:    uPass,
      role,
      hospital:    role === 'doctor' ? dHospital : '',
      region:      role === 'doctor' ? dRegion   : '',
      district:    role === 'doctor' ? dDistrict : '',
      createdBy:   currentUser,
    });
    if (!res.success) { setUErr(res.error); return; }
    setUOk(`${role === 'admin' ? 'Admin' : 'Doctor'} account created successfully.`);
    setUName(''); setUUser(''); setUPass(''); setDRegion(''); setDDistrict(''); setDHospital('');
    refresh();
  };

  const onDeleteUser = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target || !canDeleteUser(target)) return;
    deleteUser(id); refresh();
  };

  const onResetPassword = () => {
    setPwErr(null); setPwOk(null);
    if (!pwTargetId) { setPwErr('Select a user first.'); return; }
    const res = updateUserPassword(pwTargetId, pwNew, currentUser);
    if (!res.success) { setPwErr(res.error); return; }
    setPwOk('Password updated successfully.');
    setPwTargetId(''); setPwNew('');
  };

  const inputCls = "w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white";
  const labelCls = "text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1";

  return (
    <div className="space-y-4">

      {/* ── Hospital Management ─────────────────────────── */}
      <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4">
        <div className="font-syne font-extrabold text-[14px] mb-2">Hospital Management</div>
        {hErr ? <Alert variant="red">Could not add hospital: {hErr}</Alert> : null}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <div className={labelCls}>Region</div>
            <select value={hRegion} onChange={(e) => { setHRegion(e.target.value); setHDistrict(''); }} className={inputCls}>
              <option value="">— Select —</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <div className={labelCls}>District</div>
            <select value={hDistrict} onChange={(e) => setHDistrict(e.target.value)} disabled={!hRegion} className={`${inputCls} disabled:opacity-50`}>
              <option value="">— Select —</option>
              {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <div className={labelCls}>Hospital name</div>
            <input value={hName} onChange={(e) => setHName(e.target.value)} className={inputCls} placeholder="e.g. Bukoba Regional Hospital" />
          </div>
        </div>
        <div className="mt-3"><Button size="md" variant="primary" label="Add Hospital" onClick={onAddHospital} /></div>
        <div className="mt-4 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.5px] font-extrabold text-[var(--slate)]">
                <th className="pb-2 px-2">Name</th><th className="pb-2 px-2">Region</th><th className="pb-2 px-2">District</th><th className="pb-2 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((h) => (
                <tr key={h.id} style={{ background: 'var(--cream)' }}>
                  <td className="px-2 py-2 font-extrabold text-[12px]">{h.name}</td>
                  <td className="px-2 py-2 text-[12px] text-[var(--slate)]">{h.region}</td>
                  <td className="px-2 py-2 text-[12px] text-[var(--slate)]">{h.district}</td>
                  <td className="px-2 py-2 text-right"><Button size="sm" variant="danger" label="Delete" onClick={() => onDeleteHospital(h.id)} /></td>
                </tr>
              ))}
              {!hospitals.length ? <tr><td colSpan={4} className="px-2 py-4 text-center text-[var(--slate)] font-bold">No hospitals configured.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add User — scoped by role ───────────────────── */}
      <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4">
        <div className="font-syne font-extrabold text-[14px] mb-1">
          {superAdmin ? 'Add Admin Account' : 'Add Doctor Account'}
        </div>
        <div className="text-[12px] text-[var(--slate)] mb-3">
          {superAdmin
            ? 'As superadmin you can create admin accounts. Admins manage doctors within their district.'
            : 'As admin you can create doctor accounts assigned to hospitals in your district.'}
        </div>
        {uErr ? <Alert variant="red">{uErr}</Alert> : null}
        {uOk  ? <Alert variant="green">{uOk}</Alert> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className={labelCls}>Display name</div>
            <input value={uName} onChange={(e) => setUName(e.target.value)} className={inputCls} placeholder={superAdmin ? 'e.g. Mwanza Admin' : 'e.g. Dr. Amina'} />
          </div>
          <div>
            <div className={labelCls}>Username</div>
            <input value={uUser} onChange={(e) => setUUser(e.target.value)} className={inputCls} placeholder={superAdmin ? 'mwanza_admin' : 'dr_amina'} autoComplete="username" />
          </div>
          <div>
            <div className={labelCls}>Password</div>
            <input value={uPass} onChange={(e) => setUPass(e.target.value)} type="password" className={inputCls} placeholder="Min 6 characters" autoComplete="new-password" />
          </div>
        </div>

        {/* Doctor-only: assign hospital */}
        {!superAdmin && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className={labelCls}>Region</div>
              <select value={dRegion} onChange={(e) => { setDRegion(e.target.value); setDDistrict(''); setDHospital(''); }} className={inputCls}>
                <option value="">— Select —</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div className={labelCls}>District</div>
              <select value={dDistrict} onChange={(e) => { setDDistrict(e.target.value); setDHospital(''); }} disabled={!dRegion} className={`${inputCls} disabled:opacity-50`}>
                <option value="">— Select —</option>
                {docDistrictOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <div className={labelCls}>Hospital</div>
              <select value={dHospital} onChange={(e) => setDHospital(e.target.value)} disabled={!dRegion || !dDistrict} className={`${inputCls} disabled:opacity-50`}>
                <option value="">— Select —</option>
                {docHospitalOptions.map((h) => <option key={h.id} value={h.name}>{h.name}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="mt-3">
          <Button size="md" variant="primary" label={superAdmin ? 'Create Admin' : 'Create Doctor'} onClick={onAddUser} />
        </div>

        {/* Users table */}
        <div className="mt-4 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.5px] font-extrabold text-[var(--slate)]">
                <th className="pb-2 px-2">User</th><th className="pb-2 px-2">Role</th><th className="pb-2 px-2">Hospital</th><th className="pb-2 px-2 text-right">Actions</th>
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
                    <Chip cls="chip-gray">{u.isSuperAdmin ? 'superadmin' : u.role}</Chip>
                  </td>
                  <td className="px-2 py-2 text-[12px] text-[var(--slate)]">{u.hospital || '—'}</td>
                  <td className="px-2 py-2 text-right">
                    {canDeleteUser(u)
                      ? <Button size="sm" variant="danger" label="Delete" onClick={() => onDeleteUser(u.id)} />
                      : <span className="text-[11px] font-bold text-[var(--slate)]">Protected</span>}
                  </td>
                </tr>
              ))}
              {!users.length ? <tr><td colSpan={4} className="px-2 py-4 text-center text-[var(--slate)] font-bold">No users.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Password Reset ──────────────────────────────── */}
      <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4">
        <div className="font-syne font-extrabold text-[14px] mb-1">Reset Password</div>
        <div className="text-[12px] text-[var(--slate)] mb-3">
          {superAdmin
            ? 'Reset passwords for admin accounts.'
            : 'Reset passwords for doctor accounts in your district.'}
        </div>
        {pwErr ? <Alert variant="red">{pwErr}</Alert> : null}
        {pwOk  ? <Alert variant="green">{pwOk}</Alert> : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <div>
            <div className={labelCls}>Select user</div>
            <select value={pwTargetId} onChange={(e) => setPwTargetId(e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              {pwCandidates.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName} (@{u.username})</option>
              ))}
            </select>
          </div>
          <div>
            <div className={labelCls}>New password</div>
            <input value={pwNew} onChange={(e) => setPwNew(e.target.value)} type="password" className={inputCls} placeholder="Min 6 characters" autoComplete="new-password" />
          </div>
        </div>
        <div className="mt-3">
          <Button size="md" variant="primary" label="Reset Password" onClick={onResetPassword} />
        </div>
      </div>

    </div>
  );
}

// ── Main AdminPage ────────────────────────────────────────────
export default function AdminPage() {
  const activePage  = useUIStore((s) => s.activePage);
  const patients    = usePatientStore((s) => s.patients);
  const currentUser = useAuthStore((s) => s.currentUser);
  const superAdmin  = currentUser?.isSuperAdmin === true;

  const [hospitals,     setHospitals]     = useState<Hospital[]>(() => loadHospitals());
  const [selectedYear,  setSelectedYear]  = useState<number>(() => new Date().getFullYear());

  // Superadmin filter controls
  const [scopeRegion,   setScopeRegion]   = useState('');
  const [scopeDistrict, setScopeDistrict] = useState('');

  const allRegions = useMemo(() => Object.keys(TZ_GEO).sort(), []);
  const scopeDistrictOptions = useMemo(() => scopeRegion ? TZ_GEO[scopeRegion] ?? [] : [], [scopeRegion]);

  useEffect(() => { setHospitals(loadHospitals()); }, [activePage]);

  // Scope patients and hospitals based on role
  const { scopedPatients, scopedHospitals, scopeLabel } = useMemo(() => {
    if (superAdmin) {
      // Superadmin: filter by selected region/district, or show all
      const filteredP = patients.filter((p) => {
        if (scopeRegion   && p.region   !== scopeRegion)   return false;
        if (scopeDistrict && p.district !== scopeDistrict) return false;
        return true;
      });
      const filteredH = hospitals.filter((h) => {
        if (scopeRegion   && h.region   !== scopeRegion)   return false;
        if (scopeDistrict && h.district !== scopeDistrict) return false;
        return true;
      });
      const label = scopeDistrict
        ? `${scopeRegion} · ${scopeDistrict}`
        : scopeRegion
        ? scopeRegion
        : 'All Regions';
      return { scopedPatients: filteredP, scopedHospitals: filteredH, scopeLabel: label };
    } else {
      // Regular admin: locked to their assigned district
      const r = currentUser?.adminRegion   ?? '';
      const d = currentUser?.adminDistrict ?? '';
      const filteredP = patients.filter((p) =>
        (!r || p.region === r) && (!d || p.district === d),
      );
      const filteredH = hospitals.filter((h) =>
        (!r || h.region === r) && (!d || h.district === d),
      );
      const label = d ? `${r} · ${d}` : r || 'Your District';
      return { scopedPatients: filteredP, scopedHospitals: filteredH, scopeLabel: label };
    }
  }, [superAdmin, patients, hospitals, scopeRegion, scopeDistrict, currentUser]);

  return (
    <PageWrapper title={titleForAdminPage(activePage)}>

      {/* Superadmin scope filter bar */}
      {superAdmin && (activePage === 'overview' || activePage === 'trends') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#516169', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Scope:
          </span>
          <select
            value={scopeRegion}
            onChange={(e) => { setScopeRegion(e.target.value); setScopeDistrict(''); }}
            style={{ border: '1.5px solid #bfc8cd', borderRadius: '4px', padding: '6px 10px', fontSize: '13px', background: '#fff', outline: 'none', color: '#0f1f26' }}
          >
            <option value="">All Regions</option>
            {allRegions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={scopeDistrict}
            onChange={(e) => setScopeDistrict(e.target.value)}
            disabled={!scopeRegion}
            style={{ border: '1.5px solid #bfc8cd', borderRadius: '4px', padding: '6px 10px', fontSize: '13px', background: scopeRegion ? '#fff' : '#f4f4f2', outline: 'none', color: '#0f1f26', opacity: scopeRegion ? 1 : 0.5 }}
          >
            <option value="">All Districts</option>
            {scopeDistrictOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {(scopeRegion || scopeDistrict) && (
            <button
              onClick={() => { setScopeRegion(''); setScopeDistrict(''); }}
              style={{ fontSize: '11px', fontWeight: 700, color: '#ba1a1a', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            >
              ✕ Clear
            </button>
          )}
          <span style={{ fontSize: '11px', color: '#516169', fontFamily: 'JetBrains Mono, monospace' }}>
            {scopedPatients.length} patients · {scopedHospitals.length} facilities
          </span>
        </div>
      )}

      {activePage === 'overview' && (
        <OverviewView patients={scopedPatients} hospitals={scopedHospitals} year={selectedYear} scopeLabel={scopeLabel} />
      )}

      {activePage === 'trends' && (
        <div className="space-y-4">
          <div className="bg-white border border-[var(--border)] rounded-[var(--r)] p-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <div className="font-syne font-extrabold text-[16px] text-[var(--ink)]">Trends</div>
                <div className="text-[12px] text-[var(--slate)] mt-1">
                  Monthly enrolment, BP control, attendance · <strong>{scopeLabel}</strong>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Year</div>
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white">
                  {Array.from({ length: 6 }).map((_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <TrendsChart patients={scopedPatients} year={selectedYear} />
        </div>
      )}

      {activePage === 'doctors'  && <DoctorsView patients={scopedPatients} />}
      {activePage === 'settings' && <SettingsView />}
    </PageWrapper>
  );
}
