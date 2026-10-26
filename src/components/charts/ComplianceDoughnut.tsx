import React from 'react';
import './chartSetup';
import { Doughnut } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';

interface ComplianceDoughnutProps {
  compliantPct: number;
  delayedPct: number;
  deviationPct: number;
  height?: number;
}

export const ComplianceDoughnut: React.FC<ComplianceDoughnutProps> = ({
  compliantPct = 88.6,
  delayedPct = 5.2,
  deviationPct = 6.2,
  height = 200,
}) => {
  const isZero = compliantPct === 0 && delayedPct === 0 && deviationPct === 0;

  const data: ChartData<'doughnut'> = {
    labels: isZero
      ? ['No Active Cases']
      : ['Pathway Compliant', 'Delayed / SLA Risk', 'Protocol Deviation'],
    datasets: [
      {
        data: isZero ? [100] : [compliantPct, delayedPct, deviationPct],
        backgroundColor: isZero
          ? ['#e2e8f0']
          : [
              '#0d9488', // Teal 600
              '#f59e0b', // Amber 500
              '#e11d48', // Rose 600
            ],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: isZero ? 0 : 4,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
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
          label: (context) => {
            if (isZero) return ' No cases evaluated in active filter';
            const label = context.label || '';
            const val = context.parsed;
            return ` ${label}: ${val}%`;
          },
        },
      },
    },
  };

  return (
    <div className="relative flex items-center justify-center" style={{ height }}>
      <Doughnut data={data} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
        <span className="text-2xl font-bold text-slate-900 tracking-tight">
          {compliantPct}%
        </span>
        <span className="text-xs text-slate-500 font-medium">Compliance</span>
      </div>
    </div>
  );
};
