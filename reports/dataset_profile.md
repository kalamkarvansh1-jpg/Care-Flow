# CareFlow — Phase 2, Step 1: Dataset Profiling Report

**Document Title:** Clinical Pathway Candidate Dataset Profiling & Data Quality Audit
**Target Dataset:** `data/raw/careflow_source.csv`
**Execution Context:** Healthcare Analytics & Process Mining Engineering
**Date of Audit:** October 16, 2026
**Status:** Completed — Prerequisite for Data Cleaning & Event-Log Transformation

---

## Executive Summary

This profiling report establishes an empirical baseline for the raw clinical workflow dataset `data/raw/careflow_source.csv` (10,306,961 bytes, 62,422 rows, 25 columns). The dataset records patient progression across outpatient consultations, prescription ordering, laboratory diagnostics, diagnostic imaging, and pharmacy dispensation.

The investigation confirms that the source dataset is well-structured in a denormalized wide-table format, with **`appointment_id`** identified as the only clinically and mathematically defensible process-mining case identifier. Key findings include:
- **Zero full-row duplicates**; 4 duplicate pairs (8 rows total) caused by duplicated laboratory order line items.
- **One completely empty column** (`Unnamed: 2`, 100% missing), originating from an empty header delimiter `, ,` in the raw CSV export.
- **High timestamp integrity across most stages**, with 100% parseable timestamps in standard `%m/%d/%Y %H:%M` format for appointment, prescription start/end, lab start, imaging start/end, and pharmacy start/end.
- **A critical data quality issue in `lab_end_datetime`**: 4,702 non-null records (26.08% of lab records) contain truncated strings (`MM:SS.f`) missing date and hour components.
- **52 prescription duration inversions** (`prescription_end_datetime` < `prescription_start_datetime`).
- **Confirmation that missing laboratory, imaging, and pharmacy records are valid clinical pathway branches**, not data omissions.

---

## 1. Dataset Overview

### 1.1 Structural Dimensions
- **Total Records (Rows):** 62,422
- **Total Attributes (Columns):** 25
- **File Size on Disk:** 10,306,961 bytes (~9.83 MB)
- **Delimited Structure:** Comma-separated values (CSV), UTF-8 / ASCII encoded with right-arrow (`→`) Unicode characters in pathway classifications.

### 1.2 Column Taxonomy & Inferred Dtypes

| Column Name | Inferred Dtype | Category | Clinical / Operational Semantics |
| :--- | :---: | :---: | :--- |
| `record_no` | `int64` | Row Identifier | Sequential physical export row counter (1 to 62,422) |
| `patient_id` | `int64` | Patient Identifier | Master Patient Index (MPI) identifier |
| `Unnamed: 2` | `float64` (All NaN) | Artifact | Ghost column caused by double comma delimiter (`patient_id,,appointment_id`) |
| `appointment_id` | `int64` | Encounter Identifier | Outpatient clinical encounter / consultation episode ID |
| `appointment_start_datetime` | `object` (Datetime) | Timestamp | Recorded check-in / start time of the outpatient consultation |
| `prescription_doctor_id` | `int64` | Resource Identifier | Unique provider identifier for the prescribing physician |
| `prescription_doctor_name` | `object` | Descriptive | Provider category / designated physician role |
| `prescription_order_id` | `int64` | Order Identifier | Prescription requisition / order header identifier |
| `prescription_start_datetime` | `object` (Datetime) | Timestamp | Start timestamp of prescription authoring |
| `prescription_end_datetime` | `object` (Datetime) | Timestamp | Completion / signature timestamp of prescription authoring |
| `lab_id` | `float64` | Order Identifier | Laboratory test requisition line item identifier |
| `lab_name` | `object` | Descriptive | Standard test catalog name (e.g., Complete Blood Count, Lipid Profile) |
| `lab_start_datetime` | `object` (Datetime) | Timestamp | Specimen collection / lab accession start datetime |
| `lab_end_datetime` | `object` (Datetime/Mixed) | Timestamp | Result release / lab verification datetime (partially truncated) |
| `imaging_request_id` | `float64` | Order Identifier | Radiology imaging study requisition identifier |
| `imaging_result_id` | `float64` | Result Identifier | Radiology finalized study / report identifier |
| `imaging_name` | `object` | Descriptive | Radiology study examination modality and anatomical site |
| `imaging_start_datetime` | `object` (Datetime) | Timestamp | Imaging acquisition commencement datetime |
| `imaging_end_datetime` | `object` (Datetime) | Timestamp | Imaging acquisition completion / verification datetime |
| `pharmacy_sale_line_id` | `float64` | Order Identifier | Pharmacy point-of-sale dispensation line item identifier |
| `medicine_name` | `object` | Descriptive | Dispensed pharmaceutical product description |
| `pharmacy_start_datetime` | `object` (Datetime) | Timestamp | Prescription intake / dispensing start datetime |
| `pharmacy_end_datetime` | `object` (Datetime) | Timestamp | Dispensation verification / completion datetime |
| `flow_code` | `int64` | Categorical | Numeric taxonomy code (1 through 7) classifying the clinical pathway |
| `flow_name` | `object` | Categorical | Human-readable sequence of clinical phases executed in the visit |

