import { useMemo, useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  AlertOctagon,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react';
import { buildSMSPreview, daysUntilAppointment, sendSMS as sendSMSService, exportSMSLogCSV } from '../../services/sms';
import { loadSMSConfig, loadClinicSettings } from '../../services/storage';
import type { Patient, SMSLogEntry, SMSReason } from '../../types';

const INK = '#132b31';
const BG = '#f8fafc';

const REASON_META: Record<SMSReason, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  reminder: { label: 'Appointment Reminder', color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc', icon: <Calendar size={12} /> },
  missed_appointment: { label: 'Missed Appointment', color: '#92400e', bg: '#fef3c7', border: '#fcd34d', icon: <AlertTriangle size={12} /> },
  ltfu_warning: { label: 'LTFU Warning', color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5', icon: <AlertOctagon size={12} /> },
  welcome: { label: 'Welcome', color: '#14532d', bg: '#dcfce7', border: '#86efac', icon: <Check size={12} /> },
};

export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ background: INK, height: 40, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: '#fff', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      {right}
    </div>
  );
}

export function ReasonBadge({ reason }: { reason: SMSReason }) {
  const meta = REASON_META[reason];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", textTransform: 'uppercase', background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {meta.icon} {meta.label}
    </span>
  );
}

export function StatusBadge({ status, days }: { status: string; days?: number }) {
  if (status === 'ltfu') return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700, background: '#fee2e2', color: '#7f1d1d', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", textTransform: 'uppercase' }}>LTFU</span>;
  if (days !== undefined && days < 0) return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700, background: '#fef3c7', color: '#92400e', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", textTransform: 'uppercase' }}>Overdue {Math.abs(days)}d</span>;
  return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700, background: '#fef3c7', color: '#92400e', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", textTransform: 'uppercase' }}>Due in {days}d</span>;
}

