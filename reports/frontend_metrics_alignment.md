# CareFlow — Phase 4, Step 1: Frontend Process Mining Metrics Alignment & P90 Bottleneck Integration Report

> [!IMPORTANT]
> **Project Context & Academic Research Disclosure:**
> This study is part of the CareFlow clinical pathway analytics research program. All underlying electronic health record data is synthetic, generated for academic benchmarking. No real patient data is utilized. Strict privacy safeguards ensure all analytical outputs and reports remain strictly aggregate-level with zero case or patient identifiers.

---

## 1. Executive Summary & Deliverable Objective

Following the certified completion and regression hardening of the Phase 3 Process Mining diagnostic pipeline (`reports/final_consistency_audit.md` and `reports/regression_hardening.md`), this deliverable marks the initial operational milestone of **Phase 4: CareFlow Clinical Pathway Process Mining Frontend & Dashboard Visualization**.

The primary objective of Phase 4 Step 1 was to **bridge the analytical gap between Phase 3 empirical discoveries and the Phase 4 interactive web interface**. Specifically, Phase 3 demonstrated that standard median metrics conceal critical operational delays due to heavy right-skewed tails in healthcare workflows. Prior to this step, the frontend prototype computed latency exclusively via median elapsed minutes and utilized naive nearest-rank percentile calculations that diverged mathematically from PM4Py and NumPy standards.

This step achieves:
1. **Mathematical Parity with PM4Py / NumPy:** Implemented linear quantile interpolation matching PM4Py / NumPy `method='linear'` in client-side TypeScript calculations (`src/lib/dataProcessing.ts`).
2. **Type System Integration:** Expanded `BottleneckItem` in `src/types/index.ts` to mandate `p90ElapsedMinutes: number`.
3. **Bottleneck Extraction Hardening:** Updated `extractBottlenecks()` to propagate P90 elapsed durations and integrate tail latency into severity tiering.
4. **Interactive Multi-Metric Visualization:** Enhanced `BottleneckChart.tsx` with a multi-metric display mode (`Both (Median vs P90)`, `Median Only`, `P90 Tail Only`), grouped bar rendering, and rich dual-metric hover tooltips.
5. **Tabular P90 Reporting:** Added a dedicated `P90 (90th Percentile)` latency column to the Bottleneck Analysis table on `ProcessAnalysisPage.tsx`.
6. **Automated Quality Assurance:** Expanded the automated test suite (`scratch/run_qa_tests.ts`) with dedicated mathematical parity unit tests and transition/bottleneck P90 assertions (48 passed, 0 failed).

---

## 2. Mathematical Parity Implementation: Linear Quantile Interpolation

### 2.1 The Discrepancy Context
In Phase 3 Step 8 (`reports/discrepancy_resolution.md`), an exhaustive mathematical audit of percentiles proved that the canonical Python pipeline evaluates transition latency using continuous linear interpolation:

$$Q(p) = x_{\lfloor i \rfloor} + (i - \lfloor i \rfloor)(x_{\lceil i \rceil} - x_{\lfloor i \rfloor})$$

where:
$$i = \frac{p}{100} \cdot (N - 1)$$

Prior to this update, `src/lib/dataProcessing.ts` utilized discrete index truncation:
$$\text{index} = \min\left(\left\lfloor \frac{p}{100} \cdot N \right\rfloor, N - 1\right)$$

This integer floor indexing yielded step discrepancies when compared against Python outputs (for example, reporting 104.0 or 108.0 min instead of the verified 108.2 min for `Prescription Order -> Imaging Start`).

### 2.2 TypeScript Algorithm Implementation
In `src/lib/dataProcessing.ts`, `calculatePercentile` was hardened with exact linear interpolation:

```typescript
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
```

### 2.3 Empirical Verification Across Test Arrays

