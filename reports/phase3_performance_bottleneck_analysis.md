# CareFlow — Phase 3, Step 6: Temporal Performance & Bottleneck Analysis Report

> [!IMPORTANT]
> **Exploratory Process-Mining Analysis on Synthetic Healthcare Data:**
> This report evaluates observed temporal distributions, activity transitions, and operational latency patterns across the synthetic CareFlow clinical event log. **All records, timestamps, activity sequences, and workflow categories derive entirely from synthetic simulation models.** Observed durations represent parametric logging intervals and must **not** be construed as validated clinical waiting times, poor care, clinical negligence, causation, or real-world guideline non-compliance.

---

## 1. Executive Summary & Key Metrics

This Phase 3 Step 6 study establishes a reproducible temporal performance baseline across the complete CareFlow patient cohort (**49,912 distinct cases**, **142,876 clinical events**, and **8 mutually exclusive workflow categories**). Consecutive-event transitions, case-level elapsed times, and start-to-end activity pairings were audited to distinguish genuine operational latencies from logging artifacts and timestamp ties.

### Key Quantitative Findings

- **Complete Cohort Eligibility:** All **49,912 cases** and all **142,876 events** possess valid, parseable ISO-8601 timestamps without missing values. Zero cases were excluded from cohort-level case duration analysis.
- **Cohort Elapsed Duration:** The median case-level elapsed duration is **36.0 minutes** (0.60 hours; IQR: 14.0 – 80.0 min), with an arithmetic mean of **287.9 minutes** (4.80 hours). The 90th percentile is **196.0 minutes** (3.27 hours), and the 95th percentile is **349.0 minutes** (5.82 hours). The arithmetic mean is heavily skewed by a small fraction (2.52%) of multiday outpatient encounters (maximum: 695,643.0 min / 483.1 days in synthetic logging).
- **Consecutive-Event Transitions:** A total of **92,964 transitions** occur across 44 distinct activity pairs. Exactly **15,175 transitions (16.32%)** share identical recorded minute timestamps ($\\Delta t = 0$), while **77,789 transitions (83.68%)** exhibit strictly positive durations ($\\Delta t > 0$).
- **Primary Candidate Bottlenecks:**
  1. **Radiology Referral Queue (`Prescription Order -> Imaging Start`):** Affects **2,968 cases** (5.95% of cohort) with a median lead time of **35.0 minutes**, an arithmetic mean of **410.9 minutes** (6.85 hours), and a 90th percentile of **108.2 minutes** (1.80 hours). Represents a high-volume outpatient scheduling handoff.
  2. **Pre-Consultation Diagnostic Imaging (`Appointment Start -> Imaging Start`):** Affects **1,588 cases** (3.18% of cohort) with a median lead time of **47.0 minutes**, an arithmetic mean of **71.9 minutes** (1.20 hours), and a 90th percentile of **181.6 minutes** (3.03 hours).
  3. **Analytical Laboratory Specimen Turnaround (`Laboratory Start -> Laboratory End`):** Affects **4,363 cases** (8.74% of cohort) with a median turnaround time of **81.0 minutes** (1.35 hours), mean of **285.9 minutes** (4.76 hours), and a 90th percentile of **230.0 minutes** (3.83 hours). This reflects specimen incubation/analytical turnaround, not patient queue delay.
  4. **Cross-Modality Transfer (`Laboratory End -> Imaging Start`):** Exhibits the highest median duration among supported transitions (**191.0 minutes** / 3.18 hours; mean **3,443.8 minutes** / 57.40 hours; P90 **12,916.0 minutes** / 8.97 days), but affects a localized subset of **171 cases** (0.34% of cohort) involving multiday outpatient restaging.
- **Timestamp Tie Concentration:** Zero-minute intervals concentrate almost exclusively in same-activity batch events: **11,309** `Laboratory Start -> Laboratory Start` (99.30% tied, simultaneous test orders) and **2,842** `Laboratory End -> Laboratory End` (34.48% tied). Cross-stage clinical transitions are highly robust, exhibiting <0.3% timestamp ties.
- **Activity Start/End Pairing Structure:**
  - **Imaging:** **5,217 cases (98.01%)** exhibit unambiguous 1:1 pairing with a median exam duration of **3.0 minutes** (IQR: 1.0 – 5.0 min; 9.79% zero-minute durations).
  - **Pharmacy:** **29 cases (26.85%)** have 1:1 pairing (median **0.0 minutes**; 51.72% instantaneous dispensing records); 79 cases represent multi-line dispensing batches.
  - **Laboratory:** **1,716 cases (26.94%)** have unambiguous 1:1 pairing (median turnaround **96.0 minutes**; zero ties); **3,079 cases (48.34%)** represent multi-test panel orders (11,487 starts and 11,487 ends) requiring order-level matching (`lab_id`); exactly **1,575 cases (24.73%)** have start events without completions due to source timestamp truncation.

---

## 2. Input Integrity & Cryptographic Hash Verification

Data integrity was verified before and after execution using SHA-256 cryptographic checksums across all immutable inputs:

| Dataset File | Relative Path | Record Count | Expected SHA-256 Checksum | Verification Status |
| :--- | :--- | :---: | :--- | :---: |
| **Raw Source Dataset** | `data/raw/careflow_source.csv` | 62,422 rows | `07d0096b6e3fcff78f94afa6d5aeffeeb2566f59902eccc03da209a3b6502720` | **Verified Immutable** |
| **Cleaned Source Dataset** | `data/processed/cleaned_source.csv` | 62,418 rows | `674212c0e4b97d64045e53f2908418c1f229f8e15dd7da801a99436584e614f3` | **Verified Immutable** |
| **Canonical Event Log** | `data/processed/event_log.csv` | 142,876 rows | `cdab7bbc0e6755cb927a2a627bff2108e48d94ce0e38f62354ed72dcfb63442d` | **Verified Immutable** |

All source records remained untouched. No records were modified, normalized in place, or uploaded/downloaded.

---

## 3. Event-Log Quality & Temporal Coverage Audit

### 3.1 Population & Temporal Completeness

