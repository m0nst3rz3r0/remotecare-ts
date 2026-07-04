import React, { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  X,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import EnrolmentChart from '../charts/EnrolmentChart';
import BPControlChart from '../charts/BPControlChart';
import { backupStatus } from '../../services/backup';
import {
  getFacilityOverviewRows,
  getGlucoseControlSeries,
  getProgrammeOverview,
} from '../../services/analytics';
import {
  buildSMSMessage,
  getPatientNextDate,
  getPatientSMSReason,
  smsAlreadySentRecently,
} from '../../services/sms';
import type { ClinicSettings, Hospital, Patient, SMSReason } from '../../types';
import type { SMSConfig } from '../../types';

const INK = '#132b31';
const TEAL = '#10b981';
const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  borderRadius: '10px',
  border: '1px solid rgba(226,232,240,0.9)',
  boxShadow: '0 1px 6px rgba(15,31,38,.06)',
  marginBottom: '16px',
};

export function titleForAdminPage(page: string) {
  switch (page) {
    case 'overview': return 'Overview';
    case 'trends': return 'Trends';
    case 'doctors': return 'Doctors';
    case 'settings': return 'Settings';
    case 'user-management': return 'User Management';
    default: return 'Admin';
  }
}

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ background: INK, height: '36px', padding: '0 16px', display: 'flex', alignItems: 'center' }}>
      <span style={{ color: '#fff', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {title}
      </span>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
      {title && <SectionHeader title={title} />}
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

function RiskBadge({ ctrlRate }: { ctrlRate: number | null }) {
  if (ctrlRate === null) return <span style={{ color: '#64748b', fontSize: '12px' }}>-</span>;
  if (ctrlRate >= 65) return <span style={{ padding: '3px 10px', background: '#d1fae5', color: '#065f46', fontSize: '10px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, borderRadius: '999px', textTransform: 'uppercase' }}>Stable</span>;
  if (ctrlRate >= 45) return <span style={{ padding: '3px 10px', background: '#fef3c7', color: '#92400e', fontSize: '10px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, borderRadius: '999px', textTransform: 'uppercase' }}>Moderate</span>;
  return <span style={{ padding: '3px 10px', background: '#ffe4e6', color: '#9f1239', fontSize: '10px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, borderRadius: '999px', textTransform: 'uppercase' }}>High Risk</span>;
}

function StatCard({ title, value, sub, valueColor }: { title: string; value: number | string; sub?: string; valueColor: string }) {
  return (
    <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
      <div style={{ background: INK, height: '36px', padding: '0 16px', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#fff', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: '28px', fontWeight: 700, color: valueColor, lineHeight: 1 }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {sub ? <div style={{ marginTop: '5px', fontSize: '11px', color: '#64748b', fontWeight: 600, fontFamily: "'Inter', system-ui" }}>{sub}</div> : null}
      </div>
    </div>
  );
}

function GlucoseControlChart({ patients, year }: { patients: Patient[]; year: number }) {
  const labels = useMemo(() => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], []);
  const data = useMemo(() => {
    const amber = cssVar('--amber', '#f59e0b');
    const rates = getGlucoseControlSeries(patients, year);
    return {
      labels,
      datasets: [{ label: 'Glucose Control %', data: rates, borderColor: amber, fill: false, tension: 0.25, spanGaps: true, pointRadius: 3 }],
    };
  }, [labels, patients, year]);
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v: any) => `${v}%` } } },
  }), []);

  return <div style={{ width: '100%', height: '220px' }}><Line data={data as any} options={options as any} /></div>;
}

export function OverviewView({ patients, hospitals, year, scopeLabel }: { patients: Patient[]; hospitals: Hospital[]; year: number; scopeLabel: string }) {
  const stats = useMemo(() => getProgrammeOverview(patients), [patients]);
  const facilityRows = useMemo(() => getFacilityOverviewRows(hospitals, patients), [hospitals, patients]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '22px', fontWeight: 800, color: INK, marginBottom: '4px' }}>Admin Overview</h2>
          <p style={{ fontSize: '13px', color: '#516169' }}>Regional clinical performance · <strong>{scopeLabel}</strong></p>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', color: '#065f46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={16} /> {patients.length} patients in scope
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <StatCard title="Total Enrollment" value={stats.total} valueColor={TEAL} sub={`${stats.active} active patients`} />
        <StatCard title="Active Status" value={stats.active} valueColor={TEAL} sub={`${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}% of total`} />
        <StatCard title="LTFU (3+ Months)" value={stats.ltfu} valueColor="#ba1a1a" sub={`${stats.total ? Math.round((stats.ltfu / stats.total) * 100) : 0}% rate`} />
        <StatCard title="Due This Month" value={stats.due} valueColor="#d97706" sub="Appointments pending" />
        <StatCard title="Controlled BP" value={stats.controlled} valueColor="#16a34a" sub={`${stats.ctrlRate}% control rate`} />
      </div>

      {(() => {
        const status = backupStatus();
        return (
          <div style={{ borderRadius: 10, background: status.isDue ? '#fef3c7' : '#f0fdf4', border: `1px solid ${status.isDue ? '#fde68a' : '#86efac'}`, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            {status.isDue ? <AlertTriangle size={24} color="#b45309" /> : <CheckCircle2 size={24} color="#15803d" />}
            <div>
              <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, fontSize: 12, color: status.isDue ? '#78350f' : '#14532d' }}>
                {status.isDue ? 'Backup Overdue' : 'Data Protected'}
              </div>
              <div style={{ fontSize: 11, color: '#516169' }}>
                Last backup: {status.lastBackupAt ? new Date(status.lastBackupAt).toLocaleDateString('en-GB') : 'Never'}
                {status.daysSinceBackup !== null ? ` (${status.daysSinceBackup} days ago)` : ''}
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Card title="Enrollment Velocity"><EnrolmentChart patients={patients} year={year} /></Card>
        <Card title="BP Control Trend (%)"><BPControlChart patients={patients} year={year} /></Card>
      </div>

      <Card title="Glucose Control %"><GlucoseControlChart patients={patients} year={year} /></Card>

      <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
        <div style={{ background: INK, height: '36px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Regional Facility Matrix</span>
          <span style={{ color: TEAL, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{scopeLabel}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                {['Facility Name', 'Total Patients', 'Active %', 'Control Rate', 'Risk Status', 'LTFU'].map((heading) => (
                  <th key={heading} style={{ padding: '12px 24px', textAlign: 'left', fontSize: '10px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', whiteSpace: 'nowrap' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facilityRows.map((row, index) => (
                <tr key={row.hospital.id} style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 700, fontSize: '14px', color: '#132b31' }}>{row.hospital.name}</td>
                  <td style={{ padding: '16px 24px', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: '14px', color: '#64748b' }}>{row.total.toLocaleString()}</td>
                  <td style={{ padding: '16px 24px', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{row.total ? `${row.activePct}%` : '-'}</td>
                  <td style={{ padding: '16px 24px', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: '14px', fontWeight: 700, color: row.ctrlRate !== null && row.ctrlRate >= 65 ? '#059669' : row.ctrlRate !== null && row.ctrlRate >= 45 ? '#d97706' : '#dc2626' }}>{row.ctrlRate !== null ? `${row.ctrlRate}%` : '-'}</td>
                  <td style={{ padding: '16px 24px' }}><RiskBadge ctrlRate={row.ctrlRate} /></td>
                  <td style={{ padding: '16px 24px', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: '14px', fontWeight: 700, color: row.ltfu > 0 ? '#dc2626' : '#64748b' }}>{row.ltfu}</td>
                </tr>
              ))}
              {!facilityRows.length ? <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>No facilities configured. Add hospitals in Settings.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminBulkConfirmModal({
  patients,
  lang,
  smsConfig,
  clinicSettings,
  smsReason,
  onConfirm,
  onCancel,
}: {
  patients: Patient[];
  lang: 'en' | 'sw';
  smsConfig: SMSConfig;
  clinicSettings: ClinicSettings;
  smsReason: Record<number, SMSReason>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const previews = useMemo(() => patients.map((patient) => {
    const reason = smsReason[patient.id] ?? getPatientSMSReason(patient, clinicSettings) ?? 'reminder';
    return {
      patient,
      reason,
      message: buildSMSMessage(patient, smsConfig, lang, getPatientNextDate(patient, clinicSettings), reason),
      hasPhone: !!patient.phone,
      recentlySent: smsAlreadySentRecently(patient.id, 3),
    };
  }), [patients, lang, smsConfig, clinicSettings, smsReason]);

  const sendable = previews.filter((preview) => preview.hasPhone && !preview.recentlySent).length;
  const skippedRecent = previews.filter((preview) => preview.hasPhone && preview.recentlySent).length;
  const noPhone = previews.filter((preview) => !preview.hasPhone).length;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/55 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-xl w-full max-w-xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="bg-slate-800 px-5 py-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-white text-[15px]">Confirm bulk SMS</div>
            <div className="text-[11px] text-white/50 mt-1">
              {sendable} to send · {lang === 'sw' ? 'Swahili' : 'English'}
              {skippedRecent > 0 ? ` · ${skippedRecent} skipped (sent recently)` : ''}
            </div>
          </div>
          <button type="button" onClick={onCancel} className="text-white/50 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {noPhone > 0 ? (
            <div className="px-5 py-2 bg-red-50 border-b border-red-100 text-[11px] text-red-800 flex items-center gap-2">
              <AlertTriangle size={12} />
              {noPhone} patient{noPhone > 1 ? 's' : ''} without phone will be skipped.
            </div>
          ) : null}
          {previews.map(({ patient, reason, message, hasPhone, recentlySent }) => (
            <div key={patient.id} className={`border-b border-slate-100 last:border-0 ${hasPhone && !recentlySent ? '' : 'opacity-50'}`}>
              <button
                type="button"
                onClick={() => setExpanded(expanded === patient.id ? null : patient.id)}
                className={`w-full px-5 py-2.5 flex items-center justify-between text-left ${expanded === patient.id ? 'bg-teal-50' : ''}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">{patient.code}</span>
                  <span className="text-[10px] text-slate-500">{reason.replace(/_/g, ' ')}</span>
                  {!hasPhone ? <span className="text-[9px] font-bold text-red-600">NO PHONE</span> : null}
                  {recentlySent ? <span className="text-[9px] font-bold text-amber-600">SENT RECENTLY</span> : null}
                </div>
                {expanded === patient.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {expanded === patient.id ? (
                <div className="px-5 pb-3 bg-teal-50/40">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Preview</div>
                  <div className="text-[11px] italic text-slate-700 bg-white border border-slate-200 rounded-lg p-3">{message}</div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-[12px] font-bold">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={sendable === 0} className="px-4 py-2 rounded-lg bg-teal-700 text-white text-[12px] font-bold disabled:opacity-50 flex items-center gap-2">
            <Send size={13} />
            Send to {sendable} patient{sendable !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
