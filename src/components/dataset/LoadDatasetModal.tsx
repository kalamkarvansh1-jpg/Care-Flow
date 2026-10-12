import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Info,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { useDataset } from '../../context/useDataset';
import { ColumnMapping, RawEventRow } from '../../types';
import { DATASET_PRESETS } from '../../data/demoData';
import { formatFileSize } from '../../lib/formatters';
import { normalizeAndValidateEvents } from '../../lib/dataProcessing';

export const LoadDatasetModal: React.FC = () => {
  const { isLoadDatasetOpen, closeLoadDataset, loadPreset, loadCustomDataset, datasetMetadata } =
    useDataset();

  const [activeTab, setActiveTab] = useState<'presets' | 'upload'>('presets');

  // File Upload & Mapping State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<RawEventRow[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    caseId: '',
    activity: '',
    timestamp: '',
    resource: '',
    department: '',
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    processSelectedFile(file);
  };

  const processSelectedFile = (file: File) => {
    setSelectedFile(file);
    setParsedRows([]);
    setDetectedColumns([]);
    setColumnMapping({
      caseId: '',
      activity: '',
      timestamp: '',
      resource: '',
      department: '',
    });
    setParseError(null);
    setIsParsing(true);

    Papa.parse<RawEventRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsParsing(false);
        if (results.errors && results.errors.length > 0 && (!results.data || results.data.length === 0)) {
          setParseError(`Failed to parse CSV: ${results.errors[0].message}`);
          return;
        }

        const rows = (results.data as RawEventRow[]) || [];
        if (rows.length === 0) {
          setParseError('The uploaded CSV file is empty or does not contain data rows.');
          return;
        }

        const headers = results.meta.fields || Object.keys(rows[0] || {});
        setDetectedColumns(headers);
        setParsedRows(rows);

        // Auto-detect standard column headers intelligently
        const lowerHeaders = headers.map((h) => ({ original: h, lower: h.toLowerCase() }));

        const caseIdMatch = lowerHeaders.find(
          (h) =>
            h.lower.includes('case') ||
            h.lower === 'id' ||
            h.lower.includes('patient') ||
            h.lower.includes('encounter')
        );

        const activityMatch = lowerHeaders.find(
          (h) =>
            h.lower.includes('activity') ||
            h.lower.includes('concept:name') ||
            h.lower.includes('event') ||
            h.lower.includes('action') ||
            h.lower.includes('task') ||
            h.lower.includes('step')
        );

        const timestampMatch = lowerHeaders.find(
          (h) =>
            h.lower.includes('time') ||
            h.lower.includes('date') ||
            h.lower.includes('start')
        );

        const resourceMatch = lowerHeaders.find(
          (h) =>
            h.lower.includes('resource') ||
            h.lower.includes('performer') ||
            h.lower.includes('user') ||
            h.lower.includes('physician') ||
            h.lower.includes('nurse')
        );

        const deptMatch = lowerHeaders.find(
          (h) =>
            h.lower.includes('department') ||
            h.lower.includes('dept') ||
            h.lower.includes('clinic') ||
            h.lower.includes('unit')
        );

        setColumnMapping({
          caseId: caseIdMatch ? caseIdMatch.original : headers[0] || '',
          activity: activityMatch ? activityMatch.original : headers[1] || '',
          timestamp: timestampMatch ? timestampMatch.original : headers[2] || '',
          resource: resourceMatch ? resourceMatch.original : '',
          department: deptMatch ? deptMatch.original : '',
        });
      },
      error: (err) => {
        setIsParsing(false);
        setParseError(`CSV Parsing error: ${err.message}`);
      },
    });
  };

  const preflightValidation = useMemo(() => {
    if (
      parsedRows.length === 0 ||
      !columnMapping.caseId ||
      !columnMapping.activity ||
      !columnMapping.timestamp
    ) {
      return null;
    }
    return normalizeAndValidateEvents(parsedRows, columnMapping);
  }, [parsedRows, columnMapping]);

  const isMappingValid =
    Boolean(columnMapping.caseId) &&
    Boolean(columnMapping.activity) &&
    Boolean(columnMapping.timestamp) &&
    Boolean(preflightValidation && preflightValidation.cases.length > 0);

  const handleApplyCustomDataset = () => {
    if (!selectedFile || parsedRows.length === 0) return;
    if (!columnMapping.caseId || !columnMapping.activity || !columnMapping.timestamp) {
      setParseError('Please map all three required core fields: Case ID, Activity, and Timestamp.');
      return;
    }

    if (!preflightValidation || preflightValidation.cases.length === 0) {
      setParseError(
        'Validation failed: 0 valid patient cases could be constructed from this file. Ensure Case ID, Activity, and valid ISO/RFC date timestamps are present.'
      );
      return;
    }

    loadCustomDataset(
      parsedRows,
      columnMapping,
      selectedFile.name.replace(/\.[^/.]+$/, ''),
      selectedFile.name,
      selectedFile.size
    );
  };

  if (!isLoadDatasetOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs transition-opacity"
        onClick={closeLoadDataset}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Load & Configure Event Log Dataset
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  Client-Side Ingestion
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Switch between preloaded clinical cohorts or parse a local CSV log with configurable schema mapping.
              </p>
            </div>
            <button
              onClick={closeLoadDataset}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="flex border-b border-slate-200 px-6 bg-slate-50/30">
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === 'presets'
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Database className="w-4 h-4" />
              Preloaded Cohorts ({DATASET_PRESETS.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === 'upload'
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload Local CSV File
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
            {activeTab === 'presets' ? (
              <div className="space-y-3">
                <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-lg text-xs text-sky-950 flex items-start gap-2">
                  <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sky-900">Demonstration Clinical Logs</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Select a synthetic cohort calibrated to emergency and acute hospital length-of-stay distributions.
                      All metrics and visualizations update automatically.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {DATASET_PRESETS.map((preset) => {
                    const isActive = datasetMetadata.id === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          isActive
                            ? 'bg-sky-50/60 border-sky-400 ring-1 ring-sky-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <span className="font-bold text-sm text-slate-900">{preset.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono block">
                              {preset.filename} • {formatFileSize(preset.fileSizeBytes)}
                            </span>
                          </div>
                          {isActive ? (
                            <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                              Currently Loaded
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => loadPreset(preset.id)}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                            >
                              Load Cohort
                            </button>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed mb-3">
                          {preset.description}
                        </p>

                        <div className="pt-2 border-t border-slate-100 flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                          <span>Case ID: {preset.mapping.caseId}</span>
                          <span>•</span>
                          <span>Activity: {preset.mapping.activity}</span>
                          <span>•</span>
                          <span>Timestamp: {preset.mapping.timestamp}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Upload Tab */
              <div className="space-y-4">
                {/* File Dropzone */}
                <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-5 text-center bg-slate-50/40 transition-colors">
                  <input
                    type="file"
                    id="csv-file-input"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="csv-file-input"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                  >
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-sky-600 hover:underline">
                        Click to select a CSV file
                      </span>
                      <span className="text-xs text-slate-500"> or drag and drop</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Standard process mining format (e.g. Case ID, Activity, Timestamp)
                    </span>
                  </label>
                </div>

                {isParsing && (
                  <div className="p-3 bg-slate-50 rounded-lg text-center text-xs text-slate-500 animate-pulse">
                    Parsing CSV rows and detecting headers in browser...
                  </div>
                )}

                {parseError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Parsing Error</p>
                      <p className="text-[11px]">{parseError}</p>
                    </div>
                  </div>
                )}

                {selectedFile && parsedRows.length > 0 && (
                  <div className="space-y-4 pt-2">
                    {/* File Meta Pill */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{selectedFile.name}</span>
                        <span className="text-slate-500 ml-2">
                          ({formatFileSize(selectedFile.size)} • {parsedRows.length} rows parsed)
                        </span>
                      </div>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Mapping
                      </span>
                    </div>

                    {/* Column Mapping Section */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-sky-600" /> Map Process Mining Fields
                        </h4>
                        <span className="text-[11px] text-slate-400">* Required fields</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {/* Case ID */}
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <label className="font-semibold text-slate-800 block mb-1">
                            Case ID Column *
                          </label>
                          <select
                            value={columnMapping.caseId}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, caseId: e.target.value })
                            }
                            className="w-full bg-white border border-slate-200 rounded p-1.5 font-mono text-xs focus:outline-hidden"
                          >
                            <option value="">-- Select Column --</option>
                            {detectedColumns.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Activity */}
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <label className="font-semibold text-slate-800 block mb-1">
                            Activity Column *
                          </label>
                          <select
                            value={columnMapping.activity}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, activity: e.target.value })
                            }
                            className="w-full bg-white border border-slate-200 rounded p-1.5 font-mono text-xs focus:outline-hidden"
                          >
                            <option value="">-- Select Column --</option>
                            {detectedColumns.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Timestamp */}
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <label className="font-semibold text-slate-800 block mb-1">
                            Timestamp Column *
                          </label>
                          <select
                            value={columnMapping.timestamp}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, timestamp: e.target.value })
                            }
                            className="w-full bg-white border border-slate-200 rounded p-1.5 font-mono text-xs focus:outline-hidden"
                          >
                            <option value="">-- Select Column --</option>
                            {detectedColumns.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Optional columns */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 bg-slate-50/60 rounded-lg border border-slate-200">
                          <label className="text-slate-600 font-medium block mb-1">
                            Resource / Performer (Optional)
                          </label>
                          <select
                            value={columnMapping.resource || ''}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, resource: e.target.value })
                            }
                            className="w-full bg-white border border-slate-200 rounded p-1.5 font-mono text-xs focus:outline-hidden"
                          >
                            <option value="">None / Not mapped</option>
                            {detectedColumns.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="p-2.5 bg-slate-50/60 rounded-lg border border-slate-200">
                          <label className="text-slate-600 font-medium block mb-1">
                            Department / Unit (Optional)
                          </label>
                          <select
                            value={columnMapping.department || ''}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, department: e.target.value })
                            }
                            className="w-full bg-white border border-slate-200 rounded p-1.5 font-mono text-xs focus:outline-hidden"
                          >
                            <option value="">None / Not mapped</option>
                            {detectedColumns.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Preflight Validation Report Card */}
                    {preflightValidation ? (
                      <div
                        className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                          preflightValidation.cases.length === 0
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5">
                            {preflightValidation.cases.length === 0 ? (
                              <>
                                <AlertCircle className="w-4 h-4 text-rose-600" />
                                Schema Validation Failed
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                Preflight Schema Validated
                              </>
                            )}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {preflightValidation.cases.length.toLocaleString()} valid cases •{' '}
                            {preflightValidation.events.length.toLocaleString()} events
                          </span>
                        </div>

                        {preflightValidation.cases.length === 0 ? (
                          <p className="text-[11px] text-rose-700">
                            No valid patient cases could be constructed. Please verify that the selected Case ID, Activity, and Timestamp columns contain valid data and parseable dates.
                          </p>
                        ) : (
                          <div className="space-y-1 text-[11px]">
                            {preflightValidation.report.invalidRows > 0 && (
                              <div className="text-amber-800 flex items-center gap-1 font-medium">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>
                                  {preflightValidation.report.invalidRows.toLocaleString()} rows with missing or malformed values will be safely skipped.
                                </span>
                              </div>
                            )}
                            {preflightValidation.report.ambiguousTimestampTies > 0 && (
                              <div className="text-slate-600 flex items-center gap-1">
                                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span>
                                  {preflightValidation.report.ambiguousTimestampTies} ambiguous timestamp ties detected.
                                </span>
                              </div>
                            )}
                            {preflightValidation.report.dateRange.start && (
                              <div className="text-slate-600">
                                Date range: {preflightValidation.report.dateRange.start.slice(0, 10)} to {preflightValidation.report.dateRange.end.slice(0, 10)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      (!columnMapping.caseId || !columnMapping.activity || !columnMapping.timestamp) && (
                        <div className="p-3.5 rounded-lg border bg-amber-50/80 border-amber-200 text-amber-900 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Required Column Mapping Incomplete</span>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            Missing required column mapping. Please select an assigned column for Case ID, Activity, and Timestamp to proceed with validation and analysis.
                          </p>
                        </div>
                      )
                    )}

                    {/* Preview Table of First 3 Rows */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Sample Rows Preview (First 3 Records)
                      </h4>
                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-[11px] font-mono">
                          <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="p-2">Case ID</th>
                              <th className="p-2">Activity</th>
                              <th className="p-2">Timestamp</th>
                              <th className="p-2">Resource</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {parsedRows.slice(0, 3).map((row, idx) => (
                              <tr key={idx}>
                                <td className="p-2 font-semibold text-slate-900">
                                  {String(row[columnMapping.caseId] || '-')}
                                </td>
                                <td className="p-2 text-slate-700">
                                  {String(row[columnMapping.activity] || '-')}
                                </td>
                                <td className="p-2 text-slate-500">
                                  {String(row[columnMapping.timestamp] || '-')}
                                </td>
                                <td className="p-2 text-slate-500">
                                  {columnMapping.resource
                                    ? String(row[columnMapping.resource] || '-')
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Apply Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        disabled={!isMappingValid}
                        onClick={handleApplyCustomDataset}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                          isMappingValid
                            ? 'bg-sky-600 hover:bg-sky-700 text-white'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <span>Apply & Analyze Dataset</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>Client-side parsing — Data remains strictly in local browser memory.</span>
            <button
              onClick={closeLoadDataset}
              className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-md font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
