import React, { useState, useMemo } from 'react';
import {
  RawEventRow,
  ColumnMapping,
  DatasetMetadata,
  GlobalFilterState,
} from '../types';
import {
  normalizeAndValidateEvents,
  extractProcessVariants,
  extractActivityMetrics,
  extractTransitions,
  extractBottlenecks,
  extractTimeSeriesVolume,
  generateDataObservations,
  applyGlobalFilters,
  computeSummaryMetrics,
} from '../lib/dataProcessing';
import { DATASET_PRESETS } from '../data/demoData';
import { DatasetContext } from './DatasetContextInstance';

const defaultFilterState: GlobalFilterState = {
  datePreset: 'all',
  caseIdSearch: '',
  activity: 'all',
  variantKey: 'all',
  department: 'all',
  transitionKey: 'all',
};

export const DatasetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filterState, setFilterState] = useState<GlobalFilterState>(defaultFilterState);
  const [isLoadDatasetOpen, setIsLoadDatasetOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize with the default Sepsis 2026 preset
  const defaultPreset = DATASET_PRESETS[0];

  const [rawRows, setRawRows] = useState<RawEventRow[]>(() => defaultPreset.generateRows());
  const [mapping, setMapping] = useState<ColumnMapping>(defaultPreset.mapping);
  const formatLoadTimestamp = () =>
    new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const [metaInfo, setMetaInfo] = useState(() => ({
    id: defaultPreset.id,
    name: defaultPreset.name,
    filename: defaultPreset.filename,
    description: defaultPreset.description,
    fileSizeBytes: defaultPreset.fileSizeBytes,
    isSynthetic: true,
    loadedAt: formatLoadTimestamp(),
  }));

  // Normalized data parsing and validation
  const { events: allEvents, cases: allCases, report: validationReport } = useMemo(() => {
    return normalizeAndValidateEvents(rawRows, mapping);
  }, [rawRows, mapping]);

  // Master calculated analytical entities (Unfiltered baseline)
  const allVariants = useMemo(() => extractProcessVariants(allCases), [allCases]);
  const allActivityMetrics = useMemo(() => extractActivityMetrics(allEvents, allCases.length), [allEvents, allCases]);
  const allTransitions = useMemo(() => extractTransitions(allCases), [allCases]);
  const allBottlenecks = useMemo(() => extractBottlenecks(allTransitions, allActivityMetrics), [allTransitions, allActivityMetrics]);
  const allObservations = useMemo(() => generateDataObservations(allCases, allVariants, allBottlenecks, allActivityMetrics), [allCases, allVariants, allBottlenecks, allActivityMetrics]);

  // Full dataset metadata structure
  const datasetMetadata: DatasetMetadata = useMemo(
    () => ({
      id: metaInfo.id,
      name: metaInfo.name,
      filename: metaInfo.filename,
      fileSizeBytes: metaInfo.fileSizeBytes,
      isSynthetic: metaInfo.isSynthetic,
      loadedAt: metaInfo.loadedAt,
      columnMapping: mapping,
      validationReport,
      description: metaInfo.description,
    }),
    [metaInfo, mapping, validationReport]
  );

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterState.datePreset !== 'all') count++;
    if (filterState.caseIdSearch.trim() !== '') count++;
    if (filterState.activity !== 'all') count++;
    if (filterState.variantKey !== 'all') count++;
    if (filterState.department !== 'all') count++;
    if (filterState.transitionKey && filterState.transitionKey !== 'all') count++;
    return count;
  }, [filterState]);

  // Determine effective date bounds based on datePreset
  const { effectiveStartDate, effectiveEndDate } = useMemo(() => {
    if (filterState.datePreset === 'all' || !validationReport.dateRange.end) {
      return {
        effectiveStartDate: filterState.startDate,
        effectiveEndDate: filterState.endDate,
      };
    }

    const endMs = new Date(validationReport.dateRange.end).getTime();
    let days = 30;
    if (filterState.datePreset === '7d') days = 7;
    else if (filterState.datePreset === '30d') days = 30;
    else if (filterState.datePreset === '90d') days = 90;

    const startMs = endMs - days * 24 * 60 * 60 * 1000;
    return {
      effectiveStartDate: new Date(startMs).toISOString(),
      effectiveEndDate: validationReport.dateRange.end,
    };
  }, [filterState.datePreset, filterState.startDate, filterState.endDate, validationReport.dateRange.end]);

  // Apply active filters across all cases & events
  const { filteredCases, filteredEvents } = useMemo(() => {
    return applyGlobalFilters(allCases, {
      caseIdSearch: filterState.caseIdSearch,
      activity: filterState.activity,
      variantKey: filterState.variantKey,
      department: filterState.department,
      transitionKey: filterState.transitionKey,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
    });
  }, [allCases, filterState, effectiveStartDate, effectiveEndDate]);

  // Compute reactive collections from filtered cases & events
  const filteredVariants = useMemo(() => extractProcessVariants(filteredCases), [filteredCases]);
  const filteredActivityMetrics = useMemo(() => extractActivityMetrics(filteredEvents, filteredCases.length), [filteredEvents, filteredCases]);
  const filteredTransitions = useMemo(() => extractTransitions(filteredCases), [filteredCases]);
  const filteredBottlenecks = useMemo(() => extractBottlenecks(filteredTransitions, filteredActivityMetrics), [filteredTransitions, filteredActivityMetrics]);
  const filteredObservations = useMemo(() => generateDataObservations(filteredCases, filteredVariants, filteredBottlenecks, filteredActivityMetrics), [filteredCases, filteredVariants, filteredBottlenecks, filteredActivityMetrics]);
  const timeSeriesData = useMemo(() => extractTimeSeriesVolume(filteredCases), [filteredCases]);

  const filteredMetrics = useMemo(() => {
    return computeSummaryMetrics(filteredCases, filteredEvents, activeFilterCount);
  }, [filteredCases, filteredEvents, activeFilterCount]);

  const updateFilter = (partial: Partial<GlobalFilterState>) => {
    setFilterState((prev) => ({ ...prev, ...partial }));
  };

  const resetFilters = () => {
    setFilterState(defaultFilterState);
  };

  const loadPreset = (presetId: string) => {
    const preset = DATASET_PRESETS.find((p) => p.id === presetId) || DATASET_PRESETS[0];
    setIsLoading(true);
    setTimeout(() => {
      setRawRows(preset.generateRows());
      setMapping(preset.mapping);
      setMetaInfo({
        id: preset.id,
        name: preset.name,
        filename: preset.filename,
        description: preset.description,
        fileSizeBytes: preset.fileSizeBytes,
        isSynthetic: true,
        loadedAt: formatLoadTimestamp(),
      });
      resetFilters();
      setIsLoading(false);
      setIsLoadDatasetOpen(false);
    }, 200);
  };

  const loadCustomDataset = (
    rows: RawEventRow[],
    newMapping: ColumnMapping,
    name: string,
    filename: string,
    fileSize: number
  ) => {
    setIsLoading(true);
    setTimeout(() => {
      setRawRows(rows);
      setMapping(newMapping);
      setMetaInfo({
        id: `custom-${Date.now()}`,
        name,
        filename,
        description: `Imported event log: ${filename}`,
        fileSizeBytes: fileSize,
        isSynthetic: false,
        loadedAt: formatLoadTimestamp(),
      });
      resetFilters();
      setIsLoading(false);
      setIsLoadDatasetOpen(false);
    }, 200);
  };

  return (
    <DatasetContext.Provider
      value={{
        datasetMetadata,
        isLoading,
        allEvents,
        allCases,
        allVariants,
        allActivityMetrics,
        allTransitions,
        allBottlenecks,
        allObservations,
        filteredCases,
        filteredEvents,
        filteredVariants,
        filteredActivityMetrics,
        filteredTransitions,
        filteredBottlenecks,
        filteredObservations,
        filteredMetrics,
        timeSeriesData,
        filterState,
        setFilterState,
        updateFilter,
        resetFilters,
        isLoadDatasetOpen,
        openLoadDataset: () => setIsLoadDatasetOpen(true),
        closeLoadDataset: () => setIsLoadDatasetOpen(false),
        isExportModalOpen,
        openExportModal: () => setIsExportModalOpen(true),
        closeExportModal: () => setIsExportModalOpen(false),
        loadPreset,
        loadCustomDataset,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
};