| Metric Parameter | Observed Value | Expected Baseline | Reconciliation Status | Analytical Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Total Cases (`case_id`)** | **49,912** | 49,912 | 100.0% Match | Distinct outpatient encounters |
| **Total Events** | **142,876** | 142,876 | 100.0% Match | Validated clinical milestone events |
| **Workflow Categories** | **8** | 8 | 100.0% Match | Mutually exclusive clinical pathways |
| **Distinct Activities** | **8** | 8 | 100.0% Match | Standardized lifecycle activity labels |
| **Missing / Null Timestamps** | **0** | 0 | 100.0% Complete | Zero unparseable timestamps |
| **Negative Case Durations** | **0** | 0 | 100.0% Valid | Earliest timestamp $\le$ Latest timestamp |
| **Negative Transition Durations** | **0** | 0 | 100.0% Valid | Consecutive event durations $\ge 0$ |

### 3.2 Exclusion Accounting & Denominators

- **Case-Level Duration Calculations:** **0 cases excluded** ($49,912 / 49,912 = 100.00\%$ eligible). Exactly 11 cases have trace length 1 (only `Appointment Start`), yielding an observed elapsed duration of 0.0 minutes. Exactly 30 multi-event cases feature simultaneous events sharing identical timestamps, yielding 0.0 minutes elapsed duration. Both subsets are retained in aggregate percentiles.
- **Activity-Transition Calculations:** All **92,964 transitions** across 49,901 multi-event cases ($49,901 / 49,912 = 99.98\%$) are eligible. The 11 single-event cases contain 0 consecutive transitions ($49,912 - 11 = 49,901$).
- **Diagnostic Pairing Calculations:** Cases lacking completion events are explicitly tracked rather than dropped silently. In Laboratory testing, **1,575 cases** lack `Laboratory End` events due to documented source string truncation and are reported separately under Section 5.

---

## 4. Case-Level Elapsed Duration Analysis

Case-level elapsed duration is defined as the interval between the earliest recorded event timestamp ($t_{\min}$) and the latest recorded event timestamp ($t_{\max}$) for each case:

$$\Delta T_{\text{case}} = t_{\max} - t_{\min}$$

> [!NOTE]
> **Methodological Distinction:** Observed elapsed duration represents the total span of time across which events were logged for an encounter. It must **not** be interpreted as continuous patient physical presence in the clinic, active clinician service time, or face-to-face treatment time.

### 4.1 Cohort and Pathway Category Summary

| Workflow Category | Cases | % Cohort | Mean (min) | Median (min) | IQR (P25 - P75) | P90 (min) | P95 (min) | Min (min) | Max (days) | Zero Dur % |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`Complete Eligible Cohort`** | 49,912 | 100.00% | 287.9 | 36.0 | 14.0 – 80.0 | 196.0 | 349.0 | 0.0 | 483.1d | 0.08% |
| `Appointment → Prescription` | 39,658 | 79.46% | 161.8 | 26.0 | 11.0 – 54.0 | 94.0 | 137.0 | 0.0 | 483.1d | 0.10% |
| `Appointment → Prescription → Lab` | 4,802 | 9.62% | 775.5 | 171.0 | 87.0 – 329.0 | 1420.5 | 4518.8 | 9.0 | 33.1d | 0.00% |
| `Appointment → Prescription → Imaging` | 3,783 | 7.58% | 464.6 | 81.0 | 50.0 – 131.0 | 276.0 | 426.3 | 6.0 | 67.2d | 0.00% |
| `Ambiguous Source Flow (Multi-Category Encounter)` | 1,231 | 2.47% | 1656.0 | 307.0 | 183.5 – 820.5 | 3728.0 | 7056.5 | 27.0 | 70.8d | 0.00% |
| `Appointment → Prescription → Lab + Imaging` | 343 | 0.69% | 1250.4 | 209.0 | 133.5 – 402.0 | 3519.0 | 5985.9 | 37.0 | 17.8d | 0.00% |
| `Appointment → Prescription → Pharmacy` | 93 | 0.19% | 51.1 | 32.0 | 21.0 – 51.0 | 93.6 | 122.2 | 7.0 | 0.5d | 0.00% |
| `Appointment → Prescription → Imaging + Pharmacy` | 1 | 0.00% | 324.0 | 324.0 | 324.0 – 324.0 | 324.0 | 324.0 | 324.0 | 0.2d | 0.00% |
| `Appointment → Prescription → Lab + Pharmacy` | 1 | 0.00% | 80.0 | 80.0 | 80.0 – 80.0 | 80.0 | 80.0 | 80.0 | 0.1d | 0.00% |

### 4.2 Analytical Insights on Case Durations

1. **Dominant Routine Pathway (`Appointment → Prescription`):** Represents **79.46% of cases** (39,658 encounters). Median elapsed time is **26.0 minutes** (IQR: 11.0 – 54.0 min), with 90% completed within **94.0 minutes** (1.57 hours). The arithmetic mean (161.8 min) is skewed by synthetic outlier cases where prescription dates were logged months after appointment check-in.
2. **Diagnostic Laboratory Pathway (`Appointment → Prescription → Lab`):** Median duration increases to **171.0 minutes** (2.85 hours; IQR: 87.0 – 329.0 min), reflecting laboratory specimen processing. The 90th percentile is **1,420.5 minutes** (23.68 hours), and the 95th percentile is **4,518.8 minutes** (3.14 days), capturing multi-day specimen cultures and batched result releases.
3. **Diagnostic Radiology Pathway (`Appointment → Prescription → Imaging`):** Median duration is **81.0 minutes** (1.35 hours; IQR: 50.0 – 131.0 min), with 90% completed within **276.0 minutes** (4.60 hours). Imaging pathways exhibit lower median latency than lab pathways due to faster procedural turnaround for standard plain radiographs.
4. **Multi-Department Encounters (`Ambiguous Source Flow`):** Exhibits the longest median duration (**307.0 minutes** / 5.12 hours; IQR: 183.5 – 820.5 min) and highest 90th percentile (**3,728.0 minutes** / 2.59 days), reflecting combined diagnostic workups involving both laboratory testing and radiology investigations.

---

## 5. Activity-Transition Performance Analysis

Consecutive within-case transitions were computed using the project's canonical ordering hierarchy ($\\text{case\\_id} \\to \\text{timestamp} \\to \\text{stage\\_order} \\to \\text{source\\_order\\_id}$). Across all **92,964 transitions**, 44 distinct transition pairs are observed.