| Test Input Array | Metric | Python / NumPy Result | TypeScript Frontend Result | Parity Verification |
| :--- | :---: | :---: | :---: | :---: |
| `[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]` | P90 | `91.0` | `91.0` | **Exact Match** |
| `[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]` | P50 (Median) | `55.0` | `55.0` | **Exact Match** |
| `[100, 200]` | P90 | `190.0` | `190.0` | **Exact Match** |
| `[42]` (Single item) | P90 | `42.0` | `42.0` | **Exact Match** |
| `[]` (Empty array) | P90 | `0.0` | `0.0` | **Exact Match (Safe)** |

---

## 3. Component & Architecture Enhancements

### 3.1 Type Definitions (`src/types/index.ts`)
The `BottleneckItem` interface was updated to include the mandatory P90 field:

```typescript
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
  p90ElapsedMinutes: number; // MANDATORY: Propagated from ActivityTransition
  severity: 'high' | 'moderate' | 'nominal';
  explanation: string;
}
```

### 3.2 Analytical Engine (`src/lib/dataProcessing.ts`)
1. **Transition Extraction:** Ensured `p90ElapsedMinutes` in `ActivityTransition` is rounded to 1 decimal place (`Math.round(val * 10) / 10`).
2. **Bottleneck Extraction:**
   - Propagated `p90ElapsedMinutes: tr.p90ElapsedMinutes` into each generated `BottleneckItem`.
   - Updated severity tiering logic to account for tail latency:
     - `high`: Median $\ge 60$ min OR P90 $\ge 120$ min.
     - `moderate`: Median $\ge 30$ min OR P90 $\ge 60$ min.
     - `nominal`: Below moderate threshold.

### 3.3 Visual Analytics (`src/components/charts/BottleneckChart.tsx`)
1. **Multi-Metric Selection:** Added interactive pill buttons (`Both (Median vs P90)`, `Median Only`, `P90 Tail Only`).
2. **Grouped Bar Rendering:** When in `both` mode, renders paired horizontal bars per transition:
   - Median bar in Sky Blue (`#0284c7`).
   - P90 bar in Rose (`#e11d48`).
3. **Enhanced Tooltips:** Displays both Median and P90 elapsed durations alongside case counts and observation frequencies in tooltip bodies and footers.

### 3.4 Page Integration (`src/pages/ProcessAnalysisPage.tsx`)
1. **P90 Column in Table:** Added a prominent `P90 (90th Percentile)` column formatted via `formatDurationMinutes(b.p90ElapsedMinutes)` with exact minute tooltips.
2. **Latency Tier Badging:** Updated badge labels to reflect tail latency boundaries (`High Latency (> 60m / P90 > 120m)`).

---

## 4. Verification & Quality Assurance Results

### 4.1 Automated QA Test Suite (`scratch/run_qa_tests.ts`)
Execution command:
```bash
npx --no-install tsx scratch/run_qa_tests.ts
```
**Results:**
- **Test Suite 0 (Mathematical Parity):** 5/5 PASSED.
- **Test Suite 1 (Demo Presets & KPIs):** 12/12 PASSED.
- **Test Suite 2 (Transitions & P90 Bottlenecks):** 7/7 PASSED.
  - Verified `transitions.every(t => t.p90ElapsedMinutes >= t.medianElapsedMinutes)`.
  - Verified `bottlenecks.every(b => typeof b.p90ElapsedMinutes === 'number' && b.p90ElapsedMinutes >= 0)`.
  - Verified `bottlenecks.every(b => b.p90ElapsedMinutes >= b.medianElapsedMinutes)`.
- **Test Suite 3 (Filters & Search):** 7/7 PASSED.
- **Test Suite 4 (CSV Export):** 4/4 PASSED.
- **Test Suite 5 (Fixtures & Upload):** 13/13 PASSED.
- **Total:** **48 Passed, 0 Failed**.

