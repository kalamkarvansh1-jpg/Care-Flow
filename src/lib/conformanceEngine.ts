/**
 * CareFlow — Phase 5, Step 2: Conformance Checking & Clinical Compliance Evaluation Engine
 *
 * This module implements client-side, deterministic case-level and cohort-level
 * compliance evaluation against the empirical Phase 3 clinical pathway models.
 *
 * Methodological Notice: Client-Side Heuristic Conformance Evaluation
 * This client-side engine executes deterministic heuristic milestone, ordering, lifecycle,
 * and temporal checks derived from the empirical Phase 3 discovery models. It does not
 * execute computationally expensive in-browser A* state-space Petri net search (which was
 * conducted independently via PM4Py in Phase 3 Step 4 and documented in reports/conformance_alignment.md).
 *
 * Clinical Governance Disclaimer:
 * All operational latency benchmarks in this module represent empirical statistical percentiles
 * (P90) calculated from synthetic simulation data. They serve strictly as configurable analytical
 * operational thresholds for delay tracking, NOT validated medical clinical guidelines, standard-of-care
 * protocols, or regulatory healthcare SLAs.
 *
 * Reference Data & Standards:
 * - data/processed/pathway_alignment_quality.csv
 * - data/processed/pathway_alignment_deviations.csv
 * - data/processed/case_duration_summary.csv
 * - reports/conformance_alignment.md
 * - reports/performance_bottleneck_analysis.md
 */

import {
  CaseSummary,
  ComplianceState,
  CaseComplianceClassification,
  ComplianceSummaryMetrics,
} from '../types';
import {
  CANONICAL_PATHWAY_MODELS,
  CanonicalPathwayModelMetadata,
} from '../data/conformanceData';

// ============================================================================
// Empirical Analytical Latency Thresholds (Empirical P90)
// ============================================================================

/**
 * Verified empirical 90th-percentile (P90) elapsed durations per clinical pathway category.
 * Sourced directly from data/processed/case_duration_summary.csv and
 * reports/performance_bottleneck_analysis.md.
 *
 * NOTE: These values are configurable analytical thresholds for operational delay tracking
 * and must not be construed as established clinical guideline SLAs.
 */
export const DEFAULT_PATHWAY_SLA_THRESHOLDS_MINUTES: Record<string, number> = {
  'Appointment → Prescription': 94.0,
  'Appointment → Prescription → Lab': 1420.5,
  'Appointment → Prescription → Imaging': 276.0,
  'Ambiguous Source Flow (Multi-Category Encounter)': 3728.0,
  'Appointment → Prescription → Lab + Imaging': 3519.0,
  'Appointment → Prescription → Pharmacy': 93.6,
  'Appointment → Prescription → Imaging + Pharmacy': 324.0,
  'Appointment → Prescription → Lab + Pharmacy': 80.0,
};

/**
 * Fallback SLA threshold when a case belongs to an unspecified or custom workflow category.
 * Sourced from the global cohort P90 duration in data/processed/case_duration_summary.csv.
 */
export const GLOBAL_FALLBACK_SLA_THRESHOLD_MINUTES = 196.0;

/**
 * Permitted and required activity definitions per clinical pathway model.
 * Sourced from discovered Petri net topologies in reports/models/pathway_models/*.
 */
export interface PathwayActivityDefinition {
  allowedActivities: string[];
  requiredActivities: string[];
  expectedStartActivity: string;
  expectedOrderActivity: string;
  hasLaboratory: boolean;
  hasImaging: boolean;
  hasPharmacy: boolean;
  typicalSilentTauMoves: number;
}

