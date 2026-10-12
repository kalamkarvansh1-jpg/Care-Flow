import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: {
    value: number;
    label: string;
    isPositiveGood?: boolean; // if false, negative is good (e.g. waiting time decrease)
  };
  benchmark?: string;
  secondaryStat?: {
    label: string;
    value: string;
  };
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-sky-600',
  iconBg = 'bg-sky-50',
  trend,
  benchmark,
  secondaryStat,
}) => {
  let trendIsGood = true;
  if (trend) {
    if (trend.isPositiveGood === false) {
      trendIsGood = trend.value <= 0;
    } else {
      trendIsGood = trend.value >= 0;
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
              {value}
            </h3>
            {subtitle && (
              <span className="text-xs text-slate-500 font-medium">
                {subtitle}
              </span>
            )}
          </div>
        </div>
        <div className={`p-2.5 rounded-lg ${iconBg} ${iconColor} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        {trend ? (
          <div className="flex items-center gap-1.5 font-medium">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
                trendIsGood
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              {trend.value > 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              ) : trend.value < 0 ? (
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              ) : (
                <Minus className="w-3.5 h-3.5 mr-0.5" />
              )}
              {Math.abs(trend.value)}%
            </span>
            <span className="text-slate-500">{trend.label}</span>
          </div>
        ) : benchmark ? (
          <span className="text-slate-500">
            Target benchmark: <strong className="text-slate-700">{benchmark}</strong>
          </span>
        ) : (
          <span className="text-slate-400">Cohort active</span>
        )}

        {secondaryStat && (
          <div className="text-right text-slate-500">
            <span>{secondaryStat.label}: </span>
            <span className="font-semibold text-slate-700">{secondaryStat.value}</span>
          </div>
        )}
      </div>
    </div>
  );
};
