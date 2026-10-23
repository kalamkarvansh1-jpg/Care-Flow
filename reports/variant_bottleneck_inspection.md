# CareFlow — Phase 4, Step 4: Variant Filtering & Bottleneck Detail Inspection Report

> [!IMPORTANT]
> **Project Context & Academic Research Disclosure:**
> This study is part of the CareFlow clinical pathway analytics research program. All underlying electronic health record demonstration data is synthetic, generated for academic and software engineering evaluation. No real patient data is utilized. Strict privacy safeguards ensure all analytical outputs and reports remain strictly aggregate-level with zero case or patient identifiers.

---

## 1. Executive Summary & Deliverable Objective

Following the successful completion of Phase 4 Step 1 (Frontend Metrics & P90 Bottleneck Alignment), Step 2 (DFG P90 Tail Latency Visualization), and Step 3 (CareFlow Outpatient Pathway Preset), this deliverable completes **Phase 4, Step 4: Variant Filtering & Bottleneck Detail Inspection across Stratified Cohorts**.

Prior to Step 4, the CareFlow web application offered macro-level bottleneck ranking and general variant selection, but lacked deep inspection capabilities into transition latency distributions, clinic/department stratification, and intra-variant step timing. Furthermore, detailed statistical diagnostics computed during Phase 3 process mining—including continuous linear quartiles ($P25$, $P75$), extreme tail percentiles ($P95$, $\text{Min}$, $\text{Max}$), interquartile ranges ($IQR$), tail skew ratios ($P90 / \text{Median}$), and timestamp-tie concurrency metrics—were previously missing from the frontend analytical views.

