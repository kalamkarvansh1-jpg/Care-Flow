import React, { useState } from 'react';
import './chartSetup';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { BottleneckItem } from '../../types';

interface BottleneckChartProps {
  bottlenecks: BottleneckItem[];
  height?: number;
  initialMetric?: 'both' | 'median' | 'p90';
  onSelectBottleneck?: (bottleneck: BottleneckItem) => void;
}

export const BottleneckChart: React.FC<BottleneckChartProps> = ({
  bottlenecks,
  height = 260,
  initialMetric = 'both',
  onSelectBottleneck,
}) => {
  const [metricMode, setMetricMode] = useState<'both' | 'median' | 'p90'>(initialMetric);
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

  const medianDurations = topBottlenecks.map((b) => b.medianElapsedMinutes);
  const p90Durations = topBottlenecks.map((b) => b.p90ElapsedMinutes);

  const datasets: ChartData<'bar'>['datasets'] = [];

  if (metricMode === 'both' || metricMode === 'median') {
    datasets.push({
      label: 'Median Elapsed (Minutes)',
      data: medianDurations,
      backgroundColor: '#0284c7', // Sky-600
      borderRadius: 4,
      maxBarThickness: metricMode === 'both' ? 10 : 16,
    });
  }

  if (metricMode === 'both' || metricMode === 'p90') {
    datasets.push({
      label: 'P90 Elapsed (Minutes)',
      data: p90Durations,
      backgroundColor: '#e11d48', // Rose-600
      borderRadius: 4,
      maxBarThickness: metricMode === 'both' ? 10 : 16,
    });
  }

  const data: ChartData<'bar'> = {
    labels,
    datasets,
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event, elements) => {
      if (elements.length > 0 && onSelectBottleneck) {
        const idx = elements[0].index;
        const item = topBottlenecks[idx];
        if (item) onSelectBottleneck(item);
      }
    },
    plugins: {
      legend: {
        display: metricMode === 'both',
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          boxWidth: 12,
          boxHeight: 12,
          font: { size: 11 },
          color: '#475569',
        },
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex;
            return topBottlenecks[idx]?.label || '';
          },
          label: (context) => {
            const idx = context.dataIndex;
            const item = topBottlenecks[idx];
            if (!item) return '';
            const datasetLabel = context.dataset.label || '';
            const val = context.parsed.x;
            return ` ${datasetLabel}: ${val} min (${item.validObservations} instances across ${item.caseCount} cases)`;
          },
          afterBody: (items) => {
            const idx = items[0]?.dataIndex;
            const item = topBottlenecks[idx];
            if (!item) return [];
            return [
              `Median: ${item.medianElapsedMinutes} min | P90: ${item.p90ElapsedMinutes} min | Mean: ${item.meanElapsedMinutes} min`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text:
            metricMode === 'both'
              ? 'Elapsed Minutes (Median vs P90 Tail)'
              : metricMode === 'p90'
              ? 'P90 Elapsed Minutes'
              : 'Median Elapsed Minutes',
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
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-[11px] text-slate-500 font-medium">
          Top {topBottlenecks.length} transitions by elapsed duration
        </span>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-[11px]">
          <button
            type="button"
            onClick={() => setMetricMode('both')}
            className={`px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
              metricMode === 'both'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Both (Median vs P90)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('median')}
            className={`px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
              metricMode === 'median'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Median Only
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('p90')}
            className={`px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
              metricMode === 'p90'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            P90 Tail Only
          </button>
        </div>
      </div>
      <div style={{ height }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};
