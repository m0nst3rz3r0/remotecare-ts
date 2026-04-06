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
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { Patient } from '../../types';
import { getMonthlyStats } from '../../services/clinical';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function BPControlChart({
  patients,
  year,
}: {
  patients: Patient[];
  year: number;
}) {
  const labels = useMemo(
    () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    [],
  );

  const data = useMemo(() => {
    const emerald = cssVar('--emerald', '#10b981');
    const emeraldPale = cssVar('--emerald-pale', '#d1fae5');

    // Use all patients, but compute monthly stats based on visit.month only.
    const monthly = labels.map((_, idx) => {
      const m = idx + 1;
      const stats = getMonthlyStats(
        patients.filter((p) => p.visits?.some((v) => +v.month === m && +(v.year ?? new Date().getFullYear()) === year)) ||
          patients,
        m,
      );
      return stats.bpControlRate;
    });

    return {
      labels,
      datasets: [
        {
          label: 'BP Control %',
          data: monthly,
          borderColor: emerald,
          backgroundColor: emeraldPale,
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
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
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
      <Line data={data} options={options as any} />
    </div>
  );
}

