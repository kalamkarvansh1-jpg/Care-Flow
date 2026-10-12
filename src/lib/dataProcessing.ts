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
  const index = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
  return sorted[index];
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

    variants.push({
      key,
      id: `var-${index}`,
      name: `Variant #${index}`,
      activities: variantCases[0].activitySequence,
      caseCount,
      percentage,
      medianDurationMinutes: Math.round(calculateMedian(durations)),
      meanDurationMinutes: Math.round(calculateMean(durations)),
      minDurationMinutes: Math.round(Math.min(...durations)),
      maxDurationMinutes: Math.round(Math.max(...durations)),
      isMostFrequent: false,
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
  totalCasesCount: number
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
      medianElapsedMinutes: Math.round(calculateMedian(entry.elapsedTimes)),
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

    result.push({
      id: `tr-${index++}`,
      from: item.from,
      to: item.to,
      observationCount: item.count,
      caseCount: item.cases.size,
      medianElapsedMinutes: Math.round(calculateMedian(item.durations)),
      meanElapsedMinutes: Math.round(calculateMean(item.durations)),
      p90ElapsedMinutes: Math.round(calculatePercentile(item.durations, 90)),
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
  activityMetrics: ActivityMetric[]
): BottleneckItem[] {
  const bottlenecks: BottleneckItem[] = [];

  // Ranked transitions with notable median elapsed times
  for (const tr of transitions) {
    let severity: 'high' | 'moderate' | 'nominal' = 'nominal';
    if (tr.medianElapsedMinutes >= 60) severity = 'high';
    else if (tr.medianElapsedMinutes >= 30) severity = 'moderate';

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

    // 4. Department filter
    if (filters.department && filters.department !== 'all') {
      if (c.department !== filters.department) {
        return false;
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

  return {
    totalCases: cases.length,
    totalEvents: events.length,
    medianCaseDurationMinutes: Math.round(calculateMedian(durations)),
    distinctVariantsCount: distinctVariants,
    averageEventsPerCase: cases.length > 0 ? Math.round((events.length / cases.length) * 10) / 10 : 0,
    activeFilterCount,
  };
}

/**
 * Generate CSV text from normalized events.
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

  const escapeCsv = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = events.map((e) => [
    escapeCsv(e.caseId),
    e.eventIndex,
    escapeCsv(e.activity),
    escapeCsv(e.timestamp),
    e.nextActivity ? escapeCsv(e.nextActivity) : '""',
    e.elapsedToNextMinutes !== null && e.elapsedToNextMinutes !== undefined ? e.elapsedToNextMinutes : '',
    e.resource ? escapeCsv(e.resource) : '""',
    e.department ? escapeCsv(e.department) : '""',
    e.status ? escapeCsv(e.status) : '""',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}
