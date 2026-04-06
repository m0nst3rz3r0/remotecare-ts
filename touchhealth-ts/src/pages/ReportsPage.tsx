import { useMemo, useState } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import { useAuthStore } from '../store/useAuthStore';
import { usePatientStore, selectVisiblePatients } from '../store/usePatientStore';
import { bpClass, sgClass } from '../services/clinical';
import Chip from '../components/ui/Chip';
import Button from '../components/ui/Button';
import { MONTHS } from '../utils/geo';

function downloadText(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const patients = usePatientStore((s) => s.patients);

  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const year = new Date().getFullYear();

  const visiblePatients = useMemo(() => {
    return selectVisiblePatients(patients, currentUser);
  }, [patients, currentUser]);

  const monthName = MONTHS[month - 1] ?? '';

  const visitRows = useMemo(() => {
    const rows: Array<{
      patient: (typeof visiblePatients)[number];
      visit: (typeof visiblePatients)[number]['visits'][number];
      bp?: ReturnType<typeof bpClass> | null;
      sg?: ReturnType<typeof sgClass> | null;
    }> = [];

    for (const p of visiblePatients) {
      for (const v of p.visits ?? []) {
        if (+v.month !== month) continue;
        const bp = v.att && v.sbp && v.dbp ? bpClass(v.sbp, v.dbp) : null;
        const sg =
          v.att && v.sugar && v.sugarType
            ? sgClass(v.sugar, (v.sugarType as any) ?? 'FBS')
            : null;
        rows.push({ patient: p, visit: v, bp, sg });
      }
    }

    // Stable order: newest first
    rows.sort((a, b) => new Date(b.visit.date).getTime() - new Date(a.visit.date).getTime());
    return rows;
  }, [visiblePatients, month]);

  const onExportCSV = () => {
    const header = ['Card No', 'Condition', 'Attendance', 'BP', 'Glucose', 'Medications'];
    const lines = [header.join(',')];

    for (const r of visitRows) {
      const attend = r.visit.att ? 'Attended' : 'Missed';
      const bpText =
        r.bp && r.visit.sbp && r.visit.dbp ? `${r.visit.sbp}/${r.visit.dbp} ${r.bp.lbl}` : '';
      const sgText =
        r.sg && r.visit.sugar && r.visit.sugarType
          ? `${r.visit.sugar} ${r.visit.sugarType} ${r.sg.lbl}`
          : '';
      const meds = (r.visit.meds ?? []).length ? r.visit.meds.map((m) => m.name).join('|') : '';
      const row = [
        `"${r.patient.code}"`,
        `"${r.patient.cond}"`,
        attend,
        `"${bpText}"`,
        `"${sgText}"`,
        `"${meds}"`,
      ];
      lines.push(row.join(','));
    }

    downloadText(
      `TouchHealth_MonthlyReport_${monthName}_${year}.csv`,
      lines.join('\n'),
      'text/csv',
    );
  };

  const onPrint = () => {
    const printHtml = `
      <div>
        <h2 style="margin:0 0 8px;font-family:Syne,sans-serif;">Monthly Report — ${monthName} ${year}</h2>
        <div style="margin-bottom:14px;color:#64748b;">${currentUser?.sessionHospital ?? 'RemoteCare'} · Generated ${new Date().toLocaleDateString('en-GB')}</div>
      </div>
      ${
        visitRows.length
          ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr>
              <th style="border-bottom:1px solid #e2e8f0;text-align:left;padding:6px 8px;">Card No</th>
              <th style="border-bottom:1px solid #e2e8f0;text-align:left;padding:6px 8px;">Attend</th>
              <th style="border-bottom:1px solid #e2e8f0;text-align:left;padding:6px 8px;">BP</th>
              <th style="border-bottom:1px solid #e2e8f0;text-align:left;padding:6px 8px;">Glucose</th>
              <th style="border-bottom:1px solid #e2e8f0;text-align:left;padding:6px 8px;">Medications</th>
            </tr>
          </thead>
          <tbody>
            ${visitRows
              .map((r) => {
                const attend = r.visit.att ? 'Attended' : 'Missed';
                const bpText =
                  r.bp && r.visit.sbp && r.visit.dbp
                    ? `${r.visit.sbp}/${r.visit.dbp} ${r.bp.lbl}`
                    : '—';
                const sgText =
                  r.sg && r.visit.sugar && r.visit.sugarType
                    ? `${r.visit.sugar} ${r.visit.sugarType} ${r.sg.lbl}`
                    : '—';
                const meds = (r.visit.meds ?? []).length ? r.visit.meds.map((m) => m.name).join(', ') : '—';
                return `
                  <tr>
                    <td style="border-bottom:1px solid #f1f5f9;padding:6px 8px;font-weight:700;">${r.patient.code}</td>
                    <td style="border-bottom:1px solid #f1f5f9;padding:6px 8px;">${attend}</td>
                    <td style="border-bottom:1px solid #f1f5f9;padding:6px 8px;">${bpText}</td>
                    <td style="border-bottom:1px solid #f1f5f9;padding:6px 8px;">${sgText}</td>
                    <td style="border-bottom:1px solid #f1f5f9;padding:6px 8px;">${meds}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
        `
          : `<div style="padding:14px 0;color:#64748b;font-weight:700;">No visits recorded for ${monthName} ${year}.</div>`
      }
      <script>window.onload=function(){window.print();setTimeout(()=>window.close(),400);};</script>
    `;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>TouchHealth Monthly Report</title></head><body>${printHtml}</body></html>`);
    win.document.close();
  };

  return (
    <PageWrapper title="Reports">
      <div className="flex flex-wrap items-end gap-3 justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
            Month
          </div>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-3 py-2 outline-none bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" label="Print" onClick={onPrint} />
          <Button size="sm" variant="primary" label="Export CSV" onClick={onExportCSV} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-4" style={{ background: '#132b31', color: '#fff' }}>
          <div className="font-syne font-semibold text-white text-[20px]">
            Monthly Report — {monthName} {year}
          </div>
          <div className="mt-1 text-[12px]" style={{ opacity: 0.7 }}>
            {currentUser?.sessionHospital ?? 'RemoteCare'} · Generated{' '}
            {new Date().toLocaleDateString('en-GB')}
          </div>
        </div>

        <div className="p-4">
          {visitRows.length ? (
            <div className="overflow-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    <th className="pb-2 pr-2">Card No</th>
                    <th className="pb-2 pr-2">Attend</th>
                    <th className="pb-2 pr-2">BP</th>
                    <th className="pb-2 pr-2">Glucose</th>
                    <th className="pb-2 pr-2">Medications</th>
                  </tr>
                </thead>
                <tbody>
                  {visitRows.map((r) => (
                    <tr key={`${r.patient.id}-${r.visit.id}`}>
                      <td className="py-2 pr-2 font-semibold mono text-[12px] text-slate-800">
                        {r.patient.code}
                      </td>
                      <td className="py-2 pr-2">
                        <Chip cls={r.visit.att ? 'chip-normal' : 'chip-high'}>
                          {r.visit.att ? 'Attended' : 'Missed'}
                        </Chip>
                      </td>
                      <td className="py-2 pr-2 text-[12px] text-slate-500">
                        {r.bp && r.visit.sbp && r.visit.dbp ? (
                          <span>
                            {r.visit.sbp}/{r.visit.dbp} {r.bp.lbl}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 pr-2 text-[12px] text-slate-500">
                        {r.sg && r.visit.sugar && r.visit.sugarType ? (
                          <span>
                            {r.visit.sugar} {r.visit.sugarType} {r.sg.lbl}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 pr-2 text-[12px] text-slate-500">
                        {(r.visit.meds ?? []).length
                          ? r.visit.meds.map((m) => m.name).join(', ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-slate-500 font-semibold">
                No visits recorded for {monthName} {year}.
              </div>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}