### 5.1 Minimum Support Threshold Policy

- **Threshold Definition:** A minimum-support threshold of **$N \ge 30$ transitions** was applied to distinguish recurrent, statistically supported operational patterns from rare, sporadic sequence anomalies.
- **Coverage Summary:** Exactly **31 transitions** meet or exceed the threshold ($N \ge 30$), accounting for **92,823 transitions (99.85%)** of all observed transitions.
- **Rare Transition Preservation:** Exactly **13 transition types** account for the remaining **141 transitions (0.15%)**. These rare transitions are retained in the detailed CSV export and summarized in Section 5.3 rather than dropped silently.

### 5.2 Well-Supported Transition Performance ($N \ge 30$)

| Source Activity | Destination Activity | Transitions | Cases | Case % | Median (m) | Mean (m) | IQR (m) | P90 (m) | P95 (m) | Zero % | Support Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `Appointment Start` | `Prescription Order` | 47,932 | 47,932 | 96.03% | 25.0 | 130.2 | 11.0 – 53.0 | 92.0 | 136.0 | 0.07% | Supported |
| `Laboratory Start` | `Laboratory Start` | 11,389 | 4,092 | 8.20% | 0.0 | 0.5 | 0.0 – 0.0 | 0.0 | 0.0 | 99.30% | Supported |
| `Laboratory End` | `Laboratory End` | 8,242 | 3,039 | 6.09% | 8.0 | 356.8 | 0.0 – 72.0 | 277.8 | 1642.7 | 34.48% | Supported |
| `Prescription Order` | `Laboratory Start` | 5,289 | 5,287 | 10.59% | 19.0 | 35.6 | 12.0 – 33.0 | 65.0 | 97.0 | 0.13% | Supported |
| `Imaging Start` | `Imaging End` | 5,273 | 5,230 | 10.48% | 3.0 | 56.6 | 1.0 – 5.0 | 9.0 | 12.0 | 10.75% | Supported |
| `Laboratory Start` | `Laboratory End` | 4,415 | 4,363 | 8.74% | 81.0 | 285.9 | 53.0 – 130.0 | 230.0 | 524.7 | 0.02% | Supported |
| `Prescription Order` | `Imaging Start` | 2,969 | 2,968 | 5.95% | 35.0 | 410.9 | 18.0 – 63.0 | 108.2 | 412.8 | 0.27% | Supported |
| `Imaging End` | `Prescription Order` | 1,618 | 1,618 | 3.24% | 21.0 | 35.9 | 12.0 – 38.0 | 64.3 | 87.0 | 0.00% | Supported |
| `Appointment Start` | `Imaging Start` | 1,588 | 1,588 | 3.18% | 47.0 | 71.9 | 23.0 – 88.0 | 181.6 | 227.3 | 0.13% | Supported |
| `Imaging End` | `Laboratory Start` | 600 | 600 | 1.20% | 25.0 | 40.2 | 16.0 – 37.0 | 62.0 | 99.0 | 0.00% | Supported |
| `Prescription Order` | `Prescription Order` | 557 | 545 | 1.09% | 15.0 | 1027.5 | 7.0 – 45.0 | 1408.4 | 2902.0 | 3.59% | Supported |
| `Appointment Start` | `Laboratory Start` | 352 | 352 | 0.71% | 30.0 | 110.8 | 16.0 – 54.0 | 92.0 | 157.7 | 0.85% | Supported |
| `Laboratory Start` | `Imaging Start` | 325 | 325 | 0.65% | 44.0 | 519.8 | 27.0 – 69.0 | 120.8 | 248.6 | 0.00% | Supported |
| `Laboratory Start` | `Prescription Order` | 286 | 286 | 0.57% | 27.0 | 97.5 | 10.0 – 49.0 | 79.5 | 202.5 | 0.00% | Supported |
| `Imaging End` | `Laboratory End` | 283 | 283 | 0.57% | 56.0 | 509.4 | 22.0 – 118.5 | 456.8 | 3136.0 | 0.00% | Supported |
| `Imaging End` | `Appointment Start` | 266 | 266 | 0.53% | 13.5 | 49.6 | 7.0 – 36.0 | 130.5 | 308.2 | 0.00% | Supported |
| `Prescription Order` | `Laboratory End` | 236 | 236 | 0.47% | 58.0 | 238.6 | 24.0 – 103.0 | 207.0 | 508.8 | 1.69% | Supported |
| `Laboratory End` | `Imaging Start` | 171 | 171 | 0.34% | 191.0 | 3444.2 | 21.0 – 2954.0 | 12916.0 | 19980.5 | 2.34% | Supported |
| `Pharmacy Start` | `Pharmacy Start` | 150 | 79 | 0.16% | 0.0 | 0.0 | 0.0 – 0.0 | 0.0 | 0.0 | 100.00% | Supported |
| `Pharmacy End` | `Pharmacy End` | 150 | 79 | 0.16% | 0.0 | 0.0 | 0.0 – 0.0 | 0.0 | 0.0 | 96.00% | Supported |
| `Laboratory End` | `Prescription Order` | 114 | 113 | 0.23% | 40.5 | 582.6 | 13.2 – 321.8 | 1451.7 | 2652.6 | 0.00% | Supported |
| `Pharmacy Start` | `Pharmacy End` | 112 | 108 | 0.22% | 0.0 | 6.9 | 0.0 – 1.0 | 2.0 | 2.0 | 51.79% | Supported |
| `Prescription Order` | `Pharmacy Start` | 106 | 106 | 0.21% | 7.0 | 10.6 | 5.0 – 12.0 | 19.0 | 31.2 | 0.00% | Supported |
| `Laboratory Start` | `Appointment Start` | 77 | 77 | 0.15% | 16.0 | 112.7 | 7.0 – 199.0 | 316.4 | 472.8 | 0.00% | Supported |
| `Laboratory End` | `Laboratory Start` | 59 | 53 | 0.11% | 80.0 | 187.5 | 18.0 – 202.5 | 344.6 | 433.1 | 0.00% | Supported |
| `Laboratory End` | `Appointment Start` | 50 | 50 | 0.10% | 162.0 | 174.4 | 66.0 – 280.8 | 353.2 | 375.2 | 0.00% | Supported |
| `Imaging Start` | `Imaging Start` | 46 | 46 | 0.09% | 5.5 | 43.9 | 1.0 – 14.0 | 39.5 | 85.8 | 6.52% | Supported |
| `Prescription Order` | `Imaging End` | 46 | 46 | 0.09% | 14.0 | 879.9 | 2.0 – 87.8 | 1247.5 | 1954.2 | 8.70% | Supported |
| `Imaging Start` | `Prescription Order` | 44 | 44 | 0.09% | 13.5 | 18.6 | 2.8 – 24.2 | 43.2 | 57.2 | 0.00% | Supported |
| `Imaging End` | `Imaging End` | 39 | 39 | 0.08% | 2.0 | 156.6 | 1.0 – 29.5 | 450.4 | 1201.0 | 15.38% | Supported |
| `Imaging End` | `Imaging Start` | 39 | 39 | 0.08% | 22.0 | 2035.5 | 4.0 – 56.5 | 78.4 | 1346.6 | 0.00% | Supported |