---

## 2. Column-Level Missing-Value Summary

### 2.1 Distribution and Sparsity Analysis

| Column Name | Populated Rows | Missing Rows | Missing % | Clinical & Structural Interpretation |
| :--- | :---: | :---: | :---: | :--- |
| `record_no` | 62,422 | 0 | 0.0000% | 100% complete row index |
| `patient_id` | 62,422 | 0 | 0.0000% | 100% complete patient identifier |
| `Unnamed: 2` | 0 | 62,422 | **100.0000%** | **Completely empty artifact** column. Candidate for deletion in cleaning. |
| `appointment_id` | 62,422 | 0 | 0.0000% | 100% complete encounter identifier |
| `appointment_start_datetime` | 62,422 | 0 | 0.0000% | 100% complete appointment arrival/start timestamp |
| `prescription_doctor_id` | 62,422 | 0 | 0.0000% | 100% complete provider reference |
| `prescription_doctor_name` | 62,422 | 0 | 0.0000% | 100% complete provider name |
| `prescription_order_id` | 62,422 | 0 | 0.0000% | 100% complete prescription header reference |
| `prescription_start_datetime` | 62,410 | 12 | 0.0192% | Rare omission (12 records) in prescription authoring start |
| `prescription_end_datetime` | 62,421 | 1 | 0.0016% | Single omission in prescription authoring completion |
| `lab_id` | 18,029 | 44,393 | 71.1176% | Diagnostic branch: test ordered for 28.88% of encounter rows |
| `lab_name` | 18,029 | 44,393 | 71.1176% | Diagnostic branch: catalog name matches `lab_id` exactly |
| `lab_start_datetime` | 18,029 | 44,393 | 71.1176% | Diagnostic branch: specimen collection timestamp |
| `lab_end_datetime` | 18,029 | 44,393 | 71.1176% | Diagnostic branch: result release timestamp |
| `imaging_request_id` | 5,523 | 56,899 | 91.1522% | Diagnostic branch: radiology exam requested for 8.85% of rows |
| `imaging_result_id` | 5,523 | 56,899 | 91.1522% | Diagnostic branch: radiology report produced |
| `imaging_name` | 5,523 | 56,899 | 91.1522% | Diagnostic branch: procedure description |
| `imaging_start_datetime` | 5,523 | 56,899 | 91.1522% | Diagnostic branch: exam start timestamp |
| `imaging_end_datetime` | 5,513 | 56,909 | 91.1682% | 10 cases where imaging started but end timestamp is null |
| `pharmacy_sale_line_id` | 302 | 62,120 | 99.5162% | Treatment branch: on-site outpatient dispensing (0.48% of rows) |
| `medicine_name` | 302 | 62,120 | 99.5162% | Treatment branch: dispensed medication item |
| `pharmacy_start_datetime` | 302 | 62,120 | 99.5162% | Treatment branch: dispensing order intake timestamp |
| `pharmacy_end_datetime` | 302 | 62,120 | 99.5162% | Treatment branch: medication delivery timestamp |
| `flow_code` | 62,422 | 0 | 0.0000% | 100% complete pathway classification code |
| `flow_name` | 62,422 | 0 | 0.0000% | 100% complete pathway classification label |

### 2.2 Clinical Justification of Sparsity

