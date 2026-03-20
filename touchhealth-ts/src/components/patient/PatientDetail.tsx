import { useEffect, useMemo, useState } from 'react';
import type { HbA1cQuarter, Patient } from '../../types';
import {
  bpClass,
  getCurrentMeds,
  getHbA1cTrend,
  getLatestHbA1c,
  getLastVisit,
  hba1cClass,
  isDue,
  isHbA1cAtTarget,
  sgClass,
  formatDate,
  formatDateLong,
} from '../../services/clinical';
import { usePatientStore } from '../../store/usePatientStore';
import { useUIStore } from '../../store/useUIStore';
import AdherenceGrid from './AdherenceGrid';
import Chip from '../ui/Chip';
import Alert from '../ui/Alert';
import Button from '../ui/Button';

type DetailTab = 'visits' | 'bp' | 'glucose' | 'hba1c';

function conditionChipCls(cond: Patient['cond']): string {
  if (cond === 'DM') return 'chip-blue';
  if (cond === 'DM+HTN') return 'chip-elevated';
  return 'chip-high';
}

function patientStatusLabel(status: Patient['status']) {
  if (status === 'ltfu') return 'LTFU';
  if (status === 'completed') return 'COMPLETED';
  return 'ACTIVE';
}

function statusGradient(status: Patient['status']) {
  if (status === 'ltfu') return 'linear-gradient(135deg,var(--ink2),var(--rose))';
  if (status === 'completed')
    return 'linear-gradient(135deg,var(--ink2),var(--ink3))';
  return 'linear-gradient(135deg,var(--ink2),var(--teal2))';
}

