# CareFlow — Phase 3, Step 5: Robustness, Timestamp-Tie Sensitivity & Integrated Findings

> [!IMPORTANT]
> **Exploratory Computational Findings on Synthetic Healthcare Log Data:**
> This study analyzes the sensitivity of discovered process models and process metrics to alternative deterministic orderings of simultaneous events sharing identical timestamps. All datasets analyzed are **synthetic**. All findings are presented strictly as **exploratory computational sensitivity analyses**, and **must not be construed as evidence of real-world clinical pathway validity, clinical waiting times, guideline adherence, or hospital operational performance**.

---

## 1. Executive Summary

In healthcare process mining, temporal granularity is frequently constrained to discrete minutes or dates. When multiple clinical events within an encounter share identical timestamps, standard process-mining algorithms impose an implicit or arbitrary ordering. This Step 5 investigation evaluates the **structural robustness and alignment conformance sensitivity** of the CareFlow clinical pathways across four deterministic tie-breaking scenarios:

1. **Canonical Baseline (`stage_order`):** The established ordering pipeline sorting by clinical stage priority (`Appointment Start=1 -> Prescription Order=2 -> Laboratory Start=3 -> Laboratory End=4 -> Imaging Start=5 -> Imaging End=6 -> Pharmacy Start=7 -> Pharmacy End=8`), broken by string source identifier.
2. **Lexicographic Tie-Break:** Sorts equal-timestamp events alphabetically by activity label (`Appointment Start < Imaging End < Imaging Start < Laboratory End < Laboratory Start < Pharmacy End < Pharmacy Start < Prescription Order`), with deterministic secondary keys.
3. **Reverse-Priority Tie-Break:** Inverts clinical stage hierarchy (`8 down to 1`), prioritizing downstream fulfillment events ahead of upstream consultation events when timestamps tie.
4. **Source-Order Tie-Break:** Orders simultaneous events by their physical appearance index (`source_record_no`) in the cleaned data table.

### Key Quantitative Findings

- **Timestamp-Tie Prevalence:** Out of **142,876** total events across **49,912** cases, exactly **22,024** events across **4,685** cases (**9.39%** of the patient cohort) share identical timestamps with another event in the same case.
- **Zero-Elapsed-Time Transitions:** Exactly **15,175** within-case adjacent event pairs (**16.32%** of all 92,964 adjacent transitions) have zero elapsed duration (identical minute). The vast majority represent same-activity batches: **11,309** `Laboratory Start -> Laboratory Start` (multi-test panels) and **2,842** `Laboratory End -> Laboratory End`.
- **Dominant Pathway Stability:** The primary care pathway (`Appointment Start -> Prescription Order`) accounts for **78.51%** of the entire cohort (**39,188** cases). This dominant variant is **100% stable** across Canonical, Lexicographic, and Source-Order scenarios, and drops only negligibly to **78.45%** under Reverse-Priority (a shift of just 30 cases).
- **Variant Structure Sensitivity:** While 98.6% to 99.9% of patient traces remain invariant, alternative tie-breaking introduces **79 novel variants** under Lexicographic sorting (625 total) and **82 novel variants** under Reverse-Priority (628 total), driven by artificial reordering of simultaneous imaging requests and lab orders.
- **Model Conformance Robustness:** Re-evaluating the **3,051 holdout cases** against the six discovered Petri net models demonstrates that the high-volume pathways (`Appointment → Prescription`, `Lab`, and `Imaging`) exhibit **100.00% conformance stability** (perfect 1.0000 trace fitness, 0 log deviations across all scenarios). Conformance sensitivity is strictly localized to multi-department encounters (`Ambiguous Source Flow`, `Lab + Imaging`, and `Pharmacy`), where timestamp ambiguity produces artificial log deviations against sequentially structured models.

---

## 2. Immutable Input Hashes & Execution Environment

To guarantee cryptographic reproducibility, input files are verified via SHA-256 before and after pipeline execution:

| File Description | Relative Path | Physical Records | Distinct Entities | SHA-256 Checksum | Integrity Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Raw Source Dataset** | `data/raw/careflow_source.csv` | 62,422 data rows | 49,912 appointments | `07d0096b6e3fcff78f94afa6d5aeffeeb2566f59902eccc03da209a3b6502720` | Preserved (Immutable) |
| **Cleaned Source Dataset** | `data/processed/cleaned_source.csv` | 62,418 data rows | 49,912 appointments | `674212c0e4b97d64045e53f2908418c1f229f8e15dd7da801a99436584e614f3` | Preserved (Immutable) |
| **Canonical Event Log** | `data/processed/event_log.csv` | 142,876 event rows | 49,912 cases | `cdab7bbc0e6755cb927a2a627bff2108e48d94ce0e38f62354ed72dcfb63442d` | Preserved (Immutable) |

