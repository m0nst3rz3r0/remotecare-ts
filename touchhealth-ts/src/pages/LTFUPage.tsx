// ════════════════════════════════════════════════════════════
// REMOTECARE · src/pages/LTFUPage.tsx
// LTFU & Overdue Tracker with full SMS outreach
//
// THREE SMS REASONS (mapped to three tabs + dedicated bulk buttons):
//   'reminder'           → patient is due soon (within 2 days)
//   'missed_appointment' → patient is overdue (past due date)
//   'ltfu_warning'       → patient status === 'ltfu'
//
// INDIVIDUAL SEND:
//   Each patient card has a send button that opens a single-
//   patient compose drawer showing the rendered message before
//   sending.  The reason is auto-detected but can be overridden.
//
// BULK SEND:
//   • Checkbox on every card — select patients individually
//   • "Select all" per tab group
//   • Floating panel shows count and language toggle
//   • Confirmation modal shows per-patient message previews
//   • Live progress bar + abort button during send
//   • Result banner: sent / failed / skipped
//
// SMS CONFIG:
//   Full provider + template editor covering all four reason
//   templates in both EN and SW.  Collapsible panel.
//
// LOG:
//   Full SMS log at the bottom, filterable per patient.
//   Export to CSV button.
// ════════════════════════════════════════════════════════════

import { useMemo, useState, useCallback, useRef } from 'react';
import {
  Calendar, AlertTriangle, AlertOctagon, Check,
  Smartphone, ClipboardList, Settings, Send,
  X, Download,
} from 'lucide-react';
import { useAuthStore }  from '../store/useAuthStore';
import { usePatientStore, selectVisiblePatients, selectSelectedPatient } from '../store/usePatientStore';
import { isDue } from '../services/clinical';
import { maskPhone } from '../utils/phone';
import { sendSMS as sendSMSService } from '../services/sms';
import { BulkConfirmModal, ComposeDrawer, ReasonBadge, SectionHeader, StatusBadge, daysUntilAppointment, exportSMSLogCSV } from '../components/ltfu/LtfuPageParts';
import {
  loadSMSConfig, saveSMSConfig,
  loadSMSLog, saveSMSLog,
  loadClinicSettings,
} from '../services/storage';
import { useUIStore } from '../store/useUIStore';
import PatientDetail from '../components/patient/PatientDetail';
import type { Patient, SMSConfig, SMSLogEntry, SMSReason } from '../types';

// ── Design tokens ─────────────────────────────────────────────
const INK   = '#132b31';
const TEAL  = '#10b981';
const BG    = '#f8fafc';
const BULK_RATE_MS = 220;

// ── Reason meta ───────────────────────────────────────────────
// ── Helpers ───────────────────────────────────────────────────
type FilterTab = 'ltfu' | 'overdue' | 'reminder' | 'all';
type BulkPhase = 'idle' | 'confirm' | 'sending' | 'done';

