import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Download,
  GitFork,
  ArrowRight,
  Info,
  CheckCircle2,
  Clock,
  Activity,
  Layers,
  AlertTriangle,
  BarChart2,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useDataset } from '../context/useDataset';
import { MetricCard } from '../components/common/MetricCard';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import { HorizontalBarChart } from '../components/charts/HorizontalBarChart';
import { formatDurationMinutes, formatNumber } from '../lib/formatters';
import { useNavigate } from 'react-router-dom';

export const OverviewPage: React.FC = () => {
  const {
    datasetMetadata,
    filteredMetrics,
    filteredCases,
    timeSeriesData,
    filteredActivityMetrics,
    filteredVariants,
    filteredBottlenecks,
    filteredObservations,
    filterState,
    updateFilter,
    openExportModal,
  } = useDataset();

  const navigate = useNavigate();
  const [downloadNotice, setDownloadNotice] = useState(false);

  const dominantVariant = filteredVariants.find((v) => v.isMostFrequent) || filteredVariants[0];

  // Case Duration Distribution cohorts
  const durationCohorts = useMemo(() => {
    const buckets = [
      { label: '< 30 min', min: 0, max: 30, count: 0, color: 'bg-emerald-500', barBg: 'bg-emerald-100', text: 'text-emerald-800' },
      { label: '30 – 60 min', min: 30, max: 60, count: 0, color: 'bg-teal-500', barBg: 'bg-teal-100', text: 'text-teal-800' },
      { label: '1 – 2 hours', min: 60, max: 120, count: 0, color: 'bg-sky-500', barBg: 'bg-sky-100', text: 'text-sky-800' },
      { label: '2 – 4 hours', min: 120, max: 240, count: 0, color: 'bg-amber-500', barBg: 'bg-amber-100', text: 'text-amber-800' },
      { label: '> 4 hours', min: 240, max: Infinity, count: 0, color: 'bg-rose-500', barBg: 'bg-rose-100', text: 'text-rose-800' },
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

  const handleExportSummary = () => {
    const summaryData = [
      ['Metric Dimension', 'Value', 'Operational Context'],
      ['Dataset Name', datasetMetadata.name, 'Active clinical event log'],
      ['Total Cases', String(filteredMetrics.totalCases), 'Eligible unique patient encounters'],
      ['Total Events', String(filteredMetrics.totalEvents), 'Recorded milestone activities'],
      ['Unique Activities', String(filteredMetrics.uniqueActivitiesCount), 'Distinct clinical stages'],
      ['Average Events per Case', String(filteredMetrics.averageEventsPerCase), 'Clinical encounter complexity ratio'],
      ['Median Case Duration (Minutes)', String(filteredMetrics.medianCaseDurationMinutes), '50th percentile admission-to-disposition time'],
      ['Mean Case Duration (Minutes)', String(filteredMetrics.meanCaseDurationMinutes), 'Arithmetic average duration'],
      ['90th-Percentile Duration (Minutes)', String(filteredMetrics.p90CaseDurationMinutes), 'Prolonged stay tail latency threshold'],
      ['Distinct Process Variants', String(filteredMetrics.distinctVariantsCount), 'Observed end-to-end pathways'],
      ['Zero-Duration Cases Count', String(filteredMetrics.zeroDurationCasesCount), 'Encounters with start == completion timestamp'],
      ['Zero-Duration Rate (%)', `${filteredMetrics.zeroDurationCasesPercentage}%`, 'Concurrency prevalence'],
      ['Active Filters Applied', String(filteredMetrics.activeFilterCount), 'Stratification count'],
      ['Export Timestamp', new Date().toISOString(), 'Client-side generation'],
    ];

    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
    const csvContent = summaryData.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CareFlow_Summary_Metrics_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadNotice(true);
    setTimeout(() => setDownloadNotice(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Overview</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Clinical Process Intelligence
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Holistic patient journey analytics, length-of-stay distributions, and operational throughput monitoring.
          </p>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">Cohort Scope:</span>
            <span>{datasetMetadata.description}</span>
          </div>
        </div>

        {/* Date Filter & Export Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto text-xs">
          {/* Date range filter pills */}
          <div className="bg-white border border-slate-200 rounded-lg p-1 flex items-center shadow-2xs">
            <span className="text-slate-400 px-2 flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5" />
              <span>Range:</span>
            </span>
            {(['all', '7d', '30d', '90d'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => updateFilter({ datePreset: preset })}
                className={`px-2.5 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                  filterState.datePreset === preset
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {preset === 'all'
                  ? 'All Records'
                  : preset === '7d'
                  ? 'Last 7d'
                  : preset === '30d'
                  ? 'Last 30d'
                  : 'Last 90d'}
              </button>
            ))}
          </div>

          {/* Export Actions */}
          <button
            type="button"
            onClick={openExportModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Export Pathway Data & Reports</span>
          </button>
          <button
            type="button"
            onClick={handleExportSummary}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Quick download summary metrics CSV"
          >
            <span>Quick Summary CSV</span>
          </button>
        </div>
      </div>

      {downloadNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Export completed: Downloaded CareFlow summary metrics CSV.</span>
        </div>
      )}

      {/* Section B: Key Metrics Grid (8 Comprehensive Clinical Process KPIs) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
            Core Pathway Metrics & Encounter Statistics
          </span>
          <span className="text-[11px] font-mono">
            {filteredMetrics.activeFilterCount > 0
              ? `${filteredMetrics.activeFilterCount} active filter${filteredMetrics.activeFilterCount > 1 ? 's' : ''} applied`
              : 'Unfiltered 100% cohort'}
          </span>
        </div>

        {/* Row 1: Volume & Complexity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Cases"
            value={formatNumber(filteredMetrics.totalCases)}
            unit="patient cases"
            definition="Count of distinct non-empty case identifiers recorded in the event log meeting filter criteria."
            subtitle="Valid unique patient encounters"
            contextNote="Calculated from log"
          />

          <MetricCard
            label="Total Events"
            value={formatNumber(filteredMetrics.totalEvents)}
            unit="recorded events"
            definition="Count of valid event records with recognized activities and chronological timestamps."
            subtitle={`${filteredMetrics.averageEventsPerCase} avg events / case`}
            contextNote="Milestone depth"
          />

          <MetricCard
            label="Unique Activities"
            value={formatNumber(filteredMetrics.uniqueActivitiesCount)}
            unit="clinical actions"
            definition="Count of distinct recognized clinical activities and diagnostic stages recorded across encounters."
            subtitle="Diagnostic & therapy stages"
            contextNote="Schema coverage"
          />

          <MetricCard
            label="Distinct Process Variants"
            value={formatNumber(filteredMetrics.distinctVariantsCount)}
            unit="observed sequences"
            definition="Count of distinct observed chronological activity sequences across all completed patient encounters in the current dataset."
            subtitle={
              dominantVariant
                ? `${dominantVariant.percentage}% follow ${dominantVariant.name}`
                : 'Categorized pathways'
            }
            contextNote="Sequential grouping"
          />
        </div>

        {/* Row 2: Performance, Tail Latency & Data Quality */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Median Case Duration"
            value={formatDurationMinutes(filteredMetrics.medianCaseDurationMinutes)}
            definition="Elapsed duration between earliest and latest recorded events for each eligible case, summarized by the statistical 50th percentile (P50)."
            subtitle="Admission to disposition (P50)"
            contextNote="Statistical median"
          />

          <MetricCard
            label="Average Case Duration"
            value={formatDurationMinutes(filteredMetrics.meanCaseDurationMinutes)}
            definition="Arithmetic mean duration across all filtered patient encounters. Skewed upward by complex or restaged patient journeys."
            subtitle="Arithmetic cohort mean"
            contextNote="Right-skewed average"
          />

          <MetricCard
            label="90th-Percentile (P90) Duration"
            value={formatDurationMinutes(filteredMetrics.p90CaseDurationMinutes)}
            definition="Continuous linear quantile 90th percentile (P90) length of stay. 90% of patient encounters complete within this timeframe."
            subtitle="Prolonged encounter threshold"
            contextNote="Continuous linear P90"
          />

          <MetricCard
            label="Data Quality Health Index"
            value={
              datasetMetadata.validationReport.invalidRows === 0
                ? '100%'
                : `${Math.round(
                    (datasetMetadata.validationReport.parsedEvents /
                      datasetMetadata.validationReport.totalRows) *
                      100
                  )}%`
            }
            unit="valid records"
            definition="Proportion of raw log records successfully parsed with valid case ID, activity, and ISO/epoch timestamps."
            subtitle={`${filteredMetrics.zeroDurationCasesCount} ties (${filteredMetrics.zeroDurationCasesPercentage}%)`}
            contextNote={`${datasetMetadata.validationReport.ambiguousTimestampTies} timestamp ties`}
          />
        </div>
      </div>

      {/* Section C: Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Process Activity Over Time (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-sky-600" />
                Process Activity Over Time
              </h3>
              <p className="text-xs text-slate-500">
                Daily patient arrivals, dispositions, and median process duration trend.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600" /> Arrivals
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> Completions
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                <span className="w-3 h-0.5 bg-amber-500" /> Median Duration
              </span>
            </div>
          </div>

          <TimeSeriesChart
            labels={timeSeriesData.labels}
            arrivals={timeSeriesData.caseArrivals}
            completions={timeSeriesData.caseCompletions}
            medianDurationsHours={timeSeriesData.medianDurationsHours}
            height={260}
          />
        </div>

        {/* Activity Distribution (1 Col) */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-teal-600" />
                Activity Distribution
              </h3>
              {filterState.activity !== 'all' && (
                <button
                  onClick={() => updateFilter({ activity: 'all' })}
                  className="text-[11px] text-sky-600 hover:underline font-medium cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Event frequency across primary clinical activities. Click a bar to filter workspace.
            </p>
          </div>

          <HorizontalBarChart
            activities={filteredActivityMetrics}
            selectedActivity={filterState.activity}
            onSelectActivity={(act) => updateFilter({ activity: act })}
            height={260}
          />

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>{filteredActivityMetrics.length} distinct activities</span>
            <span className="font-mono">Click bar to filter</span>
          </div>
        </div>
      </div>

      {/* Section D: Pathway Summary & Duration Distribution Grid (2 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dominant Process Pathway */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-sky-600" />
                  Most Frequent Clinical Pathway
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dominant process variant ({dominantVariant?.name || 'Variant #1'}) observed in the event log.
                </p>
              </div>
              <button
                onClick={() => navigate('/process-analysis')}
                className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer self-start sm:self-auto shrink-0"
              >
                All {filteredVariants.length} variants <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {dominantVariant ? (
              <div className="mt-3 space-y-3">
                {/* Visual Sequence Breadcrumb */}
                <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 overflow-x-auto">
                  <div className="flex items-center gap-2 min-w-max">
                    {dominantVariant.activities.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs text-xs">
                          <span className="w-5 h-5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-800">{step}</span>
                        </div>
                        {idx < dominantVariant.activities.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      <strong>Cases following this sequence:</strong> {dominantVariant.caseCount.toLocaleString()} ({dominantVariant.percentage}%)
                    </span>
                    <span>
                      <strong>Observed Median Duration:</strong> {formatDurationMinutes(dominantVariant.medianDurationMinutes)}
                    </span>
                  </div>
                </div>

                {/* Empirical Notice */}
                <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Empirical Observation Notice: </span>
                    Observed historical frequency in log recordings. Not a prescriptive clinical guideline.
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 mt-3">
                No process variants match the selected filter criteria.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Range: {dominantVariant?.minDurationMinutes ?? 0}m – {dominantVariant?.maxDurationMinutes ?? 0}m</span>
            <span className="text-sky-600 font-semibold cursor-pointer hover:underline" onClick={() => navigate('/process-analysis')}>
              Explore in Process Analysis &rarr;
            </span>
          </div>
        </div>

        {/* Case Duration Distribution (Length of Stay Stratification) */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" />
                  Case Duration Distribution (Length of Stay)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Proportion of patient journeys categorized by total admission-to-disposition elapsed time.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                N = {formatNumber(filteredCases.length)} cases
              </span>
            </div>

            {/* Duration Cohort Progress Bars */}
            <div className="mt-3 space-y-2.5">
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
          </div>

          {/* Quantile Summary Strip */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-4 gap-2 text-center text-[10px]">
            <div className="p-1.5 rounded bg-slate-50 border border-slate-200/70">
              <span className="text-slate-400 block">Min</span>
              <span className="font-bold font-mono text-slate-800">{filteredMetrics.minCaseDurationMinutes}m</span>
            </div>
            <div className="p-1.5 rounded bg-sky-50 border border-sky-200/70">
              <span className="text-sky-600 block">Median (P50)</span>
              <span className="font-bold font-mono text-sky-900">{filteredMetrics.medianCaseDurationMinutes}m</span>
            </div>
            <div className="p-1.5 rounded bg-amber-50 border border-amber-200/70">
              <span className="text-amber-700 block">Mean (Avg)</span>
              <span className="font-bold font-mono text-amber-950">{filteredMetrics.meanCaseDurationMinutes}m</span>
            </div>
            <div className="p-1.5 rounded bg-rose-50 border border-rose-200/70">
              <span className="text-rose-700 block">Tail (P90)</span>
              <span className="font-bold font-mono text-rose-950">{filteredMetrics.p90CaseDurationMinutes}m</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section E: Operational Delay & Bottleneck Snapshot (Top 3 Transitions) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Operational Latency Snapshot: Top Observed Transition Delays
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Transitions exhibiting prolonged inter-event elapsed intervals in client-side process mining.
            </p>
          </div>
          <button
            onClick={() => navigate('/process-analysis')}
            className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            Inspect all {filteredBottlenecks.length} transitions in Process Analysis <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {filteredBottlenecks.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            No bottleneck transitions identified in current filtered cohort.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {filteredBottlenecks.slice(0, 3).map((b, idx) => (
              <div
                key={b.id}
                onClick={() => navigate('/process-analysis')}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 hover:border-amber-300 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Rank #{idx + 1} Delay
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        b.severity === 'high'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : b.severity === 'moderate'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {b.severity === 'high' ? 'High Latency' : b.severity === 'moderate' ? 'Moderate Delay' : 'Nominal'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug mb-1">
                    {b.label}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">
                    {b.explanation}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Median (P50)</span>
                    <span className="font-bold text-slate-800">{b.medianElapsedMinutes} min</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-sans">Tail (P90)</span>
                    <span className="font-bold text-rose-700">{b.p90ElapsedMinutes} min</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section F: Key Analytical Observations */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-600" />
              Key Analytical Observations
            </h3>
            <p className="text-xs text-slate-500">
              Data-derived findings generated directly from computed dataset statistics.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
            Analytical Findings — Not Verified Medical Recommendations
          </span>
        </div>

        {filteredObservations.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            No analytical observations available for current filter selection.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredObservations.map((obs) => (
              <div
                key={obs.id}
                className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">
                      {obs.title}
                    </h4>
                    <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 shrink-0">
                      {obs.metric}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed mb-2 font-medium">
                    {obs.summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 leading-relaxed">
                  {obs.detail}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section G: Cohort Data Quality & Governance Ledger */}
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-100/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          {datasetMetadata.isSynthetic ? (
            <ShieldAlert className="w-4 h-4 text-teal-600 shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <div>
            <span className="font-semibold text-slate-800">
              {datasetMetadata.isSynthetic ? 'Synthetic Demonstration Log:' : 'De-Identified Clinical Dataset:'}
            </span>{' '}
            <span className="font-mono text-slate-700">{datasetMetadata.filename}</span> (
            {formatNumber(datasetMetadata.validationReport.uniqueCases)} cases,{' '}
            {formatNumber(datasetMetadata.validationReport.parsedEvents)} events,{' '}
            {datasetMetadata.validationReport.invalidRows} invalid rows).
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => updateFilter({ datePreset: 'all', activity: 'all', variantKey: 'all', department: 'all' })}
            className="text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
          >
            Reset Filters
          </button>
          <span>•</span>
          <button
            onClick={openExportModal}
            className="text-sky-700 hover:text-sky-900 font-semibold cursor-pointer"
          >
            Export Comprehensive Report
          </button>
        </div>
      </div>
    </div>
  );
};
