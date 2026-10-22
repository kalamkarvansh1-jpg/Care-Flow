// CareFlow — Clinical Pathway Process Mining Types

export interface ColumnMapping {
  caseId: string;
  activity: string;
  timestamp: string;
  resource?: string;
  department?: string;
  status?: string;
}

export interface RawEventRow {
  [key: string]: string | number | null | undefined;
}

export interface NormalizedEvent {
  id: string;
  caseId: string;
  activity: string;
  timestamp: string; // ISO string
  timestampMs: number;
  eventIndex: number; // 1-indexed within the case
  nextActivity: string | null;
  elapsedToNextMinutes: number | null;
  resource?: string;
  department?: string;
  status?: string;
  isTimestampTie?: boolean;
  rawAttributes: Record<string, string | number | null | undefined>;
}

export interface CaseSummary {
  caseId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  eventCount: number;
  activitySequence: string[];
  variantKey: string;
  events: NormalizedEvent[];
  department?: string;
  status?: string;
}

export interface ProcessVariant {
  key: string;
  id: string;
  name: string;
  activities: string[];
  caseCount: number;
  percentage: number;
  medianDurationMinutes: number;
  meanDurationMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  isMostFrequent: boolean;
}

export interface ActivityTransition {
  id: string;
  from: string;
  to: string;
  observationCount: number;
  caseCount: number;
  medianElapsedMinutes: number;
  meanElapsedMinutes: number;
  p90ElapsedMinutes: number;
  percentageOfDepartures: number;
}

export interface ActivityMetric {
  activity: string;
  frequency: number;
  caseCount: number;
  percentage: number;
  medianElapsedMinutes: number;
  department?: string;
}

export interface BottleneckItem {
  id: string;
  type: 'activity' | 'transition';
  label: string;
  from?: string;
  to?: string;
  validObservations: number;
  caseCount: number;
  medianElapsedMinutes: number;
  meanElapsedMinutes: number;
  p90ElapsedMinutes: number;
  severity: 'high' | 'moderate' | 'nominal';
  explanation: string;
}

export interface DatasetValidationReport {
  totalRows: number;
  parsedEvents: number;
  uniqueCases: number;
  invalidRows: number;
  ambiguousTimestampTies: number;
  dateRange: {
    start: string;
    end: string;
  };
  detectedColumns: string[];
  hasRequiredColumns: boolean;
  warnings: string[];
}

export interface DatasetMetadata {
  id: string;
  name: string;
  filename: string;
  fileSizeBytes: number;
  isSynthetic: boolean;
  loadedAt: string;
  columnMapping: ColumnMapping;
  validationReport: DatasetValidationReport;
  description: string;
}

export interface AnalyticalObservation {
  id: string;
  category: 'bottleneck' | 'variant' | 'volume' | 'rework';
  title: string;
  metric: string;
  summary: string;
  detail: string;
}

export interface GlobalFilterState {
  datePreset: 'all' | '7d' | '30d' | '90d';
  startDate?: string;
  endDate?: string;
  caseIdSearch: string;
  activity: string; // 'all' or specific activity name
  variantKey: string; // 'all' or specific variant key
  department: string; // 'all' or specific department
}

export interface CalculatedMetrics {
  totalCases: number;
  totalEvents: number;
  medianCaseDurationMinutes: number;
  distinctVariantsCount: number;
  averageEventsPerCase: number;
  activeFilterCount: number;
}
