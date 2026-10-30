/**
 * CareFlow — Phase 6: Operational Bottleneck Intervention & What-If Simulation Types
 *
 * Epistemological Notice:
 * All simulation types and metrics model hypothetical parametric adjustments
 * applied to empirical event-log timestamps. They represent operational scenario assumptions
 * for process-engineering decision support, NOT validated medical clinical trials,
 * guaranteed throughput increases, or certified healthcare guidelines.
 */

/**
 * Type of operational intervention applied to an activity transition.
 */
export type SimulationInterventionType = 'percentage' | 'cap' | 'combined';

/**
 * A targeted hypothetical operational intervention applied to a specific transition pair.
 */
export interface SimulationIntervention {
  /** Unique identifier for the intervention (e.g., 'int-rx-imaging') */
  id: string;
  /** Source activity label (e.g., 'Prescription Order') */
  from: string;
  /** Destination activity label (e.g., 'Imaging Start') */
  to: string;
  /** Intervention mechanism */
  type: SimulationInterventionType;
  /**
   * Hypothetical percentage duration reduction (0 - 100).
   * Models queue streamlining, automated handoffs, or rapid triage.
   */
  reductionPercentage?: number;
  /**
   * Maximum duration cap in minutes (>= 0).
   * Models hard operational service-level limits or fast-track priority ceilings.
   */
  maxDurationMinutes?: number;
  /** Human-readable operational label (e.g., 'Radiology Scheduling Fast-Track') */
  label?: string;
  /** Operational justification or clinical rationale note */
  notes?: string;
}

/**
 * Comparative delta structure for any quantitative metric before and after simulation.
 */
export interface ComparativeMetricDelta {
  /** Observed empirical baseline value */
  baseline: number;
  /** Re-timed hypothetical simulated value */
  simulated: number;
  /** Absolute difference (simulated - baseline) */
  absoluteDelta: number;
  /** Relative percentage change ((simulated - baseline) / baseline) * 100 */
  percentageDelta: number;
}

/**
 * Case-level simulation evaluation detail.
 */
export interface SimulatedCaseResult {
  /** Case identifier */
  caseId: string;
  /** Observed empirical duration in minutes */
  baselineDurationMinutes: number;
  /** Re-timed simulated duration in minutes */
  simulatedDurationMinutes: number;
  /** Total elapsed minutes saved for this patient encounter (>= 0) */
  savedMinutes: number;
  /** Percentage reduction in encounter duration (0 - 100) */
  percentageReduction: number;
  /** Number of intervened transition steps traversed by this case */
  traversedInterventionsCount: number;
  /** Whether the case's baseline duration exceeded the empirical threshold */
  isExceedingThresholdBaseline?: boolean;
  /** Whether the case's simulated duration still exceeds the empirical threshold */
  isExceedingThresholdSimulated?: boolean;
  /** Whether the case dropped from exceeding to within the empirical threshold */
  isThresholdRecovered?: boolean;
}

/**
 * Per-transition comparative performance summary.
 */
export interface TransitionSimulationSummary {
  from: string;
  to: string;
  interventionLabel?: string;
  observationCount: number;
  affectedCasesCount: number;
  baselineMedianMinutes: number;
  simulatedMedianMinutes: number;
  baselineP90Minutes: number;
  simulatedP90Minutes: number;
  totalSavedMinutes: number;
}

/**
 * Configuration of a what-if simulation scenario.
 */
export interface SimulationScenario {
  /** Unique scenario identifier */
  id: string;
  /** Scenario name (e.g., 'Radiology Rapid Scheduling Protocol') */
  name: string;
  /** Detailed scenario operational description */
  description?: string;
  /** List of targeted interventions applied in this scenario */
  interventions: SimulationIntervention[];
  /** Optional empirical duration threshold for modeled delay comparisons */
  empiricalThresholdMinutes?: number;
  /** Target workflow category or domain filter */
  workflowCategory?: string;
  /** Creation ISO timestamp */
  createdAt?: string;
}

/**
 * Complete cohort-level simulation outcome comparison.
 */
export interface SimulationResult {
  /** Scenario identifier */
  scenarioId: string;
  /** Scenario name */
  scenarioName: string;
  /** Total cases evaluated in cohort */
  totalCasesEvaluated: number;
  /** Number of cases that traversed at least one intervened transition */
  affectedCasesCount: number;
  /** Percentage of cohort affected by scenario (0 - 100) */
  affectedCasesPercentage: number;
  /** Total hypothetical patient elapsed minutes saved across entire cohort */
  totalHypotheticalMinutesSaved: number;
  /** Total hypothetical patient elapsed hours saved across entire cohort */
  totalHypotheticalHoursSaved: number;
  /** 50th percentile (Median) case duration delta */
  medianDuration: ComparativeMetricDelta;
  /** 90th percentile (P90) tail latency case duration delta */
  p90Duration: ComparativeMetricDelta;
  /** Arithmetic mean case duration delta */
  meanDuration: ComparativeMetricDelta;
  /** Minimum case duration delta */
  minDuration: ComparativeMetricDelta;
  /** Maximum case duration delta */
  maxDuration: ComparativeMetricDelta;
  /** Baseline count of cases exceeding empirical threshold */
  casesExceedingThresholdBaseline: number;
  /** Simulated count of cases exceeding empirical threshold */
  casesExceedingThresholdSimulated: number;
  /** Number of delayed cases that recovered to within empirical threshold */
  recoveredCasesCount: number;
  /** Percentage of previously delayed cases recovered (0 - 100) */
  recoveredCasesPercentage: number;
  /** Configured empirical duration threshold in minutes, if any */
  empiricalThresholdMinutes?: number | null;
  /** Individual case-level simulated outcomes */
  caseResults: SimulatedCaseResult[];
  /** Per-transition comparative performance metrics */
  transitionResults: TransitionSimulationSummary[];
  /** Methodological disclaimer and model notice */
  modelNotice: string;
}