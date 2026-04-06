// ════════════════════════════════════════════════════════════
// REMOTECARE · src/pages/ClinicPage.tsx
// Live clinic workload tracker
//
// STATUS RULES (computed purely from date/time — no manual input):
//   EXPECTED  → next visit date = today  AND  current time is 07:00–18:00
//   SEEN      → has a visit recorded today (att=true)
//   OVERDUE   → next visit date < today  OR  (today's patient + time >= 18:00)
//   AUTO-LTFU → overdue >= 21 days → patient.status flipped to 'ltfu' by store
//
// Page ticks every 60s so Expected→Overdue flips at 18:00 automatically.
// ════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect } from 'react';
import { Check, AlertTriangle, AlertOctagon, Trophy, ClipboardList, Calendar, Pin } from 'lucide-react';
import { usePatientStore, selectVisiblePatients } from '../store/usePatientStore';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import {
  getPatientNextVisitDate,
  bpClass,
  sgClass,
} from '../services/clinical';
import type { Patient } from '../types';

// ── Constants ─────────────────────────────────────────────────
const CLINIC_OPEN_HOUR  = 7;   // 07:00
const CLINIC_CLOSE_HOUR = 18;  // 18:00 — after this, expected→overdue
const AUTO_LTFU_DAYS    = 21;  // days overdue → auto LTFU
const DAYS_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Patient slot status ────────────────────────────────────────
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

// ── Time helpers ──────────────────────────────────────────────
function fmt12h(hour: number): string {
  const s = hour >= 12 ? 'pm' : 'am';
  return `${hour % 12 || 12}:00 ${s}`;
}

// ── Status badge config ───────────────────────────────────────
const STATUS_CFG: Record<SlotStatus, { label: string; bg: string; color: string; border: string }> = {
  seen:     { label: 'Seen',     bg: '#dcfce7', color: '#14532d', border: '#86efac' },
  expected: { label: 'Expected', bg: '#fef3c7', color: '#78350f', border: '#fcd34d' },
  overdue:  { label: 'Overdue',  bg: '#fee2e2', color: '#7f1d1d', border: '#fca5a5' },
  upcoming: { label: 'Upcoming', bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },
};

function condStyle(cond: Patient['cond']): React.CSSProperties {
  if (cond === 'DM+HTN') return { background: 'rgba(217,119,6,.12)', color: '#d97706' };
  if (cond === 'DM')     return { background: 'rgba(16,185,129,.12)', color: '#10b981' };
  return                        { background: 'rgba(220,38,38,.12)',  color: '#dc2626' };
}

// ── Progress ring ─────────────────────────────────────────────
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

// ── Stat card ─────────────────────────────────────────────────
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
            fontFamily: 'Syne, sans-serif', fontWeight: 800,
            fontSize: 11, color,
          }}>
            {Math.round(pct * 100)}%
          </div>
        </div>
      )}
      <div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontFamily: 'Karla, sans-serif', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginTop: 2 }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 10, color: '#6f797d', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Live clock hook ───────────────────────────────────────────