### Computational Environment Details

- **Operating System:** `Windows 11 (64bit)`
- **Python Runtime:** `Python 3.14.3` (via `.venv\Scripts\python.exe`)
- **PM4Py Engine:** `pm4py v2.7.23.11`
- **Core Scientific Stack:** `pandas v3.0.6`, `numpy v2.5.4`, `scipy v1.18.1`, `networkx v3.7`, `matplotlib v3.11.2`

---

## 3. Canonical Tie-Breaking Reconstruction & Validation

The canonical event log (`data/processed/event_log.csv`) was created by `scripts/data_preparation/clean_dataset.py` using a multi-level deterministic sorting hierarchy:

$$\text{Order} = \langle \text{case\_id}, \text{timestamp}, \text{stage\_order}, \text{source\_order\_id}\text{ (as string)} \rangle$$

### Reconstruction Verification

Reconstruction of this exact sequence on the in-memory event data was tested against `event_log.csv`:
- **Total rows compared:** 142,876
- **Differing rows:** **0** (100.00% exact match)
- **Distinct cases:** 49,912 (reconciled)
- **Global ordered-activity variants:** 546 (reconciled)
- **Exclusive workflow categories:** 8 categories, 0 unmapped cases (reconciled)

### Timestamp-Tie Characterization

In healthcare datasets, clinical activities documented within the same consultation frequently receive identical system timestamps:

| Timestamp-Tie Parameter | Quantitative Measure | Proportion of Cohort / Log | Process Implication |
| :--- | :--- | :--- | :--- |
| **Total Cases with Timestamp Ties** | 4,685 cases | 9.39% of all cases | Only 9.4% of cases contain simultaneous events; 90.6% are strictly sequential |
| **Total Events Sharing Timestamps** | 22,024 events | 15.41% of all events | Clustered in batch diagnostic panels and simultaneous order entries |
| **Distinct Tie Groups** | 6,849 groups | 100.0% | Discrete `(case_id, timestamp)` clusters |
| **Single-Activity Tie Groups** | 6,152 groups | 89.82% of tie groups | Same-activity batches (e.g., 4 lab tests ordered at the same minute) |
| **Multi-Activity Tie Groups** | 697 groups | 10.18% of tie groups | Simultaneous cross-stage activities sensitive to tie-break ordering |
| **Zero-Elapsed-Time Transitions** | 15,175 transitions | 16.32% of all transitions | Adjacent within-case event pairs with $\Delta t = 0$ minutes |

### Top Zero-Elapsed-Time Activity Pairs

The following table details the most frequent adjacent within-case transitions occurring at identical timestamps:

| Rank | Activity Transition Pair | Zero-Time Transition Count | Share of Zero-Time Transitions | Clinical Interpretation in Synthetic Log |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `Laboratory Start -> Laboratory Start` | 11,309 | 74.52% | Batch test panel ordered at same minute |
| 2 | `Laboratory End -> Laboratory End` | 2,842 | 18.73% | Batch test results returned at same minute |
| 3 | `Imaging Start -> Imaging End` | 567 | 3.74% | Instantaneous imaging request duration (start = end) |
| 4 | `Pharmacy Start -> Pharmacy Start` | 150 | 0.99% | Simultaneous dispensing lifecycle record |
| 5 | `Pharmacy End -> Pharmacy End` | 144 | 0.95% | Simultaneous dispensing lifecycle record |
| 6 | `Pharmacy Start -> Pharmacy End` | 58 | 0.38% | Simultaneous dispensing lifecycle record |
| 7 | `Appointment Start -> Prescription Order` | 34 | 0.22% | Immediate prescription entry upon appointment check-in |
| 8 | `Prescription Order -> Prescription Order` | 20 | 0.13% | Immediate prescription entry upon appointment check-in |
| 9 | `Prescription Order -> Imaging Start` | 8 | 0.05% | Immediate prescription entry upon appointment check-in |
| 10 | `Prescription Order -> Laboratory Start` | 7 | 0.05% | Batch test panel ordered at same minute |

> [!NOTE]
> **Reconciliation of Laboratory Transition Figures (11,309 vs. 11,389 vs. 12,015):**
> Across the 49,912-case event log, there are exactly **11,389 total `Laboratory Start -> Laboratory Start` transitions** (7,109 in `Appt → Rx → Lab`, 4,276 in `Ambiguous Multi-Category`, and 4 in `Lab + Imaging`). Of these, exactly **11,309 transitions occur at identical timestamps ($\Delta t = 0$ minutes)** representing simultaneous phlebotomy orders, while exactly 80 transitions have $\Delta t > 0$ minutes (delayed repeat orders). An earlier draft figure of 12,015 appeared exclusively in an informal chat response table (Step 2 summary) and never existed in any generated dataset or markdown report. The true empirical values are 11,389 total transitions and 11,309 simultaneous transitions.

