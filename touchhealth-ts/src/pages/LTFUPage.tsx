import { useMemo, useState } from 'react';
import { Calendar, AlertTriangle, Check, Smartphone, ClipboardList, Settings } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePatientStore, selectVisiblePatients, selectSelectedPatient } from '../store/usePatientStore';
import { isDue } from '../services/clinical';
import {
  daysUntilAppointment,
  sendSMS as sendSMSService,
} from '../services/sms';
import { loadSMSConfig, saveSMSConfig, loadSMSLog, saveSMSLog } from '../services/storage';
import { useUIStore } from '../store/useUIStore';
import PatientDetail from '../components/patient/PatientDetail';
import type { Patient, SMSConfig } from '../types';

// ── Design tokens ─────────────────────────────────────────────
const INK  = '#132b31';
const TEAL = '#10b981';
const BG   = '#f8fafc';

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ background: '#132b31', height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: '#fff', fontFamily: 'Karla, sans-serif', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      {right}
    </div>
  );
}

function StatusBadge({ status, days }: { status: string; days?: number }) {
  if (status === 'ltfu') return (
    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '9px', fontWeight: 700, background: '#fee2e2', color: '#7f1d1d', fontFamily: 'Karla, sans-serif', textTransform: 'uppercase' }}>LTFU</span>
  );
  if (days !== undefined && days < 0) return (
    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '9px', fontWeight: 700, background: '#fef3c7', color: '#92400e', fontFamily: 'Karla, sans-serif', textTransform: 'uppercase' }}>Overdue {Math.abs(days)}d</span>
  );
  return (
    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '9px', fontWeight: 700, background: '#fef3c7', color: '#92400e', fontFamily: 'Karla, sans-serif', textTransform: 'uppercase' }}>Due in {days}d</span>
  );
}

