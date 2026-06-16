// ════════════════════════════════════════════════════════════
// REMOTECARE · src/pages/ClinicPage.tsx
// Live clinic workload tracker + Bulk SMS
//
// STATUS RULES (computed purely from date/time — no manual input):
//   EXPECTED  → next visit date = today  AND  current time is 07:00–18:00
//   SEEN      → has a visit recorded today (att=true)
//   OVERDUE   → next visit date < today  OR  (today's patient + time >= 18:00)
//   AUTO-LTFU → overdue >= 21 days → patient.status flipped to 'ltfu' by store
//
// BULK SMS FEATURE:
//   • Checkbox column on every row — tick patients individually
//   • Group-select buttons: "All Expected", "All Overdue", "All Today"
//   • SMS panel slides up from bottom showing count + language picker
//   • Confirmation modal with per-patient preview before sending
//   • Live progress bar during send (rate-limited 200 ms/message)
//   • Results summary: sent / skipped / failed
//
// Page ticks every 60s so Expected→Overdue flips at 18:00 automatically.
// ════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Check, AlertTriangle, AlertOctagon, Trophy,
  ClipboardList, Calendar, Pin, MessageSquare,
  X, Send, ChevronDown, ChevronUp,
} from 'lucide-react';
import { usePatientStore, selectVisiblePatients } from '../store/usePatientStore';
import { useAuthStore }  from '../store/useAuthStore';
import { useUIStore }    from '../store/useUIStore';
import {
  getPatientNextVisitDate,
  bpClass,
  sgClass,
} from '../services/clinical';
import {
  sendSMS,
  getPatientSMSReason,
  getPatientNextDate,
  buildSMSMessage,
} from '../services/sms';
import { loadSMSConfig, loadClinicSettings } from '../services/storage';
import type { Patient } from '../types';

// ── Constants ─────────────────────────────────────────────────
const CLINIC_OPEN_HOUR  = 7;
const CLINIC_CLOSE_HOUR = 18;
const AUTO_LTFU_DAYS    = 21;
const DAYS_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const BULK_RATE_MS = 220; // ms between sends — respects gateway rate limits

// ── Types ─────────────────────────────────────────────────────
type SlotStatus = 'seen' | 'expected' | 'overdue' | 'upcoming';

interface ClinicRow {
  patient:     Patient;
  nextDate:    Date;
  diffDays:    number;
  daysOverdue: number;
  slotStatus:  SlotStatus;
  seenToday:   boolean;
  bpLabel:     string | null;
  bpCrisis:    boolean;
  sgLabel:     string | null;
  sgCrisis:    boolean;
}

type BulkSendState =
  | { phase: 'idle' }
  | { phase: 'confirm' }
  | { phase: 'sending'; current: number; total: number }
  | { phase: 'done'; sent: number; skipped: number; failed: number };

// ── Helpers ───────────────────────────────────────────────────
function fmt12h(hour: number): string {
  const s = hour >= 12 ? 'pm' : 'am';
  return `${hour % 12 || 12}:00 ${s}`;
}

const STATUS_CFG: Record<SlotStatus, { label: string; bg: string; color: string; border: string }> = {
  seen:     { label: 'Seen',     bg: '#dcfce7', color: '#14532d', border: '#86efac' },
  expected: { label: 'Expected', bg: '#fef3c7', color: '#78350f', border: '#fcd34d' },
  overdue:  { label: 'Overdue',  bg: '#fee2e2', color: '#7f1d1d', border: '#fca5a5' },
  upcoming: { label: 'Upcoming', bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },
};

function condStyle(cond: Patient['cond']): React.CSSProperties {
  if (cond === 'DM+HTN') return { background: 'rgba(217,119,6,.12)',  color: '#d97706' };
  if (cond === 'DM')     return { background: 'rgba(16,185,129,.12)', color: '#10b981' };
  return                        { background: 'rgba(220,38,38,.12)',  color: '#dc2626' };
}

// ── Sub-components ────────────────────────────────────────────
function ProgressRing({ pct, size = 56, stroke = 5, color = '#16a34a' }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const d = c * (1 - Math.min(pct, 1));
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={d} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset .6s ease' }} />
    </svg>
  );
}

