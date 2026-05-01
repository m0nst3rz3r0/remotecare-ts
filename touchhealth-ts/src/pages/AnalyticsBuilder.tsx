// ════════════════════════════════════════════════════════════
// REMOTECARE · src/pages/AnalyticsBuilder.tsx
//
// Customisable analytics builder for the Trends tab.
// Users pick 1–2 metrics, a timeframe, and an optional
// region/district scope. The chart re-renders live.
//
// Architecture:
//  - All computation is pure (useMemo), zero side-effects.
//  - Chart data flows: params → computeSeries() → Chart.js
//  - TODO markers show where to swap local data for API calls.
// ════════════════════════════════════════════════════════════

import React, { useMemo, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { usePatientStore } from '../store/usePatientStore';
import { TZ_GEO }         from '../utils/geo';
import { getMonthlyStats } from '../services/clinical';
import type { Patient, Visit } from '../types';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler,
);

// ── Types ────────────────────────────────────────────────────

type MetricId =
  | 'enrolment'
  | 'bp_control'
  | 'attendance'
  | 'treatment_rate'
  | 'polypharmacy'
  | 'ltfu_rate'
  | 'dm_patients'
  | 'htn_patients'
  | 'htn_drug_combo'
  | 'dm_drug_combo'
  | 'bp_by_drug'
  | 'sugar_by_drug'
  | 'combo_therapy_rate'
  | 'drug_class_coverage';

type ChartType = 'line' | 'bar';

interface MetricDef {
  id:    MetricId;
  label: string;
  color: string;
  fill:  string;
  unit:  string;
  type:  ChartType;
  group: 'core' | 'drugs' | 'clinical';
}

// ── Metric catalogue ─────────────────────────────────────────

const METRICS: MetricDef[] = [
  // Core
  { id: 'enrolment',         label: 'Enrolment Velocity',       color: '#10b981', fill: 'rgba(16,185,129,0.12)',  unit: 'count', type: 'bar',  group: 'core'     },
  { id: 'bp_control',        label: 'BP Control Rate',           color: '#1a56db', fill: 'rgba(26,86,219,0.12)',   unit: '%',     type: 'line', group: 'core'     },
  { id: 'attendance',        label: 'Attendance Rate',            color: '#8b5cf6', fill: 'rgba(139,92,246,0.12)', unit: '%',     type: 'line', group: 'core'     },
  { id: 'ltfu_rate',         label: 'LTFU Rate',                 color: '#ef4444', fill: 'rgba(239,68,68,0.12)',  unit: '%',     type: 'line', group: 'core'     },
  { id: 'dm_patients',       label: 'Active DM Patients',        color: '#06b6d4', fill: 'rgba(6,182,212,0.12)',  unit: 'count', type: 'bar',  group: 'core'     },
  { id: 'htn_patients',      label: 'Active HTN Patients',       color: '#ec4899', fill: 'rgba(236,72,153,0.12)', unit: 'count', type: 'bar',  group: 'core'     },
  // Drug analytics
  { id: 'treatment_rate',    label: 'Treatment Rate',            color: '#f59e0b', fill: 'rgba(245,158,11,0.12)', unit: '%',     type: 'line', group: 'drugs'    },
  { id: 'polypharmacy',      label: 'Polypharmacy Rate (≥2)',    color: '#f97316', fill: 'rgba(249,115,22,0.12)', unit: '%',     type: 'line', group: 'drugs'    },
  { id: 'combo_therapy_rate',label: 'Combination Therapy Rate',  color: '#a78bfa', fill: 'rgba(167,139,250,0.12)',unit: '%',     type: 'line', group: 'drugs'    },
  { id: 'drug_class_coverage',label:'Drug Class Coverage',       color: '#34d399', fill: 'rgba(52,211,153,0.12)', unit: '%',     type: 'bar',  group: 'drugs'    },
  // Clinical outcomes by drug
  { id: 'bp_by_drug',        label: 'BP Control by Drug',        color: '#0ea5e9', fill: 'rgba(14,165,233,0.12)', unit: '%',     type: 'bar',  group: 'clinical' },
  { id: 'sugar_by_drug',     label: 'Sugar Control by Drug',     color: '#d946ef', fill: 'rgba(217,70,239,0.12)', unit: '%',     type: 'bar',  group: 'clinical' },
  { id: 'htn_drug_combo',    label: 'HTN Drug Combinations',     color: '#64748b', fill: 'rgba(100,116,139,0.12)',unit: 'count', type: 'bar',  group: 'clinical' },
  { id: 'dm_drug_combo',     label: 'DM Drug Combinations',      color: '#78716c', fill: 'rgba(120,113,108,0.12)',unit: 'count', type: 'bar',  group: 'clinical' },
];