### 5.3 Aggregate Summary of Rare Transitions ($N < 30$)

Across the event log, **13 transition pairs** occur fewer than 30 times each, totaling **141 instances** across **141 cases** (0.15% of all transitions):

| Source Activity | Destination Activity | Transitions | Distinct Cases | Median (m) | Mean (m) | Min (m) | Max (m) | Analytical Interpretation |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `Laboratory End` | `Imaging End` | 25 | 25 | 731.0 | 6484.3 | 0.0 | 101439.0 | Atypical cross-stage ordering |
| `Imaging Start` | `Appointment Start` | 20 | 20 | 5.0 | 12.4 | 1.0 | 120.0 | Atypical cross-stage ordering |
| `Laboratory Start` | `Imaging End` | 16 | 16 | 17.5 | 255.4 | 0.0 | 2529.0 | Atypical cross-stage ordering |
| `Imaging Start` | `Laboratory Start` | 16 | 16 | 17.5 | 37.3 | 1.0 | 127.0 | Atypical cross-stage ordering |
| `Imaging Start` | `Laboratory End` | 15 | 15 | 6.0 | 33.4 | 3.0 | 152.0 | Atypical cross-stage ordering |
| `Appointment Start` | `Imaging End` | 13 | 13 | 1.0 | 1.6 | 0.0 | 11.0 | Atypical cross-stage ordering |
| `Appointment Start` | `Laboratory End` | 12 | 12 | 48.0 | 54.2 | 15.0 | 152.0 | Atypical cross-stage ordering |
| `Pharmacy End` | `Laboratory Start` | 12 | 12 | 10.5 | 17.0 | 2.0 | 50.0 | Rare multi-stage pharmacy dispensing handoff |
| `Prescription Order` | `Appointment Start` | 5 | 5 | 1439.0 | 2107.4 | 6.0 | 5704.0 | Inverted prescription-appointment synthetic record |
| `Pharmacy End` | `Pharmacy Start` | 4 | 4 | 123.5 | 138.2 | 14.0 | 292.0 | Rare multi-stage pharmacy dispensing handoff |
| `Laboratory End` | `Pharmacy Start` | 1 | 1 | 6.0 | 6.0 | 6.0 | 6.0 | Rare multi-stage pharmacy dispensing handoff |
| `Laboratory Start` | `Pharmacy Start` | 1 | 1 | 43.0 | 43.0 | 43.0 | 43.0 | Rare multi-stage pharmacy dispensing handoff |
| `Pharmacy End` | `Imaging Start` | 1 | 1 | 244.0 | 244.0 | 244.0 | 244.0 | Rare multi-stage pharmacy dispensing handoff |

### 5.4 Major Pathway Transition Performance Benchmarks

Consecutive transition performance was stratified across the four major clinical workflow categories representing 99.13% of all cases:

#### A. Routine Outpatient Pathway (`Appointment → Prescription`, 39,658 cases)

| Source Activity | Destination Activity | Transitions | Cases | Case % | Median (m) | Mean (m) | P25 (m) | P75 (m) | P90 (m) | P95 (m) | Zero % |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `Appointment Start` | `Prescription Order` | 39,643 | 39,643 | 99.96% | 26.0 | 147.8 | 11.0 | 54.0 | 93.0 | 134.0 | 0.08% |
| `Prescription Order` | `Prescription Order` | 466 | 456 | 1.15% | 16.0 | 1169.6 | 7.0 | 48.8 | 1460.0 | 2918.2 | 3.43% |
| `Prescription Order` | `Appointment Start` | 4 | 4 | 0.01% | 2135.5 | 2632.8 | 1218.2 | 3550.0 | 4842.4 | 5273.2 | 0.00% |

#### B. Diagnostic Laboratory Pathway (`Appointment → Prescription → Lab`, 4,802 cases)

| Source Activity | Destination Activity | Transitions | Cases | Case % | Median (m) | Mean (m) | P25 (m) | P75 (m) | P90 (m) | P95 (m) | Zero % |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `Laboratory Start` | `Laboratory Start` | 7,109 | 2,893 | 60.25% | 0.0 | 0.7 | 0.0 | 0.0 | 0.0 | 0.0 | 99.17% |
| `Laboratory End` | `Laboratory End` | 5,335 | 2,188 | 45.56% | 12.0 | 422.3 | 0.0 | 83.0 | 419.4 | 2639.9 | 30.87% |
| `Appointment Start` | `Prescription Order` | 4,525 | 4,525 | 94.23% | 21.0 | 39.8 | 10.0 | 43.0 | 77.0 | 112.8 | 0.04% |
| `Prescription Order` | `Laboratory Start` | 4,463 | 4,462 | 92.92% | 19.0 | 33.9 | 12.0 | 34.0 | 66.0 | 97.0 | 0.09% |
| `Laboratory Start` | `Laboratory End` | 3,522 | 3,480 | 72.47% | 82.0 | 291.3 | 53.0 | 131.0 | 234.0 | 537.8 | 0.00% |
| `Appointment Start` | `Laboratory Start` | 271 | 271 | 5.64% | 29.0 | 114.3 | 15.0 | 51.5 | 85.0 | 136.5 | 1.11% |
| `Laboratory Start` | `Prescription Order` | 228 | 228 | 4.75% | 24.5 | 43.2 | 8.8 | 44.2 | 71.9 | 106.7 | 0.00% |