export default function LTFUPage() {
  const currentUser   = useAuthStore((s) => s.currentUser);
  const patients      = usePatientStore((s) => s.patients);
  const clinicSettings = useUIStore((s) => s.clinicSettings);
  const selectedPatient = usePatientStore((s) => selectSelectedPatient(s.patients, s.selectedId));
  const selectPatient = usePatientStore((s) => s.selectPatient);

  // ── Filters ───────────────────────────────────────────────
  const [filterTab, setFilterTab]     = useState<'ltfu' | 'overdue' | 'reminder' | 'all'>('ltfu');
  const [searchQuery, setSearchQuery] = useState('');
  const [lang, setLang]               = useState<'en' | 'sw'>('en');

  // ── SMS Config ────────────────────────────────────────────
  const [smsConfig, setSmsConfig] = useState<SMSConfig>(() => loadSMSConfig());
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // ── SMS Log ───────────────────────────────────────────────
  const [smsLog, setSmsLog] = useState(() => loadSMSLog());
  const [selectedLogPt, setSelectedLogPt] = useState<string | null>(null); // view individual

  // ── Sending state ─────────────────────────────────────────
  const [sending,     setSending]     = useState<Record<number, boolean>>({});
  const [massSending, setMassSending] = useState(false);
  const [massResult,  setMassResult]  = useState<string | null>(null);

  const visiblePatients = useMemo(
    () => selectVisiblePatients(patients, currentUser),
    [patients, currentUser],
  );

  // ── Computed patient lists ────────────────────────────────
  const ltfuPatients = useMemo(() =>
    visiblePatients.filter((p) => p.status === 'ltfu' && p.phone),
  [visiblePatients]);

  // Reminder = due within next 2 days (1 day before clinic)
  const reminderPatients = useMemo(() =>
    visiblePatients.filter((p) => {
      if (p.status !== 'active' || !p.phone) return false;
      const days = daysUntilAppointment(p, clinicSettings);
      return days >= 0 && days <= 2;
    }),
  [visiblePatients, clinicSettings]);

  const filteredPatients = useMemo(() => {
    let base =
      filterTab === 'ltfu'     ? visiblePatients.filter((p) => p.status === 'ltfu') :
      filterTab === 'overdue'  ? visiblePatients.filter((p) => p.status === 'active' && isDue(p)) :
      filterTab === 'reminder' ? reminderPatients :
      visiblePatients.filter((p) => p.status === 'ltfu' || isDue(p));

    const q = searchQuery.toLowerCase().trim();
    if (!q) return base;
    return base.filter((p) =>
      p.code.toLowerCase().includes(q) || (p.phone ?? '').includes(q),
    );
  }, [visiblePatients, filterTab, searchQuery, reminderPatients]);

  // ── Send single SMS ───────────────────────────────────────
  const handleSendSingle = async (patient: Patient) => {
    setSending((prev) => ({ ...prev, [patient.id]: true }));
    const entry = await sendSMSService(patient, lang, smsConfig, clinicSettings);
    const updated = [entry, ...smsLog];
    setSmsLog(updated);
    saveSMSLog(updated);
    setSending((prev) => ({ ...prev, [patient.id]: false }));
  };

  // ── Mass SMS ──────────────────────────────────────────────
  const handleMassSMS = async (list: Patient[], type: string) => {
    if (!list.length) return;
    setMassSending(true);
    setMassResult(null);
    let sent = 0;
    const newEntries = [];
    for (const p of list) {
      if (!p.phone) continue;
      const entry = await sendSMSService(p, lang, smsConfig, clinicSettings);
      newEntries.push(entry);
      sent++;
    }
    const updated = [...newEntries, ...smsLog];
    setSmsLog(updated);
    saveSMSLog(updated);
    setMassSending(false);
    setMassResult(`${sent} ${type} SMS sent (${smsConfig.apiKey ? 'live' : 'demo mode'})`);
  };

  // ── Save SMS config ───────────────────────────────────────
  const handleSaveConfig = () => {
    saveSMSConfig(smsConfig);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
    setConfigOpen(false);
  };

  const inputCls: React.CSSProperties = {
    width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px',
    padding: '8px 10px', fontSize: '12px', fontFamily: 'Karla, sans-serif',
    color: '#132b31', background: '#fff', outline: 'none',
  };

  const tabCounts = {
    ltfu:     visiblePatients.filter((p) => p.status === 'ltfu').length,
    overdue:  visiblePatients.filter((p) => p.status === 'active' && isDue(p)).length,
    reminder: reminderPatients.length,
    all:      visiblePatients.filter((p) => p.status === 'ltfu' || isDue(p)).length,
  };

  // Individual patient SMS log
  const patientLog = selectedLogPt
    ? smsLog.filter((e) => e.ptCode === selectedLogPt)
    : smsLog;

  return (
    <div style={{ background: BG, minHeight: '100vh', padding: '20px 24px' }}>

      {/* ── Page header ──────────────────────────────────── */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800, color: INK, margin: 0, marginBottom: '4px' }}>
            LTFU & Overdue Tracker
          </h2>
          <p style={{ color: '#516169', fontSize: '13px', margin: 0 }}>
            {currentUser?.adminDistrict || currentUser?.sessionDistrict || 'NCD Programme'} · SMS Outreach
          </p>
        </div>

        {/* Mass SMS actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
            {(['en', 'sw'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)}
                style={{ padding: '6px 14px', border: 'none', background: lang === l ? TEAL : 'transparent', color: lang === l ? '#fff' : '#64748b', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Karla, sans-serif', textTransform: 'uppercase' }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => handleMassSMS(reminderPatients.filter((p) => !!p.phone), 'reminder')}
            disabled={massSending || reminderPatients.length === 0}
            style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: reminderPatients.length ? '#10b981' : '#e2e8f0', color: reminderPatients.length ? '#fff' : '#64748b', fontSize: '11px', fontWeight: 700, cursor: reminderPatients.length ? 'pointer' : 'not-allowed', fontFamily: 'Karla, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            {massSending ? 'Sending…' : <><Calendar size={12} /> Remind Tomorrow ({reminderPatients.filter(p=>p.phone).length})</>}
          </button>

          <button
            onClick={() => handleMassSMS(ltfuPatients, 'LTFU')}
            disabled={massSending || ltfuPatients.length === 0}
            style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: ltfuPatients.length ? '#dc2626' : '#e2e8f0', color: ltfuPatients.length ? '#fff' : '#64748b', fontSize: '11px', fontWeight: 700, cursor: ltfuPatients.length ? 'pointer' : 'not-allowed', fontFamily: 'Karla, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            {massSending ? 'Sending…' : <><AlertTriangle size={12} /> LTFU Mass SMS ({ltfuPatients.length})</>}
          </button>

          <button
            onClick={() => setConfigOpen(!configOpen)}
            style={{ padding: '7px 14px', borderRadius: '6px', border: `1px solid ${TEAL}`, background: '#fff', color: TEAL, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Karla, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Settings size={12} /> SMS Config
          </button>
        </div>
      </div>

      {massResult && (
        <div style={{ marginBottom: '12px', padding: '10px 16px', background: '#dcfce7', border: '1.5px solid #16a34a', borderRadius: '6px', color: '#14532d', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} /> {massResult}
        </div>
      )}

      {/* ── SMS Config Panel ──────────────────────────────── */}
      {configOpen && (
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid rgba(191,200,205,.3)', marginBottom: '16px', overflow: 'hidden' }}>
          <SectionHeader title="SMS Configuration" right={
            <button onClick={() => setConfigOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: '18px' }}>×</button>
          } />
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Provider API Key', key: 'apiKey', type: 'text' },
              { label: 'API Secret', key: 'apiSecret', type: 'password' },
              { label: 'Sender ID', key: 'senderId', type: 'text' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#516169', marginBottom: '4px', fontFamily: 'Syne, sans-serif' }}>{label}</div>
                <input
                  type={type}
                  value={(smsConfig as any)[key] ?? ''}
                  onChange={(e) => setSmsConfig((prev) => ({ ...prev, [key]: e.target.value }))}
                  style={inputCls}
                />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#516169', marginBottom: '4px', fontFamily: 'Syne, sans-serif' }}>English Template</div>
              <textarea rows={2} value={smsConfig.template} onChange={(e) => setSmsConfig((prev) => ({ ...prev, template: e.target.value }))} style={{ ...inputCls, resize: 'vertical' }} placeholder="Dear {name}, your appointment is at {hospital} on {date}." />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#516169', marginBottom: '4px', fontFamily: 'Syne, sans-serif' }}>Kiswahili Template</div>
              <textarea rows={2} value={smsConfig.templateSw} onChange={(e) => setSmsConfig((prev) => ({ ...prev, templateSw: e.target.value }))} style={{ ...inputCls, resize: 'vertical' }} placeholder="Mpendwa {name}, ziara yako ni {hospital} tarehe {date}." />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button onClick={handleSaveConfig} style={{ padding: '8px 20px', borderRadius: '4px', border: 'none', background: TEAL, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
                Save Configuration
              </button>
              {configSaved && <span style={{ color: '#16a34a', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Saved</span>}
              <span style={{ fontSize: '11px', color: '#516169' }}>Supported: Africa's Talking, Twilio · No API key = demo mode</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter tabs ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {([
          { id: 'ltfu',     label: 'LTFU',           color: '#dc2626' },
          { id: 'overdue',  label: 'Overdue',         color: '#d97706' },
          { id: 'reminder', label: 'Due Tomorrow',    color: TEAL },
          { id: 'all',      label: 'All at Risk',     color: INK },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id)}
            style={{
              padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
              background: filterTab === tab.id ? tab.color : '#fff',
              color: filterTab === tab.id ? '#fff' : '#516169',
              fontSize: '12px', fontWeight: 700, fontFamily: 'Syne, sans-serif',
              transition: 'all .15s',
              boxShadow: filterTab === tab.id ? '0 2px 8px rgba(0,0,0,.15)' : 'none',
            }}
          >
            {tab.label}
            <span style={{ marginLeft: '6px', background: filterTab === tab.id ? 'rgba(255,255,255,.25)' : '#e8e8e6', color: filterTab === tab.id ? '#fff' : '#516169', borderRadius: '999px', padding: '1px 7px', fontSize: '10px' }}>
              {tabCounts[tab.id]}
            </span>
          </button>
        ))}
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search patient code or phone…"
          style={{ ...inputCls, maxWidth: '220px', marginLeft: 'auto' }}
        />
      </div>

      {/* ── Main grid ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px' }}>

        {/* LEFT — Patient list */}
        <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid rgba(191,200,205,.2)' }}>
          <SectionHeader title={`Patient List (${filteredPatients.length})`} />
          <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            {filteredPatients.map((p) => {
              const days = daysUntilAppointment(p, clinicSettings);
              const isSending = sending[p.id];
              const isSelected = selectedPatient?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => selectPatient(p.id)}
                  style={{
                    padding: '12px 14px', borderBottom: '1px solid rgba(191,200,205,.2)',
                    cursor: 'pointer', background: isSelected ? 'rgba(13,110,135,.06)' : '#fff',
                    borderLeft: isSelected ? `3px solid ${TEAL}` : '3px solid transparent',
                    transition: 'all .12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '11px', color: TEAL }}>{p.code}</span>
                    <StatusBadge status={p.status} days={days} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#516169', marginBottom: '6px' }}>
                    {p.cond} · {p.sex === 'M' ? 'Male' : 'Female'} {p.age}y
                    {p.phone ? ` · ${p.phone}` : ' · No phone'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSendSingle(p); }}
                      disabled={!p.phone || isSending}
                      style={{
                        padding: '4px 10px', borderRadius: '4px', border: 'none', fontSize: '10px',
                        fontWeight: 700, fontFamily: 'Syne, sans-serif', cursor: p.phone ? 'pointer' : 'not-allowed',
                        background: p.phone ? TEAL : '#e0e0de', color: p.phone ? '#fff' : '#516169',
                        opacity: isSending ? 0.6 : 1,
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}
                    >
                      {isSending ? 'Sending…' : <><Smartphone size={10} /> Send SMS</>}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedLogPt(selectedLogPt === p.code ? null : p.code); }}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: `1px solid rgba(191,200,205,.5)`, background: selectedLogPt === p.code ? '#f4f4f2' : '#fff', fontSize: '10px', fontWeight: 700, cursor: 'pointer', color: '#516169', fontFamily: 'Syne, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <ClipboardList size={10} /> Log
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredPatients.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#516169', fontSize: '13px' }}>
                No patients in this category
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Patient detail */}
        <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid rgba(191,200,205,.2)', minHeight: '400px' }}>
          <SectionHeader title={selectedPatient ? `Patient: ${selectedPatient.code}` : 'Patient Detail'} />
          {selectedPatient ? (
            <PatientDetail />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#516169', fontSize: '13px' }}>
              Select a patient from the list to view their record
            </div>
          )}
        </div>
      </div>

      {/* ── SMS Log ──────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid rgba(191,200,205,.2)', marginTop: '16px' }}>
        <SectionHeader
          title={selectedLogPt ? `SMS Log — ${selectedLogPt}` : `SMS Log (${smsLog.length} messages)`}
          right={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {selectedLogPt && (
                <button onClick={() => setSelectedLogPt(null)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: '4px', padding: '3px 10px', fontSize: '10px', cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
                  Show All
                </button>
              )}
              <button
                onClick={() => { const updated: typeof smsLog = []; setSmsLog(updated); saveSMSLog(updated); }}
                style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: '4px', padding: '3px 10px', fontSize: '10px', cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}
              >
                Clear Log
              </button>
            </div>
          }
        />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8e8e6' }}>
                {['Patient', 'Phone', 'Message', 'Status', 'Sent At', 'Provider'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#516169', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patientLog.map((log, idx) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f4f4f2', background: idx % 2 === 0 ? '#fff' : '#fafaf8' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => setSelectedLogPt(selectedLogPt === log.ptCode ? null : log.ptCode)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: TEAL, fontSize: '11px', padding: 0 }}
                    >
                      {log.ptCode}
                    </button>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#516169' }}>{log.phone}</td>
                  <td style={{ padding: '10px 14px', color: INK, maxWidth: '320px' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>{log.message}</div>
                    {log.note && <div style={{ fontSize: '10px', color: '#d97706', marginTop: '2px' }}>{log.note}</div>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '999px', fontSize: '9px', fontWeight: 700,
                      fontFamily: 'Syne, sans-serif', textTransform: 'uppercase',
                      background: log.status === 'sent' ? '#dcfce7' : log.status === 'demo' ? '#fef3c7' : '#fee2e2',
                      color: log.status === 'sent' ? '#14532d' : log.status === 'demo' ? '#92400e' : '#7f1d1d',
                    }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#516169', whiteSpace: 'nowrap' }}>
                    {new Date(log.sentAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '11px', color: '#516169', textTransform: 'uppercase' }}>{log.provider}</td>
                </tr>
              ))}
              {patientLog.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#516169', fontSize: '13px' }}>No SMS messages sent yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