function StatCard({ label, value, sub, color, ring, total }: {
  label: string; value: number; sub?: string;
  color: string; ring?: boolean; total?: number;
}) {
  const pct = ring && total ? value / total : 0;
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(191,200,205,.3)',
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 1px 4px rgba(15,31,38,.06)', flex: 1, minWidth: 120,
    }}>
      {ring && total !== undefined && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <ProgressRing pct={pct} color={color} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800,
            fontSize: 11, color,
          }}>
            {Math.round(pct * 100)}%
          </div>
        </div>
      )}
      <div>
        <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 26, color, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginTop: 2 }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 10, color: '#6f797d', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function useLiveClock(ms = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

// ── Bulk confirm modal ────────────────────────────────────────
function ConfirmModal({
  rows, lang, onConfirm, onCancel,
}: {
  rows: ClinicRow[];
  lang: 'en' | 'sw';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cfg         = loadSMSConfig();
  const clinicCfg   = loadClinicSettings();
  const [expanded, setExpanded] = useState<number | null>(null);

  const previews = useMemo(() =>
    rows.map((r) => {
      const reason  = getPatientSMSReason(r.patient, clinicCfg) ?? 'reminder';
      const nd      = getPatientNextDate(r.patient, clinicCfg);
      const message = buildSMSMessage(r.patient, cfg, lang, nd, reason);
      const hasPhone = !!r.patient.phone;
      return { row: r, reason, message, hasPhone };
    }),
  [rows, lang, cfg, clinicCfg]);

  const withPhone = previews.filter(p => p.hasPhone).length;
  const noPhone   = previews.length - withPhone;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,31,38,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: 560, maxWidth: '95vw',
        maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(15,31,38,.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px 14px', borderBottom: '1px solid rgba(191,200,205,.25)',
          background: '#0f1f26',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 15, color: '#fff' }}>
                Confirm Bulk SMS
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>
                {withPhone} of {previews.length} patients have phone numbers · Language: {lang === 'sw' ? 'Swahili' : 'English'}
              </div>
            </div>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.6)', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Patient list with message preview */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {noPhone > 0 && (
            <div style={{ padding: '8px 22px', background: 'rgba(220,38,38,.06)', borderBottom: '1px solid rgba(220,38,38,.12)', fontSize: 11, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={12} />
              {noPhone} patient{noPhone > 1 ? 's' : ''} without a phone number will be skipped.
            </div>
          )}

          {previews.map(({ row: r, reason, message, hasPhone }, i) => (
            <div key={r.patient.id} style={{
              borderBottom: i < previews.length - 1 ? '1px solid rgba(191,200,205,.15)' : 'none',
              opacity: hasPhone ? 1 : 0.45,
            }}>
              <div
                onClick={() => setExpanded(expanded === r.patient.id ? null : r.patient.id)}
                style={{
                  padding: '10px 22px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: expanded === r.patient.id ? 'rgba(13,110,135,.04)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
                    fontWeight: 700, fontSize: 11, color: '#005469',
                    background: 'rgba(0,84,105,.08)', padding: '2px 7px', borderRadius: 4,
                  }}>
                    {r.patient.code}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px',
                    padding: '2px 7px', borderRadius: 9999,
                    ...(() => {
                      const s = STATUS_CFG[r.slotStatus];
                      return { background: s.bg, color: s.color, border: `1px solid ${s.border}` };
                    })(),
                  }}>
                    {STATUS_CFG[r.slotStatus].label}
                  </span>
                  <span style={{ fontSize: 9, color: '#6f797d', textTransform: 'uppercase', letterSpacing: '.3px' }}>
                    {reason.replace('_', ' ')}
                  </span>
                  {!hasPhone && (
                    <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>NO PHONE</span>
                  )}
                </div>
                {expanded === r.patient.id ? <ChevronUp size={14} color="#6f797d" /> : <ChevronDown size={14} color="#6f797d" />}
              </div>

              {expanded === r.patient.id && (
                <div style={{
                  padding: '0 22px 12px 44px',
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  fontSize: 11, color: '#374151',
                  background: 'rgba(13,110,135,.03)',
                  borderTop: '1px solid rgba(191,200,205,.1)',
                  paddingTop: 10,
                }}>
                  <div style={{ marginBottom: 4, fontWeight: 600, color: '#516169', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                    Message preview
                  </div>
                  <div style={{
                    background: '#fff', border: '1px solid rgba(191,200,205,.35)',
                    borderRadius: 8, padding: '10px 14px',
                    fontStyle: 'italic', lineHeight: 1.55, color: '#0f1f26',
                  }}>
                    {message}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid rgba(191,200,205,.25)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          background: '#f8fafc',
        }}>
          <button onClick={onCancel} style={{
            padding: '8px 20px', borderRadius: 6, border: '1.5px solid rgba(191,200,205,.5)',
            background: '#fff', color: '#516169', cursor: 'pointer',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, fontWeight: 700,
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={withPhone === 0} style={{
            padding: '8px 20px', borderRadius: 6, border: 'none',
            background: withPhone === 0 ? '#bfc8cd' : 'linear-gradient(135deg,#0d6e87 0%,#005469 100%)',
            color: '#fff', cursor: withPhone === 0 ? 'not-allowed' : 'pointer',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: withPhone > 0 ? '0 2px 8px rgba(13,110,135,.35)' : 'none',
          }}>
            <Send size={13} />
            Send to {withPhone} patient{withPhone !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function ClinicPage() {
  const currentUser    = useAuthStore((s) => s.currentUser);
  const patients       = usePatientStore((s) => s.patients);
  const openVisitModal = useUIStore((s) => s.openVisitModal);
  const clinicSettings = useUIStore((s) => s.clinicSettings);
  const toggleClinicDay = useUIStore((s) => s.toggleClinicDay);

  const now = useLiveClock(60_000);

  const [activeTab, setActiveTab]   = useState<'today' | 'schedule'>('today');
  const [searchQ, setSearchQ]       = useState('');

  // ── Bulk SMS state ─────────────────────────────────────────
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [smsLang, setSmsLang]       = useState<'en' | 'sw'>('sw');
  const [bulkState, setBulkState]   = useState<BulkSendState>({ phase: 'idle' });
  const abortRef = useRef(false);

  const visible = useMemo(
    () => selectVisiblePatients(patients, currentUser),
    [patients, currentUser]
  );

  // ── Compute every active patient's clinic status ────────────
  const allRows = useMemo<ClinicRow[]>(() => {
    const todayMid = new Date(now); todayMid.setHours(0, 0, 0, 0);
    const todayISO = todayMid.toISOString().split('T')[0];
    const afterHours = now.getHours() >= CLINIC_CLOSE_HOUR;

    return visible
      .filter((p) => p.status === 'active')
      .map((p) => {
        const seenToday = (p.visits ?? []).some((v) => v.att && v.date === todayISO);
        const nextDate  = getPatientNextVisitDate(p, clinicSettings);
        const nextMid   = new Date(nextDate); nextMid.setHours(0, 0, 0, 0);
        const diffDays  = Math.round((nextMid.getTime() - todayMid.getTime()) / 86_400_000);
        const daysOverdue = diffDays < 0 ? Math.abs(diffDays) : 0;

        let slotStatus: SlotStatus;
        if (seenToday)                                 slotStatus = 'seen';
        else if (diffDays === 0 && !afterHours)        slotStatus = 'expected';
        else if (diffDays < 0 || (diffDays === 0 && afterHours)) slotStatus = 'overdue';
        else                                           slotStatus = 'upcoming';

        const lv = (p.visits ?? []).filter(v => v.att)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null;

        let bpLabel: string | null = null, bpCrisis = false;
        if (lv?.sbp && lv?.dbp) {
          const c = bpClass(lv.sbp, lv.dbp);
          bpLabel  = `${lv.sbp}/${lv.dbp}`;
          bpCrisis = c.cls === 'chip-crisis' || c.cls === 'chip-high';
        }
        let sgLabel: string | null = null, sgCrisis = false;
        if (lv?.sugar && lv?.sugarType) {
          const c = sgClass(lv.sugar, lv.sugarType as any);
          sgLabel  = `${lv.sugar}`;
          sgCrisis = c.cls === 'chip-crisis' || c.cls === 'chip-high';
        }

        return { patient: p, nextDate, diffDays, daysOverdue, slotStatus, seenToday, bpLabel, bpCrisis, sgLabel, sgCrisis };
      })
      .sort((a, b) => {
        const order: SlotStatus[] = ['expected', 'seen', 'overdue', 'upcoming'];
        const d = order.indexOf(a.slotStatus) - order.indexOf(b.slotStatus);
        return d !== 0 ? d : a.diffDays - b.diffDays;
      });
  }, [visible, clinicSettings, now]);

  const todayRows = useMemo(() =>
    allRows.filter((r) =>
      r.slotStatus === 'expected' ||
      r.slotStatus === 'seen'     ||
      (r.slotStatus === 'overdue' && r.daysOverdue === 0)
    ), [allRows]
  );

  const scheduleRows = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    return !q ? allRows : allRows.filter(r =>
      r.patient.code.toLowerCase().includes(q) ||
      r.patient.cond.toLowerCase().includes(q)
    );
  }, [allRows, searchQ]);

  const countExpected = allRows.filter(r => r.slotStatus === 'expected').length;
  const countSeen     = allRows.filter(r => r.slotStatus === 'seen').length;
  const countOverdue  = allRows.filter(r => r.slotStatus === 'overdue').length;
  const totalToday    = countExpected + countSeen;
  const clinicOpen    = now.getHours() >= CLINIC_OPEN_HOUR && now.getHours() < CLINIC_CLOSE_HOUR;
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── Bulk selection helpers ─────────────────────────────────
  const toggleSelect = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectGroup = useCallback((status: SlotStatus | 'today' | 'all') => {
    let group: ClinicRow[];
    if (status === 'today')       group = todayRows;
    else if (status === 'all')    group = activeTab === 'today' ? todayRows : scheduleRows;
    else                          group = (activeTab === 'today' ? todayRows : scheduleRows).filter(r => r.slotStatus === status);
    const ids = group.filter(r => r.patient.phone).map(r => r.patient.id);
    setSelected(new Set(ids));
  }, [todayRows, scheduleRows, activeTab]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectedRows = useMemo(() => {
    const currentRows = activeTab === 'today' ? todayRows : scheduleRows;
    return currentRows.filter(r => selected.has(r.patient.id));
  }, [selected, todayRows, scheduleRows, activeTab]);

  // ── Bulk send ──────────────────────────────────────────────
  const handleConfirmSend = useCallback(async () => {
    const cfg        = loadSMSConfig();
    const clinicCfg  = loadClinicSettings();
    const toSend     = selectedRows.filter(r => r.patient.phone);

    setBulkState({ phase: 'sending', current: 0, total: toSend.length });
    abortRef.current = false;

    let sent = 0, skipped = 0, failed = 0;

    for (let i = 0; i < toSend.length; i++) {
      if (abortRef.current) break;

      const r      = toSend[i];
      const reason = getPatientSMSReason(r.patient, clinicCfg) ?? 'reminder';

      setBulkState({ phase: 'sending', current: i + 1, total: toSend.length });

      try {
        const result = await sendSMS(r.patient, smsLang, cfg, clinicCfg, reason);
        if (result.status === 'sent' || result.status === 'demo') sent++;
        else failed++;
      } catch {
        failed++;
      }

      if (i < toSend.length - 1) {
        await new Promise(res => setTimeout(res, BULK_RATE_MS));
      }
    }

    const skippedNoPhone = selectedRows.length - toSend.length;
    skipped += skippedNoPhone;

    setBulkState({ phase: 'done', sent, skipped, failed });
    setSelected(new Set());
  }, [selectedRows, smsLang]);

  const resetSms = useCallback(() => {
    setBulkState({ phase: 'idle' });
    abortRef.current = true;
  }, []);

  // ── Row renderer ───────────────────────────────────────────
  const TABLE_HEADERS = ['', 'Status', 'Code', 'Patient', 'Appointment', 'Days', 'Last BP', 'Glucose', 'Action'];

  function renderRow(row: ClinicRow, i: number, arr: ClinicRow[]) {
    const { patient: p, nextDate, diffDays, daysOverdue, slotStatus, seenToday, bpLabel, bpCrisis, sgLabel, sgCrisis } = row;
    const cfg = STATUS_CFG[slotStatus];
    const isSelected = selected.has(p.id);
    const hasPhone   = !!p.phone;

    return (
      <tr key={p.id}
        style={{
          background:
            isSelected       ? 'rgba(13,110,135,.06)' :
            slotStatus === 'seen'     ? 'rgba(22,163,74,.03)' :
            slotStatus === 'expected' ? 'rgba(217,119,6,.03)' :
            slotStatus === 'overdue'  ? 'rgba(220,38,38,.04)' : '#fff',
          borderBottom: i < arr.length - 1 ? '1px solid rgba(191,200,205,.18)' : 'none',
          outline: isSelected ? '2px solid rgba(13,110,135,.3)' : 'none',
          outlineOffset: -2,
          transition: 'all .1s',
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(13,110,135,.05)'; }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background =
            slotStatus === 'seen'     ? 'rgba(22,163,74,.03)' :
            slotStatus === 'expected' ? 'rgba(217,119,6,.03)' :
            slotStatus === 'overdue'  ? 'rgba(220,38,38,.04)' : '#fff';
        }}
      >
        {/* Checkbox */}
        <td style={{ padding: '10px 6px 10px 14px', width: 32 }}>
          <input
            type="checkbox"
            checked={isSelected}
            disabled={!hasPhone}
            onChange={() => toggleSelect(p.id)}
            title={!hasPhone ? 'No phone number on record' : 'Select for bulk SMS'}
            style={{ width: 15, height: 15, cursor: hasPhone ? 'pointer' : 'not-allowed', accentColor: '#0d6e87', opacity: hasPhone ? 1 : 0.3 }}
          />
        </td>

        {/* Status badge */}
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          <span style={{
            fontSize: 9, fontWeight: 800,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            textTransform: 'uppercase', letterSpacing: '.4px',
            padding: '3px 9px', borderRadius: 9999,
            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
          }}>
            {cfg.label}
          </span>
        </td>

        {/* Code */}
        <td style={{ padding: '10px 14px' }}>
          <span style={{
            fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontWeight: 700, fontSize: 11,
            color: slotStatus === 'overdue' ? '#dc2626' : '#005469',
            background: slotStatus === 'overdue' ? 'rgba(220,38,38,.08)' : 'rgba(0,84,105,.08)',
            padding: '2px 8px', borderRadius: 4,
          }}>
            {p.code}
          </span>
        </td>

        {/* Patient info */}
        <td style={{ padding: '10px 14px' }}>
          <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 12, color: '#0f1f26', fontWeight: 600 }}>
            {p.age}y · {p.sex}
          </div>
          <span style={{
            fontSize: 9, fontWeight: 800,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            textTransform: 'uppercase', letterSpacing: '.4px',
            padding: '1px 6px', borderRadius: 9999, ...condStyle(p.cond),
          }}>
            {p.cond}
          </span>
                  {!hasPhone && (
                    <span style={{ marginLeft: 4, fontSize: 9, color: '#9a3412', display: 'inline-flex', alignItems: 'center' }}>
                      <AlertTriangle size={10} />
                    </span>
                  )}
        </td>

        {/* Appointment date */}
        <td style={{ padding: '10px 14px' }}>
          <div style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: 11, fontWeight: 700, color: '#0f1f26' }}>
            {nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 10, color: '#6f797d' }}>
            {p.scheduledNext
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pin size={10} /> confirmed</span>
              : '≈ predicted'}
          </div>
        </td>

        {/* Days */}
        <td style={{ padding: '10px 14px' }}>
          {slotStatus === 'overdue' && daysOverdue > 0 ? (
            <span style={{
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 10, fontWeight: 800,
              color: daysOverdue >= AUTO_LTFU_DAYS ? '#7f1d1d' : '#dc2626',
              background: daysOverdue >= AUTO_LTFU_DAYS ? 'rgba(127,29,29,.1)' : 'rgba(220,38,38,.08)',
              padding: '2px 7px', borderRadius: 4,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {daysOverdue >= AUTO_LTFU_DAYS ? <AlertOctagon size={12} /> : <AlertTriangle size={12} />} {daysOverdue}d late
            </span>
          ) : slotStatus === 'seen' ? (
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} /> Attended
            </span>
          ) : slotStatus === 'expected' ? (
            <span style={{ fontSize: 10, color: '#d97706', fontWeight: 700 }}>Due today</span>
          ) : (
            <span style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: 11, color: '#0369a1', fontWeight: 700 }}>
              in {diffDays}d
            </span>
          )}
        </td>

        {/* BP */}
        <td style={{ padding: '10px 14px' }}>
          {bpLabel
            ? <span style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: 11, fontWeight: 700, color: bpCrisis ? '#dc2626' : '#16a34a' }}>{bpLabel}</span>
            : <span style={{ color: '#bfc8cd', fontSize: 11 }}>—</span>}
        </td>

        {/* Glucose */}
        <td style={{ padding: '10px 14px' }}>
          {sgLabel
            ? <span style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: 11, fontWeight: 700, color: sgCrisis ? '#dc2626' : '#16a34a' }}>{sgLabel}</span>
            : <span style={{ color: '#bfc8cd', fontSize: 11 }}>—</span>}
        </td>

        {/* Action */}
        <td style={{ padding: '10px 14px' }}>
          {seenToday ? (
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} /> Done
            </span>
          ) : (
            <button
              onClick={() => openVisitModal(p.id)}
              style={{
                padding: '5px 13px',
                background: 'linear-gradient(135deg,#0d6e87 0%,#005469 100%)',
                color: '#fff', border: 'none', borderRadius: 5,
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 10,
                fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.4px',
                boxShadow: '0 2px 6px rgba(13,110,135,.35)',
              }}
            >
              + Visit
            </button>
          )}
        </td>
      </tr>
    );
  }

  // ── Table with bulk-select header ──────────────────────────
  function Table({ rows, empty, status: _status }: { rows: ClinicRow[]; empty: string; status?: SlotStatus }) {
    const allWithPhone = rows.filter(r => r.patient.phone);
    const allSelected  = allWithPhone.length > 0 && allWithPhone.every(r => selected.has(r.patient.id));
    const someSelected = allWithPhone.some(r => selected.has(r.patient.id));

    const toggleAll = () => {
      if (allSelected) {
        setSelected(prev => {
          const next = new Set(prev);
          rows.forEach(r => next.delete(r.patient.id));
          return next;
        });
      } else {
        setSelected(prev => {
          const next = new Set(prev);
          rows.filter(r => r.patient.phone).forEach(r => next.add(r.patient.id));
          return next;
        });
      }
    };

    return (
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,31,38,.06)', border: '1px solid rgba(191,200,205,.18)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0f1f26' }}>
                {/* Select-all checkbox */}
                <th style={{ padding: '11px 6px 11px 14px', width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    disabled={allWithPhone.length === 0}
                    title="Select all with phone"
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0d6e87' }}
                  />
                </th>
                {TABLE_HEADERS.slice(1).map((h) => (
                  <th key={h} style={{
                    padding: '11px 14px', textAlign: 'left',
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '.6px',
                    color: 'rgba(255,255,255,.7)', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: '#6f797d', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 13 }}>{empty}</td></tr>
                : rows.map((r, i, arr) => renderRow(r, i, arr))
              }
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Bulk SMS floating panel ────────────────────────────────
  const selectedCount   = selected.size;
  const showSmsPanel    = selectedCount > 0 || bulkState.phase !== 'idle';
  const sendingState    = bulkState.phase === 'sending' ? bulkState : null;
  const sendProgress    = sendingState ? Math.round((sendingState.current / sendingState.total) * 100) : 0;

  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '24px 28px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Modals ── */}
      {bulkState.phase === 'confirm' && (
        <ConfirmModal
          rows={selectedRows}
          lang={smsLang}
          onConfirm={handleConfirmSend}
          onCancel={() => setBulkState({ phase: 'idle' })}
        />
      )}

      {/* ── Header + live clock ── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#6f797d', marginBottom: 3 }}>
            Registry › Clinic Day
          </div>
          <h1 style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, fontSize: 28, color: '#132b31', margin: 0 }}>
            Today's Clinic
          </h1>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{dateStr}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontWeight: 800, fontSize: 28, color: '#0f1f26', lineHeight: 1 }}>
            {timeStr}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 9999,
            background: clinicOpen ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)',
            border: `1px solid ${clinicOpen ? 'rgba(22,163,74,.25)' : 'rgba(220,38,38,.25)'}`,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: clinicOpen ? '#16a34a' : '#dc2626',
              display: 'inline-block',
              boxShadow: clinicOpen ? '0 0 0 3px rgba(22,163,74,.2)' : 'none',
            }} />
            <span style={{
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.4px',
              color: clinicOpen ? '#15803d' : '#9a3412',
            }}>
              {clinicOpen
                ? `Clinic Open · closes ${fmt12h(CLINIC_CLOSE_HOUR)}`
                : `Clinic Closed · opens ${fmt12h(CLINIC_OPEN_HOUR)}`}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatCard label="Expected Today" value={countExpected} color="#d97706" sub={countExpected > 0 ? 'still waiting' : 'none pending'} />
        <StatCard label="Seen Today" value={countSeen} ring total={totalToday || 1} color="#16a34a" sub={`of ${totalToday} scheduled`} />
        <StatCard label="Overdue" value={countOverdue} color="#dc2626" sub="missed appointment" />
        <StatCard label="Active Patients" value={allRows.length} color="#005469" sub="in programme" />
      </div>

      {/* ── Progress bar ── */}
      {totalToday > 0 && (
        <div style={{
          background: '#fff', border: '1px solid rgba(191,200,205,.3)',
          borderRadius: 10, padding: '14px 20px', marginBottom: 16,
          boxShadow: '0 1px 4px rgba(15,31,38,.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: '#516169' }}>
              Workload Progress
            </span>
            <span style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontWeight: 700, fontSize: 13, color: '#0f1f26' }}>
              {countSeen} / {totalToday} seen
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 9999, background: 'rgba(191,200,205,.25)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round((countSeen / totalToday) * 100)}%`,
              background: 'linear-gradient(90deg,#0d6e87 0%,#16a34a 100%)',
              borderRadius: 9999, transition: 'width .6s ease',
              minWidth: countSeen > 0 ? 4 : 0,
            }} />
          </div>
          <div style={{ fontSize: 10, color: '#6f797d', marginTop: 5, textAlign: 'right' }}>
            {Math.round((countSeen / totalToday) * 100)}% complete
            {countExpected > 0 && ` · ${countExpected} still waiting`}
            {countSeen === totalToday && totalToday > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Trophy size={12} /> All done!</span>
            )}
          </div>
        </div>
      )}

      {/* ── Clinic day selector ── */}
      <div style={{
        background: '#fff', borderRadius: 10,
        border: '1px solid rgba(191,200,205,.2)',
        padding: '12px 16px', marginBottom: 16,
        boxShadow: '0 1px 4px rgba(15,31,38,.06)',
      }}>
        <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#6f797d', marginBottom: 8 }}>
          Clinic Days — appointments snap to nearest selected day
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[1,2,3,4,5,6,0].map((d) => {
            const on = clinicSettings.days.includes(d as any);
            const isToday = new Date().getDay() === d;
            return (
              <button key={d} onClick={() => toggleClinicDay(d as any)} style={{
                padding: '5px 14px', borderRadius: 9999,
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 10, fontWeight: 700,
                cursor: 'pointer', transition: 'all .12s',
                border: on ? '2px solid #0d6e87' : '1.5px solid rgba(191,200,205,.4)',
                background: on ? (isToday ? '#0d6e87' : 'rgba(13,110,135,.08)') : '#fff',
                color: on ? (isToday ? '#fff' : '#0d6e87') : '#516169',
                boxShadow: isToday && on ? '0 0 0 3px rgba(13,110,135,.2)' : 'none',
              }}>
                {DAYS_SHORT[d]}{isToday && <span style={{ marginLeft: 3, fontSize: 8, display: 'inline-flex' }}><Check size={9} /></span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tabs + group-select + language ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['today', 'schedule'] as const).map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); clearSelection(); }} style={{
              padding: '7px 16px', borderRadius: 9999,
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.4px',
              cursor: 'pointer', border: 'none', transition: 'all .12s',
              background: activeTab === tab ? '#0f1f26' : 'rgba(191,200,205,.2)',
              color: activeTab === tab ? '#fff' : '#516169',
            }}>
              {tab === 'today'
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ClipboardList size={12} /> Today ({todayRows.length})</span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> All Patients ({scheduleRows.length})</span>}
            </button>
          ))}
        </div>

        {/* Group-select buttons + language picker */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#6f797d' }}>
            Quick select:
          </span>
          {activeTab === 'today' ? (
            <>
              <button onClick={() => selectGroup('expected')} style={quickSelectBtn('#d97706')}>
                Expected ({countExpected})
              </button>
              <button onClick={() => selectGroup('overdue')} style={quickSelectBtn('#dc2626')}>
                Overdue ({countOverdue})
              </button>
              <button onClick={() => selectGroup('today')} style={quickSelectBtn('#0d6e87')}>
                All Today ({todayRows.filter(r => r.patient.phone).length})
              </button>
            </>
          ) : (
            <button onClick={() => selectGroup('all')} style={quickSelectBtn('#0d6e87')}>
              All with phone ({scheduleRows.filter(r => r.patient.phone).length})
            </button>
          )}
          {selectedCount > 0 && (
            <button onClick={clearSelection} style={quickSelectBtn('#6f797d')}>
              Clear ({selectedCount})
            </button>
          )}

          {/* Language toggle */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 6 }}>
            {(['sw', 'en'] as const).map(l => (
              <button key={l} onClick={() => setSmsLang(l)} style={{
                padding: '4px 10px', borderRadius: 9999,
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 9, fontWeight: 700,
                cursor: 'pointer', border: 'none',
                background: smsLang === l ? '#0f1f26' : 'rgba(191,200,205,.2)',
                color: smsLang === l ? '#fff' : '#516169',
                textTransform: 'uppercase', letterSpacing: '.4px',
              }}>
                {l === 'sw' ? 'Swahili' : 'English'}
              </button>
            ))}
          </div>

          {activeTab === 'schedule' && (
            <input type="text" placeholder="Search code or condition…"
              value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12,
                border: '1.5px solid rgba(191,200,205,.5)',
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: '#0f1f26', outline: 'none', width: 200,
              }}
            />
          )}
        </div>
      </div>

      {/* ── TODAY TAB ── */}
      {activeTab === 'today' && (
        <>
          {allRows.filter(r => r.slotStatus === 'expected').length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: '#d97706', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
                Waiting · {allRows.filter(r => r.slotStatus === 'expected').length} expected
              </div>
              <Table rows={allRows.filter(r => r.slotStatus === 'expected')} empty="" status="expected" />
            </div>
          )}

          {countSeen > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: '#16a34a', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Check size={12} /> Seen today · {countSeen}
              </div>
              <Table rows={allRows.filter(r => r.slotStatus === 'seen')} empty="" status="seen" />
            </div>
          )}

          {todayRows.filter(r => r.slotStatus === 'overdue').length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: '#dc2626', marginBottom: 8 }}>
                Missed today — clinic closed
              </div>
              <Table rows={todayRows.filter(r => r.slotStatus === 'overdue')} empty="" status="overdue" />
            </div>
          )}

          {todayRows.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(191,200,205,.2)', padding: '48px 32px', textAlign: 'center', boxShadow: '0 1px 4px rgba(15,31,38,.06)' }}>
              <div style={{ fontSize: 36, marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Calendar size={36} color="#0d6e87" /></div>
              <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, fontSize: 14, color: '#0f1f26', marginBottom: 6 }}>
                No patients scheduled for today
              </div>
              <div style={{ fontSize: 12, color: '#6f797d' }}>
                Today is {DAYS_FULL[new Date().getDay()]} · Clinic days: {clinicSettings.days.map(d => DAYS_SHORT[d]).join(', ') || 'none selected'}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SCHEDULE TAB ── */}
      {activeTab === 'schedule' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {(Object.entries(STATUS_CFG) as [SlotStatus, typeof STATUS_CFG.seen][]).map(([k, v]) => (
              <span key={k} style={{
                fontSize: 9, fontWeight: 700,
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                textTransform: 'uppercase', letterSpacing: '.4px',
                padding: '2px 9px', borderRadius: 9999,
                background: v.bg, color: v.color, border: `1px solid ${v.border}`,
              }}>
                {v.label} · {allRows.filter(r => r.slotStatus === k).length}
              </span>
            ))}
            {countOverdue > 0 && (
              <span style={{ fontSize: 9, fontWeight: 700, color: '#7f1d1d', padding: '2px 0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <AlertOctagon size={10} /> {allRows.filter(r => r.daysOverdue >= AUTO_LTFU_DAYS).length} at {AUTO_LTFU_DAYS}+ days → auto-LTFU
              </span>
            )}
          </div>
          <Table rows={scheduleRows} empty="No patients match your search" />
        </>
      )}

      {/* ── Floating SMS panel ── */}
      {showSmsPanel && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, width: 'min(600px, 95vw)',
          background: '#0f1f26', borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(15,31,38,.45)',
        }}>
          {/* Sending progress bar */}
          {bulkState.phase === 'sending' && (
            <div style={{ height: 4, background: 'rgba(255,255,255,.12)' }}>
              <div style={{
                height: '100%',
                width: `${sendProgress}%`,
                background: 'linear-gradient(90deg,#0d6e87,#16a34a)',
                transition: 'width .3s ease',
              }} />
            </div>
          )}

          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <MessageSquare size={18} color="#0d6e87" style={{ flexShrink: 0 }} />

            {/* IDLE — selection active */}
            {bulkState.phase === 'idle' && (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 13, color: '#fff' }}>
                    {selectedCount} patient{selectedCount !== 1 ? 's' : ''} selected for SMS
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 1 }}>
                    Language: {smsLang === 'sw' ? 'Swahili' : 'English'} · Reminders, missed, LTFU, welcome — state-matched automatically
                  </div>
                </div>
                <button onClick={() => setBulkState({ phase: 'confirm' })} style={{
                  padding: '8px 18px', borderRadius: 8,
                  background: 'linear-gradient(135deg,#0d6e87,#005469)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 2px 10px rgba(13,110,135,.5)',
                }}>
                  <Send size={13} /> Preview & Send
                </button>
                <button onClick={clearSelection} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4 }}>
                  <X size={16} />
                </button>
              </>
            )}

            {/* SENDING */}
            {bulkState.phase === 'sending' && (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 13, color: '#fff' }}>
                    Sending… {bulkState.current} / {bulkState.total}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 1 }}>
                    {sendProgress}% complete · Rate-limited to avoid gateway blocks
                  </div>
                </div>
                <button onClick={() => { abortRef.current = true; setBulkState({ phase: 'idle' }); }} style={{
                  padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.2)',
                  background: 'rgba(255,255,255,.08)', color: '#fff', cursor: 'pointer',
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 10, fontWeight: 700,
                }}>
                  Abort
                </button>
              </>
            )}

            {/* DONE */}
            {bulkState.phase === 'done' && (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 13, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} /> {bulkState.sent} sent</span>
                    {bulkState.failed > 0 && <span style={{ color: '#f87171' }}>· {bulkState.failed} failed</span>}
                    {bulkState.skipped > 0 && <span style={{ color: 'rgba(255,255,255,.45)', fontSize: 11 }}>· {bulkState.skipped} skipped</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 1 }}>
                    Bulk send complete · {new Date().toLocaleTimeString('en-GB')}
                  </div>
                </div>
                <button onClick={resetSms} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4 }}>
                  <X size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ marginTop: showSmsPanel ? 80 : 18, fontSize: 10, color: '#6f797d', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", textAlign: 'center' }}>
        Clinic {fmt12h(CLINIC_OPEN_HOUR)}–{fmt12h(CLINIC_CLOSE_HOUR)} ·
        Missed by {fmt12h(CLINIC_CLOSE_HOUR)} → Overdue ·
        {AUTO_LTFU_DAYS}+ days overdue → Auto-LTFU ·
        Updates every 60 seconds
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
      `}</style>
    </div>
  );
}

// ── Shared style helper ────────────────────────────────────────
function quickSelectBtn(color: string): React.CSSProperties {
  return {
    padding: '4px 10px', borderRadius: 9999,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 9, fontWeight: 700,
    cursor: 'pointer', border: `1px solid ${color}22`,
    background: `${color}12`, color,
    textTransform: 'uppercase' as const, letterSpacing: '.4px',
  };
}
