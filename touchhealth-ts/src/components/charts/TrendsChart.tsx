import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { Patient } from '../../types';
import EnrolmentChart from './EnrolmentChart';
import BPControlChart from './BPControlChart';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function TrendsChart({ patients, year }: { patients: Patient[]; year: number }) {
  const labels = useMemo(
    () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    [],
  );

  const attendanceSeries = useMemo(() => {
    const emerald = cssVar('--emerald', '#10b981');
    const emeraldPale = cssVar('--emerald-pale', '#d1fae5');

    const series = labels.map((_, idx) => {
      const m = idx + 1;
      const visits = patients.flatMap((p) => p.visits ?? []).filter(
        (v) => +v.month === m && (v.year ?? new Date().getFullYear()) === year,
      );
      const total = visits.length;
      const attended = visits.filter((v) => v.att).length;
      return total ? Math.round((attended / total) * 100) : null;
    });

    return { series, emerald, emeraldPale };
  }, [labels, patients, year]);

  const drugUsageSeries = useMemo(() => {
    const amber = cssVar('--amber', '#d97706');
    const amberPale = cssVar('--amber-pale', '#fef3c7');

    const series = labels.map((_, idx) => {
      const m = idx + 1;
      const visits = patients.flatMap((p) => p.visits ?? []).filter(
        (v) => +v.month === m && (v.year ?? new Date().getFullYear()) === year,
      );
      const attended = visits.filter((v) => v.att);
      const used = attended.filter((v) => (v.meds ?? []).length > 0).length;
      return attended.length ? Math.round((used / attended.length) * 100) : null;
    });

    return { series, amber, amberPale };
  }, [labels, patients, year]);

  const lineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (v: any) => `${v}%` },
        },
      },
    }),
    [],
  );

  const attendanceData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Attendance %',
          data: attendanceSeries.series,
          borderColor: attendanceSeries.emerald,
          backgroundColor: attendanceSeries.emeraldPale,
          fill: false,
          tension: 0.25,
          spanGaps: true,
          pointRadius: 3,
        },
      ],
    }),
    [attendanceSeries, labels],
  );

  const drugUsageData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Drug usage %',
          data: drugUsageSeries.series,
          borderColor: drugUsageSeries.amber,
          backgroundColor: drugUsageSeries.amberPale,
          fill: false,
          tension: 0.25,
          spanGaps: true,
          pointRadius: 3,
        },
      ],
    }),
    [drugUsageSeries, labels],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="font-syne font-semibold text-[14px] mb-2">Monthly Enrolment</div>
          <EnrolmentChart patients={patients} year={year} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="font-syne font-semibold text-[14px] mb-2">BP Control %</div>
          <BPControlChart patients={patients} year={year} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="font-syne font-semibold text-[14px] mb-2">Attendance %</div>
          <div className="w-full h-[240px]">
            <Line data={attendanceData as any} options={lineOptions as any} />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="font-syne font-semibold text-[14px] mb-2">Drug Usage %</div>
          <div className="w-full h-[240px]">
            <Line data={drugUsageData as any} options={lineOptions as any} />
          </div>
        </div>
      </div>
    </div>
  );
}