function useLiveClock(ms = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

// ══════════════════════════════════════════════════════════════
export default function ClinicPage() {
  const currentUser    = useAuthStore((s) => s.currentUser);
  const patients       = usePatientStore((s) => s.patients);
  const openVisitModal = useUIStore((s) => s.openVisitModal);
  const clinicSettings = useUIStore((s) => s.clinicSettings);
  const toggleClinicDay = useUIStore((s) => s.toggleClinicDay);

  // Ticks every 60s — so 18:00 transition happens automatically
  const now = useLiveClock(60_000);

  const [activeTab, setActiveTab] = useState<'today' | 'schedule'>('today');
  const [searchQ, setSearchQ] = useState('');

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
        // Was this patient attended today?
        const seenToday = (p.visits ?? []).some((v) => v.att && v.date === todayISO);

        // When is their next appointment?
        const nextDate = getPatientNextVisitDate(p, clinicSettings);
        const nextMid  = new Date(nextDate); nextMid.setHours(0, 0, 0, 0);
        const diffDays = Math.round((nextMid.getTime() - todayMid.getTime()) / 86_400_000);
        const daysOverdue = diffDays < 0 ? Math.abs(diffDays) : 0;

        // Compute status
        let slotStatus: SlotStatus;
        if (seenToday) {
          slotStatus = 'seen';
        } else if (diffDays === 0 && !afterHours) {
          slotStatus = 'expected';      // due today + clinic still open
        } else if (diffDays < 0 || (diffDays === 0 && afterHours)) {
          slotStatus = 'overdue';       // past due, or today but clinic closed
        } else {
          slotStatus = 'upcoming';
        }

        // BP / glucose
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

  // ── Today's list = expected + seen + overdue (today only) ──
  const todayRows = useMemo(() =>
    allRows.filter((r) =>
      r.slotStatus === 'expected' ||
      r.slotStatus === 'seen'     ||
      (r.slotStatus === 'overdue' && r.daysOverdue === 0)
    ), [allRows]
  );

  // ── Full schedule (searchable) ──────────────────────────────
  const scheduleRows = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    return !q ? allRows : allRows.filter(r =>
      r.patient.code.toLowerCase().includes(q) ||
      r.patient.cond.toLowerCase().includes(q)
    );
  }, [allRows, searchQ]);

  // ── Counts ─────────────────────────────────────────────────
  const countExpected = allRows.filter(r => r.slotStatus === 'expected').length;
  const countSeen     = allRows.filter(r => r.slotStatus === 'seen').length;
  const countOverdue  = allRows.filter(r => r.slotStatus === 'overdue').length;
  const totalToday    = countExpected + countSeen;
  const clinicOpen    = now.getHours() >= CLINIC_OPEN_HOUR && now.getHours() < CLINIC_CLOSE_HOUR;

  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── Row renderer ───────────────────────────────────────────
  const TABLE_HEADERS = ['Status', 'Code', 'Patient', 'Appointment', 'Days', 'Last BP', 'Glucose', 'Action'];

  function renderRow(row: ClinicRow, i: number, arr: ClinicRow[]) {
    const { patient: p, nextDate, diffDays, daysOverdue, slotStatus, seenToday, bpLabel, bpCrisis, sgLabel, sgCrisis } = row;
    const cfg = STATUS_CFG[slotStatus];

    return (
      <tr key={p.id}
        style={{
          background:
            slotStatus === 'seen'     ? 'rgba(22,163,74,.03)' :
            slotStatus === 'expected' ? 'rgba(217,119,6,.03)' :
            slotStatus === 'overdue'  ? 'rgba(220,38,38,.04)' : '#fff',
          borderBottom: i < arr.length - 1 ? '1px solid rgba(191,200,205,.18)' : 'none',
          transition: 'background .1s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(13,110,135,.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background =
          slotStatus === 'seen'     ? 'rgba(22,163,74,.03)' :
          slotStatus === 'expected' ? 'rgba(217,119,6,.03)' :
          slotStatus === 'overdue'  ? 'rgba(220,38,38,.04)' : '#fff'
        )}
      >
        {/* Status badge */}
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          <span style={{
            fontSize: 9, fontWeight: 800, fontFamily: 'Syne, sans-serif',
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
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 11,
            color: slotStatus === 'overdue' ? '#dc2626' : '#005469',
            background: slotStatus === 'overdue' ? 'rgba(220,38,38,.08)' : 'rgba(0,84,105,.08)',
            padding: '2px 8px', borderRadius: 4,
          }}>
            {p.code}
          </span>
        </td>

        {/* Patient */}
        <td style={{ padding: '10px 14px' }}>
          <div style={{ fontFamily: 'Karla, sans-serif', fontSize: 12, color: '#0f1f26', fontWeight: 600 }}>
            {p.age}y · {p.sex}
          </div>
          <span style={{
            fontSize: 9, fontWeight: 800, fontFamily: 'Syne, sans-serif',
            textTransform: 'uppercase', letterSpacing: '.4px',
            padding: '1px 6px', borderRadius: 9999,
            ...condStyle(p.cond),
          }}>
            {p.cond}
          </span>
        </td>

        {/* Appointment date */}
        <td style={{ padding: '10px 14px' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: '#0f1f26' }}>
            {nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 10, color: '#6f797d' }}>
            {p.scheduledNext ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pin size={10} /> confirmed</span> : '≈ predicted'}
          </div>
        </td>

        {/* Days label */}
        <td style={{ padding: '10px 14px' }}>
          {slotStatus === 'overdue' && daysOverdue > 0 ? (
            <span style={{
              fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 800,
              color: daysOverdue >= AUTO_LTFU_DAYS ? '#7f1d1d' : '#dc2626',
              background: daysOverdue >= AUTO_LTFU_DAYS ? 'rgba(127,29,29,.1)' : 'rgba(220,38,38,.08)',
              padding: '2px 7px', borderRadius: 4,
              display: 'inline-flex', alignItems: 'center', gap: 4
            }}>
              {daysOverdue >= AUTO_LTFU_DAYS ? <AlertOctagon size={12} /> : <AlertTriangle size={12} />} {daysOverdue}d late
            </span>
          ) : slotStatus === 'seen' ? (
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Attended</span>
          ) : slotStatus === 'expected' ? (
            <span style={{ fontSize: 10, color: '#d97706', fontWeight: 700 }}>Due today</span>
          ) : (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#0369a1', fontWeight: 700 }}>
              in {diffDays}d
            </span>
          )}
        </td>

        {/* BP */}
        <td style={{ padding: '10px 14px' }}>
          {bpLabel
            ? <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: bpCrisis ? '#dc2626' : '#16a34a' }}>{bpLabel}</span>
            : <span style={{ color: '#bfc8cd', fontSize: 11 }}>—</span>}
        </td>

        {/* Glucose */}
        <td style={{ padding: '10px 14px' }}>
          {sgLabel
            ? <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: sgCrisis ? '#dc2626' : '#16a34a' }}>{sgLabel}</span>
            : <span style={{ color: '#bfc8cd', fontSize: 11 }}>—</span>}
        </td>

        {/* Action */}
        <td style={{ padding: '10px 14px' }}>
          {seenToday ? (
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Done</span>
          ) : (
            <button
              onClick={() => openVisitModal(p.id)}
              style={{
                padding: '5px 13px',
                background: 'linear-gradient(135deg,#0d6e87 0%,#005469 100%)',
                color: '#fff', border: 'none', borderRadius: 5,
                fontFamily: 'Syne, sans-serif', fontSize: 10,
                fontWeight: 700, cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '.4px',
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

  // ── Table shell ─────────────────────────────────────────────
  function Table({ rows, empty }: { rows: ClinicRow[]; empty: string }) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,31,38,.06)', border: '1px solid rgba(191,200,205,.18)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0f1f26' }}>
                {TABLE_HEADERS.map((h) => (
                  <th key={h} style={{
                    padding: '11px 14px', textAlign: 'left',
                    fontFamily: 'Syne, sans-serif', fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '.6px',
                    color: 'rgba(255,255,255,.7)', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#6f797d', fontFamily: 'Karla, sans-serif', fontSize: 13 }}>{empty}</td></tr>
                : rows.map((r, i, arr) => renderRow(r, i, arr))
              }
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '24px 28px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Header + live clock ── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#6f797d', marginBottom: 3 }}>
            Registry › Clinic Day
          </div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 28, color: '#132b31', margin: 0 }}>
            Today's Clinic
          </h1>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{dateStr}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 28, color: '#0f1f26', lineHeight: 1 }}>
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
              fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700,
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
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: '#516169' }}>
              Workload Progress
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13, color: '#0f1f26' }}>
              {countSeen} / {totalToday} seen
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 9999, background: 'rgba(191,200,205,.25)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round((countSeen / totalToday) * 100)}%`,
              background: 'linear-gradient(90deg,#0d6e87 0%,#16a34a 100%)',
              borderRadius: 9999,
              transition: 'width .6s ease',
              minWidth: countSeen > 0 ? 4 : 0,
            }} />
          </div>
          <div style={{ fontSize: 10, color: '#6f797d', marginTop: 5, textAlign: 'right' }}>
            {Math.round((countSeen / totalToday) * 100)}% complete
            {countExpected > 0 && ` · ${countExpected} still waiting`}
            {countSeen === totalToday && totalToday > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Trophy size={12} /> All done!</span>}
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
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#6f797d', marginBottom: 8 }}>
          Clinic Days — appointments snap to nearest selected day
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[1,2,3,4,5,6,0].map((d) => {
            const on = clinicSettings.days.includes(d as any);
            const isToday = new Date().getDay() === d;
            return (
              <button key={d} onClick={() => toggleClinicDay(d as any)} style={{
                padding: '5px 14px', borderRadius: 9999,
                fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700,
                cursor: 'pointer', transition: 'all .12s',
                border: on ? '2px solid #0d6e87' : '1.5px solid rgba(191,200,205,.4)',
                background: on ? (isToday ? '#0d6e87' : 'rgba(13,110,135,.08)') : '#fff',
                color: on ? (isToday ? '#fff' : '#0d6e87') : '#516169',
                boxShadow: isToday && on ? '0 0 0 3px rgba(13,110,135,.2)' : 'none',
              }}>
                {DAYS_SHORT[d]}{isToday && <span style={{ marginLeft: 3, fontSize: 8 }}>●</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['today', 'schedule'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '7px 16px', borderRadius: 9999,
              fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.4px',
              cursor: 'pointer', border: 'none', transition: 'all .12s',
              background: activeTab === tab ? '#0f1f26' : 'rgba(191,200,205,.2)',
              color: activeTab === tab ? '#fff' : '#516169',
            }}>
              {tab === 'today' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ClipboardList size={12} /> Today ({todayRows.length})</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> All Patients ({scheduleRows.length})</span>}
            </button>
          ))}
        </div>
        {activeTab === 'schedule' && (
          <input type="text" placeholder="Search code or condition…"
            value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12,
              border: '1.5px solid rgba(191,200,205,.5)',
              fontFamily: 'Karla, sans-serif', color: '#0f1f26', outline: 'none', width: 210,
            }}
          />
        )}
      </div>

      {/* ── TODAY TAB ── */}
      {activeTab === 'today' && (
        <>
          {/* Expected */}
          {allRows.filter(r => r.slotStatus === 'expected').length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: '#d97706', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
                Waiting · {allRows.filter(r => r.slotStatus === 'expected').length} expected
              </div>
              <Table rows={allRows.filter(r => r.slotStatus === 'expected')} empty="" />
            </div>
          )}

          {/* Seen */}
          {countSeen > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: '#16a34a', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Check size={12} /> Seen today · {countSeen}
              </div>
              <Table rows={allRows.filter(r => r.slotStatus === 'seen')} empty="" />
            </div>
          )}

          {/* Overdue-today (missed = today's patients after clinic closed) */}
          {todayRows.filter(r => r.slotStatus === 'overdue').length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: '#dc2626', marginBottom: 8 }}>
                ! Missed today — clinic closed
              </div>
              <Table rows={todayRows.filter(r => r.slotStatus === 'overdue')} empty="" />
            </div>
          )}

          {/* Empty state */}
          {todayRows.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(191,200,205,.2)', padding: '48px 32px', textAlign: 'center', boxShadow: '0 1px 4px rgba(15,31,38,.06)' }}>
              <div style={{ fontSize: 36, marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Calendar size={36} color="#0d6e87" /></div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#0f1f26', marginBottom: 6 }}>
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
                fontSize: 9, fontWeight: 700, fontFamily: 'Syne, sans-serif',
                textTransform: 'uppercase', letterSpacing: '.4px',
                padding: '2px 9px', borderRadius: 9999,
                background: v.bg, color: v.color, border: `1px solid ${v.border}`,
              }}>
                {v.label} · {allRows.filter(r => r.slotStatus === k).length}
              </span>
            ))}
            {countOverdue > 0 && (
              <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: '#7f1d1d', padding: '2px 0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <AlertOctagon size={10} /> {allRows.filter(r => r.daysOverdue >= AUTO_LTFU_DAYS).length} at {AUTO_LTFU_DAYS}+ days → auto-LTFU
              </span>
            )}
          </div>
          <Table rows={scheduleRows} empty="No patients match your search" />
        </>
      )}

      {/* ── Footer ── */}
      <div style={{ marginTop: 18, fontSize: 10, color: '#6f797d', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
        Clinic {fmt12h(CLINIC_OPEN_HOUR)}–{fmt12h(CLINIC_CLOSE_HOUR)} ·
        Missed by {fmt12h(CLINIC_CLOSE_HOUR)} → Overdue ·
        {AUTO_LTFU_DAYS}+ days overdue → Auto-LTFU ·
        Updates every 60 seconds
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }`}</style>
    </div>
  );
}