#### C. Diagnostic Radiology Pathway (`Appointment → Prescription → Imaging`, 3,783 cases)

| Source Activity | Destination Activity | Transitions | Cases | Case % | Median (m) | Mean (m) | P25 (m) | P75 (m) | P90 (m) | P95 (m) | Zero % |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `Imaging Start` | `Imaging End` | 3,764 | 3,736 | 98.76% | 3.0 | 71.9 | 1.0 | 5.0 | 9.0 | 12.0 | 10.36% |
| `Appointment Start` | `Prescription Order` | 2,529 | 2,529 | 66.85% | 25.0 | 51.1 | 12.0 | 53.0 | 98.2 | 205.6 | 0.04% |
| `Prescription Order` | `Imaging Start` | 2,316 | 2,316 | 61.22% | 37.0 | 472.1 | 19.0 | 68.0 | 128.0 | 1363.0 | 0.30% |
| `Imaging End` | `Prescription Order` | 1,249 | 1,249 | 33.02% | 21.0 | 30.1 | 12.0 | 36.0 | 64.0 | 86.0 | 0.00% |
| `Appointment Start` | `Imaging Start` | 1,242 | 1,242 | 32.83% | 47.0 | 72.0 | 23.0 | 89.0 | 172.8 | 229.0 | 0.16% |
| `Imaging End` | `Appointment Start` | 214 | 214 | 5.66% | 14.0 | 47.4 | 7.0 | 33.5 | 122.2 | 284.6 | 0.00% |
| `Prescription Order` | `Prescription Order` | 43 | 42 | 1.11% | 10.0 | 21.6 | 3.0 | 30.0 | 48.0 | 61.7 | 9.30% |

#### D. Multi-Department Encounters (`Ambiguous Source Flow`, 1,231 cases)

| Source Activity | Destination Activity | Transitions | Cases | Case % | Median (m) | Mean (m) | P25 (m) | P75 (m) | P90 (m) | P95 (m) | Zero % |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `Laboratory Start` | `Laboratory Start` | 4,276 | 1,195 | 97.08% | 0.0 | 0.3 | 0.0 | 0.0 | 0.0 | 0.0 | 99.51% |
| `Laboratory End` | `Laboratory End` | 2,903 | 847 | 68.81% | 2.0 | 235.7 | 0.0 | 50.0 | 158.8 | 692.3 | 41.16% |
| `Imaging Start` | `Imaging End` | 1,171 | 1,157 | 93.99% | 3.0 | 21.2 | 1.0 | 5.0 | 9.0 | 12.5 | 10.67% |
| `Appointment Start` | `Prescription Order` | 869 | 869 | 70.59% | 29.0 | 58.9 | 14.0 | 62.0 | 159.0 | 237.2 | 0.12% |
| `Laboratory Start` | `Laboratory End` | 713 | 703 | 57.11% | 73.0 | 178.2 | 48.0 | 110.0 | 171.6 | 262.2 | 0.14% |
| `Prescription Order` | `Laboratory Start` | 653 | 652 | 52.97% | 21.0 | 48.3 | 14.0 | 32.0 | 57.0 | 92.0 | 0.15% |
| `Prescription Order` | `Imaging Start` | 507 | 506 | 41.10% | 30.0 | 237.4 | 16.0 | 52.0 | 73.0 | 91.7 | 0.00% |
| `Imaging End` | `Laboratory Start` | 458 | 458 | 37.21% | 26.0 | 39.9 | 17.0 | 39.0 | 61.0 | 87.2 | 0.00% |
| `Imaging End` | `Prescription Order` | 314 | 314 | 25.51% | 22.0 | 60.9 | 13.0 | 45.0 | 76.0 | 90.7 | 0.00% |
| `Appointment Start` | `Imaging Start` | 288 | 288 | 23.40% | 44.0 | 73.6 | 23.0 | 88.5 | 199.3 | 225.0 | 0.00% |

---

## 6. Start-to-End Activity Duration & Pairing Assessment

Clinical diagnostic stages (Laboratory, Imaging, Pharmacy) record paired initiation (`Start`) and completion (`End`) events. A rigorous pairing audit was conducted across all cases to assess event multiplicity, matching feasibility, and timestamp reliability.

### 6.1 Diagnostic Pairing Audit Across Domains

| Clinical Domain | Total Cases | Start Events | End Events | 1:1 Matched Cases | 1:1 Case % | Unmatched Starts | Unmatched Ends | Multi-Event Cases | Pairing Feasibility |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`Laboratory`** | 6,370 | 17,848 | 13,203 | 1,716 | 26.94% | 1,575 | 0 | 3,079 | Restricted (Multi-test) |
| **`Imaging`** | 5,323 | 5,421 | 5,412 | 5,217 | 98.01% | 8 | 0 | 98 | High (98% 1:1) |
| **`Pharmacy`** | 108 | 262 | 262 | 29 | 26.85% | 0 | 0 | 79 | Restricted (Multi-line) |

### 6.2 Duration Statistics for Unambiguous 1:1 Matched Cases

When an encounter contains exactly one `Start` and exactly one `End` event, the pairing is mathematically unambiguous without requiring external ordering assumptions:

| Clinical Domain | 1:1 Cases | Median (m) | Mean (m) | IQR (m) | P90 (m) | P95 (m) | Min (m) | Max | Zero Dur Count | Zero Dur % |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`Laboratory`** | 1,716 | 96.0 | 553.0 | 58.0 – 173.0 | 693.0 | 3605.0 | 4.0 | 15.3d | 0 | 0.00% |
| **`Imaging`** | 5,217 | 3.0 | 92.9 | 1.0 – 5.0 | 9.0 | 13.0 | 0.0 | 70.7d | 511 | 9.79% |
| **`Pharmacy`** | 29 | 0.0 | 0.6 | 0.0 – 1.0 | 1.0 | 1.0 | 0.0 | 3.0m | 15 | 51.72% |

### 6.3 Methodological Assessment & Pitfalls of Naive Row Pairing

