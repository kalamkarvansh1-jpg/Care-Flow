import { createContext, useContext } from 'react';
import {
  NormalizedEvent,
  CaseSummary,
  ProcessVariant,
  ActivityMetric,
  ActivityTransition,
  BottleneckItem,
  AnalyticalObservation,
  CalculatedMetrics,
  DatasetMetadata,
  GlobalFilterState,
  RawEventRow,
  ColumnMapping,
  CaseComplianceClassification,
  ComplianceSummaryMetrics,
} from '../types';

export interface DatasetContextType {
  // Current Dataset Metadata
  datasetMetadata: DatasetMetadata;
  isLoading: boolean;

  // Master Unfiltered Data
  allEvents: NormalizedEvent[];
  allCases: CaseSummary[];
  allVariants: ProcessVariant[];
  allActivityMetrics: ActivityMetric[];
  allTransitions: ActivityTransition[];
  allBottlenecks: BottleneckItem[];
  allObservations: AnalyticalObservation[];

  // Dynamic Filtered Data (Reactive to current filters)
  filteredCases: CaseSummary[];
  filteredEvents: NormalizedEvent[];
  filteredVariants: ProcessVariant[];
  filteredActivityMetrics: ActivityMetric[];
  filteredTransitions: ActivityTransition[];
  filteredBottlenecks: BottleneckItem[];
  filteredObservations: AnalyticalObservation[];
  filteredMetrics: CalculatedMetrics;
  timeSeriesData: {
    labels: string[];
    caseArrivals: number[];
    caseCompletions: number[];
    medianDurationsHours: number[];
  };

  // Phase 5 Conformance & Compliance Evaluation
  cohortCompliance: {
    classifications: CaseComplianceClassification[];
    summary: ComplianceSummaryMetrics;
  };
  categoryCompliance: Record<string, ComplianceSummaryMetrics>;

  // Global Filter State & Controls
  filterState: GlobalFilterState;
  setFilterState: React.Dispatch<React.SetStateAction<GlobalFilterState>>;
  updateFilter: (partial: Partial<GlobalFilterState>) => void;
  resetFilters: () => void;

  // Modal Controls
  isLoadDatasetOpen: boolean;
  openLoadDataset: () => void;
  closeLoadDataset: () => void;
  isExportModalOpen: boolean;
  openExportModal: () => void;
  closeExportModal: () => void;

  // Actions
  loadPreset: (presetId: string) => void;
  loadCustomDataset: (
    rows: RawEventRow[],
    mapping: ColumnMapping,
    name: string,
    filename: string,
    fileSize: number
  ) => void;
}

export const DatasetContext = createContext<DatasetContextType | null>(null);

export function useDataset(): DatasetContextType {
  const context = useContext(DatasetContext);
  if (!context) {
    throw new Error('useDataset must be used within a DatasetProvider');
  }
  return context;
}