// ── Drug class detection helpers ─────────────────────────────

const HTN_CLASSES: Record<string, string[]> = {
  'ACE Inhibitor':  ['enalapril','lisinopril','captopril','ramipril','perindopril'],
  'ARB':            ['losartan','valsartan','irbesartan','candesartan','telmisartan'],
  'CCB':            ['amlodipine','nifedipine','felodipine','diltiazem','verapamil'],
  'Diuretic':       ['hydrochlorothiazide','furosemide','spironolactone','indapamide','chlorthalidone','hctz'],
  'Beta-blocker':   ['atenolol','metoprolol','bisoprolol','carvedilol','propranolol'],
  'Alpha-blocker':  ['doxazosin','prazosin','terazosin'],
};

const DM_CLASSES: Record<string, string[]> = {
  'Metformin':      ['metformin'],
  'Sulfonylurea':   ['glibenclamide','gliclazide','glimepiride','glipizide','tolbutamide'],
  'Insulin':        ['insulin','mixtard','actrapid','lantus','novomix','humulin','novorapid'],
  'SGLT2i':         ['dapagliflozin','empagliflozin','canagliflozin'],
  'DPP-4i':         ['sitagliptin','saxagliptin','alogliptin','linagliptin'],
  'GLP-1':          ['semaglutide','liraglutide','dulaglutide','exenatide'],
};

function detectClass(medName: string, classes: Record<string, string[]>): string | null {
  const lower = medName.toLowerCase();
  for (const [cls, drugs] of Object.entries(classes)) {
    if (drugs.some(d => lower.includes(d))) return cls;
  }
  return null;
}

function getLastVisitMeds(patient: Patient): string[] {
  const visits = [...(patient.visits ?? [])].sort((a, b) =>
    new Date(b.date ?? '').getTime() - new Date(a.date ?? '').getTime()
  );
  const last = visits.find(v => v.att && (v.meds ?? []).length > 0);
  return (last?.meds ?? []).map(m => m.name ?? '');
}

function getVisitMeds(visit: Visit): string[] {
  return (visit.meds ?? []).map(m => m.name ?? '');
}

// ── Bar chart data for drug/combo breakdowns ──────────────────

interface BarData { label: string; value: number; color: string; }

