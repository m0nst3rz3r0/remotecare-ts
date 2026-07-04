import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import ZoneSettingsPanel from '../components/ZoneSettingsPanel';
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
import { getDevicePrefix, setDevicePrefix } from '../services/devicePrefix';
import {
  getFacilityDevicesWithDoctors,
  assignDevicePrefix,
  unassignDevicePrefix,
  assignDoctorToDevice,
  formatDeviceInfo,
  timeSinceLastSeen,
  getAvailablePrefixes,
  type DeviceRecord,
} from '../services/deviceManager';

// Components
import SyncBar from '../components/ui/SyncBar';
import Chip from '../components/ui/Chip';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import BackupPanel from '../components/ui/BackupPanel';
import {
  buildSMSPreview,
  sendSMS as sendSMSService,
  daysUntilAppointment,
  buildSMSMessage,
  getPatientNextDate,
  getPatientSMSReason,
  filterPatientsForSmsTab,
  getLastSmsForPatient,
  formatSmsSentLabel,
  smsAlreadySentRecently,
} from '../services/sms';
import { loadSMSConfig, saveSMSConfig, loadSMSLog } from '../services/storage';
import type { SMSConfig } from '../types';
import { maskPhone } from '../utils/phone';

import { Target, Smartphone, X, Send } from 'lucide-react';
import { AdminBulkConfirmModal, OverviewView, titleForAdminPage } from '../components/admin/AdminOverview';
const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
};

const DirectoryPage = lazy(() => import('./DirectoryPage'));
const AnalyticsBuilder = lazy(() => import('./AnalyticsBuilder'));

function AdminSectionFallback() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-[13px] text-slate-500">
      Loading section...
    </div>
  );
}