---

## 4. Deterministic Sensitivity Scenario Definitions

To test how process-mining conclusions respond to arbitrary same-timestamp resolution, four deterministic, reproducible scenarios were evaluated. In all scenarios, **events never cross case boundaries**, **timestamps are never altered**, and **chronological order between distinct timestamps is strictly preserved**:

| Scenario Name | Ordering Hierarchy Key | Rationale & Design Goal | Practical Implementation |
| :--- | :--- | :--- | :--- |
| **1. Canonical (Baseline)** | `case_id -> timestamp -> stage_order -> source_order_id_str` | Reconstructs the established clinical pipeline hierarchy | Primary sorting by lifecycle priority (Appt=1 ... Pharm=8) |
| **2. Lexicographic** | `case_id -> timestamp -> activity (A-Z) -> source_order_id_str` | Tests an arbitrary alphabetical rule independent of clinical logic | Activities ordered alphabetically within tied minutes |
| **3. Reverse-Priority** | `case_id -> timestamp -> rev_stage_order (8-1) -> source_order_id_str` | Stress-tests process structure by inverting stage hierarchy | Downstream fulfillment placed ahead of upstream orders |
| **4. Source-Order** | `case_id -> timestamp -> source_record_no -> stage_order -> source_order_id_str` | Tests physical row entry order from the source tabular records | Preserves original table row sequence for simultaneous records |

> [!NOTE]
> **Preservation of Ambiguity:**
> In healthcare data where timestamps lack sub-minute resolution, true real-world event sequences within the same minute are inherently ambiguous. These alternative scenarios do **not** assert clinical causality; they quantify the mathematical sensitivity of process-mining models to that ambiguity.

---

## 5. Case-Order and Variant-Frequency Sensitivity

The following table compares global process structure and variant concentration across the four scenarios:

| Metric Parameter | Canonical (Baseline) | Lexicographic | Reverse-Priority | Source-Order | Sensitivity Assessment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Changed Cases Count** | 0 (0.00%) | 647 (1.3%) | 690 (1.38%) | 67 (0.13%) | Highly robust (98.6% - 99.9% invariant) |
| **Distinct Global Variants** | 546 | 625 (+79) | 628 (+82) | 555 (+9) | Moderate expansion (+14.5% to +15.0%) |
| **Dominant Variant Share** | 78.51% | 78.51% | 78.45% | 78.51% | Exceptionally stable across all scenarios |
| **Top 10 Variants Share** | 93.5% | 92.82% | 92.75% | 93.5% | Robust (92.7% - 93.5% cohort coverage) |
| **Unique DF Transitions** | 44 | 46 (+2) | 46 (+2) | 44 (0) | 2 novel transitions introduced |
| **Zero-Time Transitions** | 15,175 (16.32%) | 15,175 (16.32%) | 15,175 (16.32%) | 15,175 (16.32%) | Strictly preserved invariant |

### Top 5 Global Activity Variants Across Scenarios

The top 5 variants remain virtually identical in structure and case volume across all four scenarios:

| Rank | Canonical Cases (Share) | Lexicographic Cases (Share) | Reverse-Priority Cases (Share) | Source-Order Cases (Share) | Variant Stability Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **#1** | 39,187 (78.51%) | 39,187 (78.51%) | 39,157 (78.45%) | 39,187 (78.51%) | Highly Stable |
| **#2** | 2,214 (4.44%) | 1,956 (3.92%) | 1,955 (3.92%) | 2,214 (4.44%) | Highly Stable |
| **#3** | 1,354 (2.71%) | 1,351 (2.71%) | 1,350 (2.7%) | 1,354 (2.71%) | Highly Stable |
| **#4** | 1,184 (2.37%) | 1,106 (2.22%) | 1,105 (2.21%) | 1,184 (2.37%) | Highly Stable |
| **#5** | 887 (1.78%) | 887 (1.78%) | 887 (1.78%) | 887 (1.78%) | Highly Stable |

---

## 6. Directly-Follows Transition Sensitivity Analysis

Directly-follows (DF) graph edges define the control-flow backbone of process discovery algorithms. While total adjacent zero-time transitions remain invariant at 15,175, tie-breaking alters which specific activities follow each other:

- **Transitions with Identical Frequencies:** 5 transitions are completely insensitive to tie-breaking (e.g. `Appointment Start -> Appointment Start = 0`, `Pharmacy End -> Prescription Order = 0`).
- **Novel Inverted Transitions:** Lexicographic and Reverse-Priority sorting introduce **two novel transitions** absent from Canonical ordering:
  1. `Pharmacy Start -> Laboratory Start`: **0** in Canonical, **5** in Lexicographic, **5** in Reverse-Priority.
  2. `Prescription Order -> Pharmacy End`: **0** in Canonical, **55** in Lexicographic, **55** in Reverse-Priority.
- **Impact of Instantaneous Durations:** In 567 cases, `Imaging Start` and `Imaging End` share the exact same timestamp. In Lexicographic and Reverse-Priority scenarios, `Imaging End` is sorted before `Imaging Start`, causing `Imaging End -> Imaging Start` transitions to surge from **39** in Canonical to **593** in Lexicographic and Reverse-Priority.

### Key Transition Frequency Shifts

| Activity Transition Pair | Canonical | Lexicographic | Reverse-Priority | Source-Order | Operational Mechanism in Synthetic Data |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Appointment Start -> Prescription Order` | 47,932 | 47,917 | 47,891 | 47,932 | Dominant primary care consultation step |
| `Imaging Start -> Imaging End` | 5,273 | 4,762 | 4,766 | 5,294 | Reduced under inversion of simultaneous imaging records |
| `Imaging End -> Imaging Start` | 39 | 593 | 593 | 60 | Inverted order for instantaneous imaging (start = end) |
| `Prescription Order -> Imaging End` | 46 | 364 | 364 | 46 | Imaging End placed ahead of Imaging Start |
| `Appointment Start -> Imaging End` | 13 | 119 | 114 | 13 | Instantaneous imaging sorted ahead of prescription |
| `Laboratory Start -> Laboratory Start` | 11,389 | 11,389 | 11,389 | 11,388 | High-volume batch lab panel orders (invariant) |

---

## 7. Holdout Alignment-Fitness Conformance Comparison

Each scenario was replayed against the six existing Step 3 Petri net models using PM4Py conformance diagnostics across the **identical 3,051 holdout cases** (14,643 events). Move classifications and costs strictly follow established invariants:
- **Synchronous Move:** cost = 0
- **Log-Only Move (Deviation):** cost = 10,000
- **Model-Only Move (Deviation):** cost = 10,000
- **Silent Tau Move (Routing):** cost = 1

$$\text{Total Raw Cost} = 0 \cdot n_{\text{sync}} + 10,000 \cdot n_{\text{log}} + 10,000 \cdot n_{\text{model}} + 1 \cdot n_{\tau}$$

### Conformance Metric Comparison Table

| Workflow Category | Scenario | Evaluated Cases | Evaluated Events | Log Fitness | Trace Fitness | Fitting % | Log Deviations | Silent Tau Moves | Raw Alignment Cost | Robustness Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Appointment → Prescription** | Canonical | 1,000 | 2,014 | 0.9999 | 1.0000 | 100.00% | 0 | 4,014 | 4,014 | Stable (100% Invariant) |
| **Appointment → Prescription** | Lexicographic | 1,000 | 2,014 | 0.9999 | 1.0000 | 100.00% | 0 | 4,014 | 4,014 | Stable (100% Invariant) |
| **Appointment → Prescription** | Reverse-Priority | 1,000 | 2,014 | 0.9999 | 1.0000 | 100.00% | 0 | 4,014 | 4,014 | Stable (100% Invariant) |
| **Appointment → Prescription** | Source-Order | 1,000 | 2,014 | 0.9999 | 1.0000 | 100.00% | 0 | 4,014 | 4,014 | Stable (100% Invariant) |
| **Appointment → Prescription → Lab** | Canonical | 960 | 6,037 | 0.9999 | 1.0000 | 100.00% | 0 | 7,385 | 7,385 | Stable (100% Invariant) |
| **Appointment → Prescription → Lab** | Lexicographic | 960 | 6,037 | 0.9999 | 1.0000 | 100.00% | 0 | 7,385 | 7,385 | Stable (100% Invariant) |
| **Appointment → Prescription → Lab** | Reverse-Priority | 960 | 6,037 | 0.9999 | 1.0000 | 100.00% | 0 | 7,385 | 7,385 | Stable (100% Invariant) |
| **Appointment → Prescription → Lab** | Source-Order | 960 | 6,037 | 0.9999 | 1.0000 | 100.00% | 0 | 7,385 | 7,385 | Stable (100% Invariant) |
| **Appointment → Prescription → Imaging** | Canonical | 757 | 3,089 | 0.9999 | 1.0000 | 100.00% | 0 | 3,089 | 3,089 | Stable (100% Invariant) |
| **Appointment → Prescription → Imaging** | Lexicographic | 757 | 3,089 | 0.9999 | 1.0000 | 100.00% | 0 | 3,089 | 3,089 | Stable (100% Invariant) |
| **Appointment → Prescription → Imaging** | Reverse-Priority | 757 | 3,089 | 0.9999 | 1.0000 | 100.00% | 0 | 3,089 | 3,089 | Stable (100% Invariant) |
| **Appointment → Prescription → Imaging** | Source-Order | 757 | 3,089 | 0.9999 | 1.0000 | 100.00% | 0 | 3,089 | 3,089 | Stable (100% Invariant) |
| **Ambiguous Source Flow (Multi-Category Encounter)** | Canonical | 246 | 2,988 | 0.9987 | 0.9988 | 99.59% | 4 | 4,938 | 44,938 | Highly Conforming |
| **Ambiguous Source Flow (Multi-Category Encounter)** | Lexicographic | 246 | 2,988 | 0.9901 | 0.9883 | 91.06% | 31 | 4,914 | 344,914 | Sensitive to Tie-Breaking |
| **Ambiguous Source Flow (Multi-Category Encounter)** | Reverse-Priority | 246 | 2,988 | 0.9901 | 0.9883 | 91.06% | 31 | 4,914 | 344,914 | Sensitive to Tie-Breaking |
| **Ambiguous Source Flow (Multi-Category Encounter)** | Source-Order | 246 | 2,988 | 0.9970 | 0.9969 | 98.37% | 10 | 4,932 | 104,932 | Highly Conforming |
| **Appointment → Prescription → Lab + Imaging** | Canonical | 69 | 395 | 0.9999 | 1.0000 | 100.00% | 0 | 464 | 464 | Highly Conforming |
| **Appointment → Prescription → Lab + Imaging** | Lexicographic | 69 | 395 | 0.9865 | 0.9865 | 86.96% | 9 | 455 | 90,455 | Sensitive to Tie-Breaking |
| **Appointment → Prescription → Lab + Imaging** | Reverse-Priority | 69 | 395 | 0.9865 | 0.9865 | 86.96% | 9 | 455 | 90,455 | Sensitive to Tie-Breaking |
| **Appointment → Prescription → Lab + Imaging** | Source-Order | 69 | 395 | 0.9999 | 1.0000 | 100.00% | 0 | 464 | 464 | Highly Conforming |
| **Appointment → Prescription → Pharmacy** | Canonical | 19 | 120 | 0.9999 | 1.0000 | 100.00% | 0 | 139 | 139 | Highly Conforming |
| **Appointment → Prescription → Pharmacy** | Lexicographic | 19 | 120 | 0.8979 | 0.8872 | 47.37% | 4 | 163 | 200,163 | Sensitive to Tie-Breaking |
| **Appointment → Prescription → Pharmacy** | Reverse-Priority | 19 | 120 | 0.8979 | 0.8872 | 47.37% | 4 | 163 | 200,163 | Sensitive to Tie-Breaking |
| **Appointment → Prescription → Pharmacy** | Source-Order | 19 | 120 | 0.9999 | 1.0000 | 100.00% | 0 | 155 | 155 | Highly Conforming |

---

## 8. Per-Category Evaluation Coverage & Sampling Details

The evaluated case population was selected using the exact Step 4 deterministic policy:

| Workflow Category | Total Cohort Cases | Total Cohort Events | Holdout Cases (20%) | Holdout Events | Evaluated Cases | Evaluated Events | Sampling Policy & Coverage | Representation Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Appointment → Prescription** | 39,658 | 79,771 | 7,932 | 15,952 | 1,000 | 2,014 | Deterministic Sample (12.61% of holdout, seed=42) | Evaluated sample only; not generalized to full holdout |
| **Appointment → Prescription → Lab** | 4,802 | 30,664 | 960 | 6,037 | 960 | 6,037 | Full Holdout Partition (100.0%) | Complete holdout evaluation |
| **Appointment → Prescription → Imaging** | 3,783 | 15,330 | 757 | 3,089 | 757 | 3,089 | Full Holdout Partition (100.0%) | Complete holdout evaluation |
| **Ambiguous Source Flow (Multi-Category Encounter)** | 1,231 | 14,480 | 246 | 2,988 | 246 | 2,988 | Full Holdout Partition (100.0%) | Complete holdout evaluation |
| **Appointment → Prescription → Lab + Imaging** | 343 | 1,989 | 69 | 395 | 69 | 395 | Full Holdout Partition (100.0%) | Complete holdout evaluation |
| **Appointment → Prescription → Pharmacy** | 93 | 631 | 19 | 120 | 19 | 120 | Full Holdout Partition (100.0%) | Exploratory tier; complete holdout |
| **Appointment → Prescription → Imaging + Pharmacy** | 1 | 6 | 0 | 0 | 0 | 0 | Unavailable (< 30 cases) | Excluded from discovery and conformance |
| **Appointment → Prescription → Lab + Pharmacy** | 1 | 5 | 0 | 0 | 0 | 0 | Unavailable (< 30 cases) | Excluded from discovery and conformance |
| **Total Process Mining Cohort** | **49,912** | **142,876** | **9,983** | **28,581** | **3,051** | **14,643** | **30.56% of Total Holdout** | **Identical 3,051 cases evaluated across all 4 scenarios** |

### Reconciliation with Step 4 Holdout Population

To guarantee rigorous continuity across Phase 3 analytical phases, the evaluated case and event populations were subjected to exact cross-phase assertions and in-memory set comparisons:

#### 1. Authoritative Step 4 Split & Sampling Algorithm
The holdout population is derived using the exact implementation from `scripts/process_mining/conformance_alignment.py` (lines 91–106 and 504):
- **Holdout Partitioning (`deterministic_case_split`):** For each category, unique case IDs are lexicographically sorted, shuffled via `np.random.default_rng(seed=42).permutation()`, and partitioned into discovery (80%) and holdout (20%) using `n_test = int(round(n_total * 0.20))`. Both sets are returned in sorted order.
- **Sampling Policy:** For `Appointment → Prescription`, a deterministic sample of exactly 1,000 cases is drawn via `pd.Series(test_cases).sample(n=1000, random_state=42)`. All other modeled categories evaluate 100.0% of their holdout cases.
- *Note on Alternative Descriptions:* Earlier informal chat summaries described a sorted index slice (`int(0.80 * total_cases)`) and `rng.choice(...)`. Source code inspection confirms that Step 4 and Step 5 execute the exact seeded permutation and pandas series sampling defined above.

#### 2. Exact In-Memory Case-Set Equivalence Proof
An in-memory set comparison ($\text{Cases}_{\text{Step 5}} \equiv \text{Cases}_{\text{Step 4}}$) was executed directly across all six modeled categories:

| Workflow Category | Step 4 Cases | Step 5 Cases | Intersection | Step 4-Only | Step 5-Only | Set Equality | Evaluated Events |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Appointment → Prescription** | 1,000 | 1,000 | 1,000 | 0 | 0 | **True (Exact Match)** | 2,014 |
| **Appointment → Prescription → Lab** | 960 | 960 | 960 | 0 | 0 | **True (Exact Match)** | 6,037 |
| **Appointment → Prescription → Imaging** | 757 | 757 | 757 | 0 | 0 | **True (Exact Match)** | 3,089 |
| **Ambiguous Source Flow (Multi-Category Encounter)** | 246 | 246 | 246 | 0 | 0 | **True (Exact Match)** | 2,988 |
| **Appointment → Prescription → Lab + Imaging** | 69 | 69 | 69 | 0 | 0 | **True (Exact Match)** | 395 |
| **Appointment → Prescription → Pharmacy** | 19 | 19 | 19 | 0 | 0 | **True (Exact Match)** | 120 |
| **Total Evaluated Cohort** | **3,051** | **3,051** | **3,051** | **0** | **0** | **True (Exact Match)** | **14,643** |

#### 3. Root Cause of Prior Alternative Count Discrepancy
A prior exploratory chat response listed alternative per-category event counts (Lab: 4,728; Imaging: 2,709; Ambiguous: 3,889; Lab + Imaging: 1,159; Pharmacy: 144). Forensic inspection of the repository history, generated CSVs, and execution logs confirmed that:
1. Those alternative counts **never existed in any pipeline execution output, script logic, or exported CSV file**.
2. The original Step 5 markdown report displayed only evaluated case counts and omitted an explicit evaluated event column.
3. When drafting the initial summary table in chat, an ungrounded hallucination occurred where event counts were manually tabulated without binding to the underlying dataframe. The true underlying pipeline code and exported CSVs (`tie_sensitivity_conformance.csv`) have always computed and preserved the exact Step 4 event counts (2,014; 6,037; 3,089; 2,988; 395; 120).

#### 4. Scenario Invariance of Event Membership
Because alternative tie-breaking rules alter only the intra-case ordering of simultaneous events ($\Delta t = 0$), the per-category case counts (3,051) and event counts (14,643) remain strictly invariant across all four scenarios (`Canonical`, `Lexicographic`, `Reverse-Priority`, and `Source-Order`). Zero events cross case boundaries or workflow categories.

#### 5. Canonical Scenario vs. Step 4 Conformance Reproduction & Global Metric Aggregation
To establish rigorous cross-phase continuity, the table below compares the conformance results of the Step 5 Canonical scenario with the audited Step 4 baseline across all six modeled categories:

| Workflow Category | Step 4 Log Fit | Step 5 Canon Log Fit | Step 4 Trace Fit | Step 5 Canon Trace Fit | Step 4 % Fit | Step 5 Canon % Fit | Step 4 Raw Cost | Step 5 Canon Raw Cost | Category Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Appointment → Prescription** | 0.9999 | 0.9999 | 1.0000 | 1.0000 | 100.00% | 100.00% | 4,014 | 4,014 | **Identical** |
| **Appointment → Prescription → Lab** | 0.9999 | 0.9999 | 1.0000 | 1.0000 | 100.00% | 100.00% | 7,385 | 7,385 | **Identical** |
| **Appointment → Prescription → Imaging** | 0.9999 | 0.9999 | 1.0000 | 1.0000 | 100.00% | 100.00% | 3,089 | 3,089 | **Identical** |
| **Ambiguous Source Flow** | 0.9987 | 0.9987 | 0.9988 | 0.9988 | 99.59% | 99.59% | 44,938 | 44,938 | **Identical** |
| **Appointment → Prescription → Lab + Imaging** | 0.9999 | 0.9999 | 1.0000 | 1.0000 | 100.00% | 100.00% | 464 | 464 | **Identical** |
| **Appointment → Prescription → Pharmacy** | 0.9999 | 0.9999 | 1.0000 | 1.0000 | 100.00% | 100.00% | 139 | 139 | **Identical** |
| **Total Cohort (Cross-Model Metric)** | **0.9997** | **0.9998** | **0.9999** | **0.9999** | **99.97%** | **99.97%** | **60,029** | **60,029** | **Methodology-Dependent** |

> [!IMPORTANT]
> **Methodological Clarification on Global Log-Fitness Comparison:**
> - **Aggregation Formulas Differ:** Step 4 reported a **pooled cost-ratio log fitness** across the entire evaluated cohort ($\text{Pooled Log Fitness} = 1 - \frac{\sum \text{Raw Cost}}{\sum \text{Worst-Case Move Cost}} = 1 - \frac{60{,}029}{216{,}941{,}120} = 0.99972338... \to \mathbf{0.9997}$). In contrast, Step 5 computes a **case-weighted average log fitness** across the 3,051 evaluated cases ($\text{Case-Weighted Average} = \frac{\sum (N_i \times \text{log\_fit}_i)}{\sum N_i} = \frac{3{,}050.4199}{3{,}051} = 0.99980988... \to \mathbf{0.9998}$).
> - **Mathematical Rounding:** At four decimal places, `0.999723` rounds down to `0.9997` ($0.999723 < 0.99975$), whereas `0.999810` rounds down to `0.9998` ($0.999810 < 0.99985$). These two metrics are **not directly comparable because the aggregation methods differ**, and the total row must not be labeled "Identical".
> - **Harmonized Comparison:** When evaluated under identical aggregation methods, Step 4 and Step 5 Canonical produce **identical global results**:
>   - **Case-Weighted Average Log Fitness:** Exactly **`0.9998`** (`0.999810`) in both Step 4 and Step 5 Canonical.
>   - **Unweighted Macro-Average Log Fitness:** Exactly **`0.9997`** (`0.999716`) across the six models in both Step 4 and Step 5 Canonical ($\frac{1}{6}\sum_{i=1}^6 \text{log\_fit}_i$).
>   - **Total Raw Alignment Cost:** Exactly **`60,029`** in both Step 4 and Step 5 Canonical.
>   - **Total Fitting Traces:** Exactly **`3,050 / 3,051 (99.97%)`** in both Step 4 and Step 5 Canonical.
>   - **Average Trace Fitness:** Exactly **`0.9999`** in both Step 4 and Step 5 Canonical.

---

## 9. Failed, Unavailable, or Partial Scenario Evaluations

1. **Rare Workflow Categories (< 30 cases):**
   - `Appointment → Prescription → Imaging + Pharmacy` (1 case total) and `Appointment → Prescription → Lab + Pharmacy` (1 case total) have no discovered Petri net models. Conformance checking was **unavailable** for these categories under all scenarios.
2. **Computational Feasibility & State Exploration:**
   - All four deterministic scenarios completed 100% of alignments without timeout, out-of-memory error, or solver failure. Execution runtimes ranged from **3.67 seconds** (Source-Order) to **5.74 seconds** (Canonical).
3. **Zero Partial or Dropped Traces:**
   - Exactly 3,051 cases and 14,643 events were processed across every scenario. Zero traces were truncated or omitted.

---

## 10. Synthesis of Robust Findings vs. Ordering-Sensitive Artifacts

### Findings Stable Across Tested Ordering Scenarios

1. **Dominant Pathway Frequency:** The primary care flow (`Appointment Start -> Prescription Order`) accounts for ~78.5% of cases across all scenarios, proving that core outpatient consultation structure is completely robust to temporal resolution artifacts.
2. **Single-Department Pathway Conformance:** Standalone Lab and Imaging pathways (`Appointment → Prescription → Lab` and `Appointment → Prescription → Imaging`) achieved **1.0000 trace fitness and 100% fitting traces across all scenarios**. Reordering simultaneous events within these categories does not violate discovered process models.
3. **High-Frequency Diagnostic Batching:** Batch test orders (11,309 simultaneous `Laboratory Start` transitions) remain the dominant zero-elapsed-time pattern regardless of ordering rule.

### Findings Sensitive to Deterministic Same-Timestamp Ordering

1. **Multi-Department Conformance Degradation:** In multi-category pathways, alternative ordering causes substantial alignment fitness drops:
   - **`Ambiguous Source Flow`:** Fitting trace percentage drops from **99.59%** (Canonical) to **91.06%** (Lexicographic / Reverse-Priority), with log deviations surging from 4 to 31.
   - **`Lab + Imaging`:** Fitting trace percentage drops from **100.00%** (Canonical) to **86.96%** (Lexicographic / Reverse-Priority), producing 9 log deviations.
   - **`Pharmacy`:** Fitting trace percentage drops from **100.00%** (Canonical) to **47.37%** (Lexicographic / Reverse-Priority), with 10 deviant cases.
2. **Variant Proliferation:** Tie-breaking inflates distinct variants from 546 to 625-628 (+15%), indicating that minor variant diversity in the original log is partially an artifact of deterministic stage prioritization.
3. **Instantaneous Duration Inversions:** For 567 cases with identical imaging start and end timestamps, lexicographic sorting reverses the lifecycle sequence (`Imaging End -> Imaging Start`), generating spurious backward control-flow transitions.

---

## 11. Limitations of Synthetic Log Precision & Artificial Granularity

1. **1-Minute Coarse Timestamp Resolution:** The synthetic event generator quantized all activity datetimes to discrete whole minutes (`YYYY-MM-DD HH:MM:00`). Sub-minute clinical event sequences (e.g. nurse taking vitals, doctor ordering lab, imaging technician completing exam) cannot be resolved without timestamp-tie arbitration.
2. **Instantaneous Completion Records:** Multiple imaging and pharmacy records exhibit duration $t_{\text{end}} - t_{\text{start}} = 0$, representing transactional completion logs rather than true procedural duration.
3. **Absence of Millisecond Clocks in Synthetic Data:** In real clinical EHR systems, HL7/FHIR audit logs record millisecond-level sequence numbers. The absence of such sequence metadata in the synthetic log forces process discovery algorithms to rely on arbitrary tie-breaks.

---

## 12. Methodological Recommendations & Downstream Implications

1. **Prioritize Lifecycle Pairs in Discovery:** Process-mining discovery pipelines should explicitly enforce lifecycle ordering constraints (`Start` before `End` for identical request IDs) before applying generic sorting.
2. **Isolate Multi-Category Encounters:** Multi-department patient encounters (`Ambiguous Source Flow`) should be analyzed using concurrent or partially ordered process representations (e.g., token-based concurrency or declarative process models) rather than strictly sequential Petri nets.
3. **Report Sensitivity Boundaries in Downstream Analysis:** Downstream Phase 3 Step 6 reporting should clearly distinguish between robust structural conclusions (primary care flows) and tie-sensitive operational estimates (multi-stage turnaround times).

---

> [!CAUTION]
> **Privacy & Anonymization Audit:**
> In compliance with CareFlow data governance rules, all generated CSV deliverables (`tie_sensitivity_summary.csv`, `tie_sensitivity_variants.csv`, `tie_sensitivity_conformance.csv`) and this report contain **zero patient identifiers, appointment IDs, case IDs, raw event timestamps, or complete case trace sequences**. All data are strictly aggregate. All generated CSVs are locally Git-ignored under `.gitignore:32:*.csv`.