function computeBarData(metricId: MetricId, patients: Patient[]): BarData[] | null {
  const COLORS = ['#1a56db','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316','#a78bfa','#34d399'];

  if (metricId === 'drug_class_coverage') {
    const all = patients.filter(p => p.status === 'active' || p.status === 'completed');
    if (!all.length) return null;
    const allClasses = { ...HTN_CLASSES, ...DM_CLASSES };
    return Object.keys(allClasses).map((cls, i) => ({
      label: cls,
      value: Math.round(
        (all.filter(p => getLastVisitMeds(p).some(m => detectClass(m, allClasses) === cls)).length / all.length) * 100
      ),
      color: COLORS[i % COLORS.length],
    }));
  }

  if (metricId === 'bp_by_drug') {
    const htnPts = patients.filter(p => p.cond === 'HTN' || p.cond === 'DM+HTN');
    if (!htnPts.length) return null;
    return Object.keys(HTN_CLASSES).map((cls, i) => {
      const onDrug = htnPts.filter(p => getLastVisitMeds(p).some(m => detectClass(m, HTN_CLASSES) === cls));
      if (!onDrug.length) return { label: cls, value: 0, color: COLORS[i] };
      const controlled = onDrug.filter(p => {
        const last = [...(p.visits ?? [])].sort((a,b) => new Date(b.date??'').getTime()-new Date(a.date??'').getTime()).find(v=>v.att&&v.sbp);
        return last && last.sbp! < 140 && last.dbp! < 90;
      });
      return { label: cls, value: Math.round((controlled.length / onDrug.length) * 100), color: COLORS[i] };
    }).filter(d => d.value > 0 || patients.some(p => getLastVisitMeds(p).some(m => detectClass(m, HTN_CLASSES) === d.label)));
  }

  if (metricId === 'sugar_by_drug') {
    const dmPts = patients.filter(p => p.cond === 'DM' || p.cond === 'DM+HTN');
    if (!dmPts.length) return null;
    return Object.keys(DM_CLASSES).map((cls, i) => {
      const onDrug = dmPts.filter(p => getLastVisitMeds(p).some(m => detectClass(m, DM_CLASSES) === cls));
      if (!onDrug.length) return null;
      const controlled = onDrug.filter(p => {
        const last = [...(p.visits ?? [])].sort((a,b) => new Date(b.date??'').getTime()-new Date(a.date??'').getTime()).find(v=>v.att&&v.sugar!=null);
        return last && last.sugar! < 7;
      });
      return { label: cls, value: Math.round((controlled.length / onDrug.length) * 100), color: COLORS[i] };
    }).filter(Boolean) as BarData[];
  }

  if (metricId === 'htn_drug_combo') {
    const htnPts = patients.filter(p => (p.cond === 'HTN' || p.cond === 'DM+HTN') && (p.status === 'active' || p.status === 'completed'));
    if (!htnPts.length) return null;
    const comboCounts = new Map<string, number>();
    htnPts.forEach(p => {
      const meds = getLastVisitMeds(p);
      const classes = [...new Set(meds.map(m => detectClass(m, HTN_CLASSES)).filter(Boolean))].sort();
      if (!classes.length) return;
      const key = classes.length === 1 ? classes[0]! : classes.join(' + ');
      comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1);
    });
    return Array.from(comboCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
  }

  if (metricId === 'dm_drug_combo') {
    const dmPts = patients.filter(p => (p.cond === 'DM' || p.cond === 'DM+HTN') && (p.status === 'active' || p.status === 'completed'));
    if (!dmPts.length) return null;
    const comboCounts = new Map<string, number>();
    dmPts.forEach(p => {
      const meds = getLastVisitMeds(p);
      const classes = [...new Set(meds.map(m => detectClass(m, DM_CLASSES)).filter(Boolean))].sort();
      if (!classes.length) return;
      const key = classes.length === 1 ? classes[0]! : classes.join(' + ');
      comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1);
    });
    return Array.from(comboCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
  }

  return null;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FONT   = "'Inter', system-ui, -apple-system, sans-serif";

// ── Series computation ───────────────────────────────────────

function computeSeries(
  metricId: MetricId,
  patients: Patient[],
  year: number,
): (number | null)[] {
  return MONTHS.map((_, i) => {
    const m = i + 1;

    switch (metricId) {
      case 'enrolment':
        return patients.filter((p) => {
          if (!p.enrol) return false;
          const d = new Date(p.enrol);
          return d.getFullYear() === year && d.getMonth() + 1 === m;
        }).length;

      case 'bp_control': {
        const stats = getMonthlyStats(
          patients.filter((p: Patient) =>
            p.visits?.some((v: Visit) => +v.month === m && +(v.year ?? year) === year),
          ),
          m,
        );
        return stats.bpControlRate;
      }

      case 'attendance': {
        const visits = patients
          .flatMap((p) => p.visits ?? [])
          .filter((v: Visit) => +v.month === m && +(v.year ?? year) === year);
        if (!visits.length) return null;
        return Math.round((visits.filter((v: Visit) => v.att).length / visits.length) * 100);
      }

      case 'treatment_rate': {
        const active = patients.filter(p => p.status === 'active' || p.status === 'completed');
        if (!active.length) return null;
        // % of active patients who received any medication in this month
        const onTreatment = active.filter(p =>
          p.visits?.some(v => +v.month === m && +(v.year ?? year) === year && v.att && (v.meds ?? []).length > 0)
        );
        return Math.round((onTreatment.length / active.length) * 100);
      }

      case 'polypharmacy': {
        const attended = patients
          .flatMap((p) => p.visits ?? [])
          .filter((v: Visit) => +v.month === m && +(v.year ?? year) === year && v.att);
        if (!attended.length) return null;
        return Math.round(
          (attended.filter((v: Visit) => (v.meds ?? []).length >= 2).length / attended.length) * 100
        );
      }

      case 'combo_therapy_rate': {
        const attended = patients
          .flatMap((p) => p.visits ?? [])
          .filter((v: Visit) => +v.month === m && +(v.year ?? year) === year && v.att);
        if (!attended.length) return null;
        const withCombo = attended.filter((v: Visit) => {
          const meds = getVisitMeds(v);
          const allClasses = { ...HTN_CLASSES, ...DM_CLASSES };
          const classes = new Set(meds.map(med => detectClass(med, allClasses)).filter(Boolean));
          return classes.size >= 2;
        });
        return Math.round((withCombo.length / attended.length) * 100);
      }

      case 'ltfu_rate': {
        const active = patients.filter((p) => {
          const d = new Date(p.enrol ?? '');
          return d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() + 1 <= m);
        });
        if (!active.length) return null;
        return Math.round((active.filter((p) => p.status === 'ltfu').length / active.length) * 100);
      }

      case 'dm_patients':
        return patients.filter((p: Patient) =>
          (p.cond === 'DM' || p.cond === 'DM+HTN') &&
          p.status === 'active' &&
          p.visits?.some((v: Visit) => +v.month === m && +(v.year ?? year) === year),
        ).length || null;

      case 'htn_patients':
        return patients.filter((p: Patient) =>
          (p.cond === 'HTN' || p.cond === 'DM+HTN') &&
          p.status === 'active' &&
          p.visits?.some((v: Visit) => +v.month === m && +(v.year ?? year) === year),
        ).length || null;

      // These metrics use bar charts with category labels — return null for time series
      case 'drug_class_coverage':
      case 'bp_by_drug':
      case 'sugar_by_drug':
      case 'htn_drug_combo':
      case 'dm_drug_combo':
        return null;

      default:
        return null;
    }
  });
}

