// CareFlow — Clinical Pathway Process Mining Computation & Analytical Engine
import {
  RawEventRow,
  ColumnMapping,
  NormalizedEvent,
  CaseSummary,
  ProcessVariant,
  ActivityTransition,
  ActivityMetric,
  BottleneckItem,
  AnalyticalObservation,
  DatasetValidationReport,
  CalculatedMetrics,
  ExecutiveReportParams,
} from '../types';

export function calculateMedian(numbers: number[]): number {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function calculateMean(numbers: number[]): number {
  if (!numbers || numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return sum / numbers.length;
}

export function calculatePercentile(numbers: number[], p: number): number {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  // Linear quantile interpolation matching PM4Py / NumPy method='linear'
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Validate and normalize raw tabular rows into an ordered event log.
 */
export function normalizeAndValidateEvents(
  rawRows: RawEventRow[],
  mapping: ColumnMapping
): {
  events: NormalizedEvent[];
  cases: CaseSummary[];
  report: DatasetValidationReport;
} {
  const detectedColumns = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  let invalidRows = 0;
  let ambiguousTimestampTies = 0;

  const validEventsMap: Map<string, NormalizedEvent[]> = new Map();

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const caseIdRaw = row[mapping.caseId];
    const activityRaw = row[mapping.activity];
    const timestampRaw = row[mapping.timestamp];

    if (!caseIdRaw || !activityRaw || !timestampRaw) {
      invalidRows++;
      continue;
    }

    const caseId = String(caseIdRaw).trim();
    const activity = String(activityRaw).trim();
    const timestampStr = String(timestampRaw).trim();
    let parsedDate = new Date(timestampStr);

    // Support numeric timestamps (unix epoch in ms or seconds)
    if (isNaN(parsedDate.getTime()) && !isNaN(Number(timestampStr)) && timestampStr !== '') {
      const num = Number(timestampStr);
      const ms = num < 10000000000 ? num * 1000 : num;
      parsedDate = new Date(ms);
    }

    if (isNaN(parsedDate.getTime()) || caseId.length === 0 || activity.length === 0) {
      invalidRows++;
      continue;
    }

    const timestampMs = parsedDate.getTime();
    const resource = mapping.resource && row[mapping.resource] ? String(row[mapping.resource]).trim() : undefined;
    const department = mapping.department && row[mapping.department] ? String(row[mapping.department]).trim() : undefined;
    const status = mapping.status && row[mapping.status] ? String(row[mapping.status]).trim() : undefined;

    const event: NormalizedEvent = {
      id: `evt-${i}-${caseId}`,
      caseId,
      activity,
      timestamp: parsedDate.toISOString(),
      timestampMs,
      eventIndex: 0, // Assigned after sorting
      nextActivity: null,
      elapsedToNextMinutes: null,
      resource,
      department,
      status,
      rawAttributes: row,
    };

    if (!validEventsMap.has(caseId)) {
      validEventsMap.set(caseId, []);
    }
    validEventsMap.get(caseId)!.push(event);
  }

  const allNormalizedEvents: NormalizedEvent[] = [];
  const cases: CaseSummary[] = [];
  let earliestTimeMs = Number.MAX_SAFE_INTEGER;
  let latestTimeMs = 0;

  // Sort events chronologically within each case and compute consecutive links
  validEventsMap.forEach((caseEvents, caseId) => {
    // Stable chronological sort by timestampMs
    caseEvents.sort((a, b) => a.timestampMs - b.timestampMs);

    const activitySequence: string[] = [];
    const caseStartMs = caseEvents[0].timestampMs;
    const caseEndMs = caseEvents[caseEvents.length - 1].timestampMs;
    const durationMinutes = Math.max(0, (caseEndMs - caseStartMs) / (1000 * 60));

    if (caseStartMs < earliestTimeMs) earliestTimeMs = caseStartMs;
    if (caseEndMs > latestTimeMs) latestTimeMs = caseEndMs;

    for (let j = 0; j < caseEvents.length; j++) {
      const cur = caseEvents[j];
      cur.eventIndex = j + 1;
      activitySequence.push(cur.activity);

      if (j < caseEvents.length - 1) {
        const next = caseEvents[j + 1];
        cur.nextActivity = next.activity;
        const diffMinutes = Math.max(0, (next.timestampMs - cur.timestampMs) / (1000 * 60));
        cur.elapsedToNextMinutes = Math.round(diffMinutes * 10) / 10;

        // Detect ambiguous timestamp ties where consecutive events share identical timestamps
        if (cur.timestampMs === next.timestampMs) {
          cur.isTimestampTie = true;
          next.isTimestampTie = true;
          ambiguousTimestampTies++;
        }
      } else {
        cur.nextActivity = null;
        cur.elapsedToNextMinutes = null;
      }

      allNormalizedEvents.push(cur);
    }

    const variantKey = activitySequence.join(' → ');

    cases.push({
      caseId,
      startTime: caseEvents[0].timestamp,
      endTime: caseEvents[caseEvents.length - 1].timestamp,
      durationMinutes: Math.round(durationMinutes * 10) / 10,
      eventCount: caseEvents.length,
      activitySequence,
      variantKey,
      events: caseEvents,
      department: caseEvents[0].department,
      status: caseEvents[caseEvents.length - 1].status,
    });
  });

  // Global sort of events by timestamp for table presentation
  allNormalizedEvents.sort((a, b) => a.timestampMs - b.timestampMs);

  const warnings: string[] = [];
  if (invalidRows > 0) {
    warnings.push(`${invalidRows} rows excluded due to missing case ID, activity, or invalid timestamp.`);
  }
  if (ambiguousTimestampTies > 0) {
    warnings.push(`${ambiguousTimestampTies} consecutive event pairs share identical timestamps (ambiguous ordering).`);
  }

  const report: DatasetValidationReport = {
    totalRows: rawRows.length,
    parsedEvents: allNormalizedEvents.length,
    uniqueCases: cases.length,
    invalidRows,
    ambiguousTimestampTies,
    dateRange: {
      start: earliestTimeMs !== Number.MAX_SAFE_INTEGER ? new Date(earliestTimeMs).toISOString() : '',
      end: latestTimeMs !== 0 ? new Date(latestTimeMs).toISOString() : '',
    },
    detectedColumns,
    hasRequiredColumns:
      detectedColumns.includes(mapping.caseId) &&
      detectedColumns.includes(mapping.activity) &&
      detectedColumns.includes(mapping.timestamp),
    warnings,
  };

  return {
    events: allNormalizedEvents,
    cases,
    report,
  };
}

/**
 * Calculate process variants ordered by frequency descending.
 */
export function extractProcessVariants(cases: CaseSummary[]): ProcessVariant[] {
  if (cases.length === 0) return [];

  const variantMap: Map<string, CaseSummary[]> = new Map();

  for (const c of cases) {
    if (!variantMap.has(c.variantKey)) {
      variantMap.set(c.variantKey, []);
    }
    variantMap.get(c.variantKey)!.push(c);
  }

  const variants: ProcessVariant[] = [];
  let index = 1;

  variantMap.forEach((variantCases, key) => {
    const caseCount = variantCases.length;
    const percentage = Math.round((caseCount / cases.length) * 1000) / 10;
    const durations = variantCases.map((c) => c.durationMinutes);
    const activities = variantCases[0].activitySequence;

    // Step-by-step transition breakdown within this variant
    const stepTransitions: { from: string; to: string; medianElapsedMinutes: number; p90ElapsedMinutes: number }[] = [];
    if (activities.length >= 2) {
      for (let s = 0; s < activities.length - 1; s++) {
        const fromAct = activities[s];
        const toAct = activities[s + 1];
        const stepDurations: number[] = [];
        for (const vc of variantCases) {
          if (
            vc.events[s] &&
            vc.events[s].elapsedToNextMinutes !== null &&
            vc.events[s].elapsedToNextMinutes !== undefined
          ) {
            stepDurations.push(vc.events[s].elapsedToNextMinutes!);
          }
        }
        stepTransitions.push({
          from: fromAct,
          to: toAct,
          medianElapsedMinutes: Math.round(calculateMedian(stepDurations) * 10) / 10,
          p90ElapsedMinutes: Math.round(calculatePercentile(stepDurations, 90) * 10) / 10,
        });
      }
    }

    variants.push({
      key,
      id: `var-${index}`,
      name: `Variant #${index}`,
      activities,
      caseCount,
      percentage,
      medianDurationMinutes: Math.round(calculateMedian(durations)),
      meanDurationMinutes: Math.round(calculateMean(durations)),
      minDurationMinutes: Math.round(Math.min(...durations)),
      maxDurationMinutes: Math.round(Math.max(...durations)),
      isMostFrequent: false,
      stepTransitions,
    });
    index++;
  });

  // Sort by caseCount descending
  variants.sort((a, b) => b.caseCount - a.caseCount);

  // Re-number after sort and mark most frequent
  variants.forEach((v, idx) => {
    v.id = `var-${idx + 1}`;
    v.name = `Variant #${idx + 1}`;
    v.isMostFrequent = idx === 0;
  });

  return variants;
}

/**
 * Calculate activity distribution & frequency metrics.
 */
export function extractActivityMetrics(
  events: NormalizedEvent[],
  _totalCasesCount: number
): ActivityMetric[] {
  if (events.length === 0) return [];

  const activityMap: Map<
    string,
    { count: number; cases: Set<string>; elapsedTimes: number[]; department?: string }
  > = new Map();

  for (const evt of events) {
    if (!activityMap.has(evt.activity)) {
      activityMap.set(evt.activity, {
        count: 0,
        cases: new Set(),
        elapsedTimes: [],
        department: evt.department,
      });
    }
    const entry = activityMap.get(evt.activity)!;
    entry.count++;
    entry.cases.add(evt.caseId);
    if (evt.elapsedToNextMinutes !== null && evt.elapsedToNextMinutes !== undefined) {
      entry.elapsedTimes.push(evt.elapsedToNextMinutes);
    }
  }

  const result: ActivityMetric[] = [];

  activityMap.forEach((entry, activity) => {
    const percentage =
      events.length > 0 ? Math.round((entry.count / events.length) * 1000) / 10 : 0;
    result.push({
      activity,
      frequency: entry.count,
      caseCount: entry.cases.size,
      percentage,
      medianElapsedMinutes: Math.round(calculateMedian(entry.elapsedTimes) * 10) / 10,
      department: entry.department,
    });
  });

  // Sort by frequency descending
  result.sort((a, b) => b.frequency - a.frequency);
  return result;
}

/**
 * Calculate directly-follows transitions between consecutive activities.
 */
export function extractTransitions(cases: CaseSummary[]): ActivityTransition[] {
  const transitionMap: Map<
    string,
    { from: string; to: string; count: number; cases: Set<string>; durations: number[] }
  > = new Map();

  for (const c of cases) {
    for (let i = 0; i < c.events.length - 1; i++) {
      const from = c.events[i].activity;
      const to = c.events[i + 1].activity;
      const key = `${from}___${to}`;

      if (!transitionMap.has(key)) {
        transitionMap.set(key, {
          from,
          to,
          count: 0,
          cases: new Set(),
          durations: [],
        });
      }

      const item = transitionMap.get(key)!;
      item.count++;
      item.cases.add(c.caseId);
      if (c.events[i].elapsedToNextMinutes !== null && c.events[i].elapsedToNextMinutes !== undefined) {
        item.durations.push(c.events[i].elapsedToNextMinutes!);
      }
    }
  }

  // Count total departures per source activity to compute percentageOfDepartures
  const departuresBySource: Map<string, number> = new Map();
  transitionMap.forEach((item) => {
    departuresBySource.set(item.from, (departuresBySource.get(item.from) || 0) + item.count);
  });

  const result: ActivityTransition[] = [];
  let index = 1;

  transitionMap.forEach((item) => {
    const totalFrom = departuresBySource.get(item.from) || item.count;
    const percentageOfDepartures = Math.round((item.count / totalFrom) * 1000) / 10;
    const zeroDurationCount = item.durations.filter((d) => d === 0).length;
    const zeroDurationPercentage =
      item.durations.length > 0 ? Math.round((zeroDurationCount / item.durations.length) * 1000) / 10 : 0;

    result.push({
      id: `tr-${index++}`,
      from: item.from,
      to: item.to,
      observationCount: item.count,
      caseCount: item.cases.size,
      medianElapsedMinutes: Math.round(calculateMedian(item.durations) * 10) / 10,
      meanElapsedMinutes: Math.round(calculateMean(item.durations) * 10) / 10,
      p90ElapsedMinutes: Math.round(calculatePercentile(item.durations, 90) * 10) / 10,
      p25ElapsedMinutes: Math.round(calculatePercentile(item.durations, 25) * 10) / 10,
      p75ElapsedMinutes: Math.round(calculatePercentile(item.durations, 75) * 10) / 10,
      p95ElapsedMinutes: Math.round(calculatePercentile(item.durations, 95) * 10) / 10,
      minElapsedMinutes: item.durations.length > 0 ? Math.round(Math.min(...item.durations) * 10) / 10 : 0,
      maxElapsedMinutes: item.durations.length > 0 ? Math.round(Math.max(...item.durations) * 10) / 10 : 0,
      zeroDurationCount,
      zeroDurationPercentage,
      percentageOfDepartures,
    });
  });

  // Sort by observation count descending
  result.sort((a, b) => b.observationCount - a.observationCount);
  return result;
}

/**
 * Calculate ranked bottlenecks based on observed inter-event elapsed times.
 */
export function extractBottlenecks(
  transitions: ActivityTransition[],
  _activityMetrics: ActivityMetric[]
): BottleneckItem[] {
  const bottlenecks: BottleneckItem[] = [];

  // Ranked transitions with notable median or P90 elapsed times
  for (const tr of transitions) {
    let severity: 'high' | 'moderate' | 'nominal' = 'nominal';
    if (tr.medianElapsedMinutes >= 60 || tr.p90ElapsedMinutes >= 120) severity = 'high';
    else if (tr.medianElapsedMinutes >= 30 || tr.p90ElapsedMinutes >= 60) severity = 'moderate';

    bottlenecks.push({
      id: tr.id,
      type: 'transition',
      label: `${tr.from} → ${tr.to}`,
      from: tr.from,
      to: tr.to,
      validObservations: tr.observationCount,
      caseCount: tr.caseCount,
      medianElapsedMinutes: tr.medianElapsedMinutes,
      meanElapsedMinutes: tr.meanElapsedMinutes,
      p90ElapsedMinutes: tr.p90ElapsedMinutes,
      p25ElapsedMinutes: tr.p25ElapsedMinutes,
      p75ElapsedMinutes: tr.p75ElapsedMinutes,
      p95ElapsedMinutes: tr.p95ElapsedMinutes,
      minElapsedMinutes: tr.minElapsedMinutes,
      maxElapsedMinutes: tr.maxElapsedMinutes,
      zeroDurationCount: tr.zeroDurationCount,
      zeroDurationPercentage: tr.zeroDurationPercentage,
      severity,
      explanation: `Observed transition traversed by ${tr.caseCount} distinct cases with ${tr.observationCount} total instances.`,
    });
  }

  // Sort by median elapsed time descending
  bottlenecks.sort((a, b) => b.medianElapsedMinutes - a.medianElapsedMinutes);
  return bottlenecks;
}

/**
 * Compute daily time-series volume of cases and median durations.
 */
export function extractTimeSeriesVolume(cases: CaseSummary[]): {
  labels: string[];
  caseArrivals: number[];
  caseCompletions: number[];
  medianDurationsHours: number[];
} {
  if (cases.length === 0) {
    return { labels: [], caseArrivals: [], caseCompletions: [], medianDurationsHours: [] };
  }

  const daysMap: Map<
    string,
    { arrivals: number; completions: number; durationsMinutes: number[] }
  > = new Map();

  for (const c of cases) {
    const startDay = c.startTime.substring(0, 10);
    const endDay = c.endTime.substring(0, 10);

    if (!daysMap.has(startDay)) {
      daysMap.set(startDay, { arrivals: 0, completions: 0, durationsMinutes: [] });
    }
    daysMap.get(startDay)!.arrivals++;
    daysMap.get(startDay)!.durationsMinutes.push(c.durationMinutes);

    if (!daysMap.has(endDay)) {
      daysMap.set(endDay, { arrivals: 0, completions: 0, durationsMinutes: [] });
    }
    daysMap.get(endDay)!.completions++;
  }

  const sortedDays = Array.from(daysMap.keys()).sort();

  const labels: string[] = [];
  const caseArrivals: number[] = [];
  const caseCompletions: number[] = [];
  const medianDurationsHours: number[] = [];

  for (const day of sortedDays) {
    const entry = daysMap.get(day)!;
    // Format day as 'MMM D'
    const d = new Date(day);
    const label = !isNaN(d.getTime())
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : day;

    labels.push(label);
    caseArrivals.push(entry.arrivals);
    caseCompletions.push(entry.completions);
    const medHours =
      entry.durationsMinutes.length > 0
        ? Math.round((calculateMedian(entry.durationsMinutes) / 60) * 10) / 10
        : 0;
    medianDurationsHours.push(medHours);
  }

  return {
    labels,
    caseArrivals,
    caseCompletions,
    medianDurationsHours,
  };
}

/**
 * Generate purely data-derived analytical observations from actual calculations.
 */
export function generateDataObservations(
  cases: CaseSummary[],
  variants: ProcessVariant[],
  bottlenecks: BottleneckItem[],
  activityMetrics: ActivityMetric[]
): AnalyticalObservation[] {
  if (cases.length === 0) return [];

  const observations: AnalyticalObservation[] = [];

  // Observation 1: Longest observed elapsed transition
  const topBottleneck = bottlenecks.find((b) => b.validObservations >= 5) || bottlenecks[0];
  if (topBottleneck) {
    observations.push({
      id: 'obs-1',
      category: 'bottleneck',
      title: 'Longest Observed Inter-Event Elapsed Time',
      metric: `${topBottleneck.medianElapsedMinutes} min median elapsed`,
      summary: `The transition '${topBottleneck.label}' exhibits the highest observed median elapsed time (${topBottleneck.medianElapsedMinutes} min) across ${topBottleneck.validObservations} valid recordings.`,
      detail:
        'Inter-event elapsed time measures the difference between consecutive recorded timestamps. It represents elapsed operational interval rather than verified physician delay.',
    });
  }

  // Observation 2: Process Variant concentration
  if (variants.length > 0) {
    const topVariant = variants[0];
    const topTwoPct =
      variants.length >= 2 ? Math.round((topVariant.percentage + variants[1].percentage) * 10) / 10 : topVariant.percentage;

    observations.push({
      id: 'obs-2',
      category: 'variant',
      title: 'Observed Process Pathway Concentration',
      metric: `${topVariant.percentage}% follow ${topVariant.name}`,
      summary: `The single most frequent activity sequence (${topVariant.name}) accounts for ${topVariant.caseCount} of ${cases.length} cases (${topVariant.percentage}%).`,
      detail:
        variants.length >= 2
          ? `The top two observed variants collectively cover ${topTwoPct}% of cases, indicating moderate operational standardization across the cohort.`
          : 'All cases strictly follow a single observed variant sequence.',
    });
  }

  // Observation 3: High-frequency clinical activities
  if (activityMetrics.length > 0) {
    const topActivity = activityMetrics[0];
    observations.push({
      id: 'obs-3',
      category: 'volume',
      title: 'Primary Activity Milestone Throughput',
      metric: `${topActivity.frequency} total events`,
      summary: `'${topActivity.activity}' is recorded in ${topActivity.caseCount} distinct cases (${Math.round(
        (topActivity.caseCount / cases.length) * 100
      )}% case coverage).`,
      detail:
        'Activity distribution reflects log density. Activities appearing in fewer cases indicate specialized diagnostic or escalation sub-pathways.',
    });
  }

  // Observation 4: Activity rework / repetition check
  let casesWithRepeats = 0;
  for (const c of cases) {
    const set = new Set(c.activitySequence);
    if (set.size < c.activitySequence.length) {
      casesWithRepeats++;
    }
  }
  const repeatPercentage = Math.round((casesWithRepeats / cases.length) * 1000) / 10;
  if (casesWithRepeats > 0) {
    observations.push({
      id: 'obs-4',
      category: 'rework',
      title: 'Activity Re-traversal & Loop Frequency',
      metric: `${repeatPercentage}% of cases contain repeated activities`,
      summary: `${casesWithRepeats} cases (${repeatPercentage}%) contain one or more repeated activity instances within the same patient journey.`,
      detail:
        'Repeated activities often denote specimen redraws, repeat vitals checks, or clinical re-evaluations following preliminary lab/imaging results.',
    });
  }

  return observations;
}

/**
 * Filter cases and events according to global filter parameters.
 */
export function applyGlobalFilters(
  allCases: CaseSummary[],
  filters: {
    caseIdSearch: string;
    activity: string;
    variantKey: string;
    department: string;
    transitionKey?: string;
    startDate?: string;
    endDate?: string;
  }
): {
  filteredCases: CaseSummary[];
  filteredEvents: NormalizedEvent[];
} {
  const search = filters.caseIdSearch.trim().toLowerCase();

  const filteredCases = allCases.filter((c) => {
    // 1. Case ID search
    if (search && !c.caseId.toLowerCase().includes(search)) {
      return false;
    }

    // 2. Activity filter (case must include activity)
    if (filters.activity && filters.activity !== 'all') {
      if (!c.activitySequence.includes(filters.activity)) {
        return false;
      }
    }

    // 3. Variant key filter
    if (filters.variantKey && filters.variantKey !== 'all') {
      if (c.variantKey !== filters.variantKey) {
        return false;
      }
    }

    // 4. Department filter (cohort stratification)
    if (filters.department && filters.department !== 'all') {
      const matchesDept =
        c.department === filters.department ||
        c.events.some((e) => e.department === filters.department);
      if (!matchesDept) {
        return false;
      }
    }

    // 5. Specific transition filter (e.g. "Laboratory Start → Laboratory End")
    if (filters.transitionKey && filters.transitionKey !== 'all') {
      const parts = filters.transitionKey.split(' → ');
      if (parts.length === 2) {
        const [fromAct, toAct] = parts;
        const hasTransition = c.events.some(
          (e, idx) => e.activity === fromAct && c.events[idx + 1]?.activity === toAct
        );
        if (!hasTransition) {
          return false;
        }
      }
    }

    // 5. Date range
    if (filters.startDate) {
      if (new Date(c.startTime) < new Date(filters.startDate)) {
        return false;
      }
    }
    if (filters.endDate) {
      if (new Date(c.endTime) > new Date(filters.endDate)) {
        return false;
      }
    }

    return true;
  });

  const filteredEvents: NormalizedEvent[] = [];
  for (const c of filteredCases) {
    for (const evt of c.events) {
      filteredEvents.push(evt);
    }
  }

  filteredEvents.sort((a, b) => a.timestampMs - b.timestampMs);

  return {
    filteredCases,
    filteredEvents,
  };
}

/**
 * Compute key summary metrics from filtered cases.
 */
export function computeSummaryMetrics(
  cases: CaseSummary[],
  events: NormalizedEvent[],
  activeFilterCount: number
): CalculatedMetrics {
  const durations = cases.map((c) => c.durationMinutes);
  const distinctVariants = new Set(cases.map((c) => c.variantKey)).size;
  const uniqueActivities = new Set(events.map((e) => e.activity)).size;
  const zeroDurations = durations.filter((d) => d === 0).length;

  return {
    totalCases: cases.length,
    totalEvents: events.length,
    medianCaseDurationMinutes: Math.round(calculateMedian(durations)),
    meanCaseDurationMinutes:
      cases.length > 0 ? Math.round(calculateMean(durations) * 10) / 10 : 0,
    p90CaseDurationMinutes:
      cases.length > 0 ? Math.round(calculatePercentile(durations, 90) * 10) / 10 : 0,
    minCaseDurationMinutes:
      durations.length > 0 ? Math.round(durations.reduce((min, d) => (d < min ? d : min), durations[0])) : 0,
    maxCaseDurationMinutes:
      durations.length > 0 ? Math.round(durations.reduce((max, d) => (d > max ? d : max), durations[0])) : 0,
    distinctVariantsCount: distinctVariants,
    uniqueActivitiesCount: uniqueActivities,
    averageEventsPerCase:
      cases.length > 0 ? Math.round((events.length / cases.length) * 10) / 10 : 0,
    activeFilterCount,
    zeroDurationCasesCount: zeroDurations,
    zeroDurationCasesPercentage:
      cases.length > 0 ? Math.round((zeroDurations / cases.length) * 1000) / 10 : 0,
  };
}

/**
 * Safely format and escape a value for RFC-4180 CSV compliance.
 */
export function escapeCsvCell(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '""';
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  const s = String(val).replace(/"/g, '""');
  return `"${s}"`;
}

/**
 * Option A: Generate CSV text from normalized events.
 */
export function exportEventsToCSV(events: NormalizedEvent[]): string {
  const headers = [
    'Case ID',
    'Event Index',
    'Activity',
    'Timestamp',
    'Next Activity',
    'Elapsed to Next (min)',
    'Resource',
    'Department',
    'Status',
  ];

  const rows = events.map((e) => [
    escapeCsvCell(e.caseId),
    e.eventIndex,
    escapeCsvCell(e.activity),
    escapeCsvCell(e.timestamp),
    e.nextActivity ? escapeCsvCell(e.nextActivity) : '""',
    e.elapsedToNextMinutes !== null && e.elapsedToNextMinutes !== undefined ? e.elapsedToNextMinutes : '',
    e.resource ? escapeCsvCell(e.resource) : '""',
    e.department ? escapeCsvCell(e.department) : '""',
    e.status ? escapeCsvCell(e.status) : '""',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Option B: Export calculated DFG transitions to CSV.
 */
export function exportTransitionsToCSV(
  transitions: ActivityTransition[],
  totalCohortCases?: number
): string {
  const headers = [
    'Source Activity',
    'Destination Activity',
    'Transition Count',
    'Distinct Cases',
    'Case Coverage (%)',
    'Departure Percentage (%)',
    'Median Elapsed (min)',
    'Mean Elapsed (min)',
    'P25 Elapsed (min)',
    'P75 Elapsed (min)',
    'P90 Elapsed (min)',
    'P95 Elapsed (min)',
    'Min Elapsed (min)',
    'Max Elapsed (min)',
    'IQR (min)',
    'Zero-Duration Count',
    'Zero-Duration Rate (%)',
    'Observed Latency Tier',
  ];

  const rows = transitions.map((t) => {
    const coveragePct =
      totalCohortCases && totalCohortCases > 0
        ? Math.round((t.caseCount / totalCohortCases) * 1000) / 10
        : '';
    const iqr =
      t.p75ElapsedMinutes !== undefined && t.p25ElapsedMinutes !== undefined
        ? Math.round((t.p75ElapsedMinutes - t.p25ElapsedMinutes) * 10) / 10
        : '';
    const severityTier =
      t.medianElapsedMinutes >= 60 || t.p90ElapsedMinutes >= 120
        ? 'High Latency Bottleneck'
        : t.medianElapsedMinutes >= 30 || t.p90ElapsedMinutes >= 60
        ? 'Moderate Operational Delay'
        : 'Nominal Progression';

    return [
      escapeCsvCell(t.from),
      escapeCsvCell(t.to),
      t.observationCount,
      t.caseCount,
      coveragePct !== '' ? coveragePct : '',
      t.percentageOfDepartures,
      t.medianElapsedMinutes,
      t.meanElapsedMinutes,
      t.p25ElapsedMinutes ?? '',
      t.p75ElapsedMinutes ?? '',
      t.p90ElapsedMinutes,
      t.p95ElapsedMinutes ?? '',
      t.minElapsedMinutes ?? '',
      t.maxElapsedMinutes ?? '',
      iqr !== '' ? iqr : '',
      t.zeroDurationCount ?? 0,
      t.zeroDurationPercentage ?? 0,
      escapeCsvCell(severityTier),
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Option C: Export ranked bottleneck items to CSV.
 */
export function exportBottlenecksToCSV(
  bottlenecks: BottleneckItem[],
  totalCohortCases?: number
): string {
  const headers = [
    'Rank',
    'Bottleneck Transition',
    'Source Activity',
    'Destination Activity',
    'Distinct Cases',
    'Case Coverage (%)',
    'Valid Observations',
    'Median Elapsed (min)',
    'Mean Elapsed (min)',
    'P25 Elapsed (min)',
    'P75 Elapsed (min)',
    'P90 Elapsed (min)',
    'P95 Elapsed (min)',
    'Min Elapsed (min)',
    'Max Elapsed (min)',
    'Zero-Duration Count',
    'Zero-Duration Rate (%)',
    'Severity Tier',
    'Operational Explanation',
  ];

  const rows = bottlenecks.map((b, idx) => {
    const [fromAct, toAct] = b.label.split(' → ');
    const coveragePct =
      totalCohortCases && totalCohortCases > 0
        ? Math.round((b.caseCount / totalCohortCases) * 1000) / 10
        : '';
    const severityLabel =
      b.severity === 'high'
        ? 'High Latency'
        : b.severity === 'moderate'
        ? 'Moderate Latency'
        : 'Nominal';

    return [
      idx + 1,
      escapeCsvCell(b.label),
      escapeCsvCell(b.from || fromAct || ''),
      escapeCsvCell(b.to || toAct || ''),
      b.caseCount,
      coveragePct !== '' ? coveragePct : '',
      b.validObservations,
      b.medianElapsedMinutes,
      b.meanElapsedMinutes,
      b.p25ElapsedMinutes ?? '',
      b.p75ElapsedMinutes ?? '',
      b.p90ElapsedMinutes,
      b.p95ElapsedMinutes ?? '',
      b.minElapsedMinutes ?? '',
      b.maxElapsedMinutes ?? '',
      b.zeroDurationCount ?? 0,
      b.zeroDurationPercentage ?? 0,
      escapeCsvCell(severityLabel),
      escapeCsvCell(b.explanation),
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Option D: Export process variants with step transitions to CSV.
 */
export function exportVariantsToCSV(variants: ProcessVariant[]): string {
  const headers = [
    'Variant ID',
    'Variant Name',
    'Activity Sequence',
    'Case Count',
    'Prevalence (%)',
    'Median Duration (min)',
    'Mean Duration (min)',
    'Min Duration (min)',
    'Max Duration (min)',
    'Is Dominant Variant',
    'Step Transitions Breakdown',
  ];

  const rows = variants.map((v) => {
    const sequenceStr = v.activities.join(' → ');
    const stepsStr =
      v.stepTransitions && v.stepTransitions.length > 0
        ? v.stepTransitions
            .map((st) => `${st.from} → ${st.to} (Med: ${st.medianElapsedMinutes}m, P90: ${st.p90ElapsedMinutes}m)`)
            .join(' | ')
        : 'N/A';

    return [
      escapeCsvCell(v.id),
      escapeCsvCell(v.name),
      escapeCsvCell(sequenceStr),
      v.caseCount,
      v.percentage,
      v.medianDurationMinutes,
      v.meanDurationMinutes,
      v.minDurationMinutes,
      v.maxDurationMinutes,
      v.isMostFrequent,
      escapeCsvCell(stepsStr),
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Option E: Export patient case summary registry to CSV.
 */
export function exportCasesToCSV(cases: CaseSummary[]): string {
  const headers = [
    'Case ID',
    'Start Time',
    'End Time',
    'Duration (min)',
    'Event Count',
    'Pathway Variant',
    'Activity Sequence',
    'Primary Department',
    'Clinical Status',
  ];

  const rows = cases.map((c) => {
    return [
      escapeCsvCell(c.caseId),
      escapeCsvCell(c.startTime),
      escapeCsvCell(c.endTime),
      c.durationMinutes,
      c.eventCount,
      escapeCsvCell(c.variantKey),
      escapeCsvCell(c.activitySequence.join(' → ')),
      escapeCsvCell(c.department || 'N/A'),
      escapeCsvCell(c.status || 'Completed'),
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Option F1: Generate comprehensive clinical process mining executive audit report in Markdown.
 */
export function generateExecutiveReportMarkdown(params: ExecutiveReportParams): string {
  const {
    datasetMetadata,
    metrics,
    filterState,
    variants,
    bottlenecks,
    transitions,
    observations,
    casesCount,
    eventsCount,
  } = params;

  const now = new Date().toISOString();
  const topBottlenecks = bottlenecks.slice(0, 8);
  const topVariants = variants.slice(0, 8);

  const syntheticNotice = datasetMetadata.isSynthetic
    ? `> [!IMPORTANT]\n> **Demonstration Synthetic Data Governance Notice:**\n> This report analyzes synthetic demonstration data generated for the CareFlow healthcare analytics research program. All patient identifiers, chronological timestamps, and sequence events derive from parametric simulation models. No real Protected Health Information (PHI) is present. Observed metrics represent exploratory engineering benchmarks.`
    : `> [!NOTE]\n> **Clinical Data Governance Notice:**\n> This report reflects an authorized, de-identified clinical event log loaded into CareFlow. All calculations are executed strictly in local browser client memory. No patient data has been transmitted to external services.`;

  const filterSummary = [
    `- **Cohort Filter Preset:** ${filterState.datePreset}`,
    filterState.startDate ? `- **Start Date:** ${filterState.startDate}` : null,
    filterState.endDate ? `- **End Date:** ${filterState.endDate}` : null,
    filterState.activity !== 'all' ? `- **Activity Focus:** ${filterState.activity}` : null,
    filterState.variantKey !== 'all' ? `- **Variant Focus:** ${filterState.variantKey}` : null,
    filterState.department !== 'all' ? `- **Clinic / Department:** ${filterState.department}` : null,
    filterState.transitionKey && filterState.transitionKey !== 'all'
      ? `- **Transition Cohort:** ${filterState.transitionKey}`
      : null,
    filterState.caseIdSearch ? `- **Case ID Search:** ${filterState.caseIdSearch}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const variantTableRows = topVariants
    .map((v, i) => {
      return `| ${i + 1} | **${v.name}** | \`${v.activities.join(' → ')}\` | ${v.caseCount.toLocaleString()} | ${v.percentage}% | ${v.medianDurationMinutes}m | ${v.minDurationMinutes}m – ${v.maxDurationMinutes}m |`;
    })
    .join('\n');

  const bottleneckTableRows = topBottlenecks
    .map((b, i) => {
      const iqr =
        b.p75ElapsedMinutes !== undefined && b.p25ElapsedMinutes !== undefined
          ? `${Math.round((b.p75ElapsedMinutes - b.p25ElapsedMinutes) * 10) / 10}m`
          : '—';
      return `| ${i + 1} | **${b.label}** | ${b.severity.toUpperCase()} | ${b.caseCount.toLocaleString()} | ${b.medianElapsedMinutes}m | ${b.meanElapsedMinutes}m | ${b.p25ElapsedMinutes ?? '—'}m | ${b.p75ElapsedMinutes ?? '—'}m | ${b.p90ElapsedMinutes}m | ${b.p95ElapsedMinutes ?? '—'}m | ${iqr} | ${b.zeroDurationPercentage ?? 0}% |`;
    })
    .join('\n');

  const transitionTableRows = transitions
    .slice(0, 12)
    .map((t) => {
      return `| \`${t.from} → ${t.to}\` | ${t.caseCount.toLocaleString()} | ${t.observationCount.toLocaleString()} | ${t.percentageOfDepartures}% | ${t.medianElapsedMinutes}m | ${t.p90ElapsedMinutes}m | ${t.zeroDurationCount ?? 0} (${t.zeroDurationPercentage ?? 0}%) |`;
    })
    .join('\n');

  const observationItems = observations
    .map((obs) => {
      return `### ${obs.title} (${obs.metric})\n${obs.summary}\n\n*${obs.detail}*\n`;
    })
    .join('\n');

  return `# CareFlow — Clinical Pathway Process Mining Executive Audit Report

**Report Generation Timestamp:** ${now}<br>
**Dataset Name:** ${datasetMetadata.name} (\`${datasetMetadata.id}\`)<br>
**Underlying File / Source:** \`${datasetMetadata.filename}\` (${Math.round(datasetMetadata.fileSizeBytes / 1024)} KB)<br>
**Validation Health:** ${datasetMetadata.validationReport.invalidRows} invalid rows out of ${datasetMetadata.validationReport.totalRows} raw rows.

---

${syntheticNotice}

---

## 1. Executive Cohort Summary

| Metric Dimension | Value | Operational Definition |
| :--- | :---: | :--- |
| **Total Filtered Cases** | **${casesCount.toLocaleString()}** | Distinct patient encounters eligible under current filter criteria |
| **Total Filtered Events** | **${eventsCount.toLocaleString()}** | Clinical milestone events with valid timestamps and activities |
| **Unique Clinical Activities** | **${metrics.uniqueActivitiesCount}** | Distinct clinical milestones recorded across active encounters |
| **Average Events per Case** | **${metrics.averageEventsPerCase}** | Encounter complexity / step depth ratio |
| **Median Case Duration** | **${metrics.medianCaseDurationMinutes} min** | 50th percentile admission-to-disposition elapsed time |
| **Mean Case Duration** | **${metrics.meanCaseDurationMinutes} min** | Arithmetic mean admission-to-disposition elapsed time |
| **90th-Percentile (P90) Duration** | **${metrics.p90CaseDurationMinutes} min** | Right-skewed tail threshold for prolonged encounters |
| **Distinct Observed Variants** | **${metrics.distinctVariantsCount}** | Number of unique end-to-end activity sequences |
| **Zero-Duration Encounters** | **${metrics.zeroDurationCasesCount} (${metrics.zeroDurationCasesPercentage}%)** | Cases with simultaneous start and disposition timestamps |
| **Active Global Filters** | **${metrics.activeFilterCount} active** | Active cohort stratification rules |

### Active Stratification Filters
${filterSummary || '- *No active filters (100% full dataset cohort).*'}

---

## 2. Dominant Process Variants Breakdown

| Rank | Variant | Activity Sequence | Cases | Prevalence | Median Duration | Range (Min – Max) |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
${variantTableRows || '| — | None | No variants match filter criteria | 0 | 0% | — | — |'}

---

## 3. High-Latency Process Bottlenecks & Parametric Quantiles

All percentiles computed using continuous linear interpolation matching NumPy / PM4Py standards ($Q(p) = x_{\\lfloor i \\rfloor} + (i - \\lfloor i \\rfloor)(x_{\\lceil i \\rceil} - x_{\\lfloor i \\rfloor})$).

| Rank | Transition Path | Tier | Cases | Median | Mean | P25 | P75 | P90 | P95 | IQR | Zero-Duration % |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
${bottleneckTableRows || '| — | None | Nominal | 0 | — | — | — | — | — | — | — | — |'}

---

## 4. Empirical Transition Network & Concurrency Diagnostics

| Transition (From → To) | Cases | Total Instances | Departure Ratio | Median | P90 Tail | Zero-Duration Ties |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
${transitionTableRows || '| None | 0 | 0 | 0% | — | — | 0 (0%) |'}

---

## 5. Automated Data-Derived Findings & Operational Observations

${observationItems || '*No specific observations generated for current filter selection.*'}

---

## 6. Methodology, Data Integrity & Invariants

1. **Continuous Linear Quantiles:** Percentiles ($P25$, $P50$, $P75$, $P90$, $P95$) follow linear interpolation ($method='linear'$), ensuring numerical parity with PM4Py and Python process mining packages.
2. **Quantile Monotonicity Invariant:** For every transition with $N \\ge 1$, $\\text{Min} \\le P25 \\le \\text{Median} \\le P75 \\le P90 \\le P95 \\le \\text{Max}$.
3. **Zero-Duration Timestamp Ties:** Recorded $\\Delta t = 0$ events denote simultaneous order batches or concurrent actions in electronic records.
4. **Data Privacy Assurance:** All data processing occurs exclusively in client-side memory. Zero patient records or tokens are transmitted to external servers.
`;
}

/**
 * Option F2: Export complete structured cohort report in JSON format.
 */
export function exportCohortReportJSON(params: ExecutiveReportParams): string {
  const {
    datasetMetadata,
    metrics,
    filterState,
    variants,
    bottlenecks,
    transitions,
    observations,
    casesCount,
    eventsCount,
  } = params;

  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    dataset: {
      id: datasetMetadata.id,
      name: datasetMetadata.name,
      filename: datasetMetadata.filename,
      isSynthetic: datasetMetadata.isSynthetic,
      fileSizeBytes: datasetMetadata.fileSizeBytes,
      loadedAt: datasetMetadata.loadedAt,
      description: datasetMetadata.description,
      validationReport: {
        totalRows: datasetMetadata.validationReport.totalRows,
        parsedEvents: datasetMetadata.validationReport.parsedEvents,
        uniqueCases: datasetMetadata.validationReport.uniqueCases,
        invalidRows: datasetMetadata.validationReport.invalidRows,
        ambiguousTimestampTies: datasetMetadata.validationReport.ambiguousTimestampTies,
      },
    },
    activeFilters: {
      datePreset: filterState.datePreset,
      startDate: filterState.startDate || null,
      endDate: filterState.endDate || null,
      activity: filterState.activity,
      variantKey: filterState.variantKey,
      department: filterState.department,
      transitionKey: filterState.transitionKey || 'all',
      caseIdSearch: filterState.caseIdSearch || null,
    },
    summaryMetrics: {
      totalCases: casesCount,
      totalEvents: eventsCount,
      uniqueActivitiesCount: metrics.uniqueActivitiesCount,
      averageEventsPerCase: metrics.averageEventsPerCase,
      medianCaseDurationMinutes: metrics.medianCaseDurationMinutes,
      meanCaseDurationMinutes: metrics.meanCaseDurationMinutes,
      p90CaseDurationMinutes: metrics.p90CaseDurationMinutes,
      minCaseDurationMinutes: metrics.minCaseDurationMinutes,
      maxCaseDurationMinutes: metrics.maxCaseDurationMinutes,
      distinctVariantsCount: metrics.distinctVariantsCount,
      activeFilterCount: metrics.activeFilterCount,
      zeroDurationCasesCount: metrics.zeroDurationCasesCount,
      zeroDurationCasesPercentage: metrics.zeroDurationCasesPercentage,
    },
    variants: variants.map((v) => ({
      id: v.id,
      name: v.name,
      key: v.key,
      activities: v.activities,
      caseCount: v.caseCount,
      percentage: v.percentage,
      medianDurationMinutes: v.medianDurationMinutes,
      meanDurationMinutes: v.meanDurationMinutes,
      minDurationMinutes: v.minDurationMinutes,
      maxDurationMinutes: v.maxDurationMinutes,
      isMostFrequent: v.isMostFrequent,
      stepTransitions: v.stepTransitions || [],
    })),
    bottlenecks: bottlenecks.map((b) => ({
      id: b.id,
      label: b.label,
      from: b.from,
      to: b.to,
      severity: b.severity,
      caseCount: b.caseCount,
      validObservations: b.validObservations,
      medianElapsedMinutes: b.medianElapsedMinutes,
      meanElapsedMinutes: b.meanElapsedMinutes,
      p25ElapsedMinutes: b.p25ElapsedMinutes ?? null,
      p75ElapsedMinutes: b.p75ElapsedMinutes ?? null,
      p90ElapsedMinutes: b.p90ElapsedMinutes,
      p95ElapsedMinutes: b.p95ElapsedMinutes ?? null,
      minElapsedMinutes: b.minElapsedMinutes ?? null,
      maxElapsedMinutes: b.maxElapsedMinutes ?? null,
      zeroDurationCount: b.zeroDurationCount ?? 0,
      zeroDurationPercentage: b.zeroDurationPercentage ?? 0,
      explanation: b.explanation,
    })),
    transitions: transitions.map((t) => ({
      id: t.id,
      from: t.from,
      to: t.to,
      caseCount: t.caseCount,
      observationCount: t.observationCount,
      percentageOfDepartures: t.percentageOfDepartures,
      medianElapsedMinutes: t.medianElapsedMinutes,
      meanElapsedMinutes: t.meanElapsedMinutes,
      p25ElapsedMinutes: t.p25ElapsedMinutes ?? null,
      p75ElapsedMinutes: t.p75ElapsedMinutes ?? null,
      p90ElapsedMinutes: t.p90ElapsedMinutes,
      p95ElapsedMinutes: t.p95ElapsedMinutes ?? null,
      minElapsedMinutes: t.minElapsedMinutes ?? null,
      maxElapsedMinutes: t.maxElapsedMinutes ?? null,
      zeroDurationCount: t.zeroDurationCount ?? 0,
      zeroDurationPercentage: t.zeroDurationPercentage ?? 0,
    })),
    observations: observations.map((o) => ({
      id: o.id,
      category: o.category,
      title: o.title,
      metric: o.metric,
      summary: o.summary,
      detail: o.detail,
    })),
    governance: {
      isSynthetic: datasetMetadata.isSynthetic,
      quantileInterpolation: 'linear (continuous)',
      privacyNotice: 'Zero patient identifiers transmitted. Pure client-side analytical processing.',
    },
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Generate a standardized, safe filename for an export download.
 */
export function generateExportFilename(
  datasetName: string,
  exportType: 'events' | 'transitions' | 'bottlenecks' | 'variants' | 'cases' | 'audit_report',
  extension: 'csv' | 'md' | 'json'
): string {
  const safeDataset = (datasetName || 'dataset')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `careflow_${safeDataset}_${exportType}_${year}${month}${day}.${extension}`;
}

/**
 * Trigger in-browser file download safely without external dependencies.
 */
export function triggerBrowserDownload(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Re-export Phase 5 Conformance & Compliance Evaluation Engine
export * from './conformanceEngine';
