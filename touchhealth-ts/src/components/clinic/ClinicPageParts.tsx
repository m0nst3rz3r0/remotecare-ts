import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Send, X } from 'lucide-react';
import {
  buildSMSPreview,
} from '../../services/sms';
import { loadClinicSettings, loadSMSConfig } from '../../services/storage';
import type { Patient } from '../../types';

export type SlotStatus = 'seen' | 'expected' | 'overdue' | 'upcoming';
export type BulkSendState =
  | { phase: 'idle' }
  | { phase: 'confirm' }
  | { phase: 'sending'; current: number; total: number }
  | { phase: 'done'; sent: number; skipped: number; failed: number };

export interface ClinicRow {
  patient: Patient;
  nextDate: Date;
  diffDays: number;
  daysOverdue: number;
  slotStatus: SlotStatus;
  seenToday: boolean;
  bpLabel: string | null;
  bpCrisis: boolean;
  sgLabel: string | null;
  sgCrisis: boolean;
}

export const STATUS_CFG: Record<SlotStatus, { label: string; bg: string; color: string; border: string }> = {
  seen: { label: 'Seen', bg: '#dcfce7', color: '#14532d', border: '#86efac' },
  expected: { label: 'Expected', bg: '#fef3c7', color: '#78350f', border: '#fcd34d' },
  overdue: { label: 'Overdue', bg: '#fee2e2', color: '#7f1d1d', border: '#fca5a5' },
  upcoming: { label: 'Upcoming', bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },
};

export function condStyle(cond: Patient['cond']): React.CSSProperties {
  if (cond === 'DM') return { background: '#dbeafe', color: '#1d4ed8' };
  if (cond === 'DM+HTN') return { background: '#fef3c7', color: '#92400e' };
  return { background: '#fee2e2', color: '#b91c1c' };
}

export function fmt12h(hour: number): string {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  const displayHour = normalizedHour % 12 || 12;
  return `${displayHour}:00 ${suffix}`;
}

function ProgressRing({ pct, size = 56, stroke = 5, color = '#16a34a' }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const d = c * (1 - Math.min(pct, 1));
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={d} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
    </svg>
  );
}

export function ClinicStatCard({ label, value, sub, color, ring, total }: {
  label: string; value: number; sub?: string; color: string; ring?: boolean; total?: number;
}) {
  const pct = ring && total ? value / total : 0;
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(191,200,205,.3)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(15,31,38,.06)', flex: 1, minWidth: 120 }}>
      {ring && total !== undefined ? (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <ProgressRing pct={pct} color={color} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 11, color }}>
            {Math.round(pct * 100)}%
          </div>
        </div>
      ) : null}
      <div>
        <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 26, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginTop: 2 }}>{label}</div>
        {sub ? <div style={{ fontSize: 10, color: '#6f797d', marginTop: 1 }}>{sub}</div> : null}
      </div>
    </div>
  );
}

export function useLiveClock(ms = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

export function ClinicConfirmModal({
  rows,
  lang,
  onConfirm,
  onCancel,
}: {
  rows: ClinicRow[];
  lang: 'en' | 'sw';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cfg = loadSMSConfig();
  const clinicCfg = loadClinicSettings();
  const [expanded, setExpanded] = useState<number | null>(null);

  const previews = useMemo(() => rows.map((row) => {
    const preview = buildSMSPreview(row.patient, cfg, clinicCfg, lang);
    return {
      row,
      reason: preview?.reason ?? 'reminder',
      message: preview?.message ?? '',
      hasPhone: preview?.hasPhone ?? false,
    };
  }), [rows, lang, cfg, clinicCfg]);

  const withPhone = previews.filter((preview) => preview.hasPhone).length;
  const noPhone = previews.length - withPhone;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,31,38,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 560, maxWidth: '95vw', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,31,38,.25)' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(191,200,205,.25)', background: '#0f1f26' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 15, color: '#fff' }}>Confirm Bulk SMS</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>{withPhone} of {previews.length} patients have phone numbers · Language: {lang === 'sw' ? 'Swahili' : 'English'}</div>
            </div>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.6)', padding: 4 }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {noPhone > 0 ? <div style={{ padding: '8px 22px', background: 'rgba(220,38,38,.06)', borderBottom: '1px solid rgba(220,38,38,.12)', fontSize: 11, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={12} />{noPhone} patient{noPhone > 1 ? 's' : ''} without a phone number will be skipped.</div> : null}

          {previews.map(({ row, reason, message, hasPhone }, index) => (
            <div key={row.patient.id} style={{ borderBottom: index < previews.length - 1 ? '1px solid rgba(191,200,205,.15)' : 'none', opacity: hasPhone ? 1 : 0.45 }}>
              <div onClick={() => setExpanded(expanded === row.patient.id ? null : row.patient.id)} style={{ padding: '10px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: expanded === row.patient.id ? 'rgba(13,110,135,.04)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontWeight: 700, fontSize: 11, color: '#005469', background: 'rgba(0,84,105,.08)', padding: '2px 7px', borderRadius: 4 }}>{row.patient.code}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', background: STATUS_CFG[row.slotStatus].bg, color: STATUS_CFG[row.slotStatus].color, border: `1px solid ${STATUS_CFG[row.slotStatus].border}`, padding: '2px 7px', borderRadius: 9999 }}>{STATUS_CFG[row.slotStatus].label}</span>
                  <span style={{ fontSize: 9, color: '#6f797d', textTransform: 'uppercase', letterSpacing: '.3px' }}>{reason.replace('_', ' ')}</span>
                  {!hasPhone ? <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>NO PHONE</span> : null}
                </div>
                {expanded === row.patient.id ? <ChevronUp size={14} color="#6f797d" /> : <ChevronDown size={14} color="#6f797d" />}
              </div>
              {expanded === row.patient.id ? (
                <div style={{ padding: '10px 22px 12px 44px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, color: '#374151', background: 'rgba(13,110,135,.03)', borderTop: '1px solid rgba(191,200,205,.1)' }}>
                  <div style={{ marginBottom: 4, fontWeight: 600, color: '#516169', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px' }}>Message preview</div>
                  <div style={{ background: '#fff', border: '1px solid rgba(191,200,205,.35)', borderRadius: 8, padding: '10px 14px', fontStyle: 'italic', lineHeight: 1.55, color: '#0f1f26' }}>{message}</div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(191,200,205,.25)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#f8fafc' }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: 6, border: '1.5px solid rgba(191,200,205,.5)', background: '#fff', color: '#516169', cursor: 'pointer', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, fontWeight: 700 }}>Cancel</button>
          <button onClick={onConfirm} disabled={withPhone === 0} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: withPhone === 0 ? '#bfc8cd' : 'linear-gradient(135deg,#0d6e87 0%,#005469 100%)', color: '#fff', cursor: withPhone === 0 ? 'not-allowed' : 'pointer', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7, boxShadow: withPhone > 0 ? '0 2px 8px rgba(13,110,135,.35)' : 'none' }}>
            <Send size={13} />Send to {withPhone} patient{withPhone !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
