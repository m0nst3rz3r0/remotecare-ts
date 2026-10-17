import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Smartphone, Send, RefreshCw } from 'lucide-react';
import type { Hospital, Patient, SMSConfig, SMSReason, ClinicSettings } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { usePatientStore } from '../../store/usePatientStore';
import { loadSMSConfig, saveSMSConfig, loadSMSLog, syncPatientsWithCloud } from '../../services/storage';
import { maskPhone } from '../../utils/phone';
import {
  buildSMSPreview, filterPatientsForSmsTab, getLastSmsForPatient, formatSmsSentLabel,
  smsAlreadySentRecently, sendSMS, sendSMSBatch, smsOutcomeLabel,
  refreshSMSHistory, refreshSMSStatus, getSyncedPatientIds, getSMS8Sender,
  type SmsPatientTab, type SmsBatchResult,
} from '../../services/sms';

const providers: Array<[SMSConfig['provider'], string]> = [
  ['sms8', 'SMS8 ? Android phone / SIM'], ['at', "Africa's Talking"], ['bongolive', 'Bongolive'],
  ['nexah', 'Nexah'], ['twilio', 'Twilio'], ['vonage', 'Vonage'], ['infobip', 'Infobip'], ['custom', 'Custom'],
];
const templates = [
  { label: 'Reminder', en: 'template', sw: 'templateSw' },
  { label: 'Missed visit', en: 'templateMissed', sw: 'templateMissedSw' },
  { label: 'LTFU warning', en: 'templateLtfu', sw: 'templateLtfuSw' },
  { label: 'Welcome', en: 'templateWelcome', sw: 'templateWelcomeSw' },
] as const;
const button = 'px-3 py-1.5 rounded bg-teal-700 text-white text-[12px] font-bold hover:bg-teal-800 disabled:opacity-50';
const input = 'border border-slate-300 rounded px-3 py-1.5 text-[12px] bg-white';

