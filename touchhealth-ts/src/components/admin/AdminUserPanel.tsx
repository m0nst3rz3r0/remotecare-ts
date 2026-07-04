import type { Hospital, User } from '../../types';
import Chip from '../ui/Chip';
import Button from '../ui/Button';
import Alert from '../ui/Alert';

export default function AdminUserPanel({
  superAdmin,
  regions,
  docDistrictOptions,
  docHospitalOptions,
  visibleUsers,
  adminRegion,
  adminDistrict,
  uName,
  uUser,
  uPass,
  dRegion,
  dDistrict,
  dHospital,
  uErr,
  uOk,
  inputCls,
  labelCls,
  setUName,
  setUUser,
  setUPass,
  setDRegion,
  setDDistrict,
  setDHospital,
  onAddUser,
  onDeleteUser,
  canDeleteUser,
}: {
  superAdmin: boolean;
  regions: string[];
  docDistrictOptions: string[];
  docHospitalOptions: Hospital[];
  visibleUsers: User[];
  adminRegion: string;
  adminDistrict: string;
  uName: string;
  uUser: string;
  uPass: string;
  dRegion: string;
  dDistrict: string;
  dHospital: string;
  uErr: string | null;
  uOk: string | null;
  inputCls: string;
  labelCls: string;
  setUName: (value: string) => void;
  setUUser: (value: string) => void;
  setUPass: (value: string) => void;
  setDRegion: (value: string) => void;
  setDDistrict: (value: string) => void;
  setDHospital: (value: string) => void;
  onAddUser: () => void | Promise<void>;
  onDeleteUser: (id: string) => void;
  canDeleteUser: (user: User) => boolean;
}) {
  return (
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
  );
}