export const CANONICAL_PATHWAY_DEFINITIONS: Record<string, PathwayActivityDefinition> = {
  'Appointment → Prescription': {
    allowedActivities: ['Appointment Start', 'Prescription Order'],
    requiredActivities: ['Appointment Start', 'Prescription Order'],
    expectedStartActivity: 'Appointment Start',
    expectedOrderActivity: 'Prescription Order',
    hasLaboratory: false,
    hasImaging: false,
    hasPharmacy: false,
    typicalSilentTauMoves: 4,
  },
  'Appointment → Prescription → Lab': {
    allowedActivities: [
      'Appointment Start',
      'Prescription Order',
      'Laboratory Start',
      'Laboratory End',
    ],
    requiredActivities: ['Appointment Start', 'Prescription Order', 'Laboratory Start'],
    expectedStartActivity: 'Appointment Start',
    expectedOrderActivity: 'Prescription Order',
    hasLaboratory: true,
    hasImaging: false,
    hasPharmacy: false,
    typicalSilentTauMoves: 7,
  },
  'Appointment → Prescription → Imaging': {
    allowedActivities: [
      'Appointment Start',
      'Prescription Order',
      'Imaging Start',
      'Imaging End',
    ],
    requiredActivities: ['Appointment Start', 'Prescription Order', 'Imaging Start'],
    expectedStartActivity: 'Appointment Start',
    expectedOrderActivity: 'Prescription Order',
    hasLaboratory: false,
    hasImaging: true,
    hasPharmacy: false,
    typicalSilentTauMoves: 4,
  },
  'Ambiguous Source Flow (Multi-Category Encounter)': {
    allowedActivities: [
      'Appointment Start',
      'Prescription Order',
      'Laboratory Start',
      'Laboratory End',
      'Imaging Start',
      'Imaging End',
      'Pharmacy Start',
      'Pharmacy End',
    ],
    requiredActivities: ['Appointment Start', 'Prescription Order'],
    expectedStartActivity: 'Appointment Start',
    expectedOrderActivity: 'Prescription Order',
    hasLaboratory: true,
    hasImaging: true,
    hasPharmacy: true,
    typicalSilentTauMoves: 20,
  },
  'Appointment → Prescription → Lab + Imaging': {
    allowedActivities: [
      'Appointment Start',
      'Prescription Order',
      'Laboratory Start',
      'Laboratory End',
      'Imaging Start',
      'Imaging End',
    ],
    requiredActivities: [
      'Appointment Start',
      'Prescription Order',
      'Laboratory Start',
      'Imaging Start',
    ],
    expectedStartActivity: 'Appointment Start',
    expectedOrderActivity: 'Prescription Order',
    hasLaboratory: true,
    hasImaging: true,
    hasPharmacy: false,
    typicalSilentTauMoves: 7,
  },
  'Appointment → Prescription → Pharmacy': {
    allowedActivities: [
      'Appointment Start',
      'Prescription Order',
      'Pharmacy Start',
      'Pharmacy End',
    ],
    requiredActivities: ['Appointment Start', 'Prescription Order', 'Pharmacy Start'],
    expectedStartActivity: 'Appointment Start',
    expectedOrderActivity: 'Prescription Order',
    hasLaboratory: false,
    hasImaging: false,
    hasPharmacy: true,
    typicalSilentTauMoves: 7,
  },
  'Appointment → Prescription → Imaging + Pharmacy': {
    allowedActivities: [
      'Appointment Start',
      'Prescription Order',
      'Imaging Start',
      'Imaging End',
      'Pharmacy Start',
      'Pharmacy End',
    ],
    requiredActivities: ['Appointment Start', 'Prescription Order'],
    expectedStartActivity: 'Appointment Start',
    expectedOrderActivity: 'Prescription Order',
    hasLaboratory: false,
    hasImaging: true,
    hasPharmacy: true,
    typicalSilentTauMoves: 6,
  },
  'Appointment → Prescription → Lab + Pharmacy': {
    allowedActivities: [
      'Appointment Start',
      'Prescription Order',
      'Laboratory Start',
      'Laboratory End',
      'Pharmacy Start',
      'Pharmacy End',
    ],
    requiredActivities: ['Appointment Start', 'Prescription Order'],
    expectedStartActivity: 'Appointment Start',
    expectedOrderActivity: 'Prescription Order',
    hasLaboratory: true,
    hasImaging: false,
    hasPharmacy: true,
    typicalSilentTauMoves: 6,
  },
};

