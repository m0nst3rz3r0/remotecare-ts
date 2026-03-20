import { useMemo, useState } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import { useAuthStore } from '../store/useAuthStore';
import { usePatientStore, selectVisiblePatients, selectSelectedPatient } from '../store/usePatientStore';
import { isDue } from '../services/clinical';
import PatientCard from '../components/patient/PatientCard';
import PatientDetail from '../components/patient/PatientDetail';

export default function LTFUPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const patients = usePatientStore((s) => s.patients);
  const selectedId = usePatientStore((s) => s.selectedId);
  const selectPatient = usePatientStore((s) => s.selectPatient);

  const selectedPatient = usePatientStore((s) => selectSelectedPatient(s.patients, s.selectedId));

  const [q, setQ] = useState('');

  const visiblePatients = useMemo(
    () => selectVisiblePatients(patients, currentUser),
    [patients, currentUser],
  );

  const list = useMemo(() => {
    const base = visiblePatients.filter(
      (p) => p.status === 'ltfu' || (p.status === 'active' && isDue(p)),
    );
    const qq = q.toLowerCase().trim();
    if (!qq) return base;
    return base.filter((p) => p.code.toLowerCase().includes(qq) || (p.phone ?? '').includes(qq));
  }, [visiblePatients, q]);

  const showMobileDetail = !!selectedId;
  const mobileBack = (
    <div className="p-3 border-b border-[var(--border)] bg-white flex items-center gap-2">
      <button
        type="button"
        className="px-3 py-2 rounded-[var(--r-sm)] border border-[var(--border)] font-extrabold text-[12px] uppercase tracking-[0.5px]"
        onClick={() => selectPatient(null)}
      >
        ← Back
      </button>
      <div className="font-syne font-extrabold text-[14px] text-[var(--ink)]">
        {selectedPatient?.code ?? 'Patient'}
      </div>
    </div>
  );

  if (showMobileDetail) {
    return (
      <div className="h-full flex flex-col">
        <div className="lg:hidden">{mobileBack}</div>
        <div className="flex-1 lg:hidden">
          <PatientDetail />
        </div>
        <div className="hidden lg:flex">
          <aside className="w-[300px] border-r border-[var(--border)]">
            <div className="p-3">
              <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
                Search
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
                placeholder="Search code or phone"
              />
            </div>
            <div className="overflow-auto max-h-[65vh] p-2 space-y-2">
              {list.map((p) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  selected={p.id === selectedId}
                  onSelect={() => selectPatient(p.id)}
                />
              ))}
            </div>
          </aside>
          <div className="flex-1">
            <PatientDetail />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper title="LTFU">
      <div className="flex flex-col lg:flex-row gap-0 h-full">
        <aside className="w-full lg:w-[300px] lg:flex-shrink-0 lg:border-r border-[var(--border)]">
          <div className="p-3">
            <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
              Search
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
              placeholder="Search code or phone"
            />
          </div>
          <div className="overflow-auto max-h-[65vh] p-2 space-y-2">
            {list.length ? (
              list.map((p) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  selected={p.id === selectedId}
                  onSelect={() => selectPatient(p.id)}
                />
              ))
            ) : (
              <div className="p-4 text-[var(--slate)] text-[13px]">No LTFU/overdue patients.</div>
            )}
          </div>
        </aside>

        <section className="hidden lg:block flex-1 overflow-hidden">
          <PatientDetail />
        </section>
      </div>
    </PageWrapper>
  );
}