In clinical workflows, laboratory investigations, diagnostic imaging studies, and internal pharmacy dispensations are **conditional diagnostic and therapeutic interventions**, not mandatory administrative milestones.

The empirical distribution of `flow_code` and `flow_name` accounts exactly for the sparsity observed:

| Flow Code | Clinical Pathway Description (`flow_name`) | Record Count | Percentage |
| :---: | :--- | :---: | :---: |
| **1** | `Appointment → Prescription` | 40,164 | 64.34% |
| **2** | `Appointment → Prescription → Lab` | 16,434 | 26.33% |
| **3** | `Appointment → Prescription → Imaging` | 3,947 | 6.32% |
| **5** | `Appointment → Prescription → Lab + Imaging` | 1,575 | 2.52% |
| **4** | `Appointment → Prescription → Pharmacy` | 281 | 0.45% |
| **6** | `Appointment → Prescription → Lab + Pharmacy` | 20 | 0.03% |
| **7** | `Appointment → Prescription → Imaging + Pharmacy` | 1 | 0.0016% |
| **Total** | | **62,422** | **100.00%** |

**Conclusion:**
- Nulls in laboratory columns (71.12%) correspond directly to Flows 1, 3, 4, and 7 where no laboratory work was ordered.
- Nulls in imaging columns (91.15%) correspond directly to Flows 1, 2, 4, and 6.
- Nulls in pharmacy columns (99.52%) indicate that the vast majority of outpatient prescriptions are fulfilled by external community pharmacies rather than the hospital's internal pharmacy counter.
- **None of these clinical branch nulls constitute data corruption or missing records.**

---

## 3. Duplicate and Identifier Analysis

### 3.1 Distinct Count Summary

| Identifier Field | Total Populated | Distinct Count | Uniqueness Ratio | Cardinality Scope |
| :--- | :---: | :---: | :---: | :--- |
| `record_no` | 62,422 | 62,422 | 1.00000 | Unique per table row |
| `patient_id` | 62,422 | 39,442 | 0.63186 | 1 patient : 1.58 rows (avg) |
| `appointment_id` | 62,422 | 49,912 | 0.79959 | 1 encounter : 1.25 rows (avg) |
| `prescription_order_id` | 62,422 | 50,568 | 0.81010 | 1 order : 1.23 rows (avg) |
| `prescription_doctor_id` | 62,422 | 98 | 0.00157 | 98 distinct prescribing providers |
| `lab_id` | 18,029 | 17,083 | 0.94753 | 17,083 distinct lab orders |
| `imaging_request_id` | 5,523 | 5,360 | 0.97049 | 5,360 distinct imaging requisitions |
| `imaging_result_id` | 5,523 | 5,360 | 0.97049 | 1:1 match with imaging request ID |
| `pharmacy_sale_line_id` | 302 | 262 | 0.86755 | 262 distinct pharmacy sales lines |

### 3.2 Duplicate Record Investigation

1. **Global Exact Duplicates:**
   Across all 25 columns, there are **0 exact duplicate rows** (`df.duplicated().sum() == 0`). Every row possesses a distinct sequential `record_no`.
2. **Clinical Content Duplicates (Excluding `record_no`):**
   Excluding the synthetic `record_no` index, exactly **4 duplicate pairs (8 rows total)** exist:
   - **Encounter Group A (Flow 2):**
     - Duplicate laboratory line item pair 1: Repeated test requisition (`Complete Blood Count`, identical start and end timestamps).
     - Duplicate laboratory line item pair 2: Repeated test requisition (`Complete Blood Count`, identical start and end timestamps).
   - **Encounter Group B (Flow 2):**
     - Duplicate laboratory line item pair 1: Repeated test requisition (`Complete Blood Count`, identical start and end timestamps).
     - Duplicate laboratory line item pair 2: Repeated test requisition (`Complete Blood Count`, identical start and end timestamps).

**Assessment:** These 8 rows represent repeated join outputs in the upstream data pipeline when querying billing/LIS line items. They must be addressed systematically in Step 2 without silent record loss.

### 3.3 Relational Denormalization Mechanics