// ── Small UI atoms ───────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Select({
  value, onChange, children, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: '100%', padding: '8px 10px',
        border: '1px solid #e2e8f0', borderRadius: 8,
        fontFamily: FONT, fontSize: 13, color: '#1e293b',
        background: disabled ? '#f8fafc' : 'rgba(255,255,255,0.85)',
        outline: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: 30,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = '#1a56db'; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
    >
      {children}
    </select>
  );
}

function MetricPill({
  metric, active, onClick,
}: {
  metric: MetricDef; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 9999,
        fontFamily: FONT, fontSize: 12, fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.15s',
        background: active ? metric.color : 'rgba(255,255,255,0.7)',
        color:      active ? '#fff'        : '#475569',
        border:     `1.5px solid ${active ? metric.color : '#e2e8f0'}`,
        boxShadow:  active ? `0 2px 8px ${metric.fill}` : 'none',
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#fff' : metric.color, flexShrink: 0 }} />
      {metric.label}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────

interface AnalyticsBuilderProps {
  /** Patients already scoped by the parent (region/district filter applied) */
  scopedPatients: Patient[];
  scopeLabel: string;
  /** Whether current user is superadmin (shows region/district filters) */
  isSuperAdmin: boolean;
}

export default function AnalyticsBuilder({
  scopedPatients,
  scopeLabel,
  isSuperAdmin,
}: AnalyticsBuilderProps) {
  const allPatients = usePatientStore((s: { patients: Patient[] }) => s.patients);

  // ── Parameters state ────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const [year,       setYear]       = useState(currentYear);
  const [yearB,      setYearB]      = useState(currentYear - 1); // comparison year
  const [compare,    setCompare]    = useState(false);           // year-over-year toggle
  const [metricA,    setMetricA]    = useState<MetricId>('enrolment');
  const [metricB,    setMetricB]    = useState<MetricId>('bp_control');
  const [showSecond, setShowSecond] = useState(false);

  // Inline region/district scoping (superadmin only — regular admin always uses their scope)
  const [region,   setRegion]   = useState('');
  const [district, setDistrict] = useState('');

  const allRegions = useMemo(() => Object.keys(TZ_GEO).sort(), []);
  const districtOptions = useMemo(() => region ? TZ_GEO[region] ?? [] : [], [region]);

  // ── Patient scope ───────────────────────────────────────────
  // TODO: replace with API call when patients are fetched remotely
  //   e.g. GET /api/patients?region=X&district=Y&year=Z
  const patients = useMemo(() => {
    if (!isSuperAdmin) return scopedPatients;
    if (!region && !district) return allPatients;
    return allPatients.filter((p: Patient) =>
      (!region   || p.region   === region) &&
      (!district || p.district === district),
    );
  }, [isSuperAdmin, scopedPatients, allPatients, region, district]);

  const displayScope = useMemo(() => {
    if (isSuperAdmin) {
      if (district) return `${region} · ${district}`;
      if (region)   return region;
      return 'All Regions';
    }
    return scopeLabel;
  }, [isSuperAdmin, region, district, scopeLabel]);

  // ── Series computation ──────────────────────────────────────
  // TODO: swap computeSeries() with API call when data is remote
  //   e.g. GET /api/analytics?metric=bp_control&year=2024&region=X
  const seriesA     = useMemo(() => computeSeries(metricA, patients, year),      [metricA, patients, year]);
  const seriesB     = useMemo(() => computeSeries(metricB, patients, year),      [metricB, patients, year]);
  const seriesAComp = useMemo(() => computeSeries(metricA, patients, yearB),     [metricA, patients, yearB]);
  const seriesBComp = useMemo(() => computeSeries(metricB, patients, yearB),     [metricB, patients, yearB]);

  // Bar data for drug/combo breakdown metrics
  const barDataA = useMemo(() => computeBarData(metricA, patients), [metricA, patients]);

  const isBarMetric = (id: MetricId) =>
    ['drug_class_coverage','bp_by_drug','sugar_by_drug','htn_drug_combo','dm_drug_combo'].includes(id);

  const defA = METRICS.find((m) => m.id === metricA)!;
  const defB = METRICS.find((m) => m.id === metricB)!;

  // ── Chart datasets ──────────────────────────────────────────
  const datasets = useMemo(() => {
    const ds = [
      {
        label: `${defA.label} (${year})`,
        data:  seriesA,
        borderColor:     defA.color,
        backgroundColor: defA.fill,
        fill: defA.type === 'bar',
        tension: 0.3, spanGaps: true, pointRadius: 4, pointHoverRadius: 6,
        borderWidth: 2,
        type: defA.type,
        yAxisID: 'yA',
        order: 2,
      } as any,
    ];

    if (compare) {
      ds.push({
        label: `${defA.label} (${yearB})`,
        data:  seriesAComp,
        borderColor:     defA.color,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3, spanGaps: true, pointRadius: 3,
        borderDash: [5, 4],
        borderWidth: 1.5,
        type: 'line',
        yAxisID: 'yA',
        order: 1,
      } as any);
    }

    if (showSecond) {
      ds.push({
        label: `${defB.label} (${year})`,
        data:  seriesB,
        borderColor:     defB.color,
        backgroundColor: defB.fill,
        fill: defB.type === 'bar',
        tension: 0.3, spanGaps: true, pointRadius: 4, pointHoverRadius: 6,
        borderWidth: 2,
        type: defB.type,
        yAxisID: 'yB',
        order: 3,
      } as any);

      if (compare) {
        ds.push({
          label: `${defB.label} (${yearB})`,
          data:  seriesBComp,
          borderColor:     defB.color,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3, spanGaps: true, pointRadius: 3,
          borderDash: [5, 4],
          borderWidth: 1.5,
          type: 'line',
          yAxisID: 'yB',
          order: 0,
        } as any);
      }
    }

    return ds;
  }, [seriesA, seriesB, seriesAComp, seriesBComp, defA, defB, year, yearB, compare, showSecond]);

  // ── Summary stats ───────────────────────────────────────────
  const summaryA = useMemo(() => {
    const vals = seriesA.filter((v): v is number => v !== null);
    if (!vals.length) return { avg: null, peak: null, trend: null };
    const avg  = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    const peak = Math.max(...vals);
    const trend = vals.length >= 2 ? vals[vals.length - 1] - vals[0] : null;
    return { avg, peak, trend };
  }, [seriesA]);

  const summaryB = useMemo(() => {
    if (!showSecond) return null;
    const vals = seriesB.filter((v): v is number => v !== null);
    if (!vals.length) return { avg: null, peak: null, trend: null };
    const avg  = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    const peak = Math.max(...vals);
    const trend = vals.length >= 2 ? vals[vals.length - 1] - vals[0] : null;
    return { avg, peak, trend };
  }, [seriesB, showSecond]);

  // ── Chart options ───────────────────────────────────────────
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          font:  { family: FONT, size: 11, weight: '500' as any },
          color: '#475569',
          boxWidth: 12, boxHeight: 12, borderRadius: 3,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15,31,38,0.92)',
        titleFont:  { family: FONT, size: 12, weight: '600' as any },
        bodyFont:   { family: FONT, size: 12 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed.y;
            if (val === null || val === undefined) return '';
            const unit = ctx.dataset.yAxisID === 'yB' ? defB.unit : defA.unit;
            return ` ${ctx.dataset.label}: ${val}${unit === '%' ? '%' : ''}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid:  { color: 'rgba(0,0,0,0.04)' },
        ticks: { font: { family: FONT, size: 11 }, color: '#94a3b8' },
      },
      yA: {
        type:      'linear' as const,
        position:  'left'   as const,
        beginAtZero: true,
        ...(defA.unit === '%' ? { max: 100 } : {}),
        grid:  { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          font:     { family: FONT, size: 11 },
          color:    defA.color,
          callback: (v: any) => defA.unit === '%' ? `${v}%` : v,
        },
      },
      ...(showSecond ? {
        yB: {
          type:      'linear' as const,
          position:  'right'  as const,
          beginAtZero: true,
          ...(defB.unit === '%' ? { max: 100 } : {}),
          grid: { drawOnChartArea: false },
          ticks: {
            font:     { family: FONT, size: 11 },
            color:    defB.color,
            callback: (v: any) => defB.unit === '%' ? `${v}%` : v,
          },
        },
      } : {}),
    },
  }), [defA, defB, showSecond]);

  const chartData = useMemo(() => ({ labels: MONTHS, datasets }), [datasets]);

  // ── Toggle helpers ──────────────────────────────────────────
  const toggleSecond = useCallback(() => {
    setShowSecond((s) => !s);
  }, []);

  // ── Render ──────────────────────────────────────────────────
  const CARD: React.CSSProperties = {
    background:           'rgba(255,255,255,0.78)',
    backdropFilter:       'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    borderRadius:         12,
    border:               '1px solid rgba(255,255,255,0.78)',
    boxShadow:            '0 2px 12px rgba(0,0,0,0.06)',
    padding:              20,
    marginBottom:         16,
  };

  return (
    <div>

      {/* ── Controls card ─────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>

          {/* Year selector */}
          <div style={{ minWidth: 110 }}>
            <Label>Year</Label>
            <Select value={String(year)} onChange={(v) => setYear(Number(v))}>
              {Array.from({ length: 6 }, (_, i) => currentYear - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>

          {/* Compare year */}
          <div style={{ minWidth: 150 }}>
            <Label>Compare to year</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Select value={String(yearB)} onChange={(v) => setYearB(Number(v))} disabled={!compare}>
                {Array.from({ length: 6 }, (_, i) => currentYear - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
              <button
                onClick={() => setCompare((c) => !c)}
                style={{
                  flexShrink: 0,
                  padding: '8px 10px', borderRadius: 8,
                  fontFamily: FONT, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: compare ? '#1a56db' : 'rgba(255,255,255,0.85)',
                  color:      compare ? '#fff'    : '#64748b',
                  border:     `1.5px solid ${compare ? '#1a56db' : '#e2e8f0'}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {compare ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          {/* Superadmin: region/district inline filter */}
          {isSuperAdmin && (
            <>
              <div style={{ minWidth: 160 }}>
                <Label>Region</Label>
                <Select value={region} onChange={(v) => { setRegion(v); setDistrict(''); }}>
                  <option value="">All Regions</option>
                  {allRegions.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </div>
              <div style={{ minWidth: 160 }}>
                <Label>District</Label>
                <Select value={district} onChange={setDistrict} disabled={!region}>
                  <option value="">All Districts</option>
                  {districtOptions.map((d: string) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
            </>
          )}

          {/* Scope pill */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <div style={{
              padding: '6px 14px', borderRadius: 9999,
              background: 'rgba(26,86,219,0.08)',
              border: '1px solid rgba(26,86,219,0.2)',
              fontFamily: FONT, fontSize: 11, fontWeight: 600, color: '#1a56db',
            }}>
              {displayScope}
            </div>
          </div>
        </div>
      </div>

      {/* ── Metric picker ─────────────────────────────────── */}
      <div style={{ ...CARD, padding: '16px 20px' }}>
        <div style={{ marginBottom: 10 }}>
          <Label>Primary metric</Label>
          {(['core','drugs','clinical'] as const).map(grp => (
            <div key={grp} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 5 }}>
                {grp === 'core' ? 'Core' : grp === 'drugs' ? 'Drug Analytics' : 'Clinical Outcomes by Drug'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {METRICS.filter(m => m.group === grp).map((m) => (
                  <MetricPill key={m.id} metric={m} active={metricA === m.id} onClick={() => setMetricA(m.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {!isBarMetric(metricA) && (
            <button
              onClick={toggleSecond}
              style={{
                padding: '6px 14px', borderRadius: 9999,
                fontFamily: FONT, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
                background: showSecond ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.85)',
                color:      showSecond ? '#8b5cf6'              : '#64748b',
                border:     `1.5px solid ${showSecond ? 'rgba(139,92,246,0.4)' : '#e2e8f0'}`,
              }}
            >
              {showSecond ? '– Remove overlay' : '+ Add overlay metric'}
            </button>
          )}

          {showSecond && !isBarMetric(metricA) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {METRICS.filter((m) => m.id !== metricA && !isBarMetric(m.id)).map((m) => (
                <MetricPill key={m.id} metric={m} active={metricB === m.id} onClick={() => setMetricB(m.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bar breakdown chart (drug/combo metrics) ──────── */}
      {isBarMetric(metricA) && barDataA && barDataA.length > 0 && (
        <div style={CARD}>
          <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
            {defA.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {barDataA.map((d) => (
              <div key={d.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: '#475569', fontWeight: 500 }}>{d.label}</span>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: d.color }}>
                    {d.value}{defA.unit === '%' ? '%' : ' patients'}
                  </span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${defA.unit === '%' ? d.value : Math.round((d.value / Math.max(...barDataA.map(x=>x.value))) * 100)}%`,
                    background: d.color,
                    borderRadius: 9999,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary stats + chart (time-series metrics only) ─ */}
      {!isBarMetric(metricA) && (<>
      {/* ── Summary stats strip ───────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { def: defA, summary: summaryA, label: defA.label },
          ...(showSecond && summaryB ? [{ def: defB, summary: summaryB, label: defB.label }] : []),
        ].map(({ def, summary, label }) => (
          <div key={def.id} style={{ display: 'flex', gap: 12, flex: '1 1 auto', flexWrap: 'wrap' }}>
            {[
              { title: `${label} · Avg`,  value: summary.avg  !== null ? `${summary.avg}${def.unit === '%' ? '%' : ''}` : '—', color: def.color },
              { title: `${label} · Peak`, value: summary.peak !== null ? `${summary.peak}${def.unit === '%' ? '%' : ''}` : '—', color: def.color },
              {
                title: `${label} · Trend`,
                value: summary.trend !== null
                  ? `${summary.trend >= 0 ? '+' : ''}${summary.trend}${def.unit === '%' ? '%' : ''}`
                  : '—',
                color: summary.trend === null ? '#64748b'
                     : summary.trend >= 0     ? '#10b981'
                     : '#ef4444',
              },
            ].map((s) => (
              <div key={s.title} style={{
                flex: '1 1 130px',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(255,255,255,0.75)',
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              }}>
                <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 4 }}>
                  {s.title}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Chart ─────────────────────────────────────────── */}
      <div style={{ ...CARD, padding: '20px 20px 14px' }}>
        <div style={{ width: '100%', height: 340 }}>
          <Line data={chartData as any} options={chartOptions as any} />
        </div>
        <div style={{ marginTop: 10, fontFamily: FONT, fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
          {compare && <span style={{ marginRight: 14 }}>— — dashed = {yearB}</span>}
          Scope: <strong style={{ color: '#64748b' }}>{displayScope}</strong>
        </div>
      </div>
      </>)}

    </div>
  );
}