### Key Objectives Achieved in Step 4:
1. **Parametric Latency Distribution Extraction:** Extended [`src/lib/dataProcessing.ts`](file:///d:/Care%20Flow/src/lib/dataProcessing.ts) and [`src/types/index.ts`](file:///d:/Care%20Flow/src/types/index.ts) to compute continuous linear quantiles ($P25$, $P75$, $P95$, $\text{Min}$, $\text{Max}$) and concurrency diagnostics (`zeroDurationCount`, `zeroDurationPercentage`) across all empirical transitions and bottlenecks, matching canonical Phase 3 dataset schema.
2. **Intra-Variant Step Transition Breakdown:** Enhanced `extractProcessVariants()` to calculate step-by-step transition performance (`stepTransitions`) directly within each process variant, surfacing step-level median and $P90$ durations for every adjacent pair of activities along that specific pathway.
3. **Clinic & Department Stratification:** Activated clinic-level cohort filtering on [`src/pages/ProcessAnalysisPage.tsx`](file:///d:/Care%20Flow/src/pages/ProcessAnalysisPage.tsx) by adding a responsive Department selector to the unified filter bar, enabling seamless cross-departmental comparative analysis.
4. **Transition-Level Cohort Isolation:** Introduced `transitionKey` filtering in [`src/context/DatasetContext.tsx`](file:///d:/Care%20Flow/src/context/DatasetContext.tsx) and `applyGlobalFilters()`, allowing clinicians and analysts to filter the entire workspace down to patient cases traversing a specific `from → to` milestone.
5. **Interactive Bottleneck Detail Inspection Drawer:** Developed [`src/components/tables/BottleneckDetailDrawer.tsx`](file:///d:/Care%20Flow/src/components/tables/BottleneckDetailDrawer.tsx), providing deep analytical drill-downs accessible via:
   - Clicking SVG transition edges or metric badges in the Directly-Follows Graph ([`ProcessFlowGraph.tsx`](file:///d:/Care%20Flow/src/components/charts/ProcessFlowGraph.tsx)).
   - Clicking individual bars in the Bottleneck Chart ([`BottleneckChart.tsx`](file:///d:/Care%20Flow/src/components/charts/BottleneckChart.tsx)).
   - Clicking transition rows in the Bottleneck Analysis Table.
   - Clicking intra-variant step transition badges in the Process Variants section.
6. **Comprehensive Automated Testing & Validation:** Extended [`scratch/run_qa_tests.ts`](file:///d:/Care%20Flow/scratch/run_qa_tests.ts) with **Test Suite 8** (25 new assertions across 6 modules), bringing the total QA suite to **143 tests (100% pass rate)**. Completed full verification with `npm run build`, `npm run lint` (`oxlint`), `git diff --check`, and the independent Python regression validator (`scripts/process_mining/independent_validation_step7.py`).

---

## 2. Codebase Audit & Gap Analysis

An audit of the Phase 3 process mining artifacts (`transition_performance_detailed.csv`, `candidate_bottlenecks.csv`) against the Phase 4 Step 3 frontend implementation revealed the following architectural gaps:

| Feature Dimension | Phase 3 Canonical Analytical Evidence | Pre-Step 4 Frontend State | Phase 4 Step 4 Implementation |
| :--- | :--- | :--- | :--- |
| **Quantile Distribution** | Evaluated 5-number summaries plus tails: $\text{Min}$, $P25$, $\text{Median}$, $P75$, $P90$, $P95$, $\text{Max}$, $IQR$. | Only computed `median`, `mean`, and `p90`. $P25$, $P75$, $P95$, $\text{Min}$, and $\text{Max}$ were absent. | Full parametric quantile extraction computed via continuous linear interpolation (`method='linear'`). |
| **Concurrency / Timestamp Ties** | Quantified simultaneous event transitions: `zero_duration_count` and `zero_duration_pct` across all 44 transitions. | Ignored zero-duration events; no concurrency diagnostics exposed in UI. | Transition extraction records `zeroDurationCount` and `zeroDurationPercentage`; surfaced in detail drawer. |
| **Intra-Variant Step Timing** | Identified delays specific to variant routes (e.g. Variant 2 vs. Variant 4 laboratory latencies). | Process variants showed total case duration only; no intermediate step metrics. | Computed `variant.stepTransitions` providing step-by-step median and $P90$ breakdown with drilldown links. |
| **Clinic / Department Filtering** | Filtered events by department; audited departmental handoffs. | `department` field existed in `GlobalFilterState`, but was omitted from the filter bar UI. | Added Clinic/Department dropdown to Section A filter grid with active chip dismissal. |
| **Transition Cohort Isolation** | Filtered cohorts by specific transition traversal. | Cohort could only be filtered by Activity presence, Variant key, or Date Range. | Added `transitionKey` filter supporting one-click transition cohort isolation across all views. |
| **Bottleneck Inspection** | Detailed diagnostic cards with narrative clinical context. | Bottleneck table rows were static text; no slide-over drawer existed. | Interactive slide-over `BottleneckDetailDrawer` with 5-number distribution grid, concurrency card, and case drill-down. |

---

## 3. Mathematical Foundations & Quantile Methodology

To maintain 100% numerical parity with Phase 3 process mining and standard statistical packages (NumPy, PM4Py, SciPy), continuous linear interpolation is employed for all percentiles.

### 3.1 Linear Interpolation Formula
For a sorted array of $N$ transition durations $X = [x_0, x_1, \dots, x_{N-1}]$ and percentile $p \in [0, 100]$:
$$r = \frac{p}{100} \times (N - 1)$$
Let $i = \lfloor r \rfloor$ and $f = r - i$:
$$Q(p) = x_i + f \times (x_{i+1} - x_i)$$

This formula is uniformly implemented in `calculatePercentile()` and verified against NumPy's default `method='linear'` in Test Suite 0 and Test Suite 8.

### 3.2 Monotonic Quantile Hierarchy
For every valid transition with $N \ge 1$, the strict ordering invariant holds:
$$\text{Min} \le P25 \le \text{Median} \le P75 \le P90 \le P95 \le \text{Max}$$

### 3.3 Analytical Dispersion & Tail Metrics
- **Interquartile Range ($IQR$):**
  $$IQR = P75 - P25$$
  Quantifies the central operational spread unaffected by outliers.
- **Tail Skew Ratio:**
  $$\text{Tail Skew} = \frac{P90}{\text{Median}}$$
  Identifies extreme bimodal or right-skewed operational delays where 90th-percentile cases experience disproportionate latency relative to median workflow times.
- **Concurrency Rate:**
  $$\text{Zero-Duration Rate} = \frac{\text{Count}(\Delta t = 0)}{N} \times 100\%$$
  Diagnoses simultaneous co-occurring events and batch timestamp recording.

---

## 4. Architectural & Component Implementation

### 4.1 Type Definitions ([`src/types/index.ts`](file:///d:/Care%20Flow/src/types/index.ts))
Extended core domain models to support detailed distribution statistics and intra-variant steps:

```typescript
export interface ProcessVariantStep {
  from: string;
  to: string;
  medianElapsedMinutes: number;
  p90ElapsedMinutes: number;
}

export interface ProcessVariant {
  // Existing fields preserved...
  stepTransitions?: ProcessVariantStep[];
}

export interface ActivityTransition {
  // Existing fields preserved...
  p25ElapsedMinutes?: number;
  p75ElapsedMinutes?: number;
  p95ElapsedMinutes?: number;
  minElapsedMinutes?: number;
  maxElapsedMinutes?: number;
  zeroDurationCount?: number;
  zeroDurationPercentage?: number;
}

export interface BottleneckItem {
  // Existing fields preserved...
  p25ElapsedMinutes?: number;
  p75ElapsedMinutes?: number;
  p95ElapsedMinutes?: number;
  minElapsedMinutes?: number;
  maxElapsedMinutes?: number;
  zeroDurationCount?: number;
  zeroDurationPercentage?: number;
}

export interface GlobalFilterState {
  caseIdSearch: string;
  activity: string;
  variantKey: string;
  department: string;
  datePreset: 'all' | '7d' | '30d' | '90d';
  transitionKey?: string; // e.g. "Laboratory Start → Laboratory End"
}
```

### 4.2 Data Processing Enhancements ([`src/lib/dataProcessing.ts`](file:///d:/Care%20Flow/src/lib/dataProcessing.ts))
- **`extractProcessVariants(cases)`**: Iterates over each variant's activity sequence $S = [a_0, a_1, \dots, a_{k-1}]$, collecting elapsed intervals between $a_s$ and $a_{s+1}$ across all traversing cases, and computes intra-variant step medians and $P90$ latencies.
- **`extractTransitions(cases)`**: Computes $P25$, $P75$, $P95$, $\text{Min}$, $\text{Max}$, `zeroDurationCount`, and `zeroDurationPercentage` for every observed transition edge.
- **`extractBottlenecks(transitions, activityMetrics)`**: Forwards all parametric quantile and concurrency metrics into ranked `BottleneckItem` objects.
- **`applyGlobalFilters(cases, filters)`**: Supports filtering by `filters.transitionKey` (matching cases containing the consecutive activity transition) and robust department matching across cases and event records.

### 4.3 Bottleneck Detail Inspection Drawer ([`src/components/tables/BottleneckDetailDrawer.tsx`](file:///d:/Care%20Flow/src/components/tables/BottleneckDetailDrawer.tsx))
A slide-over drawer accessible across all analytical views:
- **Header:** Displays transition direction (`from → to`), severity badge (`High`, `Moderate`, `Nominal`), valid observations, distinct patient cases, cohort coverage %, and tail skew ratio.
- **Parametric Distribution Grid:** 8-metric statistical summary displaying Min, P25, Median (P50), Mean, P75, P90, P95, and Max alongside the Interquartile Range ($IQR$).
- **Concurrency & Timestamp-Tie Card:** Reports the frequency and percentage of simultaneous events ($\Delta t = 0$), identifying batch recording or synchronized clinical actions.
- **Operational & Clinical Context Card:** Explains the pathway milestone with automated clinical guidance.
- **Cohort Filter Action:** Includes an *"Isolate Transition Cohort"* button that sets `transitionKey` on the global filter bar, instantly focusing the entire dashboard on traversing cases.
- **Traversing Patient Cases Drilldown:** Tabulates individual patient cases traversing this step with exact elapsed times, start timestamps, and direct click-to-open integration with `CaseDetailDrawer`.

### 4.4 Page & Visualization Integration ([`src/pages/ProcessAnalysisPage.tsx`](file:///d:/Care%20Flow/src/pages/ProcessAnalysisPage.tsx))
- **Section A (Unified Filter Bar):** Expanded to 5 columns (`lg:grid-cols-5`) to include the Clinic/Department selector with active filter chip dismissal. Added transition filter chip with one-click clear button.
- **Section B (Observed Process Flow):** Connected `onSelectTransition` prop to `<ProcessFlowGraph>`, enabling users to click any DFG edge or latency badge to open the `BottleneckDetailDrawer`.
- **Section C (Process Variants):** Rendered interactive step transition badges (`variant.stepTransitions`) under each variant card, displaying intermediate median and $P90$ times with click-to-inspect links.
- **Section D (Bottleneck Analysis):** Connected `onSelectBottleneck` prop to `<BottleneckChart>` for bar clicks, made table rows clickable with hover styling, and added an *"Inspect →"* button on every row.
- **Page Root:** Rendered `<BottleneckDetailDrawer>` adjacent to `<CaseDetailDrawer>`, ensuring seamless two-tier inspection without unwanted page routing.

---

## 5. Verification & Test Evidence

### 5.1 Automated QA Test Suite Results (`scratch/run_qa_tests.ts`)
The QA test suite was extended with **Test Suite 8: Variant Filtering & Bottleneck Detail Inspection**, adding 25 focused assertions across 6 modules:

```text
=== CareFlow QA Automated Test Suite ===

--- Test Suite 0: Linear Quantile Mathematical Parity --- (5 tests)
--- Test Suite 1: Demo Data Presets & Calculations --- (12 tests)
--- Test Suite 2: Process Transitions & Bottlenecks --- (8 tests)
--- Test Suite 3: Filters, Search & Empty States --- (7 tests)
--- Test Suite 4: CSV Export Formatting --- (4 tests)
--- Test Suite 5: Test Fixtures & Upload Validation --- (11 tests)
--- Test Suite 6: DFG Transitions & P90 Tail Latency --- (20 tests)
--- Test Suite 7: CareFlow Outpatient Pathway Preset --- (50 tests)

--- Test Suite 8: Variant Filtering & Bottleneck Detail Inspection ---
[PASS] All outpatient transitions have min and max elapsed minutes
[PASS] All outpatient transitions have P25 and P75 elapsed minutes
[PASS] All outpatient transitions have P95 elapsed minutes
[PASS] Full parametric quantile hierarchy holds across all transitions: Min <= P25 <= Median <= P75 <= P90 <= P95 <= Max
[PASS] Concurrency zeroDuration metrics valid and normalized [0, 100]%
[PASS] All 8 bottleneck items retain forwarded parametric quantiles and concurrency fields
[PASS] Top bottleneck is Laboratory Start -> Laboratory End
[PASS] Top bottleneck min <= median
[PASS] Top bottleneck P90 <= P95
[PASS] Top bottleneck P95 <= Max
[PASS] All variants contain stepTransitions array
[PASS] Each variant stepTransitions count exactly equals activities length minus 1
[PASS] Variant #2 found
[PASS] Variant #2 has exactly 3 step transitions (actual: 3)
[PASS] Step 1: Appointment Start -> Prescription Order
[PASS] Step 2: Prescription Order -> Laboratory Start
[PASS] Step 3: Laboratory Start -> Laboratory End
[PASS] All intra-variant step transitions satisfy P90 >= Median
[PASS] Transition filter isolates exactly 300 cases traversing Laboratory Start → Laboratory End (actual: 300)
[PASS] Every isolated case in cohort verified to contain Laboratory Start -> Laboratory End transition
[PASS] Transition filter isolates exactly 210 cases traversing Imaging Start → Imaging End (actual: 210)
[PASS] Sepsis preset transitions satisfy Min <= Median <= Max
[PASS] Sepsis preset transitions report non-negative zeroDurationCount
[PASS] Simultaneous fixture detects exactly 2 zero-duration occurrences
[PASS] Simultaneous fixture reports 100% zero-duration rate

========================================
Test Execution Finished: 143 Passed, 0 Failed
========================================
```

### 5.2 Build & Code Quality Validation
- **TypeScript & Vite Compilation (`npm run build`):**
  - Command: `tsc -b && vite build`
  - Result: Transformed 1,939 modules in 621ms with **0 errors**.
  - Production bundle generated cleanly: `dist/assets/index-DkMErlQ0.js` (601.89 kB) and `dist/assets/index-BIaNTkDB.css` (44.88 kB).
- **Linter Execution (`npm run lint`):**
  - Command: `oxlint`
  - Result: **0 warnings, 0 errors** across 29 project files with 116 rules in 41ms.
- **Git Formatting & Whitespace (`git diff --check`):**
  - Result: **0 whitespace errors**, 0 conflict markers, clean line endings.

### 5.3 Independent Phase 3 Regression Validator (`scripts/process_mining/independent_validation_step7.py`)
Executed independent Python validation against canonical datasets:
```text
CareFlow: Independent Validation & Findings Audit (Phase 3 Step 7)
[Pre-Execution] Verifying SHA-256 hashes of immutable datasets...
      careflow_source.csv: 07d0096b6e3fcff7... (Verified match)
      cleaned_source.csv:  674212c0e4b97d64... (Verified match)
      event_log.csv:       cdab7bbc0e6755cb... (Verified match)

[1/5] Ingesting event log: 142,876 events across 49,912 cases in 8 categories.
[2/5] Independently auditing Step 6 aggregate CSV files...
      case_duration_summary.csv: 100% exact numerical match with raw event log!
      transition_performance_detailed.csv: 100% exact numerical match across all 44 transitions!
      activity_pairing_summary.csv: 100% exact numerical match across all pairing categories!
      candidate_bottlenecks.csv: 100% verified (31 candidates ranked).
[3/5] Auditing the four primary bottlenecks and narrative report text...
[4/5] Evaluating potential discrepancies, documentation integrity, and narrative regression checks...
      ✓ Event data P90 values match expected baseline (4/4 verified).
      ✓ Narrative P90 values match event data across all sections (9/9 verified).
      ✓ Table 7.1 P90 values match event data (4/4 verified).
      ✓ Zero documentation discrepancies detected. Regression check PASSED.
[Post-Execution] Verifying SHA-256 hashes of immutable datasets...
      All hashes verified. Validation completed in 2.11 seconds.
```

---

## 6. Acceptance Criteria Verification

| Requirement # | Proposed Acceptance Criterion | Verification Method | Status | Evidence / Test ID |
| :---: | :--- | :--- | :---: | :--- |
| **AC-1** | Compute continuous linear quantiles ($P25$, $P75$, $P95$, $\text{Min}$, $\text{Max}$) and concurrency metrics for all transitions. | Unit assertions in Test Suite 8 verifying $\text{Min} \le P25 \le \text{Median} \le P75 \le P90 \le P95 \le \text{Max}$. | **PASSED** | `scratch/run_qa_tests.ts` lines 448–466 |
| **AC-2** | Compute intra-variant step-by-step transition performance (`stepTransitions`) for each process variant. | Unit assertions verifying step transition count equals variant activities length $- 1$ and $P90 \ge \text{Median}$. | **PASSED** | `scratch/run_qa_tests.ts` lines 498–516 |
| **AC-3** | Support clinic / department cohort filtering on Process Analysis view. | Filter bar dropdown rendered; department filter isolates 1,000 Outpatient Consultation cases. | **PASSED** | `src/pages/ProcessAnalysisPage.tsx` lines 217–233; QA test Suite 7 |
| **AC-4** | Support transition-level cohort isolation (`transitionKey`). | Filter isolates exactly 300 cases for `Laboratory Start → Laboratory End` and 210 cases for `Imaging Start → Imaging End`. | **PASSED** | `scratch/run_qa_tests.ts` lines 520–548 |
| **AC-5** | Provide interactive slide-over `BottleneckDetailDrawer` accessible from DFG edges, chart bars, variant steps, and table rows. | Component integrated with Escape/backdrop handling, distribution grid, concurrency diagnostics, and case list. | **PASSED** | `src/components/tables/BottleneckDetailDrawer.tsx` |
| **AC-6** | Maintain 100% pass rate across all automated QA tests without breaking Steps 1–3. | Run `npx tsx scratch/run_qa_tests.ts` executing Suites 0 through 8. | **PASSED** | **143 Passed, 0 Failed** |
| **AC-7** | Pass production build and lint checks without warnings or type errors. | Run `npm run build` and `npm run lint`. | **PASSED** | 0 build errors, 0 lint warnings |
| **AC-8** | Preserve canonical Phase 3 dataset integrity and numerical parity. | Run `independent_validation_step7.py` checking SHA-256 hashes and 44 transitions. | **PASSED** | 100% exact numerical match, SHA-256 verified |

---

## 7. Preserved Files & Git Status Summary

No previous commits were modified or rebased. All work remains strictly local and uncommitted as instructed:

- **Modified Files:**
  - `src/types/index.ts`
  - `src/lib/dataProcessing.ts`
  - `src/context/DatasetContext.tsx`
  - `src/components/charts/BottleneckChart.tsx`
  - `src/components/charts/ProcessFlowGraph.tsx`
  - `src/pages/ProcessAnalysisPage.tsx`
  - `scratch/run_qa_tests.ts`
- **Untracked Deliverable Files:**
  - `src/components/tables/BottleneckDetailDrawer.tsx`
  - `reports/variant_bottleneck_inspection.md`
- **Commit History & Remotes:** Clean on `main`, pointing to latest commit `ca2347d`. Ready for review.
