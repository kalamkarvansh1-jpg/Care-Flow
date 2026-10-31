import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Clock,
  Filter,
  Users,
  ArrowRight,
  Activity,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { BottleneckItem, CaseSummary } from '../../types';
import { formatDurationMinutes, formatDateTime, formatNumber, formatPercentage } from '../../lib/formatters';

interface BottleneckDetailDrawerProps {
  bottleneck: BottleneckItem | null;
  cases: CaseSummary[];
  onClose: () => void;
  onFilterToTransition: (transitionKey: string) => void;
  onSelectCase: (caseSummary: CaseSummary) => void;
}

export const BottleneckDetailDrawer: React.FC<BottleneckDetailDrawerProps> = ({
  bottleneck,
  cases,
  onClose,
  onFilterToTransition,
  onSelectCase,
}) => {
  const navigate = useNavigate();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (bottleneck) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bottleneck, onClose]);

  if (!bottleneck) return null;

  // Extract from and to activities
  const [fromActivity, toActivity] = bottleneck.label.split(' → ');

  // Identify cases traversing this bottleneck
  const traversingCases = cases.filter((c) =>
    c.events.some((e, idx) => e.activity === fromActivity && c.events[idx + 1]?.activity === toActivity)
  );

  const coveragePct = cases.length > 0 ? (traversingCases.length / cases.length) * 100 : 0;
  const iqr =
    bottleneck.p75ElapsedMinutes !== undefined && bottleneck.p25ElapsedMinutes !== undefined
      ? Math.round((bottleneck.p75ElapsedMinutes - bottleneck.p25ElapsedMinutes) * 10) / 10
      : undefined;

  const tailSkew =
    bottleneck.medianElapsedMinutes > 0
      ? Math.round((bottleneck.p90ElapsedMinutes / bottleneck.medianElapsedMinutes) * 100) / 100
      : undefined;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white border-l border-slate-200 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    bottleneck.severity === 'high'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : bottleneck.severity === 'moderate'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {bottleneck.severity === 'high'
                    ? 'High Latency Bottleneck'
                    : bottleneck.severity === 'moderate'
                    ? 'Moderate Operational Delay'
                    : 'Nominal Progression'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {bottleneck.id}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                <span>{fromActivity}</span>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{toActivity}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed latency distribution, timestamp-tie diagnostics, and patient cohort drill-down.
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              aria-label="Close bottleneck inspection"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="px-6 py-3 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Valid Instances
              </span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                {formatNumber(bottleneck.validObservations)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Distinct Cases
              </span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                {formatNumber(bottleneck.caseCount)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Cohort Coverage
              </span>
              <span className="text-sm font-bold text-sky-700 font-mono">
                {formatPercentage(coveragePct)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Tail Skew (P90 / Med)
              </span>
              <span className="text-sm font-bold text-rose-700 font-mono">
                {tailSkew ? `${tailSkew}x` : '—'}
              </span>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Action Card: Filter Workspace to this Transition */}
            <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200/80 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block">
                    Isolate Transition Cohort
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Filter all workspace views to the {formatNumber(traversingCases.length)} cases traversing this step.
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  onFilterToTransition(bottleneck.label);
                  onClose();
                }}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                Apply Filter
              </button>
            </div>

            {/* Action Card: Simulate What-If Intervention on this Transition */}
            <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/80 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block">
                    Simulate What-If Intervention
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Model parametric latency reductions and SLA recovery for this transition.
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  navigate(`/simulation?from=${encodeURIComponent(fromActivity)}&to=${encodeURIComponent(toActivity)}`);
                  onClose();
                }}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                Simulate
              </button>
            </div>

            {/* Complete Parametric Latency Distribution Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Parametric Latency Distribution
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  Continuous Linear Quantiles
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {/* Min */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Minimum</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    {bottleneck.minElapsedMinutes !== undefined ? formatDurationMinutes(bottleneck.minElapsedMinutes) : '—'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Fastest handoff</span>
                </div>

                {/* Q1 / P25 */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">25th Percentile (Q1)</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    {bottleneck.p25ElapsedMinutes !== undefined ? formatDurationMinutes(bottleneck.p25ElapsedMinutes) : '—'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Lower quartile</span>
                </div>

                {/* Median / P50 */}
                <div className="p-3 rounded-xl border-2 border-sky-400 bg-sky-50/40 shadow-2xs">
                  <span className="text-[10px] text-sky-800 block uppercase font-bold">Median (P50)</span>
                  <span className="text-sm font-bold text-sky-900 font-mono">
                    {formatDurationMinutes(bottleneck.medianElapsedMinutes)}
                  </span>
                  <span className="text-[10px] text-sky-700 block mt-0.5">Typical duration</span>
                </div>

                {/* Mean */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Arithmetic Mean</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    {formatDurationMinutes(bottleneck.meanElapsedMinutes)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Parametric average</span>
                </div>

                {/* Q3 / P75 */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">75th Percentile (Q3)</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    {bottleneck.p75ElapsedMinutes !== undefined ? formatDurationMinutes(bottleneck.p75ElapsedMinutes) : '—'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Upper quartile</span>
                </div>

                {/* P90 Tail */}
                <div className="p-3 rounded-xl border-2 border-rose-400 bg-rose-50/40 shadow-2xs">
                  <span className="text-[10px] text-rose-800 block uppercase font-bold">P90 Tail Latency</span>
                  <span className="text-sm font-bold text-rose-900 font-mono">
                    {formatDurationMinutes(bottleneck.p90ElapsedMinutes)}
                  </span>
                  <span className="text-[10px] text-rose-700 block mt-0.5">90th percentile</span>
                </div>

                {/* P95 Extreme Tail */}
                <div className="p-3 rounded-xl border border-rose-200 bg-white shadow-2xs">
                  <span className="text-[10px] text-rose-700 block uppercase font-bold">P95 Extreme Tail</span>
                  <span className="text-sm font-bold text-rose-800 font-mono">
                    {bottleneck.p95ElapsedMinutes !== undefined ? formatDurationMinutes(bottleneck.p95ElapsedMinutes) : '—'}
                  </span>
                  <span className="text-[10px] text-rose-500 block mt-0.5">95th percentile</span>
                </div>

                {/* Max */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Maximum</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    {bottleneck.maxElapsedMinutes !== undefined ? formatDurationMinutes(bottleneck.maxElapsedMinutes) : '—'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Longest outlier</span>
                </div>
              </div>

              {iqr !== undefined && (
                <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                  <span>Interquartile Range (IQR = Q3 − Q1): <strong>{formatDurationMinutes(iqr)}</strong></span>
                  <span>Departure Ratio: <strong>{bottleneck.validObservations} instances</strong></span>
                </div>
              )}
            </div>

            {/* Timestamp Concurrency & Zero-Duration Diagnostics */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-teal-600" />
                Timestamp-Tie & Concurrency Diagnostics
              </h4>
              <p className="text-xs text-slate-600">
                In electronic health records, simultaneous timestamps denote concurrent clinical actions or system batching.
              </p>
              <div className="flex items-center gap-4 text-xs font-mono mt-1">
                <div>
                  <span className="text-slate-500">Zero-Duration Instances: </span>
                  <strong className="text-slate-900">{bottleneck.zeroDurationCount ?? 0}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Zero-Duration Frequency: </span>
                  <strong className="text-slate-900">{bottleneck.zeroDurationPercentage ?? 0}%</strong>
                </div>
              </div>
            </div>

            {/* Clinical & Operational Rationale */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 text-xs text-slate-700 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Operational & Analytical Explanation
              </div>
              <p className="leading-relaxed">
                {bottleneck.explanation}
              </p>
            </div>

            {/* Traversing Cases Drill-Down List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  Traversing Patient Cases ({traversingCases.length})
                </h4>
                <span className="text-[11px] text-slate-400">
                  Showing top {Math.min(traversingCases.length, 12)} records
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                {traversingCases.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No cases match the active filter criteria for this transition.
                  </div>
                ) : (
                  traversingCases.slice(0, 12).map((c) => {
                    const stepEvt = c.events.find(
                      (e, idx) => e.activity === fromActivity && c.events[idx + 1]?.activity === toActivity
                    );
                    const elapsed = stepEvt?.elapsedToNextMinutes ?? 0;

                    return (
                      <div
                        key={c.caseId}
                        onClick={() => onSelectCase(c)}
                        className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer text-xs group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-sky-700 group-hover:underline">
                            {c.caseId}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            {formatDateTime(c.startTime)}
                          </span>
                          {c.department && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {c.department}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-900 block">
                              {formatDurationMinutes(elapsed)}
                            </span>
                            <span className="text-[10px] text-slate-400">Step elapsed</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
