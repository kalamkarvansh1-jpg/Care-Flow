"""
CareFlow - Phase 2, Step 2: Data Cleaning & Event Log Preparation
Script: clean_dataset.py

Author: Senior Python Data Engineer & Process Mining Specialist
Project: CareFlow - Clinical Pathway Process Mining
Target Input: data/raw/careflow_source.csv
Outputs:
  - data/processed/cleaned_source.csv
  - data/processed/event_log.csv

Strict Safety Rules:
  - Does NOT modify original CSV.
  - Verifies SHA-256 checksum before and after processing.
  - Preserves source traceability without exposing sensitive identifiers.
  - Generates deterministic, reproducible outputs.
"""

import os
import sys
import hashlib
import json
from pathlib import Path
import pandas as pd
import numpy as np

# Reconfigure stdout for UTF-8 if available
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Paths configuration
BASE_DIR = Path(__file__).resolve().parent.parent.parent
RAW_CSV_PATH = BASE_DIR / "data" / "raw" / "careflow_source.csv"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
CLEANED_CSV_PATH = PROCESSED_DIR / "cleaned_source.csv"
EVENT_LOG_CSV_PATH = PROCESSED_DIR / "event_log.csv"

TIMESTAMP_FORMAT = "%m/%d/%Y %H:%M"


