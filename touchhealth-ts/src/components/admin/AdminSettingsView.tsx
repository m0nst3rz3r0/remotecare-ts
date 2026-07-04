import { useEffect, useMemo, useState } from 'react';
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
import BackupPanel from '../ui/BackupPanel';
import AdminAccessPanel from './AdminAccessPanel';
import AdminDevicePanel from './AdminDevicePanel';
import AdminSmsPanel from './AdminSmsPanel';

export default function AdminSettingsView({ patients, clinicSettings }: { patients: Patient[]; clinicSettings: any }) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const superAdmin = currentUser?.isSuperAdmin === true;

  const [hospitals, setHospitals] = useState<Hospital[]>(() => loadHospitals());
  const [users, setUsers] = useState<User[]>(() => loadUsers());
  const regions = useMemo(() => Object.keys(TZ_GEO).sort(), []);

  const [hRegion, setHRegion] = useState('');
  const [hDistrict, setHDistrict] = useState('');
  const [hName, setHName] = useState('');
  const [hErr, setHErr] = useState<string | null>(null);

  const [uName, setUName] = useState('');
  const [uUser, setUUser] = useState('');
  const [uPass, setUPass] = useState('');
  const [dRegion, setDRegion] = useState('');
  const [dDistrict, setDDistrict] = useState('');
  const [dHospital, setDHospital] = useState('');
  const [uErr, setUErr] = useState<string | null>(null);
  const [uOk, setUOk] = useState<string | null>(null);

  const [pwTargetId, setPwTargetId] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);

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

  const adminRegion = superAdmin ? '' : (currentUser?.adminRegion ?? '');
  const adminDistrict = superAdmin ? '' : (currentUser?.adminDistrict ?? '');

  const districtOptions = useMemo(() => {
    const region = superAdmin ? hRegion : adminRegion;
    return region ? TZ_GEO[region] ?? [] : [];
  }, [hRegion, superAdmin, adminRegion]);

  const docDistrictOptions = useMemo(() => {
    const region = superAdmin ? dRegion : adminRegion;
    return region ? TZ_GEO[region] ?? [] : [];
  }, [dRegion, superAdmin, adminRegion]);

  const docHospitalOptions = useMemo(() => {
    const region = superAdmin ? dRegion : adminRegion;
    const district = superAdmin ? dDistrict : adminDistrict;
    return (region && district) ? getHospitalsByRegionDistrict(region, district) : [];
  }, [dRegion, dDistrict, superAdmin, adminRegion, adminDistrict]);

  const visibleHospitals = useMemo(() => {
    if (superAdmin) return hospitals;
    return hospitals.filter((hospital) =>
      (!adminRegion || hospital.region === adminRegion) &&
      (!adminDistrict || hospital.district === adminDistrict),
    );
  }, [hospitals, superAdmin, adminRegion, adminDistrict]);

  const visibleUsers = useMemo(() => {
    if (superAdmin) return users;
    return users.filter((user) =>
      user.role === 'doctor' &&
      (!adminRegion || user.region === adminRegion) &&
      (!adminDistrict || user.district === adminDistrict),
    );
  }, [users, superAdmin, adminRegion, adminDistrict]);

  const canDeleteUser = (user: User) => !(user.isSuperAdmin || user.role === 'admin');

  const pwCandidates = useMemo(() => {
    if (superAdmin) return users.filter((user) => user.role === 'admin' && !user.isSuperAdmin);
    return users.filter((user) => user.role === 'doctor');
  }, [users, superAdmin]);

  const onAddHospital = () => {
    setHErr(null);
    const regionToUse = superAdmin ? hRegion : adminRegion;
    const districtToUse = superAdmin ? hDistrict : adminDistrict;
    const res = addHospital({ name: hName.trim(), region: regionToUse, district: districtToUse });
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

  const onAddUser = async () => {
    setUErr(null);
    setUOk(null);
    const role: 'admin' | 'doctor' = superAdmin ? 'admin' : 'doctor';
    const regionToUse = superAdmin ? dRegion : adminRegion;
    const districtToUse = superAdmin ? dDistrict : adminDistrict;
    const res: { success: boolean; error?: string } = await addUser({
      displayName: uName.trim(),
      username: uUser.trim(),
      password: uPass,
      role,
      hospital: role === 'doctor' ? dHospital : '',
      region: regionToUse,
      district: districtToUse,
      createdBy: currentUser,
    });
    if (!res.success) {
      setUErr(res.error ?? null);
      return;
    }
    setUOk(`${role === 'admin' ? 'Admin' : 'Doctor'} account created successfully.`);
    setUName('');
    setUUser('');
    setUPass('');
    setDRegion('');
    setDDistrict('');
    setDHospital('');
    refresh();
  };

  const onDeleteUser = (id: string) => {
    const target = users.find((user) => user.id === id);
    if (!target || !canDeleteUser(target)) return;
    deleteUser(id);
    refresh();
  };

  const onChangeSelfPassword = () => {
    setSelfPwErr(null);
    setSelfPwOk(null);
    if (!selfPwCurrent) {
      setSelfPwErr('Enter your current password.');
      return;
    }
    if (!selfPwNew) {
      setSelfPwErr('Enter a new password.');
      return;
    }
    if (selfPwNew.length < 6) {
      setSelfPwErr('Password must be at least 6 characters.');
      return;
    }
    const loadedUsers = loadUsers();
    const me = loadedUsers.find((user) => user.id === currentUser?.id);
    if (!me || me.password !== selfPwCurrent) {
      setSelfPwErr('Current password is incorrect.');
      return;
    }
    saveUsers(loadedUsers.map((user) => user.id === me.id ? { ...user, password: selfPwNew } : user));
    setSelfPwOk('Password changed successfully!');
    setSelfPwCurrent('');
    setSelfPwNew('');
  };

  const onResetPassword = async () => {
    setPwErr(null);
    setPwOk(null);
    if (!pwTargetId) {
      setPwErr('Select a user first.');
      return;
    }
    const res: { success: boolean; error?: string } = await updateUserPassword(pwTargetId, pwNew, currentUser);
    if (!res.success) {
      setPwErr(res.error ?? null);
      return;
    }
    setPwOk('Password updated successfully.');
    setPwTargetId('');
    setPwNew('');
  };

  const inputCls = 'w-full rounded-md border border-slate-300 px-3 py-2 outline-none bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500';
  const labelCls = 'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1';

  return (
    <div className="space-y-4">
      <ZoneSettingsPanel />

      <AdminAccessPanel
        superAdmin={superAdmin}
        regions={regions}
        districtOptions={districtOptions}
        docDistrictOptions={docDistrictOptions}
        docHospitalOptions={docHospitalOptions}
        visibleHospitals={visibleHospitals}
        visibleUsers={visibleUsers}
        pwCandidates={pwCandidates}
        adminRegion={adminRegion}
        adminDistrict={adminDistrict}
        hRegion={hRegion}
        hDistrict={hDistrict}
        hName={hName}
        hErr={hErr}
        uName={uName}
        uUser={uUser}
        uPass={uPass}
        dRegion={dRegion}
        dDistrict={dDistrict}
        dHospital={dHospital}
        uErr={uErr}
        uOk={uOk}
        pwTargetId={pwTargetId}
        pwNew={pwNew}
        pwErr={pwErr}
        pwOk={pwOk}
        selfPwCurrent={selfPwCurrent}
        selfPwNew={selfPwNew}
        selfPwErr={selfPwErr}
        selfPwOk={selfPwOk}
        inputCls={inputCls}
        labelCls={labelCls}
        setHRegion={setHRegion}
        setHDistrict={setHDistrict}
        setHName={setHName}
        setUName={setUName}
        setUUser={setUUser}
        setUPass={setUPass}
        setDRegion={setDRegion}
        setDDistrict={setDDistrict}
        setDHospital={setDHospital}
        setPwTargetId={setPwTargetId}
        setPwNew={setPwNew}
        setSelfPwCurrent={setSelfPwCurrent}
        setSelfPwNew={setSelfPwNew}
        onAddHospital={onAddHospital}
        onDeleteHospital={onDeleteHospital}
        onAddUser={onAddUser}
        onDeleteUser={onDeleteUser}
        onResetPassword={onResetPassword}
        onChangeSelfPassword={onChangeSelfPassword}
        canDeleteUser={canDeleteUser}
      />

      <AdminDevicePanel users={users} />
      <AdminSmsPanel hospitals={hospitals} patients={patients} clinicSettings={clinicSettings} />
      <BackupPanel />
    </div>
  );
}
