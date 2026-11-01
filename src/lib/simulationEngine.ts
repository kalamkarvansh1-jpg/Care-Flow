/**
 * CareFlow — Phase 6: Operational Bottleneck Intervention & What-If Simulation Engine
 *
 * This module implements a client-side, deterministic simulation engine that models
 * hypothetical operational bottleneck interventions on clinical event logs.
 *
 * Methodological & Epistemological Notice:
 * 1. Client-Side Trace Re-timing: All simulations re-time observed transition intervals
 *    using pure deterministic functions. Source event logs, canonical datasets, and original
 *    case objects are NEVER mutated in place.
 * 2. Operational Model Assumptions: Simulated reductions represent user-configured parametric
 *    adjustments for process optimization decision support. They do NOT represent validated
 *    clinical trial findings, regulatory healthcare SLAs, or guaranteed throughput increases.
 * 3. Empirical Benchmarks: Duration thresholds represent empirical demonstration percentiles,
 *    not certified clinical standards.
 * 4. Non-Negative Durations: Step elapsed times and case durations are guaranteed non-negative (>= 0).
 */

import { CaseSummary } from '../types';
import {
  SimulationIntervention,
  SimulationScenario,
  SimulationResult,
  ComparativeMetricDelta,
  SimulatedCaseResult,
  TransitionSimulationSummary,
} from '../types/simulation';
import {
  calculatePercentile,
  calculateMedian,
  calculateMean,
} from './dataProcessing';

/**
 * Standard methodological disclaimer for simulation results.
 */
export const SIMULATION_MODEL_DISCLAIMER =
  'Hypothetical What-If Simulation — Operational Model Assumption. All simulated reductions reflect parametric user-defined adjustments for process optimization decision support. They do not represent validated clinical trial findings, regulatory healthcare SLAs, or empirical evidence of clinical care efficacy.';

/**
 * Validate a single simulation intervention.
 */
