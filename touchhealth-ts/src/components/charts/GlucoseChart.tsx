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
import { isGlucoseControlled } from '../../services/clinical';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function GlucoseChart({ patients, year }: { patients: Patient[]; year: number }) {
  const labels = useMemo(
    () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    [],
  );

  const data = useMemo(() => {
    const amber = cssVar('--amber', 'var(--amber)');
    const amberPale = cssVar('--amber-pale', 'var(--amber-pale)');

    const monthly = labels.map((_, idx) => {
      const m = idx + 1;
      const visits = patients.flatMap((p) => p.visits ?? []).filter(
        (v) => +v.month === m && (v.year ?? year) === year && v.att,
      );
      const measured = visits.filter((v) => typeof v.sugar === 'number' && v.sugar !== null);
      const controlled = measured.filter((v) => isGlucoseControlled(v.sugar as number));
      return measured.length ? Math.round((controlled.length / measured.length) * 100) : null;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Glucose at Target %',
          data: monthly,
          borderColor: amber,
          backgroundColor: amberPale,
          fill: false,
          tension: 0.25,
          spanGaps: true,
          pointRadius: 3,
        },
      ],
    };
  }, [labels, patients, year]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (v: any) => `${v}%`,
          },
        },
      },
    }),
    [],
  );

  return (
    <div className="w-full h-[240px]">
      <Line data={data as any} options={options as any} />
    </div>
  );
}

