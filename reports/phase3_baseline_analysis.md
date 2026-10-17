# CareFlow — Phase 3, Step 1: Exploratory Process Discovery & Baseline Analysis Report

**Document Title:** Healthcare Process Mining Baseline Analysis & Process Discovery
**Target Event Log:** `data/processed/event_log.csv`
**Derived Visualizations:** [`reports/phase3/dfg_exploratory_synthetic.png`](file:///d:/Care%20Flow/reports/phase3/dfg_exploratory_synthetic.png)
**Execution Context:** Senior Python Data Analyst & Process Mining Engineer
**Date of Execution:** October 16, 2026
**Status:** Completed & Empirically Reconciled

---

## 1. Input Verification & Environment Setup

### 1.1 Environment Architecture
- **Python Runtime:** Python 3.14.3 (isolated project virtual environment `.venv`)
- **Core Process Mining Library:** `pm4py` version `2.7.23.11`
- **Data Engineering & Visualization Stack:**
  - `pandas`: `3.0.6`
  - `numpy`: `2.5.4`
  - `scipy`: `1.18.1`
  - `networkx`: `3.7`
  - `matplotlib`: `3.11.2`
- **Frontend Isolation:** Verified zero modifications to the React frontend dependencies or code.

### 1.2 Event Log Re-Validation
The validated event log [`data/processed/event_log.csv`](file:///d:/Care%20Flow/data/processed/event_log.csv) was ingested and audited:
- **Total Validated Cases (`case_id`):** 49,912 (Target Baseline: 49,912 → **100% Match**)
- **Total Validated Events:** 142,876 (Target Baseline: 142,876 → **100% Match**)
- **Target File Integrity:** 0 null identifiers, 0 null activities, 0 unparseable timestamps.

---

## 2. Activity Frequency Analysis

Across all 49,912 patient encounters, 8 distinct operational activities are recorded:

| Activity Name | Clinical Stage | Total Events | % of Total Events | Distinct Cases | Case Coverage % | Events / Case (Mean) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`Prescription Order`** | Prescription | 50,556 | 35.38% | 49,901 | 99.98% | 1.01 |
| **`Appointment Start`** | Appointment | 49,912 | 34.93% | 49,912 | 100.00% | 1.00 |
| **`Laboratory Start`** | Laboratory | 17,848 | 12.49% | 6,370 | 12.76% | 2.80 |
| **`Laboratory End`** | Laboratory | 13,203 | 9.24% | 4,795 | 9.61% | 2.75 |
| **`Imaging Start`** | Imaging | 5,421 | 3.79% | 5,323 | 10.66% | 1.02 |
| **`Imaging End`** | Imaging | 5,412 | 3.79% | 5,315 | 10.65% | 1.02 |
| **`Pharmacy Start`** | Pharmacy | 262 | 0.18% | 108 | 0.22% | 2.43 |
| **`Pharmacy End`** | Pharmacy | 262 | 0.18% | 108 | 0.22% | 2.43 |

**Key Observations:**
1. **Universal Encounter Milestones:** `Appointment Start` occurs in 100.00% of cases, and `Prescription Order` occurs in 99.98% of cases (49,901 encounters).
2. **Diagnostic Multiplicity:** When laboratory testing is ordered (12.76% of cases), patients undergo an average of **2.80 tests per encounter** (up to 26 distinct test orders).
3. **Completion Event Sparsity in Diagnostics:** `Laboratory End` covers only 9.61% of cases (13,203 events) vs 12.76% for `Laboratory Start` (17,848 events), directly reflecting the 4,702 tests with truncated source timestamps excluded from completion logging.

---

## 3. Case Trace Length Distribution

| Metric | Measured Value | Clinical Interpretation |
| :--- | :---: | :--- |
| **Minimum Trace Length** | 1 event | Incomplete consultations (11 cases where prescription start datetime was omitted). |
| **Median Trace Length** | 2.0 events | Standard outpatient consultation (`Appointment Start` → `Prescription Order`). |
| **Mean Trace Length** | 2.8626 events | Skewed by multi-test laboratory orders and comprehensive imaging investigations. |
| **Maximum Trace Length** | 56 events | High-order diagnostic encounter featuring 26 distinct lab test orders and imaging in the synthetic dataset. |

### Trace Length Breakdown:

| Trace Length | Case Count | Case % | Cumulative % | Clinical Pathway Mapping |
| :---: | :---: | :---: | :---: | :--- |
| **1** | 11 | 0.02% | 0.02% | Length 1 clinical encounters |
| **2** | 39,191 | 78.52% | 78.54% | Length 2 clinical encounters |
| **3** | 897 | 1.80% | 80.34% | Length 3 clinical encounters |
| **4** | 5,410 | 10.84% | 91.18% | Length 4 clinical encounters |
| **5** | 353 | 0.71% | 91.89% | Length 5 clinical encounters |
| **6** | 1,484 | 2.97% | 94.86% | Length 6 clinical encounters |
| **7** | 140 | 0.28% | 95.14% | Length 7 clinical encounters |
| **8** | 788 | 1.58% | 96.72% | Length 8 clinical encounters |
| **9** | 81 | 0.16% | 96.88% | Length 9 clinical encounters |
| **10** | 508 | 1.02% | 97.90% | Length 10 clinical encounters |

---

## 4. Process Variant Analysis

The dataset exhibits **546 distinct process variants** across 49,912 cases. The top 5 variants account for **89.82% of all patient encounters**, while the top 10 account for **94.75%**.

### Top 10 Process Variants:

| Variant ID | Case Count | % of Cases | Length | Activity Sequence |
| :---: | :---: | :---: | :---: | :--- |
| **V1** | 39,187 | 78.51% | 2 | `Appointment Start -> Prescription Order` |
| **V2** | 2,214 | 4.44% | 4 | `Appointment Start -> Prescription Order -> Imaging Start -> Imaging End` |
| **V3** | 1,354 | 2.71% | 4 | `Appointment Start -> Prescription Order -> Laboratory Start -> Laboratory End` |
| **V4** | 1,184 | 2.37% | 4 | `Appointment Start -> Imaging Start -> Imaging End -> Prescription Order` |
| **V5** | 887 | 1.78% | 6 | `Appointment Start -> Prescription Order -> Laboratory Start -> Laboratory Start -> Laboratory End -> Laboratory End` |
| **V6** | 446 | 0.89% | 3 | `Appointment Start -> Prescription Order -> Prescription Order` |
| **V7** | 439 | 0.88% | 8 | `Appointment Start -> Prescription Order -> Laboratory Start -> Laboratory Start -> Laboratory Start -> Laboratory End -> Laboratory End -> Laboratory End` |
| **V8** | 421 | 0.84% | 3 | `Appointment Start -> Prescription Order -> Laboratory Start` |
| **V9** | 278 | 0.56% | 4 | `Appointment Start -> Prescription Order -> Laboratory Start -> Laboratory Start` |
| **V10** | 257 | 0.51% | 10 | `Appointment Start -> Prescription Order -> Laboratory Start -> Laboratory Start -> Laboratory Start -> Laboratory Start -> Laboratory End -> Laboratory End -> Laboratory End -> Laboratory End` |

> [!NOTE]
> **Clinical Process Mining Context:**
> Variant 1 (`Appointment Start` → `Prescription Order`) represents 78.51% of cases. It reflects routine primary consultations where clinical history and examination suffice without laboratory or radiology investigations. The dominance of Variant 1 does not mean it is clinically superior to diagnostic pathways—it simply reflects standard primary care caseload distribution.

---

## 5. Directly-Follows Graph (DFG) Analysis

Total observed transitions between consecutive activities within encounters: **92,964**.

### Top 10 Transition Frequencies:

| Source Activity | Destination Activity | Transitions | Distinct Cases | Case % | Median Lead Time | Mean Lead Time | % Zero Duration |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `Appointment Start` | `Prescription Order` | 47,932 | 47,932 | 96.03% | 25.0 min | 130.2 min | 0.1% |
| `Laboratory Start` | `Laboratory Start` | 11,389 | 4,092 | 8.20% | 0.0 min | 0.5 min | 99.3% |
| `Laboratory End` | `Laboratory End` | 8,242 | 3,039 | 6.09% | 8.0 min | 356.8 min | 34.5% |
| `Prescription Order` | `Laboratory Start` | 5,289 | 5,287 | 10.59% | 19.0 min | 35.6 min | 0.1% |
| `Imaging Start` | `Imaging End` | 5,273 | 5,230 | 10.48% | 3.0 min | 56.6 min | 10.8% |
| `Laboratory Start` | `Laboratory End` | 4,415 | 4,363 | 8.74% | 81.0 min | 285.9 min | 0.0% |
| `Prescription Order` | `Imaging Start` | 2,969 | 2,968 | 5.95% | 35.0 min | 410.9 min | 0.3% |
| `Imaging End` | `Prescription Order` | 1,618 | 1,618 | 3.24% | 21.0 min | 35.9 min | 0.0% |
| `Appointment Start` | `Imaging Start` | 1,588 | 1,588 | 3.18% | 47.0 min | 71.9 min | 0.1% |
| `Imaging End` | `Laboratory Start` | 600 | 600 | 1.20% | 25.0 min | 40.2 min | 0.0% |

### Visual DFG Artifact:
The complete Directly-Follows Graph has been rendered and saved as an artifact:
- **High-Resolution Visual Image:** [`reports/phase3/dfg_exploratory_synthetic.png`](file:///d:/Care%20Flow/reports/phase3/dfg_exploratory_synthetic.png)
- **Graphviz DOT Specification:** [`reports/phase3/dfg_exploratory_synthetic.dot`](file:///d:/Care%20Flow/reports/phase3/dfg_exploratory_synthetic.dot)

---

## 6. Potential Bottleneck Candidates

Transitions ranked by median and mean elapsed times among pathways with at least 30 observations:

| Rank | Source Activity | Destination Activity | Observations | Cases | Median Elapsed | Mean Elapsed | Zero-Duration % | Analytical Assessment |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| 1 | `Laboratory End` | `Imaging Start` | 171 | 171 | **3.18 hrs** (191.0m) | **57.40 hrs** | 2.3% | Outpatient staging delay |
| 2 | `Laboratory End` | `Appointment Start` | 50 | 50 | **2.70 hrs** (162.0m) | **2.91 hrs** | 0.0% | Outpatient staging delay |
| 3 | `Laboratory Start` | `Laboratory End` | 4,415 | 4,363 | **1.35 hrs** (81.0m) | **4.76 hrs** | 0.0% | Outpatient staging delay |
| 4 | `Laboratory End` | `Laboratory Start` | 59 | 53 | **1.33 hrs** (80.0m) | **3.13 hrs** | 0.0% | Outpatient staging delay |
| 5 | `Prescription Order` | `Laboratory End` | 236 | 236 | **0.97 hrs** (58.0m) | **3.98 hrs** | 1.7% | Outpatient staging delay |
| 6 | `Imaging End` | `Laboratory End` | 283 | 283 | **0.93 hrs** (56.0m) | **8.49 hrs** | 0.0% | Outpatient staging delay |
| 7 | `Appointment Start` | `Imaging Start` | 1,588 | 1,588 | **0.78 hrs** (47.0m) | **1.20 hrs** | 0.1% | Outpatient staging delay |
| 8 | `Laboratory Start` | `Imaging Start` | 325 | 325 | **0.73 hrs** (44.0m) | **8.66 hrs** | 0.0% | Outpatient staging delay |
| 9 | `Laboratory End` | `Prescription Order` | 114 | 113 | **0.68 hrs** (40.5m) | **9.71 hrs** | 0.0% | Outpatient staging delay |
| 10 | `Prescription Order` | `Imaging Start` | 2,969 | 2,968 | **0.58 hrs** (35.0m) | **6.85 hrs** | 0.3% | Outpatient staging delay |

> [!WARNING]
> **Caveat on Bottleneck Interpretation:**
> 1. Elapsed timestamp differences reflect **inter-activity recording latency**, not confirmed patient physical waiting times.
> 2. The transition `Laboratory Start` → `Laboratory End` (Median = 1.35 hours, Mean = 4.76 hours) measures the analytical specimen testing turnaround time in the laboratory, which includes multi-hour incubations for microbiological cultures.
> 3. Transitions between `Laboratory End` and subsequent visits or imaging reflect return appointments on subsequent days rather than queue delays.

---

## 7. Timestamp-Tie Sensitivity Analysis

In the validated event log, **15,175 transitions (16.32%)** occur with zero elapsed time (Δt = 0), where two consecutive events share the exact same recorded minute timestamp.

### Sensitivity Comparison: Deterministic Model vs. Strictly Increasing Model

| Source Activity | Destination Activity | Deterministic Total | Strictly Increasing (Δt > 0) | Tied Count (Δt = 0) | Tied % | Impact of Tie-Breaker |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `Appointment Start` | `Prescription Order` | 47,932 | 47,898 | 34 | 0.07% | Low tie sensitivity |
| `Laboratory Start` | `Laboratory Start` | 11,389 | 80 | 11,309 | 99.30% | High tie sensitivity |
| `Laboratory End` | `Laboratory End` | 8,242 | 5,400 | 2,842 | 34.48% | High tie sensitivity |
| `Prescription Order` | `Laboratory Start` | 5,289 | 5,282 | 7 | 0.13% | Low tie sensitivity |
| `Imaging Start` | `Imaging End` | 5,273 | 4,706 | 567 | 10.75% | Low tie sensitivity |
| `Laboratory Start` | `Laboratory End` | 4,415 | 4,414 | 1 | 0.02% | Low tie sensitivity |
| `Prescription Order` | `Imaging Start` | 2,969 | 2,961 | 8 | 0.27% | Low tie sensitivity |
| `Imaging End` | `Prescription Order` | 1,618 | 1,618 | 0 | 0.00% | Low tie sensitivity |
| `Appointment Start` | `Imaging Start` | 1,588 | 1,586 | 2 | 0.13% | Low tie sensitivity |
| `Imaging End` | `Laboratory Start` | 600 | 600 | 0 | 0.00% | Low tie sensitivity |

### Critical Methodological Findings:
1. **Cross-Stage Transitions are Highly Robust:** Crucial clinical transitions (`Appointment Start` → `Prescription Order`, `Prescription Order` → `Laboratory Start`, `Prescription Order` → `Imaging Start`) exhibit <0.3% tied timestamps. Their existence and volume are **empirically substantiated regardless of tie-handling conventions**.
2. **Ties Concentrate in Diagnostic Self-Loops:** 99.30% of `Laboratory Start` → `Laboratory Start` transitions have Δt = 0. This occurs because multiple blood test tubes are collected in a single venipuncture procedure at the identical minute.
3. **Convention Disclaimer:** The stage-based ordering convention (`Appointment` → `Prescription` → `Diagnostics` → `Pharmacy`) establishes reproducibility for process discovery, but **does not prove sub-minute physical causality**.

---

## 8. PM4Py Inductive Miner Discovery Results

The Inductive Miner algorithm (`pm4py.discover_process_tree_inductive`) executed in **0.19 seconds** across all 49,912 cases:

### Process Tree Representation:
```text
+( 'Appointment Start', X( tau, +( X( tau, *( 'Laboratory End', tau ) ), X( tau, *( 'Laboratory Start', tau ) ), X( tau, *( 'Pharmacy End', tau ) ), X( tau, *( 'Pharmacy Start', tau ) ), *( 'Prescription Order', tau ), X( tau, *( ->( 'Imaging Start', X( tau, *( 'Imaging End', tau ) ) ), tau ) ) ) ) )
```

### Derived Formal Petri Net Artifact:
The Inductive Miner process tree was converted into a formal Petri net (with initial and final markings) and serialized to standard PNML:
- **File Path:** [`reports/phase3/inductive_petri_net_synthetic.pnml`](file:///d:/Care%20Flow/reports/phase3/inductive_petri_net_synthetic.pnml)

---

## 9. Known Data Quality Constraints

1. **Truncated Laboratory End Timestamps (4,702 tests):** 26.08% of lab tests lack turnaround completion times due to truncated source strings.
2. **Minute Clock Precision:** With 16.32% of consecutive transitions occurring at the same minute, sub-minute queueing latency cannot be measured.
3. **Prescriptions Modeled as Point Events:** Zero duration and inverted end timestamps in source data necessitate treating prescription issuing as an instantaneous point event.
4. **Pre-Consultation Diagnostic Initiations (418 cases):** Diagnostic start timestamps precede appointment check-in in 0.84% of cases in the synthetic data.

---

## 10. Recommended Next Steps

1. **Phase 3, Step 2 (Clinical Pathway Variant Stratification):** Decompose the 546 variants into the 7 primary clinical pathway cohorts (Flows 1 through 7) to eliminate noise caused by lab panel batching.
2. **Lead Time & Turnaround Time Benchmarking:** Quantify specific clinical turnaround times for the 13,203 laboratory tests and 5,412 imaging exams with verified start and end timestamps.
3. **Frontend Integration Readiness:** Export summary metrics to JSON fixtures for consumption by the CareFlow React dashboard.