// ── Design tokens — aligned with the rest of the app ─────────
function SettingsView({ patients, clinicSettings }: { patients: Patient[]; clinicSettings: any }) {
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

  // Device Prefix
  const [dpValue,   setDpValue]   = useState(() => getDevicePrefix() ?? '');
  const [dpErr,     setDpErr]     = useState<string | null>(null);
  const [dpOk,      setDpOk]      = useState<string | null>(null);
  const savedPrefix = getDevicePrefix();

  // Device Management (Remote)
  const [devices,       setDevices]       = useState<DeviceRecord[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceErr,     setDeviceErr]     = useState<string | null>(null);
  const [availablePrefixes, setAvailablePrefixes] = useState<string[]>([]);

  // SMS (for Admin's facility)
  const [smsConfig, setSmsConfig]     = useState<SMSConfig>(() => loadSMSConfig());
  const [smsLog,    setSmsLog]      = useState(() => loadSMSLog());
  const [smsSending, setSmsSending] = useState<Record<string, boolean>>({});
  const [smsReason, setSmsReason] = useState<Record<string, 'reminder' | 'missed_appointment' | 'ltfu_warning' | 'welcome'>>({});
  const [smsFeedback, setSmsFeedback] = useState<Record<string, string>>({});
  const [smsLang,   setSmsLang]     = useState<'en' | 'sw'>('en');
  const [smsTab,    setSmsTab]      = useState<'ltfu' | 'overdue' | 'reminder' | 'all'>('reminder');
  const [smsHospital, setSmsHospital] = useState<string>('');
  const [smsConfigSaved, setSmsConfigSaved] = useState(false);
  const [smsTemplateTab, setSmsTemplateTab] = useState<'reminder' | 'missed' | 'ltfu' | 'welcome'>('reminder');

  const smsSenderName = currentUser?.displayName ?? currentUser?.username ?? 'Admin';

  type SmsBulkPhase = 'idle' | 'confirm' | 'sending' | 'done';
  const [smsSelected, setSmsSelected] = useState<Set<number>>(new Set());
  const [smsBulkPhase, setSmsBulkPhase] = useState<SmsBulkPhase>('idle');
  const [smsBulkProgress, setSmsBulkProgress] = useState({ current: 0, total: 0 });
  const [smsBulkResult, setSmsBulkResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const smsBulkAbortRef = useRef(false);
  const BULK_RATE_MS = 220;

  const smsFilteredPatients = useMemo(() => {
    if (!smsHospital) return [];
    return filterPatientsForSmsTab(patients, smsTab, clinicSettings, smsHospital);
  }, [patients, smsTab, clinicSettings, smsHospital]);

  const smsSelectedPatients = useMemo(
    () => smsFilteredPatients.filter((p) => smsSelected.has(p.id)),
    [smsFilteredPatients, smsSelected],
  );

  const smsSelectableIds = useMemo(
    () => smsFilteredPatients.filter((p) => p.phone).map((p) => p.id),
    [smsFilteredPatients],
  );

  useEffect(() => {
    setSmsSelected(new Set());
    setSmsBulkPhase('idle');
    setSmsBulkResult(null);
  }, [smsHospital, smsTab]);

  const toggleSmsSelect = useCallback((id: number) => {
    setSmsSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllSms = useCallback(() => {
    setSmsSelected(new Set(smsSelectableIds));
  }, [smsSelectableIds]);

  const clearSmsSelection = useCallback(() => {
    setSmsSelected(new Set());
    setSmsBulkPhase('idle');
    setSmsBulkResult(null);
  }, []);

  const handleSmsBulkConfirm = useCallback(async () => {
    const candidates = smsSelectedPatients.filter((p) => p.phone);
    const toSend = candidates.filter((p) => !smsAlreadySentRecently(p.id, 3));
    const skippedRecent = candidates.length - toSend.length;
    const skippedNoPhone = smsSelectedPatients.length - candidates.length;

    setSmsBulkPhase('sending');
    setSmsBulkProgress({ current: 0, total: toSend.length });
    smsBulkAbortRef.current = false;

    let sent = 0;
    let failed = 0;
    const entries: Awaited<ReturnType<typeof sendSMSService>>[] = [];

    for (let i = 0; i < toSend.length; i++) {
      if (smsBulkAbortRef.current) break;
      const p = toSend[i];
      setSmsBulkProgress({ current: i + 1, total: toSend.length });
      const reason = smsReason[p.id] ?? getPatientSMSReason(p, clinicSettings) ?? 'reminder';
      try {
        const entry = await sendSMSService(
          p,
          smsLang,
          smsConfig,
          clinicSettings,
          reason,
          smsSenderName,
        );
        entries.push(entry);
        if (entry.status === 'sent' || entry.status === 'demo') sent++;
        else failed++;
      } catch {
        failed++;
      }
      if (i < toSend.length - 1) await new Promise((r) => setTimeout(r, BULK_RATE_MS));
    }

    if (entries.length) {
      setSmsLog(loadSMSLog());
    }

    setSmsBulkResult({ sent, failed, skipped: skippedRecent + skippedNoPhone });
    setSmsBulkPhase('done');
    setSmsSelected(new Set());
  }, [
    smsSelectedPatients,
    smsReason,
    clinicSettings,
    smsLang,
    smsConfig,
    smsSenderName,
  ]);

  const smsBulkPct = smsBulkProgress.total
    ? Math.round((smsBulkProgress.current / smsBulkProgress.total) * 100)
    : 0;

  // Save SMS config handler
  const handleSaveSMSConfig = () => {
    saveSMSConfig(smsConfig);
    setSmsConfigSaved(true);
    setTimeout(() => setSmsConfigSaved(false), 2000);
  };

  // Superadmin own password change
  const [selfPwCurrent, setSelfPwCurrent] = useState('');
  const [selfPwNew,     setSelfPwNew]     = useState('');
  const [selfPwErr,     setSelfPwErr]     = useState<string | null>(null);
  const [selfPwOk,      setSelfPwOk]      = useState<string | null>(null);

  const refresh = () => { setHospitals(loadHospitals()); setUsers(loadUsers()); };
  useEffect(() => { refresh(); }, []);

  // Load devices for remote management
  const loadDevices = async () => {
    if (!currentUser?.sessionRegion || !currentUser?.sessionDistrict || !currentUser?.sessionHospital) return;
    setDeviceLoading(true);
    setDeviceErr(null);
    try {
      const facilityDevices = await getFacilityDevicesWithDoctors(
        currentUser.sessionRegion,
        currentUser.sessionDistrict,
        currentUser.sessionHospital
      );
      setDevices(facilityDevices);
      const available = await getAvailablePrefixes(
        currentUser.sessionRegion,
        currentUser.sessionDistrict,
        currentUser.sessionHospital
      );
      setAvailablePrefixes(available);
    } catch (e) {
      setDeviceErr(e instanceof Error ? e.message : 'Failed to load devices');
    } finally {
      setDeviceLoading(false);
    }
  };

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
  const canDeleteUser = (u: User) => !(u.isSuperAdmin || u.role === 'admin');

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

      <ZoneSettingsPanel />

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

      {/* ── Device Prefix ────────────────────────────────── */}
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
          Assign a unique letter (A–Z) to this device so patient codes never
          collide with a second tablet at the same facility.{' '}
          <strong>Example:</strong> Device A generates <code className="bg-slate-100 px-1 rounded">KG-BK-ZMZ-A-M0001</code>,
          Device B generates <code className="bg-slate-100 px-1 rounded">KG-BK-ZMZ-B-M0001</code>.
          Both devices still see <em>all</em> patients at the facility.
        </p>
        {dpErr && <div className="text-[11px] text-red-600 font-semibold mb-2">{dpErr}</div>}
        {dpOk  && <div className="text-[11px] text-emerald-700 font-semibold mb-2">{dpOk}</div>}
        <div className="flex items-center gap-3">
          <input
            type="text"
            maxLength={1}
            placeholder="e.g. A"
            value={dpValue}
            onChange={(e) => { setDpValue(e.target.value.toUpperCase()); setDpErr(null); setDpOk(null); }}
            className="w-16 border border-slate-300 rounded px-3 py-1.5 text-center font-mono text-lg font-bold uppercase bg-slate-50 focus:outline-none focus:border-teal-500"
          />
          <button
            className="px-4 py-1.5 rounded bg-teal-700 text-white text-[12px] font-bold hover:bg-teal-800"
            onClick={() => {
              try {
                setDevicePrefix(dpValue);
                setDpOk(`Device prefix set to "${dpValue.toUpperCase()}" — new patients will use this prefix.`);
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
              ⚠ Changing prefix does not rename existing patients.
            </span>
          )}
        </div>
      </div>

      {/* ── Remote Device Management ───────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <div className="font-sans font-bold text-slate-800 text-[13px] mb-1 flex items-center gap-2">
          <span>Remote Device Management</span>
        </div>
        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
          Manage all devices at this facility remotely. Assign prefixes (A–Z) to each device
          from any admin dashboard. Devices automatically receive their prefix on next sync.
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
                          {info.status === 'online' ? '● Online' : '○ Offline'}
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
                              .filter((u: User) => u.role === 'doctor')
                              .map((doctor: User) => (
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

      {/* ── SMS Configuration ─────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <div className="font-sans font-bold text-slate-800 text-[13px] mb-1 flex items-center gap-2">
          <Smartphone size={16} />
          <span>SMS Configuration</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-bold border border-sky-200">
            Server-managed secrets
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
          Configure messaging behavior and templates. Provider secrets are managed server-side in the SMS edge function.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Sender ID</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px]"
              value={smsConfig.senderId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmsConfig((prev: SMSConfig) => ({ ...prev, senderId: e.target.value }))}
              placeholder="e.g. RemoteCare"
            />
          </div>
          <div className="flex items-end">
            <button
              className="px-4 py-1.5 rounded bg-teal-700 text-white text-[12px] font-bold hover:bg-teal-800 disabled:opacity-50"
              onClick={handleSaveSMSConfig}
            >
              {smsConfigSaved ? 'Saved!' : 'Save Config'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <div className="flex gap-2 flex-wrap mb-3">
              {([
                { id: 'reminder', label: 'Reminder' },
                { id: 'missed', label: 'Missed visit' },
                { id: 'ltfu', label: 'LTFU warning' },
                { id: 'welcome', label: 'Welcome' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${
                    smsTemplateTab === tab.id
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  onClick={() => setSmsTemplateTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {smsTemplateTab === 'reminder' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">English · Reminder</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.template}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev: SMSConfig) => ({ ...prev, template: e.target.value }))}
                  placeholder="Dear {name}, your appointment at {hospital} is on {date}."
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Swahili · Reminder</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateSw}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev: SMSConfig) => ({ ...prev, templateSw: e.target.value }))}
                  placeholder="Habari {name}, ziara yako {hospital} ni tarehe {date}."
                />
              </div>
            </>
          )}

          {smsTemplateTab === 'missed' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">English · Missed visit</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateMissed ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev: SMSConfig) => ({ ...prev, templateMissed: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Swahili · Missed visit</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateMissedSw ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev: SMSConfig) => ({ ...prev, templateMissedSw: e.target.value }))}
                />
              </div>
            </>
          )}

          {smsTemplateTab === 'ltfu' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">English · LTFU warning</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateLtfu ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev: SMSConfig) => ({ ...prev, templateLtfu: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Swahili · LTFU warning</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateLtfuSw ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev: SMSConfig) => ({ ...prev, templateLtfuSw: e.target.value }))}
                />
              </div>
            </>
          )}

          {smsTemplateTab === 'welcome' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">English · Welcome</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateWelcome ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev: SMSConfig) => ({ ...prev, templateWelcome: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Swahili · Welcome</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateWelcomeSw ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev: SMSConfig) => ({ ...prev, templateWelcomeSw: e.target.value }))}
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <p className="text-[10px] text-slate-400">Variables: {'{name}'}, {'{hospital}'}, {'{date}'}</p>
          </div>
        </div>
      </div>

      {/* ── SMS Management ────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <div className="font-sans font-bold text-slate-800 text-[13px] mb-1 flex items-center gap-2">
          <Smartphone size={16} />
          <span>SMS Reminders</span>
        </div>
        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
          Send appointment reminders to patients at your facility. Messages already sent by a doctor in the last 3 days are flagged to avoid duplicates.
        </p>

        {/* Hospital Selection & SMS Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            className="border border-slate-300 rounded px-3 py-1.5 text-[12px] bg-white flex-shrink-0"
            value={smsHospital}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSmsHospital(e.target.value)}
          >
            <option value="">Select Hospital...</option>
            {hospitals.map((h: Hospital) => (
              <option key={h.id} value={h.name}>
                {h.name} ({h.district})
              </option>
            ))}
          </select>

          <div className="flex gap-2 flex-wrap">
            {[
              { k: 'ltfu', l: 'LTFU' },
              { k: 'overdue', l: 'Overdue' },
              { k: 'reminder', l: 'Reminders' },
              { k: 'all', l: 'All' },
            ].map((t) => (
              <button
                key={t.k}
                className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${
                  smsTab === t.k
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                onClick={() => setSmsTab(t.k as typeof smsTab)}
              >
                {t.l}
              </button>
            ))}
          </div>

          <select
            className="sm:ml-auto border border-slate-300 rounded px-2 py-1 text-[11px] bg-white"
            value={smsLang}
            onChange={(e) => setSmsLang(e.target.value as 'en' | 'sw')}
          >
            <option value="en">English</option>
            <option value="sw">Swahili</option>
          </select>
        </div>

        {/* Selected Hospital Display */}
        {smsHospital && (
          <div className="mb-3 px-3 py-2 bg-slate-50 rounded border border-slate-200">
            <span className="text-[11px] text-slate-600">Selected Facility: </span>
            <span className="text-[11px] font-bold text-slate-800">{smsHospital}</span>
          </div>
        )}

        {/* Patient List for SMS */}
        {!smsHospital ? (
          <div className="text-center py-6 text-slate-500 text-[12px]">
            Please select a hospital from the dropdown above to view patients.
          </div>
        ) : smsFilteredPatients.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-[12px]">
            No patients match the selected filter at {smsHospital}.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-3">
              <button
                type="button"
                onClick={() =>
                  smsSelected.size === smsSelectableIds.length ? clearSmsSelection() : selectAllSms()
                }
                className="text-[11px] font-bold text-teal-700 hover:text-teal-900"
              >
                {smsSelected.size > 0
                  ? `${smsSelected.size} selected · Clear`
                  : `Select all (${smsSelectableIds.length})`}
              </button>
              <span className="text-[10px] text-slate-500">
                {smsFilteredPatients.length} patient{smsFilteredPatients.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 w-8" />
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Patient</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Phone</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Last SMS</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {smsFilteredPatients.map((patient) => {
                    const smsPreview = buildSMSPreview(patient, smsConfig, clinicSettings, smsLang, smsReason[patient.id]);
                    const days = smsPreview?.daysUntil ?? daysUntilAppointment(patient, clinicSettings);
                    const resolvedReason = smsPreview?.reason ?? getPatientSMSReason(patient, clinicSettings) ?? 'reminder';
                    const preview = smsPreview?.message ?? buildSMSMessage(
                      patient,
                      smsConfig,
                      smsLang,
                      getPatientNextDate(patient, clinicSettings),
                      resolvedReason
                    );
                    const lastSms = getLastSmsForPatient(smsLog, patient.id);
                    const sentLabel = formatSmsSentLabel(lastSms);
                    const recentlySent = smsAlreadySentRecently(patient.id, 3);
                    let statusLabel = '';
                    let statusColor = '';
                    if (patient.status === 'ltfu') {
                      statusLabel = 'LTFU';
                      statusColor = 'text-red-600';
                    } else if (days < 0) {
                      statusLabel = `${Math.abs(days)}d overdue`;
                      statusColor = 'text-red-600';
                    } else if (days <= 7) {
                      statusLabel = `Due in ${days}d`;
                      statusColor = 'text-amber-600';
                    } else {
                      statusLabel = `Due in ${days}d`;
                      statusColor = 'text-emerald-600';
                    }

                    return (
                      <tr key={patient.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={smsSelected.has(patient.id)}
                            disabled={!patient.phone}
                            onChange={() => toggleSmsSelect(patient.id)}
                            className="accent-teal-700"
                            aria-label={`Select ${patient.code}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{patient.code}</div>
                          <div className="text-[10px] text-slate-500">{patient.region} · {patient.district}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{maskPhone(patient.phone || '')}</td>
                        <td className={`px-3 py-2 font-medium ${statusColor}`}>{statusLabel}</td>
                        <td className="px-3 py-2">
                          {sentLabel ? (
                            <div className={`text-[10px] font-semibold ${recentlySent ? 'text-amber-700' : 'text-slate-600'}`}>
                              {sentLabel}
                              {recentlySent ? (
                                <div className="text-[9px] font-bold uppercase tracking-wide text-amber-600 mt-0.5">
                                  Already sent recently
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">Not sent</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-2">
                            <select
                              className="border border-slate-300 rounded px-2 py-1 text-[11px] bg-white"
                              value={resolvedReason}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                setSmsReason((prev) => ({
                                  ...prev,
                                  [patient.id]: e.target.value as 'reminder' | 'missed_appointment' | 'ltfu_warning' | 'welcome',
                                }))
                              }
                            >
                              <option value="reminder">Reminder</option>
                              <option value="missed_appointment">Missed appointment</option>
                              <option value="ltfu_warning">LTFU warning</option>
                              <option value="welcome">Welcome</option>
                            </select>
                          <button
                            className="px-3 py-1 rounded bg-teal-700 text-white text-[11px] font-bold hover:bg-teal-800 disabled:opacity-50"
                            disabled={smsSending[patient.id] || !patient.phone}
                            onClick={async () => {
                              if (!patient.phone) return;
                              const duplicateNote = recentlySent && sentLabel
                                ? `\n\nNote: ${sentLabel}.`
                                : '';
                              const proceed = window.confirm(
                                recentlySent
                                  ? `An SMS was already sent to ${patient.code} recently.${duplicateNote}\n\nSend another ${resolvedReason.replace('_', ' ')} message anyway?\n\nPreview:\n${preview}`
                                  : `Send ${resolvedReason.replace('_', ' ')} SMS to ${patient.code}?\n\nPreview:\n${preview}`
                              );
                              if (!proceed) return;
                              setSmsSending((prev) => ({ ...prev, [patient.id]: true }));
                              setSmsFeedback((prev) => ({ ...prev, [patient.id]: '' }));
                              try {
                                const entry = await sendSMSService(
                                  patient,
                                  smsLang,
                                  smsConfig,
                                  clinicSettings,
                                  resolvedReason,
                                  smsSenderName,
                                );
                                setSmsLog(loadSMSLog());
                                setSmsFeedback((prev) => ({
                                  ...prev,
                                  [patient.id]:
                                    entry.status === 'sent' || entry.status === 'demo'
                                      ? `Sent (${entry.status})`
                                      : `Failed: ${entry.note ?? 'Unknown error'}`,
                                }));
                              } finally {
                                setSmsSending((prev) => ({ ...prev, [patient.id]: false }));
                              }
                            }}
                          >
                            {smsSending[patient.id] ? 'Sending...' : 'Send SMS'}
                          </button>
                          <div className="text-[10px] text-slate-500 max-w-[320px] truncate" title={preview}>
                            Preview: {preview}
                          </div>
                          {smsFeedback[patient.id] && (
                            <div className={`text-[10px] font-semibold ${smsFeedback[patient.id].startsWith('Failed') ? 'text-red-600' : 'text-emerald-700'}`}>
                              {smsFeedback[patient.id]}
                            </div>
                          )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {smsBulkPhase === 'confirm' && (
          <AdminBulkConfirmModal
            patients={smsSelectedPatients}
            lang={smsLang}
            smsConfig={smsConfig}
            clinicSettings={clinicSettings}
            smsReason={smsReason}
            onConfirm={handleSmsBulkConfirm}
            onCancel={() => setSmsBulkPhase('idle')}
          />
        )}

        {smsBulkResult && smsBulkPhase === 'done' && (
          <div className="mt-3 px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 text-[12px] text-emerald-900 flex items-center justify-between gap-3">
            <span>
              Bulk send complete: <strong>{smsBulkResult.sent}</strong> sent
              {smsBulkResult.failed > 0 ? `, ${smsBulkResult.failed} failed` : ''}
              {smsBulkResult.skipped > 0 ? `, ${smsBulkResult.skipped} skipped` : ''}.
            </span>
            <button
              type="button"
              onClick={() => { setSmsBulkPhase('idle'); setSmsBulkResult(null); }}
              className="text-emerald-700 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {(smsSelected.size > 0 && smsBulkPhase === 'idle') || smsBulkPhase === 'sending' ? (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] w-[min(580px,95vw)] bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
            {smsBulkPhase === 'sending' && (
              <div className="h-1 bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${smsBulkPct}%` }}
                />
              </div>
            )}
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <Smartphone size={18} className="text-emerald-400 shrink-0" />
              {smsBulkPhase === 'idle' && (
                <>
                  <div className="flex-1 min-w-[180px]">
                    <div className="font-bold text-white text-[13px]">
                      {smsSelected.size} patient{smsSelected.size !== 1 ? 's' : ''} selected
                    </div>
                    <div className="text-[10px] text-white/45 mt-0.5">
                      {smsLang === 'sw' ? 'Swahili' : 'English'} · Uses each patient&apos;s message type
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmsBulkPhase('confirm')}
                    className="px-4 py-2 rounded-lg bg-teal-600 text-white text-[11px] font-bold flex items-center gap-2"
                  >
                    <Send size={13} />
                    Preview &amp; Send
                  </button>
                  <button type="button" onClick={clearSmsSelection} className="text-white/40 hover:text-white p-1">
                    <X size={16} />
                  </button>
                </>
              )}
              {smsBulkPhase === 'sending' && (
                <>
                  <div className="flex-1">
                    <div className="font-bold text-white text-[13px]">
                      Sending… {smsBulkProgress.current} / {smsBulkProgress.total}
                    </div>
                    <div className="text-[10px] text-white/45">{smsBulkPct}% complete</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { smsBulkAbortRef.current = true; }}
                    className="px-3 py-1.5 rounded border border-white/20 text-white/70 text-[11px] font-bold"
                  >
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Backup & Restore ────────────────────────────── */}
      <BackupPanel />

    </div>
  );
}

// ── Main AdminPage ────────────────────────────────────────────
export default function AdminPage() {
  const activePage      = useUIStore((s) => s.activePage);
  const clinicSettings  = useUIStore((s) => s.clinicSettings);
  const patients        = usePatientStore((s) => s.patients);
  const currentUser     = useAuthStore((s) => s.currentUser);
  const superAdmin      = currentUser?.isSuperAdmin === true;

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
          <span style={{ fontSize: '11px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Target size={14} /> Scope:
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={12} /> Clear</span>
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
        <Suspense fallback={<AdminSectionFallback />}>
          <AnalyticsBuilder
            scopedPatients={scopedPatients}
            scopeLabel={scopeLabel}
            isSuperAdmin={superAdmin}
          />
        </Suspense>
      )}

      {activePage === 'directory' && (
        <Suspense fallback={<AdminSectionFallback />}>
          <DirectoryPage />
        </Suspense>
      )}
      {activePage === 'settings'         && <SettingsView patients={patients} clinicSettings={clinicSettings} />}
      {activePage === 'user-management'   && <SettingsView patients={patients} clinicSettings={clinicSettings} />}
    </PageWrapper>
  );
}


