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

export interface ProcessVariantStep {
  from: string;
  to: string;
  medianElapsedMinutes: number;
  p90ElapsedMinutes: number;
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
  stepTransitions?: ProcessVariantStep[];
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
  p25ElapsedMinutes?: number;
  p75ElapsedMinutes?: number;
  p95ElapsedMinutes?: number;
  minElapsedMinutes?: number;
  maxElapsedMinutes?: number;
  zeroDurationCount?: number;
  zeroDurationPercentage?: number;
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
  p25ElapsedMinutes?: number;
  p75ElapsedMinutes?: number;
  p95ElapsedMinutes?: number;
  minElapsedMinutes?: number;
  maxElapsedMinutes?: number;
  zeroDurationCount?: number;
  zeroDurationPercentage?: number;
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
  transitionKey?: string; // 'all' or "FromActivity -> ToActivity"
}

export interface CalculatedMetrics {
  totalCases: number;
  totalEvents: number;
  medianCaseDurationMinutes: number;
  meanCaseDurationMinutes: number;
  p90CaseDurationMinutes: number;
  minCaseDurationMinutes: number;
  maxCaseDurationMinutes: number;
  distinctVariantsCount: number;
  uniqueActivitiesCount: number;
  averageEventsPerCase: number;
  activeFilterCount: number;
  zeroDurationCasesCount: number;
  zeroDurationCasesPercentage: number;
}

export interface ExecutiveReportParams {
  datasetMetadata: DatasetMetadata;
  metrics: CalculatedMetrics;
  filterState: GlobalFilterState;
  variants: ProcessVariant[];
  bottlenecks: BottleneckItem[];
  transitions: ActivityTransition[];
  observations: AnalyticalObservation[];
  casesCount: number;
  eventsCount: number;
}

// ============================================================================
// Phase 5: Conformance Checking & Clinical Compliance Tracking Types
// ============================================================================

/**
 * Clinical pathway compliance states for patient encounters.
 * - Compliant: Case conforms structurally to reference pathway and completed within empirical SLA threshold.
 * - Delayed / SLA Risk: Case is structurally compliant but exceeded empirical P90 duration benchmark.
 * - Protocol Deviation: Case breached clinical structure (unmodeled activity, omitted milestone, or invalid sequence).
 * - Unconfigured Reference Model: Active dataset or category lacks a certified clinical reference model.
 */
export type ComplianceState =
  | 'Compliant'
  | 'Delayed / SLA Risk'
  | 'Protocol Deviation'
  | 'Unconfigured Reference Model';

/**
 * Supported clinical cohort domains for deterministic conformance validation.
 */
export type CohortDomain = 'outpatient' | 'ed_sepsis' | 'cardiology' | 'unconfigured';

/**
 * Replay move classifications matching standard PM4Py alignment terminology.
 * - Synchronous: Observed log event matches an enabled model transition (Cost 0).
 * - Log-Only: Observed log event cannot be accepted by the model (Cost 10,000).
 * - Model-Only: Model required an activity that was omitted in the log (Cost 10,000).
 * - Silent / Tau: Internal unobservable routing transition in the Petri net (Cost 1).
 */
export type AlignmentMoveClassification = 'Synchronous' | 'Log-Only' | 'Model-Only' | 'Silent / Tau';

/**
 * Scope granularity for deviation reports.
 */
export type DeviationScope = 'Category Summary' | 'Activity Breakdown';

/**
 * Sample size category tiers established in Phase 3 discovery.
 */
export type ModelSampleSizeTier =
  | 'Standard (>= 100 cases)'
  | 'Exploratory (30-99 cases)'
  | 'Insufficient (< 30 cases)';

/**
 * Discovery modeling status for clinical pathway categories.
 */
export type ModelStatus =
  | 'Discovered (Standard)'
  | 'Discovered (Exploratory)'
  | 'Skipped (< 30 cases)';

/**
 * Canonical conformance alignment quality metrics per clinical workflow category.
 * Sourced directly from data/processed/pathway_alignment_quality.csv.
 */