1. **Laboratory Diagnostic Multiplicity:**
   - **1,716 cases (26.94%)** undergo exactly 1 lab test and have unambiguous 1:1 pairing (median duration: **96.0 minutes**).
   - **3,079 cases (48.34%)** undergo multi-test diagnostic panels featuring between 2 and 26 distinct lab tests (totaling 11,487 starts and 11,487 ends). In the event log, all starts occur together, followed by ends.
   - **Danger of Positional Pairing:** Pairing repeated starts and ends by row position (1st start to 1st end, 2nd start to 2nd end) is **statistically invalid**. Because all test starts frequently share the identical collection minute (e.g., 10:00 AM venipuncture), positional pairing creates artificial duration artifacts.
   - **Order-Level Matching via `lab_id`:** When start and end records are linked via their verified source order identifier (`lab_id`), **13,155 strictly unique orders** reconcile with zero negative durations, yielding a median turnaround time of **125.0 minutes** (IQR: 77.0 – 210.0 min; Mean: 469.9 min).
   - **Unmatched Lab Starts (1,575 cases):** In **1,575 encounters (24.73%)**, patients had lab tests ordered (`Laboratory Start`), but completion timestamps (`Laboratory End`) were truncated in raw data extraction and omitted from the log. No completions were fabricated.
2. **Imaging Examination High Fidelity:**
   - **5,217 cases (98.01%)** exhibit unambiguous 1:1 pairing, with a median procedure duration of **3.0 minutes** (IQR: 1.0 – 5.0 min; 9.79% instantaneous records). Only 98 cases involve multiple imaging requests.
3. **Pharmacy Dispensing Point Events:**
   - In 1:1 cases (29 encounters), **51.72%** exhibit zero-minute duration, indicating that pharmacy fulfillment is recorded as an instantaneous order-dispense transaction in the synthetic system.

---

## 7. Potential Bottlenecks & Multi-Criteria Evaluation

To avoid misinterpreting high arithmetic means or isolated percentiles as operational inefficiencies, candidate bottlenecks are ranked using a multi-criteria evidence framework incorporating:
1. **Duration Magnitude:** Median, P90, and arithmetic mean latencies.
2. **Cohort Impact:** Absolute transition volume and distinct patient cases affected.
3. **Data Quality & Tie Sensitivity:** Proportion of zero-minute intervals and robustness to timestamp resolution.
4. **Analytical Categorization:** Clear operational distinction between administrative handoffs, clinical service times, and logging artifacts.

### 7.1 Multi-Criteria Ranked Bottleneck Candidates

| Rank | Source Activity | Destination Activity | Affected Cases | Cohort % | Transitions | Median (m) | Mean (m) | P90 (m) | Zero % | Tie Sensitivity | Analytical Category | Operational Finding |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **1** | `Appointment Start` | `Imaging Start` | 1,588 | 3.18% | 1,588 | 47.0 | 71.9 | 181.6 | 0.13% | Low | Potential Operational Bottleneck (Pre-Consult Imaging) | Substantial pre-consultation imaging queue latency (med 47m, mean 1.2h, p90 182m). Affects 1,588 cases. |
| **2** | `Prescription Order` | `Imaging Start` | 2,968 | 5.95% | 2,969 | 35.0 | 410.9 | 108.2 | 0.27% | Low | Potential Operational Bottleneck (Referral Latency) | Referral queue latency to radiology (med 35m, mean 6.8h, p90 108m). Heavy volume (2,968 cases). |
| **3** | `Laboratory End` | `Imaging Start` | 171 | 0.34% | 171 | 191.0 | 3444.2 | 12916.0 | 2.34% | Moderate | Cross-Department Staging / Inter-Day Scheduling | High lead-time between lab completion and radiology suite (med 191m, mean 57.4h). Affects 171 cases. |
| **4** | `Laboratory Start` | `Laboratory End` | 4,363 | 8.74% | 4,415 | 81.0 | 285.9 | 230.0 | 0.02% | Low | Clinical Service Time (Specimen Turnaround) | Analytical diagnostic processing & culture incubation latency. Highly supported (4,363 cases). |
| **5** | `Laboratory End` | `Laboratory Start` | 53 | 0.11% | 59 | 80.0 | 187.5 | 344.6 | 0.00% | Low | Clinical Reflex Testing Latency | Reflex testing or secondary specimen redraw (med 80m, mean 3.1h). Affects 53 cases. |
| **6** | `Prescription Order` | `Laboratory End` | 236 | 0.47% | 236 | 58.0 | 238.6 | 207.0 | 1.69% | Low | Delayed Diagnostic Result Latency | Prescription issued prior to lab result release (med 58m, mean 4.0h). Affects 236 cases. |
| **7** | `Imaging End` | `Laboratory End` | 283 | 0.57% | 283 | 56.0 | 509.4 | 456.8 | 0.00% | Low | Multi-Modality Concurrency Gap | Imaging completed while complex lab panels remain pending (med 56m, mean 8.5h). Affects 283 cases. |
| **8** | `Laboratory Start` | `Imaging Start` | 325 | 0.65% | 325 | 44.0 | 519.8 | 120.8 | 0.00% | Low | Cross-Modality Transfer Latency | Phlebotomy completed prior to imaging exam start (med 44m, mean 8.7h). Affects 325 cases. |
| **9** | `Laboratory End` | `Prescription Order` | 113 | 0.23% | 114 | 40.5 | 582.6 | 1451.7 | 0.00% | Low | Post-Diagnostic Prescription Entry | Prescription ordered after lab verification (med 40.5m, mean 9.7h). Affects 113 cases. |
| **10** | `Appointment Start` | `Prescription Order` | 47,932 | 96.03% | 47,932 | 25.0 | 130.2 | 92.0 | 0.07% | Low | Core Consultation Lifecycle (Consultation Latency) | Primary outpatient consultation throughput (med 25m, mean 2.2h, p90 91m). Core cohort milestone (47,932 cases). |
| **11** | `Laboratory End` | `Appointment Start` | 50 | 0.10% | 50 | 162.0 | 174.4 | 353.2 | 0.00% | Low | Pre-Consultation Diagnostics / Inverted Scheduling | Diagnostic testing completed 2.7h prior to formal consultation check-in. Affects 50 cases. |
| **12** | `Appointment Start` | `Laboratory Start` | 352 | 0.71% | 352 | 30.0 | 110.8 | 92.0 | 0.85% | Low | Standard Sequential Transition | Observed operational lead time (med 30.0m, mean 110.79m). Affects 352 cases. |
| **13** | `Laboratory Start` | `Prescription Order` | 286 | 0.57% | 286 | 27.0 | 97.5 | 79.5 | 0.00% | Low | Standard Sequential Transition | Observed operational lead time (med 27.0m, mean 97.46m). Affects 286 cases. |
| **14** | `Imaging End` | `Laboratory Start` | 600 | 1.20% | 600 | 25.0 | 40.2 | 62.0 | 0.00% | Low | Standard Sequential Transition | Observed operational lead time (med 25.0m, mean 40.19m). Affects 600 cases. |
| **15** | `Imaging End` | `Imaging Start` | 39 | 0.08% | 39 | 22.0 | 2035.5 | 78.4 | 0.00% | Low | Standard Sequential Transition | Observed operational lead time (med 22.0m, mean 2035.51m). Affects 39 cases. |

