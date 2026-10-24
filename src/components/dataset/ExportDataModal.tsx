import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  CheckCircle2,
  Filter,
  ShieldAlert,
  Layers,
  Clock,
  Users,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { useDataset } from '../../context/useDataset';
import {
  exportEventsToCSV,
  exportTransitionsToCSV,
  exportBottlenecksToCSV,
  exportVariantsToCSV,
  exportCasesToCSV,
  generateExecutiveReportMarkdown,
  exportCohortReportJSON,
  generateExportFilename,
  triggerBrowserDownload,
} from '../../lib/dataProcessing';
import { formatNumber } from '../../lib/formatters';

export const ExportDataModal: React.FC = () => {
  const {
    isExportModalOpen,
    closeExportModal,
    datasetMetadata,
    filteredEvents,
    filteredCases,
    filteredVariants,
    filteredTransitions,
    filteredBottlenecks,
    filteredObservations,
    filteredMetrics,
    filterState,
  } = useDataset();

  const [activeCategory, setActiveCategory] = useState<
    'events' | 'transitions' | 'bottlenecks' | 'variants' | 'cases' | 'report'
  >('events');
  const [reportFormat, setReportFormat] = useState<'md' | 'json'>('md');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExportModalOpen) {
        closeExportModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExportModalOpen, closeExportModal]);

  // Clear download notification after 4 seconds
  useEffect(() => {
    if (downloadSuccess) {
      const timer = setTimeout(() => setDownloadSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [downloadSuccess]);

  if (!isExportModalOpen) return null;

  const datasetName = datasetMetadata.name || 'careflow';

  const handleDownload = (category: 'events' | 'transitions' | 'bottlenecks' | 'variants' | 'cases' | 'report') => {
    setIsExporting(true);
    try {
      let content = '';
      let filename = '';
      let mimeType = 'text/csv';

      if (category === 'events') {
        content = exportEventsToCSV(filteredEvents);
        filename = generateExportFilename(datasetName, 'events', 'csv');
        mimeType = 'text/csv';
      } else if (category === 'transitions') {
        content = exportTransitionsToCSV(filteredTransitions, filteredCases.length);
        filename = generateExportFilename(datasetName, 'transitions', 'csv');
        mimeType = 'text/csv';
      } else if (category === 'bottlenecks') {
        content = exportBottlenecksToCSV(filteredBottlenecks, filteredCases.length);
        filename = generateExportFilename(datasetName, 'bottlenecks', 'csv');
        mimeType = 'text/csv';
      } else if (category === 'variants') {
        content = exportVariantsToCSV(filteredVariants);
        filename = generateExportFilename(datasetName, 'variants', 'csv');
        mimeType = 'text/csv';
      } else if (category === 'cases') {
        content = exportCasesToCSV(filteredCases);
        filename = generateExportFilename(datasetName, 'cases', 'csv');
        mimeType = 'text/csv';
      } else if (category === 'report') {
        const reportParams = {
          datasetMetadata,
          metrics: filteredMetrics,
          filterState,
          variants: filteredVariants,
          bottlenecks: filteredBottlenecks,
          transitions: filteredTransitions,
          observations: filteredObservations,
          casesCount: filteredCases.length,
          eventsCount: filteredEvents.length,
        };

        if (reportFormat === 'md') {
          content = generateExecutiveReportMarkdown(reportParams);
          filename = generateExportFilename(datasetName, 'audit_report', 'md');
          mimeType = 'text/markdown';
        } else {
          content = exportCohortReportJSON(reportParams);
          filename = generateExportFilename(datasetName, 'audit_report', 'json');
          mimeType = 'application/json';
        }
      }

      triggerBrowserDownload(content, filename, mimeType);
      setDownloadSuccess(`Successfully downloaded ${filename}`);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const categories = [
    {
      id: 'events' as const,
      title: 'Clinical Event Log',
      badge: `${formatNumber(filteredEvents.length)} events`,
      icon: FileSpreadsheet,
      ext: 'CSV',
      desc: 'Normalized chronological milestone records matching active filters with timestamps, activity names, resources, and departments.',
      recordCount: filteredEvents.length,
      unit: 'rows',
    },
    {
      id: 'transitions' as const,
      title: 'Transition Performance',
      badge: `${formatNumber(filteredTransitions.length)} transitions`,
      icon: Activity,
      ext: 'CSV',
      desc: 'Observed process graph edges with full continuous quantiles (P25, Median, Mean, P75, P90, P95, Min, Max), IQR, and zero-duration concurrency metrics.',
      recordCount: filteredTransitions.length,
      unit: 'transitions',
    },
    {
      id: 'bottlenecks' as const,
      title: 'Ranked Bottlenecks',
      badge: `${formatNumber(filteredBottlenecks.length)} items`,
      icon: Clock,
      ext: 'CSV',
      desc: 'Operational latency delay candidates ranked by severity tier, case coverage, duration spreads, and clinical explanations.',
      recordCount: filteredBottlenecks.length,
      unit: 'ranked bottlenecks',
    },
    {
      id: 'variants' as const,
      title: 'Process Variants & Steps',
      badge: `${formatNumber(filteredVariants.length)} variants`,
      icon: Layers,
      ext: 'CSV',
      desc: 'End-to-end activity pathways with patient prevalence %, case counts, duration statistics, and intra-variant step transition timings.',
      recordCount: filteredVariants.length,
      unit: 'variants',
    },
    {
      id: 'cases' as const,
      title: 'Patient Case Registry',
      badge: `${formatNumber(filteredCases.length)} cases`,
      icon: Users,
      ext: 'CSV',
      desc: 'Encounter summary log containing admission/start time, disposition time, total elapsed duration, event count, variant classification, and clinic.',
      recordCount: filteredCases.length,
      unit: 'cases',
    },
    {
      id: 'report' as const,
      title: 'Executive Audit Report',
      badge: reportFormat.toUpperCase(),
      icon: reportFormat === 'md' ? FileText : FileCode,
      ext: reportFormat.toUpperCase(),
      desc: 'Audit-grade publication report with executive KPIs, cohort filters, variant breakdown, bottleneck distributions, and data governance disclosures.',
      recordCount: filteredCases.length > 0 ? 1 : 0,
      unit: 'report file',
    },
  ];

  const currentCategory = categories.find((c) => c.id === activeCategory) || categories[0];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs transition-opacity"
        onClick={closeExportModal}
      />

      <div className="min-h-full flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-2xs">
                  <Download className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 id="export-modal-title" className="text-base font-bold text-slate-900">
                    Export Pathway Data & Analytics
                  </h3>
                  <p className="text-xs text-slate-500">
                    Download filtered clinical event logs, transition performance tables, bottleneck rankings, or audit reports.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={closeExportModal}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              aria-label="Close export modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Context Banner */}
          <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Active Cohort:</span>
              <span className="font-mono text-slate-900 font-bold">{datasetMetadata.name}</span>
              {datasetMetadata.isSynthetic && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  <ShieldAlert className="w-3 h-3" /> Synthetic Demo Data
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-slate-500 text-[11px]">
              <span className="flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" />
                {filteredMetrics.activeFilterCount > 0
                  ? `${filteredMetrics.activeFilterCount} active filter${filteredMetrics.activeFilterCount > 1 ? 's' : ''} applied`
                  : 'All records (unfiltered)'}
              </span>
              <span>•</span>
              <span className="font-mono font-medium text-slate-700">
                {formatNumber(filteredCases.length)} cases / {formatNumber(filteredEvents.length)} events
              </span>
            </div>
          </div>

          {/* Download Notification */}
          {downloadSuccess && (
            <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{downloadSuccess}</span>
              </div>
              <button
                onClick={() => setDownloadSuccess(null)}
                className="text-emerald-700 hover:text-emerald-900 text-[11px] underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Main Body */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Category Selection Tabs (5 Cols) */}
            <div className="md:col-span-5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Select Export Package
              </span>

              {categories.map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = activeCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-sky-50/70 border-sky-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <span
                          className={`text-xs font-bold block truncate ${
                            isSelected ? 'text-sky-900' : 'text-slate-800'
                          }`}
                        >
                          {cat.title}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {cat.badge}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                        isSelected ? 'bg-sky-200/80 text-sky-900' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {cat.ext}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Details & Download Trigger (7 Cols) */}
            <div className="md:col-span-7 flex flex-col justify-between p-5 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-5">
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Export Package Details
                    </span>
                    <h4 className="text-base font-bold text-slate-900">
                      {currentCategory.title}
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-700 shadow-2xs">
                    .{currentCategory.ext.toLowerCase()}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mt-3">
                  {currentCategory.desc}
                </p>

                {/* Sub-format toggle for Executive Audit Report */}
                {activeCategory === 'report' && (
                  <div className="mt-4 p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Choose Report Format:
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setReportFormat('md')}
                        className={`p-2.5 rounded-lg border font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                          reportFormat === 'md'
                            ? 'bg-sky-50 border-sky-400 text-sky-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <FileText className="w-4 h-4 text-sky-600" />
                        <span>Markdown (.md)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReportFormat('json')}
                        className={`p-2.5 rounded-lg border font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                          reportFormat === 'json'
                            ? 'bg-sky-50 border-sky-400 text-sky-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <FileCode className="w-4 h-4 text-teal-600" />
                        <span>JSON Data (.json)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Record Counter & Preview Card */}
                <div className="mt-4 p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Filtered Record Volume:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {formatNumber(currentCategory.recordCount)} {currentCategory.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                    <span>Generated Filename:</span>
                    <span className="font-mono text-slate-600 font-medium truncate max-w-[240px]">
                      {generateExportFilename(
                        datasetName,
                        activeCategory === 'report' ? 'audit_report' : activeCategory,
                        activeCategory === 'report' ? reportFormat : 'csv'
                      )}
                    </span>
                  </div>
                </div>

                {/* Empty State Warning */}
                {currentCategory.recordCount === 0 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>No records match the active filter criteria. Export file will contain headers only.</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Client-side generation — Zero network transmission
                </span>

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleDownload(activeCategory)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {currentCategory.ext}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>CareFlow Healthcare Analytics — Publication & Compliance Export Engine</span>
            <button
              onClick={closeExportModal}
              className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-md font-medium cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
