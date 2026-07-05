import React, { useMemo, useState } from 'react';
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
import { TZ_GEO } from '../utils/geo';
import {
  ANALYTICS_METRICS,
  ANALYTICS_MONTHS,
  getMetricBarData,
  getMetricSeries,
  isBarMetric,
  type MetricDef,
  type MetricId,
} from '../services/analytics';
import type { Patient } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const FONT = "'Inter', system-ui, -apple-system, sans-serif";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
  disabled,
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
        width: '100%',
        padding: '8px 10px',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        fontFamily: FONT,
        fontSize: 13,
        color: '#1e293b',
        background: disabled ? '#f8fafc' : 'rgba(255,255,255,0.85)',
        outline: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </select>
  );
}

function MetricPill({
  metric,
  active,
  onClick,
}: {
  metric: MetricDef;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 9999,
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        background: active ? metric.color : 'rgba(255,255,255,0.7)',
        color: active ? '#fff' : '#475569',
        border: `1.5px solid ${active ? metric.color : '#e2e8f0'}`,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#fff' : metric.color, flexShrink: 0 }} />
      {metric.label}
    </button>
  );
}

interface AnalyticsBuilderProps {
  scopedPatients: Patient[];
  scopeLabel: string;
  isSuperAdmin: boolean;
  selectedYear?: number;
  onSelectedYearChange?: (year: number) => void;
}