The dataset exhibits a denormalized 1-to-many grain:
- **45,090 appointments (90.34%)** are represented by exactly **1 row** (single prescription and at most 1 lab or imaging study).
- **4,822 appointments (9.66%)** span **multiple rows (17,332 total rows, up to 28 rows per encounter)**.
- In multi-row encounters, the root appointment and prescription fields are repeated on each row to accommodate multiple concurrent laboratory test orders (e.g., CBC + Metabolic Panel + Urinalysis) or multiple imaging studies ordered in the same encounter.

---

## 4. Timestamp Validation Findings

### 4.1 Chronological Attribute Verification

Nine datetime attributes were evaluated for parsing feasibility, format uniformity, and validity ranges:

| Timestamp Attribute | Populated | Parsed (%m/%d/%Y %H:%M) | Invalid / Non-Standard | Null Count | Min Timestamp | Max Timestamp |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `appointment_start_datetime` | 62,422 | 62,422 (100.0%) | 0 (0.0%) | 0 | 2024-04-25 11:12 | 2026-04-07 08:03 |
| `prescription_start_datetime` | 62,410 | 62,410 (100.0%) | 0 (0.0%) | 12 | 2024-04-26 05:15 | 2026-07-23 16:43 |
| `prescription_end_datetime` | 62,421 | 62,421 (100.0%) | 0 (0.0%) | 1 | 2024-04-26 05:21 | 2026-04-07 09:01 |
| `lab_start_datetime` | 18,029 | 18,029 (100.0%) | 0 (0.0%) | 44,393 | 2025-03-25 07:39 | 2026-04-07 07:06 |
| `lab_end_datetime` | 18,029 | **13,327 (73.92%)** | **4,702 (26.08%)** | 44,393 | 2025-03-26 07:20 | 2026-04-07 19:42 |
| `imaging_start_datetime` | 5,523 | 5,523 (100.0%) | 0 (0.0%) | 56,899 | 2025-03-25 06:27 | 2026-04-07 06:40 |
| `imaging_end_datetime` | 5,513 | 5,513 (100.0%) | 0 (0.0%) | 56,909 | 2025-03-25 06:29 | 2026-04-07 06:42 |
| `pharmacy_start_datetime` | 302 | 302 (100.0%) | 0 (0.0%) | 62,120 | 2025-06-06 15:42 | 2026-03-27 13:49 |
| `pharmacy_end_datetime` | 302 | 302 (100.0%) | 0 (0.0%) | 62,120 | 2025-06-06 15:42 | 2026-03-27 13:50 |

### 4.2 Detailed Anomaly Investigation

#### A. Truncated `lab_end_datetime` (4,702 records)
- **Finding:** While all other timestamp columns conform 100% to `%m/%d/%Y %H:%M`, exactly 4,702 records in `lab_end_datetime` contain truncated string patterns such as `53:45.0`, `46:40.0`, `29:40.0`, `15:00.0`.
- **Root Cause:** Upstream laboratory information system (LIS) report generation exported the elapsed turnaround duration or minute/second timestamp fragment (`MM:SS.f`) without the calendar date or hour.
- **Process Mining Impact:** If parsed naively with general heuristic parsers, fragments with leading digits $\le 23$ are erroneously cast to the current system date at hour $H$, while fragments $> 23$ fail entirely. These 4,702 values cannot reliably represent absolute calendar completion times without imputing the date/hour from `lab_start_datetime`.

#### B. Start/End Pair Temporal Consistency

| Activity Pair | Paired Records | Negative Duration ($End < Start$) | Zero Duration ($End == Start$) | Positive Duration ($End > Start$) | Median Duration |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Prescription Authoring** | 62,409 | **52 (0.08%)** | 41,514 (66.52%) | 20,843 (33.40%) | 0.0 sec (0 min) |
| **Laboratory Processing** | 13,327 (valid dates) | **0 (0.00%)** | 1 (0.01%) | 13,326 (99.99%) | 8,580 sec (143 min) |
| **Diagnostic Imaging** | 5,513 | **0 (0.00%)** | 561 (10.18%) | 4,952 (89.82%) | 180 sec (3 min) |
| **Pharmacy Dispensing** | 302 | **0 (0.00%)** | 143 (47.35%) | 159 (52.65%) | 60 sec (1 min) |

