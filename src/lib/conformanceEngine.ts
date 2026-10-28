/**
 * CareFlow — Phase 5, Step 4: Cohort-Aware Conformance Modeling Engine
 *
 * This module implements client-side, deterministic case-level and cohort-level
 * compliance evaluation across multiple clinical cohort domains:
 * 1. Outpatient Pathway (Canonical Phase 3 PM4Py discovery Petri net models)
 * 2. Emergency Department Sepsis Pathway (Empirical resuscitation protocol rules & rework loop)
 * 3. Cardiology Cath Lab Acute Inpatient Log (ACS door-to-balloon PCI protocol)
 * 4. Unconfigured Datasets (Datasets without a supported clinical reference model)
 *
 * Methodological Notice: Client-Side Heuristic Conformance Evaluation
 * - Outpatient Conformance: Evaluated against empirical Phase 3 discovery models
 *   (documented in reports/conformance_alignment.md).
 * - Sepsis & Cardiology Conformance: Evaluated via deterministic domain-specific clinical heuristic
 *   milestone, ordering, disposition, and rework rules. Does not fabricate PM4Py Petri nets,
 *   silent transitions, alignment costs, or replay statistics.
 * - Unconfigured Datasets: Assigned 'Unconfigured Reference Model' status. Unsupported datasets
 *   are neither classified as clinically noncompliant nor counted as compliant.
 *
 * Clinical Governance Disclaimer:
 * All operational latency benchmarks in this module (e.g. ED Sepsis 332m P90, Outpatient P90s,
 * Door-to-Antibiotic latency) represent empirical statistical percentiles calculated from synthetic
 * simulation data. They serve strictly as configurable analytical operational thresholds for delay tracking,
 * NOT validated medical clinical guidelines, standard-of-care protocols, or regulatory healthcare SLAs.
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
  CohortDomain,
  DatasetMetadata,
} from '../types';
import {
  CANONICAL_PATHWAY_MODELS,
  CanonicalPathwayModelMetadata,
} from '../data/conformanceData';

// ============================================================================
// Empirical Analytical Latency Thresholds (Empirical P90 Benchmarks)
// ============================================================================

/**
 * Verified empirical 90th-percentile (P90) elapsed durations per outpatient clinical pathway category.
 * Sourced directly from data/processed/case_duration_summary.csv and
 * reports/performance_bottleneck_analysis.md.
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
 * Fallback SLA threshold when an outpatient case belongs to an unspecified category.
 * Sourced from the global cohort P90 duration in data/processed/case_duration_summary.csv.
 */
export const GLOBAL_FALLBACK_SLA_THRESHOLD_MINUTES = 196.0;

/**
 * Empirical P90 case duration benchmark for the synthetic Emergency Department Sepsis cohort.
 * Approved modeling decision: 332.0 minutes empirical benchmark.
 * Note: Strictly an empirical demonstration percentile, NOT a clinical guideline standard.
 */
export const ED_SEPSIS_EMPIRICAL_P90_SLA_MINUTES = 332.0;

/**
 * Empirical duration benchmark for the synthetic Cardiology Cath Lab acute inpatient log.
 * Note: Strictly an empirical demonstration percentile, NOT a clinical guideline standard.
 */
export const CARDIOLOGY_EMPIRICAL_P90_SLA_MINUTES = 180.0;

// ============================================================================
// Domain Activity Definitions & Milestone Configurations
// ============================================================================

/**
 * Permitted and required activity definitions per clinical pathway model.
 */