export default function AdminSmsPanel({ hospitals, patients, clinicSettings }: { hospitals: Hospital[]; patients: Patient[]; clinicSettings: ClinicSettings }) {
  const user = useAuthStore((s) => s.currentUser);
  const reloadPatients = usePatientStore((s) => s.loadFromStorage);
  const [config, setConfig] = useState(loadSMSConfig);
  const [log, setLog] = useState(loadSMSLog);
  const [lang, setLang] = useState<'en' | 'sw'>('en');
  const [tab, setTab] = useState<SmsPatientTab>('reminder');
  const [hospitalId, setHospitalId] = useState('');
  const [templateTab, setTemplateTab] = useState(0);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reasons, setReasons] = useState<Record<number, SMSReason>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<Record<number, boolean>>({});
  const [syncedIds, setSyncedIds] = useState<Set<number>>(new Set());
  const [gateway, setGateway] = useState({ senderNumber: '', configured: false });
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [bulkResult, setBulkResult] = useState<SmsBatchResult | null>(null);
  const cancelBulk = useRef(false);
  const hospital = hospitals.find((h) => h.id === hospitalId);
  const filtered = useMemo(() => hospital ? filterPatientsForSmsTab(patients, tab, clinicSettings, hospital.name)
    .filter((p) => p.region === hospital.region && p.district === hospital.district) : [], [patients, tab, clinicSettings, hospital]);
  const selectable = filtered.filter((p) => syncedIds.has(p.id) && p.phone);
  const chosen = filtered.filter((p) => selected.has(p.id));

  const refreshShared = useCallback(async () => {
    setRefreshing(true); setError('');
    try {
      const [history, ids, sender] = await Promise.all([refreshSMSHistory(), getSyncedPatientIds(), getSMS8Sender()]);
      setLog(history); setSyncedIds(ids); setGateway(sender);
    } catch (e) { setError(e instanceof Error ? e.message : 'Connect and sign in online to send SMS.'); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { void refreshShared(); }, [refreshShared]);
  useEffect(() => { setSelected(new Set()); setBulkResult(null); }, [hospitalId, tab]);

  async function syncFirst() {
    setRefreshing(true); setError('');
    try {
      const result = await syncPatientsWithCloud();
      if (!result.success) throw new Error(result.error ?? 'Sync failed.');
      reloadPatients();
      await refreshShared();
    } catch (e) { setError(e instanceof Error ? e.message : 'Sync failed; local work is saved.'); }
    finally { setRefreshing(false); }
  }

  async function sendOne(patient: Patient) {
    const preview = buildSMSPreview(patient, config, clinicSettings, lang, reasons[patient.id])
      ?? buildSMSPreview(patient, config, clinicSettings, lang, 'reminder');
    if (!preview) return;
    const recent = smsAlreadySentRecently(patient.id, 3);
    const last = getLastSmsForPatient(log, patient.id);
    // Queued/uncertain submissions cannot be overridden; refresh status instead.
    if (last && ['queued','unknown'].includes(last.status)) {
      setFeedback((f) => ({ ...f, [patient.id]: 'A request is queued or uncertain. Refresh its status before resending.' })); return;
    }
    if (!window.confirm((recent ? 'A message was already sent recently. Send another anyway?\n\n' : 'Send this SMS?\n\n') + preview.message)) return;
    setSending((s) => ({ ...s, [patient.id]: true }));
    try {
      const entry = await sendSMS(patient, lang, config, clinicSettings, reasons[patient.id] ?? preview.reason, user?.displayName, { resendOverride: recent });
      setLog(loadSMSLog()); setFeedback((f) => ({ ...f, [patient.id]: smsOutcomeLabel(entry) }));
    } catch (e) { setFeedback((f) => ({ ...f, [patient.id]: e instanceof Error ? e.message : 'Send failed.' })); }
    finally { setSending((s) => ({ ...s, [patient.id]: false })); }
  }

  async function sendSelected() {
    const candidates = chosen.map((patient) => ({ patient, reason: reasons[patient.id] ?? buildSMSPreview(patient, config, clinicSettings, lang)?.reason ?? 'reminder' as SMSReason }));
    const previews = candidates.map(({ patient, reason }) => patient.code + ': ' + buildSMSPreview(patient, config, clinicSettings, lang, reason)?.message).join('\n\n');
    if (!window.confirm('Submit ' + candidates.length + ' SMS requests? Recent requests will be skipped.\n\n' + previews)) return;
    cancelBulk.current = false; setBulkBusy(true); setBulkResult(null);
    try {
      const result = await sendSMSBatch(candidates, lang, config, clinicSettings, user?.displayName, {
        isCancelled: () => cancelBulk.current,
        onProgress: (current, total) => setProgress({ current, total }),
        onEntry: (entry) => { setLog(loadSMSLog()); setFeedback((f) => ({ ...f, [entry.ptId]: smsOutcomeLabel(entry) })); },
      });
      setBulkResult(result); setSelected(new Set());
    } catch (e) { setError(e instanceof Error ? e.message : 'Bulk sending interrupted.'); }
    finally { setBulkBusy(false); }
  }

  async function refreshDelivery(id: string, patientId: number) {
    setSending((s) => ({ ...s, [patientId]: true }));
    try { const entry = await refreshSMSStatus(id); setLog(loadSMSLog()); setFeedback((f) => ({ ...f, [patientId]: smsOutcomeLabel(entry) })); }
    catch (e) { setFeedback((f) => ({ ...f, [patientId]: e instanceof Error ? e.message : 'Refresh failed.' })); }
    finally { setSending((s) => ({ ...s, [patientId]: false })); }
  }
  const template = templates[templateTab];
  const disabled = bulkBusy || refreshing || (config.provider === 'sms8' && !gateway.configured);
  return <>
    <section className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><Smartphone size={16} /> SMS Configuration</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="text-[12px]">SMS provider<select className={input + ' block w-full mt-1'} value={config.provider} onChange={(e) => setConfig((c) => ({ ...c, provider: e.target.value as SMSConfig['provider'] }))}>{providers.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        {config.provider === 'sms8' ? <div className="text-[12px] text-slate-600">Sender phone number: <strong>{gateway.senderNumber || 'Not configured yet'}</strong><p className="mt-1">Patients see the SIM number. Each message includes the facility name.</p>{!gateway.configured && <p className="text-amber-700">Pair and configure the SMS8 Android phone before sending.</p>}</div>
          : <label className="text-[12px]">Sender ID<input className={input + ' block w-full mt-1'} value={config.senderId} onChange={(e) => setConfig((c) => ({ ...c, senderId: e.target.value }))} /><span className="text-amber-700">This provider requires its own deployed server adapter.</span></label>}
      </div>
      <p className="text-[11px] text-slate-500 mb-3">Provider secrets are managed on the server. Templates support {'{name}'} (patient code), {'{hospital}'} and {'{date}'}.</p>
      <div className="flex gap-2 flex-wrap mb-3">{templates.map((t, i) => <button type="button" key={t.label} className={i === templateTab ? button : input} onClick={() => setTemplateTab(i)}>{t.label}</button>)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">{(['en','sw'] as const).map((language) => <label key={language} className="text-[12px]">{language === 'en' ? 'English' : 'Swahili'}<textarea className={input + ' block w-full mt-1'} rows={3} value={config[template[language]] ?? ''} onChange={(e) => setConfig((c) => ({ ...c, [template[language]]: e.target.value }))} /></label>)}</div>
      <button className={button} onClick={() => { saveSMSConfig(config); setSaved(true); }}>{saved ? 'Saved' : 'Save configuration'}</button>
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
      <h3 className="font-bold text-slate-800 mb-2">SMS Reminders</h3>
      <p className="text-[12px] text-slate-500 mb-3">Internet is required for sending. Offline clinical work remains available. Duplicate checks are shared across devices.</p>
      <button type="button" className={input + ' mb-3 inline-flex gap-2 items-center'} disabled={refreshing || bulkBusy} onClick={() => void refreshShared()}><RefreshCw size={13} />{refreshing ? 'Refreshing...' : 'Refresh shared SMS history'}</button>
      {error && <p role="alert" className="text-[12px] text-amber-700 mb-3">{error} If your session expired, use Sign in online next to Sync Now.</p>}
      <div className="flex gap-2 flex-wrap mb-4">
        <select className={input} disabled={bulkBusy} value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}><option value="">Select facility...</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.district})</option>)}</select>
        {(['reminder','overdue','ltfu','all'] as const).map((t) => <button type="button" disabled={bulkBusy} key={t} className={tab === t ? button : input} onClick={() => setTab(t)}>{t === 'ltfu' ? 'LTFU' : t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
        <select className={input} disabled={bulkBusy} value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'sw')}><option value="en">English</option><option value="sw">Swahili</option></select>
      </div>
      {!hospital ? <p className="text-[12px] text-slate-500">Select a facility to view patients.</p> : <>
        <button type="button" disabled={bulkBusy} className="text-[12px] text-teal-700 font-bold mb-3" onClick={() => setSelected(selected.size ? new Set() : new Set(selectable.map((p) => p.id)))}>{selected.size ? 'Clear selection (' + selected.size + ')' : 'Select all synced patients (' + selectable.length + ')'}</button>
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto border rounded-lg">
          <table className="w-full text-[12px]"><thead className="bg-slate-50"><tr>{['','Patient','Phone','Last SMS','Message / action'].map((h) => <th key={h} className="text-left p-3">{h}</th>)}</tr></thead>
            <tbody>{filtered.map((patient) => {
              const preview = buildSMSPreview(patient, config, clinicSettings, lang, reasons[patient.id] ?? undefined) ?? buildSMSPreview(patient, config, clinicSettings, lang, 'reminder');
              const last = getLastSmsForPatient(log, patient.id);
              return <tr key={patient.id} className="border-t align-top">
                <td className="p-3"><input type="checkbox" aria-label={'Select ' + patient.code} disabled={disabled || !syncedIds.has(patient.id)} checked={selected.has(patient.id)} onChange={() => setSelected((old) => { const next = new Set(old); if (next.has(patient.id)) next.delete(patient.id); else next.add(patient.id); return next; })} /></td>
                <td className="p-3 font-medium">{patient.code}<div className="text-[10px] text-slate-500">{patient.status}</div></td>
                <td className="p-3">{maskPhone(patient.phone)}</td>
                <td className="p-3">{formatSmsSentLabel(last) ?? 'No requests'}{last?.deviceLetter && <div className="text-[10px]">Device {last.deviceLetter}</div>}{last && ['queued','sent','unknown'].includes(last.status) && <button className="block text-teal-700 font-bold mt-2" disabled={sending[patient.id] || bulkBusy} onClick={() => void refreshDelivery(last.id, patient.id)}>Refresh delivery status</button>}</td>
                <td className="p-3 min-w-[250px]">
                  <select className={input + ' mb-2'} disabled={bulkBusy} value={reasons[patient.id] ?? preview?.reason ?? 'reminder'} onChange={(e) => setReasons((r) => ({ ...r, [patient.id]: e.target.value as SMSReason }))}>{(['reminder','missed_appointment','ltfu_warning','welcome'] as const).map((r) => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}</select>
                  <p className="text-[11px] text-slate-600 mb-2 whitespace-pre-wrap">{preview?.message}</p>
                  {!syncedIds.has(patient.id) ? <button className={button} disabled={refreshing || bulkBusy} onClick={() => void syncFirst()}>Sync this patient first</button> : <button className={button} disabled={disabled || sending[patient.id]} onClick={() => void sendOne(patient)}>{sending[patient.id] ? 'Submitting...' : 'Preview & send SMS'}</button>}
                  {feedback[patient.id] && <p role="status" className="text-[11px] text-slate-700 mt-2">{feedback[patient.id]}</p>}
                </td>
              </tr>;
            })}</tbody>
          </table>
          {!filtered.length && <p className="p-4 text-[12px] text-slate-500">No patients match this filter.</p>}
        </div>
      </>}
      {selected.size > 0 && !bulkBusy && <button className={button + ' mt-3 inline-flex gap-2 items-center'} disabled={disabled} onClick={() => void sendSelected()}><Send size={13} />Preview & send {chosen.length} selected</button>}
      {bulkBusy && <div className="mt-3 text-[12px]">Submitting {progress.current} / {progress.total} <button className={input} onClick={() => { cancelBulk.current = true; }}>Stop after current request</button></div>}
      {bulkResult && <p role="status" className="mt-3 text-[12px]">Submission complete: {bulkResult.queued} queued, {bulkResult.sent} sent, {bulkResult.unknown} uncertain, {bulkResult.failed} failed, {bulkResult.skipped} skipped.</p>}
    </section>
  </>;
}
