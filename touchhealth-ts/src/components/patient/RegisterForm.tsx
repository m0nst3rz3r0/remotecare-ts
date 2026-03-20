import { useMemo, useState } from 'react';
import { TZ_GEO } from '../../utils/geo';
import { useAuthStore } from '../../store/useAuthStore';
import { usePatientStore } from '../../store/usePatientStore';
import type { Condition, Sex } from '../../types';
import {
  generatePatientCode,
  ensureUniqueCode,
  type RegisterPatientParams,
} from '../../services/patients';
import { getHospitalsByRegionDistrict } from '../../services/auth';
import Button from '../ui/Button';

export default function RegisterForm() {
  const patients = usePatientStore((s) => s.patients);
  const registerPatient = usePatientStore((s) => s.registerPatient);

  const currentUser = useAuthStore((s) => s.currentUser);

  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [hospital, setHospital] = useState('');

  const [age, setAge] = useState<number | ''>('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [cond, setCond] = useState<Condition | ''>('');

  const [enrol, setEnrol] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [error, setError] = useState<string | null>(null);

  const regionOptions = useMemo(() => Object.keys(TZ_GEO).sort(), []);
  const districtOptions = useMemo(() => {
    if (!region) return [];
    return TZ_GEO[region] ?? [];
  }, [region]);

  const hospitalOptions = useMemo(() => {
    if (!region || !district) return [];
    return getHospitalsByRegionDistrict(region, district);
  }, [region, district]);

  const previewCode = useMemo(() => {
    if (!region || !district || !hospital || !sex) return '—';
    const { code: rawCode } = generatePatientCode(
      patients,
      region,
      district,
      hospital,
      sex,
    );
    return ensureUniqueCode(patients, rawCode);
  }, [patients, region, district, hospital, sex]);

  const onRegister = () => {
    setError(null);
    if (!currentUser) {
      setError('Please sign in again.');
      return;
    }

    const params: RegisterPatientParams = {
      region,
      district,
      hospital,
      age: typeof age === 'number' ? age : 0,
      sex: (sex || 'M') as Sex,
      cond: (cond || 'HTN') as Condition,
      enrol,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      currentUser,
    };

    const res = registerPatient(params);
    if (!res.success) {
      setError(res.error ?? 'Unable to register patient.');
      return;
    }

    // Keep location selections, clear other fields
    setAge('');
    setSex('');
    setCond('');
    setEnrol('');
    setPhone('');
    setAddress('');
    // Store already selects the new patient
  };

  return (
    <div className="w-full">
      {/* Live generated code */}
      <div
        className="rounded-[var(--r)] px-4 py-3 border border-[rgba(255,255,255,.12)]"
        style={{ background: 'linear-gradient(135deg,var(--ink) 0%,var(--ink2) 75%)' }}
      >
        <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-white/70">
          Auto-code preview
        </div>
        <div className="mono text-[22px] font-extrabold text-white mt-1">
          {previewCode}
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[110px]">
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-white/70 mb-1">
              Age
            </div>
            <input
              type="number"
              value={age}
              onChange={(e) => {
                const v = e.target.value;
                setAge(v === '' ? '' : Number(v));
              }}
              className="w-full rounded-[var(--r-sm)] border border-white/15 px-3 py-2 outline-none bg-white/10 text-white"
              placeholder="e.g. 55"
            />
          </div>

          <div className="flex-1 min-w-[110px]">
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-white/70 mb-1">
              Sex
            </div>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex | '')}
              className="w-full rounded-[var(--r-sm)] border border-white/15 px-3 py-2 outline-none bg-white/10 text-white"
            >
              <option value="">— Select —</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-white/70 mb-1">
              Condition
            </div>
            <select
              value={cond}
              onChange={(e) => setCond(e.target.value as Condition | '')}
              className="w-full rounded-[var(--r-sm)] border border-white/15 px-3 py-2 outline-none bg-white/10 text-white"
            >
              <option value="">— Select —</option>
              <option value="HTN">HTN</option>
              <option value="DM">DM</option>
              <option value="DM+HTN">DM+HTN</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cascades */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <option value="">— Region —</option>
            {regionOptions.map((r) => (
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
            <option value="">— District —</option>
            {districtOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
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
      </div>

      {/* Enrolment fields */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
            Enrolment date
          </div>
          <input
            type="date"
            value={enrol}
            onChange={(e) => setEnrol(e.target.value)}
            className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
          />
        </div>
        <div>
          <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
            Phone
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
            placeholder="e.g. 07xxxxxxx"
          />
        </div>
        <div>
          <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
            Village/Address
          </div>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
            placeholder="e.g. Kitaya"
          />
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-[var(--r)] border border-[var(--rose)] bg-[var(--rose-pale)] px-3 py-2 text-[var(--rose)] font-extrabold text-sm">
          {error}
        </div>
      ) : null}

      <div className="mt-3">
        <Button
          variant="primary"
          size="md"
          label="Register Patient"
          className="w-full justify-center"
          onClick={onRegister}
        />
      </div>
    </div>
  );
}

