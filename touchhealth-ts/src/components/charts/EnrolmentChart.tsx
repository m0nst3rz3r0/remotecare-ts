import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import type { Patient } from '../../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function EnrolmentChart({ patients, year }: { patients: Patient[]; year: number }) {
  const labels = useMemo(
    () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    [],
  );

  const data = useMemo(() => {
    const emerald = cssVar('--emerald', '#10b981');
    const emeraldPale = cssVar('--emerald-pale', '#d1fae5');

    const counts = labels.map((_, idx) => {
      const m = idx + 1;
      return patients.filter((p) => {
        if (!p.enrol) return false;
        const d = new Date(p.enrol);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      }).length;
    });

    return {
      labels,
      datasets: [
        {
          label: 'New registrations',
          data: counts,
          backgroundColor: emeraldPale,
          borderColor: emerald,
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  }, [patients, year, labels]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    }),
    [],
  );

  return (
    <div className="w-full h-[240px]">
      <Bar data={data} options={options as any} />
    </div>
  );
}