- **Prescription Inversions (52 records):** In 52 instances, `prescription_end_datetime` is earlier than `prescription_start_datetime` by 1 to 4 days (e.g., start on `9/16/2025 8:08` vs end on `9/12/2025 8:17`). This reflects retroactive chart corrections or mismatched order revisions.
- **Zero-Duration Point Events:** Over 66.5% of prescriptions, 10.2% of imaging exams, and 47.4% of pharmacy orders have identical start and end timestamps, indicating instantaneous status updates or system batch confirmations.

#### C. Cross-Stage Temporal Sequence

- **Prescription vs. Appointment:** In 62,366 encounters (99.93%), `prescription_start_datetime` succeeds `appointment_start_datetime` (median lag: 28 minutes). In 5 encounters (0.01%), prescription preceded appointment start by up to 95 hours. In 39 encounters (0.06%), timestamps coincided exactly.
- **Laboratory vs. Appointment:** In 17,554 cases (97.37%), laboratory specimen collection commenced after appointment check-in. However, in **457 cases (2.53%)**, `lab_start_datetime` preceded `appointment_start_datetime` in the synthetic source records.

---

## 5. Candidate Case Identifier Comparison

To execute valid process mining, an appropriate case identifier must be established. We evaluate the four candidate keys present in the dataset:

| Evaluation Criterion | `patient_id` | `appointment_id` (Recommended) | `prescription_order_id` | Composite (`patient_id` + Date) |
| :--- | :--- | :--- | :--- | :--- |
| **Distinct Count** | 39,442 | 49,912 | 50,568 | 49,912 |
| **Missing Values** | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) |
| **Process Grain** | Patient Lifetime Cohort | Single Outpatient Encounter | Order Fulfillment Episode | Daily Encounter Window |
| **Multi-Encounter Repeat Rate** | **18.05% of patients** (7,120) have 2 to 11 visits | **0.00%** (Unique per clinical encounter) | 640 encounters have $>1$ order ID | 0.00% (Mirrors `appointment_id`) |
| **Temporal Gap Distribution** | Median gap: **27.99 days** (max: 465 days) | 98.82% completed within $\le 24$ hours | Linked to prescription only | Redundant with `appointment_id` |
| **Integrity with Diagnostic Orders** | Over-aggregates unrelated diagnostics | Perfectly groups concurrent lab & imaging | Omits lab/imaging without prescription link | Less robust than system ID |
| **Defensibility for Process Mining** | **UNSUITABLE** | **FULLY DEFENSIBLE** | **UNSUITABLE** | **SUBOPTIMAL** |

### 5.1 Why `patient_id` Must NOT Be the Case Identifier
1. **Conflation of Unrelated Episodes:** 7,120 patients return for multiple appointments over the 2-year observation window (up to 11 appointments). 82.90% of repeat appointments occur $>7$ days apart, and 46.78% occur $>30$ days apart.
2. **Cycle Time Distortion:** Treating `patient_id` as the case identifier would collapse distinct clinical pathways into monolithic traces spanning months, generating false bottleneck metrics (e.g., thousands of hours between consultation and follow-up lab tests).
3. **Control-Flow Looping Artifacts:** It introduces artificial loops and rework edges in the process discovery graph that reflect separate clinical encounters rather than operational recycling.

### 5.2 Evidence Supporting `appointment_id` as Case Identifier
1. **Strict 1:1 Relationship with Patient:** Every `appointment_id` maps to exactly one `patient_id` (0 multi-patient conflicts).
2. **Clinical Cohesion:** 98.82% of all activity within an `appointment_id` completes within 24 hours (median encounter duration: 36 minutes).
3. **Zero Nulls:** Present in 100% of records.
4. **Natural Clinical Encounter Boundary:** Represents an outpatient consultation episode, encompassing diagnosis, prescription, laboratory orders, imaging studies, and medication dispensation initiated during that visit.

---

## 6. Event-Log Transformation Feasibility

### 6.1 Unpivoting Strategy: From Wide Tabular to Event Log

The raw dataset stores activities horizontally as columns across stages (`appointment`, `prescription`, `lab`, `imaging`, `pharmacy`). To create a standard process mining event log (`case_id`, `activity`, `timestamp`), the table must be unpivoted (normalized) into distinct lifecycle events.

