# CareFlow — Phase 4, Step 2: DFG P90 Tail Latency Visualization & Annotation Report

> [!IMPORTANT]
> **Project Context & Academic Research Disclosure:**
> This study is part of the CareFlow clinical pathway analytics research program. All underlying electronic health record data is synthetic, generated for academic benchmarking. No real patient data is utilized. Strict privacy safeguards ensure all analytical outputs and reports remain strictly aggregate-level with zero case or patient identifiers.

---

## 1. Executive Summary & Deliverable Objective

Following the successful execution of Phase 4 Step 1 (`reports/frontend_metrics_alignment.md`), this deliverable delivers **Phase 4, Step 2: Directly-Follows Graph (DFG) P90 Tail Latency Visualization & Annotation**.

The core objective was to extend the interactive SVG Directed Graph ([`src/components/charts/ProcessFlowGraph.tsx`](file:///d:/Care%20Flow/src/components/charts/ProcessFlowGraph.tsx)) to make 90th-percentile (P90) tail latency visible directly on transition paths without disrupting graph layout, line geometry, node clustering, or readability.

### Key Achievements in Step 2:
1. **Multi-Metric Edge Badge Display:** Added an interactive metric mode controller (`Both (Med + P90)`, `Median`, `P90 Tail`) in the graph toolbar with dynamic SVG badge dimensioning to eliminate text truncation or awkward line breaks.
2. **Comprehensive Diagnostic Tooltips:** Implemented native multi-line SVG `<title>` tooltips on both edge paths and badge labels, surfacing Case Count, Departure Percentage, Total Observation Frequency, Median Elapsed Time, P90 Tail Elapsed Time, Mean Elapsed Time, and Flow Type (Forward Progression vs. Rework Loop).
3. **Tail-Aware Edge Latency Tiering:** Updated edge severity classification to evaluate both median and tail delays (`high` when Median $\ge 60$m OR P90 $\ge 120$m), directly reflecting the Phase 3 bottleneck diagnostics.
4. **Node Focus Inspection Enhancement:** Updated incoming and outgoing transition lists in the Node Details drawer on [`src/pages/ProcessAnalysisPage.tsx`](file:///d:/Care%20Flow/src/pages/ProcessAnalysisPage.tsx) to display both Median and P90 tail values.
5. **Quality Assurance & Zero-Duration Hardening:** Added Test Suite 6 to [`scratch/run_qa_tests.ts`](file:///d:/Care%20Flow/scratch/run_qa_tests.ts) validating transition calculations, positive tail skew detection, zero-duration transitions, and CSV upload consistency (68 passed, 0 failed).

---

## 2. Process Flow Graph Audit & Data Structure Verification

### 2.1 Transition Metric Availability
The transition pipeline in [`src/lib/dataProcessing.ts`](file:///d:/Care%20Flow/src/lib/dataProcessing.ts) extracts [`ActivityTransition`](file:///d:/Care%20Flow/src/types/index.ts#L59-L69) objects carrying:
- `medianElapsedMinutes`: 50th percentile of inter-event durations.
- `meanElapsedMinutes`: Arithmetic mean duration.
- `p90ElapsedMinutes`: 90th percentile derived via continuous linear quantile interpolation ($Q(p) = x_{\lfloor i \rfloor} + (i - \lfloor i \rfloor)(x_{\lceil i \rceil} - x_{\lfloor i \rfloor})$).
- `caseCount`: Count of unique cases traversing the transition.
- `observationCount`: Total event-pair occurrences.
- `percentageOfDepartures`: Relative proportion of transitions departing the origin node.

All values are computed directly from sorted timestamps, rounded to 1 decimal place, and completely decoupled from raw source data modifications.

### 2.2 Safety Across Edge Cases
- **Zero-Duration Transitions:** In scenarios with simultaneous timestamps (e.g. parallel order entries or batch registrations), durations evaluate to $0.0$, yielding `median = 0` and `P90 = 0` without mathematical errors.
- **Single-Event Cases:** Encounters with single activities produce zero transitions safely without null-pointer exceptions.
- **Empty Filter Results:** Produces empty edge and node arrays safely, triggering clear empty-state notifications.

---

## 3. Implementation Details: P90 DFG Visual Annotations

### 3.1 Dynamic SVG Edge Badges (`src/components/charts/ProcessFlowGraph.tsx`)
In [`src/components/charts/ProcessFlowGraph.tsx`](file:///d:/Care%20Flow/src/components/charts/ProcessFlowGraph.tsx), edge badge dimensions and text strings adapt dynamically to the user's active metric selection:

```typescript
let badgeWidth = 92;
let badgeX = -46;
let labelText = '';

const caseStr = formatNumber(edge.transition.caseCount);
const medStr = `${edge.transition.medianElapsedMinutes}m`;
const p90Str = `${edge.transition.p90ElapsedMinutes}m`;

if (durationMetric === 'both') {
  labelText = `${caseStr} (${medStr} • P90:${p90Str})`;
  badgeWidth = 146;
  badgeX = -73;
} else if (durationMetric === 'p90') {
  labelText = `${caseStr} (P90:${p90Str})`;
  badgeWidth = 108;
  badgeX = -54;
} else {
  labelText = `${caseStr} (${medStr})`;
  badgeWidth = 92;
  badgeX = -46;
}
```

### 3.2 Rich Diagnostic SVG Tooltips
Both `<path>` and `<g transform="...">` elements embed a native `<title>` tooltip delivering complete operational context on hover:

```typescript
const tooltipText =
  `Transition: ${edge.from} → ${edge.to}\n` +
  `Cases: ${caseStr} (${edge.transition.percentageOfDepartures}% of departures)\n` +
  `Observations: ${formatNumber(edge.transition.observationCount)}\n` +
  `Median Duration: ${edge.transition.medianElapsedMinutes} min (${formatDurationMinutes(edge.transition.medianElapsedMinutes)})\n` +
  `P90 Tail Duration: ${edge.transition.p90ElapsedMinutes} min (${formatDurationMinutes(edge.transition.p90ElapsedMinutes)})\n` +
  `Mean Duration: ${edge.transition.meanElapsedMinutes} min (${formatDurationMinutes(edge.transition.meanElapsedMinutes)})\n` +
  `Flow Type: ${edge.isBackward ? 'Rework Loop / Recurrence' : 'Forward Progression'}`;
```

### 3.3 Tail-Aware Latency Severity Tiering
Edge color styling now alerts users when a transition has an acceptable median but an unacceptable tail delay:
```typescript
let severity: 'nominal' | 'moderate' | 'high' = 'nominal';
if (t.medianElapsedMinutes >= 60 || t.p90ElapsedMinutes >= 120) severity = 'high';
else if (t.medianElapsedMinutes >= 30 || t.p90ElapsedMinutes >= 60) severity = 'moderate';
```
- **Nominal (Slate `#94a3b8`):** Typical progression without delay.
- **Moderate (Amber `#d97706`):** Median 30–60m or P90 60–120m.
- **High (Rose `#e11d48`):** Median $\ge 60$m or P90 $\ge 120$m.

---

## 4. Verification & Quality Assurance Evidence

### 4.1 Automated QA Test Suite (`scratch/run_qa_tests.ts`)
Command:
```bash
npx --no-install tsx scratch/run_qa_tests.ts
```
**Results Breakdown:**
- **Test Suite 0 (Linear Quantile Parity):** 5/5 PASSED.
- **Test Suite 1 (Demo Presets & Calculations):** 12/12 PASSED.
- **Test Suite 2 (Transitions & Bottlenecks):** 7/7 PASSED.
- **Test Suite 3 (Filters & Search):** 7/7 PASSED.
- **Test Suite 4 (CSV Export):** 4/4 PASSED.
- **Test Suite 5 (Test Fixtures & Upload):** 13/13 PASSED.
- **Test Suite 6 (DFG Transitions & P90 Annotations):** 20/20 PASSED:
  - Verified all 13 Sepsis transitions have non-negative median and P90 values.
  - Verified 11/13 transitions exhibit positive tail skew ($P90 > \text{Median}$).
  - Verified all 5 Cardiology transitions traversed by 720 cases with valid P90.
  - Verified simultaneous zero-duration events produce `median = 0` and `P90 = 0`.
  - Verified single-event encounters produce 0 transitions safely.
  - Verified CSV upload fixture transitions calculate consistent P90 durations.
  - Verified string label formatting across `both`, `median`, and `p90` modes.
- **Total:** **68 Passed, 0 Failed**.

### 4.2 Production Build Verification (`npm run build`)
Command:
```bash
npm run build
```
- TypeScript check (`tsc -b`): **Zero errors**.
- Vite production bundle: Generated in 541ms (`dist/assets/index-Dal_PIQh.js`).

### 4.3 Oxlint Code Quality Audit (`npm run lint`)
Command:
```bash
npm run lint
```
- Scanned 28 files across 116 linting rules: **0 warnings, 0 errors**.

### 4.4 Process Mining Python Regression Verification
Commands:
```bash
.venv\Scripts\python.exe scripts/process_mining/independent_validation_step7.py
.venv\Scripts\python.exe scripts/process_mining/discrepancy_resolution_step8.py
```
- **Step 7 Audit:** 4/4 baseline P90 values, 9/9 narrative checks, and Table 7.1 verified; exit code `0`.
- **Step 8 Regression Suite:** All mathematical assertions and privacy compliance checks passed; exit code `0`.
- **Historical Deliverables:** `independent_validation.md` preserved untouched.

### 4.5 Formatting & Trailing Whitespace (`git diff --check`)
Command:
```bash
git diff --check
```
- **Outcome:** **Zero whitespace errors or invalid line endings**.

### 4.6 Cryptographic Dataset Immutability Verification
SHA-256 stream hashes:
- `data/raw/careflow_source.csv`: `07d0096b6e3fcff78f94afa6d5aeffeeb2566f59902eccc03da209a3b6502720` (100% Match)
- `data/processed/cleaned_source.csv`: `674212c0e4b97d64045e53f2908418c1f229f8e15dd7da801a99436584e614f3` (100% Match)
- `data/processed/event_log.csv`: `cdab7bbc0e6755cb927a2a627bff2108e48d94ce0e38f62354ed72dcfb63442d` (100% Match)

---

## 5. Summary of Files Changed

| File Path | Nature of Change | Purpose |
| :--- | :--- | :--- |
| `src/components/charts/ProcessFlowGraph.tsx` | Modified | Added `durationMetric` toggle, dynamic badge dimensioning, P90 tail annotations, and SVG `<title>` tooltips. |
| `src/pages/ProcessAnalysisPage.tsx` | Modified | Updated Node Details drawer incoming/outgoing transition lists with P90 tail values. |
| `scratch/run_qa_tests.ts` | Modified | Added Test Suite 6 covering DFG transitions, P90 skew, zero-duration handling, and label generation. |
| `reports/dfg_p90_visualization.md` | Created | Deliverable documentation and audit report for Phase 4 Step 2. |

*Preserved Historical Uncommitted Files:*
- `scripts/process_mining/independent_validation_step7.py` (Intact & Passing)
- `reports/regression_hardening.md` (Intact)
- `reports/frontend_metrics_alignment.md` (Intact)
- `src/types/index.ts` (Intact)
- `src/lib/dataProcessing.ts` (Intact)
- `src/components/charts/BottleneckChart.tsx` (Intact)
