import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Download,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  CaseSummary,
  CaseComplianceClassification,
  ComplianceSummaryMetrics,
  ComplianceState,
} from '../../types';
import { formatNumber } from '../../lib/formatters';
import {
  exportCaseComplianceToCSV,
  triggerBrowserDownload,
  generateExportFilename,
} from '../../lib/dataProcessing';

interface CaseComplianceTableProps {
  cases: CaseSummary[];
  classifications: CaseComplianceClassification[];
  summary: ComplianceSummaryMetrics;
  onSelectCase: (caseSummary: CaseSummary) => void;
  datasetName?: string;
}

export const CaseComplianceTable: React.FC<CaseComplianceTableProps> = ({
  cases,
  classifications,
  summary,
  onSelectCase,
  datasetName = 'dataset',
}) => {
  // Local filter states
  const [statusFilter, setStatusFilter] = useState<ComplianceState | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Map caseId -> CaseSummary for fast lookup
  const caseMap = useMemo(() => {
    const map = new Map<string, CaseSummary>();
    for (const c of cases) {
      map.set(c.caseId, c);
    }
    return map;
  }, [cases]);

  // Distinct categories present in active cohort
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of classifications) {
      if (item.workflowCategory) {
        set.add(item.workflowCategory);
      }
    }
    return Array.from(set).sort();
  }, [classifications]);

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of classifications) {
      const cat = item.workflowCategory || 'Unspecified';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [classifications]);

  // Filter classifications based on local filter criteria
  const filteredClassifications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return classifications.filter((item) => {
      // 1. Status Filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      // 2. Category Filter
      if (categoryFilter !== 'all' && item.workflowCategory !== categoryFilter) {
        return false;
      }

      // 3. Search Query (Case ID or Pathway)
      if (q) {
        const matchesId = item.caseId.toLowerCase().includes(q);
        const matchesCategory = (item.workflowCategory || '').toLowerCase().includes(q);
        const matchesDeviation = item.deviationsSummary.some((d) =>
          d.toLowerCase().includes(q)
        );
        if (!matchesId && !matchesCategory && !matchesDeviation) {
          return false;
        }
      }

      return true;
    });
  }, [classifications, statusFilter, categoryFilter, searchQuery]);

  // Pagination slicing
  const totalItems = filteredClassifications.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedClassifications = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredClassifications.slice(start, start + pageSize);
  }, [filteredClassifications, safeCurrentPage, pageSize]);

  // Reset local filters
  const handleResetFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // CSV Export handler
  const handleExportCSV = () => {
    const csvContent = exportCaseComplianceToCSV(filteredClassifications);
    const filename = generateExportFilename(datasetName, 'compliance', 'csv');
    triggerBrowserDownload(csvContent, filename, 'text/csv');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-4 p-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              Clinical Pathway Conformance & Case Compliance Diagnostics
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              Deterministic Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual encounter evaluations against empirical discovery models and analytical P90 latency benchmarks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download CSV of filtered compliance records"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            <span>Export Conformance CSV</span>
          </button>
        </div>
      </div>

      {/* Cohort KPI Ribbon */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${summary.unconfiguredCasesCount > 0 ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} gap-3`}>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
            Evaluated Cases
          </span>
          <span className="text-lg font-bold text-slate-900 font-mono">
            {formatNumber(summary.totalCasesEvaluated)}
          </span>
          <span className="text-[10px] text-slate-500 block">100% evaluated</span>
        </div>

        <div className="p-3 rounded-lg bg-teal-50/50 border border-teal-200/60">
          <span className="text-[10px] uppercase font-bold text-teal-700 block mb-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-600" /> Compliant
          </span>
          <span className="text-lg font-bold text-teal-800 font-mono">
            {formatNumber(summary.compliantCasesCount)}
          </span>
          <span className="text-[10px] text-teal-700 block font-medium">
            {summary.compliantPercentage}% adherence
          </span>
        </div>

        <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/60">
          <span className="text-[10px] uppercase font-bold text-amber-800 block mb-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" /> Delayed / SLA Risk
          </span>
          <span className="text-lg font-bold text-amber-800 font-mono">
            {formatNumber(summary.delayedCasesCount)}
          </span>
          <span className="text-[10px] text-amber-700 block font-medium">
            {summary.delayedPercentage}% exceed P90
          </span>
        </div>

        <div className="p-3 rounded-lg bg-rose-50/50 border border-rose-200/60">
          <span className="text-[10px] uppercase font-bold text-rose-800 block mb-0.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> Protocol Deviation
          </span>
          <span className="text-lg font-bold text-rose-800 font-mono">
            {formatNumber(summary.deviationCasesCount)}
          </span>
          <span className="text-[10px] text-rose-700 block font-medium">
            {summary.deviationPercentage}% structural
          </span>
        </div>

        {summary.unconfiguredCasesCount > 0 && (
          <div className="p-3 rounded-lg bg-slate-100/70 border border-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-600 block mb-0.5 flex items-center gap-1">
              <Info className="w-3 h-3 text-slate-500" /> Unconfigured
            </span>
            <span className="text-lg font-bold text-slate-800 font-mono">
              {formatNumber(summary.unconfiguredCasesCount)}
            </span>
            <span className="text-[10px] text-slate-600 block font-medium">
              {summary.unconfiguredPercentage}% unmapped
            </span>
          </div>
        )}

        <div className="p-3 rounded-lg bg-sky-50/50 border border-sky-200/60">
          <span className="text-[10px] uppercase font-bold text-sky-800 block mb-0.5">
            Avg Trace Fitness
          </span>
          <span className="text-lg font-bold text-sky-800 font-mono">
            {summary.unconfiguredCasesCount === summary.totalCasesEvaluated ? '—' : summary.averageTraceFitness.toFixed(3)}
          </span>
          <span className="text-[10px] text-sky-600 block font-medium">
            {summary.unconfiguredCasesCount === summary.totalCasesEvaluated ? 'No reference model' : 'Alignment quality'}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
            Alignment Moves
          </span>
          <span className="text-xs font-bold text-slate-800 font-mono block truncate">
            {formatNumber(summary.totalSyncMoves)} Sync
          </span>
          <span className="text-[10px] text-slate-500 block truncate font-mono">
            {summary.totalLogOnlyMoves} Log • {summary.totalModelOnlyMoves} Model
          </span>
        </div>
      </div>

      {/* Door-to-Antibiotic Latency Callout for Sepsis */}
      {summary.doorToAntibioticMetrics && (
        <div className="p-3 rounded-lg bg-sky-50/70 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-700 shrink-0" />
            <div>
              <span className="font-bold text-sky-950">
                Door-to-Antibiotic Resuscitation Interval:{' '}
                <span className="font-mono text-sky-900">
                  Median {summary.doorToAntibioticMetrics.medianMinutes}m • Empirical P90 {summary.doorToAntibioticMetrics.p90Minutes}m
                </span>
              </span>
              <span className="text-[10px] text-sky-700 block">
                Tracked separately from case duration across {formatNumber(summary.doorToAntibioticMetrics.evaluatedCasesCount)} cases. Synthetic demonstration benchmark; not a clinical standard.
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 shrink-0 self-start sm:self-auto">
            Synthetic Benchmark
          </span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <button
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All ({summary.totalCasesEvaluated})
            </button>

            <button
              onClick={() => {
                setStatusFilter('Compliant');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'Compliant'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'text-teal-700 hover:bg-teal-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Compliant ({summary.compliantCasesCount})
            </button>

            <button
              onClick={() => {
                setStatusFilter('Delayed / SLA Risk');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'Delayed / SLA Risk'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Delayed ({summary.delayedCasesCount})
            </button>

            <button
              onClick={() => {
                setStatusFilter('Protocol Deviation');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'Protocol Deviation'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Deviations ({summary.deviationCasesCount})
            </button>

            {summary.unconfiguredCasesCount > 0 && (
              <button
                onClick={() => {
                  setStatusFilter('Unconfigured Reference Model');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'Unconfigured Reference Model'
                    ? 'bg-slate-700 text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                Unconfigured ({summary.unconfiguredCasesCount})
              </button>
            )}
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Pathway Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:border-sky-500 cursor-pointer min-w-44"
              aria-label="Filter by clinical pathway"
            >
              <option value="all">All Clinical Pathways ({availableCategories.length})</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} ({categoryCounts[cat] || 0})
                </option>
              ))}
            </select>

            {/* Case ID Search */}
            <div className="relative min-w-48 flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Case ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-sky-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            {/* Reset button */}
            {(statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery !== '') && (
              <button
                onClick={handleResetFilters}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Reset filters"
                aria-label="Reset compliance filters"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Status info bar */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
          <div>
            Showing <span className="font-semibold text-slate-800">{filteredClassifications.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{classifications.length}</span> evaluated cases
            {statusFilter !== 'all' && (
              <span className="ml-1 font-medium text-slate-700">
                (Filtered by {statusFilter})
              </span>
            )}
            {categoryFilter !== 'all' && (
              <span className="ml-1 font-medium text-slate-700">
                • {categoryFilter}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-transparent font-medium text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Case Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
              <th className="py-2.5 px-3 whitespace-nowrap">Case ID</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Clinical Pathway</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Compliance Status</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Duration vs P90 SLA</th>
              <th className="py-2.5 px-3 whitespace-nowrap text-center">Trace Fitness</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Alignment Moves</th>
              <th className="py-2.5 px-3">Conformance & Delay Details</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedClassifications.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-1">
                    <p className="font-semibold text-slate-700">No cases match the selected filters</p>
                    <p className="text-[11px] text-slate-400">
                      Try clearing the status or pathway category filters to see evaluated encounters.
                    </p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-2 text-xs font-semibold text-sky-600 hover:text-sky-800 underline cursor-pointer"
                    >
                      Reset Filter Criteria
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedClassifications.map((item) => {
                const caseSummary = caseMap.get(item.caseId);
                const isCompliant = item.status === 'Compliant';
                const isDelayed = item.status === 'Delayed / SLA Risk';
                const isDeviation = item.status === 'Protocol Deviation';
                const isUnconfigured = item.status === 'Unconfigured Reference Model';

                return (
                  <tr
                    key={item.caseId}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => caseSummary && onSelectCase(caseSummary)}
                  >
                    {/* Case ID */}
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap group-hover:text-sky-600">
                      {item.caseId}
                    </td>

                    {/* Clinical Pathway */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="inline-block max-w-56 truncate text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title={item.workflowCategory}>
                        {item.workflowCategory || 'Unspecified Pathway'}
                      </span>
                    </td>

                    {/* Compliance Status Badge */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {isCompliant && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                          <CheckCircle2 className="w-3 h-3 text-teal-600" /> Compliant
                        </span>
                      )}
                      {isDelayed && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" /> Delayed / SLA Risk
                        </span>
                      )}
                      {isDeviation && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Protocol Deviation
                        </span>
                      )}
                      {isUnconfigured && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                          <Info className="w-3 h-3 text-slate-500" /> Unconfigured
                        </span>
                      )}
                    </td>

                    {/* Duration vs SLA */}
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px]">
                      {isUnconfigured ? (
                        <div>
                          <span className="font-bold text-slate-800">{item.durationMinutes.toFixed(1)}m</span>
                          <span className="text-[10px] text-slate-400 font-sans block">No reference SLA</span>
                        </div>
                      ) : (
                        <div>
                          <div>
                            <span className={`font-bold ${item.isSlaBreached ? 'text-rose-700' : 'text-slate-800'}`}>
                              {item.durationMinutes.toFixed(1)}m
                            </span>
                            <span className="text-slate-400"> / </span>
                            <span className="text-slate-500">
                              {item.slaThresholdMinutes ? `${item.slaThresholdMinutes.toFixed(1)}m` : 'N/A'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-sans block">
                            {item.isSlaBreached
                              ? `Exceeds P90 by +${(item.durationMinutes - (item.slaThresholdMinutes ?? 0)).toFixed(1)}m`
                              : 'Within empirical P90'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Trace Fitness */}
                    <td className="py-2 px-3 whitespace-nowrap text-center font-mono">
                      {isUnconfigured ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          —
                        </span>
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.traceFitness === 1.0
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {item.traceFitness.toFixed(3)}
                        </span>
                      )}
                    </td>

                    {/* Alignment Moves */}
                    <td className="py-2 px-3 whitespace-nowrap text-[11px] font-mono text-slate-600">
                      {isUnconfigured ? (
                        <span className="text-slate-400 italic">No model</span>
                      ) : (
                        <>
                          <span className="text-emerald-700 font-semibold" title="Synchronous moves">{item.syncMovesCount}S</span>
                          <span className="text-slate-300"> | </span>
                          <span className={item.logOnlyMovesCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'} title="Log-only moves">
                            {item.logOnlyMovesCount}L
                          </span>
                          <span className="text-slate-300"> | </span>
                          <span className={item.modelOnlyMovesCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'} title="Model-only moves">
                            {item.modelOnlyMovesCount}M
                          </span>
                        </>
                      )}
                    </td>

                    {/* Deviation Details */}
                    <td className="py-2 px-3 text-[11px] max-w-xs">
                      {item.deviationsSummary.length === 0 ? (
                        <span className="text-slate-400 italic">Conforms to pathway model</span>
                      ) : (
                        <div className="space-y-0.5">
                          {item.deviationsSummary.map((d, dIdx) => (
                            <span
                              key={dIdx}
                              className={`block truncate ${
                                isDeviation ? 'text-rose-700' : 'text-amber-800'
                              }`}
                              title={d}
                            >
                              • {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (caseSummary) onSelectCase(caseSummary);
                        }}
                        className="px-2 py-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 rounded border border-sky-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
                        title="Inspect case event journey and conformance alignment"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <div className="text-slate-500">
            Page <span className="font-semibold text-slate-800">{safeCurrentPage}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalPages}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && safeCurrentPage > 3) {
                pageNum = safeCurrentPage - 3 + i;
                if (pageNum > totalPages) pageNum = totalPages - (4 - i);
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded text-xs font-semibold cursor-pointer transition-colors ${
                    safeCurrentPage === pageNum
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Analytical Governance Disclaimer */}
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-700">Governance Notice:</strong> Conformance checking executes client-side deterministic heuristic checks derived from empirical Phase 3 discovery models. Latency thresholds represent empirical 90th-percentile (P90) values calibrated for operational delay monitoring, not validated clinical standard-of-care SLAs. Protocol deviations govern with priority over SLA threshold breaches.
        </p>
      </div>
    </div>
  );
};
