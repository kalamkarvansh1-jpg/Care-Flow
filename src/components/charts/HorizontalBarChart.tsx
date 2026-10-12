import React from 'react';
import './chartSetup';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { ActivityMetric } from '../../types';

interface HorizontalBarChartProps {
  activities: ActivityMetric[];
  selectedActivity?: string;
  onSelectActivity?: (activityName: string) => void;
  height?: number;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  activities,
  selectedActivity,
  onSelectActivity,
  height = 260,
}) => {
  const topActivities = activities.slice(0, 8);

  if (topActivities.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200"
      >
        No activity occurrences found.
      </div>
    );
  }

  const labels = topActivities.map((a) =>
    a.activity.length > 24 ? a.activity.slice(0, 22) + '...' : a.activity
  );
  const frequencies = topActivities.map((a) => a.frequency);
  const backgroundColors = topActivities.map((a) =>
    selectedActivity && selectedActivity === a.activity
      ? '#0284c7'
      : selectedActivity && selectedActivity !== 'all'
      ? '#cbd5e1'
      : '#0d9488'
  );

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Recorded Event Count',
        data: frequencies,
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
    onClick: (_event, elements) => {
      if (elements && elements.length > 0 && onSelectActivity) {
        const index = elements[0].index;
        const clickedActivity = topActivities[index].activity;
        onSelectActivity(clickedActivity === selectedActivity ? 'all' : clickedActivity);
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex;
            return topActivities[idx]?.activity || '';
          },
          label: (context) => {
            const idx = context.dataIndex;
            const item = topActivities[idx];
            const val = context.parsed.x ?? 0;
            return ` ${val.toLocaleString()} events (${item.caseCount.toLocaleString()} distinct cases)`;
          },
        },
      },
    },
    scales: {
      x: {
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
