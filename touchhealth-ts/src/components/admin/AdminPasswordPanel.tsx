import type { User } from '../../types';
import Button from '../ui/Button';
import Alert from '../ui/Alert';

const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
};

export default function AdminPasswordPanel({
  superAdmin,
  pwCandidates,
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
  setPwTargetId,
  setPwNew,
  setSelfPwCurrent,
  setSelfPwNew,
  onResetPassword,
  onChangeSelfPassword,
}: {
  superAdmin: boolean;
  pwCandidates: User[];
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
  setPwTargetId: (value: string) => void;
  setPwNew: (value: string) => void;
  setSelfPwCurrent: (value: string) => void;
  setSelfPwNew: (value: string) => void;
  onResetPassword: () => void | Promise<void>;
  onChangeSelfPassword: () => void;
}) {
  return (
    <>
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
