import React from 'react';
import { TooltipLabel } from './TooltipLabel';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  definition: string;
  contextNote?: string;
  subtitle?: string;
  unavailableReason?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  definition,
  contextNote,
  subtitle,
  unavailableReason,
}) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-2xs hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <TooltipLabel label={label} tooltip={definition} />
      </div>

      {unavailableReason ? (
        <div className="mt-2">
          <span className="text-base font-semibold text-slate-400">Not available</span>
          <p className="text-[11px] text-slate-500 mt-1">{unavailableReason}</p>
        </div>
      ) : (
        <div className="mt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {value}
            </span>
            {unit && <span className="text-xs font-medium text-slate-500">{unit}</span>}
          </div>

          {(subtitle || contextNote) && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              {subtitle && <span>{subtitle}</span>}
              {contextNote && <span className="text-slate-400 font-mono text-[10px]">{contextNote}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
