import React, { useEffect, useMemo, useState } from 'react';
import ZoneSettingsPanel from '../ZoneSettingsPanel';
import type { Hospital, Patient, User } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { TZ_GEO } from '../../utils/geo';
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
} from '../../services/auth';
import Chip from '../ui/Chip';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import BackupPanel from '../ui/BackupPanel';
import AdminDevicePanel from './AdminDevicePanel';
import AdminSmsPanel from './AdminSmsPanel';

const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
};

export default function AdminSettingsView({ patients, clinicSettings }: { patients: Patient[]; clinicSettings: any }) {
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
  const [selfPwNew, setSelfPwNew] = useState('');
  const [selfPwErr, setSelfPwErr] = useState<string | null>(null);
  const [selfPwOk, setSelfPwOk] = useState<string | null>(null);

  const refresh = () => {
    setHospitals(loadHospitals());
    setUsers(loadUsers());
  };
  useEffect(() => {
    refresh();
  }, []);

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
      <AdminDevicePanel users={users} />
      <AdminSmsPanel hospitals={hospitals} patients={patients} clinicSettings={clinicSettings} />
      {/* ── Backup & Restore ────────────────────────────── */}
      <BackupPanel />

    </div>
  );
}