export interface PathwayAlignmentQuality {
  workflowCategory: string;
  modelSlug: string | null;
  evaluationType: string;
  totalHoldoutCases: number;
  totalHoldoutEvents: number;
  evaluatedCases: number;
  evaluatedEvents: number;
  samplingPercentage: number;
  alignmentLogFitness: number | null;
  alignmentLogFitnessExact?: number | null;
  averageTraceFitness: number | null;
  averageTraceFitnessExact?: number | null;
  percFittingTraces: number | null;
  percFittingTracesExact?: number | null;
  meanRawAlignmentCost: number | null;
  medianRawAlignmentCost: number | null;
  minRawAlignmentCost: number | null;
  maxRawAlignmentCost: number | null;
  deviantCasesCount: number | null;
  deviantCasesPct: number | null;
  failedEvaluationsCount: number;
}

/**
 * Conformance move alignment and deviation breakdown per activity.
 * Sourced directly from data/processed/pathway_alignment_deviations.csv.
 */
export interface PathwayAlignmentDeviation {
  workflowCategory: string;
  modelSlug: string | null;
  scope: DeviationScope;
  activityLabel: string;
  syncMoves: number;
  logOnlyMoves: number;
  modelOnlyMoves: number;
  silentTauMoves: number;
  totalMoves: number;
  logOnlyRatePct: number | null;
  modelOnlyRatePct: number | null;
}

/**
 * Petri net structural topology and Inductive Miner quality metrics.
 * Sourced from data/processed/pathway_model_structure.csv, pathway_model_quality.csv,
 * and reports/models/pathway_models/*_summary.json.
 */
export interface ModelStructureQuality {
  workflowCategory: string;
  modelSlug: string | null;
  sampleSizeTier: ModelSampleSizeTier | string;
  discoveryCases: number;
  discoveryEvents: number;
  holdoutCases: number;
  holdoutEvents: number;
  modelStatus: ModelStatus | string;
  places: number | null;
  transitionsTotal: number | null;
  transitionsVisible: number | null;
  transitionsSilent: number | null;
  arcs: number | null;
  isWorkflowNet: boolean | null;
  formalSoundnessVerification: string;
  constructionSoundnessExpectation: string;
  logFitness: number | null;
  averageTraceFitness: number | null;
  percentageFitTraces: number | null;
  precision: number | null;
  precisionEvaluationMethod: string | null;
  generalization: number | null;
  simplicity: number | null;
  exactVariantCoveragePct: number | null;
  pnmlArtifact: string | null;
  diagramArtifact: string | null;
}

/**
 * Individual patient case-level compliance classification and alignment diagnostic.
 */
export interface CaseComplianceClassification {
  caseId: string;
  status: ComplianceState;
  workflowCategory?: string;
  cohortDomain?: CohortDomain;
  traceFitness: number;
  durationMinutes: number;
  slaThresholdMinutes?: number;
  isSlaBreached: boolean;
  hasStructuralDeviation: boolean;
  isUnconfigured?: boolean;
  syncMovesCount: number;
  logOnlyMovesCount: number;
  modelOnlyMovesCount: number;
  deviationsSummary: string[];
  activitySequence: string[];
  doorToAntibioticMinutes?: number | null;
}

/**
 * Aggregate summary metrics across an active cohort for clinical compliance tracking.
 */
export interface ComplianceSummaryMetrics {
  totalCasesEvaluated: number;
  compliantCasesCount: number;
  compliantPercentage: number;
  delayedCasesCount: number;
  delayedPercentage: number;
  deviationCasesCount: number;
  deviationPercentage: number;
  unconfiguredCasesCount: number;
  unconfiguredPercentage: number;
  averageTraceFitness: number;
  totalSyncMoves: number;
  totalLogOnlyMoves: number;
  totalModelOnlyMoves: number;
  totalSilentMoves: number;
  cohortDomain?: CohortDomain;
  doorToAntibioticMetrics?: {
    medianMinutes: number;
    p90Minutes: number;
    evaluatedCasesCount: number;
  } | null;
}
