import React, { useState } from 'react';
import {
  Calendar,
  Download,
  GitFork,
  ArrowRight,
  Info,
  CheckCircle2,
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
    timeSeriesData,
    filteredActivityMetrics,
    filteredVariants,
    filteredObservations,
    filterState,
    updateFilter,
  } = useDataset();

  const navigate = useNavigate();
  const [downloadNotice, setDownloadNotice] = useState(false);

  const dominantVariant = filteredVariants.find((v) => v.isMostFrequent) || filteredVariants[0];

  const handleExportSummary = () => {
    const summaryData = [
      ['Metric', 'Value'],
      ['Dataset Name', datasetMetadata.name],
      ['Total Cases', String(filteredMetrics.totalCases)],
      ['Total Events', String(filteredMetrics.totalEvents)],
      ['Median Case Duration (Minutes)', String(filteredMetrics.medianCaseDurationMinutes)],
      ['Distinct Process Variants', String(filteredMetrics.distinctVariantsCount)],
      ['Average Events per Case', String(filteredMetrics.averageEventsPerCase)],
      ['Export Timestamp', new Date().toISOString()],
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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Overview</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Understand the patient journey, process performance, and observed delays.
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

          {/* Export Action */}
          <button
            type="button"
            onClick={handleExportSummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Summary</span>
          </button>
        </div>
      </div>

      {downloadNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Export completed: Downloaded CareFlow summary metrics CSV.</span>
        </div>
      )}

      {/* Section B: Key Metrics Row (Calculated from Loaded Dataset) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Cases"
          value={formatNumber(filteredMetrics.totalCases)}
          unit="patient cases"
          definition="Count of distinct non-empty case identifiers recorded in the event log."
          subtitle="Valid unique patient encounters"
          contextNote="Calculated from log"
        />

        <MetricCard
          label="Total Events"
          value={formatNumber(filteredMetrics.totalEvents)}
          unit="recorded events"
          definition="Count of valid event records with recognized activities and chronological timestamps."
          subtitle={`${filteredMetrics.averageEventsPerCase} avg events / case`}
          contextNote="Calculated from log"
        />

        <MetricCard
          label="Median Case Duration"
          value={formatDurationMinutes(filteredMetrics.medianCaseDurationMinutes)}
          definition="Elapsed duration between the earliest and latest recorded events for each eligible case, summarized by the statistical median."
          subtitle="From admission to disposition"
          contextNote="Statistical median"
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

      {/* Section C & D: Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Process Activity Over Time (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
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
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
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
              Event frequency across primary clinical activities. Click a bar to filter.
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
            <span>Bar color: Teal</span>
          </div>
        </div>
      </div>

      {/* Section E: Observed Process Summary (Most Frequent Pathway) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <GitFork className="w-4 h-4 text-sky-600" />
              Observed Process Summary: Most Frequent Pathway
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological activity sequence for the dominant variant ({dominantVariant?.name || 'Variant #1'}).
            </p>
          </div>
          <button
            onClick={() => navigate('/process-analysis')}
            className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            Explore all {filteredVariants.length} variants <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {dominantVariant ? (
          <>
            {/* Clinical Disclaimer Notice */}
            <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Empirical Observation Notice: </span>
                This sequence represents the single most frequently observed variant ({dominantVariant.caseCount.toLocaleString()} cases,{' '}
                {dominantVariant.percentage}%) in the event log. It is an empirical observation of past recordings rather than a prescribed or verified clinical pathway.
              </div>
            </div>

            {/* Visual Sequence Breadcrumb */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                {dominantVariant.activities.map((step, idx) => (
                  <React.Fragment key={idx}>
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-2xs text-xs">
                      <span className="w-5 h-5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800">{step}</span>
                    </div>
                    {idx < dominantVariant.activities.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                <span>
                  <strong>Cases following this sequence:</strong> {dominantVariant.caseCount.toLocaleString()} ({dominantVariant.percentage}%)
                </span>
                <span>
                  <strong>Observed Median Duration:</strong> {formatDurationMinutes(dominantVariant.medianDurationMinutes)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            No process variants match the selected filter criteria. Clear or adjust filters to view observed pathways.
          </div>
        )}
      </div>

      {/* Section F: Key Analytical Observations */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
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
    </div>
  );
};