export interface PathwayActivityDefinition {
  allowedActivities: string[];
  requiredActivities: string[];
  expectedStartActivity: string;
  expectedOrderActivity?: string;
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
 * Diagnostic start/end activity pairs for outpatient lifecycle reconciliation.
 */
export const DIAGNOSTIC_LIFECYCLE_PAIRS = [
  { start: 'Laboratory Start', end: 'Laboratory End', stage: 'Laboratory' },
  { start: 'Imaging Start', end: 'Imaging End', stage: 'Imaging' },
  { start: 'Pharmacy Start', end: 'Pharmacy End', stage: 'Pharmacy' },
] as const;

// ============================================================================
// ED Sepsis Pathway Definition
// ============================================================================

export const SEPSIS_PATHWAY_DEFINITION = {
  workflowCategory: 'Emergency Department Sepsis Pathway',
  allowedActivities: [
    'ED Registration & Triage',
    'Initial Physician Assessment',
    'Stat Blood Draw & Biomarkers',
    'Central Laboratory Specimen Run',
    'Specimen Hemolysis / Re-draw Order',
    'Diagnostic CT / Angiography Imaging',
    'Sub-Specialist On-Call Consult',
    'Empiric Antibiotic / Targeted Therapy',
    'Discharge to Outpatient Care',
    'Inpatient Ward Bed Handover',
    'Direct ICU Bed Transfer',
  ],
  mandatoryMilestones: [
    'ED Registration & Triage',
    'Initial Physician Assessment',
    'Stat Blood Draw & Biomarkers',
    'Central Laboratory Specimen Run',
    'Empiric Antibiotic / Targeted Therapy',
  ],
  validDispositions: [
    'Discharge to Outpatient Care',
    'Inpatient Ward Bed Handover',
    'Direct ICU Bed Transfer',
  ],
  entryActivity: 'ED Registration & Triage',
  antibioticActivity: 'Empiric Antibiotic / Targeted Therapy',
  redrawActivity: 'Specimen Hemolysis / Re-draw Order',
} as const;

// ============================================================================
// Cardiology Cath Lab Pathway Definition
// ============================================================================

export const CARDIOLOGY_PATHWAY_DEFINITION = {
  workflowCategory: 'Cardiology Cath Lab Acute Inpatient Log',
  allowedActivities: [
    'Acute Chest Pain Presentation',
    'Stat 12-Lead ECG & High-Sensitivity Troponin',
    'Cardiologist Bedside Evaluation',
    'Cath Lab Suite Transfer & Sheath Insertion',
    'Percutaneous Coronary Intervention (PCI)',
    'Coronary Care Unit (CCU) Transfer',
  ],
  mandatoryMilestones: [
    'Acute Chest Pain Presentation',
    'Stat 12-Lead ECG & High-Sensitivity Troponin',
    'Cardiologist Bedside Evaluation',
    'Cath Lab Suite Transfer & Sheath Insertion',
    'Percutaneous Coronary Intervention (PCI)',
    'Coronary Care Unit (CCU) Transfer',
  ],
  entryActivity: 'Acute Chest Pain Presentation',
  terminalDisposition: 'Coronary Care Unit (CCU) Transfer',
} as const;

// ============================================================================
// Cohort Domain Resolution Engine
// ============================================================================

export interface CaseEvaluationOptions {
  customSlaThresholds?: Record<string, number>;
  defaultSlaThresholdMinutes?: number;
  targetWorkflowCategory?: string;
  cohortDomain?: CohortDomain;
  datasetMetadata?: DatasetMetadata | { id?: string; name?: string; filename?: string };
}

/**
 * Deterministically resolve the clinical cohort domain for a case, dataset, or cohort.
 *
 * Precedence:
 * 1. Explicit domain provided in options (`options.cohortDomain`).
 * 2. Explicit dataset metadata binding (preset ID, name, filename).
 * 3. Hallmark activity inspection from observed events.
 * 4. Fallback to 'unconfigured' for unrecognized schemas/datasets.
 */
export function resolveCohortDomain(
  caseSummaryOrCases: CaseSummary | CaseSummary[],
  options?: CaseEvaluationOptions
): CohortDomain {
  if (options?.cohortDomain) {
    return options.cohortDomain;
  }

  // Check dataset metadata if provided
  if (options?.datasetMetadata) {
    const id = (options.datasetMetadata.id || '').toLowerCase();
    const name = (options.datasetMetadata.name || '').toLowerCase();
    const filename = (options.datasetMetadata.filename || '').toLowerCase();

    if (
      id === 'preset-careflow-outpatient-2026' ||
      name.includes('outpatient') ||
      filename.includes('outpatient')
    ) {
      return 'outpatient';
    }
    if (
      id === 'preset-sepsis-2026' ||
      name.includes('sepsis') ||
      filename.includes('sepsis')
    ) {
      return 'ed_sepsis';
    }
    if (
      id === 'preset-cardiology-2026' ||
      name.includes('cardiology') ||
      filename.includes('cardiology') ||
      filename.includes('cathlab')
    ) {
      return 'cardiology';
    }

    // Custom uploaded datasets with no matching preset are unconfigured
    if (id.startsWith('uploaded') || id.startsWith('custom')) {
      return 'unconfigured';
    }
  }

  // Inspect case activities for hallmark clinical markers
  const cases = Array.isArray(caseSummaryOrCases) ? caseSummaryOrCases : [caseSummaryOrCases];
  if (cases.length === 0) {
    return 'unconfigured';
  }

  const allActivities = new Set<string>();
  for (const c of cases) {
    for (const act of c.activitySequence) {
      allActivities.add(act);
    }
  }

  // If no activities are recorded at all, fallback to outpatient so Rule 1 Empty Case Check applies
  if (allActivities.size === 0) {
    return 'outpatient';
  }

  // Cardiology hallmarks
  if (
    allActivities.has('Acute Chest Pain Presentation') ||
    allActivities.has('Percutaneous Coronary Intervention (PCI)') ||
    allActivities.has('Cath Lab Suite Transfer & Sheath Insertion') ||
    allActivities.has('Coronary Care Unit (CCU) Transfer')
  ) {
    return 'cardiology';
  }

  // ED Sepsis hallmarks
  if (
    allActivities.has('ED Registration & Triage') ||
    allActivities.has('Empiric Antibiotic / Targeted Therapy') ||
    allActivities.has('Stat Blood Draw & Biomarkers') ||
    allActivities.has('Initial Physician Assessment')
  ) {
    return 'ed_sepsis';
  }

  // Outpatient hallmarks
  if (
    allActivities.has('Appointment Start') ||
    allActivities.has('Prescription Order')
  ) {
    return 'outpatient';
  }

  return 'unconfigured';
}

// ============================================================================
// Workflow Category Resolution (Outpatient Categories)
// ============================================================================

/**
 * Deterministically resolve the clinical workflow category for an outpatient encounter.
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

export function getCanonicalModelForCategory(
  workflowCategory: string
): CanonicalPathwayModelMetadata | undefined {
  return CANONICAL_PATHWAY_MODELS.find(
    (m) => m.workflowCategory.toLowerCase() === workflowCategory.toLowerCase()
  );
}

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
// Domain Evaluator 1: Outpatient Pathway Conformance
// ============================================================================

export function evaluateOutpatientCaseCompliance(
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

  // Rule 0A: Timestamp & Temporal Validity Check
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

  // Rule 0B: Pathway Recognition & Low-Volume Support Tier Checks
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

  // Rule 1: Empty Case Check
  if (activities.length === 0) {
    modelOnlyMovesCount += definition.requiredActivities.length;
    deviationsSummary.push('Encounter contains zero recorded clinical events.');
    return {
      caseId: caseSummary.caseId,
      status: 'Protocol Deviation',
      workflowCategory,
      cohortDomain: 'outpatient',
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

  // Rule 2: Unmodeled Activities (Log-Only Moves)
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

  // Rule 3: Missing Required Activities (Model-Only Moves)
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

  // Rule 4: Consultation & Prescription Sequencing Check
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

  // Rule 5: Diagnostic Lifecycle Pairing & Order (Start before End)
  for (const pair of DIAGNOSTIC_LIFECYCLE_PAIRS) {
    const startIndices: number[] = [];
    const endIndices: number[] = [];

    activities.forEach((act, idx) => {
      if (act === pair.start) startIndices.push(idx);
      if (act === pair.end) endIndices.push(idx);
    });

    if (endIndices.length > 0 && startIndices.length === 0) {
      logOnlyMovesCount++;
      deviationsSummary.push(
        `Orphan diagnostic completion: "${pair.end}" recorded without preceding "${pair.start}".`
      );
    } else if (endIndices.length > 0 && startIndices.length > 0) {
      if (endIndices[0] < startIndices[0]) {
        logOnlyMovesCount++;
        deviationsSummary.push(
          `Diagnostic lifecycle inversion: "${pair.end}" occurred prior to initial "${pair.start}".`
        );
      }
    }
  }

  // Compute Alignment Fitness
  const totalMoves = syncMovesCount + logOnlyMovesCount + modelOnlyMovesCount;
  let traceFitness = 1.0;

  if (logOnlyMovesCount > 0 || modelOnlyMovesCount > 0) {
    const numerator = Math.max(0, syncMovesCount - (logOnlyMovesCount + modelOnlyMovesCount));
    traceFitness =
      totalMoves > 0
        ? Math.max(0, Math.round((numerator / totalMoves) * 10000) / 10000)
        : 0.0;
  }

  const hasStructuralDeviation = logOnlyMovesCount > 0 || modelOnlyMovesCount > 0;

  let status: ComplianceState;
  if (hasStructuralDeviation) {
    status = 'Protocol Deviation';
    if (isSlaBreached) {
      deviationsSummary.push(
        `Dual risk note: Encounter also exceeded pathway SLA threshold (${durationMinutes} min vs ${slaThresholdMinutes} min target), but clinical Protocol Deviation governs.`
      );
    }
  } else if (isSlaBreached) {
    status = 'Delayed / SLA Risk';
    deviationsSummary.push(
      `Operational SLA threshold breached: Encounter elapsed duration of ${durationMinutes} min exceeded pathway target of ${slaThresholdMinutes} min (excess: +${Math.round(
        (durationMinutes - slaThresholdMinutes) * 10
      ) / 10} min).`
    );
  } else {
    status = 'Compliant';
  }

  return {
    caseId: caseSummary.caseId,
    status,
    workflowCategory,
    cohortDomain: 'outpatient',
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
// Domain Evaluator 2: Emergency Department Sepsis Conformance
// ============================================================================

export function evaluateSepsisCaseCompliance(
  caseSummary: CaseSummary,
  options?: CaseEvaluationOptions
): CaseComplianceClassification {
  const workflowCategory =
    options?.targetWorkflowCategory || SEPSIS_PATHWAY_DEFINITION.workflowCategory;

  const slaThresholdMinutes =
    options?.defaultSlaThresholdMinutes ??
    (options?.customSlaThresholds?.[workflowCategory] ?? ED_SEPSIS_EMPIRICAL_P90_SLA_MINUTES);

  const durationMinutes = caseSummary.durationMinutes;
  const isSlaBreached = durationMinutes > slaThresholdMinutes;

  const activities = caseSummary.activitySequence;
  const deviationsSummary: string[] = [];

  let syncMovesCount = 0;
  let logOnlyMovesCount = 0;
  let modelOnlyMovesCount = 0;

  // Temporal Validity Check
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

  // Calculate Door-to-Antibiotic Latency
  let doorToAntibioticMinutes: number | null = null;
  const triageEvent = caseSummary.events.find(
    (e) => e.activity === SEPSIS_PATHWAY_DEFINITION.entryActivity
  );
  const abxEvent = caseSummary.events.find(
    (e) => e.activity === SEPSIS_PATHWAY_DEFINITION.antibioticActivity
  );
  if (triageEvent && abxEvent && abxEvent.timestampMs >= triageEvent.timestampMs) {
    doorToAntibioticMinutes =
      Math.round(((abxEvent.timestampMs - triageEvent.timestampMs) / 60000) * 10) / 10;
  }

  // Rule 1: Empty Case Check
  if (activities.length === 0) {
    modelOnlyMovesCount += SEPSIS_PATHWAY_DEFINITION.mandatoryMilestones.length + 1;
    deviationsSummary.push('Encounter contains zero recorded clinical events.');
    return {
      caseId: caseSummary.caseId,
      status: 'Protocol Deviation',
      workflowCategory,
      cohortDomain: 'ed_sepsis',
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
      doorToAntibioticMinutes,
    };
  }

  // Rule 2: Unmodeled Activities (Log-Only Moves)
  const allowedSet = new Set<string>(SEPSIS_PATHWAY_DEFINITION.allowedActivities);
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
      `Unmodeled activities not permitted in ED Sepsis protocol: ${uniqueUnmodeled
        .map((a) => `"${a}"`)
        .join(', ')} (${unmodeledActivities.length} log-only ${
        unmodeledActivities.length === 1 ? 'move' : 'moves'
      }).`
    );
  }

  // Rule 3: Mandatory Milestones (Model-Only Moves)
  const observedSet = new Set(activities);
  for (const milestone of SEPSIS_PATHWAY_DEFINITION.mandatoryMilestones) {
    if (!observedSet.has(milestone)) {
      modelOnlyMovesCount++;
      deviationsSummary.push(
        `Omitted mandatory sepsis milestone: "${milestone}" was not documented in the clinical encounter.`
      );
    }
  }

  // Disposition Milestone Check
  const validDispositions = new Set<string>(SEPSIS_PATHWAY_DEFINITION.validDispositions);
  const observedDispositions = activities.filter((act) => validDispositions.has(act));
  if (observedDispositions.length === 0) {
    modelOnlyMovesCount++;
    deviationsSummary.push(
      'Omitted mandatory disposition milestone: Encounter lacks an authorized emergency department disposition (ICU Bed, Inpatient Ward, or Discharge).'
    );
  }

  // Rule 4: Clinical Ordering & Milestone Constraints
  // 4A: Entry milestone must be ED Registration & Triage
  if (activities[0] !== SEPSIS_PATHWAY_DEFINITION.entryActivity) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      `Protocol entry violation: Encounter commenced with "${activities[0]}" instead of mandatory initial "${SEPSIS_PATHWAY_DEFINITION.entryActivity}".`
    );
  }

  // 4B: Registration before Initial Physician Assessment
  const triageIdx = activities.indexOf(SEPSIS_PATHWAY_DEFINITION.entryActivity);
  const physicianIdx = activities.indexOf('Initial Physician Assessment');
  if (triageIdx !== -1 && physicianIdx !== -1 && physicianIdx < triageIdx) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      'Sequencing inversion: "Initial Physician Assessment" recorded prior to "ED Registration & Triage".'
    );
  }

  // 4C: Physician Assessment before initial Stat Blood Draw
  const firstBloodDrawIdx = activities.indexOf('Stat Blood Draw & Biomarkers');
  if (physicianIdx !== -1 && firstBloodDrawIdx !== -1 && firstBloodDrawIdx < physicianIdx) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      'Sequencing inversion: "Stat Blood Draw & Biomarkers" occurred before "Initial Physician Assessment".'
    );
  }

  // 4D: First Blood Draw before Central Lab Specimen Run
  const firstLabRunIdx = activities.indexOf('Central Laboratory Specimen Run');
  if (firstBloodDrawIdx !== -1 && firstLabRunIdx !== -1 && firstLabRunIdx < firstBloodDrawIdx) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      'Sequencing inversion: "Central Laboratory Specimen Run" occurred prior to "Stat Blood Draw & Biomarkers".'
    );
  }

  // 4E: Specimen Redraw Rework Loop Validation (Approved Decision 1)
  // Sepsis Variant 4 specimen redraw is an allowed rework loop, not an automatic deviation.
  const redrawIndices: number[] = [];
  activities.forEach((act, idx) => {
    if (act === SEPSIS_PATHWAY_DEFINITION.redrawActivity) redrawIndices.push(idx);
  });

  if (redrawIndices.length > 0) {
    for (const rIdx of redrawIndices) {
      // Must be preceded by a Central Laboratory Specimen Run
      const precedingLab = activities.slice(0, rIdx).includes('Central Laboratory Specimen Run');
      if (!precedingLab) {
        logOnlyMovesCount++;
        deviationsSummary.push(
          'Anomalous redraw order: "Specimen Hemolysis / Re-draw Order" issued without preceding initial laboratory run.'
        );
      }
      // Must be followed by repeat blood draw and subsequent repeat lab run
      const subsequentActivities = activities.slice(rIdx + 1);
      const hasRepeatBlood = subsequentActivities.includes('Stat Blood Draw & Biomarkers');
      const hasRepeatLab = subsequentActivities.includes('Central Laboratory Specimen Run');
      if (!hasRepeatBlood || !hasRepeatLab) {
        logOnlyMovesCount++;
        deviationsSummary.push(
          'Incomplete redraw rework loop: Redraw order was not followed by confirmed re-phlebotomy and specimen verification run.'
        );
      }
    }
  }

  // 4F: Antibiotic Administration Sequencing
  const abxIdx = activities.indexOf(SEPSIS_PATHWAY_DEFINITION.antibioticActivity);
  if (firstLabRunIdx !== -1 && abxIdx !== -1 && abxIdx < firstLabRunIdx) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      'Sequencing violation: "Empiric Antibiotic / Targeted Therapy" administered prior to initial diagnostic specimen acquisition and lab run.'
    );
  }

  // 4G: CT Imaging & Specialist Consult sequencing (if present)
  const ctIdx = activities.indexOf('Diagnostic CT / Angiography Imaging');
  const consultIdx = activities.indexOf('Sub-Specialist On-Call Consult');

  if (ctIdx !== -1 && firstLabRunIdx !== -1 && ctIdx < firstLabRunIdx) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      'Sequencing inversion: "Diagnostic CT / Angiography Imaging" occurred prior to initial laboratory specimen run.'
    );
  }

  if (consultIdx !== -1 && ctIdx !== -1 && consultIdx < ctIdx) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      'Sequencing inversion: "Sub-Specialist On-Call Consult" occurred prior to CT imaging scan acquisition.'
    );
  }

  // 4H: Terminal Disposition & Acuity Rules
  const lastActivity = activities[activities.length - 1];
  if (!validDispositions.has(lastActivity)) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      `Invalid disposition conclusion: Case concluded with "${lastActivity}" instead of an authorized discharge or bed transfer milestone.`
    );
  }

  // Premature disposition check (disposition before antibiotic)
  if (abxIdx !== -1) {
    for (const disp of observedDispositions) {
      const dIdx = activities.indexOf(disp);
      if (dIdx !== -1 && dIdx < abxIdx) {
        logOnlyMovesCount++;
        deviationsSummary.push(
          `Premature disposition: Case was assigned disposition "${disp}" prior to administration of empiric antimicrobial therapy.`
        );
      }
    }
  }

  // Acuity check: if specialist consult was conducted (ICU pathway), disposition must be ICU Transfer
  if (consultIdx !== -1 && lastActivity !== 'Direct ICU Bed Transfer') {
    logOnlyMovesCount++;
    deviationsSummary.push(
      `Acuity-mismatched disposition: Case underwent specialist on-call consult for acute resuscitation but was dispositioned to "${lastActivity}" instead of mandatory "Direct ICU Bed Transfer".`
    );
  }

  // Trace Fitness Computation
  const totalMoves = syncMovesCount + logOnlyMovesCount + modelOnlyMovesCount;
  let traceFitness = 1.0;
  if (logOnlyMovesCount > 0 || modelOnlyMovesCount > 0) {
    const numerator = Math.max(0, syncMovesCount - (logOnlyMovesCount + modelOnlyMovesCount));
    traceFitness =
      totalMoves > 0
        ? Math.max(0, Math.round((numerator / totalMoves) * 10000) / 10000)
        : 0.0;
  }

  const hasStructuralDeviation = logOnlyMovesCount > 0 || modelOnlyMovesCount > 0;

  let status: ComplianceState;
  if (hasStructuralDeviation) {
    status = 'Protocol Deviation';
    if (isSlaBreached) {
      deviationsSummary.push(
        `Dual risk note: Encounter also exceeded empirical P90 case duration benchmark (${durationMinutes} min vs ${slaThresholdMinutes} min threshold), but protocol deviation governs.`
      );
    }
  } else if (isSlaBreached) {
    status = 'Delayed / SLA Risk';
    deviationsSummary.push(
      `Operational SLA threshold breached: Encounter elapsed duration of ${durationMinutes} min exceeded empirical P90 benchmark of ${slaThresholdMinutes} min (excess: +${Math.round(
        (durationMinutes - slaThresholdMinutes) * 10
      ) / 10} min).`
    );
  } else {
    status = 'Compliant';
  }

  return {
    caseId: caseSummary.caseId,
    status,
    workflowCategory,
    cohortDomain: 'ed_sepsis',
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
    doorToAntibioticMinutes,
  };
}

// ============================================================================
// Domain Evaluator 3: Cardiology Cath Lab Conformance
// ============================================================================

export function evaluateCardiologyCaseCompliance(
  caseSummary: CaseSummary,
  options?: CaseEvaluationOptions
): CaseComplianceClassification {
  const workflowCategory =
    options?.targetWorkflowCategory || CARDIOLOGY_PATHWAY_DEFINITION.workflowCategory;

  const slaThresholdMinutes =
    options?.defaultSlaThresholdMinutes ??
    (options?.customSlaThresholds?.[workflowCategory] ?? CARDIOLOGY_EMPIRICAL_P90_SLA_MINUTES);

  const durationMinutes = caseSummary.durationMinutes;
  const isSlaBreached = durationMinutes > slaThresholdMinutes;

  const activities = caseSummary.activitySequence;
  const deviationsSummary: string[] = [];

  let syncMovesCount = 0;
  let logOnlyMovesCount = 0;
  let modelOnlyMovesCount = 0;

  // Temporal Validity Check
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

  // Rule 1: Empty Case Check
  if (activities.length === 0) {
    modelOnlyMovesCount += CARDIOLOGY_PATHWAY_DEFINITION.mandatoryMilestones.length;
    deviationsSummary.push('Encounter contains zero recorded clinical events.');
    return {
      caseId: caseSummary.caseId,
      status: 'Protocol Deviation',
      workflowCategory,
      cohortDomain: 'cardiology',
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

  // Rule 2: Unmodeled Activities
  const allowedSet = new Set<string>(CARDIOLOGY_PATHWAY_DEFINITION.allowedActivities);
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
      `Unmodeled activities not permitted in Cardiology Cath Lab protocol: ${uniqueUnmodeled
        .map((a) => `"${a}"`)
        .join(', ')} (${unmodeledActivities.length} log-only ${
        unmodeledActivities.length === 1 ? 'move' : 'moves'
      }).`
    );
  }

  // Rule 3: Mandatory Milestones Check
  const observedSet = new Set(activities);
  for (const milestone of CARDIOLOGY_PATHWAY_DEFINITION.mandatoryMilestones) {
    if (!observedSet.has(milestone)) {
      modelOnlyMovesCount++;
      deviationsSummary.push(
        `Omitted mandatory cardiology milestone: "${milestone}" is required for catheterization lab compliance.`
      );
    }
  }

  // Rule 4: Strict Linear Sequence Invariants
  const expectedSequence = CARDIOLOGY_PATHWAY_DEFINITION.allowedActivities;

  // 4A: Entry milestone
  if (activities[0] !== CARDIOLOGY_PATHWAY_DEFINITION.entryActivity) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      `Protocol entry violation: Encounter commenced with "${activities[0]}" instead of mandatory initial "${CARDIOLOGY_PATHWAY_DEFINITION.entryActivity}".`
    );
  }

  // 4B: Linear step-by-step order checks
  for (let s = 0; s < expectedSequence.length - 1; s++) {
    const stepA = expectedSequence[s];
    const stepB = expectedSequence[s + 1];
    const idxA = activities.indexOf(stepA);
    const idxB = activities.indexOf(stepB);

    if (idxA !== -1 && idxB !== -1 && idxB < idxA) {
      logOnlyMovesCount++;
      deviationsSummary.push(
        `Sequencing inversion: "${stepB}" occurred prior to required preceding step "${stepA}".`
      );
    }
  }

  // 4C: Terminal Disposition Check
  const lastActivity = activities[activities.length - 1];
  if (lastActivity !== CARDIOLOGY_PATHWAY_DEFINITION.terminalDisposition) {
    logOnlyMovesCount++;
    deviationsSummary.push(
      `Invalid disposition conclusion: Case concluded with "${lastActivity}" instead of mandatory "${CARDIOLOGY_PATHWAY_DEFINITION.terminalDisposition}".`
    );
  }

  // Trace Fitness Computation
  const totalMoves = syncMovesCount + logOnlyMovesCount + modelOnlyMovesCount;
  let traceFitness = 1.0;
  if (logOnlyMovesCount > 0 || modelOnlyMovesCount > 0) {
    const numerator = Math.max(0, syncMovesCount - (logOnlyMovesCount + modelOnlyMovesCount));
    traceFitness =
      totalMoves > 0
        ? Math.max(0, Math.round((numerator / totalMoves) * 10000) / 10000)
        : 0.0;
  }

  const hasStructuralDeviation = logOnlyMovesCount > 0 || modelOnlyMovesCount > 0;

  let status: ComplianceState;
  if (hasStructuralDeviation) {
    status = 'Protocol Deviation';
    if (isSlaBreached) {
      deviationsSummary.push(
        `Dual risk note: Encounter also exceeded duration benchmark (${durationMinutes} min vs ${slaThresholdMinutes} min threshold), but protocol deviation governs.`
      );
    }
  } else if (isSlaBreached) {
    status = 'Delayed / SLA Risk';
    deviationsSummary.push(
      `Operational SLA threshold breached: Encounter elapsed duration of ${durationMinutes} min exceeded target of ${slaThresholdMinutes} min (excess: +${Math.round(
        (durationMinutes - slaThresholdMinutes) * 10
      ) / 10} min).`
    );
  } else {
    status = 'Compliant';
  }

  return {
    caseId: caseSummary.caseId,
    status,
    workflowCategory,
    cohortDomain: 'cardiology',
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
// Domain Evaluator 4: Unconfigured Reference Model State
// ============================================================================

export function evaluateUnconfiguredCaseCompliance(
  caseSummary: CaseSummary,
  options?: CaseEvaluationOptions
): CaseComplianceClassification {
  const workflowCategory = options?.targetWorkflowCategory || 'Unconfigured Reference Model';
  const durationMinutes = caseSummary.durationMinutes;

  return {
    caseId: caseSummary.caseId,
    status: 'Unconfigured Reference Model',
    workflowCategory,
    cohortDomain: 'unconfigured',
    traceFitness: 0.0,
    durationMinutes,
    slaThresholdMinutes: undefined,
    isSlaBreached: false,
    hasStructuralDeviation: false,
    isUnconfigured: true,
    syncMovesCount: 0,
    logOnlyMovesCount: 0,
    modelOnlyMovesCount: 0,
    deviationsSummary: [
      'Unconfigured Reference Model: No clinical reference pathway model is configured for this dataset or pathway category. Conformance alignment and operational SLA compliance cannot be certified.',
    ],
    activitySequence: caseSummary.activitySequence,
  };
}

// ============================================================================
// Unified Case-Level Compliance Evaluation Engine
// ============================================================================

/**
 * Evaluate an individual patient encounter case using cohort-aware domain resolution.
 */
export function evaluateCaseCompliance(
  caseSummary: CaseSummary,
  options?: CaseEvaluationOptions
): CaseComplianceClassification {
  const domain = resolveCohortDomain(caseSummary, options);

  switch (domain) {
    case 'outpatient':
      return evaluateOutpatientCaseCompliance(caseSummary, options);
    case 'ed_sepsis':
      return evaluateSepsisCaseCompliance(caseSummary, options);
    case 'cardiology':
      return evaluateCardiologyCaseCompliance(caseSummary, options);
    case 'unconfigured':
    default:
      return evaluateUnconfiguredCaseCompliance(caseSummary, options);
  }
}

// ============================================================================
// Cohort-Level Compliance Evaluation & Aggregation
// ============================================================================

/**
 * Local continuous linear quantile calculation matching NumPy/PM4Py method='linear'.
 */
function computeLinearPercentile(numbers: number[], p: number): number {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

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
  const domain = resolveCohortDomain(cases, options);

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
        unconfiguredCasesCount: 0,
        unconfiguredPercentage: 0,
        averageTraceFitness: 0,
        totalSyncMoves: 0,
        totalLogOnlyMoves: 0,
        totalModelOnlyMoves: 0,
        totalSilentMoves: 0,
        cohortDomain: domain,
        doorToAntibioticMetrics: null,
      },
    };
  }

  // Pass resolved domain down to individual case evaluations
  const caseOptions: CaseEvaluationOptions = {
    ...options,
    cohortDomain: domain,
  };

  const classifications = cases.map((c) => evaluateCaseCompliance(c, caseOptions));

  let compliantCount = 0;
  let delayedCount = 0;
  let deviationCount = 0;
  let unconfiguredCount = 0;
  let sumFitness = 0;
  let totalSyncMoves = 0;
  let totalLogOnlyMoves = 0;
  let totalModelOnlyMoves = 0;
  let totalSilentMoves = 0;

  const doorToAbxValues: number[] = [];

  for (const item of classifications) {
    if (item.status === 'Compliant') compliantCount++;
    else if (item.status === 'Delayed / SLA Risk') delayedCount++;
    else if (item.status === 'Protocol Deviation') deviationCount++;
    else if (item.status === 'Unconfigured Reference Model') unconfiguredCount++;

    sumFitness += item.traceFitness;
    totalSyncMoves += item.syncMovesCount;
    totalLogOnlyMoves += item.logOnlyMovesCount;
    totalModelOnlyMoves += item.modelOnlyMovesCount;

    // Silent tau moves only exist for PM4Py-derived Outpatient Petri net models
    if (domain === 'outpatient') {
      const def = item.workflowCategory
        ? CANONICAL_PATHWAY_DEFINITIONS[item.workflowCategory]
        : undefined;
      totalSilentMoves += def?.typicalSilentTauMoves ?? 0;
    }

    if (item.doorToAntibioticMinutes !== null && item.doorToAntibioticMinutes !== undefined) {
      doorToAbxValues.push(item.doorToAntibioticMinutes);
    }
  }

  const total = classifications.length;
  const compliantPercentage = Math.round((compliantCount / total) * 1000) / 10;
  const delayedPercentage = Math.round((delayedCount / total) * 1000) / 10;
  const deviationPercentage = Math.round((deviationCount / total) * 1000) / 10;
  const unconfiguredPercentage = Math.round((unconfiguredCount / total) * 1000) / 10;
  const averageTraceFitness = Math.round((sumFitness / total) * 10000) / 10000;

  let doorToAntibioticMetrics: ComplianceSummaryMetrics['doorToAntibioticMetrics'] = null;
  if (doorToAbxValues.length > 0) {
    doorToAntibioticMetrics = {
      medianMinutes: Math.round(computeLinearPercentile(doorToAbxValues, 50) * 10) / 10,
      p90Minutes: Math.round(computeLinearPercentile(doorToAbxValues, 90) * 10) / 10,
      evaluatedCasesCount: doorToAbxValues.length,
    };
  }

  const summary: ComplianceSummaryMetrics = {
    totalCasesEvaluated: total,
    compliantCasesCount: compliantCount,
    compliantPercentage,
    delayedCasesCount: delayedCount,
    delayedPercentage,
    deviationCasesCount: deviationCount,
    deviationPercentage,
    unconfiguredCasesCount: unconfiguredCount,
    unconfiguredPercentage,
    averageTraceFitness,
    totalSyncMoves,
    totalLogOnlyMoves,
    totalModelOnlyMoves,
    totalSilentMoves,
    cohortDomain: domain,
    doorToAntibioticMetrics,
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
  const domain = resolveCohortDomain(cases, options);

  if (domain !== 'outpatient') {
    // For single-pathway domains (ED Sepsis, Cardiology Cath Lab, Unconfigured)
    const { summary } = evaluateCohortCompliance(cases, options);
    const categoryName =
      domain === 'ed_sepsis'
        ? SEPSIS_PATHWAY_DEFINITION.workflowCategory
        : domain === 'cardiology'
        ? CARDIOLOGY_PATHWAY_DEFINITION.workflowCategory
        : 'Unconfigured Reference Model';
    return { [categoryName]: summary };
  }

  // Outpatient category stratification
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
      cohortDomain: 'outpatient',
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
