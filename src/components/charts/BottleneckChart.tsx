import React from 'react';
import './chartSetup';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { BottleneckItem } from '../../types';

interface BottleneckChartProps {
  bottlenecks: BottleneckItem[];
  height?: number;
}

export const BottleneckChart: React.FC<BottleneckChartProps> = ({
  bottlenecks,
  height = 260,
}) => {
  const topBottlenecks = bottlenecks.slice(0, 7);

  if (topBottlenecks.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200"
      >
        No bottleneck transitions recorded in current filtered cohort.
      </div>
    );
  }

  const labels = topBottlenecks.map((b) =>
    b.label.length > 28 ? b.label.slice(0, 26) + '...' : b.label
  );
  const durations = topBottlenecks.map((b) => b.medianElapsedMinutes);
  const backgroundColors = topBottlenecks.map((b) => {
    if (b.severity === 'high') return '#e11d48'; // Rose
    if (b.severity === 'moderate') return '#d97706'; // Amber
    return '#0284c7'; // Sky
  });

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Median Inter-Event Elapsed Time (Minutes)',
        data: durations,
        backgroundColor: backgroundColors,
        borderRadius: 4,
        maxBarThickness: 16,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex;
            return topBottlenecks[idx]?.label || '';
          },
          label: (context) => {
            const idx = context.dataIndex;
            const item = topBottlenecks[idx];
            return ` Median Elapsed: ${item.medianElapsedMinutes} min (${item.validObservations} instances across ${item.caseCount} cases)`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Median Elapsed Minutes',
          color: '#64748b',
          font: { size: 10 },
        },
        grid: { color: 'rgba(226, 232, 240, 0.5)' },
        ticks: { color: '#64748b', font: { size: 10 } },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#1e293b', font: { size: 11, weight: 500 } },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
};