/**
 * Diagnostic start/end activity pairs for lifecycle reconciliation.
 */
export const DIAGNOSTIC_LIFECYCLE_PAIRS = [
  { start: 'Laboratory Start', end: 'Laboratory End', stage: 'Laboratory' },
  { start: 'Imaging Start', end: 'Imaging End', stage: 'Imaging' },
  { start: 'Pharmacy Start', end: 'Pharmacy End', stage: 'Pharmacy' },
] as const;

// ============================================================================
// Workflow Category Resolution Engine
// ============================================================================

/**
 * Deterministically resolve the clinical workflow category for a patient encounter.
 *
 * Checks in order:
 * 1. Explicit raw attributes (e.g. `workflow_category`, `flow_name`, `category`).
 * 2. Activity sequences and departments present in the encounter log.
 * 3. Falls back to canonical Consultation & Prescription baseline.
 */
export function resolveCaseWorkflowCategory(caseSummary: CaseSummary): string {
  // Check 1: Explicit metadata or raw event attributes
  const firstEventRaw = caseSummary.events[0]?.rawAttributes;
  if (firstEventRaw) {
    const rawCategory =
      firstEventRaw['workflow_category'] ??
      firstEventRaw['workflowCategory'] ??
      firstEventRaw['flow_name'] ??
      firstEventRaw['flowName'] ??
      firstEventRaw['category'];
    if (typeof rawCategory === 'string' && rawCategory.trim().length > 0) {
      const trimmed = rawCategory.trim();
      // Match against known canonical models
      const matched = CANONICAL_PATHWAY_MODELS.find(
        (m) =>
          m.workflowCategory.toLowerCase() === trimmed.toLowerCase() ||
          (m.slug && m.slug.toLowerCase() === trimmed.toLowerCase())
      );
      if (matched) {
        return matched.workflowCategory;
      }
    }
  }

  // Check 2: Derive from observed activities and departments
  const activities = new Set(caseSummary.activitySequence);
  const departments = new Set(
    caseSummary.events.map((e) => e.department).filter(Boolean) as string[]
  );

  const hasLab =
    activities.has('Laboratory Start') ||
    activities.has('Laboratory End') ||
    departments.has('Diagnostic Laboratory') ||
    departments.has('Pathology');

  const hasImaging =
    activities.has('Imaging Start') ||
    activities.has('Imaging End') ||
    departments.has('Radiology & Imaging') ||
    departments.has('Radiology');

  const hasPharmacy =
    activities.has('Pharmacy Start') ||
    activities.has('Pharmacy End') ||
    departments.has('Outpatient Pharmacy') ||
    departments.has('Pharmacy');

  // Classification combinations
  if (hasLab && hasImaging && hasPharmacy) {
    return 'Ambiguous Source Flow (Multi-Category Encounter)';
  }
  if (hasLab && hasImaging) {
    return 'Appointment → Prescription → Lab + Imaging';
  }
  if (hasImaging && hasPharmacy) {
    return 'Appointment → Prescription → Imaging + Pharmacy';
  }
  if (hasLab && hasPharmacy) {
    return 'Appointment → Prescription → Lab + Pharmacy';
  }
  if (hasLab) {
    return 'Appointment → Prescription → Lab';
  }
  if (hasImaging) {
    return 'Appointment → Prescription → Imaging';
  }
  if (hasPharmacy) {
    return 'Appointment → Prescription → Pharmacy';
  }

  return 'Appointment → Prescription';
}

/**
 * Retrieve the canonical metadata for a workflow category.
 */
