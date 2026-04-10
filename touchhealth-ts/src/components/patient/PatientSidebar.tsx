// ════════════════════════════════════════════════════════════
// REMOTECARE · src/components/patient/PatientSidebar.tsx
//
// Preserves all existing UI exactly.
// Adds a "Today's Queue" panel at the top when there are
// patients due today. Fully reactive — moving from Expected
// to Completed the instant a visit is saved.
// Search in queue filters by last 4 digits of patient code.
// Walk-in fallback shows unscheduled patients from All list.
// ════════════════════════════════════════════════════════════

import { useMemo, useState, useRef } from 'react';
import { Check, Calendar, Search, User, PartyPopper } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import {
  usePatientStore,
  selectFilteredPatients,
  selectSelectedPatient,
  selectVisiblePatients,
} from '../../store/usePatientStore';
import { useUIStore } from '../../store/useUIStore';
import { getPatientNextVisitDate } from '../../services/clinical';
import type { Patient, PatientFilter } from '../../types';
import RegisterForm from './RegisterForm';
import PatientCard from './PatientCard';

// ── Filter tabs (unchanged) ───────────────────────────────────
const FILTERS: Array<{ id: PatientFilter; label: string }> = [
  { id: 'all',       label: 'All'       },
  { id: 'active',    label: 'Active'    },
  { id: 'due',       label: 'Due'       },
  { id: 'ltfu',      label: 'LTFU'      },
  { id: 'completed', label: 'Completed' },
];

