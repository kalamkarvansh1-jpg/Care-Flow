# CareFlow — Phase 3, Step 2: Clinical Pathway Variant Stratification & Performance Benchmarking Report

**Document Title:** Clinical Pathway Variant Stratification & Performance Benchmarking
**Input Event Log:** `data/processed/event_log.csv`
**Derived Outputs:**
- [`data/processed/pathway_summary.csv`](file:///d:/Care%20Flow/data/processed/pathway_summary.csv)
- [`data/processed/variants_by_pathway.csv`](file:///d:/Care%20Flow/data/processed/variants_by_pathway.csv)
- [`data/processed/transition_performance_by_pathway.csv`](file:///d:/Care%20Flow/data/processed/transition_performance_by_pathway.csv)
**Execution Context:** Senior Python Process-Mining Engineer & Healthcare Data Analyst
**Date of Execution:** October 17, 2026
**Status:** Completed & Empirically Reconciled

> [!NOTE]
> **Synthetic Project Data Notice:** All analyzed records, timestamps, workflow classifications, and activity sequences derive from a synthetic electronic health record (EHR) project dataset. All observed timestamp intervals represent synthetic logging artifacts and parametric generation models. They must **not** be interpreted as validated clinical waiting times, verified operational delays, or real medical care benchmarks.

---

## 1. Input Validation & Reconciliation Audit

### 1.1 Baseline Target Re-Verification
The validated event log [`data/processed/event_log.csv`](file:///d:/Care%20Flow/data/processed/event_log.csv) was independently verified:
- **Total Validated Cases:** 49,912 (Target Baseline: 49,912 → **100% Match**)
- **Total Validated Events:** 142,876 (Target Baseline: 142,876 → **100% Match**)
- **Globally Distinct Observed Variants:** 546 (Target Baseline: 546 → **100% Match**)
- **Required Attribute Completeness:** `case_id`, `activity`, `timestamp`, and `stage` contain **0 null values** across all 142,876 events.

### 1.2 Reconciliation of Trace Length 2 Cases (39,191 vs. 39,187)
In baseline discovery, an apparent divergence was noted between cases with trace length = 2 (39,191 cases) and Variant 1 (`Appointment Start` → `Prescription Order`, 39,187 cases).

An independent audit of all 39,191 length-2 cases establishes an exact reconciliation:

| Activity Sequence | Case Count | % of Length 2 Cases | Data-Quality Observation |
| :--- | :---: | :---: | :--- |
| **`Appointment Start` → `Prescription Order`** | **39,187** | **99.99%** | Chronological ordering where appointment check-in timestamp precedes prescription order timestamp. |
| **`Prescription Order` → `Appointment Start`** | **4** | **0.01%** | Inverted timestamp sequence in synthetic records where prescription timestamp was recorded earlier than appointment start timestamp. |
| **Total Length 2 Encounters** | **39,191** | **100.00%** | **Reconciled exactly ($39,187 + 4 = 39,191$).** |

*(Across the full event log, exactly 5 cases have prescription order timestamp earlier than appointment check-in: 4 have trace length 2, and 1 has trace length 4 with subsequent diagnostic imaging).*

---

## 2. Workflow-Category Distribution & Mapping

### 2.1 Mapping Mechanics from Source Dataset
The source dataset (`data/raw/careflow_source.csv`) contains `flow_name` classifying clinical stages. Joining `flow_name` to `appointment_id` revealed:
- **Unambiguous Source Mappings:** **48,681 appointments (97.53%)** have exactly one consistent `flow_name` across all source rows.
- **Ambiguous Source Mappings:** **1,231 appointments (2.47%)** contain multiple distinct `flow_name` values across their rows.
  - *Data Mechanics:* The source export evaluated `flow_name` at the physical table row level rather than at the encounter level. For an encounter ordering 1 imaging study and multiple lab tests, Row 1 contained imaging and was labeled `Lab + Imaging`, while subsequent rows contained only lab orders and were labeled `Lab`.
  - *Governance Rule:* To prevent arbitrary assignment, these 1,231 encounters are explicitly isolated as **`Ambiguous Source Flow (Multi-Category Encounter)`** in the source stratification, and fully mapped in the clinical intervention view.
  - Every case maps unambiguously to exactly one category: unmapped cases = **0**.

### 2.2 Category Distribution Summary

| Workflow Category | Cases | % of Cases | Total Events | % of Events | Distinct Variants | Mean Length | Median Length | Max Length |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`Appointment → Prescription`** | 39,658 | 79.46% | 79,771 | 55.83% | 5 | 2.01 | 2.0 | 4 |
| **`Appointment → Prescription → Lab`** | 4,802 | 9.62% | 30,664 | 21.46% | 145 | 6.39 | 6.0 | 50 |
| **`Appointment → Prescription → Imaging`** | 3,783 | 7.58% | 15,330 | 10.73% | 31 | 4.05 | 4.0 | 7 |
| **`Ambiguous Source Flow (Multi-Category Encounter)`** | 1,231 | 2.47% | 14,480 | 10.13% | 317 | 11.76 | 10.0 | 56 |
| **`Appointment → Prescription → Lab + Imaging`** | 343 | 0.69% | 1,989 | 1.39% | 44 | 5.80 | 6.0 | 10 |
| **`Appointment → Prescription → Pharmacy`** | 93 | 0.19% | 631 | 0.44% | 9 | 6.78 | 6.0 | 14 |
| **`Appointment → Prescription → Imaging + Pharmacy`** | 1 | 0.00% | 6 | 0.00% | 1 | 6.00 | 6.0 | 6 |
| **`Appointment → Prescription → Lab + Pharmacy`** | 1 | 0.00% | 5 | 0.00% | 1 | 5.00 | 5.0 | 5 |

### 2.3 Reconciliation by Verified Clinical Interventions
When cases are categorized by actual verified events present in `event_log.csv`:
- `Appointment → Prescription`: **39,658 cases** (79.46%)
- `Appointment → Prescription → Lab`: **4,824 cases** (9.67%)
- `Appointment → Prescription → Imaging`: **3,790 cases** (7.59%)
- `Appointment → Prescription → Lab + Imaging`: **1,532 cases** (3.07%)
- `Appointment → Prescription → Pharmacy`: **93 cases** (0.19%)
- `Appointment → Prescription → Lab + Pharmacy`: **14 cases** (0.03%)
- `Appointment → Prescription → Imaging + Pharmacy`: **1 cases** (0.00%)
- **Total:** **49,912 cases (100.00% reconciled)**.

---

## 3. Variant Distribution by Category & Mathematical Reconciliation

### 3.1 Reconciliation of Global vs. Stratified Variant Counts
A rigorous mathematical audit establishes complete agreement across files, summary counts, and definitions:
- **Globally Distinct Activity Sequences:** **546 unique variants** exist across all 49,912 cases in `event_log.csv`.
- **Category-Level Pathway-Variant Pairs:** **553 pairs** exist across the 8 workflow categories, exactly matching the sum of `distinct_variants` column in `pathway_summary.csv` (553).
- **Output File Structure:** [`data/processed/variants_by_pathway.csv`](file:///d:/Care%20Flow/data/processed/variants_by_pathway.csv) contains **553 data records**, verified by standard CSV parsing (`pd.read_csv`).
- **Cross-Category Variant Overlap:** Exactly **7 activity sequences** appear in two distinct workflow categories (539 sequence variants appear in exactly 1 category, while 7 appear in 2 categories):
  - 539 + (7 * 2) = 553 category-variant records.
  - 539 + 7 = 546 globally distinct variants.

#### Specific Overlapping Variants (7 sequences):
1. 4 sequences overlap between `Ambiguous Source Flow (Multi-Category Encounter)` and `Appointment → Prescription → Imaging`:
   - `Appointment Start -> Imaging Start -> Imaging End -> Prescription Order -> Prescription Order` (1 ambiguous case, 10 imaging cases)
   - `Appointment Start -> Prescription Order -> Imaging Start -> Imaging End -> Prescription Order` (4 ambiguous cases, 24 imaging cases)
   - `Appointment Start -> Prescription Order -> Prescription Order -> Imaging Start -> Imaging End` (2 ambiguous cases, 27 imaging cases)
2. 3 sequences overlap between `Ambiguous Source Flow (Multi-Category Encounter)` and `Appointment → Prescription → Lab`:
   - `Appointment Start -> Prescription Order -> Laboratory Start -> Laboratory End -> Prescription Order` (2 ambiguous cases, 1 lab case)
   - `Appointment Start -> Prescription Order -> Laboratory Start -> Prescription Order` (2 ambiguous cases, 1 lab case)
   - `Appointment Start -> Prescription Order -> Prescription Order -> Laboratory Start -> Laboratory End` (1 ambiguous case, 11 lab cases)
   - `Appointment Start -> Prescription Order -> Prescription Order -> Laboratory Start -> Laboratory Start -> Laboratory End -> Laboratory End` (1 ambiguous case, 7 lab cases)

*Cause of Overlap:* Encounters assigned to `Ambiguous Source Flow` contain multiple disparate `flow_name` labels in the raw CSV, but their realized event sequence matched a sequence also found in a single-discipline pathway.

---

## 4. Transition Frequency and Timing Comparisons

### 4.1 Metric Definitions & Denominators
To prevent confounding volume and lead time:
- **`transition_count`:** Total observed instances of the consecutive pair (A -> B) within the pathway.
- **`distinct_cases`:** Unique cases in the pathway containing at least one occurrence of the transition.
- **`case_percentage_within_pathway`:** Proportion of pathway cases exhibiting the transition (distinct_cases / pathway_case_count * 100).
- **`zero_duration_count`:** Count of transitions where elapsed interval is 0 minutes.
- **`zero_duration_percentage`:** Proportion of transitions that are instantaneous (zero_duration_count / transition_count * 100).
- **`tied_timestamp_count`:** Count of adjacent events with identical timestamp (t2 == t1). Under the deterministic chronological sort, this is mathematically identical to `zero_duration_count`.
- **`p90_minutes`:** 90th percentile of valid non-negative elapsed durations (calculated via `quantile(0.90)` on eligible non-negative observations).

### 4.2 Pathway Transition Performance Benchmarks

| Workflow Category | Source Activity | Destination Activity | Transitions | Cases | Case % | Median (min) | Mean (min) | P90 (min) | Zero-Duration % |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`Appointment → Prescription`** | `Appointment Start` | `Prescription Order` | 39,643 | 39,643 | 100.0% | **26.0** | 147.8 | 93.0 | 0.08% |
| **`Appointment → Prescription`** | `Prescription Order` | `Prescription Order` | 466 | 456 | 1.1% | **16.0** | 1169.6 | 1460.0 | 3.43% |
| **`Appointment → Prescription`** | `Prescription Order` | `Appointment Start` | 4 | 4 | 0.0% | **2135.5** | 2632.8 | 4842.4 | 0.00% |
| **`Appointment → Prescription → Imaging`** | `Imaging Start` | `Imaging End` | 3,764 | 3,736 | 98.8% | **3.0** | 71.9 | 9.0 | 10.36% |
| **`Appointment → Prescription → Imaging`** | `Appointment Start` | `Prescription Order` | 2,529 | 2,529 | 66.8% | **25.0** | 51.1 | 98.2 | 0.04% |
| **`Appointment → Prescription → Imaging`** | `Prescription Order` | `Imaging Start` | 2,316 | 2,316 | 61.2% | **37.0** | 472.1 | 128.0 | 0.30% |
| **`Appointment → Prescription → Imaging`** | `Imaging End` | `Prescription Order` | 1,249 | 1,249 | 33.0% | **21.0** | 30.1 | 64.0 | 0.00% |
| **`Appointment → Prescription → Imaging`** | `Appointment Start` | `Imaging Start` | 1,242 | 1,242 | 32.8% | **47.0** | 72.0 | 172.8 | 0.16% |
| **`Appointment → Prescription → Lab`** | `Laboratory Start` | `Laboratory Start` | 7,109 | 2,893 | 60.2% | **0.0** | 0.7 | 0.0 | 99.17% |
| **`Appointment → Prescription → Lab`** | `Laboratory End` | `Laboratory End` | 5,335 | 2,188 | 45.6% | **12.0** | 422.3 | 419.4 | 30.87% |
| **`Appointment → Prescription → Lab`** | `Appointment Start` | `Prescription Order` | 4,525 | 4,525 | 94.2% | **21.0** | 39.8 | 77.0 | 0.04% |
| **`Appointment → Prescription → Lab`** | `Prescription Order` | `Laboratory Start` | 4,463 | 4,462 | 92.9% | **19.0** | 33.9 | 66.0 | 0.09% |
| **`Appointment → Prescription → Lab`** | `Laboratory Start` | `Laboratory End` | 3,522 | 3,480 | 72.5% | **82.0** | 291.3 | 234.0 | 0.00% |

*Complete transition catalogue saved to:* [`data/processed/transition_performance_by_pathway.csv`](file:///d:/Care%20Flow/data/processed/transition_performance_by_pathway.csv)

---

## 5. Timestamp-Tie Sensitivity Results

### 5.1 Tie Proportions Across Categories
Deterministic sorting enforces reproducibility, but intra-minute ties must be distinguished from true sequential progression:

| Workflow Category | Total Transitions | Strictly Positive (Δt > 0) | Tied (Δt = 0) | Tied % | Dominant Tie Mechanism |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`Appointment → Prescription`** | 40,113 | 40,067 | 46 | **0.11%** | Consultation and prescription timestamp recorded in same minute |
| **`Appointment → Prescription → Lab`** | 25,862 | 17,155 | 8,707 | **33.67%** | Simultaneous multi-tube phlebotomy blood draws |
| **`Ambiguous Source Flow (Multi-Category Encounter)`** | 13,249 | 7,606 | 5,643 | **42.59%** | Multi-tube lab collection and co-occurring diagnostic orders |
| **`Appointment → Prescription → Imaging`** | 11,547 | 11,127 | 420 | **3.64%** | Rapid imaging procedure recorded within same minute |
| **`Appointment → Prescription → Lab + Imaging`** | 1,646 | 1,585 | 61 | **3.71%** | Multi-order diagnostic panel collection |
| **`Appointment → Prescription → Pharmacy`** | 538 | 240 | 298 | **55.39%** | Pharmacy dispensation logged in same minute as order |
| **`Appointment → Prescription → Imaging + Pharmacy`** | 5 | 5 | 0 | **0.00%** | Sequential orders across stages |
| **`Appointment → Prescription → Lab + Pharmacy`** | 4 | 4 | 0 | **0.00%** | Sequential orders across stages |

### 5.2 Critical Sensitivity Finding
- **Cross-Stage Transitions:** Transitions between distinct clinical phases (e.g. `Appointment Start` → `Prescription Order`, `Prescription Order` → `Laboratory Start`) have **<0.15% tied timestamps**. They overwhelmingly reflect positive elapsed intervals.
- **Intra-Stage Repetitions:** In laboratory pathways, **99.17%** of `Laboratory Start` → `Laboratory Start` transitions have dt = 0. When multiple blood tubes are collected during a single phlebotomy draw, synthetic timestamps are assigned identical values. Thus, deterministic stage sorting preserves reproducible event sequences without distorting cross-stage temporal analysis.

---

## 6. Potential Bottleneck Candidates & Skew Investigation

### 6.1 Investigation of `Laboratory Start` → `Laboratory End` Distribution
The interval between laboratory specimen collection and test completion represents the longest observed duration in the dataset. However, summary statistics reveal an extreme right skew rather than a uniform delay:
- **Observed Transitions:** 4,415 transitions across 4,363 distinct cases.
- **Median Elapsed Interval:** **81.0 minutes** (1.35 hours).
- **Mean Elapsed Interval:** **285.87 minutes** (4.76 hours).
- **Percentiles:**
  - 25th Percentile: 53.0 minutes
  - 50th Percentile (Median): 81.0 minutes
  - 75th Percentile: 130.0 minutes
  - 90th Percentile: 230.0 minutes (3.83 hours)
  - 95th Percentile: 524.7 minutes (8.75 hours)
  - 99th Percentile: 5892.3 minutes (98.20 hours)
  - Maximum: 22083.0 minutes (15.34 days)

#### Bimodal Interval Breakdown:
- **Rapid Assays (<= 2 hours):** **3,173 transitions (71.87%)** complete within 120 minutes.
- **Extended Processing (2 to 24 hours):** **1,083 transitions (24.53%)** span daytime processing.
- **Multi-Day Outliers (> 24 hours):** **159 transitions (3.60%)** extend up to 15 days, heavily inflating the arithmetic mean.

> [!WARNING]
> **Analytical Constraint:** Describing the laboratory turnaround time by mean alone (4.76 hours) obscures the fact that 71.9% of tests complete in under 2 hours. This interval is an **observed synthetic timestamp interval** and a **potential bottleneck candidate**, not a verified operational waiting time.

---

## 7. Laboratory Completion Reconciliations & Terminology Validation

### 7.1 Laboratory End Event Count Reconciliation (13,327 vs. 13,203)
The 124-record difference between raw parseable timestamps (13,327) and generated `Laboratory End` events (13,203) is fully reconciled across the transformation pipeline:

| Transformation Stage | Record Count | Difference | Technical & Data-Cleaning Mechanism |
| :--- | :---: | :---: | :--- |
| **Populated Raw `lab_end_datetime`** | 18,029 | Baseline | Total populated strings in raw `careflow_source.csv`. |
| **Malformed / Truncated Strings (`MM:SS.f`)** | 4,702 | -4,702 | Length-7 strings lacking calendar date and hour; excluded from valid parsing. |
| **Parseable Raw Timestamps (`%m/%d/%Y %H:%M`)** | 13,327 | = 13,327 | Valid date-time strings in raw source dataset. |
| **Duplicate Row Removal in Cleaning** | 13,323 | -4 | 4 exact duplicate rows across all business columns dropped during Phase 2 Step 2 cleaning. |
| **Event Log Extraction Deduplication** | 13,203 | -120 | `drop_duplicates(subset=['appointment_id', 'lab_id', 'timestamp'])` removes 120 redundant entries where denormalized joins created multiple identical lab end records for the same appointment and test. |
| **Final Generated `Laboratory End` Events** | **13,203** | **= 13,203** | **Fully reconciled: $13,327 - 4 - 120 = 13,203$ ($4 + 120 = 124$).** |

### 7.2 Net Laboratory Start–End Event-Count Gap
- `Laboratory Start` events: **17,848**
- `Laboratory End` events: **13,203**
- **Net Laboratory Start–End Event-Count Gap:** **4,645 events** ($17,848 - 13,203$).
- *Pairing Validation:* The pipeline cannot establish individual test matching solely from aggregate event subtraction. In the event log, 34 `(case_id, lab_id)` groups contain multiple start events (repeat draws or multi-panel draws under identical order keys), and sequential process-mining traces interleave starts and ends without explicit instance-token pairing. Therefore, this metric is strictly characterized as the **net event-count gap**, representing the net excess of initiation events over completed observation events, rather than an individually paired matching status.
- *Governance Decision:* In accordance with data integrity rules, truncated records were **not imputed**, leaving completion events strictly empirical.

---

## 8. Recommended Analytical Next Steps

1. **Pathway-Stratified Process Discovery (Phase 3 Step 3):** Mine independent Petri nets and transition models per workflow category rather than on the unstratified spaghetti log.
2. **Multi-Modal Duration Decomposition:** Fit parametric mixture models (e.g. log-normal mixture) to separate rapid automated assays from multi-day test incubations.
3. **Synthetic Generator Boundary Analysis:** Evaluate whether timestamp clustering around round-number intervals (e.g., 20, 30, 60 minutes) represents synthetic schedule discretization.

---

## 9. Safety & Compliance Verification

- **Automated Consistency Assertions:** All consistency checks passed without errors during script execution, including the exact 124-event Laboratory End reconciliation.
- **Cryptographic File Hash Verification:** SHA-256 hashes of `data/raw/careflow_source.csv`, `data/processed/cleaned_source.csv`, and `data/processed/event_log.csv` were verified identical pre- and post-execution.
- **Multi-File Privacy & Compliance Scanner:** An automated scanner evaluated all 6 Markdown reports under `reports/` and all 3 generated CSVs under `data/processed/` against configured regex patterns for record-level identifier assignments (e.g., `case_id: <digits>`), known case numbers, provider name prefixes (`Dr. <Name>`), and unsupported speculative clinical keywords. Across all 9 audited target files, **no matches were detected by the documented scanner patterns**. Technical schema field names (e.g., `case_id`, `appointment_id`) are preserved as technical documentation. Separate manual review confirmed that records are presented strictly as synthetic project data.
- **Git Exclusions:** All derived CSV files remain locally ignored by Git (`.gitignore:32:*.csv`).
- **Frontend Codebase:** React application files in `src/` remain completely untouched.