### 4.2 Production Build Verification (`npm run build`)
Command:
```bash
npm run build
```
- TypeScript check (`tsc -b`): **Zero errors**.
- Vite build: Bundle generated in 435ms (`dist/assets/index-BBHl2yzL.js`).

### 4.3 Oxlint Code Quality Audit (`npm run lint`)
Command:
```bash
npm run lint
```
- Scanned 28 source files across 116 linting rules.
- **Result:** **0 warnings, 0 errors**.

### 4.4 Phase 3 Regression Hardening Re-Verification
Commands:
```bash
.venv\Scripts\python.exe scripts/process_mining/independent_validation_step7.py
.venv\Scripts\python.exe scripts/process_mining/discrepancy_resolution_step8.py
```
- **Step 7 Audit:** All 4 candidate bottlenecks validated against narrative text and Table 7.1; zero discrepancies; exit code `0`.
- **Step 8 Regression Suite:** All 5 mathematical regression assertions and privacy compliance checks passed; exit code `0`.
- **Historical Deliverables:** `reports/independent_validation.md` preserved unaltered.

### 4.5 Formatting & Trailing Whitespace (`git diff --check`)
Command:
```bash
git diff --check
```
- **Result:** **Zero whitespace errors or invalid line endings**.

### 4.6 Cryptographic Dataset Immutability Verification
All SHA-256 hashes verified bit-for-bit identical to canonical baselines:
- `data/raw/careflow_source.csv`: `07d0096b6e3fcff78f94afa6d5aeffeeb2566f59902eccc03da209a3b6502720` (100% Match)
- `data/processed/cleaned_source.csv`: `674212c0e4b97d64045e53f2908418c1f229f8e15dd7da801a99436584e614f3` (100% Match)
- `data/processed/event_log.csv`: `cdab7bbc0e6755cb927a2a627bff2108e48d94ce0e38f62354ed72dcfb63442d` (100% Match)

---

## 5. Scope & Continuity Across the 8-Phase Roadmap

The CareFlow 8-Phase Roadmap remains completely intact and continuous:
- **Phase 1:** UI Prototyping & Architecture Foundation (Completed)
- **Phase 2:** Healthcare Data Profiling, Cleaning & Event Log Engineering (Completed)
- **Phase 3:** Exploratory Discovery, Conformance & Bottleneck Diagnostics (Completed & Regression Hardened)
- **Phase 4:** Process Mining Frontend & Dashboard Visualization (**Active — Step 1 Delivered**)
- **Phase 5:** Conformance Checking & Alignment Dashboard / Compliance Tracking (Planned)
- **Phase 6:** Operational Bottleneck Intervention & What-If Simulation (Planned)
- **Phase 7:** Enterprise Backend Service (FastAPI) & Data Pipeline Integration (Planned)
- **Phase 8:** Clinical Validation, Deployment & Governance (Planned)

---

## 6. Summary of Changed Files

| File Path | Nature of Change | Purpose |
| :--- | :--- | :--- |
| `src/types/index.ts` | Modified | Added `p90ElapsedMinutes: number` to `BottleneckItem`. |
| `src/lib/dataProcessing.ts` | Modified | Implemented PM4Py linear quantile interpolation and P90 bottleneck propagation. |
| `src/components/charts/BottleneckChart.tsx` | Modified | Added metric mode toggle (`Both`, `Median`, `P90`) and grouped bar visualization. |
| `src/pages/ProcessAnalysisPage.tsx` | Modified | Added `P90 (90th Percentile)` column to Bottleneck table. |
| `scratch/run_qa_tests.ts` | Modified | Added Test Suite 0 (mathematical parity) and P90 bottleneck assertions (48 tests). |
| `reports/frontend_metrics_alignment.md` | Created | Deliverable documentation and audit report for Phase 4 Step 1. |

*Preserved Step 10 uncommitted files:*
- `scripts/process_mining/independent_validation_step7.py` (Intact & Passing)
- `reports/regression_hardening.md` (Intact)
