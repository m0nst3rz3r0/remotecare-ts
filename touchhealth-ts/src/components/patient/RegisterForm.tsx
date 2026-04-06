import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
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

// ── Design tokens ────────────────────────────────────────────
const INK     = '#0f1f26';
const TEAL    = '#0d6e87';
const PRIMARY = '#005469';
const BG_LOW  = '#f4f4f2';
const BORDER  = '#bfc8cd';
const LABEL_C = '#3f484c';

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `1.5px solid ${BORDER}`,
  borderRadius: '2px',
  padding: '8px 12px',
  fontSize: '14px',
  fontFamily: 'Karla, sans-serif',
  background: BG_LOW,
  color: INK,
  outline: 'none',
  boxSizing: 'border-box',
};

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ background: INK, height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center' }}>
      <span style={{ color: '#fff', fontFamily: 'Syne, sans-serif', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
        {title}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
      <SectionHeader title={title} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: '11px', fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: LABEL_C, marginBottom: '4px' }}>
      {text}
    </div>
  );
}

export default function RegisterForm() {
  const patients        = usePatientStore((s) => s.patients);
  const registerPatient = usePatientStore((s) => s.registerPatient);
  const currentUser     = useAuthStore((s) => s.currentUser);

  const isDoctor       = currentUser?.role === 'doctor';
  // SessionUser stores location as sessionRegion / sessionDistrict / hospital
  const doctorRegion   = isDoctor ? (currentUser?.sessionRegion   ?? '') : '';
  const doctorDistrict = isDoctor ? (currentUser?.sessionDistrict ?? '') : '';
  const doctorHospital = isDoctor ? (currentUser?.hospital        ?? '') : '';

  const [region,   setRegion]   = useState(doctorRegion);
  const [district, setDistrict] = useState(doctorDistrict);
  const [hospital, setHospital] = useState(doctorHospital);

  // Lock in doctor's assigned location
  useEffect(() => {
    if (isDoctor) {
      setRegion(doctorRegion);
      setDistrict(doctorDistrict);
      setHospital(doctorHospital);
    }
  }, [isDoctor, doctorRegion, doctorDistrict, doctorHospital]);

  const [age,     setAge]     = useState<number | ''>('');
  const [sex,     setSex]     = useState<Sex | ''>('');
  const [cond,    setCond]    = useState<Condition | ''>('');
  const [enrol,   setEnrol]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [address, setAddress] = useState('');
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const regionOptions   = useMemo(() => Object.keys(TZ_GEO).sort(), []);
  const districtOptions = useMemo(() => (region ? TZ_GEO[region] ?? [] : []), [region]);
  const hospitalOptions = useMemo(
    () => (region && district ? getHospitalsByRegionDistrict(region, district) : []),
    [region, district],
  );

  const previewCode = useMemo(() => {
    if (!region || !district || !hospital || !sex) return '—';
    const { code: rawCode } = generatePatientCode(patients, region, district, hospital, sex);
    return ensureUniqueCode(patients, rawCode);
  }, [patients, region, district, hospital, sex]);

  const onRegister = () => {
    setError(null);
    setSuccess(null);
    if (!currentUser)                      { setError('Please sign in again.');          return; }
    if (!region || !district || !hospital) { setError('Facility information missing.');  return; }
    if (!sex)                              { setError('Please select sex.');              return; }
    if (!cond)                             { setError('Please select condition.');        return; }
    if (!age)                              { setError('Please enter patient age.');       return; }

    const res = registerPatient({
      region, district, hospital,
      age:  typeof age === 'number' ? age : 0,
      sex:  sex  as Sex,
      cond: cond as Condition,
      enrol,
      phone:   phone.trim()   || undefined,
      address: address.trim() || undefined,
      currentUser,
    } as RegisterPatientParams);

    if (!res.success) { setError(res.error ?? 'Unable to register patient.'); return; }
    setSuccess(`Registered: ${previewCode}`);
    setAge(''); setSex(''); setCond(''); setEnrol(''); setPhone(''); setAddress('');
  };

  return (
    <div style={{ width: '100%', fontFamily: 'Karla, sans-serif' }}>

      {/* ── Clinical ID Code card ──────────────────────────── */}
      <div style={{
        background: INK, borderRadius: '10px', padding: '20px', marginBottom: '16px',
        borderLeft: `4px solid ${TEAL}`, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#85d1ed', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px', fontFamily: 'Syne, sans-serif' }}>
          Clinical Identification Code
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '22px', fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
          {previewCode}
        </div>
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: previewCode === '—' ? '#64748b' : '#22c55e' }} />
          <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
            {previewCode === '—' ? 'COMPLETE FORM TO GENERATE' : 'STATUS: GENERATED & UNIQUE'}
          </span>
        </div>
      </div>

      {/* ── Facility Scoping ───────────────────────────────── */}
      {isDoctor ? (
        <Section title="Facility Scoping">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {[
              { label: 'Region',   value: doctorRegion   },
              { label: 'District', value: doctorDistrict },
              { label: 'Hospital', value: doctorHospital },
            ].map(({ label, value }) => (
              <div key={label} style={{ flex: 1, minWidth: '120px' }}>
                <FieldLabel text={label} />
                <div style={{ padding: '8px 12px', background: '#e0f2f7', border: `1.5px solid ${TEAL}`, borderRadius: '2px', fontSize: '13px', fontWeight: 700, color: PRIMARY }}>
                  {value || '—'}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : (
        <Section title="Facility Scoping">
          <div>
            <FieldLabel text="Region" />
            <select
              value={region}
              onChange={(e) => { setRegion(e.target.value); setDistrict(''); setHospital(''); }}
              style={inputStyle}
            >
              <option value="">— Select Region —</option>
              {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel text="District" />
            <select
              value={district}
              onChange={(e) => { setDistrict(e.target.value); setHospital(''); }}
              disabled={!region}
              style={{ ...inputStyle, opacity: !region ? 0.5 : 1 }}
            >
              <option value="">— Select District —</option>
              {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel text="Hospital / Health Center" />
            <select
              value={hospital}
              onChange={(e) => setHospital(e.target.value)}
              disabled={!region || !district}
              style={{ ...inputStyle, opacity: (!region || !district) ? 0.5 : 1 }}
            >
              <option value="">— Select Hospital —</option>
              {hospitalOptions.map((h) => <option key={h.id} value={h.name}>{h.name}</option>)}
            </select>
          </div>
        </Section>
      )}

      {/* ── Patient Demographics ───────────────────────────── */}
      <Section title="Patient Demographics">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <FieldLabel text="Age (Years)" />
            <input
              type="number" value={age}
              onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="45"
              style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
          <div>
            <FieldLabel text="Sex" />
            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
              {(['M', 'F'] as Sex[]).map((val) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio" name="sex_register" value={val}
                    checked={sex === val} onChange={() => setSex(val)}
                    style={{ width: '16px', height: '16px', accentColor: TEAL, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: INK }}>{val === 'M' ? 'Male' : 'Female'}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <FieldLabel text="Condition" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {(['HTN', 'DM', 'DM+HTN'] as Condition[]).map((val) => (
              <label
                key={val}
                onClick={() => setCond(val)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: cond === val ? '#e0f2f7' : BG_LOW,
                  border: `1.5px solid ${cond === val ? TEAL : BORDER}`,
                  borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: cond === val ? PRIMARY : INK }}>{val}</span>
                <input
                  type="radio" name="cond_register" value={val}
                  checked={cond === val} onChange={() => setCond(val)}
                  style={{ accentColor: TEAL }}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel text="Enrolment Date" />
          <input
            type="date" value={enrol}
            onChange={(e) => setEnrol(e.target.value)}
            style={inputStyle}
          />
        </div>
      </Section>

      {/* ── Contact Information ────────────────────────────── */}
      <Section title="Contact Information">
        <div>
          <FieldLabel text="Phone Number" />
          <div style={{ display: 'flex' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', padding: '0 12px',
              background: BG_LOW, border: `1.5px solid ${BORDER}`, borderRight: 'none',
              borderRadius: '2px 0 0 2px', fontSize: '13px',
              fontFamily: 'JetBrains Mono, monospace', color: LABEL_C, whiteSpace: 'nowrap',
            }}>
              +255
            </span>
            <input
              value={phone} onChange={(e) => setPhone(e.target.value)}
              type="tel" placeholder="07xxxxxxx"
              style={{ ...inputStyle, borderRadius: '0 2px 2px 0', fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
        </div>
        <div>
          <FieldLabel text="Full Physical Address" />
          <textarea
            value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Kitaya, Block G, House 44..."
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      </Section>

      {/* ── Error / Success ────────────────────────────────── */}
      {error && (
        <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#ffdad6', border: '1.5px solid #ba1a1a', borderRadius: '6px', color: '#93000a', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {success && (
        <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#dcfce7', border: '1.5px solid #16a34a', borderRadius: '6px', color: '#14532d', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} /> {success}
        </div>
      )}

      {/* ── Submit ─────────────────────────────────────────── */}
      <button
        type="button" onClick={onRegister}
        style={{
          width: '100%', background: TEAL, color: '#fff', padding: '14px',
          border: 'none', borderRadius: '8px', fontFamily: 'Syne, sans-serif',
          fontWeight: 800, fontSize: '13px', textTransform: 'uppercase',
          letterSpacing: '1.5px', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(13,110,135,0.25)',
          transition: 'background 0.15s', marginBottom: '8px',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = PRIMARY; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = TEAL; }}
      >
        Initialize Clinical Record
      </button>
    </div>
  );
}
