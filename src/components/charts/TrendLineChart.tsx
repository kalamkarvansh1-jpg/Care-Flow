import React from 'react';
import './chartSetup';
import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';

interface TrendLineChartProps {
  labels: string[];
  arrivals: number[];
  discharges: number[];
  avgDurationHours?: number[];
  height?: number;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  labels,
  arrivals,
  discharges,
  avgDurationHours,
  height = 280,
}) => {
  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Patient Arrivals',
        data: arrivals,
        borderColor: '#0284c7', // Medical Blue
        backgroundColor: 'rgba(2, 132, 199, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointBackgroundColor: '#0284c7',
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: 'Completed / Discharged',
        data: discharges,
        borderColor: '#0d9488', // Teal
        backgroundColor: 'rgba(13, 148, 136, 0.04)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointBackgroundColor: '#0d9488',
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      ...(avgDurationHours
        ? [
            {
              label: 'Avg Duration (Hours)',
              data: avgDurationHours,
              borderColor: '#f59e0b', // Amber
              backgroundColor: 'transparent',
              borderDash: [5, 4],
              borderWidth: 2,
              tension: 0.25,
              yAxisID: 'y1',
              pointRadius: 3,
              pointHoverRadius: 5,
            },
          ]
        : []),
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
          boxWidth: 12,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 12 },
          color: '#475569',
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const val = context.parsed.y;
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
        grid: {
          color: 'rgba(226, 232, 240, 0.6)',
        },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
        },
      },
      y: {
        title: {
          display: true,
          text: 'Patient Volume (Cases)',
          color: '#64748b',
          font: { size: 11 },
        },
        grid: {
          color: 'rgba(226, 232, 240, 0.6)',
        },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
        },
        min: 0,
      },
      ...(avgDurationHours
        ? {
            y1: {
              position: 'right' as const,
              title: {
                display: true,
                text: 'Process Duration (Hrs)',
                color: '#d97706',
                font: { size: 11 },
              },
              grid: {
                drawOnChartArea: false,
              },
              ticks: {
                color: '#d97706',
                font: { size: 11 },
              },
              min: 0,
              max: 8,
            },
          }
        : {}),
    },
  };

  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
};
