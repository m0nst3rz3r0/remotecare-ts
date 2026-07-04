import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Smartphone, X, Send } from 'lucide-react';
import type { Hospital, Patient, SMSConfig } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import {
  buildSMSPreview,
  sendSMS as sendSMSService,
  daysUntilAppointment,
  buildSMSMessage,
  getPatientNextDate,
  getPatientSMSReason,
  filterPatientsForSmsTab,
  getLastSmsForPatient,
  formatSmsSentLabel,
  smsAlreadySentRecently,
} from '../../services/sms';
import { loadSMSConfig, saveSMSConfig, loadSMSLog } from '../../services/storage';
import { maskPhone } from '../../utils/phone';
import { AdminBulkConfirmModal } from './AdminOverview';

type SmsReason = 'reminder' | 'missed_appointment' | 'ltfu_warning' | 'welcome';
type SmsBulkPhase = 'idle' | 'confirm' | 'sending' | 'done';

export default function AdminSmsPanel({
  hospitals,
  patients,
  clinicSettings,
}: {
  hospitals: Hospital[];
  patients: Patient[];
  clinicSettings: any;
}) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const smsSenderName = currentUser?.displayName ?? currentUser?.username ?? 'Admin';

  const [smsConfig, setSmsConfig] = useState<SMSConfig>(() => loadSMSConfig());
  const [smsLog, setSmsLog] = useState(() => loadSMSLog());
  const [smsSending, setSmsSending] = useState<Record<string, boolean>>({});
  const [smsReason, setSmsReason] = useState<Record<string, SmsReason>>({});
  const [smsFeedback, setSmsFeedback] = useState<Record<string, string>>({});
  const [smsLang, setSmsLang] = useState<'en' | 'sw'>('en');
  const [smsTab, setSmsTab] = useState<'ltfu' | 'overdue' | 'reminder' | 'all'>('reminder');
  const [smsHospital, setSmsHospital] = useState('');
  const [smsConfigSaved, setSmsConfigSaved] = useState(false);
  const [smsTemplateTab, setSmsTemplateTab] = useState<'reminder' | 'missed' | 'ltfu' | 'welcome'>('reminder');
  const [smsSelected, setSmsSelected] = useState<Set<number>>(new Set());
  const [smsBulkPhase, setSmsBulkPhase] = useState<SmsBulkPhase>('idle');
  const [smsBulkProgress, setSmsBulkProgress] = useState({ current: 0, total: 0 });
  const [smsBulkResult, setSmsBulkResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const smsBulkAbortRef = useRef(false);
  const bulkRateMs = 220;

  const smsFilteredPatients = useMemo(() => {
    if (!smsHospital) return [];
    return filterPatientsForSmsTab(patients, smsTab, clinicSettings, smsHospital);
  }, [patients, smsTab, clinicSettings, smsHospital]);

  const smsSelectedPatients = useMemo(
    () => smsFilteredPatients.filter((patient) => smsSelected.has(patient.id)),
    [smsFilteredPatients, smsSelected],
  );

  const smsSelectableIds = useMemo(
    () => smsFilteredPatients.filter((patient) => patient.phone).map((patient) => patient.id),
    [smsFilteredPatients],
  );

  useEffect(() => {
    setSmsSelected(new Set());
    setSmsBulkPhase('idle');
    setSmsBulkResult(null);
  }, [smsHospital, smsTab]);

  const toggleSmsSelect = useCallback((id: number) => {
    setSmsSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllSms = useCallback(() => {
    setSmsSelected(new Set(smsSelectableIds));
  }, [smsSelectableIds]);

  const clearSmsSelection = useCallback(() => {
    setSmsSelected(new Set());
    setSmsBulkPhase('idle');
    setSmsBulkResult(null);
  }, []);

  const handleSmsBulkConfirm = useCallback(async () => {
    const candidates = smsSelectedPatients.filter((patient) => patient.phone);
    const toSend = candidates.filter((patient) => !smsAlreadySentRecently(patient.id, 3));
    const skippedRecent = candidates.length - toSend.length;
    const skippedNoPhone = smsSelectedPatients.length - candidates.length;

    setSmsBulkPhase('sending');
    setSmsBulkProgress({ current: 0, total: toSend.length });
    smsBulkAbortRef.current = false;

    let sent = 0;
    let failed = 0;
    const entries: Awaited<ReturnType<typeof sendSMSService>>[] = [];

    for (let i = 0; i < toSend.length; i++) {
      if (smsBulkAbortRef.current) break;
      const patient = toSend[i];
      setSmsBulkProgress({ current: i + 1, total: toSend.length });
      const reason = smsReason[patient.id] ?? getPatientSMSReason(patient, clinicSettings) ?? 'reminder';
      try {
        const entry = await sendSMSService(
          patient,
          smsLang,
          smsConfig,
          clinicSettings,
          reason,
          smsSenderName,
        );
        entries.push(entry);
        if (entry.status === 'sent' || entry.status === 'demo') sent++;
        else failed++;
      } catch {
        failed++;
      }
      if (i < toSend.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, bulkRateMs));
      }
    }

    if (entries.length) {
      setSmsLog(loadSMSLog());
    }

    setSmsBulkResult({ sent, failed, skipped: skippedRecent + skippedNoPhone });
    setSmsBulkPhase('done');
    setSmsSelected(new Set());
  }, [
    smsSelectedPatients,
    smsReason,
    clinicSettings,
    smsLang,
    smsConfig,
    smsSenderName,
  ]);

  const smsBulkPct = smsBulkProgress.total
    ? Math.round((smsBulkProgress.current / smsBulkProgress.total) * 100)
    : 0;

  const handleSaveSMSConfig = () => {
    saveSMSConfig(smsConfig);
    setSmsConfigSaved(true);
    setTimeout(() => setSmsConfigSaved(false), 2000);
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <div className="font-sans font-bold text-slate-800 text-[13px] mb-1 flex items-center gap-2">
          <Smartphone size={16} />
          <span>SMS Configuration</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-bold border border-sky-200">
            Server-managed secrets
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
          Configure messaging behavior and templates. Provider secrets are managed server-side in the SMS edge function.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Sender ID</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px]"
              value={smsConfig.senderId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmsConfig((prev) => ({ ...prev, senderId: e.target.value }))}
              placeholder="e.g. RemoteCare"
            />
          </div>
          <div className="flex items-end">
            <button
              className="px-4 py-1.5 rounded bg-teal-700 text-white text-[12px] font-bold hover:bg-teal-800 disabled:opacity-50"
              onClick={handleSaveSMSConfig}
            >
              {smsConfigSaved ? 'Saved!' : 'Save Config'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <div className="flex gap-2 flex-wrap mb-3">
              {([
                { id: 'reminder', label: 'Reminder' },
                { id: 'missed', label: 'Missed visit' },
                { id: 'ltfu', label: 'LTFU warning' },
                { id: 'welcome', label: 'Welcome' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${
                    smsTemplateTab === tab.id
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  onClick={() => setSmsTemplateTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {smsTemplateTab === 'reminder' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">English · Reminder</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.template}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev) => ({ ...prev, template: e.target.value }))}
                  placeholder="Dear {name}, your appointment at {hospital} is on {date}."
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Swahili · Reminder</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateSw}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev) => ({ ...prev, templateSw: e.target.value }))}
                  placeholder="Habari {name}, ziara yako {hospital} ni tarehe {date}."
                />
              </div>
            </>
          )}

          {smsTemplateTab === 'missed' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">English · Missed visit</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateMissed ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev) => ({ ...prev, templateMissed: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Swahili · Missed visit</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateMissedSw ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev) => ({ ...prev, templateMissedSw: e.target.value }))}
                />
              </div>
            </>
          )}

          {smsTemplateTab === 'ltfu' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">English · LTFU warning</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateLtfu ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev) => ({ ...prev, templateLtfu: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Swahili · LTFU warning</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateLtfuSw ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev) => ({ ...prev, templateLtfuSw: e.target.value }))}
                />
              </div>
            </>
          )}

          {smsTemplateTab === 'welcome' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">English · Welcome</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateWelcome ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev) => ({ ...prev, templateWelcome: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Swahili · Welcome</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-[12px] resize-vertical"
                  value={smsConfig.templateWelcomeSw ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsConfig((prev) => ({ ...prev, templateWelcomeSw: e.target.value }))}
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <p className="text-[10px] text-slate-400">Variables: {'{name}'}, {'{hospital}'}, {'{date}'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <div className="font-sans font-bold text-slate-800 text-[13px] mb-1 flex items-center gap-2">
          <Smartphone size={16} />
          <span>SMS Reminders</span>
        </div>
        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
          Send appointment reminders to patients at your facility. Messages already sent by a doctor in the last 3 days are flagged to avoid duplicates.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            className="border border-slate-300 rounded px-3 py-1.5 text-[12px] bg-white flex-shrink-0"
            value={smsHospital}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSmsHospital(e.target.value)}
          >
            <option value="">Select Hospital...</option>
            {hospitals.map((hospital) => (
              <option key={hospital.id} value={hospital.name}>
                {hospital.name} ({hospital.district})
              </option>
            ))}
          </select>

          <div className="flex gap-2 flex-wrap">
            {[
              { k: 'ltfu', l: 'LTFU' },
              { k: 'overdue', l: 'Overdue' },
              { k: 'reminder', l: 'Reminders' },
              { k: 'all', l: 'All' },
            ].map((tab) => (
              <button
                key={tab.k}
                className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${
                  smsTab === tab.k
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                onClick={() => setSmsTab(tab.k as typeof smsTab)}
              >
                {tab.l}
              </button>
            ))}
          </div>

          <select
            className="sm:ml-auto border border-slate-300 rounded px-2 py-1 text-[11px] bg-white"
            value={smsLang}
            onChange={(e) => setSmsLang(e.target.value as 'en' | 'sw')}
          >
            <option value="en">English</option>
            <option value="sw">Swahili</option>
          </select>
        </div>

        {smsHospital && (
          <div className="mb-3 px-3 py-2 bg-slate-50 rounded border border-slate-200">
            <span className="text-[11px] text-slate-600">Selected Facility: </span>
            <span className="text-[11px] font-bold text-slate-800">{smsHospital}</span>
          </div>
        )}

        {!smsHospital ? (
          <div className="text-center py-6 text-slate-500 text-[12px]">
            Please select a hospital from the dropdown above to view patients.
          </div>
        ) : smsFilteredPatients.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-[12px]">
            No patients match the selected filter at {smsHospital}.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-3">
              <button
                type="button"
                onClick={() =>
                  smsSelected.size === smsSelectableIds.length ? clearSmsSelection() : selectAllSms()
                }
                className="text-[11px] font-bold text-teal-700 hover:text-teal-900"
              >
                {smsSelected.size > 0
                  ? `${smsSelected.size} selected · Clear`
                  : `Select all (${smsSelectableIds.length})`}
              </button>
              <span className="text-[10px] text-slate-500">
                {smsFilteredPatients.length} patient{smsFilteredPatients.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 w-8" />
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Patient</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Phone</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Last SMS</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {smsFilteredPatients.map((patient) => {
                    const smsPreview = buildSMSPreview(patient, smsConfig, clinicSettings, smsLang, smsReason[patient.id]);
                    const days = smsPreview?.daysUntil ?? daysUntilAppointment(patient, clinicSettings);
                    const resolvedReason = smsPreview?.reason ?? getPatientSMSReason(patient, clinicSettings) ?? 'reminder';
                    const preview = smsPreview?.message ?? buildSMSMessage(
                      patient,
                      smsConfig,
                      smsLang,
                      getPatientNextDate(patient, clinicSettings),
                      resolvedReason,
                    );
                    const lastSms = getLastSmsForPatient(smsLog, patient.id);
                    const sentLabel = formatSmsSentLabel(lastSms);
                    const recentlySent = smsAlreadySentRecently(patient.id, 3);
                    let statusLabel = '';
                    let statusColor = '';
                    if (patient.status === 'ltfu') {
                      statusLabel = 'LTFU';
                      statusColor = 'text-red-600';
                    } else if (days < 0) {
                      statusLabel = `${Math.abs(days)}d overdue`;
                      statusColor = 'text-red-600';
                    } else if (days <= 7) {
                      statusLabel = `Due in ${days}d`;
                      statusColor = 'text-amber-600';
                    } else {
                      statusLabel = `Due in ${days}d`;
                      statusColor = 'text-emerald-600';
                    }

                    return (
                      <tr key={patient.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={smsSelected.has(patient.id)}
                            disabled={!patient.phone}
                            onChange={() => toggleSmsSelect(patient.id)}
                            className="accent-teal-700"
                            aria-label={`Select ${patient.code}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{patient.code}</div>
                          <div className="text-[10px] text-slate-500">{patient.region} · {patient.district}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{maskPhone(patient.phone || '')}</td>
                        <td className={`px-3 py-2 font-medium ${statusColor}`}>{statusLabel}</td>
                        <td className="px-3 py-2">
                          {sentLabel ? (
                            <div className={`text-[10px] font-semibold ${recentlySent ? 'text-amber-700' : 'text-slate-600'}`}>
                              {sentLabel}
                              {recentlySent ? (
                                <div className="text-[9px] font-bold uppercase tracking-wide text-amber-600 mt-0.5">
                                  Already sent recently
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">Not sent</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-2">
                            <select
                              className="border border-slate-300 rounded px-2 py-1 text-[11px] bg-white"
                              value={resolvedReason}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                setSmsReason((prev) => ({
                                  ...prev,
                                  [patient.id]: e.target.value as SmsReason,
                                }))
                              }
                            >
                              <option value="reminder">Reminder</option>
                              <option value="missed_appointment">Missed appointment</option>
                              <option value="ltfu_warning">LTFU warning</option>
                              <option value="welcome">Welcome</option>
                            </select>
                            <button
                              className="px-3 py-1 rounded bg-teal-700 text-white text-[11px] font-bold hover:bg-teal-800 disabled:opacity-50"
                              disabled={smsSending[patient.id] || !patient.phone}
                              onClick={async () => {
                                if (!patient.phone) return;
                                const duplicateNote = recentlySent && sentLabel
                                  ? `\n\nNote: ${sentLabel}.`
                                  : '';
                                const proceed = window.confirm(
                                  recentlySent
                                    ? `An SMS was already sent to ${patient.code} recently.${duplicateNote}\n\nSend another ${resolvedReason.replace('_', ' ')} message anyway?\n\nPreview:\n${preview}`
                                    : `Send ${resolvedReason.replace('_', ' ')} SMS to ${patient.code}?\n\nPreview:\n${preview}`,
                                );
                                if (!proceed) return;
                                setSmsSending((prev) => ({ ...prev, [patient.id]: true }));
                                setSmsFeedback((prev) => ({ ...prev, [patient.id]: '' }));
                                try {
                                  const entry = await sendSMSService(
                                    patient,
                                    smsLang,
                                    smsConfig,
                                    clinicSettings,
                                    resolvedReason,
                                    smsSenderName,
                                  );
                                  setSmsLog(loadSMSLog());
                                  setSmsFeedback((prev) => ({
                                    ...prev,
                                    [patient.id]:
                                      entry.status === 'sent' || entry.status === 'demo'
                                        ? `Sent (${entry.status})`
                                        : `Failed: ${entry.note ?? 'Unknown error'}`,
                                  }));
                                } finally {
                                  setSmsSending((prev) => ({ ...prev, [patient.id]: false }));
                                }
                              }}
                            >
                              {smsSending[patient.id] ? 'Sending...' : 'Send SMS'}
                            </button>
                            <div className="text-[10px] text-slate-500 max-w-[320px] truncate" title={preview}>
                              Preview: {preview}
                            </div>
                            {smsFeedback[patient.id] && (
                              <div className={`text-[10px] font-semibold ${smsFeedback[patient.id].startsWith('Failed') ? 'text-red-600' : 'text-emerald-700'}`}>
                                {smsFeedback[patient.id]}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {smsBulkPhase === 'confirm' && (
          <AdminBulkConfirmModal
            patients={smsSelectedPatients}
            lang={smsLang}
            smsConfig={smsConfig}
            clinicSettings={clinicSettings}
            smsReason={smsReason}
            onConfirm={handleSmsBulkConfirm}
            onCancel={() => setSmsBulkPhase('idle')}
          />
        )}

        {smsBulkResult && smsBulkPhase === 'done' && (
          <div className="mt-3 px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 text-[12px] text-emerald-900 flex items-center justify-between gap-3">
            <span>
              Bulk send complete: <strong>{smsBulkResult.sent}</strong> sent
              {smsBulkResult.failed > 0 ? `, ${smsBulkResult.failed} failed` : ''}
              {smsBulkResult.skipped > 0 ? `, ${smsBulkResult.skipped} skipped` : ''}.
            </span>
            <button
              type="button"
              onClick={() => {
                setSmsBulkPhase('idle');
                setSmsBulkResult(null);
              }}
              className="text-emerald-700 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {(smsSelected.size > 0 && smsBulkPhase === 'idle') || smsBulkPhase === 'sending' ? (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] w-[min(580px,95vw)] bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
            {smsBulkPhase === 'sending' && (
              <div className="h-1 bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${smsBulkPct}%` }}
                />
              </div>
            )}
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <Smartphone size={18} className="text-emerald-400 shrink-0" />
              {smsBulkPhase === 'idle' && (
                <>
                  <div className="flex-1 min-w-[180px]">
                    <div className="font-bold text-white text-[13px]">
                      {smsSelected.size} patient{smsSelected.size !== 1 ? 's' : ''} selected
                    </div>
                    <div className="text-[10px] text-white/45 mt-0.5">
                      {smsLang === 'sw' ? 'Swahili' : 'English'} · Uses each patient&apos;s message type
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmsBulkPhase('confirm')}
                    className="px-4 py-2 rounded-lg bg-teal-600 text-white text-[11px] font-bold flex items-center gap-2"
                  >
                    <Send size={13} />
                    Preview &amp; Send
                  </button>
                  <button type="button" onClick={clearSmsSelection} className="text-white/40 hover:text-white p-1">
                    <X size={16} />
                  </button>
                </>
              )}
              {smsBulkPhase === 'sending' && (
                <>
                  <div className="flex-1">
                    <div className="font-bold text-white text-[13px]">
                      Sending... {smsBulkProgress.current} / {smsBulkProgress.total}
                    </div>
                    <div className="text-[10px] text-white/45">{smsBulkPct}% complete</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      smsBulkAbortRef.current = true;
                    }}
                    className="px-3 py-1.5 rounded border border-white/20 text-white/70 text-[11px] font-bold"
                  >
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
