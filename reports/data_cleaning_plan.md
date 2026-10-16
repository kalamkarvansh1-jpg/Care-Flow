# CareFlow — Phase 2, Step 2: Data Cleaning & Event Log Preparation Plan

**Document Title:** Data Cleaning Specification & Event Log Transformation Architecture
**Target Dataset:** `data/raw/careflow_source.csv`
**Derived Outputs:** `data/processed/cleaned_source.csv`, `data/processed/event_log.csv`
**Execution Context:** Healthcare Analytics & Clinical Process Mining
**Date:** October 16, 2026
**Status:** Approved Engineering Plan

---

## 1. Executive Summary & Scope

Based on the empirical findings documented in [`reports/dataset_profile.md`](file:///d:/Care%20Flow/reports/dataset_profile.md), this document establishes the formal engineering specification for cleaning the raw hospital outpatient dataset and unpivoting it into a normalized process-mining event log.

The primary objective is to transform 62,422 denormalized tabular rows into a standards-compliant event log (`case_id`, `activity`, `timestamp`) ready for control-flow, performance, and variant analysis, while adhering strictly to healthcare data governance principles:
- **Zero data loss of legitimate clinical interventions.**
- **No synthetic invention or silent imputation of timestamps or clinical findings.**
- **Explicit isolation and documentation of source data anomalies.**
- **Protection of patient and provider privacy (no sensitive identifiers in event logs or reports).**

---

## 2. Case Identifier Decision & Rationale

### 2.1 Selected Case Identifier: `appointment_id`
`appointment_id` is formally selected as the process-mining `case_id`.

### 2.2 Justification Based on Empirical Profiling
1. **Clinical Encounter Boundary:** In outpatient healthcare, an appointment represents the bounded operational unit where a patient registers, consults with a physician, receives medical prescriptions, undergoes diagnostic tests (laboratory or radiology), and collects medications.
2. **Strict 1:1 Mapping to Patient:** The profiling audit confirmed that **0 appointments are linked to multiple patients**. Each encounter corresponds uniquely to a single individual.
3. **High Temporal Cohesion:** 98.82% of all clinical activities within an `appointment_id` conclude within 24 hours (median encounter cycle time: 36 minutes).
4. **Rejection of `patient_id`:** 7,120 patients (18.05%) returned for repeat visits over the 2-year window (up to 11 visits), with a median gap of **27.99 days** (up to 465 days). Utilizing `patient_id` as the case identifier would concatenate disjoint visits months apart into artificial "mega-traces," falsifying cycle times, throughput metrics, and bottleneck analyses.
5. **Rejection of `prescription_order_id`:** 640 appointments contain multiple prescription order IDs, and orders cannot naturally encompass diagnostic activities (such as independent laboratory draws) that share the encounter.

---

## 3. Column Normalization & Schema Cleaning

### 3.1 Artifact Column Removal (`Unnamed: 2`)
- **Finding:** A double comma delimiter in the CSV header (`patient_id,,appointment_id`) produced a ghost column (`Unnamed: 2`) containing 62,422 null values (100.0% missing).
- **Rule:** Drop `Unnamed: 2` during data ingestion and cleansing.

### 3.2 Clinical Missing Values Treatment
- **Laboratory Fields (`lab_id`, `lab_name`, `lab_start_datetime`, `lab_end_datetime`):** Missing in 44,393 rows (71.12%).
- **Imaging Fields (`imaging_request_id`, `imaging_result_id`, `imaging_name`, `imaging_start_datetime`, `imaging_end_datetime`):** Missing in 56,899 rows (91.15%).
- **Pharmacy Fields (`pharmacy_sale_line_id`, `medicine_name`, `pharmacy_start_datetime`, `pharmacy_end_datetime`):** Missing in 62,120 rows (99.52%).
- **Rule:** Retain all nulls as legitimate operational absences. The profiling audit demonstrated that 64.34% of cases follow Flow 1 (`Appointment → Prescription`), where no diagnostics are indicated. These missing values represent branch absence, not data omissions.

---

## 4. Timestamp Conversion & Anomaly Handling Rules

### 4.1 Base Timestamp Parsing
All valid datetime fields conform to the standard US datetime pattern: `%m/%d/%Y %H:%M` (e.g., `3/30/2026 5:36`).
- Ingestion must parse timestamps strictly with this format.
- Output timestamps in `event_log.csv` will be standardized to ISO 8601 (`YYYY-MM-DD HH:MM:SS`) to guarantee uniform cross-platform sorting.

### 4.2 Handling Truncated `lab_end_datetime` (4,702 records)
- **Anomaly:** Exactly 4,702 laboratory rows contain truncated time fragments formatted as `MM:SS.f` (e.g., `53:45.0`, `15:00.0`), lacking calendar dates and hours.
- **Strict Safety Constraint:** Do not parse these fragments with heuristic parsers (which falsely assign them to the current execution date at hour $H$). Do not invent dates or impute turn-around times.
- **Rule:**
  1. Flag these 4,702 records in `cleaned_source.csv` with `flag_lab_end_truncated = True`.
  2. In the event log, emit `Laboratory End` events **only for the 13,327 records with valid, complete calendar timestamps**.
  3. The 4,702 truncated records are excluded from generating `Laboratory End` events. The corresponding `Laboratory Start` events remain fully preserved in the event log.

### 4.3 Handling Inverted Prescriptions (52 records)
- **Anomaly:** In 52 rows, `prescription_end_datetime` is earlier than `prescription_start_datetime` by 1 to 4 days.
- **Rule:**
  1. Prescription authoring is treated as a **point event** (`Prescription Order`) anchored to `prescription_start_datetime`.
  2. No `Prescription End` event is generated in the event log.
  3. Flag the 52 inverted records in `cleaned_source.csv` with `flag_prescription_inverted = True`.

### 4.4 Handling Missing Prescription Start Timestamps (12 records)
- **Anomaly:** In 12 rows across 12 distinct appointments, `prescription_start_datetime` is null, although `prescription_end_datetime` is populated.
- **Rule:**
  1. Do not guess or substitute `prescription_end_datetime` as start time.
  2. Flag these records in `cleaned_source.csv` with `flag_prescription_start_null = True`.
  3. Omit the `Prescription Order` event for these 12 instances, while retaining their `Appointment Start` events.

### 4.5 Handling Missing Imaging End Timestamps (10 records)
- **Anomaly:** In 10 records, `imaging_start_datetime` is populated but `imaging_end_datetime` is null.
- **Rule:** Emit the `Imaging Start` event; omit the `Imaging End` event. Flag with `flag_imaging_end_null = True`.

---

## 5. Duplicate Detection & Deduplication Strategy

### 5.1 Source Table Row Duplicates
- **Finding:** Exactly 4 duplicate pairs (8 rows total) exist across two distinct clinical encounters. Every business and clinical field is identical; only the sequential physical row counter differs.
- **Rule for `cleaned_source.csv`:** Exclude the 4 secondary duplicate rows. Retained row count: 62,418 rows.

### 5.2 Event-Level Deduplication in Wide-to-Long Unpivoting
In denormalized wide tables, an encounter with 3 laboratory tests repeats the appointment check-in and prescription columns across 3 physical rows.
- **Rule:** Deduplicate events per case according to their natural domain grain:
  - **`Appointment Start`:** Deduplicate by `(case_id, activity, timestamp)`. Yields exactly 1 event per appointment (49,912 events).
  - **`Prescription Order`:** Deduplicate by `(case_id, prescription_order_id, timestamp)`. Yields 50,556 events across 49,912 appointments.
  - **`Laboratory Start`:** Deduplicate by `(case_id, lab_id, timestamp)`. Yields 17,848 distinct test order events.
  - **`Laboratory End`:** Deduplicate by `(case_id, lab_id, timestamp)` for valid timestamps. Yields 13,203 distinct test verification events.
  - **`Imaging Start` & `Imaging End`:** Deduplicate by `(case_id, imaging_request_id, timestamp)`. Yields 5,421 start and 5,412 end events.
  - **`Pharmacy Start` & `Pharmacy End`:** Deduplicate by `(case_id, pharmacy_sale_line_id, timestamp)`. Yields 262 start and 262 end events.

---

## 6. Activity Extraction & Event Log Normalization

### 6.1 Standard Activity Nomenclature

| Stage | Activity Name in Event Log | Source Datetime Column | Inclusion Criteria |
| :--- | :--- | :--- | :--- |
| **Appointment** | `Appointment Start` | `appointment_start_datetime` | Always present (49,912 cases) |
| **Prescription** | `Prescription Order` | `prescription_start_datetime` | `prescription_start_datetime` is non-null |
| **Laboratory** | `Laboratory Start` | `lab_start_datetime` | `lab_id` and `lab_start_datetime` non-null |
| **Laboratory** | `Laboratory End` | `lab_end_datetime` | `lab_id` non-null and valid `%m/%d/%Y %H:%M` |
| **Imaging** | `Imaging Start` | `imaging_start_datetime` | `imaging_request_id` and start timestamp non-null |
| **Imaging** | `Imaging End` | `imaging_end_datetime` | `imaging_request_id` and end timestamp non-null |
| **Pharmacy** | `Pharmacy Start` | `pharmacy_start_datetime` | `pharmacy_sale_line_id` and start timestamp non-null |
| **Pharmacy** | `Pharmacy End` | `pharmacy_end_datetime` | `pharmacy_sale_line_id` and end timestamp non-null |

### 6.2 Event Log Schema (`data/processed/event_log.csv`)

| Column Name | Data Type | Required / Optional | Semantics |
| :--- | :---: | :---: | :--- |
| `case_id` | `int64` | **Required** | The encounter identifier (`appointment_id`) |
| `activity` | `string` | **Required** | Standardized activity name from table above |
| `timestamp` | `string` | **Required** | Formatted ISO 8601 timestamp (`YYYY-MM-DD HH:MM:SS`) |
| `stage` | `string` | Optional Traceability | High-level clinical phase (`Appointment`, `Prescription`, etc.) |
| `source_order_id` | `string` | Optional Traceability | Originating line item / order ID |
| `source_record_no`| `int64` | Optional Traceability | Pointer back to original row in raw dataset |

---

## 7. Chronological Ordering, Ties, and Sequence Ambiguities

### 7.1 Deterministic Tie-Breaking
Timestamps are recorded to the nearest minute (`%H:%M`). Consequently, events occurring in rapid succession within an encounter share identical timestamps (e.g., patient arrives and prescription is ordered within the same minute).
- **Rule:** Event log will sort deterministically by:
  1. `case_id` (Ascending)
  2. `timestamp` (Ascending)
  3. `stage_order` (Ascending: `Appointment` [1] $\rightarrow$ `Prescription` [2] $\rightarrow$ `Lab Start` [3] $\rightarrow$ `Lab End` [4] $\rightarrow$ `Imaging Start` [5] $\rightarrow$ `Imaging End` [6] $\rightarrow$ `Pharmacy Start` [7] $\rightarrow$ `Pharmacy End` [8])
  4. `source_order_id` (Ascending)

### 7.2 Explicit Reporting of Tie Ambiguity
- Approximately 15.4% of events share timestamps with another event in the same case.
- In process mining, these ties will be reported as **coincident / ambiguous ordering**, acknowledging that secondary stage sorting is an analytical convention and cannot establish true sub-minute ordering.

### 7.3 Pre-Consultation Diagnostics (457 lab cases)
- In 457 encounters (2.53% of lab visits), specimen collection occurred prior to the recorded `Appointment Start`.
- **Rule:** Preserve true timestamps. Do not artificially clamp lab start times to appointment start. In clinical practice, fasting blood draws often precede physician consultation.

---

## 8. Verification & Governance Checkpoints

1. **SHA-256 Hash Verification:** Compute and verify the hash of `data/raw/careflow_source.csv` before and after execution to prove zero alteration.
2. **Reconciliation Audit:** Ensure every omitted record, duplicate exclusion, and truncated timestamp is accounted for in aggregate summary tables.
3. **Git Exclusion Verification:** Confirm that both `cleaned_source.csv` and `event_log.csv` match `.gitignore` rules and remain uncommitted.
4. **Summary Documentation:** Produce `reports/data_cleaning_summary.md` detailing execution metrics.