export default function PatientDetail() {
  const patient = usePatientStore((s) =>
    s.selectedId !== null ? s.patients.find((p) => p.id === s.selectedId) ?? null : null,
  );

  const openVisitModal = useUIStore((s) => s.openVisitModal);
  const openMedModal = useUIStore((s) => s.openMedModal);

  const setStatus = usePatientStore((s) => s.setStatus);
  const deletePatient = usePatientStore((s) => s.deletePatient);

  const [tab, setTab] = useState<DetailTab>('visits');
  const [hba1cYear, setHbA1cYear] = useState<number | null>(null);

  // Keep tab consistent when switching patients
  useEffect(() => {
    setTab('visits');
  }, [patient?.id]);

  const isDM = patient?.cond === 'DM' || patient?.cond === 'DM+HTN';

  const lv = useMemo(() => (patient ? getLastVisit(patient) : null), [patient]);

  const bpCls = useMemo(() => {
    if (!lv?.sbp || !lv?.dbp) return null;
    return bpClass(lv.sbp, lv.dbp);
  }, [lv]);

  const sgCls = useMemo(() => {
    if (!lv?.sugar || !lv.sugarType) return null;
    return sgClass(lv.sugar, lv.sugarType as any);
  }, [lv]);

  const latestHbA1c = useMemo(() => (patient ? getLatestHbA1c(patient, null) : null), [patient]);

  const hba1cYears = useMemo(() => {
    if (!patient?.hba1c?.length) return [];
    return Array.from(new Set(patient.hba1c.map((h) => h.year))).sort((a, b) => b - a);
  }, [patient]);

  useEffect(() => {
    if (!patient) return;
    if (!isDM) return;
    if (!patient.hba1c?.length) return;
    if (hba1cYear === null) {
      setHbA1cYear(getLatestHbA1c(patient, null)?.year ?? patient.hba1c[0].year);
    }
  }, [patient, isDM, hba1cYear]);

  const overdue = useMemo(() => {
    if (!patient) return false;
    return patient.status === 'active' && isDue(patient);
  }, [patient]);

  const grade3HTN = useMemo(() => {
    if (!patient?.cond) return false;
    if (!lv?.sbp || !lv?.dbp) return false;
    const cls = bpClass(lv.sbp, lv.dbp);
    return cls.cls === 'chip-crisis';
  }, [patient, lv]);

  const dangerGlucose = useMemo(() => {
    if (!lv?.sugar || !lv?.sugarType) return false;
    const cls = sgClass(lv.sugar, lv.sugarType as any);
    return cls.cls === 'chip-crisis';
  }, [lv]);

  const hbA1cAboveTarget = useMemo(() => {
    if (!isDM || !latestHbA1c) return false;
    return !isHbA1cAtTarget(latestHbA1c.value);
  }, [isDM, latestHbA1c]);

  if (!patient) {
    return (
      <div className="h-full border-l border-[var(--border)] bg-white flex items-center justify-center">
        <div className="text-[var(--slate)] text-[13px]">Select a patient to view details.</div>
      </div>
    );
  }

  const status = patient.status;
  const shouldShowHbA1cTab = isDM;

  const trendForYear = useMemo(() => {
    if (!patient || !hba1cYear) return 'insufficient-data';
    if (!patient.hba1c?.length) return 'insufficient-data';
    return getHbA1cTrend(patient, hba1cYear);
  }, [patient, hba1cYear]);

  const trendLabel = (() => {
    switch (trendForYear) {
      case 'improving':
        return '↓ Improving';
      case 'worsening':
        return '↑ Worsening';
      case 'stable':
        return '→ Stable';
      default:
        return '→ Stable';
    }
  })();

  const quarters: HbA1cQuarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
  const hba1cEntriesForYear = patient.hba1c ?? [];

  return (
    <div className="h-full bg-white border-l border-[var(--border)] flex flex-col">
      <div
        className="px-4 py-4 border-b border-[var(--border)]"
        style={{ background: statusGradient(status) }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mono text-[20px] font-extrabold text-white truncate">
              {patient.code}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Chip cls={conditionChipCls(patient.cond)}>{patient.cond}</Chip>
              <Chip cls={status === 'active' ? 'chip-normal' : status === 'ltfu' ? 'chip-high' : 'chip-gray'}>
                {patientStatusLabel(status)}
              </Chip>
            </div>
            <div className="mt-2 text-white/90 text-[13px]">
              {patient.age}y · {patient.sex} · Enrolled: {formatDate(patient.enrol)}
            </div>
            {patient.phone || patient.address ? (
              <div className="mt-1 text-white/80 text-[13px]">
                {patient.phone ? `Phone: ${patient.phone}` : null}
                {patient.phone && patient.address ? ' · ' : null}
                {patient.address ? patient.address : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2 flex-wrap justify-end">
              <Button size="xs" variant="primary" label="+ Visit" onClick={() => openVisitModal(patient.id)} />
              <Button size="xs" variant="ghost" label="Edit Meds" onClick={() => openMedModal(patient.id)} />
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button
                size="xs"
                variant={patient.status === 'ltfu' ? 'amber' : 'ghost'}
                label={patient.status === 'ltfu' ? 'Recall Active' : 'Mark LTFU'}
                onClick={() =>
                  setStatus(patient.id, patient.status === 'ltfu' ? 'active' : 'ltfu')
                }
              />
              <Button
                size="xs"
                variant="danger"
                label="Delete"
                onClick={() => deletePatient(patient.id)}
              />
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="mt-3 flex flex-col gap-2">
          {patient.status === 'ltfu' ? (
            <Alert variant="red" icon={<span>⚠️</span>}>
              Community tracing recommended
            </Alert>
          ) : null}
          {overdue ? (
            <Alert variant="amber" icon={<span>📅</span>}>
              Visit overdue — monthly check-up due
            </Alert>
          ) : null}
          {grade3HTN ? (
            <Alert variant="red" icon={<span>🚨</span>}>
              Urgent: last BP was {lv?.sbp}/{lv?.dbp} mmHg
            </Alert>
          ) : null}
          {dangerGlucose ? (
            <Alert variant="red" icon={<span>🚨</span>}>
              Urgent: last glucose was {lv?.sugar} mmol/L
            </Alert>
          ) : null}
          {hbA1cAboveTarget ? (
            <Alert variant="amber" icon={<span>🧪</span>}>
              HbA1c {latestHbA1c ? latestHbA1c.value.toFixed(1) : '—'}% ({latestHbA1c?.quarter}) — above
              target, review treatment
            </Alert>
          ) : null}
        </div>

        {/* Last readings */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {bpCls && lv?.sbp && lv?.dbp ? (
            <Chip cls={bpCls.cls}>
              BP {lv.sbp}/{lv.dbp} · {bpCls.lbl}
            </Chip>
          ) : (
            <Chip cls="chip-gray">BP —</Chip>
          )}

          {sgCls && lv?.sugar && lv?.sugarType ? (
            <Chip cls={sgCls.cls}>
              Glucose {lv.sugar} {lv.sugarType}
            </Chip>
          ) : (
            <Chip cls="chip-gray">Glucose —</Chip>
          )}

          <Chip cls="chip-gray" title="Last visit date">
            Last visit: {lv?.date ? formatDateLong(lv.date) : '—'}
          </Chip>
        </div>
      </div>

      {/* Adherence + meds quickly */}
      <div className="px-4 pb-4 overflow-auto">
        <AdherenceGrid patient={patient} />

        <div className="mt-4">
          <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-2">
            Current medications
          </div>
          <div className="flex flex-wrap gap-2">
            {(getCurrentMeds(patient) ?? []).length ? (
              getCurrentMeds(patient).map((m, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full text-[12px] font-extrabold"
                  style={{ background: 'var(--violet-pale)', color: 'var(--violet)' }}
                >
                  {m.name}
                </span>
              ))
            ) : (
              <span className="text-[var(--slate)] text-[13px]">—</span>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-[var(--border)] pt-3">
          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setTab('visits')}
              className={[
                'px-3 py-2 rounded-full border text-[11px] uppercase font-extrabold tracking-[0.5px]',
                tab === 'visits'
                  ? 'bg-[var(--teal-ultra)] border-[var(--teal)] text-[var(--teal)]'
                  : 'bg-white border-[var(--border)] text-[var(--ink)]',
              ].join(' ')}
            >
              Visits
            </button>
            <button
              type="button"
              onClick={() => setTab('bp')}
              className={[
                'px-3 py-2 rounded-full border text-[11px] uppercase font-extrabold tracking-[0.5px]',
                tab === 'bp'
                  ? 'bg-[var(--teal-ultra)] border-[var(--teal)] text-[var(--teal)]'
                  : 'bg-white border-[var(--border)] text-[var(--ink)]',
              ].join(' ')}
            >
              BP History
            </button>
            <button
              type="button"
              onClick={() => setTab('glucose')}
              className={[
                'px-3 py-2 rounded-full border text-[11px] uppercase font-extrabold tracking-[0.5px]',
                tab === 'glucose'
                  ? 'bg-[var(--teal-ultra)] border-[var(--teal)] text-[var(--teal)]'
                  : 'bg-white border-[var(--border)] text-[var(--ink)]',
              ].join(' ')}
            >
              Glucose
            </button>

            {shouldShowHbA1cTab ? (
              <button
                type="button"
                onClick={() => setTab('hba1c')}
                className={[
                  'px-3 py-2 rounded-full border text-[11px] uppercase font-extrabold tracking-[0.5px]',
                  tab === 'hba1c'
                    ? 'bg-[var(--teal-ultra)] border-[var(--teal)] text-[var(--teal)]'
                    : 'bg-white border-[var(--border)] text-[var(--ink)]',
              ].join(' ')}
              >
                HbA1c
              </button>
            ) : null}
          </div>

          {/* Tab content */}
          <div className="mt-3">
            {tab === 'visits' ? (
              <div className="space-y-2">
                {(patient.visits ?? [])
                  .slice()
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 10)
                  .map((v) => {
                    const bpR = v.sbp && v.dbp ? bpClass(v.sbp, v.dbp) : null;
                    const sgR = v.sugar && v.sugarType ? sgClass(v.sugar, v.sugarType as any) : null;
                    return (
                      <div key={v.id} className="border border-[var(--border)] rounded-[var(--r-sm)] p-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="font-extrabold text-[13px]">
                            {formatDateLong(v.date)}{' '}
                            <span className="text-[var(--slate)] text-[12px]">· Month {v.month}</span>
                          </div>
                          <Chip cls={v.att ? 'chip-normal' : 'chip-high'}>
                            {v.att ? 'Attended' : 'Missed'}
                          </Chip>
                        </div>
                        {v.att ? (
                          <div className="mt-2 flex gap-2 flex-wrap">
                            {bpR ? (
                              <Chip cls={bpR.cls}>
                                {v.sbp}/{v.dbp} · {bpR.lbl}
                              </Chip>
                            ) : null}
                            {sgR ? (
                              <Chip cls={sgR.cls}>
                                {v.sugar} {v.sugarType} · {sgR.lbl}
                              </Chip>
                            ) : null}
                          </div>
                        ) : null}
                        {v.att ? (
                          <div className="mt-2 text-[12px] text-[var(--slate)]">
                            Meds: {(v.meds ?? []).length ? v.meds.map((m) => m.name).join(', ') : '—'}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            ) : null}

            {tab === 'bp' ? (
              <div className="space-y-2">
                {(patient.visits ?? [])
                  .filter((v) => v.att && v.sbp && v.dbp)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 12)
                  .map((v) => {
                    const bpR = v.sbp && v.dbp ? bpClass(v.sbp, v.dbp) : null;
                    if (!bpR) return null;
                    return (
                      <div key={v.id} className="border border-[var(--border)] rounded-[var(--r-sm)] p-3 flex items-center justify-between gap-3">
                        <div className="font-extrabold text-[13px]">
                          {formatDateLong(v.date)}
                        </div>
                        <Chip cls={bpR.cls}>
                          {v.sbp}/{v.dbp} · {bpR.lbl}
                        </Chip>
                      </div>
                    );
                  })}
                {!(patient.visits ?? []).some((v) => v.att && v.sbp && v.dbp) ? (
                  <div className="text-[var(--slate)] text-[13px]">No BP history yet.</div>
                ) : null}
              </div>
            ) : null}

            {tab === 'glucose' ? (
              <div className="space-y-2">
                {(patient.visits ?? [])
                  .filter((v) => v.att && v.sugar && v.sugarType)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 12)
                  .map((v) => {
                    const sgR = v.sugar && v.sugarType ? sgClass(v.sugar, v.sugarType as any) : null;
                    if (!sgR) return null;
                    return (
                      <div key={v.id} className="border border-[var(--border)] rounded-[var(--r-sm)] p-3 flex items-center justify-between gap-3">
                        <div className="font-extrabold text-[13px]">
                          {formatDateLong(v.date)}
                        </div>
                        <Chip cls={sgR.cls}>
                          {v.sugar} {v.sugarType} · {sgR.lbl}
                        </Chip>
                      </div>
                    );
                  })}
                {!(patient.visits ?? []).some((v) => v.att && v.sugar && v.sugarType) ? (
                  <div className="text-[var(--slate)] text-[13px]">No glucose history yet.</div>
                ) : null}
              </div>
            ) : null}

            {tab === 'hba1c' ? (
              <div className="space-y-3">
                {!patient.hba1c?.length ? (
                  <div className="text-[var(--slate)] text-[13px]">
                    No HbA1c recorded — add via + Visit
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)]">
                          Year
                        </div>
                        <select
                          value={hba1cYear ?? ''}
                          onChange={(e) => setHbA1cYear(e.target.value ? Number(e.target.value) : null)}
                          className="rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
                        >
                          {hba1cYears.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-[12px] font-extrabold text-[var(--teal)]">
                        {trendLabel}
                      </div>
                    </div>

                    <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)]">
                      Target: ≤ 8%
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {quarters.map((q) => {
                        const entry = hba1cEntriesForYear.find((h) => h.year === hba1cYear && h.quarter === q);
                        if (!entry) {
                          return (
                            <div
                              key={q}
                              className="rounded-[var(--r-sm)] border border-[var(--border)] bg-white p-3 text-center"
                            >
                              <div className="text-[10px] uppercase font-extrabold text-[var(--slate)] mb-1">
                                {q}
                              </div>
                              <div className="mono font-extrabold text-[13px]">—</div>
                              <div className="mt-2">
                                <Chip cls="chip-gray">No data</Chip>
                              </div>
                            </div>
                          );
                        }

                        const classified = hba1cClass(entry.value);
                        return (
                          <div
                            key={q}
                            className="rounded-[var(--r-sm)] border border-[var(--border)] bg-white p-3 text-center"
                          >
                            <div className="text-[10px] uppercase font-extrabold text-[var(--slate)] mb-1">
                              {q}
                            </div>
                            <div className="mono font-extrabold text-[16px]">
                              {entry.value.toFixed(1)}%
                            </div>
                            <div className="mt-2">
                              <Chip cls={classified.cls}>
                                {classified.lbl}
                              </Chip>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Status action row (bottom) */}
      <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--cream)] flex gap-2 flex-wrap justify-end">
        {patient.status !== 'ltfu' ? (
          <Button size="sm" variant="danger" label="Mark LTFU" onClick={() => setStatus(patient.id, 'ltfu')} />
        ) : (
          <Button size="sm" variant="ghost" label="Recall Active" onClick={() => setStatus(patient.id, 'active')} />
        )}
        {patient.status !== 'completed' ? (
          <Button size="sm" variant="ghost" label="Mark Completed" onClick={() => setStatus(patient.id, 'completed')} />
        ) : null}
        <Button size="sm" variant="danger" label="Delete" onClick={() => deletePatient(patient.id)} />
      </div>
    </div>
  );
}