export function getCanonicalModelForCategory(
  workflowCategory: string
): CanonicalPathwayModelMetadata | undefined {
  return CANONICAL_PATHWAY_MODELS.find(
    (m) => m.workflowCategory.toLowerCase() === workflowCategory.toLowerCase()
  );
}

/**
 * Retrieve the SLA threshold in minutes for a specific pathway.
 */
export function getPathwaySlaThreshold(
  workflowCategory: string,
  customThresholds?: Record<string, number>
): number {
  if (customThresholds && customThresholds[workflowCategory] !== undefined) {
    return customThresholds[workflowCategory];
  }
  if (DEFAULT_PATHWAY_SLA_THRESHOLDS_MINUTES[workflowCategory] !== undefined) {
    return DEFAULT_PATHWAY_SLA_THRESHOLDS_MINUTES[workflowCategory];
  }
  return GLOBAL_FALLBACK_SLA_THRESHOLD_MINUTES;
}

// ============================================================================
// Case-Level Compliance Evaluation Engine
// ============================================================================

export interface CaseEvaluationOptions {
  customSlaThresholds?: Record<string, number>;
  defaultSlaThresholdMinutes?: number;
  targetWorkflowCategory?: string;
}

/**
 * Evaluate an individual patient encounter case against its reference clinical pathway.
 *
 * Deterministic Classification Precedence:
 * 1. Protocol Deviation: Any structural violation (unmodeled activity, missing mandatory
 *    step, out-of-order execution, or orphan completion) immediately classifies the case
 *    as 'Protocol Deviation'. Even if the case also breached the operational SLA, clinical
 *    safety and guideline adherence take governing precedence.
 * 2. Delayed / SLA Risk: If the case possesses zero structural deviations but its elapsed
 *    duration exceeds the pathway SLA threshold, it is classified as 'Delayed / SLA Risk'.
 * 3. Compliant: If the case is structurally sound AND completed within the SLA threshold,
 *    it is classified as 'Compliant'.
 */
