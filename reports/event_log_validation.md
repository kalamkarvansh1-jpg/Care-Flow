# CareFlow — Phase 2, Step 3: Event Log Independent Validation Report

**Document Title:** Independent Event Log Verification & Quality Assurance Audit
**Target Event Log:** `data/processed/event_log.csv`
**Cleaned Dataset:** `data/processed/cleaned_source.csv`
**Raw Source Dataset:** `data/raw/careflow_source.csv`
**Reference Cleaning Summary:** [`reports/data_cleaning_summary.md`](file:///d:/Care%20Flow/reports/data_cleaning_summary.md)
**Execution Context:** Independent Process Mining Quality Engineering Audit
**Date of Audit:** October 16, 2026
**Final Outcome Recommendation:** **Ready with Documented Limitations**

---

## 1. Executive Summary & Verification of Immutability

This report provides an independent, programmatic audit of the normalized event log [`data/processed/event_log.csv`](file:///d:/Care%20Flow/data/processed/event_log.csv). The objective was to verify the integrity, schema compliance, case consistency, activity reconciliations, and chronological ordering without relying on prior execution logs.

### 1.1 Cryptographic Hash Verification
All files were checked using SHA-256 stream hashing:

| File Role | Path | SHA-256 Checksum | Immutability Status |
| :--- | :--- | :--- | :---: |
| **Raw Source** | `data/raw/careflow_source.csv` | `07d0096b6e3fcff78f94afa6d5aeffeeb2566f59902eccc03da209a3b6502720` | **Verified Unchanged** |
| **Cleaned Source** | `data/processed/cleaned_source.csv` | `674212c0e4b97d64045e53f2908418c1f229f8e15dd7da801a99436584e614f3` | **Derived & Consistent** |
| **Event Log** | `data/processed/event_log.csv` | `cdab7bbc0e6755cb927a2a627bff2108e48d94ce0e38f62354ed72dcfb63442d` | **Verified Target** |

The original CSV remains bit-for-bit identical to its pre-cleaning state.

---

## 2. Event Log Schema & Structural Integrity

### 2.1 Attribute Completeness & Types

The event log contains 6 columns: `case_id`, `activity`, `timestamp`, `stage`, `source_order_id`, and `source_record_no`.

| Column Name | Inferred Dtype | Null Count | Empty String Count | Unique Values | Completeness Ratio |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`case_id`** | `int64` | 0 | 0 | 49,912 | 100.000% |
| **`activity`** | `object` (string) | 0 | 0 | 8 | 100.000% |
| **`timestamp`** | `object` (ISO 8601) | 0 | 0 | 49,045 | 100.000% |
| **`stage`** | `object` (string) | 0 | 0 | 5 | 100.000% |
| **`source_order_id`** | `object` (string) | 0 | 0 | 53,733 | 100.000% |
| **`source_record_no`**| `int64` | 0 | 0 | 62,418 | 100.000% |

### 2.2 Timestamp Parseability & Formatting
- **Format Standard:** Strict ISO 8601 (`YYYY-MM-DD HH:MM:SS`).
- **Parse Failures:** Exactly **0 unparseable timestamps** across all 142,876 event rows.
- **Range:** `2024-04-25 11:12:00` to `2026-04-07 19:42:00` (2-year observation horizon).

### 2.3 Duplicate Event Audit
- **Full Row Duplicates:** **0 exact duplicate rows** exist across all 6 columns.
- **Natural Grain Multiplicity:** In 14,474 instances, events within the same case share identical activity and timestamp values (e.g., multiple laboratory tests drawn at the same minute). In all cases, these events are distinguished by distinct `source_order_id` (e.g., CBC test `36145` vs. Metabolic Panel `36146`), verifying that legitimate parallel clinical interventions were correctly retained.

---

## 3. Case-Level & Entity Reconciliation

### 3.1 Case ID Alignment
- **Distinct Cases in Event Log:** 49,912
- **Distinct `appointment_id` Values in Raw Source:** 49,912
- **Unmatched Case IDs:** Exactly **0** (the sets are 100% identical: $\text{Cases}_{\text{Log}} \equiv \text{Appointments}_{\text{Raw}}$).
- **Contiguity Check:** All events belonging to a given `case_id` occur in a single unbroken contiguous block in the file (verified: exactly 49,912 contiguous case blocks).
- **Cross-Appointment Conflation:** 0 cases combine events from different appointments.

### 3.2 Appointment Check-In Reconciliation
- Every case contains exactly **one** `Appointment Start` event (total: 49,912).
- Zero appointments were lost during unpivoting.

---

## 4. Activity Reconciliation

Independent recomputation confirms exact reconciliation with the figures documented in [`reports/data_cleaning_summary.md`](file:///d:/Care%20Flow/reports/data_cleaning_summary.md):

| Activity Name | Clinical Phase | Expected Count | Recomputed Count | Status | Reconciliation Notes |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`Prescription Order`** | Prescription | 50,556 | 50,556 | **MATCH** | 50,568 distinct order IDs in raw minus 12 null start datetimes. |
| **`Appointment Start`** | Appointment | 49,912 | 49,912 | **MATCH** | Exactly 1 per distinct `appointment_id`. |
| **`Laboratory Start`** | Laboratory | 17,848 | 17,848 | **MATCH** | Distinct `(appointment_id, lab_id, start_dt)` triples. |
| **`Laboratory End`** | Laboratory | 13,203 | 13,203 | **MATCH** | Complete `%m/%d/%Y %H:%M` timestamps only (4,702 truncated excluded). |
| **`Imaging Start`** | Imaging | 5,421 | 5,421 | **MATCH** | Distinct `(appointment_id, imaging_request_id, start_dt)` triples. |
| **`Imaging End`** | Imaging | 5,412 | 5,412 | **MATCH** | 9 fewer than start due to 10 missing end timestamps (one in multi-row). |
| **`Pharmacy Start`** | Pharmacy | 262 | 262 | **MATCH** | Distinct `(appointment_id, sale_line_id, start_dt)` triples. |
| **`Pharmacy End`** | Pharmacy | 262 | 262 | **MATCH** | Distinct `(appointment_id, sale_line_id, end_dt)` triples. |
| **Total Events** | | **142,876** | **142,876** | **MATCH** | Fully reconciled. |

---

## 5. Chronological Ordering, Ties, and Sequence Validation

### 5.1 Within-Case Monotonicity
- Timestamps were evaluated within every individual case:
  $$\Delta t = t_i - t_{i-1} \ge 0$$
- **Backward Time Steps:** **0**. No event occurs earlier in time than its preceding event within the same case.

### 5.2 Equal Timestamp Ties
- **Events Involved in Same-Case Ties:** Exactly **22,024 events (15.41%)** occur at the exact same minute as another event in the same case.
- **Distribution of Tie Cluster Sizes:**
  - 2 coincident events: 3,683 occurrences (7,366 events)
  - 3 coincident events: 1,279 occurrences (3,837 events)
  - 4 coincident events: 747 occurrences (2,988 events)
  - $\ge 5$ coincident events: 1,093 occurrences (7,833 events)

> [!WARNING]
> **Interpretation of Stage-Order Tie-Breaking:**
> In accordance with the cleaning specification, ties are resolved deterministically using domain staging:
> `Appointment` $\rightarrow$ `Prescription` $\rightarrow$ `Lab Start` $\rightarrow$ `Lab End` $\rightarrow$ `Imaging Start` $\rightarrow$ `Imaging End` $\rightarrow$ `Pharmacy Start` $\rightarrow$ `Pharmacy End`.
> **This sorting order is an analytical convention for deterministic reproducibility, NOT empirical proof of intra-minute clinical chronology.** Process discovery algorithms must treat tied events as potentially concurrent or parallel.

### 5.3 Pre-Appointment Diagnostic Sequence
- In **418 cases (0.84% of encounters)**, the earliest recorded event in the case is **not** `Appointment Start`:
  - `Imaging Start` as first event: 282 cases
  - `Laboratory Start` as first event: 131 cases
  - `Prescription Order` as first event: 5 cases
- **Clinical Validation:** In real-world outpatient care, walk-in patients or patients scheduled for morning fasting blood draws / routine chest X-rays frequently undergo diagnostic acquisition prior to entering the physician consultation room. Preserving these genuine timestamps produces an authentic representation of outpatient operational variations.

---

## 6. Trace Length Distribution & Outlier Investigation

| Trace Length (Events per Case) | Case Count | % of Total Cases | Operational Workflow Explanation |
| :---: | :---: | :---: | :--- |
| **1 event** | 11 | 0.02% | Encounters where prescription start was null (retaining only `Appointment Start`). |
| **2 events** | 39,191 | 78.52% | Standard outpatient consultation: `Appointment Start` $\rightarrow$ `Prescription Order`. |
| **3 events** | 897 | 1.80% | Consultations with diagnostic orders where completion timestamp was truncated/omitted. |
| **4 events** | 5,410 | 10.84% | Complete single-test diagnostic consultation (Appt + Presc + Test Start + Test End). |
| **5 to 10 events** | 3,191 | 6.39% | Multimodal testing or multiple lab tests completed. |
| **11 to 20 events** | 1,103 | 2.21% | Comprehensive diagnostic workups (e.g., intensive metabolic / cardiac workup). |
| **$> 20$ events** | 109 | 0.22% | Complex multi-panel diagnostic episodes. |

### 6.1 Investigation of Maximum Trace Length Outlier (Single Encounter Case)
- **Observed Trace Length:** 56 events.
- **Composition:**
  - 26 `Laboratory Start` events
  - 26 `Laboratory End` events
  - 1 `Appointment Start` event
  - 1 `Prescription Order` event
  - 1 `Imaging Start` event
  - 1 `Imaging End` event
- **Empirical Clinical Evidence:** Inspection of raw records confirmed that this maximum-length encounter was an obstetrics/gynecology high-risk maternal episode featuring Doppler Fetal ultrasound imaging and 26 distinct laboratory test orders (including Complete Blood Count, Urine R/E, Liver Function Tests, CRP, and multiple Urine Culture & Sensitivity panels). All 26 tests had distinct order IDs. Culture tests completed 3 days later, matching standard 72-hour microbiological incubation.
- **Conclusion:** The maximum trace length is **clinically authentic and correctly preserved**, not an extraction artifact.

---

## 7. Known Data Quality Limitations

1. **Missing Laboratory Completion Events for 4,702 Tests (26.08%):** Because source timestamps were truncated to `MM:SS.f` without calendar dates, these tests cannot produce `Laboratory End` events without synthetic imputation. Turnaround time analysis on this specific subset must be excluded or reported with missing completion indicators.
2. **Minute-Level Clock Coarseness:** 15.41% of events share timestamps, limiting intra-minute performance metrics (e.g., queue time from check-in to prescription when both occur within the same minute).
3. **Prescriptions as Point Events:** Because 66.52% of prescriptions have zero duration ($Start == End$) and 52 records have negative durations ($End < Start$), prescription authoring is represented as a point order event.
4. **Pre-Consultation Diagnostics:** 418 encounters feature diagnostic draws/scans commencing prior to appointment check-in, requiring process mining models to accommodate early diagnostic branches.

---

## 8. Final Recommendation & Readiness

### **Recommendation: Ready with Documented Limitations**

The event log [`data/processed/event_log.csv`](file:///d:/Care%20Flow/data/processed/event_log.csv) has passed all structural, schema, entity, chronological, and reconciliation checks:
- **Zero data corruption or record loss.**
- **Exact reconciliation of all 142,876 events across 49,912 cases.**
- **No synthetic timestamps or clinical fabrications.**
- **Original source dataset verified 100% unmodified via SHA-256.**
- **CSVs remain excluded from Git.**

The event log is certified as ready for **Phase 3: Exploratory Process Discovery & Baseline Process Mining** using PM4Py, subject to the four documented limitations detailed above.
