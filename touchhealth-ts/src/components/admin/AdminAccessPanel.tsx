import type { Hospital, User } from '../../types';
import AdminHospitalPanel from './AdminHospitalPanel';
import AdminPasswordPanel from './AdminPasswordPanel';
import AdminUserPanel from './AdminUserPanel';

export default function AdminAccessPanel({
  superAdmin,
  regions,
  districtOptions,
  docDistrictOptions,
  docHospitalOptions,
  visibleHospitals,
  visibleUsers,
  pwCandidates,
  adminRegion,
  adminDistrict,
  hRegion,
  hDistrict,
  hName,
  hErr,
  uName,
  uUser,
  uPass,
  dRegion,
  dDistrict,
  dHospital,
  uErr,
  uOk,
  pwTargetId,
  pwNew,
  pwErr,
  pwOk,
  selfPwCurrent,
  selfPwNew,
  selfPwErr,
  selfPwOk,
  inputCls,
  labelCls,
  setHRegion,
  setHDistrict,
  setHName,
  setUName,
  setUUser,
  setUPass,
  setDRegion,
  setDDistrict,
  setDHospital,
  setPwTargetId,
  setPwNew,
  setSelfPwCurrent,
  setSelfPwNew,
  onAddHospital,
  onDeleteHospital,
  onAddUser,
  onDeleteUser,
  onResetPassword,
  onChangeSelfPassword,
  canDeleteUser,
}: {
  superAdmin: boolean;
  regions: string[];
  districtOptions: string[];
  docDistrictOptions: string[];
  docHospitalOptions: Hospital[];
  visibleHospitals: Hospital[];
  visibleUsers: User[];
  pwCandidates: User[];
  adminRegion: string;
  adminDistrict: string;
  hRegion: string;
  hDistrict: string;
  hName: string;
  hErr: string | null;
  uName: string;
  uUser: string;
  uPass: string;
  dRegion: string;
  dDistrict: string;
  dHospital: string;
  uErr: string | null;
  uOk: string | null;
  pwTargetId: string;
  pwNew: string;
  pwErr: string | null;
  pwOk: string | null;
  selfPwCurrent: string;
  selfPwNew: string;
  selfPwErr: string | null;
  selfPwOk: string | null;
  inputCls: string;
  labelCls: string;
  setHRegion: (value: string) => void;
  setHDistrict: (value: string) => void;
  setHName: (value: string) => void;
  setUName: (value: string) => void;
  setUUser: (value: string) => void;
  setUPass: (value: string) => void;
  setDRegion: (value: string) => void;
  setDDistrict: (value: string) => void;
  setDHospital: (value: string) => void;
  setPwTargetId: (value: string) => void;
  setPwNew: (value: string) => void;
  setSelfPwCurrent: (value: string) => void;
  setSelfPwNew: (value: string) => void;
  onAddHospital: () => void;
  onDeleteHospital: (id: string) => void;
  onAddUser: () => void | Promise<void>;
  onDeleteUser: (id: string) => void;
  onResetPassword: () => void | Promise<void>;
  onChangeSelfPassword: () => void;
  canDeleteUser: (user: User) => boolean;
}) {
  return (
    <>
      <AdminHospitalPanel
        superAdmin={superAdmin}
        regions={regions}
        districtOptions={districtOptions}
        visibleHospitals={visibleHospitals}
        hRegion={hRegion}
        hDistrict={hDistrict}
        hName={hName}
        hErr={hErr}
        inputCls={inputCls}
        labelCls={labelCls}
        setHRegion={setHRegion}
        setHDistrict={setHDistrict}
        setHName={setHName}
        onAddHospital={onAddHospital}
        onDeleteHospital={onDeleteHospital}
      />

      <AdminUserPanel
        superAdmin={superAdmin}
        regions={regions}
        docDistrictOptions={docDistrictOptions}
        docHospitalOptions={docHospitalOptions}
        visibleUsers={visibleUsers}
        adminRegion={adminRegion}
        adminDistrict={adminDistrict}
        uName={uName}
        uUser={uUser}
        uPass={uPass}
        dRegion={dRegion}
        dDistrict={dDistrict}
        dHospital={dHospital}
        uErr={uErr}
        uOk={uOk}
        inputCls={inputCls}
        labelCls={labelCls}
        setUName={setUName}
        setUUser={setUUser}
        setUPass={setUPass}
        setDRegion={setDRegion}
        setDDistrict={setDDistrict}
        setDHospital={setDHospital}
        onAddUser={onAddUser}
        onDeleteUser={onDeleteUser}
        canDeleteUser={canDeleteUser}
      />

      <AdminPasswordPanel
        superAdmin={superAdmin}
        pwCandidates={pwCandidates}
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
        setPwTargetId={setPwTargetId}
        setPwNew={setPwNew}
        setSelfPwCurrent={setSelfPwCurrent}
        setSelfPwNew={setSelfPwNew}
        onResetPassword={onResetPassword}
        onChangeSelfPassword={onChangeSelfPassword}
      />
    </>
  );
}