export default function LTFUPage() {
  const currentUser     = useAuthStore((s) => s.currentUser);
  const patients        = usePatientStore((s) => s.patients);
  const clinicSettings  = useUIStore((s) => s.clinicSettings);
  const selectedPatient = usePatientStore((s) => selectSelectedPatient(s.patients, s.selectedId));
  const selectPatient   = usePatientStore((s) => s.selectPatient);

  // ── Filters ───────────────────────────────────────────────
  const [filterTab, setFilterTab]   = useState<FilterTab>('ltfu');
  const [searchQuery, setSearchQuery] = useState('');
  const [lang, setLang]             = useState<'en' | 'sw'>('sw');

  // ── SMS config panel ──────────────────────────────────────
  const [smsConfig, setSmsConfig]   = useState<SMSConfig>(() => loadSMSConfig());
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configTab, setConfigTab]   = useState<'provider' | 'templates'>('provider');

  // ── SMS log ────────────────────────────────────────────────
  const [smsLog, setSmsLog]         = useState<SMSLogEntry[]>(() => loadSMSLog());
  const [logFilter, setLogFilter]   = useState<string | null>(null);

  // ── Compose drawer (single patient) ──────────────────────
  const [composePatient, setComposePatient] = useState<Patient | null>(null);

  // ── Bulk selection ────────────────────────────────────────
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [bulkPhase, setBulkPhase] = useState<BulkPhase>('idle');
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkResult, setBulkResult] = useState<{ sent: number; skipped: number; failed: number } | null>(null);
  const abortRef = useRef(false);

  const smsSenderName = currentUser?.displayName ?? currentUser?.username ?? 'Doctor';

  const visiblePatients = useMemo(
    () => selectVisiblePatients(patients, currentUser),
    [patients, currentUser],
  );

  // ── Patient groups ────────────────────────────────────────
  const ltfuPatients = useMemo(() =>
    visiblePatients.filter((p) => p.status === 'ltfu'), [visiblePatients]);

  const overduePatients = useMemo(() =>
    visiblePatients.filter((p) => p.status === 'active' && isDue(p)), [visiblePatients]);

  const reminderPatients = useMemo(() =>
    visiblePatients.filter((p) => {
      if (p.status !== 'active' || !p.phone) return false;
      const days = daysUntilAppointment(p, clinicSettings);
      return days >= 0 && days <= 2;
    }), [visiblePatients, clinicSettings]);

  const filteredPatients = useMemo(() => {
    const base: Patient[] =
      filterTab === 'ltfu'     ? ltfuPatients :
      filterTab === 'overdue'  ? overduePatients :
      filterTab === 'reminder' ? reminderPatients :
      visiblePatients.filter((p) => p.status === 'ltfu' || isDue(p));

    const q = searchQuery.toLowerCase().trim();
    if (!q) return base;
    return base.filter((p) =>
      p.code.toLowerCase().includes(q) || (p.phone ?? '').includes(q),
    );
  }, [visiblePatients, filterTab, searchQuery, ltfuPatients, overduePatients, reminderPatients]);

  // ── Log helpers ───────────────────────────────────────────
  const appendToLog = useCallback((_entries: SMSLogEntry[]) => {
    setSmsLog(loadSMSLog());
  }, []);

  // ── Bulk selection ────────────────────────────────────────
  const toggleSelect = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });
  }, []);

  const selectAll = useCallback((list: Patient[]) => {
    setSelected(new Set(list.filter(p => p.phone).map(p => p.id)));
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectedPatients = useMemo(() =>
    filteredPatients.filter(p => selected.has(p.id)), [filteredPatients, selected]);

  // ── Bulk send ─────────────────────────────────────────────
  const handleBulkConfirm = useCallback(async () => {
    const cfg       = loadSMSConfig();
    const clinicCfg = loadClinicSettings();
    const toSend    = selectedPatients.filter(p => p.phone);

    setBulkPhase('sending');
    setBulkProgress({ current: 0, total: toSend.length });
    abortRef.current = false;

    let sent = 0, failed = 0;
    const entries: SMSLogEntry[] = [];

    for (let i = 0; i < toSend.length; i++) {
      if (abortRef.current) break;
      setBulkProgress({ current: i + 1, total: toSend.length });
      try {
        const reason = getPatientSMSReason(toSend[i], clinicCfg) ?? 'reminder';
        const entry  = await sendSMSService(toSend[i], lang, cfg, clinicCfg, reason, smsSenderName);
        entries.push(entry);
        (entry.status === 'sent' || entry.status === 'demo') ? sent++ : failed++;
      } catch { failed++; }
      if (i < toSend.length - 1) await new Promise(r => setTimeout(r, BULK_RATE_MS));
    }

    appendToLog(entries);
    const skipped = selectedPatients.length - toSend.length;
    setBulkResult({ sent, failed, skipped });
    setBulkPhase('done');
    setSelected(new Set());
  }, [selectedPatients, lang, appendToLog, smsSenderName]);

  const resetBulk = useCallback(() => {
    setBulkPhase('idle'); setBulkResult(null); abortRef.current = true;
  }, []);

  // ── Single send (from compose drawer) ────────────────────
  const handleSingleSent = useCallback((entry: SMSLogEntry) => {
    appendToLog([entry]);
  }, [appendToLog]);

  // ── SMS config save ───────────────────────────────────────
  const handleSaveConfig = () => {
    saveSMSConfig(smsConfig);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  // ── CSV export ────────────────────────────────────────────
  const handleExportCSV = () => {
    const csv  = exportSMSLogCSV(logFilter ? smsLog.filter(e => e.ptCode === logFilter) : smsLog);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `sms-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const inputCls: React.CSSProperties = {
    width: '100%', border: '1px solid #cbd5e1', borderRadius: 6,
    padding: '8px 10px', fontSize: 12, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: INK, background: '#fff', outline: 'none',
  };

  const tabCounts = {
    ltfu:     ltfuPatients.length,
    overdue:  overduePatients.length,
    reminder: reminderPatients.length,
    all:      visiblePatients.filter((p) => p.status === 'ltfu' || isDue(p)).length,
  };

  const TAB_CFG = [
    { id: 'ltfu'    as FilterTab, label: 'LTFU',         color: '#dc2626', desc: 'Lost to follow-up' },
    { id: 'overdue' as FilterTab, label: 'Missed',        color: '#d97706', desc: 'Overdue patients' },
    { id: 'reminder'as FilterTab, label: 'Due Tomorrow',  color: TEAL,     desc: 'Within 2 days' },
    { id: 'all'     as FilterTab, label: 'All at Risk',   color: INK,      desc: 'LTFU + overdue' },
  ] as const;

  const displayedLog = logFilter ? smsLog.filter(e => e.ptCode === logFilter) : smsLog;
  const bulkPct      = bulkProgress.total > 0 ? Math.round((bulkProgress.current / bulkProgress.total) * 100) : 0;
  const showBulkBar  = selected.size > 0 || bulkPhase !== 'idle';

  return (
    <div style={{ background: BG, minHeight: '100vh', padding: '20px 24px' }}>

      {/* ── Modals ── */}
      {composePatient && (
        <ComposeDrawer
          patient={composePatient}
          lang={lang}
          sentBy={smsSenderName}
          onClose={() => setComposePatient(null)}
          onSent={handleSingleSent}
        />
      )}
      {bulkPhase === 'confirm' && (
        <BulkConfirmModal
          patients={selectedPatients}
          lang={lang}
          onConfirm={handleBulkConfirm}
          onCancel={() => setBulkPhase('idle')}
        />
      )}

      {/* ── Page header ── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#6f797d', marginBottom: 3 }}>
            Registry › LTFU & Outreach
          </div>
          <h2 style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 26, fontWeight: 800, color: INK, margin: 0, marginBottom: 4 }}>
            LTFU & Overdue Tracker
          </h2>
          <p style={{ color: '#516169', fontSize: 13, margin: 0 }}>
            {currentUser?.adminDistrict || currentUser?.sessionDistrict || 'NCD Programme'} · SMS Outreach
          </p>
        </div>

        {/* Top-right controls */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Language toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
            {(['sw', 'en'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: '7px 14px', border: 'none',
                background: lang === l ? TEAL : 'transparent',
                color: lang === l ? '#fff' : '#64748b',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif", textTransform: 'uppercase',
              }}>
                {l === 'sw' ? 'Swahili' : 'English'}
              </button>
            ))}
          </div>

          {/* Quick-bulk buttons */}
          <button
            onClick={() => { selectAll(reminderPatients); setBulkPhase('confirm'); }}
            disabled={reminderPatients.filter(p => p.phone).length === 0}
            style={{
              padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: reminderPatients.filter(p => p.phone).length ? '#0369a1' : '#e2e8f0',
              color: reminderPatients.filter(p => p.phone).length ? '#fff' : '#64748b',
              fontSize: 11, fontWeight: 700, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
            <Calendar size={12} /> Remind Due ({reminderPatients.filter(p => p.phone).length})
          </button>

          <button
            onClick={() => { selectAll(overduePatients); setBulkPhase('confirm'); }}
            disabled={overduePatients.filter(p => p.phone).length === 0}
            style={{
              padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: overduePatients.filter(p => p.phone).length ? '#d97706' : '#e2e8f0',
              color: overduePatients.filter(p => p.phone).length ? '#fff' : '#64748b',
              fontSize: 11, fontWeight: 700, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
            <AlertTriangle size={12} /> Missed ({overduePatients.filter(p => p.phone).length})
          </button>

          <button
            onClick={() => { selectAll(ltfuPatients); setBulkPhase('confirm'); }}
            disabled={ltfuPatients.filter(p => p.phone).length === 0}
            style={{
              padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: ltfuPatients.filter(p => p.phone).length ? '#dc2626' : '#e2e8f0',
              color: ltfuPatients.filter(p => p.phone).length ? '#fff' : '#64748b',
              fontSize: 11, fontWeight: 700, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
            <AlertOctagon size={12} /> LTFU ({ltfuPatients.filter(p => p.phone).length})
          </button>

          <button onClick={() => setConfigOpen(!configOpen)} style={{
            padding: '7px 14px', borderRadius: 6, border: `1px solid ${TEAL}`,
            background: configOpen ? TEAL : '#fff', color: configOpen ? '#fff' : TEAL,
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Settings size={12} /> SMS Config
          </button>
        </div>
      </div>

      {/* ── Bulk result banner ── */}
      {bulkResult && bulkPhase === 'done' && (
        <div style={{
          marginBottom: 12, padding: '10px 16px',
          background: '#dcfce7', border: '1.5px solid #16a34a', borderRadius: 8,
          color: '#14532d', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={14} />
            {bulkResult.sent} sent
            {bulkResult.failed > 0 && <span style={{ color: '#dc2626' }}> · {bulkResult.failed} failed</span>}
            {bulkResult.skipped > 0 && <span style={{ color: '#64748b', fontSize: 11 }}> · {bulkResult.skipped} skipped (no phone)</span>}
          </span>
          <button onClick={resetBulk} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}><X size={14} /></button>
        </div>
      )}

      {/* ── SMS Config panel ── */}
      {configOpen && (
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid rgba(191,200,205,.3)', marginBottom: 16, overflow: 'hidden' }}>
          <SectionHeader title="SMS Configuration" right={
            <button onClick={() => setConfigOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 18 }}>×</button>
          } />

          {/* Config sub-tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(191,200,205,.2)' }}>
            {(['provider', 'templates'] as const).map((t) => (
              <button key={t} onClick={() => setConfigTab(t)} style={{
                padding: '10px 20px', border: 'none', cursor: 'pointer',
                background: configTab === t ? '#fff' : '#f8fafc',
                color: configTab === t ? INK : '#64748b',
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px',
                borderBottom: configTab === t ? `2px solid ${TEAL}` : '2px solid transparent',
              }}>
                {t}
              </button>
            ))}
          </div>

          <div style={{ padding: 16 }}>
            {configTab === 'provider' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Provider selector */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#516169', marginBottom: 4, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Provider</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['at', 'bongolive', 'nexah', 'twilio', 'vonage', 'infobip', 'custom'] as const).map((p) => (
                      <button key={p} onClick={() => setSmsConfig(prev => ({ ...prev, provider: p }))} style={{
                        padding: '5px 12px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', border: `1.5px solid ${smsConfig.provider === p ? TEAL : 'rgba(191,200,205,.5)'}`,
                        background: smsConfig.provider === p ? `${TEAL}15` : '#fff',
                        color: smsConfig.provider === p ? TEAL : '#516169',
                        fontFamily: "'Inter', system-ui, -apple-system, sans-serif", textTransform: 'uppercase',
                      }}>{p}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: '#6f797d', marginTop: 6 }}>
                    Secrets (API keys) are stored server-side in Supabase — not here. Only add them via <code>supabase secrets set</code>.
                  </div>
                </div>
                {[
                  { label: 'Sender ID', key: 'senderId', type: 'text' },
                  { label: 'AT Username (Africa\'s Talking only)', key: 'atUsername', type: 'text' },
                  { label: 'Custom Endpoint (provider=custom only)', key: 'customEndpoint', type: 'text', full: true },
                ].map(({ label, key, type, full }) => (
                  <div key={key} style={full ? { gridColumn: '1 / -1' } : {}}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#516169', marginBottom: 4, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{label}</div>
                    <input type={type} value={(smsConfig as any)[key] ?? ''} onChange={(e) => setSmsConfig(prev => ({ ...prev, [key]: e.target.value }))} style={inputCls} />
                  </div>
                ))}
              </div>
            )}

            {configTab === 'templates' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Appointment Reminder (EN)', key: 'template',           reason: 'reminder' },
                  { label: 'Appointment Reminder (SW)', key: 'templateSw',         reason: 'reminder' },
                  { label: 'Missed Appointment (EN)',   key: 'templateMissed',     reason: 'missed' },
                  { label: 'Missed Appointment (SW)',   key: 'templateMissedSw',   reason: 'missed' },
                  { label: 'LTFU Warning (EN)',         key: 'templateLtfu',       reason: 'ltfu' },
                  { label: 'LTFU Warning (SW)',         key: 'templateLtfuSw',     reason: 'ltfu' },
                  { label: 'Welcome (EN)',              key: 'templateWelcome',    reason: 'welcome' },
                  { label: 'Welcome (SW)',              key: 'templateWelcomeSw',  reason: 'welcome' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#516169', marginBottom: 4, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{label}</div>
                    <textarea
                      rows={2}
                      value={(smsConfig as any)[key] ?? ''}
                      onChange={(e) => setSmsConfig(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{ ...inputCls, resize: 'vertical' }}
                      placeholder="{name}, {hospital}, {date}"
                    />
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1', fontSize: 11, color: '#516169' }}>
                  Variables: <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>{'{name}'}</code> patient code · <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>{'{hospital}'}</code> facility · <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>{'{date}'}</code> next appointment
                </div>
              </div>
            )}

            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={handleSaveConfig} style={{
                padding: '8px 20px', borderRadius: 4, border: 'none',
                background: TEAL, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              }}>
                Save Configuration
              </button>
              {configSaved && (
                <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Check size={12} /> Saved
                </span>
              )}
              <span style={{ fontSize: 11, color: '#516169' }}>Provider secrets are managed server-side in the SMS edge function.</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter tabs + search ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {TAB_CFG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setFilterTab(tab.id); clearSelection(); }}
            style={{
              padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: filterTab === tab.id ? tab.color : '#fff',
              color: filterTab === tab.id ? '#fff' : '#516169',
              fontSize: 12, fontWeight: 700, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              transition: 'all .15s',
              boxShadow: filterTab === tab.id ? '0 2px 8px rgba(0,0,0,.15)' : '0 1px 3px rgba(0,0,0,.06)',
            }}
          >
            {tab.label}
            <span style={{
              marginLeft: 6, background: filterTab === tab.id ? 'rgba(255,255,255,.25)' : '#e8e8e6',
              color: filterTab === tab.id ? '#fff' : '#516169',
              borderRadius: 999, padding: '1px 7px', fontSize: 10,
            }}>
              {tabCounts[tab.id]}
            </span>
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Select all in current list */}
          {filteredPatients.filter(p => p.phone).length > 0 && (
            <button
              onClick={() => selected.size === filteredPatients.filter(p => p.phone).length ? clearSelection() : selectAll(filteredPatients)}
              style={{
                padding: '7px 12px', borderRadius: 4, border: `1px solid rgba(191,200,205,.5)`,
                background: '#fff', color: '#516169', cursor: 'pointer',
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 10, fontWeight: 700,
              }}
            >
              {selected.size > 0 ? `${selected.size} selected` : `Select all (${filteredPatients.filter(p => p.phone).length})`}
            </button>
          )}
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code or phone…"
            style={{ ...inputCls, maxWidth: 200, width: 'auto' }}
          />
        </div>
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>

        {/* LEFT — Patient list with checkboxes */}
        <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid rgba(191,200,205,.2)' }}>
          <SectionHeader title={`Patients (${filteredPatients.length})`} />
          <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            {filteredPatients.map((p) => {
              const days        = daysUntilAppointment(p, clinicSettings);
              const isSelected  = selected.has(p.id);
              const isActive    = selectedPatient?.id === p.id;
              const hasPhone    = !!p.phone;
              const autoReason  = getPatientSMSReason(p, clinicSettings) ?? 'reminder';

              return (
                <div
                  key={p.id}
                  onClick={() => selectPatient(p.id)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid rgba(191,200,205,.2)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(13,110,135,.06)' : isActive ? 'rgba(13,110,135,.03)' : '#fff',
                    borderLeft: isActive ? `3px solid ${TEAL}` : isSelected ? '3px solid #0d6e87' : '3px solid transparent',
                    transition: 'all .12s',
                  }}
                >
                  {/* Row 1: checkbox + code + status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!hasPhone}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                      onClick={(e) => e.stopPropagation()}
                      title={!hasPhone ? 'No phone — cannot send SMS' : 'Select for bulk SMS'}
                      style={{ width: 14, height: 14, cursor: hasPhone ? 'pointer' : 'not-allowed', accentColor: '#0d6e87', flexShrink: 0, opacity: hasPhone ? 1 : 0.3 }}
                    />
                    <span style={{
                      fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
                      fontWeight: 700, fontSize: 11, color: TEAL, flex: 1,
                    }}>{p.code}</span>
                    <StatusBadge status={p.status} days={days} />
                  </div>

                  {/* Row 2: clinical info */}
                  <div style={{ fontSize: 11, color: '#516169', marginBottom: 8, paddingLeft: 22 }}>
                    {p.cond} · {p.sex === 'M' ? 'Male' : 'Female'} {p.age}y
                    {hasPhone
                      ? <span style={{ color: '#10b981' }}> · {maskPhone(p.phone!)}</span>
                      : <span style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 4 }}> · <AlertTriangle size={10} /> No phone</span>}
                  </div>

                  {/* Row 3: reason tag + action buttons */}
                  <div style={{ paddingLeft: 22, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ReasonBadge reason={autoReason} />
                    <button
                      onClick={(e) => { e.stopPropagation(); if (hasPhone) setComposePatient(p); }}
                      disabled={!hasPhone}
                      style={{
                        padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 10,
                        fontWeight: 700, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                        cursor: hasPhone ? 'pointer' : 'not-allowed',
                        background: hasPhone ? TEAL : '#e0e0de', color: hasPhone ? '#fff' : '#516169',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <Smartphone size={10} /> Send
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLogFilter(logFilter === p.code ? null : p.code); }}
                      style={{
                        padding: '4px 8px', borderRadius: 4, border: `1px solid rgba(191,200,205,.5)`,
                        background: logFilter === p.code ? '#f4f4f2' : '#fff',
                        fontSize: 10, fontWeight: 700, cursor: 'pointer', color: '#516169',
                        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <ClipboardList size={10} /> {smsLog.filter(e => e.ptCode === p.code).length} msgs
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredPatients.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#516169', fontSize: 13 }}>
                No patients in this category
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Patient detail */}
        <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid rgba(191,200,205,.2)', minHeight: 400 }}>
          <SectionHeader title={selectedPatient ? `Patient: ${selectedPatient.code}` : 'Patient Detail'} />
          {selectedPatient ? (
            <PatientDetail />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#516169', fontSize: 13 }}>
              Select a patient from the list to view their record
            </div>
          )}
        </div>
      </div>

      {/* ── SMS Log ── */}
      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid rgba(191,200,205,.2)', marginTop: 16, marginBottom: showBulkBar ? 80 : 0 }}>
        <SectionHeader
          title={logFilter ? `SMS Log — ${logFilter} (${displayedLog.length})` : `SMS Log — All (${smsLog.length})`}
          right={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {logFilter && (
                <button onClick={() => setLogFilter(null)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 10px', fontSize: 10, cursor: 'pointer', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                  Show All
                </button>
              )}
              <button onClick={handleExportCSV} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 10px', fontSize: 10, cursor: 'pointer', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Download size={10} /> CSV
              </button>
              <button onClick={() => { setSmsLog([]); saveSMSLog([]); setLogFilter(null); }} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 10px', fontSize: 10, cursor: 'pointer', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                Clear Log
              </button>
            </div>
          }
        />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8e8e6', background: '#f8fafc' }}>
                {['Patient', 'Phone', 'Type', 'Message', 'Provider', 'Status', 'Sent At'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#516169', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedLog.map((log, idx) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f4f4f2', background: idx % 2 === 0 ? '#fff' : '#fafaf8' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => setLogFilter(logFilter === log.ptCode ? null : log.ptCode)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
                      fontWeight: 700, color: TEAL, fontSize: 11, padding: 0,
                    }}>
                      {log.ptCode}
                    </button>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: 11, color: '#516169' }}>
                    {maskPhone(log.phone)}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {log.reason && <ReasonBadge reason={log.reason as SMSReason} />}
                  </td>
                  <td style={{ padding: '10px 14px', color: INK, maxWidth: 300 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{log.message}</div>
                    {log.note && <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>{log.note}</div>}
                    {log.messageId && <div style={{ fontSize: 9, color: '#6f797d', marginTop: 1 }}>ID: {log.messageId}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: '#516169', textTransform: 'uppercase' }}>{log.provider}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700,
                      fontFamily: "'Inter', system-ui, -apple-system, sans-serif", textTransform: 'uppercase',
                      background: log.status === 'sent' ? '#dcfce7' : log.status === 'demo' ? '#fef3c7' : log.status === 'failed' ? '#fee2e2' : '#f1f5f9',
                      color: log.status === 'sent' ? '#14532d' : log.status === 'demo' ? '#92400e' : log.status === 'failed' ? '#7f1d1d' : '#475569',
                    }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontSize: 11, color: '#516169', whiteSpace: 'nowrap' }}>
                    {new Date(log.sentAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {displayedLog.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#516169', fontSize: 13 }}>No SMS messages yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Floating bulk SMS panel ── */}
      {showBulkBar && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, width: 'min(580px, 95vw)',
          background: INK, borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(15,31,38,.45)',
        }}>
          {/* Progress bar */}
          {bulkPhase === 'sending' && (
            <div style={{ height: 4, background: 'rgba(255,255,255,.12)' }}>
              <div style={{ height: '100%', width: `${bulkPct}%`, background: 'linear-gradient(90deg,#0d6e87,#16a34a)', transition: 'width .3s ease' }} />
            </div>
          )}

          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Smartphone size={18} color="#10b981" style={{ flexShrink: 0 }} />

            {bulkPhase === 'idle' && (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 13, color: '#fff' }}>
                    {selected.size} patient{selected.size !== 1 ? 's' : ''} selected
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 1 }}>
                    {lang === 'sw' ? 'Swahili' : 'English'} · Message type matched per patient automatically
                  </div>
                </div>
                <button onClick={() => setBulkPhase('confirm')} style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg,#0d6e87,#005469)',
                  color: '#fff', cursor: 'pointer',
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

            {bulkPhase === 'sending' && (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 13, color: '#fff' }}>
                    Sending… {bulkProgress.current} / {bulkProgress.total}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 1 }}>
                    {bulkPct}% complete
                  </div>
                </div>
                <button onClick={() => { abortRef.current = true; setBulkPhase('idle'); }} style={{
                  padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.2)',
                  background: 'rgba(255,255,255,.08)', color: '#fff', cursor: 'pointer',
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 10, fontWeight: 700,
                }}>
                  Abort
                </button>
              </>
            )}

            {bulkPhase === 'done' && bulkResult && (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800, fontSize: 13, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} /> {bulkResult.sent} sent</span>
                    {bulkResult.failed  > 0 && <span style={{ color: '#f87171' }}>· {bulkResult.failed} failed</span>}
                    {bulkResult.skipped > 0 && <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }}>· {bulkResult.skipped} skipped</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>
                    Done · {new Date().toLocaleTimeString('en-GB')}
                  </div>
                </div>
                <button onClick={resetBulk} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4 }}>
                  <X size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


