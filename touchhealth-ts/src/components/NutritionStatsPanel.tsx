// RCRO NutritionTool — Nutrition Counselling Statistics Panel
// Shows: patients counselled vs not, breakdown by condition, risk level,
// month-by-month trend, and a printable/exportable patient list.

import { useMemo, useState } from 'react';
import { Salad, Download } from 'lucide-react';
import type { Patient } from '../types';

const INK   = '#132b31';
const TEAL  = '#10b981';
const SLATE = '#516169';

const labelStyle: React.CSSProperties = {
  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.5px', color: SLATE, marginBottom: '6px',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
};

// ── helpers ───────────────────────────────────────────────────

/** True if this patient ever received a meal plan on any attended visit */
function hasEverReceivedNutrition(p: Patient): boolean {
  return p.visits.some(v => v.att && v.mealPlan != null);
}

/** ISO date of the most recent meal plan generated for a patient */
function lastNutritionDate(p: Patient): string | null {
  const dates = p.visits
    .filter(v => v.att && v.mealPlan != null)
    .map(v => v.mealPlan!.generatedAt ?? v.date)
    .sort()
    .reverse();
  return dates[0] ?? null;
}

/** Number of meal plans across all visits for a patient */
function mealPlanCount(p: Patient): number {
  return p.visits.filter(v => v.att && v.mealPlan != null).length;
}

// ── stat card ─────────────────────────────────────────────────

function StatCard({
  value, label, sub, color = TEAL,
}: { value: number | string; label: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#f8fafc', border: '1.5px solid rgba(191,200,205,.4)',
      borderRadius: '8px', padding: '14px 16px', flex: 1, minWidth: '130px',
    }}>
      <div style={{
        fontSize: '28px', fontWeight: 900, color,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif", lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: INK, marginTop: '4px', fontFamily: "'Inter', system-ui" }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: '10px', color: SLATE, marginTop: '2px', fontFamily: "'Inter', system-ui" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── mini bar ──────────────────────────────────────────────────

function BarRow({
  label, count, total, color,
}: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '12px', color: INK, fontFamily: "'Inter', system-ui" }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: "'Inter', system-ui" }}>
          {count} <span style={{ fontWeight: 400, color: SLATE }}>/ {total} ({pct}%)</span>
        </span>
      </div>
      <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '9999px', transition: 'width .4s' }} />
      </div>
    </div>
  );
}

// ── export helpers ────────────────────────────────────────────

