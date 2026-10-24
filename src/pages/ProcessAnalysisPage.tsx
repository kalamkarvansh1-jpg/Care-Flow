import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  RotateCcw,
  GitFork,
  ArrowRight,
  Clock,
  Layers,
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  Table,
  BarChart3,
  Calendar,
  Building,
  Network,
} from 'lucide-react';
import { useDataset } from '../context/useDataset';
import { CaseDetailDrawer } from '../components/tables/CaseDetailDrawer';
import { BottleneckDetailDrawer } from '../components/tables/BottleneckDetailDrawer';
import { BottleneckChart } from '../components/charts/BottleneckChart';
import { ProcessFlowGraph } from '../components/charts/ProcessFlowGraph';
import {
  formatDurationMinutes,
  formatDateTime,
  formatNumber,
  formatPercentage,
} from '../lib/formatters';
import { exportEventsToCSV } from '../lib/dataProcessing';
import { CaseSummary, BottleneckItem, ActivityTransition } from '../types';

export const ProcessAnalysisPage: React.FC = () => {
  const {
    datasetMetadata,
    allCases,
    allVariants,
    allActivityMetrics,
    filteredCases,
    filteredEvents,
    filteredVariants,
    filteredActivityMetrics,
    filteredTransitions,
    filteredBottlenecks,
    filteredMetrics,
    filterState,
    updateFilter,
    resetFilters,
    openExportModal,
  } = useDataset();

  // Drawer state
  const [selectedCaseSummary, setSelectedCaseSummary] = useState<CaseSummary | null>(null);
  const [selectedBottleneck, setSelectedBottleneck] = useState<BottleneckItem | null>(null);

  // Table pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState<'timestamp' | 'caseId' | 'activity' | 'elapsed'>(
    'timestamp'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Node inspection state in DFG
  const [selectedNodeActivity, setSelectedNodeActivity] = useState<string | null>(null);
  const [transitionThreshold, setTransitionThreshold] = useState<number>(0); // 0 = all, 10 = >=10%

  // Bottleneck view toggle (Table vs Chart vs Matrix)
  const [bottleneckView, setBottleneckView] = useState<'table' | 'chart' | 'matrix'>('table');

  // Case Duration Distribution cohorts
  const durationCohorts = useMemo(() => {
    const buckets = [
      { label: '< 30 min', min: 0, max: 30, count: 0, color: 'bg-emerald-500' },
      { label: '30 – 60 min', min: 30, max: 60, count: 0, color: 'bg-teal-500' },
      { label: '1 – 2 hours', min: 60, max: 120, count: 0, color: 'bg-sky-500' },
      { label: '2 – 4 hours', min: 120, max: 240, count: 0, color: 'bg-amber-500' },
      { label: '> 4 hours', min: 240, max: Infinity, count: 0, color: 'bg-rose-500' },
    ];

    filteredCases.forEach((c) => {
      const d = c.durationMinutes;
      for (const b of buckets) {
        if (d >= b.min && (b.max === Infinity ? true : d < b.max)) {
          b.count++;
          break;
        }
      }
    });

    const total = filteredCases.length || 1;
    return buckets.map((b) => ({
      ...b,
      percentage: Math.round((b.count / total) * 1000) / 10,
    }));
  }, [filteredCases]);

  // Sort filtered events
  const sortedEvents = useMemo(() => {
    const list = [...filteredEvents];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'timestamp') {
        comparison = a.timestampMs - b.timestampMs;
      } else if (sortField === 'caseId') {
        comparison = a.caseId.localeCompare(b.caseId);
      } else if (sortField === 'activity') {
        comparison = a.activity.localeCompare(b.activity);
      } else if (sortField === 'elapsed') {
        const valA = a.elapsedToNextMinutes ?? -1;
        const valB = b.elapsedToNextMinutes ?? -1;
        comparison = valA - valB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [filteredEvents, sortField, sortDirection]);

  // Paginated slice derived cleanly
  const totalPages = Math.ceil(sortedEvents.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedEvents = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedEvents.slice(start, start + pageSize);
  }, [sortedEvents, safeCurrentPage, pageSize]);

  const handleSort = (field: 'timestamp' | 'caseId' | 'activity' | 'elapsed') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleExportFilteredCSV = () => {
    const csvContent = exportEventsToCSV(sortedEvents);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `CareFlow_Filtered_Event_Log_${datasetMetadata.name.replace(/\s+/g, '_')}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRowClick = (caseId: string) => {
    const foundCase =
      filteredCases.find((c) => c.caseId === caseId) ||
      allCases.find((c) => c.caseId === caseId);
    if (foundCase) {
      setSelectedCaseSummary(foundCase);
    }
  };

  // Filtered transitions for Process Flow visualization based on threshold
  const visibleTransitions = useMemo(() => {
    return filteredTransitions.filter((t) => t.percentageOfDepartures >= transitionThreshold);
  }, [filteredTransitions, transitionThreshold]);

  // Node details for Process Flow inspect
  const inspectedActivityMetric = selectedNodeActivity
    ? filteredActivityMetrics.find((a) => a.activity === selectedNodeActivity)
    : null;

  const incomingTransitions = useMemo(() => {
    if (!selectedNodeActivity) return [];
    return filteredTransitions.filter((t) => t.to === selectedNodeActivity);
  }, [filteredTransitions, selectedNodeActivity]);

  const outgoingTransitions = useMemo(() => {
    if (!selectedNodeActivity) return [];
    return filteredTransitions.filter((t) => t.from === selectedNodeActivity);
  }, [filteredTransitions, selectedNodeActivity]);

  // Extract distinct departments for clinic stratification
  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    allCases.forEach((c) => {
      if (c.department) set.add(c.department);
    });
    return Array.from(set).sort();
  }, [allCases]);

  // Handler to inspect bottleneck or transition detail
  const handleSelectTransition = (t: ActivityTransition) => {
    const match = filteredBottlenecks.find((b) => b.from === t.from && b.to === t.to);
    if (match) {
      setSelectedBottleneck(match);
    } else {
      setSelectedBottleneck({
        id: t.id,
        type: 'transition',
        from: t.from,
        to: t.to,
        label: `${t.from} → ${t.to}`,
        medianElapsedMinutes: t.medianElapsedMinutes,
        p90ElapsedMinutes: t.p90ElapsedMinutes,
        meanElapsedMinutes: t.meanElapsedMinutes,
        caseCount: t.observationCount,
        validObservations: t.observationCount,
        severity:
          t.medianElapsedMinutes > 60 || t.p90ElapsedMinutes > 120
            ? 'high'
            : t.medianElapsedMinutes > 30
            ? 'moderate'
            : 'nominal',
        explanation: `Empirically observed transition between ${t.from} and ${t.to} across ${t.observationCount} cases.`,
        p25ElapsedMinutes: t.p25ElapsedMinutes,
        p75ElapsedMinutes: t.p75ElapsedMinutes,
        p95ElapsedMinutes: t.p95ElapsedMinutes,
        minElapsedMinutes: t.minElapsedMinutes,
        maxElapsedMinutes: t.maxElapsedMinutes,
        zeroDurationCount: t.zeroDurationCount,
        zeroDurationPercentage: t.zeroDurationPercentage,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Section A: Page Header & Unified Filters */}
      <div className="space-y-3 pb-4 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Process Analysis</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Explore observed pathways, event timings, and process variations.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={openExportModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>Export Pathway Data & Reports</span>
            </button>
            <button
              onClick={handleExportFilteredCSV}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Quick download filtered events CSV"
            >
              <span>Quick Events CSV</span>
            </button>
          </div>
        </div>

        {/* Unified Practical Filter Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
            {/* Search Case ID */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterState.caseIdSearch}
                onChange={(e) => updateFilter({ caseIdSearch: e.target.value })}
                placeholder="Filter by Case ID (e.g. PAT-2026-9041)..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-sky-500 focus:bg-white transition-colors"
              />
            </div>

            {/* Activity Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
              <span className="text-slate-400 shrink-0 font-medium">Activity:</span>
              <select
                value={filterState.activity}
                onChange={(e) => updateFilter({ activity: e.target.value })}
                className="bg-transparent font-semibold text-slate-800 w-full focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Activities (Any step)</option>
                {allActivityMetrics.map((a) => (
                  <option key={a.activity} value={a.activity}>
                    {a.activity} ({a.caseCount} cases)
                  </option>
                ))}
              </select>
            </div>

            {/* Variant Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
              <span className="text-slate-400 shrink-0 font-medium">Variant:</span>
              <select
                value={filterState.variantKey}
                onChange={(e) => updateFilter({ variantKey: e.target.value })}
                className="bg-transparent font-semibold text-slate-800 w-full focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Process Variants ({allVariants.length})</option>
                {allVariants.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.name} ({v.caseCount} cases, {v.percentage}%)
                  </option>
                ))}
              </select>
            </div>

            {/* Department / Clinic Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400 shrink-0 font-medium">Clinic:</span>
              <select
                value={filterState.department}
                onChange={(e) => updateFilter({ department: e.target.value })}
                className="bg-transparent font-semibold text-slate-800 w-full focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Clinics / Depts</option>
                {allDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Preset */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400 shrink-0 font-medium">Range:</span>
              <select
                value={filterState.datePreset}
                onChange={(e) => updateFilter({ datePreset: e.target.value as any })}
                className="bg-transparent font-semibold text-slate-800 w-full focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Records</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips & Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center flex-wrap gap-2 text-slate-500">
              <span className="font-semibold text-slate-700">Active Cohort:</span>
              <span>
                {formatNumber(filteredCases.length)} of{' '}
                {formatNumber(datasetMetadata.validationReport.uniqueCases)} cases (
                {formatNumber(sortedEvents.length)} events)
              </span>
              {filterState.activity !== 'all' && (
                <span className="bg-sky-50 text-sky-700 px-2 py-0.5 rounded border border-sky-200 text-[11px] font-medium flex items-center gap-1">
                  Activity: {filterState.activity}
                  <button onClick={() => updateFilter({ activity: 'all' })} className="hover:text-sky-900 ml-0.5">×</button>
                </span>
              )}
              {filterState.variantKey !== 'all' && (
                <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-200 text-[11px] font-medium flex items-center gap-1">
                  Specific Variant
                  <button onClick={() => updateFilter({ variantKey: 'all' })} className="hover:text-teal-900 ml-0.5">×</button>
                </span>
              )}
              {filterState.department !== 'all' && (
                <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 text-[11px] font-medium flex items-center gap-1">
                  Clinic: {filterState.department}
                  <button onClick={() => updateFilter({ department: 'all' })} className="hover:text-purple-900 ml-0.5">×</button>
                </span>
              )}
              {filterState.transitionKey && filterState.transitionKey !== 'all' && (
                <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 text-[11px] font-medium flex items-center gap-1">
                  Transition: {filterState.transitionKey}
                  <button onClick={() => updateFilter({ transitionKey: 'all' })} className="hover:text-amber-950 ml-0.5">×</button>
                </span>
              )}
            </div>

            <button
              onClick={resetFilters}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section B: Process Flow Visualization (Observed Directly-Follows Graph) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <GitFork className="w-4 h-4 text-sky-600" />
              Observed Process Flow Visualization
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Empirical pathway graph based on observed transition frequencies from the event log.
            </p>
          </div>

          {/* Transition Threshold Control */}
          <div className="flex items-center gap-2 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Filter transitions:</span>
            <select
              value={transitionThreshold}
              onChange={(e) => setTransitionThreshold(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value={0}>All Transitions (100% of paths)</option>
              <option value={15}>Primary Transitions (≥ 15% frequency)</option>
              <option value={30}>Major Pathways (≥ 30% frequency)</option>
            </select>
          </div>
        </div>

        {/* Visual Workflow Canvas */}
        <div className="p-5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-5">
          <ProcessFlowGraph
            activities={filteredActivityMetrics}
            transitions={visibleTransitions}
            cases={filteredCases}
            selectedNodeActivity={selectedNodeActivity}
            onSelectNode={setSelectedNodeActivity}
            onSelectTransition={handleSelectTransition}
            transitionThreshold={transitionThreshold}
          />

          {/* Node Inspection Detail Bar */}
          {inspectedActivityMetric && (
            <div className="p-4 bg-white rounded-xl border border-sky-200 shadow-2xs space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <span className="font-bold text-slate-900 text-sm">
                    {inspectedActivityMetric.activity}
                  </span>
                  <span className="text-slate-500 ml-2">
                    ({inspectedActivityMetric.frequency.toLocaleString()} recorded events in{' '}
                    {inspectedActivityMetric.caseCount.toLocaleString()} cases)
                  </span>
                </div>
                <button
                  onClick={() => updateFilter({ activity: inspectedActivityMetric.activity })}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-semibold cursor-pointer self-start sm:self-auto"
                >
                  Filter Workspace to this Activity
                </button>
              </div>

              {/* Incoming & Outgoing Flow Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                {/* Incoming */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <span className="font-bold text-slate-700 block mb-1.5">
                    Preceding Steps (Incoming Flow):
                  </span>
                  {incomingTransitions.length === 0 ? (
                    <span className="text-slate-400 italic">Initiating pathway milestone (no preceding steps)</span>
                  ) : (
                    <ul className="space-y-1">
                      {incomingTransitions.map((t) => (
                        <li key={t.id} className="flex items-center justify-between">
                          <span className="text-slate-700 truncate pr-2">← {t.from}</span>
                          <span className="font-mono text-slate-500 shrink-0" title={`P90: ${t.p90ElapsedMinutes}m`}>
                            {t.observationCount} cases ({t.medianElapsedMinutes}m med • P90: {t.p90ElapsedMinutes}m)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Outgoing */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <span className="font-bold text-slate-700 block mb-1.5">
                    Succeeding Steps (Outgoing Flow):
                  </span>
                  {outgoingTransitions.length === 0 ? (
                    <span className="text-slate-400 italic">Terminal pathway milestone (no succeeding steps)</span>
                  ) : (
                    <ul className="space-y-1">
                      {outgoingTransitions.map((t) => (
                        <li key={t.id} className="flex items-center justify-between">
                          <span className="text-slate-700 truncate pr-2">→ {t.to}</span>
                          <span className="font-mono text-slate-500 shrink-0" title={`P90: ${t.p90ElapsedMinutes}m`}>
                            {t.percentageOfDepartures}% ({t.medianElapsedMinutes}m med • P90: {t.p90ElapsedMinutes}m)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section C: Process Variants Section */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-teal-600" />
              Observed Process Variants ({filteredVariants.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Discovered chronological activity pathways ranked by observed case frequency. Click a variant to filter.
            </p>
          </div>
          {filterState.variantKey !== 'all' && (
            <button
              onClick={() => updateFilter({ variantKey: 'all' })}
              className="text-xs text-sky-600 hover:underline font-medium cursor-pointer"
            >
              Clear Variant Filter
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {filteredVariants.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
              No process variants match the selected filter criteria.
            </div>
          ) : (
            filteredVariants.map((variant) => {
              const isSelected = filterState.variantKey === variant.key;
              return (
                <div
                  key={variant.id}
                  onClick={() =>
                    updateFilter({ variantKey: isSelected ? 'all' : variant.key })
                  }
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-sky-50/70 border-sky-400 ring-1 ring-sky-200'
                      : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {variant.name}
                    </span>
                    {variant.isMostFrequent && (
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                        Most Frequent Variant
                      </span>
                    )}
                    {isSelected && (
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                        Active Filter
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-slate-500 text-xs">
                    <span>
                      <strong>{formatNumber(variant.caseCount)}</strong> cases (
                      {formatPercentage(variant.percentage)})
                    </span>
                    <span>
                      Median Duration: <strong>{formatDurationMinutes(variant.medianDurationMinutes)}</strong>
                    </span>
                  </div>
                </div>

                {/* Sequence chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60">
                  {variant.activities.map((step, sIdx) => (
                    <React.Fragment key={sIdx}>
                      <span className="px-2 py-1 rounded bg-white border border-slate-200 text-slate-700 font-medium text-[11px]">
                        {step}
                      </span>
                      {sIdx < variant.activities.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Step Transitions Breakdown */}
                {variant.stepTransitions && variant.stepTransitions.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-slate-200/50 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-slate-400 font-medium">Step Transitions (Med / P90):</span>
                    {variant.stepTransitions.map((st, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const match = filteredBottlenecks.find((b) => b.from === st.from && b.to === st.to);
                          if (match) {
                            setSelectedBottleneck(match);
                          } else {
                            const tr = filteredTransitions.find((t) => t.from === st.from && t.to === st.to);
                            if (tr) handleSelectTransition(tr);
                          }
                        }}
                        className="px-2 py-0.5 rounded bg-white hover:bg-sky-50 hover:border-sky-300 border border-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                        title="Click to inspect parametric distribution & patient cohort"
                      >
                        <span className="font-semibold text-slate-800">{st.from} → {st.to}:</span>
                        <span className="font-mono text-slate-600">{st.medianElapsedMinutes}m</span>
                        <span className="text-slate-300">/</span>
                        <span className="font-mono text-rose-700 font-semibold">{st.p90ElapsedMinutes}m</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }))}
        </div>
      </div>

      {/* Section D: Bottleneck Analysis (Ranked Inter-Event Elapsed Times) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              Bottleneck Analysis: Longest Observed Inter-Event Elapsed Times
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ranked activity transitions exhibiting notable latency between consecutive recorded timestamps.
            </p>
          </div>

          {/* Table vs Chart vs Matrix view toggle */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setBottleneckView('table')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                bottleneckView === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Ranked Delays</span>
            </button>
            <button
              onClick={() => setBottleneckView('chart')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                bottleneckView === 'chart'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Latency Chart</span>
            </button>
            <button
              onClick={() => setBottleneckView('matrix')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                bottleneckView === 'matrix'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>All Transitions ({filteredTransitions.length})</span>
            </button>
          </div>
        </div>

        {/* Calculation Note */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span>
            <strong>Calculation Note:</strong> Inter-event elapsed time measures timestamp differences between consecutive recorded events. It represents elapsed operational intervals within the event log, and should not be assumed to be confirmed medical delay without external clinical validation.
          </span>
        </div>

        {bottleneckView === 'chart' ? (
          <div className="pt-2">
            <BottleneckChart
              bottlenecks={filteredBottlenecks}
              height={260}
              onSelectBottleneck={setSelectedBottleneck}
            />
          </div>
        ) : bottleneckView === 'matrix' ? (
          /* Empirical Transition Matrix Table (Option B Schema) */
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Directly-Follows Transition</th>
                  <th className="py-2.5 px-3 text-right">Valid Observations</th>
                  <th className="py-2.5 px-3 text-right">Distinct Cases</th>
                  <th className="py-2.5 px-3 text-right">Departure Share</th>
                  <th className="py-2.5 px-3 text-right">Median Elapsed</th>
                  <th className="py-2.5 px-3 text-right">P90 Tail</th>
                  <th className="py-2.5 px-3 text-right">Mean Elapsed</th>
                  <th className="py-2.5 px-3 text-right">IQR (P75-P25)</th>
                  <th className="py-2.5 px-3 text-center">Zero-Duration Ties</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredTransitions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-xs text-slate-400 font-sans">
                      No transitions match the current filter selection.
                    </td>
                  </tr>
                ) : (
                  filteredTransitions.map((t) => {
                    const iqr =
                      t.p75ElapsedMinutes !== undefined && t.p25ElapsedMinutes !== undefined
                        ? `${Math.round((t.p75ElapsedMinutes - t.p25ElapsedMinutes) * 10) / 10}m`
                        : '—';
                    return (
                      <tr
                        key={t.id}
                        onClick={() => handleSelectTransition(t)}
                        className="hover:bg-sky-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3 font-semibold font-sans text-slate-900 group-hover:text-sky-900 flex items-center gap-1.5">
                          <Network className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span>{t.from} → {t.to}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {t.observationCount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {t.caseCount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          {t.percentageOfDepartures}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatDurationMinutes(t.medianElapsedMinutes)}
                        </td>
                        <td
                          className="py-2.5 px-3 text-right font-bold text-rose-700"
                          title={`P90: ${t.p90ElapsedMinutes} minutes`}
                        >
                          {formatDurationMinutes(t.p90ElapsedMinutes)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {formatDurationMinutes(t.meanElapsedMinutes)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {iqr}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 text-[10px]">
                          {t.zeroDurationCount ?? 0} ({t.zeroDurationPercentage ?? 0}%)
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectTransition(t);
                            }}
                            className="text-sky-600 hover:text-sky-800 text-[11px] font-semibold cursor-pointer"
                          >
                            Inspect &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Ranked Table */
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Observed Transition</th>
                  <th className="py-2.5 px-3 text-right">Valid Observations</th>
                  <th className="py-2.5 px-3 text-right">Distinct Cases</th>
                  <th className="py-2.5 px-3 text-right">Median Elapsed Time</th>
                  <th className="py-2.5 px-3 text-right">P90 (90th Percentile)</th>
                  <th className="py-2.5 px-3 text-right">Mean Elapsed Time</th>
                  <th className="py-2.5 px-3 text-center">Observed Latency Tier</th>
                  <th className="py-2.5 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBottlenecks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                      No bottleneck transitions recorded in current filtered cohort.
                    </td>
                  </tr>
                ) : (
                  filteredBottlenecks.slice(0, 8).map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBottleneck(b)}
                      className="hover:bg-amber-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900 group-hover:text-amber-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{b.label}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                        {b.validObservations.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                        {b.caseCount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                        {formatDurationMinutes(b.medianElapsedMinutes)}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right font-bold text-rose-700 font-mono"
                        title={`P90: ${b.p90ElapsedMinutes} minutes`}
                      >
                        {formatDurationMinutes(b.p90ElapsedMinutes)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                        {formatDurationMinutes(b.meanElapsedMinutes)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            b.severity === 'high'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : b.severity === 'moderate'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {b.severity === 'high'
                            ? 'High Latency (> 60m / P90 > 120m)'
                            : b.severity === 'moderate'
                            ? 'Moderate (30-60m)'
                            : 'Nominal'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-amber-600 group-hover:text-amber-800 text-[11px] font-medium inline-flex items-center gap-0.5">
                          Inspect &rarr;
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section D2: Case Duration Distribution & Length-of-Stay Quantiles */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-600" />
              Case Duration Distribution & Length of Stay
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Empirical length-of-stay distribution across filtered patient encounters ({formatNumber(filteredCases.length)} cases).
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span>Median: <strong>{filteredMetrics.medianCaseDurationMinutes}m</strong></span>
            <span>•</span>
            <span>Tail P90: <strong className="text-rose-700">{filteredMetrics.p90CaseDurationMinutes}m</strong></span>
          </div>
        </div>

        {/* Quantile Ladder & Duration Bins */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* 5 Duration Bins (7 Cols) */}
          <div className="lg:col-span-7 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Length-of-Stay Cohort Stratification
            </span>
            {durationCohorts.map((cohort) => (
              <div key={cohort.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{cohort.label}</span>
                  <span className="font-mono text-slate-500">
                    <strong>{formatNumber(cohort.count)}</strong> cases ({cohort.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full ${cohort.color} transition-all duration-300 rounded-full`}
                    style={{ width: `${Math.max(cohort.percentage > 0 ? 2 : 0, cohort.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Statistical Quantiles Card (5 Cols) */}
          <div className="lg:col-span-5 p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between space-y-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Continuous Linear Percentiles (NumPy / PM4Py)
              </span>

              <div className="grid grid-cols-3 gap-2 font-mono text-center text-[11px]">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 text-[10px] block font-sans">Min</span>
                  <span className="font-bold text-slate-800">{filteredMetrics.minCaseDurationMinutes}m</span>
                </div>
                <div className="p-2 bg-sky-50 rounded-lg border border-sky-200">
                  <span className="text-sky-600 text-[10px] block font-sans">P50 (Median)</span>
                  <span className="font-bold text-sky-900">{filteredMetrics.medianCaseDurationMinutes}m</span>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-amber-700 text-[10px] block font-sans">Mean (Avg)</span>
                  <span className="font-bold text-amber-950">{filteredMetrics.meanCaseDurationMinutes}m</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 text-[10px] block font-sans">Max</span>
                  <span className="font-bold text-slate-800">{filteredMetrics.maxCaseDurationMinutes}m</span>
                </div>
                <div className="p-2 bg-rose-50 rounded-lg border border-rose-200">
                  <span className="text-rose-700 text-[10px] block font-sans">P90 Tail</span>
                  <span className="font-bold text-rose-950">{filteredMetrics.p90CaseDurationMinutes}m</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 text-[10px] block font-sans">Zero Ties</span>
                  <span className="font-bold text-slate-800">{filteredMetrics.zeroDurationCasesCount}</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
              Computed strictly from chronological event logs using linear quantile interpolation without asymptotic assumptions.
            </p>
          </div>
        </div>
      </div>

      {/* Section E: Event Log Explorer */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Event Log Explorer
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Normalized tabular event records. Click any row to inspect complete patient journey in the detail drawer.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Showing {formatNumber(paginatedEvents.length)} of {formatNumber(sortedEvents.length)} rows
            </span>
          </div>
        </div>

        {/* Table Controls */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded p-1 text-xs focus:outline-hidden"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <span className="text-[11px] text-slate-400">
            Click row for Case Detail Drawer
          </span>
        </div>

        {/* Event Log Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th
                  onClick={() => handleSort('caseId')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-800"
                >
                  Case ID {sortField === 'caseId' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-2.5 px-2 text-center">Step #</th>
                <th
                  onClick={() => handleSort('activity')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-800"
                >
                  Activity {sortField === 'activity' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('timestamp')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-800"
                >
                  Timestamp {sortField === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-2.5 px-3">Next Activity</th>
                <th
                  onClick={() => handleSort('elapsed')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-800"
                >
                  Elapsed to Next {sortField === 'elapsed' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-2.5 px-3">Performer / Resource</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {paginatedEvents.map((evt) => (
                <tr
                  key={evt.id}
                  onClick={() => handleRowClick(evt.caseId)}
                  className="hover:bg-sky-50/40 transition-colors cursor-pointer group"
                >
                  <td className="py-2.5 px-3 font-semibold text-sky-700 group-hover:underline">
                    {evt.caseId}
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-400">
                    {evt.eventIndex}
                  </td>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                    {evt.activity}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                    {formatDateTime(evt.timestamp)}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-600">
                    {evt.nextActivity || <span className="text-slate-300 font-mono">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                    {evt.elapsedToNextMinutes !== null && evt.elapsedToNextMinutes !== undefined ? (
                      <span className={evt.elapsedToNextMinutes > 60 ? 'text-amber-700' : 'text-slate-700'}>
                        {formatDurationMinutes(evt.elapsedToNextMinutes)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-500">
                    {evt.resource || '—'}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-500">
                    {evt.department || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(evt.caseId);
                      }}
                      className="text-sky-600 hover:text-sky-800 p-1 rounded hover:bg-sky-100 cursor-pointer"
                      title="Inspect complete case trajectory"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {paginatedEvents.length === 0 && (
            <div className="py-10 text-center text-xs text-slate-400">
              No events match the selected filter criteria.
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between text-xs pt-2">
          <span className="text-slate-500">
            Page {safeCurrentPage} of {totalPages}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
              disabled={safeCurrentPage === 1}
              className={`p-1.5 rounded border border-slate-200 cursor-pointer transition-colors ${
                safeCurrentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono font-medium">{safeCurrentPage}</span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
              disabled={safeCurrentPage >= totalPages}
              className={`p-1.5 rounded border border-slate-200 cursor-pointer transition-colors ${
                safeCurrentPage >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Case Detail Drawer (Opens on row click, NO third page) */}
      <CaseDetailDrawer
        caseSummary={selectedCaseSummary}
        onClose={() => setSelectedCaseSummary(null)}
      />

      {/* Bottleneck Detail Drawer (Phase 4 Step 4: Parametric distribution, zero-duration concurrency, cohort isolation) */}
      <BottleneckDetailDrawer
        bottleneck={selectedBottleneck}
        cases={filteredCases}
        onClose={() => setSelectedBottleneck(null)}
        onFilterToTransition={(transitionKey) => {
          updateFilter({ transitionKey });
        }}
        onSelectCase={(caseSummary) => {
          setSelectedCaseSummary(caseSummary);
        }}
      />
    </div>
  );
};
