import React, { useState } from 'react';
import '../charts/chartSetup';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { TransitionSimulationSummary } from '../../types/simulation';

interface ComparativeTransitionChartProps {
  transitionResults: TransitionSimulationSummary[];
  height?: number;
}

export const ComparativeTransitionChart: React.FC<ComparativeTransitionChartProps> = ({
  transitionResults,
  height = 220,
}) => {
  const [metricMode, setMetricMode] = useState<'both' | 'median' | 'p90'>('both');

  if (transitionResults.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200"
      >
        No transition interventions configured in this scenario.
      </div>
    );
  }

  const labels = transitionResults.map((t) => {
    const raw = `${t.from} → ${t.to}`;
    return raw.length > 28 ? raw.slice(0, 26) + '...' : raw;
  });

  const datasets: ChartData<'bar'>['datasets'] = [];

  if (metricMode === 'both' || metricMode === 'median') {
    datasets.push({
      label: 'Baseline Median (min)',
      data: transitionResults.map((t) => t.baselineMedianMinutes),
      backgroundColor: '#94a3b8', // slate-400
      borderRadius: 4,
      maxBarThickness: metricMode === 'both' ? 10 : 16,
    });
    datasets.push({
      label: 'Simulated Median (min)',
      data: transitionResults.map((t) => t.simulatedMedianMinutes),
      backgroundColor: '#0d9488', // teal-600
      borderRadius: 4,
      maxBarThickness: metricMode === 'both' ? 10 : 16,
    });
  }

  if (metricMode === 'both' || metricMode === 'p90') {
    datasets.push({
      label: 'Baseline P90 (min)',
      data: transitionResults.map((t) => t.baselineP90Minutes),
      backgroundColor: '#fb7185', // rose-400
      borderRadius: 4,
      maxBarThickness: metricMode === 'both' ? 10 : 16,
    });
    datasets.push({
      label: 'Simulated P90 (min)',
      data: transitionResults.map((t) => t.simulatedP90Minutes),
      backgroundColor: '#059669', // emerald-600
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
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          font: { size: 10 },
          color: '#475569',
        },
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex;
            const t = transitionResults[idx];
            return t ? `${t.from} → ${t.to}` : '';
          },
          afterTitle: (items) => {
            const idx = items[0]?.dataIndex;
            const t = transitionResults[idx];
            return t ? `Affected: ${t.affectedCasesCount.toLocaleString()} cases (${t.observationCount.toLocaleString()} steps)` : '';
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { font: { size: 10 } },
        grid: { color: '#f1f5f9' },
      },
      y: {
        ticks: { font: { size: 10 } },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">Transition Latency Shift</span>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
          <button
            onClick={() => setMetricMode('both')}
            className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
              metricMode === 'both' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setMetricMode('median')}
            className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
              metricMode === 'median' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Median
          </button>
          <button
            onClick={() => setMetricMode('p90')}
            className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
              metricMode === 'p90' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            P90 Tail
          </button>
        </div>
      </div>
      <div style={{ height }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};
