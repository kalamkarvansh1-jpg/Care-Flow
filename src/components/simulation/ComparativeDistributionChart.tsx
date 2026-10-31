import React from 'react';
import '../charts/chartSetup';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { SimulatedCaseResult } from '../../types/simulation';

interface ComparativeDistributionChartProps {
  caseResults: SimulatedCaseResult[];
  height?: number;
}

export const ComparativeDistributionChart: React.FC<ComparativeDistributionChartProps> = ({
  caseResults,
  height = 240,
}) => {
  if (caseResults.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200"
      >
        No simulation data to display.
      </div>
    );
  }

  const buckets = [
    { label: '< 30 min', min: 0, max: 30 },
    { label: '30 – 60 min', min: 30, max: 60 },
    { label: '1 – 2 hours', min: 60, max: 120 },
    { label: '2 – 4 hours', min: 120, max: 240 },
    { label: '> 4 hours', min: 240, max: Infinity },
  ];

  const baselineCounts = [0, 0, 0, 0, 0];
  const simulatedCounts = [0, 0, 0, 0, 0];

  caseResults.forEach((r) => {
    const b = r.baselineDurationMinutes;
    const s = r.simulatedDurationMinutes;

    for (let i = 0; i < buckets.length; i++) {
      const bkt = buckets[i];
      if (b >= bkt.min && (bkt.max === Infinity ? true : b < bkt.max)) {
        baselineCounts[i]++;
        break;
      }
    }

    for (let i = 0; i < buckets.length; i++) {
      const bkt = buckets[i];
      if (s >= bkt.min && (bkt.max === Infinity ? true : s < bkt.max)) {
        simulatedCounts[i]++;
        break;
      }
    }
  });

  const total = caseResults.length || 1;
  const baselinePercentages = baselineCounts.map((c) => Math.round((c / total) * 1000) / 10);
  const simulatedPercentages = simulatedCounts.map((c) => Math.round((c / total) * 1000) / 10);

  const data: ChartData<'bar'> = {
    labels: buckets.map((b) => b.label),
    datasets: [
      {
        label: 'Baseline Distribution (%)',
        data: baselinePercentages,
        backgroundColor: '#94a3b8', // slate-400
        borderRadius: 4,
        maxBarThickness: 24,
      },
      {
        label: 'Simulated Distribution (%)',
        data: simulatedPercentages,
        backgroundColor: '#0d9488', // teal-600
        borderRadius: 4,
        maxBarThickness: 24,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
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
          label: (ctx) => {
            const isBaseline = ctx.datasetIndex === 0;
            const count = isBaseline ? baselineCounts[ctx.dataIndex] : simulatedCounts[ctx.dataIndex];
            const pct = ctx.parsed.y;
            return ` ${ctx.dataset.label}: ${pct}% (${count.toLocaleString()} cases)`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: (val) => `${val}%`,
          font: { size: 10 },
        },
        grid: {
          color: '#f1f5f9',
        },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
};