export function ComposeDrawer({
  patient,
  lang,
  sentBy,
  onClose,
  onSent,
}: {
  patient: Patient;
  lang: 'en' | 'sw';
  sentBy: string;
  onClose: () => void;
  onSent: (entry: SMSLogEntry) => void;
}) {
  const cfg = loadSMSConfig();
  const clinicCfg = loadClinicSettings();
  const autoReason = buildSMSPreview(patient, cfg, clinicCfg, lang)?.reason ?? 'reminder';
  const [reason, setReason] = useState<SMSReason>(autoReason);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [result, setResult] = useState<SMSLogEntry | null>(null);

  const message = buildSMSPreview(patient, cfg, clinicCfg, lang, reason)?.message ?? '';

  const handleSend = async () => {
    setSending(true);
    const entry = await sendSMSService(patient, lang, cfg, clinicCfg, reason, sentBy);
    setResult(entry);
    setSent(true);
    setSending(false);
    onSent(entry);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,31,38,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 480, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(15,31,38,.25)', overflow: 'hidden' }}>
        <div style={{ background: INK, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 14, color: '#fff' }}>Send SMS</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>Patient {patient.code} · {patient.cond} · {patient.age}y {patient.sex}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#516169', marginBottom: 8, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Message type</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['reminder', 'missed_appointment', 'ltfu_warning'] as SMSReason[]).map((item) => {
                const meta = REASON_META[item];
                return (
                  <button key={item} onClick={() => setReason(item)} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 10, fontWeight: 700, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", cursor: 'pointer', border: `1.5px solid ${reason === item ? meta.color : 'rgba(191,200,205,.4)'}`, background: reason === item ? meta.bg : '#fff', color: reason === item ? meta.color : '#516169', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {meta.icon} {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#516169', marginBottom: 6, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Message preview · {lang === 'sw' ? 'Swahili' : 'English'}</div>
            <div style={{ background: '#f8fafc', border: '1px solid rgba(191,200,205,.4)', borderRadius: 8, padding: '12px 14px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 12, color: INK, lineHeight: 1.6, fontStyle: 'italic' }}>{message}</div>
            <div style={{ fontSize: 10, color: '#6f797d', marginTop: 4 }}>{message.length} chars · To: {patient.phone ? `****${patient.phone.slice(-3)}` : 'No phone on record'}</div>
          </div>

          {result ? (
            <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: result.status === 'sent' || result.status === 'demo' ? '#dcfce7' : '#fee2e2', border: `1px solid ${result.status === 'sent' || result.status === 'demo' ? '#86efac' : '#fca5a5'}`, color: result.status === 'sent' || result.status === 'demo' ? '#14532d' : '#7f1d1d', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              {result.status === 'sent' || result.status === 'demo'
                ? <><Check size={14} /> {result.status === 'demo' ? 'Demo mode — message logged (no real SMS sent)' : 'Sent successfully'}{result.messageId ? ` · ID: ${result.messageId}` : ''}</>
                : <><X size={14} /> Failed: {result.note}</>}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 6, border: '1.5px solid rgba(191,200,205,.5)', background: '#fff', color: '#516169', cursor: 'pointer', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, fontWeight: 700 }}>{sent ? 'Close' : 'Cancel'}</button>
            {!sent ? <button onClick={handleSend} disabled={!patient.phone || sending} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: !patient.phone ? '#bfc8cd' : 'linear-gradient(135deg,#0d6e87,#005469)', color: '#fff', cursor: !patient.phone ? 'not-allowed' : 'pointer', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7, opacity: sending ? 0.7 : 1 }}><Send size={13} /> {sending ? 'Sending...' : 'Send Now'}</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BulkConfirmModal({
  patients,
  lang,
  onConfirm,
  onCancel,
}: {
  patients: Patient[];
  lang: 'en' | 'sw';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cfg = loadSMSConfig();
  const clinicCfg = loadClinicSettings();
  const [expanded, setExpanded] = useState<number | null>(null);
  const previews = useMemo(() => patients.map((patient) => {
    const preview = buildSMSPreview(patient, cfg, clinicCfg, lang);
    return {
      patient,
      reason: preview?.reason ?? 'reminder',
      message: preview?.message ?? '',
      hasPhone: preview?.hasPhone ?? false,
    };
  }), [patients, lang, cfg, clinicCfg]);

  const withPhone = previews.filter((preview) => preview.hasPhone).length;
  const noPhone = previews.length - withPhone;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,31,38,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 580, maxWidth: '95vw', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,31,38,.25)' }}>
        <div style={{ background: INK, padding: '18px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 15, color: '#fff' }}>Confirm Bulk SMS</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>{withPhone} of {previews.length} have phone numbers · {lang === 'sw' ? 'Swahili' : 'English'}</div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {noPhone > 0 ? <div style={{ padding: '8px 22px', background: 'rgba(220,38,38,.06)', borderBottom: '1px solid rgba(220,38,38,.12)', fontSize: 11, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={12} /> {noPhone} patient{noPhone > 1 ? 's' : ''} without phone will be skipped.</div> : null}
          {previews.map(({ patient, reason, message, hasPhone }, index) => (
            <div key={patient.id} style={{ borderBottom: index < previews.length - 1 ? '1px solid rgba(191,200,205,.15)' : 'none', opacity: hasPhone ? 1 : 0.4 }}>
              <div onClick={() => setExpanded(expanded === patient.id ? null : patient.id)} style={{ padding: '10px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: expanded === patient.id ? 'rgba(13,110,135,.04)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontWeight: 700, fontSize: 11, color: '#005469', background: 'rgba(0,84,105,.08)', padding: '2px 7px', borderRadius: 4 }}>{patient.code}</span>
                  <ReasonBadge reason={reason} />
                  {!hasPhone ? <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>NO PHONE</span> : null}
                </div>
                {expanded === patient.id ? <ChevronUp size={14} color="#6f797d" /> : <ChevronDown size={14} color="#6f797d" />}
              </div>
              {expanded === patient.id ? <div style={{ padding: '10px 22px 12px 44px', background: 'rgba(13,110,135,.03)', borderTop: '1px solid rgba(191,200,205,.1)' }}><div style={{ fontSize: 10, fontWeight: 600, color: '#516169', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Message preview</div><div style={{ background: '#fff', border: '1px solid rgba(191,200,205,.35)', borderRadius: 8, padding: '10px 14px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, fontStyle: 'italic', lineHeight: 1.55, color: INK }}>{message}</div></div> : null}
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(191,200,205,.25)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: BG }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: 6, border: '1.5px solid rgba(191,200,205,.5)', background: '#fff', color: '#516169', cursor: 'pointer', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, fontWeight: 700 }}>Cancel</button>
          <button onClick={onConfirm} disabled={withPhone === 0} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: withPhone === 0 ? '#bfc8cd' : 'linear-gradient(135deg,#0d6e87,#005469)', color: '#fff', cursor: withPhone === 0 ? 'not-allowed' : 'pointer', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7, boxShadow: withPhone > 0 ? '0 2px 8px rgba(13,110,135,.35)' : 'none' }}>
            <Send size={13} /> Send to {withPhone} patient{withPhone !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export { exportSMSLogCSV, daysUntilAppointment };
