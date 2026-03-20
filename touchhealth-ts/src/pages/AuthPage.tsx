import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import type { UserRole } from '../types';
import { TZ_GEO } from '../utils/geo';
import {
  getHospitalsByRegionDistrict,
} from '../services/auth';
import Button from '../components/ui/Button';

export default function AuthPage() {
  const signIn = useAuthStore((s) => s.signIn);
  const loginError = useAuthStore((s) => s.loginError);
  const clearError = useAuthStore((s) => s.clearError);

  const [roleTab, setRoleTab] = useState<UserRole>('admin');

  // Admin
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // Doctor
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [hospital, setHospital] = useState('');
  const [docUser, setDocUser] = useState('');
  const [docPass, setDocPass] = useState('');

  const regions = useMemo(() => Object.keys(TZ_GEO).sort(), []);
  const districts = useMemo(() => {
    if (!region) return [];
    return TZ_GEO[region] ?? [];
  }, [region]);

  const hospitalOptions = useMemo(() => {
    if (!region || !district) return [];
    return getHospitalsByRegionDistrict(region, district);
  }, [region, district]);

  useEffect(() => {
    clearError();
  }, [roleTab, clearError]);

  const canSubmit =
    roleTab === 'admin'
      ? !!adminUser.trim() && !!adminPass.trim()
      : !!region && !!district && !!hospital && !!docUser.trim() && !!docPass.trim();

  const onSubmit = () => {
    const res = signIn(
      roleTab === 'admin'
        ? {
            username: adminUser.trim(),
            password: adminPass,
            role: 'admin',
          }
        : {
            username: docUser.trim(),
            password: docPass,
            role: 'doctor',
            region,
            district,
            hospital,
          },
    );

    // Store already sets loginError; no extra handling needed.
    void res;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-3"
      style={{
        background:
          'linear-gradient(135deg,var(--teal) 0%,var(--ink) 55%,var(--teal2) 140%)',
      }}
    >
      <div className="w-full max-w-[980px] rounded-[var(--r)] overflow-hidden border border-[rgba(255,255,255,.12)] bg-[rgba(255,255,255,.06)]">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-6 md:p-8">
            <div className="h-full flex flex-col justify-center">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-white"
                  style={{ background: 'var(--teal2)' }}
                >
                  TH
                </div>
                <div>
                  <div className="font-syne text-white text-[18px] font-extrabold">
                    Touch Health
                  </div>
                  <div className="text-white/80 text-[12px] uppercase font-bold tracking-[0.5px]">
                    Tanzania NCD Management
                  </div>
                </div>
              </div>
              <div className="mt-5 text-white/80 text-[13px] leading-relaxed">
                Offline-first clinical workflow for rural Tanzania.
              </div>

              <div className="mt-6 text-white/90 text-[12px] font-bold">
                First login hint: <span className="font-mono">admin / admin123</span>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 bg-[rgba(250,250,248,.92)]">
            <div className="flex gap-2 mb-4">
              <button
                className="flex-1 rounded-[var(--r-sm)] py-2 font-extrabold uppercase tracking-[0.5px] text-[12px] border"
                style={{
                  background: roleTab === 'admin' ? 'var(--teal-ultra)' : 'transparent',
                  borderColor: roleTab === 'admin' ? 'var(--teal)' : 'var(--border)',
                  color: roleTab === 'admin' ? 'var(--teal)' : 'var(--ink)',
                }}
                onClick={() => setRoleTab('admin')}
              >
                Admin
              </button>
              <button
                className="flex-1 rounded-[var(--r-sm)] py-2 font-extrabold uppercase tracking-[0.5px] text-[12px] border"
                style={{
                  background: roleTab === 'doctor' ? 'var(--teal-ultra)' : 'transparent',
                  borderColor: roleTab === 'doctor' ? 'var(--teal)' : 'var(--border)',
                  color: roleTab === 'doctor' ? 'var(--teal)' : 'var(--ink)',
                }}
                onClick={() => setRoleTab('doctor')}
              >
                Doctor
              </button>
            </div>

            {loginError ? (
              <div
                className="mb-4 rounded-[var(--r)] border px-4 py-3"
                style={{
                  background: 'var(--rose-pale)',
                  borderColor: 'var(--rose)',
                  color: 'var(--rose)',
                  fontWeight: 800,
                }}
              >
                {loginError}
              </div>
            ) : null}

            {roleTab === 'admin' ? (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                    Username
                  </div>
                  <input
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
                    placeholder="admin"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                    Password
                  </div>
                  <input
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    type="password"
                    className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
                    placeholder="admin123"
                    autoComplete="current-password"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                      Region
                    </div>
                    <select
                      value={region}
                      onChange={(e) => {
                        setRegion(e.target.value);
                        setDistrict('');
                        setHospital('');
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
                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                      District
                    </div>
                    <select
                      value={district}
                      onChange={(e) => {
                        setDistrict(e.target.value);
                        setHospital('');
                      }}
                      disabled={!region}
                      className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white disabled:opacity-50"
                    >
                      <option value="">— Select —</option>
                      {districts.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                    Hospital
                  </div>
                  <select
                    value={hospital}
                    onChange={(e) => setHospital(e.target.value)}
                    disabled={!region || !district}
                    className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white disabled:opacity-50"
                  >
                    <option value="">— Select —</option>
                    {hospitalOptions.map((h) => (
                      <option key={h.id} value={h.name}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                    Username
                  </div>
                  <input
                    value={docUser}
                    onChange={(e) => setDocUser(e.target.value)}
                    className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
                    placeholder="doctor_username"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                    Password
                  </div>
                  <input
                    value={docPass}
                    onChange={(e) => setDocPass(e.target.value)}
                    type="password"
                    className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
                    placeholder="••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>
            )}

            <div className="mt-4">
              <Button
                size="md"
                variant="primary"
                label="Sign In →"
                className="w-full justify-center"
                disabled={!canSubmit}
                onClick={onSubmit}
              />
            </div>

            <div className="mt-3 text-[11px] text-[var(--slate)] font-bold">
              Works offline. Clinical logic runs locally; sync happens only when online.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