def compute_file_sha256(filepath: Path) -> str:
    """Computes SHA-256 checksum of a file in streaming chunks."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()


def run_pipeline():
    print("=" * 70)
    print("CareFlow: Data Cleaning & Event Log Preparation Pipeline")
    print("=" * 70)

    # 1. Prerequisite verification & Hash capture
    if not RAW_CSV_PATH.exists():
        raise FileNotFoundError(f"Input file not found at: {RAW_CSV_PATH}")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[1/6] Capturing initial SHA-256 hash for {RAW_CSV_PATH.name}...")
    initial_hash = compute_file_sha256(RAW_CSV_PATH)
    print(f"      Initial SHA-256: {initial_hash}")

    # 2. Ingestion
    print(f"[2/6] Ingesting raw CSV ({RAW_CSV_PATH.stat().st_size:,} bytes)...")
    df_raw = pd.read_csv(RAW_CSV_PATH, low_memory=False)
    raw_rows, raw_cols = df_raw.shape
    print(f"      Loaded {raw_rows:,} rows across {raw_cols} columns.")

    # 3. Clean and Flag Source Dataset
    print("[3/6] Applying schema normalization and data quality audit rules...")

    # Drop empty artifact column 'Unnamed: 2'
    cols_to_drop = [c for c in df_raw.columns if "Unnamed" in c or c.strip() == ""]
    df_cleaned = df_raw.drop(columns=cols_to_drop).copy()
    print(f"      Dropped artifact columns: {cols_to_drop}")

    # Detect exact business duplicate rows (excluding record_no)
    biz_cols = [c for c in df_cleaned.columns if c != "record_no"]
    duplicate_mask = df_cleaned.duplicated(subset=biz_cols, keep='first')
    duplicate_count = duplicate_mask.sum()
    print(f"      Identified duplicate rows (excluding record_no): {duplicate_count}")

    # Parse and flag timestamps
    # Lab end truncated detection: length is short or missing slash
    lab_end_str = df_cleaned["lab_end_datetime"].fillna("").astype(str).str.strip()
    is_lab_end_populated = df_cleaned["lab_end_datetime"].notnull()
    lab_end_parsed = pd.to_datetime(df_cleaned["lab_end_datetime"], format=TIMESTAMP_FORMAT, errors="coerce")
    lab_end_truncated_mask = is_lab_end_populated & lab_end_parsed.isnull()
    lab_end_truncated_count = lab_end_truncated_mask.sum()
    print(f"      Identified truncated lab_end_datetime records: {lab_end_truncated_count}")

    # Prescription duration inversion detection
    p_start_dt = pd.to_datetime(df_cleaned["prescription_start_datetime"], format=TIMESTAMP_FORMAT, errors="coerce")
    p_end_dt = pd.to_datetime(df_cleaned["prescription_end_datetime"], format=TIMESTAMP_FORMAT, errors="coerce")
    p_inverted_mask = (p_start_dt.notnull()) & (p_end_dt.notnull()) & (p_end_dt < p_start_dt)
    p_inverted_count = p_inverted_mask.sum()
    print(f"      Identified inverted prescription durations (end < start): {p_inverted_count}")

    # Prescription start null detection
    p_start_null_mask = df_cleaned["prescription_start_datetime"].isnull()
    p_start_null_count = p_start_null_mask.sum()
    print(f"      Identified missing prescription_start_datetime: {p_start_null_count}")

    # Imaging end null detection (where start exists)
    img_start_dt = pd.to_datetime(df_cleaned["imaging_start_datetime"], format=TIMESTAMP_FORMAT, errors="coerce")
    img_end_null_mask = df_cleaned["imaging_start_datetime"].notnull() & df_cleaned["imaging_end_datetime"].isnull()
    img_end_null_count = img_end_null_mask.sum()
    print(f"      Identified missing imaging_end_datetime (where start exists): {img_end_null_count}")

    # Pre-appointment laboratory draw detection
    appt_start_dt = pd.to_datetime(df_cleaned["appointment_start_datetime"], format=TIMESTAMP_FORMAT, errors="coerce")
    lab_start_dt = pd.to_datetime(df_cleaned["lab_start_datetime"], format=TIMESTAMP_FORMAT, errors="coerce")
    pre_appt_lab_mask = (lab_start_dt.notnull()) & (appt_start_dt.notnull()) & (lab_start_dt < appt_start_dt)
    pre_appt_lab_count = pre_appt_lab_mask.sum()
    print(f"      Identified pre-appointment laboratory draws (lab < appt): {pre_appt_lab_count}")

    # Add audit flags to cleaned source
    df_cleaned["flag_duplicate_record"] = duplicate_mask
    df_cleaned["flag_prescription_inverted"] = p_inverted_mask
    df_cleaned["flag_prescription_start_null"] = p_start_null_mask
    df_cleaned["flag_lab_end_truncated"] = lab_end_truncated_mask
    df_cleaned["flag_imaging_end_null"] = img_end_null_mask
    df_cleaned["flag_pre_appointment_lab"] = pre_appt_lab_mask

    # Retained cleaned dataset: Exclude the secondary duplicate rows
    df_cleaned_retained = df_cleaned[~duplicate_mask].copy()
    cleaned_rows = len(df_cleaned_retained)
    print(f"      Retained {cleaned_rows:,} cleaned records (excluded {duplicate_count} duplicate rows).")

    # Save cleaned source dataset
    print(f"[4/6] Saving cleaned source dataset to {CLEANED_CSV_PATH.name}...")
    df_cleaned_retained.to_csv(CLEANED_CSV_PATH, index=False)
    print(f"      Saved {CLEANED_CSV_PATH} ({CLEANED_CSV_PATH.stat().st_size:,} bytes).")

    # 4. Extract and Normalize Event Log
    print("[5/6] Extracting normalized process-mining event log...")
    events = []

    # A. Appointment Start
    # Grain: 1 per appointment_id
    appt_rows = df_cleaned_retained[["appointment_id", "appointment_start_datetime", "record_no"]].copy()
    appt_rows["timestamp"] = pd.to_datetime(appt_rows["appointment_start_datetime"], format=TIMESTAMP_FORMAT)
    appt_rows["activity"] = "Appointment Start"
    appt_rows["stage"] = "Appointment"
    appt_rows["stage_order"] = 1
    appt_rows["source_order_id"] = appt_rows["appointment_id"].astype(str)
    appt_events = appt_rows.drop_duplicates(subset=["appointment_id", "activity", "timestamp"])
    events.append(appt_events[["appointment_id", "activity", "timestamp", "stage", "stage_order", "source_order_id", "record_no"]])
    print(f"      Extracted Appointment Start events: {len(appt_events):,}")

    # B. Prescription Order (Point Event anchored at prescription_start_datetime)
    p_rows = df_cleaned_retained[df_cleaned_retained["prescription_start_datetime"].notnull()].copy()
    p_rows["timestamp"] = pd.to_datetime(p_rows["prescription_start_datetime"], format=TIMESTAMP_FORMAT)
    p_rows["activity"] = "Prescription Order"
    p_rows["stage"] = "Prescription"
    p_rows["stage_order"] = 2
    p_rows["source_order_id"] = p_rows["prescription_order_id"].astype(str)
    p_events = p_rows.drop_duplicates(subset=["appointment_id", "prescription_order_id", "timestamp"])
    events.append(p_events[["appointment_id", "activity", "timestamp", "stage", "stage_order", "source_order_id", "record_no"]])
    print(f"      Extracted Prescription Order events: {len(p_events):,}")

    # C. Laboratory Start
    l_s_rows = df_cleaned_retained[df_cleaned_retained["lab_id"].notnull() & df_cleaned_retained["lab_start_datetime"].notnull()].copy()
    l_s_rows["timestamp"] = pd.to_datetime(l_s_rows["lab_start_datetime"], format=TIMESTAMP_FORMAT)
    l_s_rows["activity"] = "Laboratory Start"
    l_s_rows["stage"] = "Laboratory"
    l_s_rows["stage_order"] = 3
    l_s_rows["source_order_id"] = l_s_rows["lab_id"].astype(int).astype(str)
    l_s_events = l_s_rows.drop_duplicates(subset=["appointment_id", "lab_id", "timestamp"])
    events.append(l_s_events[["appointment_id", "activity", "timestamp", "stage", "stage_order", "source_order_id", "record_no"]])
    print(f"      Extracted Laboratory Start events: {len(l_s_events):,}")

    # D. Laboratory End (Complete calendar timestamps only; truncated excluded)
    l_e_rows = df_cleaned_retained[df_cleaned_retained["lab_id"].notnull() & df_cleaned_retained["lab_end_datetime"].notnull()].copy()
    l_e_parsed = pd.to_datetime(l_e_rows["lab_end_datetime"], format=TIMESTAMP_FORMAT, errors="coerce")
    l_e_valid = l_e_rows[l_e_parsed.notnull()].copy()
    l_e_valid["timestamp"] = l_e_parsed[l_e_parsed.notnull()]
    l_e_valid["activity"] = "Laboratory End"
    l_e_valid["stage"] = "Laboratory"
    l_e_valid["stage_order"] = 4
    l_e_valid["source_order_id"] = l_e_valid["lab_id"].astype(int).astype(str)
    l_e_events = l_e_valid.drop_duplicates(subset=["appointment_id", "lab_id", "timestamp"])
    events.append(l_e_events[["appointment_id", "activity", "timestamp", "stage", "stage_order", "source_order_id", "record_no"]])
    print(f"      Extracted Laboratory End events (valid dates only): {len(l_e_events):,}")

    # E. Imaging Start
    i_s_rows = df_cleaned_retained[df_cleaned_retained["imaging_request_id"].notnull() & df_cleaned_retained["imaging_start_datetime"].notnull()].copy()
    i_s_rows["timestamp"] = pd.to_datetime(i_s_rows["imaging_start_datetime"], format=TIMESTAMP_FORMAT)
    i_s_rows["activity"] = "Imaging Start"
    i_s_rows["stage"] = "Imaging"
    i_s_rows["stage_order"] = 5
    i_s_rows["source_order_id"] = i_s_rows["imaging_request_id"].astype(int).astype(str)
    i_s_events = i_s_rows.drop_duplicates(subset=["appointment_id", "imaging_request_id", "timestamp"])
    events.append(i_s_events[["appointment_id", "activity", "timestamp", "stage", "stage_order", "source_order_id", "record_no"]])
    print(f"      Extracted Imaging Start events: {len(i_s_events):,}")

    # F. Imaging End
    i_e_rows = df_cleaned_retained[df_cleaned_retained["imaging_request_id"].notnull() & df_cleaned_retained["imaging_end_datetime"].notnull()].copy()
    i_e_rows["timestamp"] = pd.to_datetime(i_e_rows["imaging_end_datetime"], format=TIMESTAMP_FORMAT)
    i_e_rows["activity"] = "Imaging End"
    i_e_rows["stage"] = "Imaging"
    i_e_rows["stage_order"] = 6
    i_e_rows["source_order_id"] = i_e_rows["imaging_request_id"].astype(int).astype(str)
    i_e_events = i_e_rows.drop_duplicates(subset=["appointment_id", "imaging_request_id", "timestamp"])
    events.append(i_e_events[["appointment_id", "activity", "timestamp", "stage", "stage_order", "source_order_id", "record_no"]])
    print(f"      Extracted Imaging End events: {len(i_e_events):,}")

    # G. Pharmacy Start
    ph_s_rows = df_cleaned_retained[df_cleaned_retained["pharmacy_sale_line_id"].notnull() & df_cleaned_retained["pharmacy_start_datetime"].notnull()].copy()
    ph_s_rows["timestamp"] = pd.to_datetime(ph_s_rows["pharmacy_start_datetime"], format=TIMESTAMP_FORMAT)
    ph_s_rows["activity"] = "Pharmacy Start"
    ph_s_rows["stage"] = "Pharmacy"
    ph_s_rows["stage_order"] = 7
    ph_s_rows["source_order_id"] = ph_s_rows["pharmacy_sale_line_id"].astype(int).astype(str)
    ph_s_events = ph_s_rows.drop_duplicates(subset=["appointment_id", "pharmacy_sale_line_id", "timestamp"])
    events.append(ph_s_events[["appointment_id", "activity", "timestamp", "stage", "stage_order", "source_order_id", "record_no"]])
    print(f"      Extracted Pharmacy Start events: {len(ph_s_events):,}")

    # H. Pharmacy End
    ph_e_rows = df_cleaned_retained[df_cleaned_retained["pharmacy_sale_line_id"].notnull() & df_cleaned_retained["pharmacy_end_datetime"].notnull()].copy()
    ph_e_rows["timestamp"] = pd.to_datetime(ph_e_rows["pharmacy_end_datetime"], format=TIMESTAMP_FORMAT)
    ph_e_rows["activity"] = "Pharmacy End"
    ph_e_rows["stage"] = "Pharmacy"
    ph_e_rows["stage_order"] = 8
    ph_e_rows["source_order_id"] = ph_e_rows["pharmacy_sale_line_id"].astype(int).astype(str)
    ph_e_events = ph_e_rows.drop_duplicates(subset=["appointment_id", "pharmacy_sale_line_id", "timestamp"])
    events.append(ph_e_events[["appointment_id", "activity", "timestamp", "stage", "stage_order", "source_order_id", "record_no"]])
    print(f"      Extracted Pharmacy End events: {len(ph_e_events):,}")

    # Concatenate all event streams
    df_event_log = pd.concat(events, ignore_index=True)
    df_event_log.rename(columns={"appointment_id": "case_id", "record_no": "source_record_no"}, inplace=True)

    # Sort deterministically: case_id -> timestamp -> stage_order -> source_order_id
    print("      Applying deterministic sorting across cases and clinical stages...")
    df_event_log.sort_values(by=["case_id", "timestamp", "stage_order", "source_order_id"], inplace=True)

    # Format timestamp to ISO 8601 string: YYYY-MM-DD HH:MM:SS
    df_event_log["timestamp"] = df_event_log["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")

    # Select final event log schema
    output_cols = ["case_id", "activity", "timestamp", "stage", "source_order_id", "source_record_no"]
    df_final_log = df_event_log[output_cols]

    # Save event log
    print(f"      Saving event log to {EVENT_LOG_CSV_PATH.name}...")
    df_final_log.to_csv(EVENT_LOG_CSV_PATH, index=False)
    print(f"      Saved {EVENT_LOG_CSV_PATH} ({EVENT_LOG_CSV_PATH.stat().st_size:,} bytes).")

    # 5. Validation and Audit Summary
    print("[6/6] Validating output integrity and computing audit metrics...")
    total_events = len(df_final_log)
    total_cases = df_final_log["case_id"].nunique()

    # Verify no nulls in required columns
    assert df_final_log["case_id"].isnull().sum() == 0, "Null case_ids detected!"
    assert df_final_log["activity"].isnull().sum() == 0, "Null activities detected!"
    assert df_final_log["timestamp"].isnull().sum() == 0, "Null timestamps detected!"

    # Verify timestamp parseability
    parsed_check = pd.to_datetime(df_final_log["timestamp"], format="%Y-%m-%d %H:%M:%S", errors="coerce")
    assert parsed_check.isnull().sum() == 0, "Unparseable timestamps detected in event log!"

    # Verify same-case timestamp ties
    tie_mask = df_final_log.duplicated(subset=["case_id", "timestamp"], keep=False)
    tie_count = tie_mask.sum()

    # Re-verify original file hash
    post_hash = compute_file_sha256(RAW_CSV_PATH)
    assert initial_hash == post_hash, "CRITICAL ERROR: Original raw CSV was modified during execution!"
    print(f"      Original file hash verified unchanged: {post_hash}")

    metrics = {
        "raw_file": str(RAW_CSV_PATH),
        "raw_sha256": post_hash,
        "raw_rows": int(raw_rows),
        "raw_cols": int(raw_cols),
        "cleaned_rows": int(cleaned_rows),
        "duplicate_rows_excluded": int(duplicate_count),
        "artifact_cols_dropped": cols_to_drop,
        "flagged_counts": {
            "duplicate_records": int(duplicate_count),
            "prescription_inverted": int(p_inverted_count),
            "prescription_start_null": int(p_start_null_count),
            "lab_end_truncated": int(lab_end_truncated_count),
            "imaging_end_null": int(img_end_null_count),
            "pre_appointment_lab": int(pre_appt_lab_count)
        },
        "event_log_metrics": {
            "total_cases": int(total_cases),
            "total_events": int(total_events),
            "same_case_timestamp_ties": int(tie_count),
            "tie_percentage": round(float(tie_count / total_events * 100), 2),
            "activity_counts": df_final_log["activity"].value_counts().to_dict()
        }
    }

    print("\n" + "=" * 70)
    print("PIPELINE EXECUTION SUMMARY")
    print("=" * 70)
    print(json.dumps(metrics, indent=2))
    print("=" * 70)
    print("Execution complete. Ready for summary report authoring.")

    return metrics


if __name__ == "__main__":
    run_pipeline()