function downloadCSV(rows: Patient[], filename: string) {
  const header = ['Card No', 'Condition', 'Sex', 'Age', 'Region', 'Counselled', 'Meal Plan Count', 'Last Counselled Date', 'Nutrition Risk'];
  const lines = [header.join(',')];
  for (const p of rows) {
    const counselled = hasEverReceivedNutrition(p) ? 'Yes' : 'No';
    const last = lastNutritionDate(p) ?? '';
    const risk = p.nutritionProfile?.nutritionRiskLevel ?? '';
    lines.push([
      `"${p.code}"`, `"${p.cond}"`, p.sex, p.age,
      `"${p.region}"`, counselled, mealPlanCount(p), `"${last}"`, `"${risk}"`,
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── main component ────────────────────────────────────────────

interface NutritionStatsPanelProps {
  patients: Patient[];
  /** If provided, only show patients from this hospital */
  hospitalFilter?: string;
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function NutritionStatsPanel({ patients, hospitalFilter }: NutritionStatsPanelProps) {
  const [tab, setTab] = useState<'overview' | 'uncounselled' | 'counselled'>('overview');

  const scope = useMemo(() =>
    hospitalFilter ? patients.filter(p => p.hospital === hospitalFilter) : patients,
    [patients, hospitalFilter]
  );

  // Core counts
  const total       = scope.length;
  const counselled  = scope.filter(hasEverReceivedNutrition);
  const uncounselled = scope.filter(p => !hasEverReceivedNutrition(p));
  const coveragePct = total > 0 ? Math.round((counselled.length / total) * 100) : 0;

  // By condition
  const byCond = useMemo(() => {
    const conds = ['DM', 'HTN', 'DM+HTN'] as const;
    return conds.map(c => ({
      label: c,
      total: scope.filter(p => p.cond === c).length,
      counselled: scope.filter(p => p.cond === c && hasEverReceivedNutrition(p)).length,
      color: c === 'DM' ? '#f59e0b' : c === 'HTN' ? '#6366f1' : '#10b981',
    }));
  }, [scope]);

  // By risk level (only for counselled patients who have a stored risk)
  const byRisk = useMemo(() => {
    const risks = [
      { key: 'High',     color: '#dc2626' },
      { key: 'Moderate', color: '#d97706' },
      { key: 'Low',      color: '#10b981' },
    ] as const;
    return risks.map(r => ({
      label: r.key,
      count: counselled.filter(p => p.nutritionProfile?.nutritionRiskLevel === r.key).length,
      color: r.color,
    }));
  }, [counselled]);

  // Month-by-month meal plans generated this year
  const currentYear = new Date().getFullYear();
  const monthlyTrend = useMemo(() => {
    const counts = Array<number>(12).fill(0);
    for (const p of scope) {
      for (const v of p.visits) {
        if (!v.att || !v.mealPlan) continue;
        const d = new Date(v.mealPlan.generatedAt ?? v.date);
        if (d.getFullYear() === currentYear) {
          counts[d.getMonth()]++;
        }
      }
    }
    return counts;
  }, [scope, currentYear]);

  const totalPlansThisYear = monthlyTrend.reduce((a, b) => a + b, 0);
  const peakMonth = monthlyTrend.indexOf(Math.max(...monthlyTrend));

  // Priority uncounselled — sort by risk (if stored) + condition severity
  const priorityUncounselled = useMemo(() => {
    const riskOrder: Record<string, number> = { High: 0, Moderate: 1, Low: 2, '': 3 };
    const condOrder: Record<string, number> = { 'DM+HTN': 0, DM: 1, HTN: 2 };
    return [...uncounselled].sort((a, b) => {
      const ra = riskOrder[a.nutritionProfile?.nutritionRiskLevel ?? ''] ?? 3;
      const rb = riskOrder[b.nutritionProfile?.nutritionRiskLevel ?? ''] ?? 3;
      if (ra !== rb) return ra - rb;
      return (condOrder[a.cond] ?? 3) - (condOrder[b.cond] ?? 3);
    });
  }, [uncounselled]);

  const riskColors: Record<string, string> = { High: '#dc2626', Moderate: '#d97706', Low: '#10b981' };

  const maxMonthly = Math.max(...monthlyTrend, 1);

  return (
    <div style={{ background: '#fff', border: '1px solid rgba(191,200,205,.3)', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>

      {/* Header */}
      <div style={{ background: INK, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Salad size={18} color={TEAL} />
          <div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 800, fontFamily: "'Inter', system-ui" }}>
              Nutrition Counselling Coverage
            </div>
            <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '11px', fontFamily: "'Inter', system-ui" }}>
              {total} patients · {coveragePct}% received meal plan · {currentYear}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => downloadCSV(scope, `rcro_nutrition_stats_${currentYear}.csv`)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', borderRadius: '6px', padding: '5px 11px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', system-ui" }}
          >
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(191,200,205,.3)', background: '#f8fafc' }}>
        {([
          { key: 'overview',      label: 'Overview' },
          { key: 'uncounselled',  label: `Not Counselled (${uncounselled.length})` },
          { key: 'counselled',    label: `Counselled (${counselled.length})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '9px 16px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
            background: 'transparent', fontFamily: "'Inter', system-ui",
            color: tab === t.key ? TEAL : SLATE,
            borderBottom: tab === t.key ? `2px solid ${TEAL}` : '2px solid transparent',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 18px' }}>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <>
            {/* Top stat cards */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
              <StatCard
                value={`${coveragePct}%`}
                label="Nutrition Coverage"
                sub={`${counselled.length} of ${total} patients`}
                color={coveragePct >= 70 ? '#10b981' : coveragePct >= 40 ? '#d97706' : '#dc2626'}
              />
              <StatCard
                value={counselled.length}
                label="Patients Counselled"
                sub="Ever received meal plan"
                color={TEAL}
              />
              <StatCard
                value={uncounselled.length}
                label="Not Yet Counselled"
                sub="No meal plan on record"
                color={uncounselled.length > 0 ? '#d97706' : '#10b981'}
              />
              <StatCard
                value={totalPlansThisYear}
                label="Meal Plans This Year"
                sub={totalPlansThisYear > 0 ? `Peak: ${MONTHS_SHORT[peakMonth]}` : 'None yet'}
                color="#6366f1"
              />
            </div>

            {/* Coverage by condition */}
            <div style={{ marginBottom: '18px' }}>
              <div style={labelStyle}>Coverage by Condition</div>
              {byCond.map(c => (
                <BarRow
                  key={c.label}
                  label={c.label}
                  count={c.counselled}
                  total={c.total}
                  color={c.color}
                />
              ))}
            </div>

            {/* Risk breakdown (counselled patients only) */}
            {counselled.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <div style={labelStyle}>Nutrition Risk Distribution (counselled patients)</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {byRisk.map(r => (
                    <div key={r.label} style={{
                      background: r.color + '15', border: `1.5px solid ${r.color}40`,
                      borderRadius: '8px', padding: '10px 16px', textAlign: 'center', flex: 1, minWidth: '80px',
                    }}>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: r.color, fontFamily: "'Inter', system-ui" }}>
                        {r.count}
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: r.color, textTransform: 'uppercase', fontFamily: "'Inter', system-ui" }}>
                        {r.label}
                      </div>
                    </div>
                  ))}
                  <div style={{
                    background: '#f8fafc', border: '1.5px solid rgba(191,200,205,.4)',
                    borderRadius: '8px', padding: '10px 16px', textAlign: 'center', flex: 1, minWidth: '80px',
                  }}>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: SLATE, fontFamily: "'Inter', system-ui" }}>
                      {counselled.filter(p => !p.nutritionProfile?.nutritionRiskLevel).length}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: SLATE, textTransform: 'uppercase', fontFamily: "'Inter', system-ui" }}>
                      Unclassified
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Month-by-month sparkline */}
            <div>
              <div style={labelStyle}>Meal Plans Generated — {currentYear}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '56px' }}>
                {monthlyTrend.map((count, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <div style={{ fontSize: '9px', color: SLATE, fontFamily: "'Inter', system-ui" }}>
                      {count > 0 ? count : ''}
                    </div>
                    <div style={{
                      width: '100%', borderRadius: '3px 3px 0 0',
                      height: `${Math.max(4, (count / maxMonthly) * 36)}px`,
                      background: count > 0 ? TEAL : '#e2e8f0',
                      transition: 'height .3s',
                    }} />
                    <div style={{ fontSize: '8px', color: SLATE, fontFamily: "'Inter', system-ui" }}>
                      {MONTHS_SHORT[i]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── NOT COUNSELLED TAB ── */}
        {tab === 'uncounselled' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: SLATE, fontFamily: "'Inter', system-ui" }}>
                {priorityUncounselled.length} patients — sorted by condition severity.
                {priorityUncounselled.filter(p => p.cond === 'DM+HTN' || p.cond === 'DM').length > 0 && (
                  <span style={{ color: '#d97706', fontWeight: 700 }}>
                    {' '}{priorityUncounselled.filter(p => p.cond === 'DM+HTN' || p.cond === 'DM').length} diabetic patients are highest priority for dietary counselling.
                  </span>
                )}
              </div>
              <button
                onClick={() => downloadCSV(uncounselled, `rcro_uncounselled_${currentYear}.csv`)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', border: '1.5px solid rgba(191,200,205,.55)', color: INK, borderRadius: '6px', padding: '5px 11px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', system-ui" }}
              >
                <Download size={12} /> Export List
              </button>
            </div>

            {priorityUncounselled.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: TEAL, fontWeight: 700, fontFamily: "'Inter', system-ui", fontSize: '13px' }}>
                ✓ All patients have received nutrition counselling.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: "'Inter', system-ui" }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                      {['Card No', 'Condition', 'Sex / Age', 'Region', 'Visits', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: SLATE }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {priorityUncounselled.map(p => {
                      const visitCount = p.visits.filter(v => v.att).length;
                      const condColor: Record<string, string> = { 'DM+HTN': '#10b981', DM: '#f59e0b', HTN: '#6366f1' };
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: INK, fontFamily: "ui-monospace, 'Cascadia Code', monospace", fontSize: '11px' }}>
                            {p.code}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                              background: (condColor[p.cond] ?? TEAL) + '20',
                              color: condColor[p.cond] ?? TEAL, border: `1.5px solid ${(condColor[p.cond] ?? TEAL)}40`,
                            }}>
                              {p.cond}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', color: SLATE }}>{p.sex} · {p.age}y</td>
                          <td style={{ padding: '8px 10px', color: SLATE }}>{p.region}</td>
                          <td style={{ padding: '8px 10px', color: SLATE }}>{visitCount} attended</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: '#fff7ed', color: '#92400e', border: '1.5px solid #fed7aa' }}>
                              Pending
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── COUNSELLED TAB ── */}
        {tab === 'counselled' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: SLATE, fontFamily: "'Inter', system-ui" }}>
                {counselled.length} patients — sorted by most recent plan.
              </div>
              <button
                onClick={() => downloadCSV(counselled, `rcro_counselled_${currentYear}.csv`)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', border: '1.5px solid rgba(191,200,205,.55)', color: INK, borderRadius: '6px', padding: '5px 11px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', system-ui" }}
              >
                <Download size={12} /> Export List
              </button>
            </div>

            {counselled.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: SLATE, fontFamily: "'Inter', system-ui", fontSize: '13px' }}>
                No meal plans have been generated yet. Open a patient visit and use Section 9 — Nutrition & Meal Plan.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: "'Inter', system-ui" }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                      {['Card No', 'Condition', 'Sex / Age', 'Plans Given', 'Last Plan Date', 'Risk Level'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: SLATE }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...counselled]
                      .sort((a, b) => (lastNutritionDate(b) ?? '').localeCompare(lastNutritionDate(a) ?? ''))
                      .map(p => {
                        const last = lastNutritionDate(p);
                        const plans = mealPlanCount(p);
                        const risk = p.nutritionProfile?.nutritionRiskLevel;
                        const condColor: Record<string, string> = { 'DM+HTN': '#10b981', DM: '#f59e0b', HTN: '#6366f1' };
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: INK, fontFamily: "ui-monospace, 'Cascadia Code', monospace", fontSize: '11px' }}>
                              {p.code}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                                background: (condColor[p.cond] ?? TEAL) + '20',
                                color: condColor[p.cond] ?? TEAL, border: `1.5px solid ${(condColor[p.cond] ?? TEAL)}40`,
                              }}>
                                {p.cond}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', color: SLATE }}>{p.sex} · {p.age}y</td>
                            <td style={{ padding: '8px 10px', color: INK, fontWeight: 700 }}>
                              {plans} {plans === 1 ? 'plan' : 'plans'}
                            </td>
                            <td style={{ padding: '8px 10px', color: SLATE }}>
                              {last ? new Date(last).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              {risk ? (
                                <span style={{
                                  fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                                  background: riskColors[risk] + '15', color: riskColors[risk],
                                  border: `1.5px solid ${riskColors[risk]}40`,
                                }}>
                                  {risk}
                                </span>
                              ) : (
                                <span style={{ color: SLATE, fontSize: '11px' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