export function evaluateCaseCompliance(
  caseSummary: CaseSummary,
  options?: CaseEvaluationOptions
): CaseComplianceClassification {
  const workflowCategory =
    options?.targetWorkflowCategory || resolveCaseWorkflowCategory(caseSummary);

  const slaThresholdMinutes =
    options?.defaultSlaThresholdMinutes ??
    getPathwaySlaThreshold(workflowCategory, options?.customSlaThresholds);

  const durationMinutes = caseSummary.durationMinutes;
  const isSlaBreached = durationMinutes > slaThresholdMinutes;

  const isKnownPathway = CANONICAL_PATHWAY_DEFINITIONS[workflowCategory] !== undefined;
  const canonicalMetadata = getCanonicalModelForCategory(workflowCategory);
  const isDiscoveredModel = canonicalMetadata ? canonicalMetadata.isDiscovered : isKnownPathway;

  const definition = CANONICAL_PATHWAY_DEFINITIONS[workflowCategory] || {
    allowedActivities: [],
    requiredActivities: ['Appointment Start', 'Prescription Order'],
    expectedStartActivity: 'Appointment Start',
    expectedOrderActivity: 'Prescription Order',
    hasLaboratory: false,
    hasImaging: false,
    hasPharmacy: false,
    typicalSilentTauMoves: 0,
  };

  const allowedSet = new Set(definition.allowedActivities);
  const activities = caseSummary.activitySequence;
  const deviationsSummary: string[] = [];

  let syncMovesCount = 0;
  let logOnlyMovesCount = 0;
  let modelOnlyMovesCount = 0;

  // --------------------------------------------------------------------------
  // Rule 0A: Timestamp & Temporal Validity Check
  // --------------------------------------------------------------------------
  const hasInvalidDuration =
    typeof durationMinutes !== 'number' || isNaN(durationMinutes) || durationMinutes < 0;
  const hasInvalidTimestamps =
    !caseSummary.startTime ||
    !caseSummary.endTime ||
    isNaN(new Date(caseSummary.startTime).getTime()) ||
    isNaN(new Date(caseSummary.endTime).getTime()) ||
    caseSummary.events.some(
      (e) => !e.timestamp || isNaN(e.timestampMs) || isNaN(new Date(e.timestamp).getTime())
    );

  if (hasInvalidDuration || hasInvalidTimestamps) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      'Temporal validity failure: Encounter contains missing, unparseable, or negative timestamps; operational compliance cannot be certified.'
    );
  }

  // --------------------------------------------------------------------------
  // Rule 0B: Pathway Recognition & Low-Volume Support Tier Checks
  // --------------------------------------------------------------------------
  if (!isKnownPathway) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      `Unrecognized clinical pathway category "${workflowCategory}". No canonical reference model exists to certify compliance.`
    );
  } else if (!isDiscoveredModel && canonicalMetadata) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      `Unsupported low-volume cohort tier (${canonicalMetadata.sampleSizeTier}) in ${workflowCategory}. Model discovery was skipped in Phase 3 per statistical thresholds (< 30 cases); formal pathway compliance cannot be certified.`
    );
  }

  // --------------------------------------------------------------------------
  // Rule 1: Empty Case Check
  // --------------------------------------------------------------------------
  if (activities.length === 0) {
    modelOnlyMovesCount += definition.requiredActivities.length;
    deviationsSummary.push('Encounter contains zero recorded clinical events.');
    return {
      caseId: caseSummary.caseId,
      status: 'Protocol Deviation',
      workflowCategory,
      traceFitness: 0.0,
      durationMinutes,
      slaThresholdMinutes,
      isSlaBreached,
      hasStructuralDeviation: true,
      syncMovesCount: 0,
      logOnlyMovesCount: Math.max(1, logOnlyMovesCount),
      modelOnlyMovesCount,
      deviationsSummary,
      activitySequence: activities,
    };
  }

  // --------------------------------------------------------------------------
  // Rule 2: Unmodeled Activities (Log-Only Moves)
  // --------------------------------------------------------------------------
  const unmodeledActivities: string[] = [];
  for (const act of activities) {
    if (allowedSet.has(act)) {
      syncMovesCount++;
    } else {
      logOnlyMovesCount++;
      unmodeledActivities.push(act);
    }
  }

  if (unmodeledActivities.length > 0) {
    const uniqueUnmodeled = Array.from(new Set(unmodeledActivities));
    deviationsSummary.push(
      `Unmodeled activities not permitted in ${workflowCategory}: ${uniqueUnmodeled
        .map((a) => `"${a}"`)
        .join(', ')} (${unmodeledActivities.length} log-only ${
        unmodeledActivities.length === 1 ? 'move' : 'moves'
      }).`
    );
  }

  // --------------------------------------------------------------------------
  // Rule 3: Missing Required Activities (Model-Only Moves)
  // --------------------------------------------------------------------------
  const observedSet = new Set(activities);
  const missingRequired: string[] = [];

  for (const req of definition.requiredActivities) {
    if (!observedSet.has(req)) {
      modelOnlyMovesCount++;
      missingRequired.push(req);
    }
  }

  if (missingRequired.length > 0) {
    deviationsSummary.push(
      `Omitted mandatory pathway activities required by ${workflowCategory}: ${missingRequired
        .map((a) => `"${a}"`)
        .join(', ')} (${missingRequired.length} model-only ${
        missingRequired.length === 1 ? 'move' : 'moves'
      }).`
    );
  }

  // --------------------------------------------------------------------------
  // Rule 4: Consultation & Prescription Sequencing Check
  // --------------------------------------------------------------------------
  const firstApptStartIdx = activities.indexOf('Appointment Start');
  const firstPrescIdx = activities.indexOf('Prescription Order');

  if (firstApptStartIdx !== -1 && firstPrescIdx !== -1) {
    if (firstPrescIdx < firstApptStartIdx) {
      logOnlyMovesCount++;
      deviationsSummary.push(
        'Sequencing inversion: "Prescription Order" occurred prior to "Appointment Start" consultation check-in.'
      );
    }
  }

  // --------------------------------------------------------------------------
  // Rule 5: Diagnostic Lifecycle Pairing & Order (Start before End)
  // --------------------------------------------------------------------------
  for (const pair of DIAGNOSTIC_LIFECYCLE_PAIRS) {
    const startIndices: number[] = [];
    const endIndices: number[] = [];

    activities.forEach((act, idx) => {
      if (act === pair.start) startIndices.push(idx);
      if (act === pair.end) endIndices.push(idx);
    });

    // Check for orphan completion events (End without Start)
    if (endIndices.length > 0 && startIndices.length === 0) {
      logOnlyMovesCount++;
      deviationsSummary.push(
        `Orphan diagnostic completion: "${pair.end}" recorded without preceding "${pair.start}".`
      );
    } else if (endIndices.length > 0 && startIndices.length > 0) {
      // Check if any End occurs strictly before the first Start
      if (endIndices[0] < startIndices[0]) {
        logOnlyMovesCount++;
        deviationsSummary.push(
          `Diagnostic lifecycle inversion: "${pair.end}" occurred prior to initial "${pair.start}".`
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // Compute Alignment Fitness
  // --------------------------------------------------------------------------
  const totalMoves = syncMovesCount + logOnlyMovesCount + modelOnlyMovesCount;
  let traceFitness = 1.0;

  if (logOnlyMovesCount > 0 || modelOnlyMovesCount > 0) {
    // PM4Py integer normalized alignment fitness ratio
    const numerator = Math.max(0, syncMovesCount - (logOnlyMovesCount + modelOnlyMovesCount));
    traceFitness =
      totalMoves > 0
        ? Math.max(0, Math.round((numerator / totalMoves) * 10000) / 10000)
        : 0.0;
  }

  const hasStructuralDeviation = logOnlyMovesCount > 0 || modelOnlyMovesCount > 0;

  // --------------------------------------------------------------------------
  // Determine Classification Status by Strict Precedence
  // --------------------------------------------------------------------------
  let status: ComplianceState;

  if (hasStructuralDeviation) {
    // Precedence Level 1: Protocol Deviation
    status = 'Protocol Deviation';
    if (isSlaBreached) {
      deviationsSummary.push(
        `Dual risk note: Encounter also exceeded pathway SLA threshold (${durationMinutes} min vs ${slaThresholdMinutes} min target), but clinical Protocol Deviation governs.`
      );
    }
  } else if (isSlaBreached) {
    // Precedence Level 2: Delayed / SLA Risk
    status = 'Delayed / SLA Risk';
    deviationsSummary.push(
      `Operational SLA threshold breached: Encounter elapsed duration of ${durationMinutes} min exceeded pathway target of ${slaThresholdMinutes} min (excess: +${Math.round(
        (durationMinutes - slaThresholdMinutes) * 10
      ) / 10} min).`
    );
  } else {
    // Precedence Level 3: Compliant
    status = 'Compliant';
  }

  return {
    caseId: caseSummary.caseId,
    status,
    workflowCategory,
    traceFitness,
    durationMinutes,
    slaThresholdMinutes,
    isSlaBreached,
    hasStructuralDeviation,
    syncMovesCount,
    logOnlyMovesCount,
    modelOnlyMovesCount,
    deviationsSummary,
    activitySequence: activities,
  };
}

// ============================================================================
// Cohort-Level Compliance Evaluation & Aggregation
// ============================================================================

/**
 * Evaluate compliance across an entire active cohort of patient cases.
 * Returns individual classifications and aggregate summary metrics.
 */
export function evaluateCohortCompliance(
  cases: CaseSummary[],
  options?: CaseEvaluationOptions
): {
  classifications: CaseComplianceClassification[];
  summary: ComplianceSummaryMetrics;
} {
  if (cases.length === 0) {
    return {
      classifications: [],
      summary: {
        totalCasesEvaluated: 0,
        compliantCasesCount: 0,
        compliantPercentage: 0,
        delayedCasesCount: 0,
        delayedPercentage: 0,
        deviationCasesCount: 0,
        deviationPercentage: 0,
        averageTraceFitness: 0,
        totalSyncMoves: 0,
        totalLogOnlyMoves: 0,
        totalModelOnlyMoves: 0,
        totalSilentMoves: 0,
      },
    };
  }

  const classifications = cases.map((c) => evaluateCaseCompliance(c, options));

  let compliantCount = 0;
  let delayedCount = 0;
  let deviationCount = 0;
  let sumFitness = 0;
  let totalSyncMoves = 0;
  let totalLogOnlyMoves = 0;
  let totalModelOnlyMoves = 0;
  let totalSilentMoves = 0;

  for (const item of classifications) {
    if (item.status === 'Compliant') compliantCount++;
    else if (item.status === 'Delayed / SLA Risk') delayedCount++;
    else if (item.status === 'Protocol Deviation') deviationCount++;

    sumFitness += item.traceFitness;
    totalSyncMoves += item.syncMovesCount;
    totalLogOnlyMoves += item.logOnlyMovesCount;
    totalModelOnlyMoves += item.modelOnlyMovesCount;

    // Estimate silent tau moves for fitting paths from reference model definition
    const def = item.workflowCategory
      ? CANONICAL_PATHWAY_DEFINITIONS[item.workflowCategory]
      : undefined;
    totalSilentMoves += def?.typicalSilentTauMoves ?? 0;
  }

  const total = classifications.length;
  const compliantPercentage = Math.round((compliantCount / total) * 1000) / 10;
  const delayedPercentage = Math.round((delayedCount / total) * 1000) / 10;
  const deviationPercentage = Math.round((deviationCount / total) * 1000) / 10;
  const averageTraceFitness = Math.round((sumFitness / total) * 10000) / 10000;

  const summary: ComplianceSummaryMetrics = {
    totalCasesEvaluated: total,
    compliantCasesCount: compliantCount,
    compliantPercentage,
    delayedCasesCount: delayedCount,
    delayedPercentage,
    deviationCasesCount: deviationCount,
    deviationPercentage,
    averageTraceFitness,
    totalSyncMoves,
    totalLogOnlyMoves,
    totalModelOnlyMoves,
    totalSilentMoves,
  };

  return {
    classifications,
    summary,
  };
}

/**
 * Stratify compliance summary metrics across each distinct clinical pathway category.
 */
export function evaluateComplianceByCategory(
  cases: CaseSummary[],
  options?: CaseEvaluationOptions
): Record<string, ComplianceSummaryMetrics> {
  const grouped: Map<string, CaseSummary[]> = new Map();

  for (const c of cases) {
    const cat = resolveCaseWorkflowCategory(c);
    if (!grouped.has(cat)) {
      grouped.set(cat, []);
    }
    grouped.get(cat)!.push(c);
  }

  const result: Record<string, ComplianceSummaryMetrics> = {};

  grouped.forEach((cohortCases, cat) => {
    const { summary } = evaluateCohortCompliance(cohortCases, {
      ...options,
      targetWorkflowCategory: cat,
    });
    result[cat] = summary;
  });

  return result;
}

/**
 * Filter an array of cases by compliance state using pre-computed classifications.
 */
export function filterCasesByComplianceState(
  cases: CaseSummary[],
  classifications: CaseComplianceClassification[],
  targetState: ComplianceState | 'all'
): CaseSummary[] {
  if (targetState === 'all') return cases;

  const classificationMap = new Map<string, ComplianceState>();
  for (const item of classifications) {
    classificationMap.set(item.caseId, item.status);
  }

  return cases.filter((c) => classificationMap.get(c.caseId) === targetState);
}
