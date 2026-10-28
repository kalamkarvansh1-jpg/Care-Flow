import React, { useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  AlertTriangle,
  Calendar,
  User,
  Building,
  CheckCircle2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { CaseSummary } from '../../types';
import { formatDurationMinutes, formatDateTime } from '../../lib/formatters';
import { useDataset } from '../../context/useDataset';
import { evaluateCaseCompliance } from '../../lib/dataProcessing';

interface CaseDetailDrawerProps {
  caseSummary: CaseSummary | null;
  onClose: () => void;
}

export const CaseDetailDrawer: React.FC<CaseDetailDrawerProps> = ({ caseSummary, onClose }) => {
  const { datasetMetadata } = useDataset();

  const compliance = useMemo(() => {
    return caseSummary ? evaluateCaseCompliance(caseSummary) : null;
  }, [caseSummary]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (caseSummary) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [caseSummary, onClose]);

  if (!caseSummary) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-slate-900">
                  {caseSummary.caseId}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {caseSummary.eventCount} Events
                </span>
                {compliance && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      compliance.status === 'Compliant'
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : compliance.status === 'Delayed / SLA Risk'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : compliance.status === 'Protocol Deviation'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                  >
                    {compliance.status === 'Compliant' && (
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                    )}
                    {compliance.status === 'Delayed / SLA Risk' && (
                      <Clock className="w-3 h-3 text-amber-600" />
                    )}
                    {compliance.status === 'Protocol Deviation' && (
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                    )}
                    {compliance.status === 'Unconfigured Reference Model' && (
                      <Info className="w-3 h-3 text-slate-500" />
                    )}
                    {compliance.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Observed patient pathway journey and event timestamps
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close case drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Case Summary Cards */}
          <div className="p-5 border-b border-slate-200 grid grid-cols-2 gap-3 text-xs bg-white">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Total Elapsed Case Duration
              </span>
              <span className="text-base font-bold text-slate-900 font-mono">
                {formatDurationMinutes(caseSummary.durationMinutes)}
              </span>
              <p className="text-[10px] text-slate-500 mt-1">
                From first to last recorded event
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Observed Pathway Variant
              </span>
              <span className="text-xs font-bold text-sky-800 line-clamp-1">
                {caseSummary.variantKey.split(' → ').length} Steps Sequence
              </span>
              <p className="text-[10px] text-slate-500 mt-1">
                Categorized by activity sequence
              </p>
            </div>
          </div>

          {/* Conformance & Compliance Diagnostic Panel */}
          {compliance && (
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-2.5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  Clinical Pathway Conformance & SLA Diagnostic
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 truncate">
                  Model: {compliance.workflowCategory || 'Unspecified'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="p-2 rounded bg-white border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-semibold">TRACE FITNESS</span>
                  <span className="font-bold text-slate-900 font-mono text-xs">
                    {compliance.status === 'Unconfigured Reference Model' ? '—' : compliance.traceFitness.toFixed(3)}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {compliance.status === 'Unconfigured Reference Model'
                      ? 'No reference model'
                      : `${compliance.syncMovesCount}S | ${compliance.logOnlyMovesCount}L | ${compliance.modelOnlyMovesCount}M`}
                  </span>
                </div>

                <div className="p-2 rounded bg-white border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-semibold">P90 SLA BENCHMARK</span>
                  <span className="font-bold text-slate-900 font-mono text-xs">
                    {compliance.slaThresholdMinutes ? `${compliance.slaThresholdMinutes.toFixed(1)}m` : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {compliance.status === 'Unconfigured Reference Model' ? 'No SLA configured' : 'Empirical P90 threshold'}
                  </span>
                </div>

                <div className="p-2 rounded bg-white border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-semibold">DELAY STATUS</span>
                  <span
                    className={`font-bold font-mono text-xs ${
                      compliance.status === 'Unconfigured Reference Model'
                        ? 'text-slate-600'
                        : compliance.isSlaBreached
                        ? 'text-rose-700'
                        : 'text-teal-700'
                    }`}
                  >
                    {compliance.status === 'Unconfigured Reference Model'
                      ? 'Unconfigured'
                      : compliance.isSlaBreached
                      ? 'SLA Breached'
                      : 'Within Threshold'}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {compliance.status === 'Unconfigured Reference Model'
                      ? 'Model unmapped'
                      : compliance.isSlaBreached
                      ? `+${(caseSummary.durationMinutes - (compliance.slaThresholdMinutes ?? 0)).toFixed(1)}m over`
                      : 'Operational nominal'}
                  </span>
                </div>
              </div>

              {/* Door-to-Antibiotic Interval for Sepsis */}
              {compliance.doorToAntibioticMinutes !== undefined && compliance.doorToAntibioticMinutes !== null && (
                <div className="p-2 rounded-lg bg-sky-50/80 border border-sky-200 text-[11px] text-sky-900 flex items-center justify-between">
                  <span className="font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    Door-to-Antibiotic Resuscitation Interval:
                  </span>
                  <span className="font-mono font-bold text-sky-800">
                    {compliance.doorToAntibioticMinutes.toFixed(1)} min
                  </span>
                </div>
              )}

              {compliance.deviationsSummary.length > 0 ? (
                <div className="p-2.5 rounded-lg border border-amber-200/80 bg-amber-50/60 text-[11px] text-amber-900 space-y-1">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Diagnostic Findings ({compliance.deviationsSummary.length}):
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                    {compliance.deviationsSummary.map((dev, idx) => (
                      <li key={idx}>{dev}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-2 rounded bg-teal-50/50 border border-teal-200/60 text-[11px] text-teal-800 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  Case adheres to modeled activity sequencing and analytical latency benchmark.
                </div>
              )}

              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Info className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Empirical P90 benchmark is a configurable analytical threshold, not a validated clinical SLA.</span>
              </div>
            </div>
          )}

          {/* Time Span Bar */}
          <div className="px-5 py-2.5 bg-slate-100/60 border-b border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Start: {formatDateTime(caseSummary.startTime)}
            </span>
            <span>
              End: {formatDateTime(caseSummary.endTime)}
            </span>
          </div>

          {/* Chronological Event Log List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Chronological Event Sequence ({caseSummary.events.length} records)
            </h4>

            <div className="relative pl-5 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {caseSummary.events.map((evt, idx) => (
                <div key={evt.id} className="relative group">
                  {/* Timeline circle */}
                  <div className="absolute -left-5 top-1.5 w-4 h-4 rounded-full border-2 border-sky-600 bg-white flex items-center justify-center text-[9px] font-bold text-sky-800">
                    {evt.eventIndex}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors text-xs space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-900 leading-tight">
                        {evt.activity}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        {formatDateTime(evt.timestamp)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      {evt.resource && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {evt.resource}
                        </span>
                      )}
                      {evt.department && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-400" />
                          {evt.department}
                        </span>
                      )}
                    </div>

                    {/* Inter-event elapsed duration to next activity */}
                    {idx < caseSummary.events.length - 1 && evt.elapsedToNextMinutes !== null && (
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">
                          Elapsed to next step:
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            evt.elapsedToNextMinutes > 60
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {formatDurationMinutes(evt.elapsedToNextMinutes)}
                        </span>
                      </div>
                    )}

                    {evt.isTimestampTie && (
                      <div className="mt-1 p-1.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Ambiguous timestamp tie: identical timestamp to adjacent record.</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>{datasetMetadata.isSynthetic ? 'Synthetic Demonstration Record' : 'Imported Dataset Record'}</span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
