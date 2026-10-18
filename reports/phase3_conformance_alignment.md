# CareFlow — Phase 3, Step 4: Conformance Checking & Alignment Analysis

> [!IMPORTANT]
> **Synthetic Dataset Notice & Clinical Governance Disclaimer**
> The CareFlow process-mining dataset analyzed in this report is entirely **synthetic**. All findings, fitness scores, alignment costs, move classifications, and deviation rates represent exploratory comparisons between synthetic event sequences and discovered Petri net models. They must **never** be interpreted as validated clinical guideline adherence, real-world hospital delays, medical protocol non-compliance, or clinical staff performance.

## Executive Summary

This report delivers **Phase 3, Step 4** of the CareFlow process-mining pipeline: a mathematically rigorous, reproducible conformance checking and alignment analysis across the six pathway-specific Petri net models discovered in Step 3. All alignment evaluations were conducted strictly on an **independent holdout-derived population subject to category-specific sampling** (evaluating **3,051 cases and 14,643 events** from the 20% holdout partition of 9,983 cases and 28,581 events), ensuring complete separation from discovery data while explicitly bounding computational cost.

### Key Conformance Findings
1. **Near-Perfect Alignment Conformance Across Structured Clinical Pathways:**
   Across five of the six discovered workflow categories (`Appointment → Prescription`, `Appointment → Prescription → Lab`, `Appointment → Prescription → Imaging`, `Appointment → Prescription → Lab + Imaging`, and `Appointment → Prescription → Pharmacy`), holdout traces demonstrated **100.00% trace alignment fitness** (`average_trace_fitness = 1.0000`, 0 log-only deviations, 0 model-only deviations). Every observed event sequence in these holdout traces matched a valid path through the discovered Petri nets.
2. **Specific, Isolated Deviations in Ambiguous Multi-Category Encounters:**
   The `Ambiguous Source Flow (Multi-Category Encounter)` model achieved **99.87% alignment log fitness** and **99.59% trace fit percentage** (245 out of 246 holdout cases fit perfectly). Exactly **one holdout case (0.41%)** exhibited deviations, accounting for all **four log-only moves** (`Laboratory Start`: 1, `Laboratory End`: 1, `Pharmacy Start`: 2) and **zero model-only moves**. This aligns exactly with the Phase 3 Step 3 token-based replay audit, which identified this same case.
3. **Variant Novelty Does Not Imply Model Non-Conformance:**
   Across the six evaluated model categories, a total of **76 holdout cases** exhibited exact activity sequences that were absent from the 80% discovery partition: **27 cases** across the structured pathways (13 in Lab, 5 in Imaging, 9 in Lab + Imaging) and **49 cases** in the ambiguous encounter category. Of the 27 structured-pathway novel cases, **100.00% (27/27)** aligned with zero deviations. In the ambiguous encounter category, **97.96% (48/49)** of novel-variant cases aligned with zero deviations, and only 1 case exhibited deviations. Because Petri nets model concurrent branching and looping transitions, novel interleavings of concurrent activities remain fully compliant words of the model language, demonstrating strong generalization without overfitting.
4. **Exact Reconciliation of Step 3 Holdout Partition & Zero Leakage:**
   The exact deterministic 80/20 discovery/holdout split from Step 3 was reproduced with zero case leakage (39,929 discovery cases / 9,983 holdout cases). Conformance was evaluated across an independent holdout-derived cohort of **3,051 cases and 14,643 events**, utilizing a deterministic 1,000-case sample (seed 42, 2,014 events) to bound computational cost for the high-volume `Appointment → Prescription` cohort (7,932 holdout cases, 15,952 events), and full holdout populations for all other modeled categories (2,051 cases, 12,629 events). Reported results for `Appointment → Prescription` apply strictly to the evaluated 1,000-case sample and are not full-holdout estimates.

---

## 1. Input Integrity, Environment Versions & Reproducibility

The evaluation pipeline was executed using the local project virtual environment. Pre- and post-execution SHA-256 cryptographic hashes confirm that the underlying source and event-log datasets remained strictly immutable:

| Artifact / Dataset | File Path | Physical Data Rows | Distinct Identifier Count | Pre-Execution SHA-256 | Post-Execution SHA-256 | Integrity Status |
| :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| **Raw Source Dataset** | [`careflow_source.csv`](file:///d:/Care%20Flow/data/raw/careflow_source.csv) | 62,422 rows | 49,912 appointments | `07d0096b6e3fcff78f94afa6d5aeffeeb2566f59902eccc03da209a3b6502720` | `07d0096b6e3fcff78f94afa6d5aeffeeb2566f59902eccc03da209a3b6502720` | **Preserved (Verified)** |
| **Cleaned Source Dataset** | [`cleaned_source.csv`](file:///d:/Care%20Flow/data/processed/cleaned_source.csv) | 62,418 rows | 49,912 appointments | `674212c0e4b97d64045e53f2908418c1f229f8e15dd7da801a99436584e614f3` | `674212c0e4b97d64045e53f2908418c1f229f8e15dd7da801a99436584e614f3` | **Preserved (Verified)** |
| **Processed Event Log** | [`event_log.csv`](file:///d:/Care%20Flow/data/processed/event_log.csv) | 142,876 events | 49,912 cases | `cdab7bbc0e6755cb927a2a627bff2108e48d94ce0e38f62354ed72dcfb63442d` | `cdab7bbc0e6755cb927a2a627bff2108e48d94ce0e38f62354ed72dcfb63442d` | **Preserved (Verified)** |

### Active Execution Environment Versions
- **Python:** `3.14.3`
- **PM4Py:** `2.7.23.11`
- **pandas:** `3.0.6`
- **NumPy:** `2.5.4`
- **Operating System:** `Windows (win32)`

---

## 2. Holdout Partitioning, Sampling Policy & Evaluation Coverage

### 2.1 Reconstructed Deterministic 80/20 Case Split
Cases—not individual events—were partitioned using random seed `42` with an 80% discovery / 20% holdout split. Every event belonging to a case remained within that case's assigned partition, ensuring **zero case leakage** between training and test sets:

| Workflow Category | Sample Size Tier | Global Cases | Discovery Cases (80%) | Holdout Cases (20%) | Global Events | Discovery Events | Holdout Events |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Appointment → Prescription** | Standard | 39,658 | 31,726 | 7,932 | 79,771 | 63,819 | 15,952 |
| **Appointment → Prescription → Lab** | Standard | 4,802 | 3,842 | 960 | 30,664 | 24,627 | 6,037 |
| **Appointment → Prescription → Imaging** | Standard | 3,783 | 3,026 | 757 | 15,330 | 12,241 | 3,089 |
| **Ambiguous Source Flow (Multi-Category Encounter)** | Exploratory | 1,231 | 985 | 246 | 14,480 | 11,492 | 2,988 |
| **Appointment → Prescription → Lab + Imaging** | Standard | 343 | 274 | 69 | 1,989 | 1,594 | 395 |
| **Appointment → Prescription → Pharmacy** | Exploratory | 93 | 74 | 19 | 631 | 511 | 120 |
| **Appointment → Prescription → Imaging + Pharmacy** | Insufficient | 1 | 1 | 0 | 6 | 6 | 0 |
| **Appointment → Prescription → Lab + Pharmacy** | Insufficient | 1 | 1 | 0 | 5 | 5 | 0 |
| **Total Global Cohort** | — | **49,912** | **39,929** | **9,983** | **142,876** | **114,295** | **28,581** |

### 2.2 Conformance Evaluation Sampling Policy
A* state-space alignment calculations are computationally intensive. To maintain rigorous, bounded execution times, the pipeline implements an explicit, reproducible sampling policy:
- **Categories with $\le 1,000$ Holdout Cases:** 100% of holdout cases were evaluated.
- **Categories with $> 1,000$ Holdout Cases (`Appointment → Prescription`):** A deterministic, reproducible sample of **exactly 1,000 cases (2,014 events)** was selected using `random_seed = 42` from the 7,932 holdout cases (15,952 events) to bound computational cost. The reported alignment results apply strictly to that 1,000-case sample and are not full-holdout estimates for the 7,932-case `Appointment → Prescription` holdout population.
- **Categories with $< 30$ Cases (`Imaging + Pharmacy`, `Lab + Pharmacy`):** Remained unmodeled in Step 3 and are strictly labeled as **Unavailable (< 30 cases)**.

| Workflow Category | Total Holdout Cases | Total Holdout Events | Cases Evaluated | Events Evaluated | Sampling Policy / Status | Evaluated Sample % | Model File Evaluated |
| :--- | :---: | :---: | :---: | :---: | :--- | :---: | :--- |
| **Appointment → Prescription** | 7,932 | 15,952 | 1,000 | 2,014 | Deterministic Sample (n=1,000) | 12.61% | [`appointment_prescription.pnml`](file:///d:/Care%20Flow/reports/phase3/pathway_models/appointment_prescription.pnml) |
| **Appointment → Prescription → Lab** | 960 | 6,037 | 960 | 6,037 | Full Holdout | 100.00% | [`appointment_prescription_lab.pnml`](file:///d:/Care%20Flow/reports/phase3/pathway_models/appointment_prescription_lab.pnml) |
| **Appointment → Prescription → Imaging** | 757 | 3,089 | 757 | 3,089 | Full Holdout | 100.00% | [`appointment_prescription_imaging.pnml`](file:///d:/Care%20Flow/reports/phase3/pathway_models/appointment_prescription_imaging.pnml) |
| **Ambiguous Source Flow (Multi-Category Encounter)** | 246 | 2,988 | 246 | 2,988 | Full Holdout | 100.00% | [`ambiguous_multi_category.pnml`](file:///d:/Care%20Flow/reports/phase3/pathway_models/ambiguous_multi_category.pnml) |
| **Appointment → Prescription → Lab + Imaging** | 69 | 395 | 69 | 395 | Full Holdout | 100.00% | [`appointment_prescription_lab_imaging.pnml`](file:///d:/Care%20Flow/reports/phase3/pathway_models/appointment_prescription_lab_imaging.pnml) |
| **Appointment → Prescription → Pharmacy** | 19 | 120 | 19 | 120 | Full Holdout | 100.00% | [`appointment_prescription_pharmacy.pnml`](file:///d:/Care%20Flow/reports/phase3/pathway_models/appointment_prescription_pharmacy.pnml) |
| **Appointment → Prescription → Imaging + Pharmacy** | 0 | 0 | 0 | 0 | Unavailable (< 30 cases) | 0.00% | N/A |
| **Appointment → Prescription → Lab + Pharmacy** | 0 | 0 | 0 | 0 | Unavailable (< 30 cases) | 0.00% | N/A |
| **Total Evaluated Cohort** | **9,983** | **28,581** | **3,051** | **14,643** | **Combined Evaluation Set** | **30.56%** | **6 PNML Models** |

---

## 3. Conformance Metrics & Mathematical Definitions

### 3.1 Standard PM4Py Alignment APIs and Metric Mapping
The evaluation utilizes PM4Py 2.7.23's standard alignment replay engine. Metrics are obtained from `pm4py.fitness_alignments(eval_pm, net, im, fm)` and verified against `pm4py.conformance_diagnostics_alignments(eval_pm, net, im, fm)` calling `pm4py.algo.conformance.alignments.petri_net.variants.state_equation_a_star`. For each trace $\sigma$, the A* algorithm constructs an optimal sequence of moves $\gamma = [(\alpha_1, \tau_1), \dots, (\alpha_m, \tau_m)]$ minimizing total edit distance.

The standard move-cost configuration in PM4Py is applied:
- **Move on Log ($a, \gg$):** `STD_MODEL_LOG_MOVE_COST = 10,000` (penalty for unmodeled log activity)
- **Move on Model ($\gg, t$ with $\lambda(t) \neq \text{None}$):** `STD_MODEL_LOG_MOVE_COST = 10,000` (penalty for skipped required activity)
- **Synchronous Move ($a, t$ with $\lambda(t) = a$):** `STD_SYNC_COST = 0` (perfect alignment)
- **Silent Transition Move ($\gg, t$ with $\lambda(t) = \text{None}$):** `STD_TAU_COST = 1` (internal routing cost)

### 3.2 Mathematical Reconciliation: Normalized Fitness vs. Raw Alignment Cost
A critical distinction in PM4Py 2.7.23 is the normalization method used across different metrics:
1. **Normalized Alignment Log Fitness:**
   $$\text{Log Fitness} = 1.0 - \frac{\sum_{\sigma \in \mathcal{L}} \text{cost}(\sigma)}{\sum_{\sigma \in \mathcal{L}} \text{bwc}(\sigma)}$$
   Here, $\text{bwc}(\sigma) = |\sigma| \times 10,000 + \text{shortest\_model\_path\_cost}$. Because raw alignment costs directly sum silent transition costs ($\tau$, cost 1 each), perfectly fitting traces incur a tiny positive numerator (e.g., 4,014 for 1,000 cases in `Appointment → Prescription`). Against a best-worst-case denominator of 30,003,000, this yields $1.0 - 4,014/30,003,000 = 0.999867$, which rounds to **0.9999**.
2. **Normalized Average Trace Alignment Fitness:**
   In PM4Py's `apply_trace`, trace fitness normalizes by integer dividing by `STD_MODEL_LOG_MOVE_COST`:
   $$\text{fitness\_num} = \lfloor \text{cost}(\sigma) / 10,000 \rfloor, \quad \text{fitness\_den} = \lfloor \text{bwc}(\sigma) / 10,000 \rfloor$$
   $$\text{Trace Fitness}(\sigma) = 1.0 - \frac{\text{fitness\_num}}{\text{fitness\_den}}$$
   Because silent transitions cost 1 each, $\text{cost}(\sigma) < 10,000$ for traces with zero deviations, resulting in $\text{fitness\_num} = 0$. Consequently, **Trace Fitness is exactly 1.0000** for all traces without deviations.
3. **Percentage of Fitting Traces:**
   Proportion of evaluated traces with $\text{Trace Fitness}(\sigma) == 1.0$. Because silent transitions are truncated by the integer division, traces with zero log-only and zero visible model-only moves achieve 100.0% fit.
4. **Raw Alignment Costs (Separate from Normalized Fitness):**
   Raw alignment costs are defined as $\sum_{\gamma_i} c(\gamma_i)$ and range in $[0, \infty)$. They are explicitly reported below as `Mean Raw Cost`, `Median Raw Cost`, etc., and represent total edit distance including internal silent routing transitions.

| Metric Name | Evaluated Population | PM4Py API / Source Implementation | Denominator | Mathematical Definition / Formula |
| :--- | :--- | :--- | :--- | :--- |
| **Alignment-Based Log Fitness** | Evaluated Holdout Cases ($N$) | `pm4py.fitness_alignments` (`log_fitness`) | $\sum_{\sigma \in \mathcal{L}} \text{bwc}(\sigma)$ | $1.0 - \frac{\sum_{\sigma} \text{cost}(\sigma)}{\sum_{\sigma} \text{bwc}(\sigma)}$. Output ranges in $[0, 1]$. Includes silent $\tau$ routing costs in numerator. |
| **Average Trace Alignment Fitness** | Evaluated Holdout Cases ($N$) | `pm4py.fitness_alignments` (`average_trace_fitness`) | Evaluated Cases ($N$) | $\frac{1}{N} \sum_{i=1}^N \left(1.0 - \frac{\text{cost}(\sigma_i) // 10,000}{\text{bwc}(\sigma_i) // 10,000}\right)$. Isolates deviations from internal $\tau$ costs. |
| **Fitting Traces Percentage** | Evaluated Holdout Cases ($N$) | `pm4py.fitness_alignments` (`percentage_of_fitting_traces`) | Evaluated Cases ($N$) | $\frac{|\{\sigma \in \mathcal{L} \mid \text{trace\_fitness}(\sigma) == 1.0\}|}{N} \times 100\%$ |
| **Mean Raw Alignment Cost** | Evaluated Holdout Cases ($N$) | Raw alignment `cost` attribute | Evaluated Cases ($N$) | $\frac{1}{N} \sum_{i=1}^N \text{cost}(\sigma_i)$, reflecting total edit cost including internal $\tau$ transitions. |
| **Median Raw Alignment Cost** | Evaluated Holdout Cases ($N$) | Raw alignment `cost` attribute | Evaluated Cases ($N$) | 50th percentile of raw per-trace alignment costs. |
| **Deviant Cases Percentage** | Evaluated Holdout Cases ($N$) | Alignment move classifier | Evaluated Cases ($N$) | Percentage of evaluated cases containing $\ge 1$ log-only or visible model-only moves. |

> [!NOTE]
> **Methodological Distinction: Token-Based Replay vs. Alignment-Based Fitness**
> Token-based replay (TBR) evaluates local token balance (missing and remaining tokens) during Petri net firing. TBR fitness can penalize traces when local markings mismatch, even if the general sequence is close. In contrast, alignment-based fitness performs a **global optimization (A* search)** that maps the entire trace to the closest valid firing sequence. Conformance analysis confirms that both metrics reach identical qualitative conclusions: the five structured models fit holdout traces with near-perfect fidelity, while alignment pinpointed the exact four deviant events in `Ambiguous Source Flow`.

---

## 4. Empirical Conformance Quality Results

The table below presents the verified standard PM4Py alignment fitness scores and raw cost distributions across all eight workflow categories:

| Workflow Category | Evaluated Cases | Alignment Log Fitness (Exact / 4-Dec) | Avg Trace Fitness | Fit Traces % | Mean Raw Cost (inc. τ) | Median Raw Cost (inc. τ) | Min Raw Cost | Max Raw Cost | Deviant Cases (%) | Step 3 TBR Fitness |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Appointment → Prescription** | 1,000 | 0.999867 (0.9999) | 1.0000 | 100.00% | 4.01 | 4.0 | 3 | 5 | 0 (0.00%) | 1.0000 (100.0%) |
| **Appointment → Prescription → Lab** | 960 | 0.999917 (0.9999) | 1.0000 | 100.00% | 7.69 | 7.0 | 3 | 40 | 0 (0.00%) | 1.0000 (100.0%) |
| **Appointment → Prescription → Imaging** | 757 | 0.999942 (0.9999) | 1.0000 | 100.00% | 4.08 | 4.0 | 3 | 7 | 0 (0.00%) | 1.0000 (100.0%) |
| **Ambiguous Source Flow (Multi-Category Encounter)** | 246 | 0.998709 (0.9987) | 0.9988 | 99.59% | 182.67 | 19.0 | 11 | 40012 | 1 (0.41%) | 0.9998 (99.6%) |
| **Appointment → Prescription → Lab + Imaging** | 69 | 0.999931 (0.9999) | 1.0000 | 100.00% | 6.72 | 7.0 | 6 | 8 | 0 (0.00%) | 1.0000 (100.0%) |
| **Appointment → Prescription → Pharmacy** | 19 | 0.999929 (0.9999) | 1.0000 | 100.00% | 7.32 | 7.0 | 5 | 15 | 0 (0.00%) | 1.0000 (100.0%) |
| **Appointment → Prescription → Imaging + Pharmacy** | 0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A (N/A) | Unavailable (< 30) |
| **Appointment → Prescription → Lab + Pharmacy** | 0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A (N/A) | Unavailable (< 30) |
| **Total Evaluated Cohort** | **3,051** | **0.999723 (0.9997)** | **0.9999** | **99.97%** | **19.68** | **4.0** | **3** | **40,012** | **1 (0.03%)** | **Near-Perfect (99.6%–100%)** |

### Cost Structure Analysis:
- **Fitting Models Have Non-Zero Raw Costs:** Traces with `fitness = 1.0` and 0 deviations still incur small raw alignment costs (e.g., median raw cost 4.0 in `Appointment → Prescription`, 7.0 in `Lab`, 4.0 in `Imaging`). These represent silent $\tau$ routing transitions (`STD_TAU_COST = 1`) traversed by the model to reach accepting markings, not process deviations.
- **Maximum Alignment Cost in Ambiguous Encounters:** The maximum cost of **40,012** observed in `Ambiguous Source Flow` corresponds exactly to **four log-only deviations** ($4 \times 10,000 = 40,000$) plus **12 silent routing transitions** ($12 \times 1 = 12$).

### 4.1 Strict Alignment Cost Invariant & Complete Arithmetic Reconciliation
To verify that all alignment move costs are accounted for without unexplained residuals, we audit the arithmetic cost invariant across all 3,051 evaluated cases:
$$\text{Total Classified Move Cost} = (N_{\text{sync}} \times 0) + (N_{\text{log\_only}} \times 10,000) + (N_{\text{model\_only}} \times 10,000) + (N_{\tau} \times 1)$$

| Move Classification | Evaluated Count | PM4Py Standard Move Cost | Total Classified Cost | Alignment Semantics |
| :--- | :---: | :---: | :---: | :--- |
| **Synchronous Moves** | 14,639 | 0 | 0 | Observed event identically matched to Petri net transition. |
| **Log-Only Moves (Deviations)** | 4 | 10,000 | 40,000 | Observed event absent from Petri net model (unmodeled activity). |
| **Visible Model-Only Moves (Deviations)** | 0 | 10,000 | 0 | Required model transition omitted in observed event log. |
| **Silent $\tau$ Routing Moves** | 20,029 | 1 | 20,029 | Unobservable routing transition traversed to reach marking. |
| **Total Alignment Moves / Cost** | **34,672** | — | **60,029** | **Exact match to sum of PM4Py raw alignment costs (60,029).** |

#### Category-Level Cost Invariant Reconciliation Table:
Each evaluated workflow category strictly satisfies the cost invariant across all evaluated traces:

| Workflow Category | Evaluated Cases | Sync Moves (Cost 0) | Log-Only (Cost 10,000) | Model-Only (Cost 10,000) | Silent $\tau$ (Cost 1) | Classified Move Cost | Summed PM4Py Raw Cost | Arithmetic Invariant Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Appointment → Prescription** | 1,000 | 2,014 | 0 | 0 | 4,014 | 4,014 | 4,014 | **Exact (Reconciled)** |
| **Appointment → Prescription → Lab** | 960 | 6,037 | 0 | 0 | 7,385 | 7,385 | 7,385 | **Exact (Reconciled)** |
| **Appointment → Prescription → Imaging** | 757 | 3,089 | 0 | 0 | 3,089 | 3,089 | 3,089 | **Exact (Reconciled)** |
| **Ambiguous Source Flow (Multi-Category Encounter)** | 246 | 2,984 | 4 | 0 | 4,938 | 44,938 | 44,938 | **Exact (Reconciled)** |
| **Appointment → Prescription → Lab + Imaging** | 69 | 395 | 0 | 0 | 464 | 464 | 464 | **Exact (Reconciled)** |
| **Appointment → Prescription → Pharmacy** | 19 | 120 | 0 | 0 | 139 | 139 | 139 | **Exact (Reconciled)** |
| **Total Evaluated Cohort** | **3,051** | **14,639** | **4** | **0** | **20,029** | **60,029** | **60,029** | **Exact (Reconciled)** |

#### Resolution of Prior Cost Invariant Discrepancy:
An apparent 100-cost discrepancy arose in earlier draft figures that cited 19,929 silent $\tau$ moves across the evaluated cohort. Under that figure, the calculated sum was:
$$4 \times 10,000 + 19,929 \times 1 + 0 = 59,929$$
which fell exactly 100 below the reported raw alignment cost total of 60,029. Re-auditing the exact alignment objects returned by PM4Py established that the true count of silent $\tau$ moves across the 3,051 evaluated cases is **20,029** ($4,014 + 7,385 + 3,089 + 4,938 + 464 + 139 = 20,029$). The previous figure of 19,929 was an erroneous citation/off-by-100 count. With the verified count of 20,029 silent moves, the invariant holds exactly with zero residual:
$$4 \times 10,000 + 0 \times 10,000 + 20,029 \times 1 + 14,639 \times 0 = 60,029$$
Per-trace, category-level, and pooled cost assertions in `conformance_alignment.py` programmatically verify this identity.

---

## 5. Aggregate Alignment Move Classification & Activity Breakdown

### 5.1 Category-Level Alignment Moves
Moves were aggregated across the entire evaluated cohort into synchronous, log-only, model-only, and silent $\tau$ transitions:

| Workflow Category | Evaluated Events | Synchronous Moves | Log-Only Moves (Deviations) | Model-Only Moves (Deviations) | Silent Tau Moves (Routing) | Total Alignment Moves | Log Move Deviation Rate % | Model Move Deviation Rate % |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Appointment → Prescription** | 2,014 | 2,014 | 0 | 0 | 4,014 | 6,028 | 0.0000% | 0.0000% |
| **Appointment → Prescription → Lab** | 6,037 | 6,037 | 0 | 0 | 7,385 | 13,422 | 0.0000% | 0.0000% |
| **Appointment → Prescription → Imaging** | 3,089 | 3,089 | 0 | 0 | 3,089 | 6,178 | 0.0000% | 0.0000% |
| **Ambiguous Source Flow (Multi-Category Encounter)** | 2,988 | 2,984 | 4 | 0 | 4,938 | 7,926 | 0.1339% | 0.0000% |
| **Appointment → Prescription → Lab + Imaging** | 395 | 395 | 0 | 0 | 464 | 859 | 0.0000% | 0.0000% |
| **Appointment → Prescription → Pharmacy** | 120 | 120 | 0 | 0 | 139 | 259 | 0.0000% | 0.0000% |
| **Appointment → Prescription → Imaging + Pharmacy** | 0 | 0 | 0 | 0 | 0 | 0 | N/A | N/A |
| **Appointment → Prescription → Lab + Pharmacy** | 0 | 0 | 0 | 0 | 0 | 0 | N/A | N/A |
| **Total Evaluated Cohort** | **14,643** | **14,639** | **4** | **0** | **20,029** | **34,672** | **0.0273%** | **0.0000%** |

### 5.2 Activity-Level Deviation Breakdown in Ambiguous Encounters
Across all five structured models, every evaluated activity label demonstrated 100.0% synchronous matching with zero deviations. In `Ambiguous Source Flow (Multi-Category Encounter)`, deviations were localized to three specific activity types:

| Activity Label | Synchronous Moves | Log-Only Moves | Model-Only Moves | Activity Occurrence Denominator | Log-Only Deviation % | Deviation Interpretation |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Laboratory Start** | 490 | 1 | 0 | 491 | 0.2037% | Unmatched lab start event beyond model's discovered capacity. |
| **Laboratory End** | 490 | 1 | 0 | 491 | 0.2037% | Unmatched lab completion event beyond model's discovered capacity. |
| **Pharmacy Start** | 10 | 2 | 0 | 12 | 16.6667% | Repeated pharmacy dispensation attempts in a single multi-encounter case. |
| **Appointment Start** | 246 | 0 | 0 | 246 | 0.0000% | Perfect synchronous alignment. |
| **Prescription Order** | 246 | 0 | 0 | 246 | 0.0000% | Perfect synchronous alignment. |
| **Imaging Start** | 741 | 0 | 0 | 741 | 0.0000% | Perfect synchronous alignment. |
| **Imaging End** | 741 | 0 | 0 | 741 | 0.0000% | Perfect synchronous alignment. |
| **Pharmacy End** | 20 | 0 | 0 | 20 | 0.0000% | Perfect synchronous alignment. |

---

## 6. Variant Novelty versus Model Conformance

A critical question in process mining is whether unseen event sequences (**novel variants**) fail model conformance. If a process model merely memorizes observed discovery traces, novel holdout variants will fail alignment. Conversely, a generalizable model accepts valid interleavings and loop iterations not explicitly present in the training set.

| Workflow Category | Discovery Variants | Holdout Variants | Novel Holdout Variants | Evaluated Cases with Novel Variants | Evaluated Novel Variant % | Novel Variant Cases with Deviations | Novel Variant Non-Conformance Rate % | Alignment Conformance Assessment |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Appointment → Prescription** | 5 | 4 | 0 | 0 | 0.00% | 0 | 0.00% | Perfect Generalization (100% Fit) |
| **Appointment → Prescription → Lab** | 133 | 62 | 12 | 13 | 1.35% | 0 | 0.00% | Perfect Generalization (100% Fit) |
| **Appointment → Prescription → Imaging** | 27 | 19 | 4 | 5 | 0.66% | 0 | 0.00% | Perfect Generalization (100% Fit) |
| **Ambiguous Source Flow (Multi-Category Encounter)** | 270 | 120 | 47 | 49 | 19.92% | 1 | 2.04% | Near-Perfect (48/49 Fit) |
| **Appointment → Prescription → Lab + Imaging** | 36 | 20 | 8 | 9 | 13.04% | 0 | 0.00% | Perfect Generalization (100% Fit) |
| **Appointment → Prescription → Pharmacy** | 9 | 5 | 0 | 0 | 0.00% | 0 | 0.00% | Perfect Generalization (100% Fit) |

### Key Architectural Insights:
1. **Novel Sequences Perfectly Accepted Across Structured Pathways:** Across the five structured clinical pathways, exactly **27 holdout cases** possessed activity sequence variants that were completely absent from the 80% discovery partition (13 cases in Lab, 5 in Imaging, 9 in Lab + Imaging). **Zero of these 27 cases failed alignment**; all 27 achieved 100.00% trace fitness. This confirms that the Inductive Miner Petri nets model concurrent transitions (e.g., parallel lab orders and imaging examinations) that accommodate variable execution orderings without constraint violations.
2. **Novel Variants in Ambiguous Encounters and Cohort Totals:** In `Ambiguous Source Flow`, 49 holdout cases (19.92% of the cohort) exhibited novel variants. Of these 49 cases, **48 cases (97.96%) aligned with 100.00% fitness**, and exactly 1 case had deviations. Across the entire six evaluated model categories, a total of **76 novel-variant cases** occurred (27 across structured pathways + 49 in ambiguous encounters), of which **75 cases (98.68%)** aligned with 100.00% fitness. This demonstrates that variant novelty does not imply non-conformance; the discovered process models generalize to permit valid concurrent interleavings and loops not observed as monolithic discovery traces.

---

## 7. Execution Performance, Runtimes & Sampling Verification

The complete alignment suite across 3,051 holdout cases and 14,643 events executed in **~5.5 seconds** combining independent calls to `pm4py.fitness_alignments` and `pm4py.conformance_diagnostics_alignments`:

| Workflow Category | Evaluated Cases | Evaluated Events | Total Alignment Runtime (s) | Fitness API (s) | Diagnostics API (s) | Evaluation Mode | Failed Evaluations | Incomplete Evaluations | Computational Feasibility |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| **Appointment → Prescription** | 1,000 | 2,014 | 0.036s | 0.019s | 0.017s | Completed (Sampled n=1,000) | 0 | 0 | High (Completed) |
| **Appointment → Prescription → Lab** | 960 | 6,037 | 0.339s | 0.178s | 0.161s | Completed (Full Holdout) | 0 | 0 | High (Completed) |
| **Appointment → Prescription → Imaging** | 757 | 3,089 | 0.100s | 0.048s | 0.052s | Completed (Full Holdout) | 0 | 0 | High (Completed) |
| **Ambiguous Source Flow (Multi-Category Encounter)** | 246 | 2,988 | 6.012s | 2.998s | 3.014s | Completed (Full Holdout) | 0 | 0 | High (Completed) |
| **Appointment → Prescription → Lab + Imaging** | 69 | 395 | 0.126s | 0.077s | 0.049s | Completed (Full Holdout) | 0 | 0 | High (Completed) |
| **Appointment → Prescription → Pharmacy** | 19 | 120 | 0.023s | 0.012s | 0.011s | Completed (Full Holdout) | 0 | 0 | High (Completed) |
| **Appointment → Prescription → Imaging + Pharmacy** | 0 | 0 | N/A | N/A | N/A | Unavailable (< 30 cases) | 0 | 0 | High (Completed) |
| **Appointment → Prescription → Lab + Pharmacy** | 0 | 0 | N/A | N/A | N/A | Unavailable (< 30 cases) | 0 | 0 | High (Completed) |
| **Total Pipeline Performance** | **3,051** | **14,643** | **6.636s** | **3.332s** | **3.304s** | **Fully Evaluated** | **0** | **0** | **Optimal** |

---

## 8. Petri Net Soundness Limitations Inherited from Step 3

Conformance checking requires an accepting Petri net with defined initial and final markings. While all six models executed alignments without error, formal soundness limitations documented in Step 3 are strictly preserved:

| Workflow Category | Places | Transitions | Arcs | Workflow Net Structure | Formal WOFLAN Soundness Verification | Inductive Miner Construction Soundness | Alignment Suitability |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- | :---: |
| **Appointment → Prescription** | 8 | 8 | 18 | `True` | **Verified Sound** (WOFLAN passed: True) | Guaranteed Sound by Construction | Verified & Executed |
| **Appointment → Prescription → Lab** | 10 | 12 | 26 | `True` | **Verified Sound** (WOFLAN passed: True) | Guaranteed Sound by Construction | Verified & Executed |
| **Appointment → Prescription → Imaging** | 12 | 12 | 30 | `True` | **Verified Sound** (WOFLAN passed: True) | Guaranteed Sound by Construction | Verified & Executed |
| **Ambiguous Source Flow** | 29 | 37 | 82 | `True` | **Unverified / Unavailable** (State Explosion without PuLP) | Guaranteed Sound by Construction | Executed (`easy_soundness` passed) |
| **Lab + Imaging** | 17 | 20 | 46 | `True` | **Unverified / Unavailable** (State Explosion without PuLP) | Guaranteed Sound by Construction | Executed (`easy_soundness` passed) |
| **Pharmacy** | 10 | 13 | 26 | `True` | **Verified Sound** (WOFLAN passed: True) | Guaranteed Sound by Construction | Verified & Executed |

### Clarification on Soundness and Easy Soundness:
- **Formal Soundness (WOFLAN):** Proves the absence of deadlocks, absence of dead transitions, and proper termination from all reachable states. For the two complex models (`Ambiguous Source Flow` and `Lab + Imaging`), formal WOFLAN state-space reachability graph construction remains unverified due to state explosion in the default SciPy LP solver without PuLP.
- **Easy Soundness Check in PM4Py:** Before computing alignments, PM4Py executes `check_easy_soundness_net_in_fin_marking()`. All six models successfully passed this check, confirming that at least one firing sequence leads from the initial marking to the final marking.
- **Construction Soundness:** By mathematical design, the Inductive Miner guarantees soundness through recursive block structuring over sequence, choice, parallel, and loop operators.

---

## 9. Output Datasets & Privacy Governance

Three aggregate CSV datasets were generated and validated in `data/processed/`:
1. [`pathway_alignment_quality.csv`](file:///d:/Care%20Flow/data/processed/pathway_alignment_quality.csv): 8 records summarizing standard PM4Py alignment fitness (exact and rounded), raw alignment costs, and deviation totals per workflow category.
2. [`pathway_alignment_deviations.csv`](file:///d:/Care%20Flow/data/processed/pathway_alignment_deviations.csv): 36 records providing category-level summaries and detailed activity-level breakdowns of synchronous, log-only, model-only, and silent transitions.
3. [`pathway_alignment_performance.csv`](file:///d:/Care%20Flow/data/processed/pathway_alignment_performance.csv): 8 records tracking runtimes (standard fitness API and diagnostics API), sampling parameters, variant novelty counts, and formal soundness verification statuses.

> [!CAUTION]
> **Privacy & Anonymization Audit:**
> In accordance with CareFlow safety rules, all generated CSV files and Markdown reports contain **zero patient identifiers, appointment IDs, case IDs, raw event timestamps, or doctor names**. Per-trace alignment objects were retained in memory only during analysis and were never written to disk. All CSV files are locally Git-ignored under `.gitignore:32:*.csv`.

---

## 10. Downstream Transition to Phase 3, Step 5

With control-flow conformance checking and alignment analysis successfully established, the pipeline is prepared to advance to **Phase 3, Step 5: Performance & Bottleneck Analysis**:
1. **Transition from Control Flow to Time:** Control-flow conformance is now fully benchmarked. Step 5 will evaluate temporal dynamics, including case throughput times, queue waiting intervals, and activity service durations.
2. **Timestamp Duration Calculations:** Derive exact elapsed times between `Start` and `End` lifecycle events for Laboratory, Imaging, and Pharmacy activities.
3. **Synthetic Contextualization:** Reconcile observed synthetic turnaround times with realistic healthcare operational ranges, documenting how synthetic generator artifacts affect bottleneck interpretations.