#### Activity Candidates & Extraction Rules

| Source Stage / Columns | Event Activity Name | Timestamp Source | Availability (% of rows) | Transformation Feasibility |
| :--- | :--- | :--- | :---: | :--- |
| `appointment_start_datetime` | `Consultation / Check-In` | `appointment_start_datetime` | 100.0% | **Immediate & Reliable** (1 event per `appointment_id`) |
| `prescription_start_datetime` | `Prescription Order Start` | `prescription_start_datetime` | 99.98% | **Reliable** (12 nulls excluded or handled) |
| `prescription_end_datetime` | `Prescription Order Complete` | `prescription_end_datetime` | 99.99% | **Feasible** (Note: 66.5% zero-duration with start) |
| `lab_start_datetime`, `lab_name` | `Lab Order / Collection` | `lab_start_datetime` | 28.88% | **Reliable** (Granular: can append test name) |
| `lab_end_datetime`, `lab_name` | `Lab Result Release` | `lab_end_datetime` | 21.35% | **Conditional**: 13,327 valid; 4,702 truncated |
| `imaging_start_datetime`, `imaging_name` | `Imaging Exam Start` | `imaging_start_datetime` | 8.85% | **Reliable** (Granular: can append modality) |
| `imaging_end_datetime`, `imaging_name` | `Imaging Exam Complete` | `imaging_end_datetime` | 8.83% | **Reliable** (10 nulls where start is present) |
| `pharmacy_start_datetime` | `Pharmacy Dispensing Start` | `pharmacy_start_datetime` | 0.48% | **Reliable** (Standardized timestamp) |
| `pharmacy_end_datetime` | `Pharmacy Dispensing Complete`| `pharmacy_end_datetime` | 0.48% | **Reliable** (Standardized timestamp) |

### 6.2 Key Challenges & Ambiguities to Resolve in Cleaning (Step 2)

1. **Denormalization Deduplication:**
   Because encounters with multiple lab tests repeat root appointment/prescription data across multiple rows, naive row-by-row event unpivoting would generate artificial duplicate `Consultation / Check-In` and `Prescription Order` events for the same `appointment_id`. Deduplication at the `(appointment_id, activity, timestamp)` level is mandatory.
2. **Resolution of Truncated `lab_end_datetime` (4,702 records):**
   A formal rule is required in the cleaning plan: either (a) exclude `Lab Result Release` events where the timestamp lacks calendar date, or (b) impute the date from `lab_start_datetime` only if the resulting interval is clinically plausible.
3. **Resolution of Inverted Prescriptions (52 records):**
   Rules must specify whether inverted prescription records should be dropped, set to the start time, or retained with a data-quality flag.
4. **Timestamp Granularity Ties:**
   Because timestamps are recorded to the nearest minute (`%H:%M`), events occurring in rapid succession (e.g., prescription end and lab order) frequently tie. Event sorting must incorporate a deterministic stage index (`appointment` < `prescription` < `lab`/`imaging` < `pharmacy`) to maintain true clinical workflow ordering.
5. **Pre-Consultation Diagnostics (457 lab cases):**
   Lab draws that occur before the appointment start timestamp must be documented as valid parallel or preparatory clinical paths rather than dropped as sequencing anomalies.

---

## 7. Conclusions & Readiness for Phase 2, Step 2

| Assessment Dimension | Rating | Technical Finding |
| :--- | :---: | :--- |
| **Prerequisites Met** | **YES** | Raw CSV verified; complete column and timestamp audit executed. |
| **Case ID Justification** | **CONFIRMED** | `appointment_id` is the definitive encounter-level identifier. |
| **Timestamp Feasibility** | **HIGH** | Outpatient, prescription, imaging, pharmacy timestamps are 100% parseable. Lab end timestamps require documented handling rules. |
| **Data Cleaning Plan Needed** | **YES** | Cleaning plan (`reports/data_cleaning_plan.md`) must formalize rules for duplicates, empty column removal, and truncated timestamps. |
| **Event Log Feasibility** | **FEASIBLE** | Multi-stage clinical pathway event log can be generated reproducibly once documented cleaning rules are applied. |

---
*Report generated programmatically from empirical audit of `data/raw/careflow_source.csv`. Original source data remains unmodified.*