// ── Today's date string ───────────────────────────────────────
function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Mini queue card (compact, no redundant chips) ─────────────
function QueueCard({
  patient,
  done,
  selected,
  onSelect,
  onVisit,
  walkIn = false,
}: {
  patient:  Patient;
  done:     boolean;
  selected: boolean;
  onSelect: () => void;
  onVisit:  () => void;
  walkIn?:  boolean;
}) {
  const lv = (patient.visits ?? [])
    .filter(v => v.att)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null;

  const condColor =
    patient.cond === 'DM+HTN' ? { bg: 'rgba(217,119,6,.1)',  color: '#d97706' } :
    patient.cond === 'DM'     ? { bg: 'rgba(13,110,135,.1)', color: '#0d6e87' } :
                                { bg: 'rgba(220,38,38,.1)',  color: '#dc2626' };

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        borderRadius: 7,
        border: selected
          ? '1.5px solid #0d6e87'
          : done
          ? '1.5px solid rgba(22,163,74,.25)'
          : walkIn
          ? '1.5px dashed rgba(124,58,237,.35)'
          : '1.5px solid rgba(191,200,205,.35)',
        background: selected
          ? 'rgba(13,110,135,.06)'
          : done
          ? 'rgba(22,163,74,.04)'
          : walkIn
          ? 'rgba(124,58,237,.03)'
          : '#fff',
        cursor: 'pointer',
        transition: 'all .12s',
        marginBottom: 5,
        position: 'relative',
      }}
    >
      {/* Done tick */}
      {done && (
        <div style={{
          position: 'absolute', top: 4, right: 6,
          fontSize: 9, color: '#16a34a', fontWeight: 800,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}><Check size={9} /></div>
      )}
      {walkIn && !done && (
        <div style={{
          position: 'absolute', top: 4, right: 6,
          fontSize: 8, color: '#7c3aed', fontWeight: 700,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif", textTransform: 'uppercase', letterSpacing: '.3px',
          display: 'inline-flex', alignItems: 'center', gap: 2
        }}><User size={8} /> walk-in</div>
      )}

      {/* Code tag */}
      <div style={{
        fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", fontWeight: 700,
        fontSize: 10, color: done ? '#516169' : '#005469',
        background: done ? 'rgba(191,200,205,.2)' : 'rgba(0,84,105,.08)',
        padding: '2px 6px', borderRadius: 4, flexShrink: 0,
        textDecoration: done ? 'line-through' : 'none',
      }}>
        {patient.code}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontWeight: 600, color: done ? '#6f797d' : '#0f1f26',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {patient.age}y · {patient.sex}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 8, fontWeight: 800, padding: '1px 5px',
            borderRadius: 9999, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            textTransform: 'uppercase', letterSpacing: '.3px',
            background: condColor.bg, color: condColor.color,
          }}>
            {patient.cond}
          </span>
          {lv?.sbp && lv?.dbp && (
            <span style={{ fontSize: 9, fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace", color: '#516169' }}>
              {lv.sbp}/{lv.dbp}
            </span>
          )}
        </div>
      </div>

      {/* Action button */}
      {!done && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onVisit(); }}
          style={{
            padding: '4px 9px', borderRadius: 5, flexShrink: 0,
            background: walkIn
              ? 'linear-gradient(135deg,#7c3aed,#5b21b6)'
              : 'linear-gradient(135deg,#0d6e87,#005469)',
            color: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 9,
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px',
            boxShadow: walkIn
              ? '0 2px 6px rgba(124,58,237,.3)'
              : '0 2px 6px rgba(13,110,135,.3)',
          }}
        >
          {walkIn ? 'Walk-in' : '+ Visit'}
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TODAY'S QUEUE PANEL
// ══════════════════════════════════════════════════════════════
function TodaysQueue({
  visible,
  selectedId,
  onSelect,
}: {
  visible:    Patient[];
  selectedId: number | null;
  onSelect:   (id: number) => void;
}) {
  const openVisitModal  = useUIStore((s) => s.openVisitModal);
  const clinicSettings  = useUIStore((s) => s.clinicSettings);
  const [qSearch, setQSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const today = todayISO();

  // ── Compute who is scheduled today ──────────────────────────
  const { expected, completed } = useMemo(() => {
    const active = visible.filter(p => p.status === 'active');
    const exp: Patient[] = [];
    const done: Patient[] = [];

    for (const p of active) {
      // Was visited today?
      const seenToday = (p.visits ?? []).some(v => v.att && v.date === today);

      // Is their next appointment today?
      const nextD = getPatientNextVisitDate(p, clinicSettings);
      const nextISO = nextD.toISOString().split('T')[0];
      const dueToday = nextISO === today;

      if (dueToday) {
        if (seenToday) done.push(p);
        else exp.push(p);
      } else if (seenToday) {
        // Seen today even if not "scheduled" (walk-in recorded via visit modal)
        done.push(p);
      }
    }

    // Sort expected: selected first, then by code
    exp.sort((a, b) => {
      if (a.id === selectedId) return -1;
      if (b.id === selectedId) return 1;
      return a.code.localeCompare(b.code);
    });

    return { expected: exp, completed: done };
  }, [visible, clinicSettings, today, selectedId]);

  const totalToday = expected.length + completed.length;

  // ── Queue search: last-4-digits or full code ─────────────────
  const q = qSearch.trim().toLowerCase();

  const filteredExpected  = !q ? expected  : expected.filter(p  => p.code.toLowerCase().includes(q));
  const filteredCompleted = !q ? completed : completed.filter(p => p.code.toLowerCase().includes(q));

  // ── Walk-in fallback: search matched nothing in queue ────────
  const showWalkin = q.length >= 2 && filteredExpected.length === 0 && filteredCompleted.length === 0;

  // All patients (including other hospitals for search)
  const allActivePatients = usePatientStore(s => s.patients);
  const walkInResults = useMemo(() => {
    if (!showWalkin) return [];
    return allActivePatients
      .filter(p => p.status === 'active' && p.code.toLowerCase().includes(q))
      .slice(0, 5);
  }, [showWalkin, allActivePatients, q]);

  // Don't render panel if nobody is scheduled today AND no search active
  if (totalToday === 0 && !q) return null;

  const pct = totalToday > 0 ? Math.round((completed.length / totalToday) * 100) : 0;

  return (
    <div style={{
      background: '#fff',
      border: '1.5px solid rgba(13,110,135,.2)',
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(13,110,135,.08)',
    }}>
      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'linear-gradient(135deg,#0f1f26 0%,#005469 100%)',
          border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center' }}><Calendar size={14} /></span>
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 800,
              fontSize: 11, color: '#fff',
              textTransform: 'uppercase', letterSpacing: '.5px',
            }}>
              Today's Queue
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.6)', marginTop: 1 }}>
              {completed.length}/{totalToday} seen · {pct}% done
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mini progress ring */}
          <svg width={28} height={28} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={14} cy={14} r={11} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={3} />
            <circle cx={14} cy={14} r={11} fill="none" stroke="#16a34a" strokeWidth={3}
              strokeDasharray={2 * Math.PI * 11}
              strokeDashoffset={2 * Math.PI * 11 * (1 - pct / 100)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset .5s ease' }}
            />
          </svg>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>
            {collapsed ? '▼' : '▲'}
          </span>
        </div>
      </button>

      {/* Progress bar */}
      {!collapsed && totalToday > 0 && (
        <div style={{ height: 3, background: 'rgba(191,200,205,.2)' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg,#0d6e87,#16a34a)',
            transition: 'width .5s ease',
            minWidth: completed.length > 0 ? 4 : 0,
          }} />
        </div>
      )}

      {!collapsed && (
        <div style={{ padding: '10px 10px 8px' }}>
          {/* ── Search ── */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <span style={{
              position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
              fontSize: 11, color: '#6f797d', pointerEvents: 'none',
              display: 'inline-flex', alignItems: 'center'
            }}>
              <Search size={11} />
            </span>
            <input
              ref={searchRef}
              type="text"
              placeholder="Last 4 digits or full code…"
              value={qSearch}
              onChange={e => setQSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '7px 10px 7px 26px',
                border: '1.5px solid rgba(191,200,205,.5)',
                borderRadius: 6, fontSize: 12,
                fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
                color: '#0f1f26', outline: 'none',
                background: '#fafcfd',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#0d6e87')}
              onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(191,200,205,.5)')}
            />
            {qSearch && (
              <button
                type="button"
                onClick={() => setQSearch('')}
                style={{
                  position: 'absolute', right: 6, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  cursor: 'pointer', color: '#6f797d', fontSize: 13,
                }}
              >×</button>
            )}
          </div>

          {/* ── Walk-in fallback ── */}
          {showWalkin && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '.4px',
                color: '#7c3aed', marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <User size={9} /> Walk-in Match
              </div>
              {walkInResults.length === 0 ? (
                <div style={{ fontSize: 11, color: '#6f797d', textAlign: 'center', padding: '8px 0', fontStyle: 'italic' }}>
                  No patient found with "{qSearch}"
                </div>
              ) : (
                walkInResults.map(p => (
                  <QueueCard
                    key={p.id}
                    patient={p}
                    done={false}
                    selected={p.id === selectedId}
                    onSelect={() => onSelect(p.id)}
                    onVisit={() => { onSelect(p.id); openVisitModal(p.id); }}
                    walkIn
                  />
                ))
              )}
            </div>
          )}

          {/* ── Expected section ── */}
          {!showWalkin && (
            <>
              {filteredExpected.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{
                    fontSize: 9, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '.4px',
                    color: '#d97706', marginBottom: 5,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#d97706', display: 'inline-block',
                      animation: 'qpulse 1.5s ease-in-out infinite',
                    }} />
                    Waiting · {filteredExpected.length}
                  </div>
                  {filteredExpected.map(p => (
                    <QueueCard
                      key={p.id}
                      patient={p}
                      done={false}
                      selected={p.id === selectedId}
                      onSelect={() => onSelect(p.id)}
                      onVisit={() => { onSelect(p.id); openVisitModal(p.id); }}
                    />
                  ))}
                </div>
              )}

              {/* ── Completed section ── */}
              {filteredCompleted.length > 0 && (
                <div>
                  <div style={{
                fontSize: 9, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '.4px',
                color: '#16a34a', marginBottom: 5,
                display: 'inline-flex', alignItems: 'center', gap: 4
              }}>
                <Check size={9} /> Seen · {filteredCompleted.length}
              </div>
                  {filteredCompleted.map(p => (
                    <QueueCard
                      key={p.id}
                      patient={p}
                      done
                      selected={p.id === selectedId}
                      onSelect={() => onSelect(p.id)}
                      onVisit={() => openVisitModal(p.id)}
                    />
                  ))}
                </div>
              )}

              {/* ── Empty search result ── */}
              {q && filteredExpected.length === 0 && filteredCompleted.length === 0 && !showWalkin && (
                <div style={{ fontSize: 11, color: '#6f797d', textAlign: 'center', padding: '8px 0', fontStyle: 'italic' }}>
                  Not in today's queue
                </div>
              )}

              {/* ── All done! ── */}
              {!q && expected.length === 0 && completed.length > 0 && (
                <div style={{
                  textAlign: 'center', padding: '6px 0',
                  fontSize: 11, color: '#16a34a', fontWeight: 700,
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center'
                }}>
                  <PartyPopper size={11} /> All patients seen today!
                </div>
              )}
            </>
          )}
        </div>
      )}

      <style>{`@keyframes qpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.5)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN SIDEBAR — unchanged layout, queue injected at top
// ══════════════════════════════════════════════════════════════
export default function PatientSidebar() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const patients    = usePatientStore((s) => s.patients);
  const selectedId  = usePatientStore((s) => s.selectedId);
  const filter      = usePatientStore((s) => s.filter);
  const searchQuery = usePatientStore((s) => s.searchQuery);

  const setFilter     = usePatientStore((s) => s.setFilter);
  const setSearch     = usePatientStore((s) => s.setSearch);
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
      {/* Registration form — unchanged */}
      <RegisterForm />

      {/* ── TODAY'S QUEUE (new, injected above existing list) ── */}
      <TodaysQueue
        visible={visiblePatients}
        selectedId={selectedId}
        onSelect={selectPatient}
      />

      {/* ── Search + filters — IDENTICAL to before ── */}
      <div className="rounded-xl bg-white border border-slate-200 p-3">
        <div className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1">
          Search
        </div>
        <input
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code, phone or address"
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
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
                  'px-2 py-1 rounded-full border text-[10px] uppercase font-bold tracking-wider',
                  isActive
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-600'
                    : 'bg-white border-slate-200 text-slate-800',
                ].join(' ')}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Patient list — IDENTICAL to before ── */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200">
          <div className="text-xs uppercase font-bold tracking-wider text-slate-500">
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
            <div className="p-4 text-slate-500 text-[13px] text-center">
              No patients match your filters.
            </div>
          )}
        </div>
      </div>

      {selectedPatient ? null : null}
    </div>
  );
}
