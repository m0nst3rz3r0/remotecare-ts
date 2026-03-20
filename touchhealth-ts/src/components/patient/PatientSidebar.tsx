import { useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { usePatientStore, selectFilteredPatients, selectSelectedPatient, selectVisiblePatients } from '../../store/usePatientStore';
import type { PatientFilter } from '../../types';
import RegisterForm from './RegisterForm';
import PatientCard from './PatientCard';

const FILTERS: Array<{ id: PatientFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'due', label: 'Due' },
  { id: 'ltfu', label: 'LTFU' },
  { id: 'completed', label: 'Completed' },
];

export default function PatientSidebar() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const patients = usePatientStore((s) => s.patients);
  const selectedId = usePatientStore((s) => s.selectedId);
  const filter = usePatientStore((s) => s.filter);
  const searchQuery = usePatientStore((s) => s.searchQuery);

  const setFilter = usePatientStore((s) => s.setFilter);
  const setSearch = usePatientStore((s) => s.setSearch);
  const selectPatient = usePatientStore((s) => s.selectPatient);

  const visiblePatients = useMemo(
    () => selectVisiblePatients(patients, currentUser),
    [patients, currentUser],
  );

  const filteredPatients = useMemo(
    () => selectFilteredPatients(visiblePatients, filter, searchQuery),
    [visiblePatients, filter, searchQuery],
  );

  const selectedPatient = useMemo(
    () => selectSelectedPatient(patients, selectedId),
    [patients, selectedId],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Registration form (Patients page only) */}
      <RegisterForm />

      <div className="rounded-[var(--r)] bg-white border border-[var(--border)] p-3">
        <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
          Search
        </div>
        <input
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code, phone or address"
          className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const isActive = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={[
                  'px-2 py-1 rounded-full border text-[10px] uppercase font-extrabold tracking-[0.5px]',
                  isActive
                    ? 'bg-[var(--teal-ultra)] border-[var(--teal)] text-[var(--teal)]'
                    : 'bg-white border-[var(--border)] text-[var(--ink)]',
                ].join(' ')}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[var(--r)] bg-white border border-[var(--border)] overflow-hidden">
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)]">
            Patients ({filteredPatients.length})
          </div>
        </div>
        <div className="max-h-[55vh] overflow-auto p-2">
          {filteredPatients.length ? (
            filteredPatients.map((p) => (
              <PatientCard
                key={p.id}
                patient={p}
                selected={p.id === selectedId}
                onSelect={() => selectPatient(p.id)}
              />
            ))
          ) : (
            <div className="p-4 text-[var(--slate)] text-[13px] text-center">
              No patients match your filters.
            </div>
          )}
        </div>
      </div>

      {/* Keep selectedPatient unused for now to avoid future lints */}
      {selectedPatient ? null : null}
    </div>
  );
}

