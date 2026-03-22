import { useEffect, useMemo, useState } from 'react';
import type { HbA1cQuarter, Medication, Patient, SugarTestType } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { usePatientStore } from '../../store/usePatientStore';
import { useUIStore } from '../../store/useUIStore';
import {
  calculateBMI,
  getCurrentMeds,
  getCurrentQuarter,
  nextVisitDate,
  bpClass,
  sgClass,
} from '../../services/clinical';
import { today } from '../../services/clinical';
import HbA1cBox from './HbA1cBox';
import MedRow from './MedRow';
import Button from '../ui/Button';
import Chip from '../ui/Chip';
import { HTN_MEDS } from '../../services/clinical';
import { ICD10_CODES } from '../../data/icd10';
import { INVESTIGATION_TEMPLATES } from '../../data/investigations';

// ── Helpers ──────────────────────────────────────────────────
function toISODate(d: Date) { return d.toISOString().split('T')[0]; }
function parseNumber(v: string) {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ── Section card matching Stitch design ──────────────────────
const INK  = '#0f1f26';
const TEAL = '#0d6e87';

function SectionCard({
  title, color = INK, bg = '#fff', children, defaultOpen = true,
}: { title: string; color?: string; bg?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: bg, borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(191,200,205,.3)', marginBottom: '14px' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ background: color, height: '36px', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#fff', fontFamily: 'Syne, sans-serif', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
          {title}
        </span>
        <span style={{ color: 'rgba(255,255,255,.7)', fontSize: '16px', lineHeight: 1, transition: 'transform .2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▾
        </span>
      </div>
      {open && <div style={{ padding: '14px' }}>{children}</div>}
    </div>
  );
}

function FieldLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#516169', marginBottom: '4px' }}>
      {text}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid rgba(191,200,205,.55)', borderRadius: '4px',
  padding: '8px 10px', fontSize: '13px', fontFamily: 'Karla, sans-serif',
  color: INK, background: '#fff', outline: 'none',
};

// ── ICD-10 search component ───────────────────────────────────
interface SelectedDiagnosis { code: string; description: string; isPrimary?: boolean; }

function DiagnosisSearch({
  label, selected, onAdd, onRemove, onTogglePrimary,
}: {
  label: string;
  selected: SelectedDiagnosis[];
  onAdd: (d: SelectedDiagnosis) => void;
  onRemove: (code: string) => void;
  onTogglePrimary?: (code: string) => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    return ICD10_CODES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  return (
    <div>
      <FieldLabel text={label} />
      {/* Selected diagnoses */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {selected.map((d) => (
            <div
              key={d.code}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '4px',
                background: d.isPrimary ? 'rgba(13,110,135,.12)' : '#f4f4f2',
                border: `1.5px solid ${d.isPrimary ? TEAL : 'rgba(191,200,205,.5)'}`,
                fontSize: '12px', color: d.isPrimary ? '#005469' : INK,
              }}
            >
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '11px' }}>{d.code}</span>
              <span>{d.description}</span>
              {onTogglePrimary && (
                <button
                  onClick={() => onTogglePrimary(d.code)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: d.isPrimary ? TEAL : '#516169', fontWeight: 700, padding: '0 2px' }}
                  title={d.isPrimary ? 'Primary diagnosis' : 'Set as primary'}
                >
                  {d.isPrimary ? '★' : '☆'}
                </button>
              )}
              <button
                onClick={() => onRemove(d.code)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
              >×</button>
            </div>
          ))}
        </div>
      )}
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...fieldStyle, paddingLeft: '10px' }}
          placeholder="Search ICD-10 code or diagnosis name…"
        />
        {results.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #0d6e87', borderTop: 'none', borderRadius: '0 0 4px 4px', zIndex: 999, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 20px rgba(15,31,38,.1)' }}>
            {results.map((r) => (
              <div
                key={r.code}
                onMouseDown={(e) => { e.preventDefault(); onAdd({ code: r.code, description: r.description }); setQuery(''); }}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid rgba(191,200,205,.15)', display: 'flex', gap: '10px', alignItems: 'center' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(13,110,135,.05)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: TEAL, fontSize: '11px', minWidth: '52px' }}>{r.code}</span>
                <span style={{ color: INK }}>{r.description}</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#516169', background: '#f4f4f2', padding: '2px 6px', borderRadius: '3px' }}>{r.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Investigation types ───────────────────────────────────────
interface InvResult {
  id: string; name: string; value: string; unit: string;
  referenceLow: number; referenceHigh: number; referenceText?: string;
}

function getInterpretation(inv: InvResult): { label: string; color: string; bg: string } | null {
  const v = parseFloat(inv.value);
  if (isNaN(v) || inv.value === '') return null;
  const { referenceLow, referenceHigh } = inv;
  // Special handling for eGFR (higher is better)
  if (inv.id === 'egfr') {
    if (v >= 90)  return { label: 'Normal',   color: '#14532d', bg: '#dcfce7' };
    if (v >= 60)  return { label: 'Mild',     color: '#78350f', bg: '#fef3c7' };
    if (v >= 30)  return { label: 'Moderate', color: '#c2410c', bg: '#ffedd5' };
    return { label: 'Severe', color: '#7f1d1d', bg: '#fee2e2' };
  }
  if (v < referenceLow)  return { label: 'Low',    color: '#1e3a8a', bg: '#dbeafe' };
  if (v > referenceHigh) return { label: 'High',   color: '#7f1d1d', bg: '#fee2e2' };
  return { label: 'Normal', color: '#14532d', bg: '#dcfce7' };
}

function InvestigationRow({ inv, onChange, onRemove }: { inv: InvResult; onChange: (v: InvResult) => void; onRemove: () => void; }) {
  const interp = getInterpretation(inv);
  const ref = inv.referenceText ?? `${inv.referenceLow}–${inv.referenceHigh}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: '8px', alignItems: 'center', padding: '10px 12px', background: '#fff', borderRadius: '4px', border: `1px solid ${interp ? interp.bg : 'rgba(191,200,205,.3)'}`, marginBottom: '6px' }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: INK }}>{inv.name}</div>
        <div style={{ fontSize: '10px', color: '#516169' }}>{inv.unit} · ref: {ref}</div>
      </div>
      <input
        value={inv.value}
        onChange={(e) => onChange({ ...inv, value: e.target.value })}
        style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', padding: '6px 8px', textAlign: 'center' }}
        placeholder="—"
        type="number"
        step="0.1"
      />
      {interp ? (
        <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: interp.bg, color: interp.color, whiteSpace: 'nowrap', fontFamily: 'Syne, sans-serif', textTransform: 'uppercase' }}>
          {interp.label}
        </span>
      ) : <span />}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>×</button>
    </div>
  );
}

// Category colors
const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  Hematology:   { bg: '#fdf2f8', color: '#9d174d' },
  Renal:        { bg: '#eff6ff', color: '#1e40af' },
  Liver:        { bg: '#fefce8', color: '#854d0e' },
  Lipids:       { bg: '#f0fdf4', color: '#166534' },
  Glucose:      { bg: '#fff7ed', color: '#9a3412' },
  Electrolytes: { bg: '#f0fdfa', color: '#134e4a' },
  Cardiac:      { bg: '#fff1f2', color: '#9f1239' },
  Thyroid:      { bg: '#faf5ff', color: '#6b21a8' },
  Coagulation:  { bg: '#fef2f2', color: '#7f1d1d' },
  Inflammatory: { bg: '#fff7ed', color: '#92400e' },
};

// ── Main component ────────────────────────────────────────────
export default function VisitModal() {
  const open       = useUIStore((s) => s.visitModalOpen);
  const patientId  = useUIStore((s) => s.visitModalPatientId);
  const close      = useUIStore((s) => s.closeVisitModal);
  const clinicDays = useUIStore((s) => s.clinicSettings.days);
  const currentUser = useAuthStore((s) => s.currentUser);
  const patients   = usePatientStore((s) => s.patients);
  const recordVisit = usePatientStore((s) => s.recordVisit);

  const patient: Patient | null = useMemo(() => {
    if (patientId === null) return null;
    return patients.find((p) => p.id === patientId) ?? null;
  }, [patientId, patients]);

  const isDM = patient?.cond === 'DM' || patient?.cond === 'DM+HTN';

  // ── Basic visit fields ────────────────────────────────────
  const [visitDate, setVisitDate] = useState<string>(today());
  const [attended, setAttended]   = useState<boolean>(true);

  // ── Vitals ────────────────────────────────────────────────
  const [sbp, setSbp]     = useState<string>('');
  const [dbp, setDbp]     = useState<string>('');
  const [sugar, setSugar] = useState<string>('');
  const [sugarType, setSugarType] = useState<SugarTestType>('FBS');
  const [weightKg, setWeightKg]   = useState<string>('');
  const [heightCm, setHeightCm]   = useState<string>('');
  const bmi = useMemo(() => {
    const w = parseNumber(weightKg), h = parseNumber(heightCm);
    if (w === null || h === null) return null;
    return calculateBMI(w, h);
  }, [weightKg, heightCm]);

  // ── Presenting complaint ──────────────────────────────────
  const [presentingComplaint, setPresentingComplaint] = useState<string>('');

  // ── Physical examination ──────────────────────────────────
  const [generalAppearance,  setGeneralAppearance]  = useState<string>('');
  const [pulseRate,           setPulseRate]           = useState<string>('');
  const [respiratoryRate,     setRespiratoryRate]     = useState<string>('');
  const [temperature,         setTemperature]         = useState<string>('');
  const [oxygenSaturation,    setOxygenSaturation]    = useState<string>('');
  const [oedema,              setOedema]              = useState<'none'|'mild'|'moderate'|'severe'>('none');
  const [fundoscopy,          setFundoscopy]          = useState<string>('');
  const [footExamination,     setFootExamination]     = useState<'normal'|'abnormal'|'ulcer'|'amputation'>('normal');
  const [otherFindings,       setOtherFindings]       = useState<string>('');

  // ── Provisional diagnosis (ICD-10) ───────────────────────
  const [provisionalDx, setProvisionalDx] = useState<SelectedDiagnosis[]>([]);

  // ── Investigations ────────────────────────────────────────
  const [investigations, setInvestigations] = useState<InvResult[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const invCategories = useMemo(() => {
    const cats = Array.from(new Set(INVESTIGATION_TEMPLATES.map((t) => t.category))).sort();
    return cats;
  }, []);
  const categoryTests = useMemo(() => {
    if (!selectedCategory) return [];
    return INVESTIGATION_TEMPLATES.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  // ── Final diagnosis (ICD-10) ──────────────────────────────
  const [finalDx, setFinalDx] = useState<SelectedDiagnosis[]>([]);

  // ── Medications ───────────────────────────────────────────
  const [meds, setMeds] = useState<Medication[]>([]);

  // ── HbA1c ─────────────────────────────────────────────────
  const [hba1cValue,   setHba1cValue]   = useState<string>('');
  const [hba1cQuarter, setHba1cQuarter] = useState<HbA1cQuarter>(getCurrentQuarter());

  // ── Next appointment ──────────────────────────────────────
  const hardDeadline = useMemo(() => {
    const d = new Date(visitDate); d.setDate(d.getDate() + 30); return d;
  }, [visitDate]);

  const computedNextDate = useMemo(() => nextVisitDate(new Date(visitDate), 30, clinicDays), [visitDate, clinicDays]);
  const [nextDate, setNextDate] = useState<string>(toISODate(computedNextDate));
  const [nextNote, setNextNote] = useState<string>('');

  // ── Final note ────────────────────────────────────────────
  const [finalNote, setFinalNote] = useState<string>('');

  // ── Reset on open ─────────────────────────────────────────
  useEffect(() => {
    if (!open || !patient) return;
    setVisitDate(today());
    setAttended(true);
    setSbp(''); setDbp(''); setSugar(''); setSugarType('FBS');
    setWeightKg(''); setHeightCm('');
    setPresentingComplaint('');
    setGeneralAppearance(''); setPulseRate(''); setRespiratoryRate('');
    setTemperature(''); setOxygenSaturation(''); setOedema('none');
    setFundoscopy(''); setFootExamination('normal'); setOtherFindings('');
    setProvisionalDx([]);
    setInvestigations([]); setSelectedCategory('');
    setFinalDx([]);
    setMeds(getCurrentMeds(patient).length ? getCurrentMeds(patient) : [{ name: HTN_MEDS[0] }]);
    setHba1cValue(''); setHba1cQuarter(getCurrentQuarter());
    setNextDate(toISODate(nextVisitDate(new Date(today()), 30, clinicDays)));
    setNextNote('');
    setFinalNote('');
  }, [open, patient, clinicDays]);

  useEffect(() => {
    if (!open) return;
    setNextDate(toISODate(computedNextDate));
  }, [computedNextDate, open]);

  if (!open || !patient || patientId === null || !currentUser) return null;

  const month  = new Date(visitDate).getMonth() + 1;
  const sbpN   = parseNumber(sbp);
  const dbpN   = parseNumber(dbp);
  const sugarN = parseNumber(sugar);
  const liveBP = sbpN !== null && dbpN !== null ? bpClass(sbpN, dbpN) : null;
  const liveSG = sugarN !== null ? sgClass(sugarN, sugarType) : null;

  const onSave = () => {
    recordVisit({
      patientId,
      month,
      date: visitDate,
      attended,
      sbp:       attended ? (sbpN   ?? undefined) : undefined,
      dbp:       attended ? (dbpN   ?? undefined) : undefined,
      sugar:     attended ? (sugarN ?? undefined) : undefined,
      sugarType: attended ? sugarType : undefined,
      weight:    attended ? (parseNumber(weightKg) ?? undefined) : undefined,
      height:    attended ? (parseNumber(heightCm) ?? undefined) : undefined,
      bmi:       attended ? (bmi    ?? undefined)  : undefined,
      notes:     attended ? (finalNote || undefined) : undefined,
      meds:      attended ? meds : [],
      nextDate,
      nextNote:  nextNote || undefined,
      scheduledBy: currentUser.displayName,
      presentingComplaint: attended ? presentingComplaint || undefined : undefined,
      physicalExam: attended ? {
        generalAppearance:  generalAppearance  || undefined,
        pulseRate:          parseNumber(pulseRate)        ?? undefined,
        respiratoryRate:    parseNumber(respiratoryRate)  ?? undefined,
        temperature:        parseNumber(temperature)      ?? undefined,
        oxygenSaturation:   parseNumber(oxygenSaturation) ?? undefined,
        oedema,
        fundoscopy:         fundoscopy    || undefined,
        footExamination,
        otherFindings:      otherFindings || undefined,
      } : undefined,
      ...(isDM && attended && hba1cValue.trim() !== '' && hba1cQuarter
        ? { hba1cValue: Number(hba1cValue), hba1cQuarter, hba1cYear: new Date(visitDate).getFullYear() }
        : {}),
    });
    close();
  };

  function defaultMed(p: Patient | null): Medication {
    if (!p) return { name: '' };
    const c = getCurrentMeds(p);
    return c.length > 0 ? c[0] : { name: HTN_MEDS[0] };
  }

  // ── Helpers for diagnosis lists ───────────────────────────
  const addProvisional = (d: SelectedDiagnosis) => {
    if (provisionalDx.find((x) => x.code === d.code)) return;
    setProvisionalDx((prev) => [...prev, { ...d, isPrimary: prev.length === 0 }]);
  };
  const addFinal = (d: SelectedDiagnosis) => {
    if (finalDx.find((x) => x.code === d.code)) return;
    setFinalDx((prev) => [...prev, { ...d, isPrimary: prev.length === 0 }]);
  };
  const togglePrimary = (list: SelectedDiagnosis[], setList: React.Dispatch<React.SetStateAction<SelectedDiagnosis[]>>, code: string) => {
    setList(list.map((d) => ({ ...d, isPrimary: d.code === code })));
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0" onClick={close} style={{ background: 'rgba(0,0,0,.45)' }} />

      <div className="absolute inset-y-0 right-0 w-full max-w-[760px] bg-white border-l border-[var(--border)] flex flex-col" style={{ boxShadow: '-8px 0 48px rgba(15,31,38,.2)' }}>

        {/* ── Header ──────────────────────────────────────── */}
        <div style={{ background: INK, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 800, color: '#fff' }}>Record Visit</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'rgba(255,255,255,.6)', marginTop: '2px' }}>{patient.code} · {patient.cond} · {patient.sex === 'M' ? 'Male' : 'Female'} {patient.age}y</div>
          </div>
          <button onClick={close} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontSize: '12px', fontWeight: 700 }}>
            Cancel
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* Visit date + attendance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <FieldLabel text="Date" />
              <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <FieldLabel text="Month #" />
              <div style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{month}</div>
            </div>
            <div>
              <FieldLabel text="Attendance" />
              <select value={attended ? 'yes' : 'no'} onChange={(e) => setAttended(e.target.value === 'yes')} style={fieldStyle}>
                <option value="yes">Attended</option>
                <option value="no">Missed</option>
              </select>
            </div>
          </div>

          {attended ? (
            <>
              {/* ── 1. VITALS ──────────────────────────────── */}
              <SectionCard title="1. Vitals & Measurements" color={INK}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  {/* BP */}
                  <div style={{ background: 'rgba(13,110,135,.06)', borderRadius: '6px', padding: '10px', border: '1px solid rgba(13,110,135,.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: TEAL, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase' }}>Blood Pressure</span>
                      {liveBP ? <Chip cls={liveBP.cls}>{liveBP.lbl}</Chip> : null}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <FieldLabel text="SBP (mmHg)" />
                        <input type="number" value={sbp} onChange={(e) => setSbp(e.target.value)} style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} placeholder="145" />
                      </div>
                      <div>
                        <FieldLabel text="DBP (mmHg)" />
                        <input type="number" value={dbp} onChange={(e) => setDbp(e.target.value)} style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} placeholder="95" />
                      </div>
                    </div>
                  </div>
                  {/* Glucose */}
                  <div style={{ background: 'rgba(217,119,6,.06)', borderRadius: '6px', padding: '10px', border: '1px solid rgba(217,119,6,.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', fontFamily: 'Syne, sans-serif', textTransform: 'uppercase' }}>Glucose</span>
                      {liveSG ? <Chip cls={liveSG.cls}>{liveSG.lbl}</Chip> : null}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <FieldLabel text="Value (mmol/L)" />
                        <input type="number" step="0.1" value={sugar} onChange={(e) => setSugar(e.target.value)} style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} placeholder="8.2" />
                      </div>
                      <div>
                        <FieldLabel text="Type" />
                        <select value={sugarType} onChange={(e) => setSugarType(e.target.value as SugarTestType)} style={fieldStyle}>
                          <option value="FBS">FBS</option>
                          <option value="RBS">RBS</option>
                          <option value="2HPP">2HPP</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Weight / Height / BMI */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <FieldLabel text="Weight (kg)" />
                    <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} placeholder="70" />
                  </div>
                  <div>
                    <FieldLabel text="Height (cm)" />
                    <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} placeholder="170" />
                  </div>
                  <div>
                    <FieldLabel text="BMI" />
                    <div style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: TEAL }}>{bmi === null ? '—' : bmi.toFixed(1)}</div>
                  </div>
                </div>
                {/* HbA1c for DM */}
                {isDM && (
                  <div style={{ marginTop: '10px' }}>
                    <HbA1cBox patient={patient} value={hba1cValue} quarter={hba1cQuarter} onValueChange={setHba1cValue} onQuarterChange={setHba1cQuarter} />
                  </div>
                )}
              </SectionCard>

              {/* ── 2. PRESENTING COMPLAINT ────────────────── */}
              <SectionCard title="2. Presenting Complaint" color="#2a4a58" defaultOpen={true}>
                <div>
                  <FieldLabel text="Chief complaint and history" />
                  <textarea
                    value={presentingComplaint}
                    onChange={(e) => setPresentingComplaint(e.target.value)}
                    rows={3} style={{ ...fieldStyle, resize: 'vertical' }}
                    placeholder="Describe the patient's main complaint and history of presenting illness…"
                  />
                </div>
              </SectionCard>

              {/* ── 3. PHYSICAL EXAMINATION ────────────────── */}
              <SectionCard title="3. Physical Examination" color={TEAL} bg="rgba(13,110,135,.03)" defaultOpen={false}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { label: 'General Appearance', val: generalAppearance, set: setGeneralAppearance, type: 'text', unit: '' },
                    { label: 'Pulse Rate', val: pulseRate, set: setPulseRate, type: 'number', unit: 'bpm' },
                    { label: 'Respiratory Rate', val: respiratoryRate, set: setRespiratoryRate, type: 'number', unit: '/min' },
                    { label: 'Temperature', val: temperature, set: setTemperature, type: 'number', unit: '°C' },
                    { label: 'Oxygen Saturation', val: oxygenSaturation, set: setOxygenSaturation, type: 'number', unit: '%' },
                    { label: 'Fundoscopy', val: fundoscopy, set: setFundoscopy, type: 'text', unit: '' },
                  ].map(({ label, val, set, type, unit }) => (
                    <div key={label}>
                      <FieldLabel text={label + (unit ? ` (${unit})` : '')} />
                      <input type={type} value={val} onChange={(e) => set(e.target.value)} style={{ ...fieldStyle, border: '1.5px solid rgba(13,110,135,.25)' }} />
                    </div>
                  ))}
                  <div>
                    <FieldLabel text="Oedema" />
                    <select value={oedema} onChange={(e) => setOedema(e.target.value as any)} style={{ ...fieldStyle, border: '1.5px solid rgba(13,110,135,.25)' }}>
                      <option value="none">None</option>
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel text="Foot Examination" />
                    <select value={footExamination} onChange={(e) => setFootExamination(e.target.value as any)} style={{ ...fieldStyle, border: '1.5px solid rgba(13,110,135,.25)' }}>
                      <option value="normal">Normal</option>
                      <option value="abnormal">Abnormal</option>
                      <option value="ulcer">Ulcer present</option>
                      <option value="amputation">Amputation</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <FieldLabel text="Other Findings" />
                    <textarea value={otherFindings} onChange={(e) => setOtherFindings(e.target.value)} rows={2} style={{ ...fieldStyle, resize: 'vertical', border: '1.5px solid rgba(13,110,135,.25)' }} />
                  </div>
                </div>
              </SectionCard>

              {/* ── 4. PROVISIONAL DIAGNOSIS (ICD-10) ─────── */}
              <SectionCard title="4. Provisional Diagnosis (ICD-10)" color="#7c3aed" bg="rgba(124,58,237,.03)" defaultOpen={false}>
                <DiagnosisSearch
                  label="Search and add provisional diagnoses"
                  selected={provisionalDx}
                  onAdd={addProvisional}
                  onRemove={(code) => setProvisionalDx((p) => p.filter((d) => d.code !== code))}
                  onTogglePrimary={(code) => togglePrimary(provisionalDx, setProvisionalDx, code)}
                />
                <div style={{ fontSize: '11px', color: '#516169', marginTop: '6px' }}>★ = Primary diagnosis. Click star to change.</div>
              </SectionCard>

              {/* ── 5. INVESTIGATIONS ──────────────────────── */}
              <SectionCard title="5. Investigations / Lab Results" color="#166534" bg="#f0fdf4" defaultOpen={false}>
                {/* Category picker */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                  {invCategories.map((cat) => {
                    const c = CAT_COLORS[cat] ?? { bg: '#f4f4f2', color: '#516169' };
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(active ? '' : cat)}
                        style={{
                          padding: '5px 12px', borderRadius: '999px', fontSize: '11px',
                          fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer',
                          border: `1.5px solid ${active ? c.color : 'rgba(191,200,205,.4)'}`,
                          background: active ? c.bg : '#fff',
                          color: active ? c.color : '#516169',
                          transition: 'all .15s',
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Tests in selected category */}
                {selectedCategory && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#516169', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontFamily: 'Syne, sans-serif' }}>
                      {selectedCategory} Tests — click to add
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {categoryTests.map((t) => {
                        const already = investigations.find((i) => i.id === t.id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              if (!already) {
                                setInvestigations((prev) => [...prev, {
                                  id: t.id, name: t.name, value: '',
                                  unit: t.unit, referenceLow: t.referenceLow,
                                  referenceHigh: t.referenceHigh,
                                  referenceText: t.referenceText,
                                }]);
                              }
                            }}
                            disabled={!!already}
                            style={{
                              padding: '4px 10px', borderRadius: '4px', fontSize: '12px',
                              fontFamily: 'Karla, sans-serif', cursor: already ? 'default' : 'pointer',
                              border: '1.5px solid rgba(34,197,94,.3)',
                              background: already ? '#dcfce7' : '#fff',
                              color: already ? '#166534' : '#0f1f26',
                              opacity: already ? 0.7 : 1,
                            }}
                          >
                            {already ? '✓ ' : '+ '}{t.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Added investigations with value + WHO interpretation */}
                {investigations.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#516169', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontFamily: 'Syne, sans-serif' }}>
                      Enter results
                    </div>
                    {investigations.map((inv, idx) => (
                      <InvestigationRow
                        key={inv.id}
                        inv={inv}
                        onChange={(v) => setInvestigations((prev) => prev.map((x, i) => i === idx ? v : x))}
                        onRemove={() => setInvestigations((prev) => prev.filter((_, i) => i !== idx))}
                      />
                    ))}
                  </div>
                )}

                {investigations.length === 0 && !selectedCategory && (
                  <div style={{ fontSize: '12px', color: '#516169', textAlign: 'center', padding: '12px 0' }}>
                    Select a category above to add investigations
                  </div>
                )}
              </SectionCard>

                            {/* ── 6. FINAL DIAGNOSIS (ICD-10) ────────────── */}
              <SectionCard title="6. Final Diagnosis (ICD-10)" color="#005469" defaultOpen={false}>
                <DiagnosisSearch
                  label="Search and add final diagnoses"
                  selected={finalDx}
                  onAdd={addFinal}
                  onRemove={(code) => setFinalDx((p) => p.filter((d) => d.code !== code))}
                  onTogglePrimary={(code) => togglePrimary(finalDx, setFinalDx, code)}
                />
                <div style={{ fontSize: '11px', color: '#516169', marginTop: '6px' }}>★ = Primary diagnosis. Click star to change.</div>
              </SectionCard>

              {/* ── 7. MEDICATIONS ─────────────────────────── */}
              <SectionCard title="7. Medications" color="#7c3aed" bg="rgba(124,58,237,.03)" defaultOpen={true}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <button
                    onClick={() => setMeds((prev) => [...prev, defaultMed(patient)])}
                    style={{ background: 'rgba(124,58,237,.1)', border: '1.5px solid rgba(124,58,237,.2)', color: '#7c3aed', borderRadius: '4px', padding: '5px 12px', fontSize: '12px', fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer' }}
                  >
                    + Add Medication
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {meds.map((m, idx) => (
                    <MedRow
                      key={`${m.name}-${idx}`}
                      med={m}
                      onChange={(next) => setMeds((prev) => prev.map((x, i) => i === idx ? next : x))}
                      onRemove={() => setMeds((prev) => prev.filter((_, i) => i !== idx))}
                    />
                  ))}
                  {meds.length === 0 && <div style={{ fontSize: '12px', color: '#516169', textAlign: 'center' }}>No medications added</div>}
                </div>
              </SectionCard>

              {/* ── 8. NEXT APPOINTMENT ────────────────────── */}
              <SectionCard title="8. Next Appointment" color="#2a4a58" defaultOpen={true}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <FieldLabel text={`Date (deadline: ${hardDeadline.toLocaleDateString()})`} />
                    <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} style={fieldStyle} />
                  </div>
                  <div>
                    <FieldLabel text="Appointment note (optional)" />
                    <input type="text" value={nextNote} onChange={(e) => setNextNote(e.target.value)} style={fieldStyle} placeholder="e.g. Bring medications" />
                  </div>
                </div>
              </SectionCard>

              {/* ── 9. FINAL NOTE ──────────────────────────── */}
              <SectionCard title="9. Final Note / Clinical Summary" color={INK} defaultOpen={false}>
                <div>
                  <FieldLabel text="Summary, plan, referrals, or additional notes" />
                  <textarea
                    value={finalNote}
                    onChange={(e) => setFinalNote(e.target.value)}
                    rows={4} style={{ ...fieldStyle, resize: 'vertical' }}
                    placeholder="Overall clinical summary, management plan, referrals…"
                  />
                </div>
              </SectionCard>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#516169', fontSize: '14px' }}>
              Visit marked as missed. No clinical data will be recorded.
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(191,200,205,.3)', background: '#f4f4f2', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" label="Cancel" onClick={close} />
          <Button size="sm" variant="primary" label="Save Visit" onClick={onSave} />
        </div>
      </div>
    </div>
  );
}
