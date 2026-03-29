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
import { checkInteractions, checkDiagnosisWarnings, severityDisplay } from '../../data/drugInteractions';
import { useUIStore } from '../../store/useUIStore';
import AdherenceGrid from './AdherenceGrid';
import Chip from '../ui/Chip';
import Alert from '../ui/Alert';
import Button from '../ui/Button';

type DetailTab = 'visits' | 'bp' | 'glucose' | 'hba1c' | 'notesDx';

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
  if (status === 'ltfu')      return 'linear-gradient(135deg,#0f1f26 0%,#7f1d1d 100%)';
  if (status === 'completed') return 'linear-gradient(135deg,#0f1f26 0%,#005469 100%)';
  return 'linear-gradient(135deg,#0f1f26 0%,#005469 100%)';
}


// ═══════════════════════════════════════════════════════════════
// NotesDxCard — collapsible visit card for the Hx & Dx tab
// Most recent visit (index 0) opens by default; others collapsed.
// ═══════════════════════════════════════════════════════════════

function NotesDxCard({
  defaultOpen,
  header,
  summary,
  hasWarnings,
  warningCount,
  diagCount,
  labCount,
  children,
}: {
  defaultOpen: boolean;
  header: string;
  summary: string;
  hasWarnings: boolean;
  warningCount: number;
  diagCount: number;
  labCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      border: '1px solid rgba(191,200,205,.35)',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: open ? '0 2px 8px rgba(15,31,38,.06)' : '0 1px 3px rgba(15,31,38,.04)',
      transition: 'box-shadow .15s',
    }}>
      {/* ── Clickable header ── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 12px',
          background: open
            ? 'linear-gradient(135deg,#0f1f26 0%,#005469 100%)'
            : '#0f1f26',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Left: date + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800,
            fontSize: 12, color: '#fff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {header}
          </div>

          {/* Collapsed summary line */}
          {!open && (
            <div style={{
              fontSize: 10, color: 'rgba(255,255,255,.55)',
              fontFamily: 'Karla, sans-serif',
              marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {summary}
            </div>
          )}
        </div>

        {/* Right: badge row + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {hasWarnings && (
            <span style={{
              fontSize: 8, fontWeight: 800,
              fontFamily: 'Syne, sans-serif',
              textTransform: 'uppercase', letterSpacing: '.3px',
              padding: '1px 6px', borderRadius: 9999,
              background: '#fee2e2', color: '#7f1d1d',
            }}>
              ⚠️ {warningCount}
            </span>
          )}
          {diagCount > 0 && (
            <span style={{
              fontSize: 8, fontWeight: 800,
              fontFamily: 'Syne, sans-serif',
              textTransform: 'uppercase', letterSpacing: '.3px',
              padding: '1px 6px', borderRadius: 9999,
              background: 'rgba(13,110,135,.25)', color: '#e0f7fa',
            }}>
              Dx {diagCount}
            </span>
          )}
          {labCount > 0 && (
            <span style={{
              fontSize: 8, fontWeight: 800,
              fontFamily: 'Syne, sans-serif',
              textTransform: 'uppercase', letterSpacing: '.3px',
              padding: '1px 6px', borderRadius: 9999,
              background: 'rgba(22,163,74,.25)', color: '#bbf7d0',
            }}>
              Labs {labCount}
            </span>
          )}
          <span style={{
            fontSize: 12, color: 'rgba(255,255,255,.5)',
            transition: 'transform .2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}>
            ▼
          </span>
        </div>
      </button>

      {/* ── Collapsible body ── */}
      {open && (
        <div style={{ background: '#fff' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PatientActionBar — Clinical action buttons with safe delete
// ═══════════════════════════════════════════════════════════════

function PatientActionBar({
  patient,
  onVisit,
  onMeds,
  onToggleLTFU,
  onDelete,
}: {
  patient: Patient;
  onVisit: () => void;
  onMeds: () => void;
  onToggleLTFU: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deletePhase, setDeletePhase] = useState<'idle' | 'confirm'>('idle');
  const [deleteInput, setDeleteInput] = useState('');

  const isLTFU = patient.status === 'ltfu';

  function handleDeleteClick() {
    setDeletePhase('confirm');
    setDeleteInput('');
    setMenuOpen(false);
  }

  function handleDeleteConfirm() {
    if (deleteInput.trim().toUpperCase() === patient.code.trim().toUpperCase()) {
      onDelete();
    }
  }

  function cancelDelete() {
    setDeletePhase('idle');
    setDeleteInput('');
  }

  // --- shared button base ---
  const btnBase =
    'inline-flex items-center gap-1.5 rounded font-bold text-[11px] uppercase tracking-[0.5px] px-2.5 py-1.5 transition-all duration-150 select-none cursor-pointer border-0 whitespace-nowrap';

  return (
    <div className="flex flex-col items-end gap-2 min-w-0">

      {/* Delete confirmation overlay */}
      {deletePhase === 'confirm' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
          onClick={cancelDelete}
        >
          <div
            style={{
              background: '#0f1f26',
              border: '1.5px solid rgba(220,38,38,0.4)',
              borderRadius: '10px',
              padding: '24px',
              width: '100%',
              maxWidth: '380px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '24px', color: '#dc2626' }}
              >
                delete_forever
              </span>
              <div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '14px', color: '#fff',
                }}>
                  Permanent Deletion
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '1px' }}>
                  This action cannot be undone
                </div>
              </div>
            </div>

            <div style={{
              fontSize: '12px', color: 'rgba(255,255,255,0.7)',
              background: 'rgba(220,38,38,0.08)',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: '6px',
              padding: '10px 12px',
              marginBottom: '16px',
              lineHeight: 1.5,
            }}>
              All visits, medications, and clinical records for{' '}
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#fff' }}>
                {patient.code}
              </span>{' '}
              will be permanently erased. Type the patient code below to confirm.
            </div>

            <div style={{ marginBottom: '4px' }}>
              <div style={{
                fontSize: '9px', fontFamily: 'Syne, sans-serif', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.5px',
                color: 'rgba(255,255,255,0.4)', marginBottom: '6px',
              }}>
                Type patient code to confirm
              </div>
              <input
                autoFocus
                type="text"
                placeholder={patient.code}
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDeleteConfirm();
                  if (e.key === 'Escape') cancelDelete();
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(220,38,38,0.35)',
                  borderRadius: '5px',
                  padding: '8px 12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#fff',
                  outline: 'none',
                  letterSpacing: '0.5px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={cancelDelete}
                style={{
                  flex: 1, padding: '8px', borderRadius: '5px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Syne, sans-serif',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteInput.trim().toUpperCase() !== patient.code.trim().toUpperCase()}
                style={{
                  flex: 1, padding: '8px', borderRadius: '5px',
                  background: deleteInput.trim().toUpperCase() === patient.code.trim().toUpperCase()
                    ? '#dc2626' : 'rgba(220,38,38,0.2)',
                  border: '1px solid rgba(220,38,38,0.4)',
                  color: deleteInput.trim().toUpperCase() === patient.code.trim().toUpperCase()
                    ? '#fff' : 'rgba(255,255,255,0.3)',
                  fontSize: '12px', fontWeight: 800, cursor: deleteInput.trim().toUpperCase() === patient.code.trim().toUpperCase() ? 'pointer' : 'not-allowed',
                  fontFamily: 'Syne, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                Delete Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main action buttons ── */}
      {/* Mobile: column, Desktop: row */}
      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 flex-wrap justify-end">

        {/* PRIMARY: + Visit */}
        <button
          type="button"
          onClick={onVisit}
          className={btnBase}
          style={{
            background: 'linear-gradient(135deg, #0d6e87 0%, #005469 100%)',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(13,110,135,0.45), 0 0 0 0 rgba(13,110,135,0)',
            fontSize: '12px',
            paddingLeft: '10px',
            paddingRight: '12px',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(13,110,135,0.6), 0 0 0 3px rgba(13,110,135,0.2)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(13,110,135,0.45)';
            (e.currentTarget as HTMLButtonElement).style.transform = '';
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>
            add_circle
          </span>
          Visit
        </button>

        {/* SECONDARY: Edit Meds */}
        <button
          type="button"
          onClick={onMeds}
          className={btnBase}
          style={{
            background: 'rgba(71,85,105,0.75)',
            color: '#e2e8f0',
            border: '1px solid rgba(148,163,184,0.25)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(100,116,139,0.85)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(71,85,105,0.75)';
            (e.currentTarget as HTMLButtonElement).style.transform = '';
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: "'FILL' 1" }}>
            medication
          </span>
          Meds
        </button>

        {/* SECONDARY: Mark LTFU / Recall */}
        <button
          type="button"
          onClick={onToggleLTFU}
          className={btnBase}
          style={isLTFU ? {
            background: 'rgba(16,185,129,0.2)',
            color: '#6ee7b7',
            border: '1px solid rgba(16,185,129,0.35)',
          } : {
            background: 'rgba(217,119,6,0.2)',
            color: '#fcd34d',
            border: '1px solid rgba(217,119,6,0.35)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = isLTFU
              ? 'rgba(16,185,129,0.35)' : 'rgba(217,119,6,0.35)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = isLTFU
              ? 'rgba(16,185,129,0.2)' : 'rgba(217,119,6,0.2)';
            (e.currentTarget as HTMLButtonElement).style.transform = '';
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: "'FILL' 1" }}>
            {isLTFU ? 'person_check' : 'person_off'}
          </span>
          {isLTFU ? 'Recall' : 'LTFU'}
        </button>

        {/* MORE: three-dot menu (Delete hidden here) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={btnBase}
            style={{
              background: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              paddingLeft: '8px',
              paddingRight: '8px',
              minWidth: '32px',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.13)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)';
            }}
            aria-label="More options"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              more_vert
            </span>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <>
              {/* Backdrop */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                onClick={() => setMenuOpen(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 50,
                  background: '#1a2c35',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  minWidth: '160px',
                }}
              >
                <div style={{
                  padding: '5px 12px 4px',
                  fontSize: '9px',
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'rgba(255,255,255,0.3)',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                }}>
                  Danger Zone
                </div>
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '9px 14px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#fca5a5',
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: 'Karla, sans-serif',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', fontVariationSettings: "'FILL' 1" }}>
                    delete_forever
                  </span>
                  Delete Patient
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
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

          <PatientActionBar
            patient={patient}
            onVisit={() => openVisitModal(patient.id)}
            onMeds={() => openMedModal(patient.id)}
            onToggleLTFU={() => setStatus(patient.id, patient.status === 'ltfu' ? 'active' : 'ltfu')}
            onDelete={() => deletePatient(patient.id)}
          />
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
            <button
              type="button"
              onClick={() => setTab('notesDx')}
              className={[
                'px-3 py-2 rounded-full border text-[11px] uppercase font-extrabold tracking-[0.5px]',
                tab === 'notesDx'
                  ? 'bg-[var(--teal-ultra)] border-[var(--teal)] text-[var(--teal)]'
                  : 'bg-white border-[var(--border)] text-[var(--ink)]',
              ].join(' ')}
            >
              Notes & Dx
            </button>
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

            {tab === 'notesDx' ? (
              <div className="space-y-4">

                {/* ── History Summary Stats ── */}
                <div className="rounded-[var(--r)] border border-[var(--border)] p-3" style={{ background: 'var(--teal-ultra)' }}>
                  <div className="font-syne font-extrabold text-[14px] text-[var(--teal)] mb-3">History Summary</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                    <div>
                      <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Total Visits</div>
                      <div className="mono font-extrabold">{(patient.visits ?? []).filter(v => v.att).length}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">First Visit</div>
                      <div className="mono font-extrabold">{patient.enrol ? formatDate(patient.enrol) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Avg BP</div>
                      <div className="mono font-extrabold">{(() => {
                        const bpVisits = (patient.visits ?? []).filter(v => v.att && v.sbp && v.dbp);
                        if (!bpVisits.length) return '—';
                        const avgSbp = bpVisits.reduce((s,v) => s + v.sbp!, 0) / bpVisits.length;
                        const avgDbp = bpVisits.reduce((s,v) => s + v.dbp!, 0) / bpVisits.length;
                        return `${Math.round(avgSbp)}/${Math.round(avgDbp)}`;
                      })()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Avg Glucose</div>
                      <div className="mono font-extrabold">{(() => {
                        const sv = (patient.visits ?? []).filter(v => v.att && v.sugar);
                        if (!sv.length) return '—';
                        return (sv.reduce((s,v) => s + v.sugar!, 0) / sv.length).toFixed(1);
                      })()}</div>
                    </div>
                  </div>
                </div>

                {/* ── Clinical Visit Cards ── */}
                {(patient.visits ?? [])
                  .filter(v => v.att && (v.presentingComplaint || v.notes || v.physicalExam || (v.diagnoses?.length ?? 0) > 0 || (v.investigations?.length ?? 0) > 0))
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((v, visitIdx) => {
                    // ── Drug warnings for this visit's meds ──
                    const medNames = (v.meds ?? []).map(m => m.name).filter(Boolean);
                    const dxCodes  = (v.diagnoses ?? []).map(d => d.code);
                    const ddInteractions = checkInteractions(medNames);
                    const dxWarnings     = checkDiagnosisWarnings(medNames, dxCodes, patient.cond);
                    const hasWarnings    = ddInteractions.length > 0 || dxWarnings.length > 0;

                    // Build a compact summary line for collapsed state
                    const summaryParts: string[] = [];
                    if (v.presentingComplaint) summaryParts.push(v.presentingComplaint.slice(0, 50) + (v.presentingComplaint.length > 50 ? '…' : ''));
                    if ((v.diagnoses?.length ?? 0) > 0) summaryParts.push(v.diagnoses!.map(d => d.code).join(', '));
                    if ((v.investigations?.length ?? 0) > 0) summaryParts.push(`${v.investigations!.length} lab${v.investigations!.length > 1 ? 's' : ''}`);
                    if ((v.meds?.length ?? 0) > 0) summaryParts.push(`${v.meds.length} med${v.meds.length > 1 ? 's' : ''}`);
                    const summary = summaryParts.join(' · ') || 'No summary';

                    return (
                      <NotesDxCard
                        key={v.id}
                        defaultOpen={visitIdx === 0}
                        header={`${formatDateLong(v.date)} — Month ${v.month}`}
                        summary={summary}
                        hasWarnings={hasWarnings}
                        warningCount={ddInteractions.length + dxWarnings.length}
                        diagCount={(v.diagnoses?.length ?? 0)}
                        labCount={(v.investigations?.length ?? 0)}
                      >
                        <div className="p-3 space-y-3">

                          {/* ── Medication Warning Banner ── */}
                          {hasWarnings && (
                            <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(220,38,38,.2)' }}>
                              <div style={{ background: '#7f1d1d', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13 }}>⚠️</span>
                                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 10, color: '#fff', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                  Medication Alerts — {ddInteractions.length + dxWarnings.length} warning{ddInteractions.length + dxWarnings.length > 1 ? 's' : ''} at time of visit
                                </span>
                              </div>
                              <div style={{ background: '#fff9f9', padding: '8px 12px' }}>
                                {dxWarnings.map((w) => {
                                  const disp = severityDisplay(w.warning.severity);
                                  return (
                                    <div key={w.warning.id} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid rgba(220,38,38,.08)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                                        <span style={{ fontSize: 7, fontWeight: 800, padding: '1px 6px', borderRadius: 9999, background: disp.bg, color: disp.color, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                                          {disp.icon} {disp.label}
                                        </span>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, background: 'rgba(124,58,237,.08)', color: '#7c3aed', padding: '1px 6px', borderRadius: 4 }}>{w.drugName}</span>
                                        <span style={{ fontSize: 9, color: '#6f797d' }}>in {w.warning.diagnosisPatterns[0]} patient</span>
                                      </div>
                                      <div style={{ fontSize: 11, color: '#7f1d1d', fontWeight: 600 }}>{w.warning.clinicalEffect}</div>
                                      <div style={{ fontSize: 10, color: '#516169', marginTop: 2 }}>{w.warning.management}</div>
                                    </div>
                                  );
                                })}
                                {ddInteractions.map((i) => {
                                  const disp = severityDisplay(i.interaction.severity);
                                  return (
                                    <div key={i.interaction.id} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid rgba(220,38,38,.08)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                                        <span style={{ fontSize: 7, fontWeight: 800, padding: '1px 6px', borderRadius: 9999, background: disp.bg, color: disp.color, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                                          {disp.icon} {disp.label}
                                        </span>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, background: 'rgba(124,58,237,.08)', color: '#7c3aed', padding: '1px 6px', borderRadius: 4 }}>{i.drug1Name}</span>
                                        {i.drug2Name && <><span style={{ fontSize: 9, color: '#6f797d' }}>+</span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, background: 'rgba(124,58,237,.08)', color: '#7c3aed', padding: '1px 6px', borderRadius: 4 }}>{i.drug2Name}</span></>}
                                      </div>
                                      <div style={{ fontSize: 11, color: '#7f1d1d', fontWeight: 600 }}>{i.interaction.clinicalEffect}</div>
                                      <div style={{ fontSize: 10, color: '#516169', marginTop: 2 }}>{i.interaction.management}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ── Presenting Complaint ── */}
                          {v.presentingComplaint && (
                            <div>
                              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Presenting Complaint</div>
                              <div className="text-[12px] text-[var(--ink)]">{v.presentingComplaint}</div>
                            </div>
                          )}

                          {/* ── Clinical Notes ── */}
                          {v.notes && (
                            <div>
                              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">Clinical Notes</div>
                              <div className="text-[12px] text-[var(--ink)]">{v.notes}</div>
                            </div>
                          )}

                          {/* ── Diagnoses (ICD-10) ── */}
                          {(v.diagnoses?.length ?? 0) > 0 && (
                            <div>
                              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-2">Diagnoses</div>
                              <div className="flex flex-wrap gap-2">
                                {v.diagnoses!.map((d) => (
                                  <span key={d.code} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '3px 10px', borderRadius: 9999,
                                    background: d.isPrimary ? 'rgba(13,110,135,.12)' : 'rgba(191,200,205,.2)',
                                    border: d.isPrimary ? '1px solid rgba(13,110,135,.3)' : '1px solid rgba(191,200,205,.4)',
                                    fontSize: 11, fontWeight: 700,
                                    color: d.isPrimary ? '#005469' : '#516169',
                                    fontFamily: 'Karla, sans-serif',
                                  }}>
                                    {d.isPrimary && <span style={{ fontSize: 9 }}>★</span>}
                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{d.code}</span>
                                    <span>{d.description}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* ── Physical Examination with WHO interpretation ── */}
                          {v.physicalExam && (
                            <div>
                              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-2">Physical Examination</div>
                              <div className="grid grid-cols-2 gap-2">

                                {v.physicalExam.generalAppearance && (
                                  <div className="col-span-2" style={{ fontSize: 12 }}>
                                    <strong>General:</strong> {v.physicalExam.generalAppearance}
                                  </div>
                                )}

                                {v.physicalExam.pulseRate && (() => {
                                  const hr = v.physicalExam!.pulseRate!;
                                  const interp = hr < 60 ? { label: 'Bradycardia', bg: '#dbeafe', color: '#1e3a8a' }
                                               : hr > 100 ? { label: 'Tachycardia', bg: '#fee2e2', color: '#7f1d1d' }
                                               : { label: 'Normal', bg: '#dcfce7', color: '#14532d' };
                                  return (
                                    <div style={{ fontSize: 12 }}>
                                      <strong>Pulse:</strong> {hr} bpm
                                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 9999, background: interp.bg, color: interp.color, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase' }}>
                                        {interp.label}
                                      </span>
                                    </div>
                                  );
                                })()}

                                {v.physicalExam.respiratoryRate && (() => {
                                  const rr = v.physicalExam!.respiratoryRate!;
                                  const interp = rr < 12 ? { label: 'Bradypnoea', bg: '#dbeafe', color: '#1e3a8a' }
                                               : rr > 20  ? { label: 'Tachypnoea', bg: '#fee2e2', color: '#7f1d1d' }
                                               : { label: 'Normal', bg: '#dcfce7', color: '#14532d' };
                                  return (
                                    <div style={{ fontSize: 12 }}>
                                      <strong>RR:</strong> {rr} /min
                                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 9999, background: interp.bg, color: interp.color, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase' }}>
                                        {interp.label}
                                      </span>
                                      {rr > 20 && <span style={{ display: 'block', fontSize: 10, color: '#dc2626', marginTop: 2 }}>WHO: RR &gt;20 — consider respiratory cause, heart failure, acidosis</span>}
                                    </div>
                                  );
                                })()}

                                {v.physicalExam.temperature && (() => {
                                  const t = v.physicalExam!.temperature!;
                                  const interp = t < 35.0 ? { label: 'Hypothermia', bg: '#dbeafe', color: '#1e3a8a' }
                                               : t < 36.0 ? { label: 'Low-normal', bg: '#e0f2fe', color: '#0369a1' }
                                               : t <= 37.2 ? { label: 'Afebrile', bg: '#dcfce7', color: '#14532d' }
                                               : t <= 38.0 ? { label: 'Low-grade fever', bg: '#fef3c7', color: '#78350f' }
                                               : t <= 39.0 ? { label: 'Fever', bg: '#fee2e2', color: '#7f1d1d' }
                                               : { label: 'High fever', bg: '#7f1d1d', color: '#fff' };
                                  return (
                                    <div style={{ fontSize: 12 }}>
                                      <strong>Temp:</strong> {t}°C
                                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 9999, background: interp.bg, color: interp.color, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase' }}>
                                        {interp.label}
                                      </span>
                                      {t > 38.0 && <span style={{ display: 'block', fontSize: 10, color: '#dc2626', marginTop: 2 }}>WHO: Investigate source of fever — check for infection, sepsis</span>}
                                      {t < 35.0 && <span style={{ display: 'block', fontSize: 10, color: '#1e3a8a', marginTop: 2 }}>WHO: Hypothermia — check for sepsis, hypothyroidism, exposure</span>}
                                    </div>
                                  );
                                })()}

                                {v.physicalExam.oxygenSaturation && (() => {
                                  const spo2 = v.physicalExam!.oxygenSaturation!;
                                  const interp = spo2 < 90 ? { label: 'Critical hypoxia', bg: '#7f1d1d', color: '#fff' }
                                               : spo2 < 94 ? { label: 'Hypoxia', bg: '#fee2e2', color: '#7f1d1d' }
                                               : spo2 < 96 ? { label: 'Low-normal', bg: '#fef3c7', color: '#78350f' }
                                               : { label: 'Normal', bg: '#dcfce7', color: '#14532d' };
                                  return (
                                    <div style={{ fontSize: 12 }}>
                                      <strong>O₂ Sat:</strong> {spo2}%
                                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 9999, background: interp.bg, color: interp.color, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase' }}>
                                        {interp.label}
                                      </span>
                                      {spo2 < 94 && <span style={{ display: 'block', fontSize: 10, color: '#dc2626', marginTop: 2 }}>WHO: SpO₂ &lt;94% — supplemental oxygen required</span>}
                                    </div>
                                  );
                                })()}

                                {v.physicalExam.oedema && v.physicalExam.oedema !== 'none' && (
                                  <div style={{ fontSize: 12 }}>
                                    <strong>Oedema:</strong>
                                    <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 9999, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase',
                                      background: v.physicalExam.oedema === 'severe' ? '#fee2e2' : v.physicalExam.oedema === 'moderate' ? '#fef3c7' : '#fef9c3',
                                      color: v.physicalExam.oedema === 'severe' ? '#7f1d1d' : '#78350f',
                                    }}>
                                      {v.physicalExam.oedema}
                                    </span>
                                    {(v.physicalExam.oedema === 'moderate' || v.physicalExam.oedema === 'severe') && (
                                      <span style={{ display: 'block', fontSize: 10, color: '#dc2626', marginTop: 2 }}>Consider heart failure, nephrotic syndrome, hypoalbuminaemia</span>
                                    )}
                                  </div>
                                )}

                                {v.physicalExam.fundoscopy && (
                                  <div style={{ fontSize: 12 }}><strong>Fundoscopy:</strong> {v.physicalExam.fundoscopy}</div>
                                )}
                                {v.physicalExam.footExamination && v.physicalExam.footExamination !== 'normal' && (
                                  <div style={{ fontSize: 12 }}>
                                    <strong>Foot:</strong>
                                    <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 9999, background: '#fee2e2', color: '#7f1d1d', fontFamily: 'Syne, sans-serif', textTransform: 'uppercase' }}>
                                      {v.physicalExam.footExamination}
                                    </span>
                                  </div>
                                )}
                                {v.physicalExam.otherFindings && (
                                  <div className="col-span-2" style={{ fontSize: 12 }}><strong>Other:</strong> {v.physicalExam.otherFindings}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* ── Lab Investigations ── */}
                          {(v.investigations?.length ?? 0) > 0 && (
                            <div>
                              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-2">Lab Investigations</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                                {v.investigations!.map((inv) => {
                                  const lvl = inv.interpretation?.level;
                                  const chipBg    = lvl === 'critical' ? '#7f1d1d' : lvl === 'high' ? '#fee2e2' : lvl === 'low' ? '#dbeafe' : '#dcfce7';
                                  const chipColor = lvl === 'critical' ? '#fff'    : lvl === 'high' ? '#7f1d1d' : lvl === 'low' ? '#1e3a8a' : '#14532d';
                                  return (
                                    <div key={inv.id} style={{
                                      border: `1.5px solid ${lvl && lvl !== 'normal' ? (lvl === 'critical' || lvl === 'high' ? '#fca5a5' : '#93c5fd') : 'rgba(191,200,205,.4)'}`,
                                      borderRadius: 6, padding: '8px 10px',
                                      background: lvl === 'critical' ? 'rgba(127,29,29,.04)' : lvl === 'high' ? 'rgba(220,38,38,.03)' : '#fff',
                                    }}>
                                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 10, color: '#516169', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>
                                        {inv.name}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 14, color: '#0f1f26' }}>
                                          {inv.value || '—'}
                                        </span>
                                        <span style={{ fontSize: 10, color: '#6f797d' }}>{inv.unit}</span>
                                        {inv.interpretation && (
                                          <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 9999, background: chipBg, color: chipColor, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase', letterSpacing: '.3px' }}>
                                            {inv.interpretation.text}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: 9, color: '#6f797d', marginTop: 3 }}>Ref: {inv.reference}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ── Medications Prescribed ── */}
                          {(v.meds?.length ?? 0) > 0 && (
                            <div>
                              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-2">Medications Prescribed</div>
                              <div className="flex flex-wrap gap-2">
                                {v.meds.map((med, idx) => (
                                  <span key={idx} className="px-3 py-1 rounded-full text-[12px] font-extrabold"
                                    style={{ background: 'var(--violet-pale)', color: 'var(--violet)' }}>
                                    {med.name}{med.dose && ` ${med.dose}`}{med.freq && ` · ${med.freq}`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        </div>
                      </NotesDxCard>
                    );
                  })}

                {/* ── Empty state ── */}
                {!(patient.visits ?? []).some(v => v.att && (v.presentingComplaint || v.notes || v.physicalExam || (v.diagnoses?.length ?? 0) > 0 || (v.investigations?.length ?? 0) > 0)) && (
                  <div className="text-[var(--slate)] text-[13px] text-center py-8">
                    No clinical notes recorded yet — add via + Visit
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Status action row (bottom) — secondary status actions */}
      <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--cream)] flex gap-2 flex-wrap justify-end">
        {patient.status !== 'completed' ? (
          <Button size="sm" variant="ghost" label="Mark Completed" onClick={() => setStatus(patient.id, 'completed')} />
        ) : null}
      </div>
    </div>
  );
}