export function validateIntervention(
  intervention: SimulationIntervention
): { isValid: boolean; error?: string } {
  if (!intervention || typeof intervention !== 'object') {
    return { isValid: false, error: 'Intervention must be a valid object.' };
  }

  if (!intervention.from || typeof intervention.from !== 'string' || intervention.from.trim() === '') {
    return { isValid: false, error: 'Intervention source activity ("from") cannot be empty.' };
  }

  if (!intervention.to || typeof intervention.to !== 'string' || intervention.to.trim() === '') {
    return { isValid: false, error: 'Intervention destination activity ("to") cannot be empty.' };
  }

  const validTypes = ['percentage', 'cap', 'combined'];
  if (!validTypes.includes(intervention.type)) {
    return {
      isValid: false,
      error: `Intervention type must be one of: ${validTypes.join(', ')}.`,
    };
  }

  if (intervention.type === 'percentage' || intervention.type === 'combined') {
    if (
      intervention.reductionPercentage === undefined ||
      typeof intervention.reductionPercentage !== 'number' ||
      isNaN(intervention.reductionPercentage) ||
      intervention.reductionPercentage < 0 ||
      intervention.reductionPercentage > 100
    ) {
      return {
        isValid: false,
        error: `Reduction percentage must be a number between 0 and 100 (got ${intervention.reductionPercentage}).`,
      };
    }
  }

  if (intervention.type === 'cap' || intervention.type === 'combined') {
    if (
      intervention.maxDurationMinutes === undefined ||
      typeof intervention.maxDurationMinutes !== 'number' ||
      isNaN(intervention.maxDurationMinutes) ||
      intervention.maxDurationMinutes < 0
    ) {
      return {
        isValid: false,
        error: `Maximum duration cap must be a non-negative number (got ${intervention.maxDurationMinutes}).`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Validate an entire simulation scenario.
 */
export function validateScenario(
  scenario: SimulationScenario
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!scenario || typeof scenario !== 'object') {
    return { isValid: false, errors: ['Scenario must be a valid object.'] };
  }

  if (!scenario.id || typeof scenario.id !== 'string' || scenario.id.trim() === '') {
    errors.push('Scenario ID cannot be empty.');
  }

  if (!scenario.name || typeof scenario.name !== 'string' || scenario.name.trim() === '') {
    errors.push('Scenario name cannot be empty.');
  }

  if (!Array.isArray(scenario.interventions)) {
    errors.push('Scenario interventions must be an array.');
  } else {
    scenario.interventions.forEach((int, idx) => {
      const res = validateIntervention(int);
      if (!res.isValid) {
        errors.push(`Intervention [${idx}]: ${res.error}`);
      }
    });
  }

  if (
    scenario.empiricalThresholdMinutes !== undefined &&
    (typeof scenario.empiricalThresholdMinutes !== 'number' ||
      isNaN(scenario.empiricalThresholdMinutes) ||
      scenario.empiricalThresholdMinutes < 0)
  ) {
    errors.push(`Empirical threshold must be a non-negative number (got ${scenario.empiricalThresholdMinutes}).`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Calculate comparative quantitative delta between baseline and simulated metric.
 */
export function calculateComparativeDelta(
  baseline: number,
  simulated: number
): ComparativeMetricDelta {
  const safeBaseline = Math.round(baseline * 10) / 10;
  const safeSimulated = Math.round(simulated * 10) / 10;
  const absoluteDelta = Math.round((safeSimulated - safeBaseline) * 10) / 10;
  const percentageDelta =
    safeBaseline > 0
      ? Math.round(((safeSimulated - safeBaseline) / safeBaseline) * 1000) / 10
      : 0;

  return {
    baseline: safeBaseline,
    simulated: safeSimulated,
    absoluteDelta,
    percentageDelta,
  };
}

/**
 * Deterministically apply scenario interventions to a single patient encounter case.
 * Pure function: NEVER mutates the input caseSummary or its events.
 */
export function applyInterventionsToCase(
  caseSummary: CaseSummary,
  interventions: SimulationIntervention[],
  empiricalThreshold?: number | null
): SimulatedCaseResult {
  const baselineDurationMinutes = Math.max(0, caseSummary.durationMinutes);

  // If case has 0 or 1 event, there are no transitions to intervene upon
  if (!caseSummary.events || caseSummary.events.length <= 1 || interventions.length === 0) {
    const isExceedingThresholdBaseline =
      empiricalThreshold !== undefined && empiricalThreshold !== null
        ? baselineDurationMinutes > empiricalThreshold
        : undefined;

    return {
      caseId: caseSummary.caseId,
      baselineDurationMinutes,
      simulatedDurationMinutes: baselineDurationMinutes,
      savedMinutes: 0,
      percentageReduction: 0,
      traversedInterventionsCount: 0,
      isExceedingThresholdBaseline,
      isExceedingThresholdSimulated: isExceedingThresholdBaseline,
      isThresholdRecovered: false,
    };
  }

  let totalStepSaved = 0;
  let traversedInterventionsCount = 0;

  // Traverse consecutive event transitions without mutating source events
  for (let j = 0; j < caseSummary.events.length - 1; j++) {
    const curEvent = caseSummary.events[j];
    const nextEvent = caseSummary.events[j + 1];
    const fromActivity = curEvent.activity;
    const toActivity = nextEvent.activity;
    const baseElapsed = curEvent.elapsedToNextMinutes ?? 0;

    // Check if an intervention targets this transition
    const matchingIntervention = interventions.find(
      (int) => int.from === fromActivity && int.to === toActivity
    );

    if (matchingIntervention && baseElapsed > 0) {
      traversedInterventionsCount++;
      let simElapsed = baseElapsed;

      // 1. Percentage reduction
      if (
        matchingIntervention.reductionPercentage !== undefined &&
        matchingIntervention.reductionPercentage > 0
      ) {
        const factor = 1 - matchingIntervention.reductionPercentage / 100;
        simElapsed = simElapsed * factor;
      }

      // 2. Maximum duration cap
      if (
        matchingIntervention.maxDurationMinutes !== undefined &&
        matchingIntervention.maxDurationMinutes >= 0
      ) {
        simElapsed = Math.min(simElapsed, matchingIntervention.maxDurationMinutes);
      }

      // Guarantee non-negativity and standard 1-decimal rounding
      simElapsed = Math.max(0, Math.round(simElapsed * 10) / 10);
      const stepSaved = Math.max(0, baseElapsed - simElapsed);
      totalStepSaved += stepSaved;
    }
  }

  const savedMinutes = Math.min(baselineDurationMinutes, Math.round(totalStepSaved * 10) / 10);
  const simulatedDurationMinutes = Math.max(
    0,
    Math.round((baselineDurationMinutes - savedMinutes) * 10) / 10
  );
  const percentageReduction =
    baselineDurationMinutes > 0
      ? Math.round((savedMinutes / baselineDurationMinutes) * 1000) / 10
      : 0;

  let isExceedingThresholdBaseline: boolean | undefined;
  let isExceedingThresholdSimulated: boolean | undefined;
  let isThresholdRecovered: boolean | undefined;

  if (empiricalThreshold !== undefined && empiricalThreshold !== null) {
    isExceedingThresholdBaseline = baselineDurationMinutes > empiricalThreshold;
    isExceedingThresholdSimulated = simulatedDurationMinutes > empiricalThreshold;
    isThresholdRecovered = isExceedingThresholdBaseline && !isExceedingThresholdSimulated;
  }

  return {
    caseId: caseSummary.caseId,
    baselineDurationMinutes,
    simulatedDurationMinutes,
    savedMinutes,
    percentageReduction,
    traversedInterventionsCount,
    isExceedingThresholdBaseline,
    isExceedingThresholdSimulated,
    isThresholdRecovered,
  };
}

/**
 * Execute a complete what-if simulation across an entire cohort of cases.
 *
 * @param cases Array of patient case summaries
 * @param scenario What-if scenario configuration
 * @param options Additional evaluation options (e.g. empirical SLA threshold)
 */
export function runWhatIfSimulation(
  cases: CaseSummary[],
  scenario: SimulationScenario,
  options?: { empiricalThresholdMinutes?: number }
): SimulationResult {
  // Validate scenario configuration
  const validation = validateScenario(scenario);
  if (!validation.isValid) {
    throw new Error(`Invalid simulation scenario: ${validation.errors.join('; ')}`);
  }

  const empiricalThreshold =
    options?.empiricalThresholdMinutes ?? scenario.empiricalThresholdMinutes ?? null;

  // Safe handling of empty cohorts
  if (!cases || cases.length === 0) {
    const zeroDelta = calculateComparativeDelta(0, 0);
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      totalCasesEvaluated: 0,
      affectedCasesCount: 0,
      affectedCasesPercentage: 0,
      totalHypotheticalMinutesSaved: 0,
      totalHypotheticalHoursSaved: 0,
      medianDuration: zeroDelta,
      p90Duration: zeroDelta,
      meanDuration: zeroDelta,
      minDuration: zeroDelta,
      maxDuration: zeroDelta,
      casesExceedingThresholdBaseline: 0,
      casesExceedingThresholdSimulated: 0,
      recoveredCasesCount: 0,
      recoveredCasesPercentage: 0,
      empiricalThresholdMinutes: empiricalThreshold,
      caseResults: [],
      transitionResults: [],
      modelNotice: SIMULATION_MODEL_DISCLAIMER,
    };
  }

  // Evaluate each case individually
  const caseResults = cases.map((c) =>
    applyInterventionsToCase(c, scenario.interventions, empiricalThreshold)
  );

  const baselineDurations = caseResults.map((r) => r.baselineDurationMinutes);
  const simulatedDurations = caseResults.map((r) => r.simulatedDurationMinutes);

  const totalHypotheticalMinutesSaved = Math.round(
    caseResults.reduce((acc, r) => acc + r.savedMinutes, 0) * 10
  ) / 10;
  const totalHypotheticalHoursSaved = Math.round((totalHypotheticalMinutesSaved / 60) * 10) / 10;

  const affectedCases = caseResults.filter(
    (r) => r.traversedInterventionsCount > 0 && r.savedMinutes > 0
  );
  const affectedCasesCount = affectedCases.length;
  const affectedCasesPercentage =
    cases.length > 0 ? Math.round((affectedCasesCount / cases.length) * 1000) / 10 : 0;

  // Quantile and statistical calculations using project standards (linear interpolation)
  const medianDuration = calculateComparativeDelta(
    calculatePercentile(baselineDurations, 50),
    calculatePercentile(simulatedDurations, 50)
  );

  const p90Duration = calculateComparativeDelta(
    calculatePercentile(baselineDurations, 90),
    calculatePercentile(simulatedDurations, 90)
  );

  const meanDuration = calculateComparativeDelta(
    calculateMean(baselineDurations),
    calculateMean(simulatedDurations)
  );

  const minDuration = calculateComparativeDelta(
    baselineDurations.length > 0 ? Math.min(...baselineDurations) : 0,
    simulatedDurations.length > 0 ? Math.min(...simulatedDurations) : 0
  );

  const maxDuration = calculateComparativeDelta(
    baselineDurations.length > 0 ? Math.max(...baselineDurations) : 0,
    simulatedDurations.length > 0 ? Math.max(...simulatedDurations) : 0
  );

  // Empirical threshold shift accounting
  let casesExceedingThresholdBaseline = 0;
  let casesExceedingThresholdSimulated = 0;
  let recoveredCasesCount = 0;

  if (empiricalThreshold !== null) {
    caseResults.forEach((r) => {
      if (r.isExceedingThresholdBaseline) casesExceedingThresholdBaseline++;
      if (r.isExceedingThresholdSimulated) casesExceedingThresholdSimulated++;
      if (r.isThresholdRecovered) recoveredCasesCount++;
    });
  }

  const recoveredCasesPercentage =
    casesExceedingThresholdBaseline > 0
      ? Math.round((recoveredCasesCount / casesExceedingThresholdBaseline) * 1000) / 10
      : 0;

  // Per-transition comparative summaries
  const transitionResults: TransitionSimulationSummary[] = scenario.interventions.map((int) => {
    const baseTransitionDurations: number[] = [];
    const simTransitionDurations: number[] = [];
    const affectedCasesSet = new Set<string>();
    let totalSavedOnThisTransition = 0;

    cases.forEach((c) => {
      if (!c.events || c.events.length <= 1) return;

      for (let j = 0; j < c.events.length - 1; j++) {
        if (c.events[j].activity === int.from && c.events[j + 1].activity === int.to) {
          const b = c.events[j].elapsedToNextMinutes ?? 0;
          baseTransitionDurations.push(b);
          affectedCasesSet.add(c.caseId);

          let s = b;
          if (int.reductionPercentage !== undefined && int.reductionPercentage > 0) {
            s = s * (1 - int.reductionPercentage / 100);
          }
          if (int.maxDurationMinutes !== undefined && int.maxDurationMinutes >= 0) {
            s = Math.min(s, int.maxDurationMinutes);
          }
          s = Math.max(0, Math.round(s * 10) / 10);
          simTransitionDurations.push(s);
          totalSavedOnThisTransition += Math.max(0, b - s);
        }
      }
    });

    return {
      from: int.from,
      to: int.to,
      interventionLabel: int.label,
      observationCount: baseTransitionDurations.length,
      affectedCasesCount: affectedCasesSet.size,
      baselineMedianMinutes: Math.round(calculateMedian(baseTransitionDurations) * 10) / 10,
      simulatedMedianMinutes: Math.round(calculateMedian(simTransitionDurations) * 10) / 10,
      baselineP90Minutes: Math.round(calculatePercentile(baseTransitionDurations, 90) * 10) / 10,
      simulatedP90Minutes: Math.round(calculatePercentile(simTransitionDurations, 90) * 10) / 10,
      totalSavedMinutes: Math.round(totalSavedOnThisTransition * 10) / 10,
    };
  });

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    totalCasesEvaluated: cases.length,
    affectedCasesCount,
    affectedCasesPercentage,
    totalHypotheticalMinutesSaved,
    totalHypotheticalHoursSaved,
    medianDuration,
    p90Duration,
    meanDuration,
    minDuration,
    maxDuration,
    casesExceedingThresholdBaseline,
    casesExceedingThresholdSimulated,
    recoveredCasesCount,
    recoveredCasesPercentage,
    empiricalThresholdMinutes: empiricalThreshold,
    caseResults,
    transitionResults,
    modelNotice: SIMULATION_MODEL_DISCLAIMER,
  };
}


/**
 * Helper to escape CSV cell contents conforming to RFC 4180.
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export simulation scenario results to a structured CSV format.
 */
export function exportSimulationToCSV(result: SimulationResult): string {
  const metaRows: string[][] = [
    ['Simulation Scenario Report', escapeCsvValue(result.scenarioName)],
    ['Scenario ID', escapeCsvValue(result.scenarioId)],
    ['Generated At (UTC)', new Date().toISOString()],
    ['Total Cases Evaluated', String(result.totalCasesEvaluated)],
    ['Affected Cases Count', String(result.affectedCasesCount)],
    ['Affected Cases Percentage', `${result.affectedCasesPercentage}%`],
    ['Total Hypothetical Time Saved (min)', String(result.totalHypotheticalMinutesSaved)],
    ['Total Hypothetical Time Saved (hours)', String(result.totalHypotheticalHoursSaved)],
    ['Baseline Median Duration (min)', String(result.medianDuration.baseline)],
    ['Simulated Median Duration (min)', String(result.medianDuration.simulated)],
    ['Median Delta (min)', String(result.medianDuration.absoluteDelta)],
    ['Median Delta (%)', `${result.medianDuration.percentageDelta}%`],
    ['Baseline P90 Duration (min)', String(result.p90Duration.baseline)],
    ['Simulated P90 Duration (min)', String(result.p90Duration.simulated)],
    ['P90 Delta (min)', String(result.p90Duration.absoluteDelta)],
    ['P90 Delta (%)', `${result.p90Duration.percentageDelta}%`],
    ['Empirical Benchmark Threshold (min)', result.empiricalThresholdMinutes !== null && result.empiricalThresholdMinutes !== undefined ? String(result.empiricalThresholdMinutes) : 'N/A'],
    ['Cases Exceeding Threshold (Baseline)', String(result.casesExceedingThresholdBaseline)],
    ['Cases Exceeding Threshold (Simulated)', String(result.casesExceedingThresholdSimulated)],
    ['Modeled Recovered Encounters', String(result.recoveredCasesCount)],
    ['Modeled Recovery Rate (%)', `${result.recoveredCasesPercentage}%`],
    ['Model Assumption Disclaimer', escapeCsvValue(result.modelNotice)],
    [],
    [
      'Case ID',
      'Baseline Duration (min)',
      'Simulated Duration (min)',
      'Saved Minutes',
      'Reduction (%)',
      'Interventions Traversed',
      'Baseline Exceeded Threshold',
      'Simulated Exceeded Threshold',
      'Threshold Recovered',
    ],
  ];

  const caseRows: string[][] = result.caseResults.map((c) => [
    escapeCsvValue(c.caseId),
    String(c.baselineDurationMinutes),
    String(c.simulatedDurationMinutes),
    String(c.savedMinutes),
    `${c.percentageReduction}%`,
    String(c.traversedInterventionsCount),
    c.isExceedingThresholdBaseline !== undefined ? String(c.isExceedingThresholdBaseline) : 'N/A',
    c.isExceedingThresholdSimulated !== undefined ? String(c.isExceedingThresholdSimulated) : 'N/A',
    c.isThresholdRecovered !== undefined ? String(c.isThresholdRecovered) : 'N/A',
  ]);

  return [...metaRows.map((r) => r.join(',')), ...caseRows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Generate a comprehensive, audit-compliant Markdown Executive Decision-Support Report
 * for a What-If simulation scenario.
 *
 * Adheres strictly to the CareFlow clinical analytics reporting standards,
 * featuring structured KPI tables, latency shift analysis, empirical SLA recovery,
 * transition breakdowns, outlier encounter profiles, and epistemological governance notices.
 */
export function generateSimulationExecutiveReportMarkdown(
  result: SimulationResult,
  options?: { scenarioNotes?: string; cohortName?: string }
): string {
  const now = new Date().toISOString();
  const cohortName = options?.cohortName || 'Active Clinical Cohort';
  const scenarioNotes = options?.scenarioNotes || 'Targeted parametric queue latency streamlining.';

  const kpiRows = [
    `| Metric | Empirical Baseline | Hypothetical Simulated | Absolute Delta | Relative Change (%) |`,
    `| :--- | :---: | :---: | :---: | :---: |`,
    `| **50th Percentile (Median P50)** | ${result.medianDuration.baseline.toFixed(1)}m | ${result.medianDuration.simulated.toFixed(1)}m | ${result.medianDuration.absoluteDelta > 0 ? '+' : ''}${result.medianDuration.absoluteDelta.toFixed(1)}m | ${result.medianDuration.percentageDelta > 0 ? '+' : ''}${result.medianDuration.percentageDelta.toFixed(1)}% |`,
    `| **90th Percentile (Tail P90)** | ${result.p90Duration.baseline.toFixed(1)}m | ${result.p90Duration.simulated.toFixed(1)}m | ${result.p90Duration.absoluteDelta > 0 ? '+' : ''}${result.p90Duration.absoluteDelta.toFixed(1)}m | ${result.p90Duration.percentageDelta > 0 ? '+' : ''}${result.p90Duration.percentageDelta.toFixed(1)}% |`,
    `| **Arithmetic Mean** | ${result.meanDuration.baseline.toFixed(1)}m | ${result.meanDuration.simulated.toFixed(1)}m | ${result.meanDuration.absoluteDelta > 0 ? '+' : ''}${result.meanDuration.absoluteDelta.toFixed(1)}m | ${result.meanDuration.percentageDelta > 0 ? '+' : ''}${result.meanDuration.percentageDelta.toFixed(1)}% |`,
    `| **Minimum Case Duration** | ${result.minDuration.baseline.toFixed(1)}m | ${result.minDuration.simulated.toFixed(1)}m | ${result.minDuration.absoluteDelta > 0 ? '+' : ''}${result.minDuration.absoluteDelta.toFixed(1)}m | ${result.minDuration.percentageDelta > 0 ? '+' : ''}${result.minDuration.percentageDelta.toFixed(1)}% |`,
    `| **Maximum Case Duration** | ${result.maxDuration.baseline.toFixed(1)}m | ${result.maxDuration.simulated.toFixed(1)}m | ${result.maxDuration.absoluteDelta > 0 ? '+' : ''}${result.maxDuration.absoluteDelta.toFixed(1)}m | ${result.maxDuration.percentageDelta > 0 ? '+' : ''}${result.maxDuration.percentageDelta.toFixed(1)}% |`,
  ].join('\n');

  const transitionRows =
    result.transitionResults.length > 0
      ? [
          `| Step Transition | Targeted Encounters | Baseline Median | Simulated Median | Baseline P90 | Simulated P90 | Total Patient Time Saved |`,
          `| :--- | :---: | :---: | :---: | :---: | :---: | :---: |`,
          ...result.transitionResults.map((t) => {
            const label = t.interventionLabel
              ? `**${t.from} → ${t.to}**<br>*(${t.interventionLabel})*`
              : `**${t.from} → ${t.to}**`;
            return `| ${label} | ${t.affectedCasesCount.toLocaleString()} | ${t.baselineMedianMinutes.toFixed(1)}m | ${t.simulatedMedianMinutes.toFixed(1)}m | ${t.baselineP90Minutes.toFixed(1)}m | ${t.simulatedP90Minutes.toFixed(1)}m | **${t.totalSavedMinutes.toLocaleString()} min** |`;
          }),
        ].join('\n')
      : `*No transition interventions recorded.*`;

  // Top impacted sample cases (up to 10)
  const topCases = [...result.caseResults]
    .sort((a, b) => b.savedMinutes - a.savedMinutes)
    .slice(0, 10);

  const caseRows = [
    `| Case Identifier | Baseline Duration | Simulated Duration | Elapsed Time Saved | Reduction (%) | Steps Traversed | Empirical Benchmark Status |`,
    `| :--- | :---: | :---: | :---: | :---: | :---: | :---: |`,
    ...topCases.map((c) => {
      const statusBadge = c.isThresholdRecovered
        ? '✅ **SLA Recovered**'
        : c.isExceedingThresholdSimulated
        ? '⚠️ *Still Exceeding*'
        : '🟢 Within Benchmark';
      return `| \`${c.caseId}\` | ${c.baselineDurationMinutes.toFixed(1)}m | ${c.simulatedDurationMinutes.toFixed(1)}m | **-${c.savedMinutes.toFixed(1)}m** | ${c.percentageReduction.toFixed(1)}% | ${c.traversedInterventionsCount} | ${statusBadge} |`;
    }),
  ].join('\n');

  const thresholdDisplay =
    result.empiricalThresholdMinutes !== null && result.empiricalThresholdMinutes !== undefined
      ? `${result.empiricalThresholdMinutes} minutes`
      : 'Not configured';

  return `# CareFlow What-If Simulation — Executive Decision-Support Report

> [!WARNING]
> **Epistemological Notice & Operational Simulation Scope:**
> ${result.modelNotice}

---

## 1. Scenario Executive Overview

- **Scenario Name:** ${result.scenarioName}
- **Scenario Identifier:** \`${result.scenarioId}\`
- **Clinical Cohort Scope:** ${cohortName}
- **Generated At:** ${now}
- **Operational Objective:** ${scenarioNotes}

### Cohort Throughput & Latency Impact
- **Total Patient Encounters Evaluated:** **${result.totalCasesEvaluated.toLocaleString()} cases**
- **Encounters Traversed by Targeted Interventions:** **${result.affectedCasesCount.toLocaleString()} cases** (${result.affectedCasesPercentage.toFixed(1)}% cohort penetration)
- **Cumulative Patient Dwell-Time Eliminated:** **${result.totalHypotheticalMinutesSaved.toLocaleString()} minutes** (~**${result.totalHypotheticalHoursSaved.toFixed(1)} patient hours**)

---

## 2. Key Latency Shift Metrics (Baseline vs. Simulated)

${kpiRows}

---

## 3. Modeled Empirical SLA Recovery & Capacity Relinquishment

- **Active Empirical Benchmark Threshold:** **${thresholdDisplay}**
- **Baseline Cases Exceeding Benchmark:** **${result.casesExceedingThresholdBaseline.toLocaleString()} encounters**
- **Simulated Cases Exceeding Benchmark:** **${result.casesExceedingThresholdSimulated.toLocaleString()} encounters**
- **Modeled SLA Recoveries:** **${result.recoveredCasesCount.toLocaleString()} encounters**
- **Modeled Recovery Rate:** **${result.recoveredCasesPercentage.toFixed(1)}%** of previously delayed cases recovered within the benchmark

---

## 4. Targeted Transition Intervention Breakdown

${transitionRows}

---

## 5. Sample High-Impact Encounter Profiles

${caseRows}

---

## 6. Clinical Governance & Decision-Support Review Guidelines

1. **Parametric Assumptions:** All modeled time reductions represent idealized queue streamlining or protocol fast-tracks. Actual clinical implementation requires capacity, staffing, and clinical safety feasibility validation.
2. **Preservation of Clinical Safeguards:** Streamlining turnaround intervals must never compromise diagnostic thoroughness, specimen testing protocols, or physician consultation quality.
3. **Audit Trail Verification:** This executive report is deterministically computed in client-side memory from the active scenario configuration and local event log.
`;
}

/**
 * Export simulation scenario results to a structured audit-compliant JSON format.
 */
export function exportSimulationReportJSON(
  result: SimulationResult,
  metadata?: { scenarioNotes?: string; cohortName?: string }
): string {
  const payload = {
    reportType: 'CareFlow_Simulation_Executive_Report',
    version: '1.0.0',
    generatedAtUtc: new Date().toISOString(),
    scenario: {
      id: result.scenarioId,
      name: result.scenarioName,
      description: metadata?.scenarioNotes || '',
      cohortName: metadata?.cohortName || '',
      empiricalThresholdMinutes: result.empiricalThresholdMinutes ?? null,
    },
    cohortSummary: {
      totalCasesEvaluated: result.totalCasesEvaluated,
      affectedCasesCount: result.affectedCasesCount,
      affectedCasesPercentage: result.affectedCasesPercentage,
      totalHypotheticalMinutesSaved: result.totalHypotheticalMinutesSaved,
      totalHypotheticalHoursSaved: result.totalHypotheticalHoursSaved,
    },
    kpiDeltas: {
      medianDuration: result.medianDuration,
      p90Duration: result.p90Duration,
      meanDuration: result.meanDuration,
      minDuration: result.minDuration,
      maxDuration: result.maxDuration,
    },
    slaRecovery: {
      empiricalThresholdMinutes: result.empiricalThresholdMinutes ?? null,
      casesExceedingBaseline: result.casesExceedingThresholdBaseline,
      casesExceedingSimulated: result.casesExceedingThresholdSimulated,
      recoveredCasesCount: result.recoveredCasesCount,
      recoveredCasesPercentage: result.recoveredCasesPercentage,
    },
    interventions: result.transitionResults,
    topImpactCases: [...result.caseResults]
      .sort((a, b) => b.savedMinutes - a.savedMinutes)
      .slice(0, 25),
    governanceDisclaimer: result.modelNotice,
  };

  return JSON.stringify(payload, null, 2);
}
