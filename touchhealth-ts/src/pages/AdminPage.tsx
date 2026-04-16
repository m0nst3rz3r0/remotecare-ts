import React, { useEffect, useMemo, useState } from 'react';
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
  saveUsers,
  updateUserPassword,
} from '../services/auth';
import { isControlled, isDue } from '../services/clinical';

// Components
import SyncBar from '../components/ui/SyncBar';
import EnrolmentChart from '../components/charts/EnrolmentChart';
import BPControlChart from '../components/charts/BPControlChart';
import Chip from '../components/ui/Chip';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import BackupPanel from '../components/ui/BackupPanel';
import { backupStatus } from '../services/backup';
import DirectoryPage from './DirectoryPage';
import AnalyticsBuilder from './AnalyticsBuilder';

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
const INK   = '#1e293b';
const TEAL  = '#1a56db';
const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.75)',
  boxShadow: '0 2px 12px rgba(0,0,0,.07), inset 0 1px 0 rgba(255,255,255,0.9)',
  marginBottom: '16px',
};

function titleForAdminPage(page: string) {
  switch (page) {
    case 'overview':        return 'Overview';
    case 'trends':          return 'Trends';
    case 'doctors':         return 'Doctors';
    case 'settings':        return 'Settings';
    case 'user-management': return 'User Management';
    default:                return 'Admin';
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
    <div style={{ background: 'rgba(241,245,249,0.7)', height: '38px', padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(226,232,240,0.7)' }}>
      <span style={{ color: '#475569', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {title}
      </span>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
      {title && <SectionHeader title={title} />}
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

function RiskBadge({ ctrlRate }: { ctrlRate: number | null }) {
  if (ctrlRate === null) return <span style={{ color: '#64748b', fontSize: '12px' }}>—</span>;
  if (ctrlRate >= 65) return <span style={{ padding: '3px 10px', background: '#d1fae5', color: '#065f46', fontSize: '10px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, borderRadius: '999px', textTransform: 'uppercase' }}>Stable</span>;
  if (ctrlRate >= 45) return <span style={{ padding: '3px 10px', background: '#fef3c7', color: '#92400e', fontSize: '10px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, borderRadius: '999px', textTransform: 'uppercase' }}>Moderate</span>;
  return <span style={{ padding: '3px 10px', background: '#ffe4e6', color: '#9f1239', fontSize: '10px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, borderRadius: '999px', textTransform: 'uppercase' }}>High Risk</span>;
}

function StatCard({ title, value, sub, valueColor }: { title: string; value: number | string; sub?: string; valueColor: string }) {
  return (
    <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
      <div style={{ background: '#f3f4f6', height: '38px', padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ color: '#374151', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
      </div>
      <div style={{ padding: '18px 20px' }}>
        <div style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: '32px', fontWeight: 700, color: valueColor, lineHeight: 1 }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {sub && <div style={{ marginTop: '6px', fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>{sub}</div>}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '26px', fontWeight: 800, color: INK, marginBottom: '4px' }}>Admin Overview</h2>
          <p style={{ fontSize: '13px', color: '#6b7280' }}>Regional clinical performance · <strong>{scopeLabel}</strong></p>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', color: '#1d4ed8', fontWeight: 600 }}>
          📊 {patients.length} patients in scope
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <StatCard title="Total Enrollment"  value={stats.total}      valueColor={TEAL}      sub={`${stats.active} active patients`} />
        <StatCard title="Active Status"     value={stats.active}     valueColor={TEAL}      sub={`${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}% of total`} />
        <StatCard title="LTFU (3+ Months)"  value={stats.ltfu}       valueColor="#ba1a1a"   sub={`${stats.total ? Math.round((stats.ltfu / stats.total) * 100) : 0}% rate`} />
        <StatCard title="Due This Month"    value={stats.due}        valueColor="#d97706"   sub="Appointments pending" />
        <StatCard title="Controlled BP"     value={stats.controlled} valueColor="#16a34a"   sub={`${stats.ctrlRate}% control rate`} />
      </div>

      {/* ── Backup Status Card ──────────────────────────── */}
      {(() => {
        const bs = backupStatus();
        return (
          <div style={{ borderRadius: 10, background: bs.isDue ? '#fef3c7' : '#f0fdf4', border: `1px solid ${bs.isDue ? '#fde68a' : '#86efac'}`, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{bs.isDue ? '⚠️' : '✅'}</span>
            <div>
              <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, fontSize: 12, color: bs.isDue ? '#78350f' : '#14532d' }}>
                {bs.isDue ? 'Backup Overdue' : 'Data Protected'}
              </div>
              <div style={{ fontSize: 11, color: '#516169' }}>
                Last backup: {bs.lastBackupAt ? new Date(bs.lastBackupAt).toLocaleDateString('en-GB') : 'Never'}
                {bs.daysSinceBackup !== null ? ` (${bs.daysSinceBackup} days ago)` : ''}
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Card title="Enrollment Velocity"><EnrolmentChart patients={patients} year={year} /></Card>
        <Card title="BP Control Trend (%)"><BPControlChart patients={patients} year={year} /></Card>
      </div>

      <Card title="Glucose Control %"><GlucoseControlChart patients={patients} year={year} /></Card>

      <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
        <div style={{ background: '#f3f4f6', height: '44px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ color: '#374151', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Regional Facility Matrix</span>
          <span style={{ color: '#1a56db', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{scopeLabel}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                {['Facility Name', 'Total Patients', 'Active %', 'Control Rate', 'Risk Status', 'LTFU'].map((h) => (
                  <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: '10px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facilityRows.map((r, idx) => (
                <tr key={r.h.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 700, fontSize: '14px', color: '#132b31' }}>{r.h.name}</td>
                  <td style={{ padding: '16px 24px', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: '14px', color: '#64748b' }}>{r.total.toLocaleString()}</td>
                  <td style={{ padding: '16px 24px', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{r.total ? `${r.activeP}%` : '—'}</td>
                  <td style={{ padding: '16px 24px', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: '14px', fontWeight: 700, color: r.ctrlRate !== null && r.ctrlRate >= 65 ? '#059669' : r.ctrlRate !== null && r.ctrlRate >= 45 ? '#d97706' : '#dc2626' }}>{r.ctrlRate !== null ? `${r.ctrlRate}%` : '—'}</td>
                  <td style={{ padding: '16px 24px' }}><RiskBadge ctrlRate={r.ctrlRate} /></td>
                  <td style={{ padding: '16px 24px', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: '14px', fontWeight: 700, color: r.ltfu > 0 ? '#dc2626' : '#64748b' }}>{r.ltfu}</td>
                </tr>
              ))}
              {!facilityRows.length && (
                <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>No facilities configured. Add hospitals in Settings.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
  const [uOk,        setUOk]        = useState<string | null>(null);

  // Password reset
  const [pwTargetId, setPwTargetId] = useState('');
  const [pwNew,      setPwNew]      = useState('');
  const [pwErr,      setPwErr]      = useState<string | null>(null);
  const [pwOk,        setPwOk]        = useState<string | null>(null);

  // Superadmin own password change
  const [selfPwCurrent, setSelfPwCurrent] = useState('');
  const [selfPwNew,     setSelfPwNew]     = useState('');
  const [selfPwErr,     setSelfPwErr]     = useState<string | null>(null);
  const [selfPwOk,      setSelfPwOk]      = useState<string | null>(null);

  const refresh = () => { setHospitals(loadHospitals()); setUsers(loadUsers()); };
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  // For non-superadmin, lock region/district to their assigned area
  const adminRegion   = superAdmin ? '' : (currentUser?.adminRegion   ?? '');
  const adminDistrict = superAdmin ? '' : (currentUser?.adminDistrict ?? '');

  const districtOptions    = useMemo(() => {
    const region = superAdmin ? hRegion : adminRegion;
    return region ? TZ_GEO[region] ?? [] : [];
  }, [hRegion, superAdmin, adminRegion]);

  const docDistrictOptions = useMemo(() => {
    const region = superAdmin ? dRegion : adminRegion;
    return region ? TZ_GEO[region] ?? [] : [];
  }, [dRegion, superAdmin, adminRegion]);

  const docHospitalOptions = useMemo(() => {
    const r = superAdmin ? dRegion   : adminRegion;
    const d = superAdmin ? dDistrict : adminDistrict;
    return (r && d) ? getHospitalsByRegionDistrict(r, d) : [];
  }, [dRegion, dDistrict, superAdmin, adminRegion, adminDistrict]);

  // Hospitals visible to this admin
  const visibleHospitals = useMemo(() => {
    if (superAdmin) return hospitals;
    return hospitals.filter((h) =>
      (!adminRegion   || h.region   === adminRegion) &&
      (!adminDistrict || h.district === adminDistrict),
    );
  }, [hospitals, superAdmin, adminRegion, adminDistrict]);

  // Users visible to this admin
  const visibleUsers = useMemo(() => {
    if (superAdmin) return users;
    // Admin sees only doctors in their district
    return users.filter((u) => u.role === 'doctor' &&
      (!adminRegion   || u.region   === adminRegion) &&
      (!adminDistrict || u.district === adminDistrict),
    );
  }, [users, superAdmin, adminRegion, adminDistrict]);

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
    // For non-superadmin, enforce their region/district
    const regionToUse   = superAdmin ? hRegion   : adminRegion;
    const districtToUse = superAdmin ? hDistrict : adminDistrict;
    const res = addHospital({ name: hName.trim(), region: regionToUse, district: districtToUse });
    if (!res.success) { setHErr(res.error); return; }
    setHRegion(''); setHDistrict(''); setHName(''); refresh();
  };

  const onDeleteHospital = (id: string) => { deleteHospital(id); refresh(); };

  const onAddUser = async () => {
    setUErr(null); setUOk(null);
    const role: 'admin' | 'doctor' = superAdmin ? 'admin' : 'doctor';
    // For admin creating doctor, enforce their own region/district
    const regionToUse   = superAdmin ? dRegion   : adminRegion;
    const districtToUse = superAdmin ? dDistrict : adminDistrict;
    const res: { success: boolean; error?: string } = await addUser({
      displayName: uName.trim(),
      username:    uUser.trim(),
      password:    uPass,
      role,
      hospital:    role === 'doctor' ? dHospital : '',
      region:      regionToUse,
      district:    districtToUse,
      createdBy:    currentUser,
    });
    if (!res.success) { setUErr(res.error ?? null); return; }
    setUOk(`${role === 'admin' ? 'Admin' : 'Doctor'} account created successfully.`);
    setUName(''); setUUser(''); setUPass(''); setDRegion(''); setDDistrict(''); setDHospital('');
    refresh();
  };

  const onDeleteUser = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target || !canDeleteUser(target)) return;
    deleteUser(id); refresh();
  };

  const onChangeSelfPassword = () => {
    setSelfPwErr(null); setSelfPwOk(null);
    if (!selfPwCurrent) { setSelfPwErr('Enter your current password.'); return; }
    if (!selfPwNew)      { setSelfPwErr('Enter a new password.'); return; }
    if (selfPwNew.length < 6) { setSelfPwErr('Password must be at least 6 characters.'); return; }
    // Verify current password
    const users = loadUsers();
    const me = users.find((u) => u.id === currentUser?.id);
    if (!me || me.password !== selfPwCurrent) { setSelfPwErr('Current password is incorrect.'); return; }
    // Update
    saveUsers(users.map((u) => u.id === me.id ? { ...u, password: selfPwNew } : u));
    setSelfPwOk('Password changed successfully!');
    setSelfPwCurrent(''); setSelfPwNew('');
  };

  const onResetPassword = async () => {
    setPwErr(null); setPwOk(null);
    if (!pwTargetId) { setPwErr('Select a user first.'); return; }
    const res: { success: boolean; error?: string } = await updateUserPassword(pwTargetId, pwNew, currentUser);
    if (!res.success) { setPwErr(res.error ?? null); return; }
    setPwOk('Password updated successfully.');
    setPwTargetId(''); setPwNew('');
  };

  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 outline-none bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
  const labelCls = "text-xs uppercase font-bold tracking-wider text-slate-500 mb-1";

  return (
    <div className="space-y-4">

      {/* ── Hospital Management ─────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="font-sans font-semibold text-slate-800 text-[14px] mb-2">Hospital Management</div>
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
              <tr className="text-[10px] uppercase tracking-[0.05em] font-bold text-slate-500">
                <th className="pb-2 px-2">Name</th><th className="pb-2 px-2">Region</th><th className="pb-2 px-2">District</th><th className="pb-2 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleHospitals.map((h) => (
                <tr key={h.id} style={{ background: '#f8fafc' }}>
                  <td className="px-2 py-2 font-semibold text-slate-800 text-[12px]">{h.name}</td>
                  <td className="px-2 py-2 text-[12px] text-slate-500">{h.region}</td>
                  <td className="px-2 py-2 text-[12px] text-slate-500">{h.district}</td>
                  <td className="px-2 py-2 text-right"><Button size="sm" variant="danger" label="Delete" onClick={() => onDeleteHospital(h.id)} /></td>
                </tr>
              ))}
              {!visibleHospitals.length ? <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-500 font-semibold">No hospitals configured{!superAdmin ? ' in your district' : ''}.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add User — scoped by role ───────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="font-sans font-semibold text-slate-800 text-[14px] mb-1">
          {superAdmin ? 'Add Admin Account' : 'Add Doctor Account'}
        </div>
        <div className="text-[12px] text-slate-500 mb-3">
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

        {/* Superadmin creating admin: assign region + district */}
        {superAdmin && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className={labelCls}>Assign Region</div>
              <select value={dRegion} onChange={(e) => { setDRegion(e.target.value); setDDistrict(''); setDHospital(''); }} className={inputCls}>
                <option value="">-- Select Region --</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div className={labelCls}>Assign District</div>
              <select value={dDistrict} onChange={(e) => setDDistrict(e.target.value)} disabled={!dRegion} className={`${inputCls} disabled:opacity-50`}>
                <option value="">-- Select District --</option>
                {docDistrictOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Admin creating doctor: region/district locked to their scope */}
        {!superAdmin && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className={labelCls}>Region (locked)</div>
              <input value={adminRegion} readOnly className={`${inputCls} bg-slate-50 cursor-not-allowed opacity-70`} />
            </div>
            <div>
              <div className={labelCls}>District (locked)</div>
              <input value={adminDistrict} readOnly className={`${inputCls} bg-slate-50 cursor-not-allowed opacity-70`} />
            </div>
            <div>
              <div className={labelCls}>Hospital</div>
              <select value={dHospital} onChange={(e) => setDHospital(e.target.value)} className={inputCls}>
                <option value="">-- Select --</option>
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
              <tr className="text-[10px] uppercase tracking-[0.05em] font-bold text-slate-500">
                <th className="pb-2 px-2">User</th><th className="pb-2 px-2">Role</th><th className="pb-2 px-2">Hospital</th><th className="pb-2 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => (
                <tr key={u.id} style={{ background: '#f8fafc' }}>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-slate-800 text-[12px]">{u.displayName}</div>
                    <div className="text-[11px] text-slate-500 font-semibold">@{u.username}</div>
                  </td>
                  <td className="px-2 py-2">
                    <Chip cls="chip-gray">{u.isSuperAdmin ? 'superadmin' : u.role}</Chip>
                  </td>
                  <td className="px-2 py-2 text-[12px] text-slate-500">{u.hospital || '—'}</td>
                  <td className="px-2 py-2 text-right">
                    {canDeleteUser(u)
                      ? <Button size="sm" variant="danger" label="Delete" onClick={() => onDeleteUser(u.id)} />
                      : <span className="text-[11px] font-semibold text-slate-500">Protected</span>}
                  </td>
                </tr>
              ))}
              {!visibleUsers.length ? <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-500 font-semibold">No {superAdmin ? 'users' : 'doctors in your district'}.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Password Reset ──────────────────────────────── */}
      <div style={{ ...CARD_STYLE, padding: '20px' }}>
        <div className="font-sans font-semibold text-slate-800 text-[14px] mb-1">Reset Password</div>
        <div className="text-[12px] text-slate-500 mb-3">
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

      {/* ── Superadmin: Change Own Password ──────────────── */}
      {superAdmin && (
        <div style={{ ...CARD_STYLE, padding: '20px' }}>
          <div className="font-sans font-semibold text-slate-800 text-[14px] mb-1">Change My Password</div>
          <div className="text-[12px] text-slate-500 mb-3">
            Update your own superadmin password.
          </div>
          {selfPwErr ? <Alert variant="red">{selfPwErr}</Alert> : null}
          {selfPwOk  ? <Alert variant="green">{selfPwOk}</Alert>  : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div>
              <div className={labelCls}>Current password</div>
              <input value={selfPwCurrent} onChange={(e) => setSelfPwCurrent(e.target.value)} type="password" className={inputCls} placeholder="Current password" autoComplete="current-password" />
            </div>
            <div>
              <div className={labelCls}>New password</div>
              <input value={selfPwNew} onChange={(e) => setSelfPwNew(e.target.value)} type="password" className={inputCls} placeholder="Min 6 characters" autoComplete="new-password" />
            </div>
          </div>
          <div className="mt-3">
            <Button size="md" variant="primary" label="Change Password" onClick={onChangeSelfPassword} />
          </div>
        </div>
      )}

      {/* ── Backup & Restore ────────────────────────────── */}
      <BackupPanel />

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
      
      {/* ── Sync Controls ── */}
      <div className="mb-4">
        <SyncBar />
      </div>

      {/* Superadmin scope filter bar */}
      {superAdmin && (activePage === 'overview' || activePage === 'trends') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', flexWrap: 'wrap', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
          <span style={{ fontSize: '11px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🔭 Scope:
          </span>
          <select
            value={scopeRegion}
            onChange={(e) => { setScopeRegion(e.target.value); setScopeDistrict(''); }}
            style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '5px 10px', fontSize: '13px', background: '#fff', outline: 'none', color: '#1e293b' }}
          >
            <option value="">All Regions</option>
            {allRegions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={scopeDistrict}
            onChange={(e) => setScopeDistrict(e.target.value)}
            disabled={!scopeRegion}
            style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '5px 10px', fontSize: '13px', background: scopeRegion ? '#fff' : '#f9fafb', outline: 'none', color: '#1e293b', opacity: scopeRegion ? 1 : 0.5 }}
          >
            <option value="">All Districts</option>
            {scopeDistrictOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {(scopeRegion || scopeDistrict) && (
            <button
              onClick={() => { setScopeRegion(''); setScopeDistrict(''); }}
              style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            >
              ✕ Clear
            </button>
          )}
          <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", marginLeft: 'auto' }}>
            {scopedPatients.length} patients · {scopedHospitals.length} facilities
          </span>
        </div>
      )}

      {activePage === 'overview' && (
        <OverviewView patients={scopedPatients} hospitals={scopedHospitals} year={new Date().getFullYear()} scopeLabel={scopeLabel} />
      )}

      {activePage === 'trends' && (
        <AnalyticsBuilder
          scopedPatients={scopedPatients}
          scopeLabel={scopeLabel}
          isSuperAdmin={superAdmin}
        />
      )}

      {activePage === 'directory'       && <DirectoryPage />}
      {activePage === 'settings'         && <SettingsView />}
      {activePage === 'user-management'   && <SettingsView />}
    </PageWrapper>
  );
}