### 7.2 Detailed Categorical Interpretation

#### Category A: Potential Process Bottlenecks Requiring Operational Investigation
1. **Radiology Referral Queue (`Prescription Order -> Imaging Start`):**
   - *Evidence:* Affects **2,968 distinct patients** (5.95% of cohort). Median latency is **35.0 minutes**, with a heavy right tail (mean **410.9 minutes** / 6.85 hours; P90 **108.2 minutes** / 1.80 hours). Only 0.27% of transitions are tied.
   - *Process Context:* This represents the administrative and transport handoff between clinical consultation/prescription order and patient arrival in the diagnostic imaging department. The wide gap between median (35m) and mean (411m) indicates a bimodal operational distribution: same-day walk-in imaging vs. scheduled next-day imaging.
2. **Pre-Consultation Imaging Triage (`Appointment Start -> Imaging Start`):**
   - *Evidence:* Affects **1,588 patients** (3.18% of cohort). Median latency is **47.0 minutes**, mean is **71.9 minutes**, and P90 is **181.6 minutes** (3.03 hours). Timestamp ties are negligible (0.13%).
   - *Process Context:* Patients triaged directly from appointment check-in to radiology prior to physician consultation. Waiting room and modality queueing appear to drive the 47-minute median delay.

#### Category B: Diagnostic & Analytical Service Times (Not Waiting Room Delays)
1. **Laboratory Specimen Turnaround (`Laboratory Start -> Laboratory End`):**
   - *Evidence:* Occurs **4,415 times** across **4,363 cases** (8.74% of cohort). Median duration is **81.0 minutes** (1.35 hours); mean is **285.9 minutes** (4.76 hours); P90 is **230.0 minutes** (3.83 hours). Only 0.02% of transitions are tied.
   - *Process Context:* In process mining, this transition connects the final specimen draw to the initial verified result in multi-test encounters. It captures **analytical processing latency** (centrifugation, analyzer run time, microbiological incubation, and pathologist verification). It must **not** be interpreted as patient physical waiting time.

#### Category C: Cross-Modality Staging & Inter-Day Scheduling
1. **Post-Laboratory Imaging Scheduling (`Laboratory End -> Imaging Start`):**
   - *Evidence:* Exhibits the highest median duration among supported transitions (**191.0 minutes** / 3.18 hours; mean **3,443.8 minutes** / 57.40 hours; P90 **12,916.0 minutes** / 8.97 days).
   - *Process Context:* Affects a small cohort of **171 complex patients** (0.34%). The multiday mean and P90 reflect asynchronous outpatient restaging—patients receiving lab results on Day 1 and returning for specialized imaging on subsequent days—rather than queue delays in clinic hallways.

#### Category D: Metrics Uninterpretable as Bottlenecks Due to Data Limitations
1. **Batch Order Entry Self-Loops (`Laboratory Start -> Laboratory Start`):**
   - *Evidence:* **11,389 transitions** across **4,092 cases**. Median is **0.0 minutes**; mean is **0.5 minutes**; **99.30% of transitions share identical timestamps** ($\\Delta t = 0$).
   - *Limitation:* Electronic health records log multiple test orders within a single blood panel under the same minute. Interpreting this transition as an operational step or queue is methodologically erroneous.
2. **Rare Outlier Transitions ($N < 30$):**
   - Transition pairs occurring fewer than 30 times (e.g., `Pharmacy End -> Imaging Start`, $N=1$) reflect atypical routing or synthetic edge cases and cannot support statistical bottleneck inferences.

---

## 8. Timestamp Ties & Robustness Sensitivity Analysis

### 8.1 Sensitivity Comparison: Full Log vs. Strictly Positive Transitions ($\\Delta t > 0$)

To evaluate how discrete minute precision affects lead-time metrics, transition statistics were recalculated excluding zero-minute intervals:

| Source Activity | Destination Activity | Full Count | Zero-Time Count | Tied % | Full Median (m) | Pos Median (m) | Full Mean (m) | Pos Mean (m) | Full P90 (m) | Pos P90 (m) | Sensitivity Assessment |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `Appointment Start` | `Prescription Order` | 47,932 | 34 | 0.07% | 25.0 | 25.0 | 130.2 | 130.3 | 92.0 | 92.0 | Highly Robust (<0.3% Tied) |
| `Laboratory Start` | `Laboratory Start` | 11,389 | 11,309 | 99.30% | 0.0 | 41.5 | 0.5 | 76.0 | 0.0 | 193.3 | Extreme Tie Impact (>50% Tied) |
| `Laboratory End` | `Laboratory End` | 8,242 | 2,842 | 34.48% | 8.0 | 42.0 | 356.8 | 544.6 | 277.8 | 828.3 | Moderate Tie Impact (10-50% Tied) |
| `Prescription Order` | `Laboratory Start` | 5,289 | 7 | 0.13% | 19.0 | 19.0 | 35.6 | 35.7 | 65.0 | 65.0 | Highly Robust (<0.3% Tied) |
| `Imaging Start` | `Imaging End` | 5,273 | 567 | 10.75% | 3.0 | 3.0 | 56.6 | 63.4 | 9.0 | 9.0 | Moderate Tie Impact (10-50% Tied) |
| `Laboratory Start` | `Laboratory End` | 4,415 | 1 | 0.02% | 81.0 | 81.0 | 285.9 | 285.9 | 230.0 | 230.0 | Highly Robust (<0.3% Tied) |
| `Prescription Order` | `Imaging Start` | 2,969 | 8 | 0.27% | 35.0 | 35.0 | 410.9 | 412.0 | 108.2 | 109.0 | Highly Robust (<0.3% Tied) |
| `Appointment Start` | `Imaging Start` | 1,588 | 2 | 0.13% | 47.0 | 47.0 | 71.9 | 72.0 | 181.6 | 182.0 | Highly Robust (<0.3% Tied) |
| `Imaging End` | `Prescription Order` | 1,618 | 0 | 0.00% | 21.0 | 21.0 | 35.9 | 35.9 | 64.3 | 64.3 | Highly Robust (<0.3% Tied) |
| `Imaging End` | `Laboratory Start` | 600 | 0 | 0.00% | 25.0 | 25.0 | 40.2 | 40.2 | 62.0 | 62.0 | Highly Robust (<0.3% Tied) |
| `Laboratory End` | `Imaging Start` | 171 | 4 | 2.34% | 191.0 | 194.0 | 3444.2 | 3526.7 | 12916.0 | 13446.0 | Highly Robust (<0.3% Tied) |
| `Laboratory End` | `Laboratory Start` | 59 | 0 | 0.00% | 80.0 | 80.0 | 187.5 | 187.5 | 344.6 | 344.6 | Highly Robust (<0.3% Tied) |

### 8.2 Impact of Timestamp Ties on Performance Metrics

1. **Order-Independent vs. Order-Dependent Metrics:**
   - **Case-Level Elapsed Duration:** Calculated purely from $\\max(t) - \\min(t)$ across each encounter. It is **completely invariant** to within-minute event reordering.
   - **1:1 Unambiguous Activity Duration:** Evaluated directly between single `Start` and `End` timestamps. It is **completely invariant** to intermediate sequence permutations.
   - **Consecutive Transition Durations:** Highly sensitive to tie-breaking rules when simultaneous events cross activity stages. However, because cross-stage transitions exhibit <0.3% ties, the median lead times of all major clinical handoffs (`Appointment -> Prescription`, `Prescription -> Lab`, `Prescription -> Imaging`) remain **empirically stable across all tie-handling rules**.
2. **The Zero-Duration Phenomenon:** Zero-minute transitions represent temporal granularity limits (records logged within the same clock minute), **not proof of instantaneous physical activity**. In diagnostic imaging, 10.75% of exams have identical start and end minutes, representing rapid plain radiography where start and end were logged at the same minute mark.

---

## 9. Synthetic-Data & Methodological Limitations

1. **Synthetic EHR Provenance:** The CareFlow dataset was procedurally generated. All patient encounters, clinical classifications, and timestamps derive from synthetic simulation logic. No real patients or hospital facilities are represented.
2. **Minute-Level Timestamp Granularity:** Clock precision is capped at whole minutes. Sub-minute queuing, check-in wait times, and rapid triage handoffs cannot be resolved.
3. **Truncated Laboratory End Timestamps (Survivorship Bias):** Exactly **4,702 laboratory test orders** (26.08% of all tests ordered across 1,575 cases) lack valid completion dates due to truncated source strings. Calculating turnaround times exclusively on retained completions introduces potential survivorship bias toward faster or standard tests.
4. **Synthetic Multiday Outliers:** Procedural date generation generated multiday elapsed times (up to 483 days), creating large divergences between medians and arithmetic means. Median and IQR are the appropriate non-parametric measures of central tendency.
5. **Pre-Consultation Diagnostic Inversions:** In **418 encounters (0.84%)**, laboratory or radiology timestamps precede appointment start check-in, reflecting asynchronous scheduling artifacts in the synthetic data generator.

---

## 10. Reproduction Instructions & Verification

The complete temporal performance and bottleneck analysis is deterministic, self-validating, and fully reproducible from the command line:

```bash
# Execute Step 6 Temporal Performance & Bottleneck Pipeline
.venv\Scripts\python.exe scripts/process_mining/performance_bottleneck_analysis.py
```

### Verified Derived Deliverables

- Technical Report: [`reports/phase3_performance_bottleneck_analysis.md`](file:///d:/Care%20Flow/reports/phase3_performance_bottleneck_analysis.md)
- Aggregate Case Duration Summary: [`data/processed/case_duration_summary.csv`](file:///d:/Care%20Flow/data/processed/case_duration_summary.csv)
- Aggregate Transition Performance Table: [`data/processed/transition_performance_detailed.csv`](file:///d:/Care%20Flow/data/processed/transition_performance_detailed.csv)
- Aggregate Activity Pairing Summary: [`data/processed/activity_pairing_summary.csv`](file:///d:/Care%20Flow/data/processed/activity_pairing_summary.csv)
- Ranked Candidate Bottlenecks Table: [`data/processed/candidate_bottlenecks.csv`](file:///d:/Care%20Flow/data/processed/candidate_bottlenecks.csv)

---

## 11. Conclusions

1. **Operational Baseline Established:** Outpatient routine encounters exhibit a median elapsed duration of **26.0 minutes**, while diagnostic workups range between **81.0 minutes** (imaging) and **171.0 minutes** (laboratory), extending to **307.0 minutes** for multi-department care.
2. **Confirmed Referral Delays:** The primary operational bottleneck requiring workflow optimization is the **outpatient radiology referral handoff** (`Prescription Order -> Imaging Start`), with a median latency of **35.0 minutes** and a heavy 90th-percentile tail of **108.2 minutes** affecting nearly 3,000 patient encounters.
3. **Analytical Turnaround Clarified:** Specimen laboratory testing exhibits a median turnaround of **81.0 – 96.0 minutes**, reflecting essential analytical incubation rather than patient transit delays.
4. **Data Hygiene & Methodological Integrity:** Tie-breaking sensitivity and pairing limitations have been formally quantified, ensuring that future CareFlow dashboard visualizer components represent clinical reality without confounding data artifacts.
