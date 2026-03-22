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

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}

function parseNumber(v: string) {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function VisitModal() {
  const open = useUIStore((s) => s.visitModalOpen);
  const patientId = useUIStore((s) => s.visitModalPatientId);
  const close = useUIStore((s) => s.closeVisitModal);
  const clinicDays = useUIStore((s) => s.clinicSettings.days);

  const currentUser = useAuthStore((s) => s.currentUser);

  const patients = usePatientStore((s) => s.patients);
  const recordVisit = usePatientStore((s) => s.recordVisit);

  const patient: Patient | null = useMemo(() => {
    if (patientId === null) return null;
    return patients.find((p) => p.id === patientId) ?? null;
  }, [patientId, patients]);

  const isDM = patient?.cond === 'DM' || patient?.cond === 'DM+HTN';

  const [visitDate, setVisitDate] = useState<string>(today());
  const [attended, setAttended] = useState<boolean>(true);

  const [sbp, setSbp] = useState<string>('');
  const [dbp, setDbp] = useState<string>('');

  const [sugar, setSugar] = useState<string>('');
  const [sugarType, setSugarType] = useState<SugarTestType>('FBS');

  const [weightKg, setWeightKg] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const bmi = useMemo(() => {
    const w = parseNumber(weightKg);
    const h = parseNumber(heightCm);
    if (w === null || h === null) return null;
    return calculateBMI(w, h);
  }, [weightKg, heightCm]);

  const [notes, setNotes] = useState<string>('');
  const [presentingComplaint, setPresentingComplaint] = useState<string>('');
  
  // Physical examination fields
  const [generalAppearance, setGeneralAppearance] = useState<string>('');
  const [pulseRate, setPulseRate] = useState<string>('');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [oxygenSaturation, setOxygenSaturation] = useState<string>('');
  const [oedema, setOedema] = useState<'none' | 'mild' | 'moderate' | 'severe'>('none');
  const [fundoscopy, setFundoscopy] = useState<string>('');
  const [footExamination, setFootExamination] = useState<'normal' | 'abnormal' | 'ulcer' | 'amputation'>('normal');
  const [otherFindings, setOtherFindings] = useState<string>('');

  const [meds, setMeds] = useState<Medication[]>([]);

  const [hba1cValue, setHba1cValue] = useState<string>('');
  const [hba1cQuarter, setHba1cQuarter] = useState<HbA1cQuarter>(getCurrentQuarter());

  // Appointment scheduler
  const hardDeadline = useMemo(() => {
    const d = new Date(visitDate);
    const dd = new Date(d);
    dd.setDate(dd.getDate() + 30);
    return dd;
  }, [visitDate]);

  const computedNextDate = useMemo(() => {
    const d = new Date(visitDate);
    const nd = nextVisitDate(d, 30, clinicDays);
    return nd;
  }, [visitDate, clinicDays]);

  const [nextDate, setNextDate] = useState<string>(toISODate(computedNextDate));
  const [nextNote, setNextNote] = useState<string>('');

  useEffect(() => {
    if (!open || !patient) return;
    setVisitDate(today());
    setAttended(true);
    setSbp('');
    setDbp('');
    setSugar('');
    setSugarType('FBS');
    setWeightKg('');
    setHeightCm('');
    setNotes('');
    setHba1cValue('');
    setHba1cQuarter(getCurrentQuarter());
    
    // Reset clinical fields
    setPresentingComplaint('');
    setGeneralAppearance('');
    setPulseRate('');
    setRespiratoryRate('');
    setTemperature('');
    setOxygenSaturation('');
    setOedema('none');
    setFundoscopy('');
    setFootExamination('normal');
    setOtherFindings('');

    const current = getCurrentMeds(patient);
    setMeds(current.length ? current : [{ name: HTN_MEDS[0] }]);

    const initialNext = nextVisitDate(new Date(today()), 30, clinicDays);
    setNextDate(toISODate(initialNext));
    setNextNote('');
  }, [open, patient, clinicDays]);

  useEffect(() => {
    // When visit date / clinic days change, update suggestion.
    if (!open) return;
    setNextDate(toISODate(computedNextDate));
  }, [computedNextDate, open]);

  if (!open || !patient || patientId === null || !currentUser) return null;

  const month = new Date(visitDate).getMonth() + 1;

  const sbpN = parseNumber(sbp);
  const dbpN = parseNumber(dbp);
  const sugarN = parseNumber(sugar);

  const liveBP = sbpN !== null && dbpN !== null ? bpClass(sbpN, dbpN) : null;
  const liveSG = sugarN !== null ? sgClass(sugarN, sugarType) : null;

  const onSave = () => {
    const scheduledBy = currentUser.displayName;

    const medsToSave = attended ? meds : [];
    const notesToSave = attended ? notes : '';

    recordVisit({
      patientId,
      month,
      date: visitDate,
      attended,
      sbp: attended ? (sbpN ?? undefined) : undefined,
      dbp: attended ? (dbpN ?? undefined) : undefined,
      sugar: attended ? (sugarN ?? undefined) : undefined,
      sugarType: attended ? sugarType : undefined,
      weight: attended ? (parseNumber(weightKg) ?? undefined) : undefined,
      height: attended ? (parseNumber(heightCm) ?? undefined) : undefined,
      bmi: attended ? (bmi ?? undefined) : undefined,
      notes: attended ? (notesToSave || undefined) : undefined,
      meds: medsToSave,
      nextDate,
      nextNote: nextNote || undefined,
      scheduledBy,
      presentingComplaint: attended ? presentingComplaint || undefined : undefined,
      physicalExam: attended ? {
        generalAppearance: generalAppearance || undefined,
        pulseRate: parseNumber(pulseRate) ?? undefined,
        respiratoryRate: parseNumber(respiratoryRate) ?? undefined,
        temperature: parseNumber(temperature) ?? undefined,
        oxygenSaturation: parseNumber(oxygenSaturation) ?? undefined,
        oedema,
        fundoscopy: fundoscopy || undefined,
        footExamination,
        otherFindings: otherFindings || undefined,
      } : undefined,
      // HbA1c (DM only)
      ...(isDM &&
      attended &&
      hba1cValue.trim() !== '' &&
      hba1cQuarter
        ? {
            hba1cValue: Number(hba1cValue),
            hba1cQuarter,
            hba1cYear: new Date(visitDate).getFullYear(),
          }
        : {}),
    });

    close();
  };

  function defaultMedicationFromPatient(p: Patient | null): Medication {
    if (!p) return { name: '' };
    const current = getCurrentMeds(p);
    return current.length > 0 ? current[0] : { name: HTN_MEDS[0] };
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0"
        onClick={close}
        style={{ background: 'rgba(0,0,0,.35)' }}
      />

      <div className="absolute inset-y-0 right-0 w-full max-w-[720px] bg-white border-l border-[var(--border)] shadow-[var(--shadow)] flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
          <div>
            <div className="font-syne font-extrabold text-[16px] text-[var(--ink)]">
              Record Visit
            </div>
            <div className="text-[12px] text-[var(--slate)]">{patient.code}</div>
          </div>
          <Button size="xs" variant="ghost" label="Cancel" onClick={close} />
        </div>

        <div className="p-4 overflow-auto flex-1">
          {/* Row 1: Date | Month # | Attendance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                Date
              </div>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
              />
            </div>
            <div>
              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                Month #
              </div>
              <div className="rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 bg-white">
                <span className="mono font-extrabold">{month}</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                Attendance
              </div>
              <select
                value={attended ? 'yes' : 'no'}
                onChange={(e) => setAttended(e.target.value === 'yes')}
                className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
              >
                <option value="yes">✅ Attended</option>
                <option value="no">❌ Missed</option>
              </select>
            </div>
          </div>

          {/* Clinical fields (only for attended) */}
          {attended ? (
            <div className="mt-4 space-y-4">
              {/* BP */}
              <div className="rounded-[var(--r)] border border-[var(--border)] p-3" style={{ background: 'var(--teal-ultra)' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="font-syne font-extrabold text-[14px] text-[var(--teal)]">Blood Pressure</div>
                  {liveBP ? <Chip cls={liveBP.cls}>{liveBP.lbl}</Chip> : <Chip cls="chip-gray">No BP data</Chip>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                      SBP
                    </div>
                    <input
                      type="number"
                      value={sbp}
                      onChange={(e) => setSbp(e.target.value)}
                      className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white mono"
                      placeholder="e.g. 145"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                      DBP
                    </div>
                    <input
                      type="number"
                      value={dbp}
                      onChange={(e) => setDbp(e.target.value)}
                      className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white mono"
                      placeholder="e.g. 95"
                    />
                  </div>
                </div>
              </div>

              {/* Glucose */}
              <div className="rounded-[var(--r)] border border-[var(--border)] p-3" style={{ background: 'var(--amber-pale)' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="font-syne font-extrabold text-[14px] text-[var(--amber)]">Glucose</div>
                  {liveSG ? <Chip cls={liveSG.cls}>{liveSG.lbl}</Chip> : <Chip cls="chip-gray">No glucose data</Chip>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                      Value (mmol/L)
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={sugar}
                      onChange={(e) => setSugar(e.target.value)}
                      className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white mono"
                      placeholder="e.g. 8.2"
                    />
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                      Type
                    </div>
                    <select
                      value={sugarType}
                      onChange={(e) => setSugarType(e.target.value as SugarTestType)}
                      className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
                    >
                      <option value="FBS">FBS</option>
                      <option value="RBS">RBS</option>
                      <option value="2HPP">2HPP</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* HbA1c (DM patients only) */}
              {isDM ? (
                <HbA1cBox
                  patient={patient}
                  value={hba1cValue}
                  quarter={hba1cQuarter}
                  onValueChange={setHba1cValue}
                  onQuarterChange={setHba1cQuarter}
                />
              ) : null}

              {/* MEASUREMENTS row */}
              <div className="rounded-[var(--r)] border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="font-syne font-extrabold text-[14px] text-[var(--ink)]">Measurements</div>
                  <Chip cls="chip-gray">BMI: {bmi === null ? '—' : bmi.toFixed(1)}</Chip>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                      Weight (kg)
                    </div>
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white mono"
                      placeholder="e.g. 70"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                      Height (cm)
                    </div>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white mono"
                      placeholder="e.g. 170"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                      BMI
                    </div>
                    <div className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 bg-white mono font-extrabold text-center">
                      {bmi === null ? '—' : bmi.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION A - CLINICAL NOTES */}
              <div style={{
                background: 'white',
                border: '1px solid rgba(191,200,205,.25)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: '14px',
                  fontWeight: 700,
                  marginBottom: '12px',
                  color: '#0f1f26'
                }}>
                  Clinical Notes
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px',
                    color: '#516169'
                  }}>
                    Presenting Complaint
                  </div>
                  <textarea
                    value={presentingComplaint}
                    onChange={(e) => setPresentingComplaint(e.target.value)}
                    rows={2}
                    style={{
                      width: '100%',
                      borderRadius: '6px',
                      border: '1px solid rgba(191,200,205,.25)',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontFamily: 'Karla, sans-serif',
                      resize: 'vertical',
                      outline: 'none'
                    }}
                    placeholder="Chief complaint and history of presenting illness…"
                  />
                </div>
                
                <div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px',
                    color: '#516169'
                  }}>
                    Clinical Notes
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      borderRadius: '6px',
                      border: '1px solid rgba(191,200,205,.25)',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontFamily: 'Karla, sans-serif',
                      resize: 'vertical',
                      outline: 'none'
                    }}
                    placeholder="General clinical notes, plan, referrals…"
                  />
                </div>
              </div>

              {/* SECTION B - PHYSICAL EXAMINATION */}
              <div style={{
                background: 'rgba(13,110,135,.04)',
                border: '1px solid rgba(13,110,135,.1)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: '14px',
                  fontWeight: 700,
                  marginBottom: '12px',
                  color: '#0d6e87'
                }}>
                  🩺 Physical Examination
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                      color: '#516169'
                    }}>
                      General Appearance
                    </div>
                    <input
                      type="text"
                      value={generalAppearance}
                      onChange={(e) => setGeneralAppearance(e.target.value)}
                      style={{
                        width: '100%',
                        borderRadius: '6px',
                        border: '1px solid rgba(13,110,135,.25)',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontFamily: 'Karla, sans-serif',
                        outline: 'none'
                      }}
                      placeholder=""
                    />
                  </div>
                  
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                      color: '#516169'
                    }}>
                      Pulse Rate
                    </div>
                    <input
                      type="number"
                      value={pulseRate}
                      onChange={(e) => setPulseRate(e.target.value)}
                      style={{
                        width: '100%',
                        borderRadius: '6px',
                        border: '1px solid rgba(13,110,135,.25)',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontFamily: 'Karla, sans-serif',
                        outline: 'none'
                      }}
                      placeholder=""
                    />
                    <div style={{ fontSize: '10px', color: '#516169', marginTop: '2px' }}>bpm</div>
                  </div>
                  
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                      color: '#516169'
                    }}>
                      Respiratory Rate
                    </div>
                    <input
                      type="number"
                      value={respiratoryRate}
                      onChange={(e) => setRespiratoryRate(e.target.value)}
                      style={{
                        width: '100%',
                        borderRadius: '6px',
                        border: '1px solid rgba(13,110,135,.25)',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontFamily: 'Karla, sans-serif',
                        outline: 'none'
                      }}
                      placeholder=""
                    />
                    <div style={{ fontSize: '10px', color: '#516169', marginTop: '2px' }}>/min</div>
                  </div>
                  
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                      color: '#516169'
                    }}>
                      Temperature
                    </div>
                    <input
                      type="number"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      style={{
                        width: '100%',
                        borderRadius: '6px',
                        border: '1px solid rgba(13,110,135,.25)',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontFamily: 'Karla, sans-serif',
                        outline: 'none'
                      }}
                      placeholder=""
                    />
                    <div style={{ fontSize: '10px', color: '#516169', marginTop: '2px' }}>°C</div>
                  </div>
                  
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                      color: '#516169'
                    }}>
                      Oxygen Saturation
                    </div>
                    <input
                      type="number"
                      value={oxygenSaturation}
                      onChange={(e) => setOxygenSaturation(e.target.value)}
                      style={{
                        width: '100%',
                        borderRadius: '6px',
                        border: '1px solid rgba(13,110,135,.25)',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontFamily: 'Karla, sans-serif',
                        outline: 'none'
                      }}
                      placeholder=""
                    />
                    <div style={{ fontSize: '10px', color: '#516169', marginTop: '2px' }}>%</div>
                  </div>
                  
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                      color: '#516169'
                    }}>
                      Oedema
                    </div>
                    <select
                      value={oedema}
                      onChange={(e) => setOedema(e.target.value as any)}
                      style={{
                        width: '100%',
                        borderRadius: '6px',
                        border: '1px solid rgba(13,110,135,.25)',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontFamily: 'Karla, sans-serif',
                        outline: 'none'
                      }}
                    >
                      <option value="none">None</option>
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                  
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                      color: '#516169'
                    }}>
                      Fundoscopy
                    </div>
                    <input
                      type="text"
                      value={fundoscopy}
                      onChange={(e) => setFundoscopy(e.target.value)}
                      style={{
                        width: '100%',
                        borderRadius: '6px',
                        border: '1px solid rgba(13,110,135,.25)',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontFamily: 'Karla, sans-serif',
                        outline: 'none'
                      }}
                      placeholder="findings…"
                    />
                  </div>
                  
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                      color: '#516169'
                    }}>
                      Foot Examination
                    </div>
                    <select
                      value={footExamination}
                      onChange={(e) => setFootExamination(e.target.value as any)}
                      style={{
                        width: '100%',
                        borderRadius: '6px',
                        border: '1px solid rgba(13,110,135,.25)',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontFamily: 'Karla, sans-serif',
                        outline: 'none'
                      }}
                    >
                      <option value="normal">Normal</option>
                      <option value="abnormal">Abnormal</option>
                      <option value="ulcer">Ulcer present</option>
                      <option value="amputation">Amputation</option>
                    </select>
                  </div>
                  
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                      color: '#516169'
                    }}>
                      Other Findings
                    </div>
                    <textarea
                      value={otherFindings}
                      onChange={(e) => setOtherFindings(e.target.value)}
                      rows={2}
                      style={{
                        width: '100%',
                        borderRadius: '6px',
                        border: '1px solid rgba(13,110,135,.25)',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontFamily: 'Karla, sans-serif',
                        resize: 'vertical',
                        outline: 'none'
                      }}
                      placeholder=""
                    />
                  </div>
                </div>
              </div>

              {/* MEDICATIONS */}
              <div className="rounded-[var(--r)] border border-[var(--border)] p-3" style={{ background: 'var(--violet-pale)' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="font-syne font-extrabold text-[14px] text-[var(--violet)]">Medications</div>
                  <Button
                    size="xs"
                    variant="ghost"
                    label="+ Add"
                    onClick={() => setMeds((prev) => [...prev, defaultMedicationFromPatient(patient)])}
                  />
                </div>
                <div className="space-y-3">
                  {meds.map((m, idx) => (
                    <MedRow
                      key={`${m.name}-${idx}`}
                      med={m}
                      onChange={(next) => setMeds((prev) => prev.map((x, i) => (i === idx ? next : x)))}
                      onRemove={() => setMeds((prev) => prev.filter((_, i) => i !== idx))}
                    />
                  ))}
                </div>
              </div>

              {/* SECTION C - INVESTIGATIONS */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid rgba(34,197,94,.25)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: '14px',
                  fontWeight: 700,
                  marginBottom: '12px',
                  color: '#166534'
                }}>
                  🧪 Investigations
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <select
                    style={{
                      width: '100%',
                      borderRadius: '6px',
                      border: '1px solid rgba(34,197,94,.25)',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontFamily: 'Karla, sans-serif',
                      outline: 'none'
                    }}
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        // Add investigation logic here
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">+ Add Investigation</option>
                    <optgroup label="Hematology">
                      <option value="hgb">Hemoglobin</option>
                      <option value="hct">Hematocrit</option>
                      <option value="rbc">Red Blood Cells</option>
                      <option value="wbc">White Blood Cells</option>
                      <option value="plt">Platelets</option>
                    </optgroup>
                    <optgroup label="Renal Function">
                      <option value="creatinine">Creatinine</option>
                      <option value="urea">Urea</option>
                      <option value="egfr">eGFR</option>
                    </optgroup>
                    <optgroup label="Liver Function">
                      <option value="ast">AST (SGOT)</option>
                      <option value="alt">ALT (SGPT)</option>
                      <option value="alp">Alkaline Phosphatase</option>
                      <option value="bilirubin">Bilirubin</option>
                    </optgroup>
                    <optgroup label="Lipids">
                      <option value="cholesterol">Total Cholesterol</option>
                      <option value="ldl">LDL Cholesterol</option>
                      <option value="hdl">HDL Cholesterol</option>
                      <option value="triglycerides">Triglycerides</option>
                    </optgroup>
                    <optgroup label="Glucose Metabolism">
                      <option value="glucose_fasting">Glucose (Fasting)</option>
                      <option value="glucose_random">Glucose (Random)</option>
                      <option value="hba1c">HbA1c</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* SECTION D - NEXT APPOINTMENT */}
              <div className="rounded-[var(--r)] border border-[var(--border)] p-3" style={{ background: 'var(--cream)' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="font-syne font-extrabold text-[14px] text-[var(--ink)]">Next Appointment</div>
                  <div className="text-[12px] text-[var(--slate)]">Hard deadline: {hardDeadline.toLocaleDateString()}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                      Date
                    </div>
                    <input
                      type="date"
                      value={nextDate}
                      onChange={(e) => setNextDate(e.target.value)}
                      className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                      Note (optional)
                    </div>
                    <input
                      type="text"
                      value={nextNote}
                      onChange={(e) => setNextNote(e.target.value)}
                      className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
                      placeholder="e.g. Bring medications"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--cream)] flex gap-2 justify-end">
          <Button size="sm" variant="ghost" label="Cancel" onClick={close} />
          <Button size="sm" variant="primary" label="Save Visit" onClick={onSave} />
        </div>
      </div>
    </div>
  );
}
