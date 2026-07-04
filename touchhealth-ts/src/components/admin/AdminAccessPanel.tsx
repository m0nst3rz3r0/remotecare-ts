import type { Hospital, User } from '../../types';
import Chip from '../ui/Chip';
import Button from '../ui/Button';
import Alert from '../ui/Alert';

const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
};

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
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="font-sans font-semibold text-slate-800 text-[14px] mb-2">Hospital Management</div>
        {hErr ? <Alert variant="red">Could not add hospital: {hErr}</Alert> : null}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <div className={labelCls}>Region</div>
            <select value={hRegion} onChange={(e) => { setHRegion(e.target.value); setHDistrict(''); }} className={inputCls}>
              <option value="">- Select -</option>
              {regions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </div>
          <div>
            <div className={labelCls}>District</div>
            <select value={hDistrict} onChange={(e) => setHDistrict(e.target.value)} disabled={!hRegion} className={`${inputCls} disabled:opacity-50`}>
              <option value="">- Select -</option>
              {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
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
              {visibleHospitals.map((hospital) => (
                <tr key={hospital.id} style={{ background: '#f8fafc' }}>
                  <td className="px-2 py-2 font-semibold text-slate-800 text-[12px]">{hospital.name}</td>
                  <td className="px-2 py-2 text-[12px] text-slate-500">{hospital.region}</td>
                  <td className="px-2 py-2 text-[12px] text-slate-500">{hospital.district}</td>
                  <td className="px-2 py-2 text-right"><Button size="sm" variant="danger" label="Delete" onClick={() => onDeleteHospital(hospital.id)} /></td>
                </tr>
              ))}
              {!visibleHospitals.length ? <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-500 font-semibold">No hospitals configured{!superAdmin ? ' in your district' : ''}.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

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
        {uOk ? <Alert variant="green">{uOk}</Alert> : null}

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

        {superAdmin && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className={labelCls}>Assign Region</div>
              <select value={dRegion} onChange={(e) => { setDRegion(e.target.value); setDDistrict(''); setDHospital(''); }} className={inputCls}>
                <option value="">-- Select Region --</option>
                {regions.map((region) => <option key={region} value={region}>{region}</option>)}
              </select>
            </div>
            <div>
              <div className={labelCls}>Assign District</div>
              <select value={dDistrict} onChange={(e) => setDDistrict(e.target.value)} disabled={!dRegion} className={`${inputCls} disabled:opacity-50`}>
                <option value="">-- Select District --</option>
                {docDistrictOptions.map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
            </div>
          </div>
        )}

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
                {docHospitalOptions.map((hospital) => <option key={hospital.id} value={hospital.name}>{hospital.name}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="mt-3">
          <Button size="md" variant="primary" label={superAdmin ? 'Create Admin' : 'Create Doctor'} onClick={onAddUser} />
        </div>

        <div className="mt-4 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.05em] font-bold text-slate-500">
                <th className="pb-2 px-2">User</th><th className="pb-2 px-2">Role</th><th className="pb-2 px-2">Hospital</th><th className="pb-2 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id} style={{ background: '#f8fafc' }}>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-slate-800 text-[12px]">{user.displayName}</div>
                    <div className="text-[11px] text-slate-500 font-semibold">@{user.username}</div>
                  </td>
                  <td className="px-2 py-2">
                    <Chip cls="chip-gray">{user.isSuperAdmin ? 'superadmin' : user.role}</Chip>
                  </td>
                  <td className="px-2 py-2 text-[12px] text-slate-500">{user.hospital || '-'}</td>
                  <td className="px-2 py-2 text-right">
                    {canDeleteUser(user)
                      ? <Button size="sm" variant="danger" label="Delete" onClick={() => onDeleteUser(user.id)} />
                      : <span className="text-[11px] font-semibold text-slate-500">Protected</span>}
                  </td>
                </tr>
              ))}
              {!visibleUsers.length ? <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-500 font-semibold">No {superAdmin ? 'users' : 'doctors in your district'}.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...CARD_STYLE, padding: '20px' }}>
        <div className="font-sans font-semibold text-slate-800 text-[14px] mb-1">Reset Password</div>
        <div className="text-[12px] text-slate-500 mb-3">
          {superAdmin
            ? 'Reset passwords for admin accounts.'
            : 'Reset passwords for doctor accounts in your district.'}
        </div>
        {pwErr ? <Alert variant="red">{pwErr}</Alert> : null}
        {pwOk ? <Alert variant="green">{pwOk}</Alert> : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <div>
            <div className={labelCls}>Select user</div>
            <select value={pwTargetId} onChange={(e) => setPwTargetId(e.target.value)} className={inputCls}>
              <option value="">- Select -</option>
              {pwCandidates.map((user) => (
                <option key={user.id} value={user.id}>{user.displayName} (@{user.username})</option>
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

      {superAdmin && (
        <div style={{ ...CARD_STYLE, padding: '20px' }}>
          <div className="font-sans font-semibold text-slate-800 text-[14px] mb-1">Change My Password</div>
          <div className="text-[12px] text-slate-500 mb-3">
            Update your own superadmin password.
          </div>
          {selfPwErr ? <Alert variant="red">{selfPwErr}</Alert> : null}
          {selfPwOk ? <Alert variant="green">{selfPwOk}</Alert> : null}
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
    </>
  );
}
