import React from 'react';
import './chartSetup';
import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';

interface TimeSeriesChartProps {
  labels: string[];
  arrivals: number[];
  completions: number[];
  medianDurationsHours: number[];
  height?: number;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  labels,
  arrivals,
  completions,
  medianDurationsHours,
  height = 260,
}) => {
  if (labels.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200"
      >
        No time-series event records available for selected date range.
      </div>
    );
  }

  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Case Volume (Arrivals)',
        data: arrivals,
        borderColor: '#0284c7', // Sky Blue
        backgroundColor: 'rgba(2, 132, 199, 0.08)',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        yAxisID: 'y',
      },
      {
        label: 'Completions / Discharges',
        data: completions,
        borderColor: '#0d9488', // Teal
        backgroundColor: 'transparent',
        borderWidth: 1.8,
        tension: 0.3,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        yAxisID: 'y',
      },
      {
        label: 'Median Duration (Hours)',
        data: medianDurationsHours,
        borderColor: '#d97706', // Amber
        backgroundColor: 'transparent',
        borderDash: [4, 4],
        borderWidth: 1.8,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 4,
        yAxisID: 'y1',
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 11 },
          color: '#475569',
          padding: 12,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || '';
            const val = ctx.parsed.y;
            if (label.includes('Duration')) {
              return ` ${label}: ${val} hrs`;
            }
            return ` ${label}: ${val} cases`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(226, 232, 240, 0.5)' },
        ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 30 },
      },
      y: {
        position: 'left',
        title: { display: true, text: 'Cases / Day', color: '#64748b', font: { size: 10 } },
        grid: { color: 'rgba(226, 232, 240, 0.5)' },
        ticks: { color: '#64748b', font: { size: 10 } },
        min: 0,
      },
      y1: {
        position: 'right',
        title: { display: true, text: 'Duration (Hrs)', color: '#d97706', font: { size: 10 } },
        grid: { drawOnChartArea: false },
        ticks: { color: '#d97706', font: { size: 10 } },
        min: 0,
      },
    },
  };

  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
};
