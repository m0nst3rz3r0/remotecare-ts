import { useMemo, useState } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import { useAuthStore } from '../store/useAuthStore';
import {
  usePatientStore,
  selectVisiblePatients,
} from '../store/usePatientStore';
import { useUIStore } from '../store/useUIStore';
import { formatDateLong, getLastVisit, nextVisitDate, bpClass, sgClass } from '../services/clinical';
import Chip from '../components/ui/Chip';
import Button from '../components/ui/Button';

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysUntil(dateStr: string) {
  const nd = new Date(dateStr);
  const today = startOfToday();
  return Math.round((nd.getTime() - today.getTime()) / 86_400_000);
}

function dayIndexToLabel(day: number) {
  const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return map[day] ?? '';
}

export default function ClinicPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const patients = usePatientStore((s) => s.patients);
  const visiblePatients = useMemo(
    () => selectVisiblePatients(patients, currentUser),
    [patients, currentUser],
  );

  const { clinicSettings, toggleClinicDay } = useUIStore((s) => ({
    clinicSettings: s.clinicSettings,
    toggleClinicDay: s.toggleClinicDay,
  }));

  const openVisitModal = useUIStore((s) => s.openVisitModal);

  const scheduleNext = usePatientStore((s) => s.scheduleNext);
  const clearSchedule = usePatientStore((s) => s.clearSchedule);
  const confirmAllPredicted = usePatientStore((s) => s.confirmAllPredicted);

  const [filter, setFilter] = useState<'all' | 'due7' | 'overdue'>('all');

  const rows = useMemo(() => {
    const active = visiblePatients.filter((p) => p.status === 'active');
    const result = active.map((p) => {
      const lv = getLastVisit(p);
      const from = lv?.date ? new Date(lv.date) : new Date(p.enrol);

      // Predicted appointment based on last visit/enrol and 30-day snapping.
      const predictedDate = nextVisitDate(from, 30, clinicSettings.days);
      const predictedISO = toISODate(predictedDate);
      const hard = new Date(from);
      hard.setDate(hard.getDate() + 30);

      const confirmedISO = p.scheduledNext?.date ?? null;
      const nextISO = confirmedISO ?? predictedISO;
      const dueIn = daysUntil(nextISO);

      const isOverdue = dueIn < 0;
      const isToday = dueIn === 0;
      const dueIn7 = dueIn >= 0 && dueIn <= 7;

      return {
        p,
        lastVisit: lv,
        hardISO: toISODate(hard),
        predictedISO,
        nextISO,
        dueIn,
        isOverdue,
        isToday,
        dueIn7,
        confirmed: !!confirmedISO,
      };
    });

    if (filter === 'overdue') return result.filter((r) => r.isOverdue);
    if (filter === 'due7') return result.filter((r) => r.dueIn7 || r.isToday);
    return result;
  }, [visiblePatients, clinicSettings.days, filter]);

  const hasClinicDays = clinicSettings.days.length > 0;

  const confirmAll = () => {
    if (!currentUser) return;
    confirmAllPredicted(clinicSettings, currentUser.displayName);
  };

  return (
    <PageWrapper title="Clinic Schedule">
      <div className="space-y-3">
        <div className="rounded-[var(--r)] border border-[var(--border)] bg-white p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)]">
              Clinic days setup
            </div>
            <Button
              size="xs"
              variant="primary"
              label="Confirm All Predicted"
              onClick={confirmAll}
              disabled={!hasClinicDays}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const active = clinicSettings.days.includes(day as any);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleClinicDay(day as any)}
                  className={[
                    'px-3 py-2 rounded-full border text-[11px] uppercase font-extrabold tracking-[0.5px]',
                    active
                      ? 'bg-[var(--teal-ultra)] border-[var(--teal)] text-[var(--teal)]'
                      : 'bg-white border-[var(--border)] text-[var(--ink)]',
                  ].join(' ')}
                >
                  {dayIndexToLabel(day)}
                </button>
              );
            })}
          </div>

          <div className="mt-2 text-[12px] font-bold text-[var(--slate)]">
            Appointments always ≤ 30 days to prevent medication gaps.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All active' },
            { id: 'due7', label: 'Due in 7 days' },
            { id: 'overdue', label: 'Overdue' },
          ].map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setFilter(x.id as any)}
              className={[
                'px-3 py-2 rounded-full border text-[11px] uppercase font-extrabold tracking-[0.5px]',
                filter === x.id
                  ? 'bg-[var(--amber-pale)] border-[var(--amber)] text-[var(--amber)]'
                  : 'bg-white border-[var(--border)] text-[var(--ink)]',
              ].join(' ')}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="rounded-[var(--r)] border border-[var(--border)] bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border)] bg-white">
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)]">
              {rows.length} patients
            </div>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.5px] font-extrabold text-[var(--slate)]">
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Condition</th>
                  <th className="px-3 py-2">Last Visit</th>
                  <th className="px-3 py-2">Last BP</th>
                  <th className="px-3 py-2">Last Glucose</th>
                  <th className="px-3 py-2">Next Appointment</th>
                  <th className="px-3 py-2 text-center">Days Until</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const lv = r.lastVisit;
                  const bp = lv?.sbp && lv?.dbp ? bpClass(lv.sbp, lv.dbp) : null;
                  const sg = lv?.sugar && lv?.sugarType ? sgClass(lv.sugar, lv.sugarType as any) : null;

                  const rowBg = r.isOverdue
                    ? 'var(--rose-pale)'
                    : r.isToday
                      ? 'var(--amber-pale)'
                      : 'transparent';

                  const daysColor =
                    r.isOverdue ? 'var(--rose)' : r.dueIn7 || r.isToday ? 'var(--amber)' : 'var(--emerald)';

                  return (
                    <tr key={r.p.id} style={{ background: rowBg }}>
                      <td className="px-3 py-2">
                        <div className="mono font-extrabold text-[12px] text-[var(--ink)]">
                          {r.p.code}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-[var(--slate)]">
                        {r.p.age}y · {r.p.sex}
                      </td>
                      <td className="px-3 py-2">
                        <Chip
                          cls={
                            r.p.cond === 'DM'
                              ? 'chip-blue'
                              : r.p.cond === 'DM+HTN'
                                ? 'chip-elevated'
                                : 'chip-high'
                          }
                        >
                          {r.p.cond}
                        </Chip>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-[var(--slate)]">
                        {lv?.date ? formatDateLong(lv.date) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {bp && lv?.sbp && lv?.dbp ? (
                          <Chip cls={bp.cls}>
                            {lv.sbp}/{lv.dbp}
                          </Chip>
                        ) : (
                          <Chip cls="chip-gray">—</Chip>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {sg && lv?.sugar && lv?.sugarType ? (
                          <Chip cls={sg.cls}>
                            {lv.sugar} {lv.sugarType}
                          </Chip>
                        ) : (
                          <Chip cls="chip-gray">—</Chip>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-extrabold text-[13px] text-[var(--ink)]">
                          {formatDateLong(r.nextISO)}
                        </div>
                        <div className="text-[10px] font-bold text-[var(--slate)] mt-1">
                          {formatDateLong(r.p.enrol && lv?.date ? lv.date : r.hardISO).slice(0, 3)}
                          {' + 30d = '}
                          {formatDateLong(r.hardISO)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center font-extrabold" style={{ color: daysColor }}>
                        {r.dueIn}
                      </td>
                      <td className="px-3 py-2">
                        <Chip cls={r.confirmed ? 'chip-blue' : 'chip-gray'}>
                          {r.confirmed ? 'CONFIRMED' : 'PREDICTED'}
                        </Chip>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {!r.confirmed ? (
                            <Button
                              size="xs"
                              variant="primary"
                              label="Schedule"
                              onClick={() => {
                                if (!currentUser) return;
                                scheduleNext(r.p.id, r.predictedISO, '', currentUser.displayName);
                              }}
                            />
                          ) : null}
                          <Button size="xs" variant="ghost" label="+ Visit" onClick={() => openVisitModal(r.p.id)} />
                          {r.confirmed ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              label="✕ Clear"
                              onClick={() => clearSchedule(r.p.id)}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-4 text-center text-[var(--slate)]">
                      No patients match this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}