export default function AnalyticsBuilder({
  scopedPatients,
  scopeLabel,
  isSuperAdmin,
  selectedYear,
  onSelectedYearChange,
}: AnalyticsBuilderProps) {
  const currentYear = new Date().getFullYear();
  const [internalYear, setInternalYear] = useState(selectedYear ?? currentYear);
  const [yearB, setYearB] = useState(currentYear - 1);
  const [compare, setCompare] = useState(false);
  const [metricA, setMetricA] = useState<MetricId>('enrolment');
  const [metricB, setMetricB] = useState<MetricId>('bp_control');
  const [showSecond, setShowSecond] = useState(false);
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const year = selectedYear ?? internalYear;

  const allRegions = useMemo(() => Object.keys(TZ_GEO).sort(), []);
  const districtOptions = useMemo(() => (region ? TZ_GEO[region] ?? [] : []), [region]);

  const patients = useMemo(() => {
    if (!isSuperAdmin) return scopedPatients;
    return scopedPatients.filter((patient) => {
      if (region && patient.region !== region) return false;
      if (district && patient.district !== district) return false;
      return true;
    });
  }, [district, isSuperAdmin, region, scopedPatients]);

  const displayScope = useMemo(() => {
    if (!isSuperAdmin) return scopeLabel;
    if (district) return `${region} / ${district}`;
    if (region) return region;
    return scopeLabel;
  }, [district, isSuperAdmin, region, scopeLabel]);

  const seriesA = useMemo(() => getMetricSeries(metricA, patients, year), [metricA, patients, year]);
  const seriesB = useMemo(() => getMetricSeries(metricB, patients, year), [metricB, patients, year]);
  const seriesAComp = useMemo(() => getMetricSeries(metricA, patients, yearB), [metricA, patients, yearB]);
  const seriesBComp = useMemo(() => getMetricSeries(metricB, patients, yearB), [metricB, patients, yearB]);
  const barDataA = useMemo(() => getMetricBarData(metricA, patients), [metricA, patients]);

  const defA = ANALYTICS_METRICS.find((metric) => metric.id === metricA)!;
  const defB = ANALYTICS_METRICS.find((metric) => metric.id === metricB)!;

  const datasets = useMemo(() => {
    const rows: any[] = [
      {
        label: `${defA.label} (${year})`,
        data: seriesA,
        borderColor: defA.color,
        backgroundColor: defA.fill,
        fill: defA.type === 'bar',
        tension: 0.3,
        spanGaps: true,
        pointRadius: 4,
        borderWidth: 2,
        type: defA.type,
        yAxisID: 'yA',
      },
    ];

    if (compare) {
      rows.push({
        label: `${defA.label} (${yearB})`,
        data: seriesAComp,
        borderColor: defA.color,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 3,
        borderDash: [5, 4],
        borderWidth: 1.5,
        type: 'line',
        yAxisID: 'yA',
      });
    }

    if (showSecond && !isBarMetric(metricA)) {
      rows.push({
        label: `${defB.label} (${year})`,
        data: seriesB,
        borderColor: defB.color,
        backgroundColor: defB.fill,
        fill: defB.type === 'bar',
        tension: 0.3,
        spanGaps: true,
        pointRadius: 4,
        borderWidth: 2,
        type: defB.type,
        yAxisID: 'yB',
      });

      if (compare) {
        rows.push({
          label: `${defB.label} (${yearB})`,
          data: seriesBComp,
          borderColor: defB.color,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          spanGaps: true,
          pointRadius: 3,
          borderDash: [5, 4],
          borderWidth: 1.5,
          type: 'line',
          yAxisID: 'yB',
        });
      }
    }

    return rows;
  }, [compare, defA, defB, metricA, seriesA, seriesAComp, seriesB, seriesBComp, showSecond, year, yearB]);

  const summaryA = useMemo(() => {
    const values = seriesA.filter((v): v is number => v !== null);
    if (!values.length) return { avg: null, peak: null, trend: null };
    return {
      avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      peak: Math.max(...values),
      trend: values.length >= 2 ? values[values.length - 1] - values[0] : null,
    };
  }, [seriesA]);

  const summaryB = useMemo(() => {
    if (!showSecond) return null;
    const values = seriesB.filter((v): v is number => v !== null);
    if (!values.length) return { avg: null, peak: null, trend: null };
    return {
      avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      peak: Math.max(...values),
      trend: values.length >= 2 ? values[values.length - 1] - values[0] : null,
    };
  }, [seriesB, showSecond]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          font: { family: FONT, size: 11, weight: '500' as const },
          color: '#475569',
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { font: { family: FONT, size: 11 }, color: '#94a3b8' },
      },
      yA: {
        type: 'linear' as const,
        position: 'left' as const,
        beginAtZero: true,
        ...(defA.unit === '%' ? { max: 100 } : {}),
        ticks: {
          color: defA.color,
          callback: (v: number) => (defA.unit === '%' ? `${v}%` : v),
        },
      },
      ...(showSecond && !isBarMetric(metricA)
        ? {
            yB: {
              type: 'linear' as const,
              position: 'right' as const,
              beginAtZero: true,
              ...(defB.unit === '%' ? { max: 100 } : {}),
              grid: { drawOnChartArea: false },
              ticks: {
                color: defB.color,
                callback: (v: number) => (defB.unit === '%' ? `${v}%` : v),
              },
            },
          }
        : {}),
    },
  }), [defA, defB, metricA, showSecond]);

  const chartData = useMemo(() => ({ labels: ANALYTICS_MONTHS, datasets }), [datasets]);

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.78)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    padding: 20,
    marginBottom: 16,
  };

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 110 }}>
            <Label>Year</Label>
            <Select value={String(year)} onChange={(v) => {
              const nextYear = Number(v);
              if (selectedYear === undefined) {
                setInternalYear(nextYear);
              }
              onSelectedYearChange?.(nextYear);
            }}>
              {Array.from({ length: 6 }, (_, i) => currentYear - i).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </div>

          <div style={{ minWidth: 150 }}>
            <Label>Compare to year</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Select value={String(yearB)} onChange={(v) => setYearB(Number(v))} disabled={!compare}>
                {Array.from({ length: 6 }, (_, i) => currentYear - i).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
              <button
                onClick={() => setCompare((value) => !value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontFamily: FONT,
                  fontSize: 12,
                  cursor: 'pointer',
                  background: compare ? '#1a56db' : 'rgba(255,255,255,0.85)',
                  color: compare ? '#fff' : '#64748b',
                  border: `1.5px solid ${compare ? '#1a56db' : '#e2e8f0'}`,
                }}
              >
                {compare ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          {isSuperAdmin && (
            <>
              <div style={{ minWidth: 160 }}>
                <Label>Region</Label>
                <Select value={region} onChange={(v) => { setRegion(v); setDistrict(''); }}>
                  <option value="">All Regions</option>
                  {allRegions.map((value) => <option key={value} value={value}>{value}</option>)}
                </Select>
              </div>
              <div style={{ minWidth: 160 }}>
                <Label>District</Label>
                <Select value={district} onChange={setDistrict} disabled={!region}>
                  <option value="">All Districts</option>
                  {districtOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </Select>
              </div>
            </>
          )}

          <div style={{ marginLeft: 'auto' }}>
            <div style={{ padding: '6px 14px', borderRadius: 9999, background: 'rgba(26,86,219,0.08)', border: '1px solid rgba(26,86,219,0.2)', fontFamily: FONT, fontSize: 11, fontWeight: 600, color: '#1a56db' }}>
              {displayScope}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: '16px 20px' }}>
        <div style={{ marginBottom: 10 }}>
          <Label>Primary metric</Label>
          {(['core', 'drugs', 'clinical'] as const).map((group) => (
            <div key={group} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 5 }}>
                {group === 'core' ? 'Core' : group === 'drugs' ? 'Drug Analytics' : 'Clinical Outcomes by Drug'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ANALYTICS_METRICS.filter((metric) => metric.group === group).map((metric) => (
                  <MetricPill key={metric.id} metric={metric} active={metricA === metric.id} onClick={() => setMetricA(metric.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {!isBarMetric(metricA) && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowSecond((value) => !value)}
              style={{
                padding: '6px 14px',
                borderRadius: 9999,
                fontFamily: FONT,
                fontSize: 12,
                cursor: 'pointer',
                background: showSecond ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.85)',
                color: showSecond ? '#8b5cf6' : '#64748b',
                border: `1.5px solid ${showSecond ? 'rgba(139,92,246,0.4)' : '#e2e8f0'}`,
              }}
            >
              {showSecond ? 'Remove overlay' : 'Add overlay metric'}
            </button>

            {showSecond && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ANALYTICS_METRICS.filter((metric) => metric.id !== metricA && !isBarMetric(metric.id)).map((metric) => (
                  <MetricPill key={metric.id} metric={metric} active={metricB === metric.id} onClick={() => setMetricB(metric.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isBarMetric(metricA) && barDataA && barDataA.length > 0 ? (
        <div style={card}>
          <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
            {defA.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {barDataA.map((row) => {
              const maxValue = Math.max(...barDataA.map((item) => item.value), 1);
              const barPct = Math.round((row.value / maxValue) * 100);
              const comboMetric = metricA === 'htn_drug_combo' || metricA === 'dm_drug_combo';
              return (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontFamily: FONT, fontSize: 12, color: '#475569', fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: row.color }}>
                      {comboMetric ? `${row.value} pts` : defA.unit === '%' ? `${row.value}%` : row.value}
                    </span>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${defA.unit === '%' ? row.value : barPct}%`, background: row.color, borderRadius: 9999 }} />
                  </div>
                  {comboMetric && row.controlRate !== undefined && (
                    <div style={{ marginTop: 4, fontFamily: FONT, fontSize: 11, color: '#64748b' }}>
                      {row.controlRate}% controlled
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!isBarMetric(metricA) && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {[{ def: defA, summary: summaryA }, ...(showSecond && summaryB ? [{ def: defB, summary: summaryB }] : [])].map(({ def, summary }) => (
              <div key={def.id} style={{ display: 'flex', gap: 12, flex: '1 1 auto', flexWrap: 'wrap' }}>
                {[
                  { title: `${def.label} Avg`, value: summary.avg !== null ? `${summary.avg}${def.unit === '%' ? '%' : ''}` : '—', color: def.color },
                  { title: `${def.label} Peak`, value: summary.peak !== null ? `${summary.peak}${def.unit === '%' ? '%' : ''}` : '—', color: def.color },
                  {
                    title: `${def.label} Trend`,
                    value: summary.trend !== null ? `${summary.trend >= 0 ? '+' : ''}${summary.trend}${def.unit === '%' ? '%' : ''}` : '—',
                    color: summary.trend === null ? '#64748b' : summary.trend >= 0 ? '#10b981' : '#ef4444',
                  },
                ].map((item) => (
                  <div key={item.title} style={{ flex: '1 1 130px', padding: '12px 16px', background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.75)', borderRadius: 12 }}>
                    <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 4 }}>
                      {item.title}
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: item.color }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: '20px 20px 14px' }}>
            <div style={{ width: '100%', height: 340 }}>
              <Line data={chartData as any} options={chartOptions as any} />
            </div>
            <div style={{ marginTop: 10, fontFamily: FONT, fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
              {compare ? <span style={{ marginRight: 14 }}>dashed = {yearB}</span> : null}
              Scope: <strong style={{ color: '#64748b' }}>{displayScope}</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
