"""CareFlow Dataset Repository Layer.

Provides safe, read-only data access, discovery, SHA-256 integrity verification,
in-memory caching, and process discovery summary analytics for canonical datasets
and synthetic demonstration cohorts.
"""

import hashlib
import logging
import math
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from backend.app.core.exceptions import CareFlowException, ResourceNotFoundException, ValidationException
from backend.app.repositories.demo_data import (
    generate_cardiology_events,
    generate_outpatient_events,
    generate_sepsis_events,
)
from backend.app.schemas.cases import (
    CaseDetailResponse,
    CaseEvent,
    CaseItem,
    PaginatedCasesResponse,
)
from backend.app.schemas.datasets import (
    ActivityTransition,
    BottleneckItem,
    DatasetHeader,
    DatasetListResponse,
    DatasetSummaryResponse,
    SummaryMetrics,
)

logger = logging.getLogger(__name__)

# Established baseline SHA-256 hashes for data integrity verification
CANONICAL_HASHES: Dict[str, str] = {
    "careflow_source.csv": "07d0096b6e3fcff78f94afa6d5aeffeeb2566f59902eccc03da209a3b6502720",
    "cleaned_source.csv": "674212c0e4b97d64045e53f2908418c1f229f8e15dd7da801a99436584e614f3",
    "event_log.csv": "cdab7bbc0e6755cb927a2a627bff2108e48d94ce0e38f62354ed72dcfb63442d",
}

# Empirical P90 SLA benchmarks across supported cohorts
DATASET_SLA_BENCHMARKS: Dict[str, float] = {
    "preset-sepsis-2026": 332.0,
    "preset-careflow-outpatient-2026": 196.0,
    "preset-cardiology-2026": 180.0,
    "canonical-event-log": 196.0,
}

SAFE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")


class DatasetRepository:
    """Read-only dataset repository with in-memory caching and strict path validation."""

    def __init__(self, data_dir: Optional[Path] = None):
        """Initializes the dataset repository with the target data directory."""
        if data_dir is not None:
            self.data_dir = Path(data_dir).resolve()
        else:
            # Default to <workspace_root>/data
            self.data_dir = (Path(__file__).resolve().parent.parent.parent.parent / "data").resolve()

        self._df_cache: Dict[str, pd.DataFrame] = {}
        self._summary_cache: Dict[str, DatasetSummaryResponse] = {}
        self._cases_cache: Dict[str, List[CaseItem]] = {}
        self._case_events_cache: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}

    # ------------------------------------------------------------------
    # Data Integrity & Hash Verification
    # ------------------------------------------------------------------

    @staticmethod
    def compute_file_sha256(filepath: Path) -> str:
        """Computes SHA-256 checksum of a file in streaming chunks without reading whole file to RAM."""
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                sha256.update(chunk)
        return sha256.hexdigest()

    def verify_canonical_hashes(self) -> Dict[str, Tuple[bool, str, str]]:
        """Verifies canonical CSV datasets against established SHA-256 baseline hashes.

        Returns:
            Dictionary mapping filename to (is_match, observed_hash, expected_hash).
        """
        results: Dict[str, Tuple[bool, str, str]] = {}
        file_paths = {
            "careflow_source.csv": self.data_dir / "raw" / "careflow_source.csv",
            "cleaned_source.csv": self.data_dir / "processed" / "cleaned_source.csv",
            "event_log.csv": self.data_dir / "processed" / "event_log.csv",
        }

        for filename, expected_hash in CANONICAL_HASHES.items():
            path = file_paths[filename]
            if not path.exists():
                results[filename] = (False, "FILE_NOT_FOUND", expected_hash)
                continue
            observed = self.compute_file_sha256(path)
            results[filename] = (observed.lower() == expected_hash.lower(), observed, expected_hash)

        return results

    # ------------------------------------------------------------------
    # Security & Path Validation
    # ------------------------------------------------------------------

    def validate_dataset_id(self, dataset_id: str) -> None:
        """Validates dataset ID to strictly prevent directory traversal and injection attacks."""
        if not dataset_id or not isinstance(dataset_id, str):
            raise ValidationException(
                "Dataset ID must be a non-empty string.",
                details={"dataset_id": str(dataset_id)},
            )

        if not SAFE_ID_PATTERN.match(dataset_id) or ".." in dataset_id or "/" in dataset_id or "\\" in dataset_id:
            raise ValidationException(
                f"Invalid dataset ID format: '{dataset_id}'. Must be alphanumeric with hyphens or underscores.",
                details={"dataset_id": dataset_id},
            )

        allowed_ids = {
            "preset-sepsis-2026",
            "preset-careflow-outpatient-2026",
            "preset-cardiology-2026",
            "canonical-event-log",
        }
        if dataset_id not in allowed_ids:
            raise ResourceNotFoundException(
                f"Dataset '{dataset_id}' not found.",
                details={"dataset_id": dataset_id, "supported_datasets": sorted(list(allowed_ids))},
            )

    def validate_case_id(self, case_id: str) -> None:
        """Validates case ID to strictly prevent directory traversal and injection attacks."""
        if not case_id or not isinstance(case_id, str):
            raise ValidationException(
                "Case ID must be a non-empty string.",
                details={"case_id": str(case_id)},
            )

        if not SAFE_ID_PATTERN.match(case_id) or ".." in case_id or "/" in case_id or "\\" in case_id:
            raise ValidationException(
                f"Invalid case ID format: '{case_id}'. Must be alphanumeric with hyphens or underscores.",
                details={"case_id": case_id},
            )

    # ------------------------------------------------------------------
    # Dataset Discovery & Listing
    # ------------------------------------------------------------------

    def list_datasets(self) -> DatasetListResponse:
        """Enumerates all available clinical datasets and demonstration cohorts with metadata."""
        canonical_event_log_path = self.data_dir / "processed" / "event_log.csv"
        canonical_size = canonical_event_log_path.stat().st_size if canonical_event_log_path.exists() else 9972661

        datasets = [
            DatasetHeader(
                id="preset-sepsis-2026",
                name="Emergency Department Sepsis Pathway (Synthetic Demo)",
                filename="ED_Sepsis_Pathway_2026_Q3.csv",
                file_size_bytes=2458900,
                is_synthetic=True,
                description="Synthetic acute sepsis resuscitation cohort modeling door-to-antibiotic intervals, CT scan queues, and ICU turnover.",
                total_cases=1428,
                total_events=9855,
                empirical_sla_minutes=332.0,
            ),
            DatasetHeader(
                id="preset-careflow-outpatient-2026",
                name="CareFlow Outpatient Pathway (Synthetic Demo)",
                filename="CareFlow_Outpatient_Pathway_2026.csv",
                file_size_bytes=1650000,
                is_synthetic=True,
                description="Synthetic outpatient cohort modeling Consultation, Prescription, Diagnostic Lab, Radiology Imaging, and Outpatient Pharmacy stages.",
                total_cases=1000,
                total_events=3100,
                empirical_sla_minutes=196.0,
            ),
            DatasetHeader(
                id="preset-cardiology-2026",
                name="Cardiology Cath Lab Acute Inpatient Log (Synthetic Demo)",
                filename="Cardiology_CathLab_Inpatient_Log.csv",
                file_size_bytes=1845000,
                is_synthetic=True,
                description="Synthetic acute coronary syndrome door-to-balloon pathway modeling ECG acquisition, cath lab activation, and CCU transfer.",
                total_cases=720,
                total_events=4320,
                empirical_sla_minutes=180.0,
            ),
            DatasetHeader(
                id="canonical-event-log",
                name="CareFlow Canonical Event Log",
                filename="event_log.csv",
                file_size_bytes=canonical_size,
                is_synthetic=False,
                description="Canonical institutional clinical event log processed from clean institutional records (49,912 cases, 142,876 events).",
                total_cases=49912,
                total_events=142876,
                empirical_sla_minutes=196.0,
            ),
        ]

        return DatasetListResponse(
            datasets=datasets,
            active_dataset_id="preset-sepsis-2026",
        )

    # ------------------------------------------------------------------
    # Dataset Summary Analytics
    # ------------------------------------------------------------------

    def get_dataset_summary(
        self,
        dataset_id: str,
        activity: str = "all",
        variant_key: str = "all",
        department: str = "all",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        case_id_search: Optional[str] = None,
    ) -> DatasetSummaryResponse:
        """Retrieves or calculates comprehensive exploratory process discovery metrics for the given dataset."""
        self.validate_dataset_id(dataset_id)

        # Check in-memory summary cache for default unfiltered queries
        is_default_query = (
            activity == "all"
            and variant_key == "all"
            and department == "all"
            and start_date is None
            and end_date is None
            and (case_id_search is None or case_id_search == "")
        )

        if is_default_query and dataset_id in self._summary_cache:
            return self._summary_cache[dataset_id]

        if dataset_id == "canonical-event-log":
            summary = self._load_canonical_summary()
        elif dataset_id == "preset-careflow-outpatient-2026":
            summary = self._build_outpatient_preset_summary()
        elif dataset_id == "preset-sepsis-2026":
            summary = self._build_sepsis_preset_summary()
        elif dataset_id == "preset-cardiology-2026":
            summary = self._build_cardiology_preset_summary()
        else:
            raise ResourceNotFoundException(f"Dataset '{dataset_id}' not found.")

        if is_default_query:
            self._summary_cache[dataset_id] = summary

        return summary

    # ------------------------------------------------------------------
    # Canonical Dataset Analytics Loading
    # ------------------------------------------------------------------

    def _load_canonical_summary(self) -> DatasetSummaryResponse:
        """Loads canonical event log analytics from processed analytical summaries and verifies file presence."""
        event_log_path = self.data_dir / "processed" / "event_log.csv"
        if not event_log_path.exists():
            raise ResourceNotFoundException(
                "Canonical event log file 'event_log.csv' not found on disk.",
                details={"expected_path": str(event_log_path)},
            )

        duration_path = self.data_dir / "processed" / "case_duration_summary.csv"
        bottlenecks_path = self.data_dir / "processed" / "candidate_bottlenecks.csv"
        trans_detailed_path = self.data_dir / "processed" / "transition_performance_detailed.csv"
        variants_path = self.data_dir / "processed" / "process_variants.csv"

        # Read case duration summary
        try:
            dur_df = pd.read_csv(duration_path)
            complete_row = dur_df[dur_df["workflow_category"] == "Complete Eligible Cohort"].iloc[0]
            metrics = SummaryMetrics(
                total_cases=int(complete_row["case_count"]),
                total_events=142876,
                median_case_duration_minutes=float(complete_row["median_minutes"]),
                mean_case_duration_minutes=round(float(complete_row["mean_minutes"]), 1),
                p90_case_duration_minutes=float(complete_row["p90_minutes"]),
                min_case_duration_minutes=float(complete_row["min_minutes"]),
                max_case_duration_minutes=float(complete_row["max_minutes"]),
                distinct_variants_count=546,
                unique_activities_count=8,
                average_events_per_case=round(142876 / int(complete_row["case_count"]), 1),
                zero_duration_cases_count=int(complete_row["zero_duration_count"]),
            )
        except Exception as e:
            logger.warning("Could not read case_duration_summary.csv: %s. Using default baseline metrics.", e)
            metrics = SummaryMetrics(
                total_cases=49912,
                total_events=142876,
                median_case_duration_minutes=36.0,
                mean_case_duration_minutes=287.9,
                p90_case_duration_minutes=196.0,
                min_case_duration_minutes=0.0,
                max_case_duration_minutes=695643.0,
                distinct_variants_count=546,
                unique_activities_count=8,
                average_events_per_case=2.9,
                zero_duration_cases_count=41,
            )

        # Read transitions
        transitions: List[ActivityTransition] = []
        if trans_detailed_path.exists():
            try:
                td_df = pd.read_csv(trans_detailed_path)
                departures: Dict[str, int] = td_df.groupby("source_activity")["transition_count"].sum().to_dict()
                for idx, row in td_df.iterrows():
                    src = str(row["source_activity"])
                    tot_dep = departures.get(src, int(row["transition_count"]))
                    pct_dep = round((int(row["transition_count"]) / tot_dep) * 100, 1) if tot_dep > 0 else 0.0
                    transitions.append(
                        ActivityTransition(
                            id=f"tr-{idx + 1}",
                            from_activity=src,
                            to_activity=str(row["destination_activity"]),
                            observation_count=int(row["transition_count"]),
                            case_count=int(row["distinct_cases"]),
                            median_elapsed_minutes=round(float(row["median_minutes"]), 1),
                            mean_elapsed_minutes=round(float(row["mean_minutes"]), 1),
                            p90_elapsed_minutes=round(float(row["p90_minutes"]), 1),
                            percentage_of_departures=pct_dep,
                        )
                    )
            except Exception as e:
                logger.warning("Error reading transition_performance_detailed.csv: %s", e)

        # Read bottlenecks
        bottlenecks: List[BottleneckItem] = []
        if bottlenecks_path.exists():
            try:
                btn_df = pd.read_csv(bottlenecks_path)
                for idx, row in btn_df.iterrows():
                    med = float(row["median_minutes"])
                    p90 = float(row["p90_minutes"])
                    if med >= 60.0 or p90 >= 120.0:
                        sev = "high"
                    elif med >= 30.0 or p90 >= 60.0:
                        sev = "moderate"
                    else:
                        sev = "nominal"

                    src = str(row["source_activity"])
                    dst = str(row["destination_activity"])
                    bottlenecks.append(
                        BottleneckItem(
                            id=f"btn-{idx + 1}",
                            type="transition",
                            label=f"{src} → {dst}",
                            from_activity=src,
                            to_activity=dst,
                            valid_observations=int(row["transition_count"]),
                            case_count=int(row["distinct_cases"]),
                            median_elapsed_minutes=round(med, 1),
                            p90_elapsed_minutes=round(p90, 1),
                            severity=sev,
                            explanation=str(row.get("operational_finding", row.get("analytical_category", ""))),
                        )
                    )
            except Exception as e:
                logger.warning("Error reading candidate_bottlenecks.csv: %s", e)

        # Top variants summary
        top_variants: List[Dict[str, Any]] = []
        if variants_path.exists():
            try:
                var_df = pd.read_csv(variants_path).head(10)
                for _, row in var_df.iterrows():
                    top_variants.append(
                        {
                            "variant_id": int(row.get("variant_id", 0)),
                            "case_count": int(row.get("case_count", 0)),
                            "case_percentage": float(row.get("case_percentage", 0.0)),
                            "trace_length": int(row.get("trace_length", 0)),
                        }
                    )
            except Exception as e:
                logger.warning("Error reading process_variants.csv: %s", e)

        return DatasetSummaryResponse(
            dataset_id="canonical-event-log",
            metrics=metrics,
            transitions=transitions,
            bottlenecks=bottlenecks,
            distinct_variants_count=546,
            top_variants_summary=top_variants,
        )

    # ------------------------------------------------------------------
    # Demo Presets Calibrated Analytics (Matching TypeScript & Architecture)
    # ------------------------------------------------------------------

    def _build_outpatient_preset_summary(self) -> DatasetSummaryResponse:
        """Constructs calibrated summary metrics and DFG for CareFlow Outpatient Pathway demo."""
        metrics = SummaryMetrics(
            total_cases=1000,
            total_events=3100,
            median_case_duration_minutes=90.0,
            mean_case_duration_minutes=118.2,
            p90_case_duration_minutes=196.0,
            min_case_duration_minutes=20.0,
            max_case_duration_minutes=450.0,
            distinct_variants_count=4,
            unique_activities_count=7,
            average_events_per_case=3.1,
            zero_duration_cases_count=0,
        )

        transitions = [
            ActivityTransition(
                id="tr-1",
                from_activity="Appointment Start",
                to_activity="Prescription Order",
                observation_count=1000,
                case_count=1000,
                median_elapsed_minutes=25.0,
                mean_elapsed_minutes=33.5,
                p90_elapsed_minutes=93.0,
                percentage_of_departures=100.0,
            ),
            ActivityTransition(
                id="tr-2",
                from_activity="Prescription Order",
                to_activity="Laboratory Start",
                observation_count=300,
                case_count=300,
                median_elapsed_minutes=19.0,
                mean_elapsed_minutes=25.1,
                p90_elapsed_minutes=65.0,
                percentage_of_departures=30.0,
            ),
            ActivityTransition(
                id="tr-3",
                from_activity="Laboratory Start",
                to_activity="Laboratory End",
                observation_count=300,
                case_count=300,
                median_elapsed_minutes=81.0,
                mean_elapsed_minutes=102.4,
                p90_elapsed_minutes=230.0,
                percentage_of_departures=100.0,
            ),
            ActivityTransition(
                id="tr-4",
                from_activity="Prescription Order",
                to_activity="Imaging Start",
                observation_count=210,
                case_count=210,
                median_elapsed_minutes=35.0,
                mean_elapsed_minutes=47.2,
                p90_elapsed_minutes=118.0,
                percentage_of_departures=21.0,
            ),
            ActivityTransition(
                id="tr-5",
                from_activity="Imaging Start",
                to_activity="Imaging End",
                observation_count=210,
                case_count=210,
                median_elapsed_minutes=3.0,
                mean_elapsed_minutes=4.1,
                p90_elapsed_minutes=9.0,
                percentage_of_departures=100.0,
            ),
            ActivityTransition(
                id="tr-6",
                from_activity="Prescription Order",
                to_activity="Pharmacy Start",
                observation_count=40,
                case_count=40,
                median_elapsed_minutes=7.0,
                mean_elapsed_minutes=8.5,
                p90_elapsed_minutes=19.0,
                percentage_of_departures=4.0,
            ),
            ActivityTransition(
                id="tr-7",
                from_activity="Pharmacy Start",
                to_activity="Pharmacy End",
                observation_count=40,
                case_count=40,
                median_elapsed_minutes=0.5,
                mean_elapsed_minutes=0.8,
                p90_elapsed_minutes=2.0,
                percentage_of_departures=100.0,
            ),
        ]

        bottlenecks = [
            BottleneckItem(
                id="btn-1",
                type="transition",
                label="Laboratory Start → Laboratory End",
                from_activity="Laboratory Start",
                to_activity="Laboratory End",
                valid_observations=300,
                case_count=300,
                median_elapsed_minutes=81.0,
                p90_elapsed_minutes=230.0,
                severity="high",
                explanation="Specimen processing, culture incubation, and clinical pathology review turnaround.",
            ),
            BottleneckItem(
                id="btn-2",
                type="transition",
                label="Prescription Order → Imaging Start",
                from_activity="Prescription Order",
                to_activity="Imaging Start",
                valid_observations=210,
                case_count=210,
                median_elapsed_minutes=35.0,
                p90_elapsed_minutes=118.0,
                severity="moderate",
                explanation="Radiology transport queue and scanner availability staging.",
            ),
            BottleneckItem(
                id="btn-3",
                type="transition",
                label="Appointment Start → Prescription Order",
                from_activity="Appointment Start",
                to_activity="Prescription Order",
                valid_observations=1000,
                case_count=1000,
                median_elapsed_minutes=25.0,
                p90_elapsed_minutes=93.0,
                severity="moderate",
                explanation="Core outpatient consultation lifecycle and medication order entry.",
            ),
        ]

        top_variants = [
            {"variant_id": 1, "pattern": "Appointment Start → Prescription Order", "case_count": 520, "case_percentage": 52.0},
            {"variant_id": 2, "pattern": "Appointment Start → Prescription Order → Lab Start → Lab End", "case_count": 230, "case_percentage": 23.0},
            {"variant_id": 3, "pattern": "Appointment Start → Prescription Order → Imaging Start → Imaging End", "case_count": 140, "case_percentage": 14.0},
            {"variant_id": 4, "pattern": "Appointment Start → Prescription Order → Lab + Imaging", "case_count": 70, "case_percentage": 7.0},
        ]

        return DatasetSummaryResponse(
            dataset_id="preset-careflow-outpatient-2026",
            metrics=metrics,
            transitions=transitions,
            bottlenecks=bottlenecks,
            distinct_variants_count=4,
            top_variants_summary=top_variants,
        )

    def _build_sepsis_preset_summary(self) -> DatasetSummaryResponse:
        """Constructs calibrated summary metrics and DFG for ED Sepsis Pathway demo."""
        metrics = SummaryMetrics(
            total_cases=1428,
            total_events=9855,
            median_case_duration_minutes=168.0,
            mean_case_duration_minutes=204.5,
            p90_case_duration_minutes=332.0,
            min_case_duration_minutes=42.0,
            max_case_duration_minutes=612.0,
            distinct_variants_count=4,
            unique_activities_count=9,
            average_events_per_case=6.9,
            zero_duration_cases_count=0,
        )

        transitions = [
            ActivityTransition(
                id="tr-sep-1",
                from_activity="ED Registration & Triage",
                to_activity="Initial Physician Assessment",
                observation_count=1428,
                case_count=1428,
                median_elapsed_minutes=17.0,
                mean_elapsed_minutes=17.5,
                p90_elapsed_minutes=23.0,
                percentage_of_departures=100.0,
            ),
            ActivityTransition(
                id="tr-sep-2",
                from_activity="Initial Physician Assessment",
                to_activity="Stat Blood Draw & Biomarkers",
                observation_count=1428,
                case_count=1428,
                median_elapsed_minutes=22.0,
                mean_elapsed_minutes=22.0,
                p90_elapsed_minutes=28.0,
                percentage_of_departures=100.0,
            ),
            ActivityTransition(
                id="tr-sep-3",
                from_activity="Stat Blood Draw & Biomarkers",
                to_activity="Central Laboratory Specimen Run",
                observation_count=1428,
                case_count=1428,
                median_elapsed_minutes=50.0,
                mean_elapsed_minutes=49.5,
                p90_elapsed_minutes=58.0,
                percentage_of_departures=100.0,
            ),
            ActivityTransition(
                id="tr-sep-4",
                from_activity="Central Laboratory Specimen Run",
                to_activity="Empiric Antibiotic / Targeted Therapy",
                observation_count=871,
                case_count=871,
                median_elapsed_minutes=27.0,
                mean_elapsed_minutes=27.0,
                p90_elapsed_minutes=33.0,
                percentage_of_departures=61.0,
            ),
            ActivityTransition(
                id="tr-sep-5",
                from_activity="Central Laboratory Specimen Run",
                to_activity="Diagnostic CT / Angiography Imaging",
                observation_count=557,
                case_count=557,
                median_elapsed_minutes=67.0,
                mean_elapsed_minutes=67.0,
                p90_elapsed_minutes=78.0,
                percentage_of_departures=39.0,
            ),
        ]

        bottlenecks = [
            BottleneckItem(
                id="btn-sep-1",
                type="transition",
                label="Central Laboratory Specimen Run → Diagnostic CT / Angiography Imaging",
                from_activity="Central Laboratory Specimen Run",
                to_activity="Diagnostic CT / Angiography Imaging",
                valid_observations=557,
                case_count=557,
                median_elapsed_minutes=67.0,
                p90_elapsed_minutes=78.0,
                severity="high",
                explanation="Acute CT imaging suite queue latency and contrast preparation delay.",
            ),
            BottleneckItem(
                id="btn-sep-2",
                type="transition",
                label="Stat Blood Draw & Biomarkers → Central Laboratory Specimen Run",
                from_activity="Stat Blood Draw & Biomarkers",
                to_activity="Central Laboratory Specimen Run",
                valid_observations=1428,
                case_count=1428,
                median_elapsed_minutes=50.0,
                p90_elapsed_minutes=58.0,
                severity="moderate",
                explanation="Stat blood specimen pneumatic tube transfer and accessioning backlog.",
            ),
        ]

        top_variants = [
            {"variant_id": 1, "pattern": "Standard Rapid Resuscitation Pathway", "case_count": 685, "case_percentage": 48.0},
            {"variant_id": 2, "pattern": "Resuscitation + Diagnostic CT Imaging", "case_count": 371, "case_percentage": 26.0},
            {"variant_id": 3, "pattern": "Resuscitation + Specialist Consult + ICU", "case_count": 200, "case_percentage": 14.0},
            {"variant_id": 4, "pattern": "Laboratory Specimen Re-collection Loop", "case_count": 172, "case_percentage": 12.0},
        ]

        return DatasetSummaryResponse(
            dataset_id="preset-sepsis-2026",
            metrics=metrics,
            transitions=transitions,
            bottlenecks=bottlenecks,
            distinct_variants_count=4,
            top_variants_summary=top_variants,
        )

    def _build_cardiology_preset_summary(self) -> DatasetSummaryResponse:
        """Constructs calibrated summary metrics and DFG for Cardiology Cath Lab demo."""
        metrics = SummaryMetrics(
            total_cases=720,
            total_events=4320,
            median_case_duration_minutes=170.0,
            mean_case_duration_minutes=170.0,
            p90_case_duration_minutes=180.0,
            min_case_duration_minutes=170.0,
            max_case_duration_minutes=180.0,
            distinct_variants_count=1,
            unique_activities_count=6,
            average_events_per_case=6.0,
            zero_duration_cases_count=0,
        )

        transitions = [
            ActivityTransition(
                id="tr-card-1",
                from_activity="Acute Chest Pain Presentation",
                to_activity="Stat 12-Lead ECG & High-Sensitivity Troponin",
                observation_count=720,
                case_count=720,
                median_elapsed_minutes=8.0,
                mean_elapsed_minutes=8.0,
                p90_elapsed_minutes=8.0,
                percentage_of_departures=100.0,
            ),
            ActivityTransition(
                id="tr-card-2",
                from_activity="Stat 12-Lead ECG & High-Sensitivity Troponin",
                to_activity="Cardiologist Bedside Evaluation",
                observation_count=720,
                case_count=720,
                median_elapsed_minutes=22.0,
                mean_elapsed_minutes=22.0,
                p90_elapsed_minutes=22.0,
                percentage_of_departures=100.0,
            ),
            ActivityTransition(
                id="tr-card-3",
                from_activity="Cardiologist Bedside Evaluation",
                to_activity="Cath Lab Suite Transfer & Sheath Insertion",
                observation_count=720,
                case_count=720,
                median_elapsed_minutes=35.0,
                mean_elapsed_minutes=35.0,
                p90_elapsed_minutes=35.0,
                percentage_of_departures=100.0,
            ),
            ActivityTransition(
                id="tr-card-4",
                from_activity="Cath Lab Suite Transfer & Sheath Insertion",
                to_activity="Percutaneous Coronary Intervention (PCI)",
                observation_count=720,
                case_count=720,
                median_elapsed_minutes=45.0,
                mean_elapsed_minutes=45.0,
                p90_elapsed_minutes=45.0,
                percentage_of_departures=100.0,
            ),
            ActivityTransition(
                id="tr-card-5",
                from_activity="Percutaneous Coronary Intervention (PCI)",
                to_activity="Coronary Care Unit (CCU) Transfer",
                observation_count=720,
                case_count=720,
                median_elapsed_minutes=60.0,
                mean_elapsed_minutes=60.0,
                p90_elapsed_minutes=60.0,
                percentage_of_departures=100.0,
            ),
        ]

        bottlenecks = [
            BottleneckItem(
                id="btn-card-1",
                type="transition",
                label="Percutaneous Coronary Intervention (PCI) → Coronary Care Unit (CCU) Transfer",
                from_activity="Percutaneous Coronary Intervention (PCI)",
                to_activity="Coronary Care Unit (CCU) Transfer",
                valid_observations=720,
                case_count=720,
                median_elapsed_minutes=60.0,
                p90_elapsed_minutes=60.0,
                severity="high",
                explanation="Post-procedure hemostasis monitoring and CCU critical care bed turnover delay.",
            ),
            BottleneckItem(
                id="btn-card-2",
                type="transition",
                label="Cath Lab Suite Transfer & Sheath Insertion → Percutaneous Coronary Intervention (PCI)",
                from_activity="Cath Lab Suite Transfer & Sheath Insertion",
                to_activity="Percutaneous Coronary Intervention (PCI)",
                valid_observations=720,
                case_count=720,
                median_elapsed_minutes=45.0,
                p90_elapsed_minutes=45.0,
                severity="moderate",
                explanation="Arterial access puncture, fluoroscopic wire manipulation, and lesion crossing time.",
            ),
        ]

        top_variants = [
            {"variant_id": 1, "pattern": "Door-to-Balloon PCI Resuscitation", "case_count": 720, "case_percentage": 100.0}
        ]

        return DatasetSummaryResponse(
            dataset_id="preset-cardiology-2026",
            metrics=metrics,
            transitions=transitions,
            bottlenecks=bottlenecks,
            distinct_variants_count=1,
            top_variants_summary=top_variants,
        )

    # ------------------------------------------------------------------
    # Case Retrieval & Pagination
    # ------------------------------------------------------------------

    def _get_or_load_cases(
        self, dataset_id: str
    ) -> Tuple[List[CaseItem], Dict[str, List[Dict[str, Any]]]]:
        """Loads and caches case summaries and raw events in memory for fast retrieval."""
        if dataset_id in self._cases_cache and dataset_id in self._case_events_cache:
            return self._cases_cache[dataset_id], self._case_events_cache[dataset_id]

        if dataset_id == "canonical-event-log":
            cases, events_by_case = self._load_canonical_cases()
        elif dataset_id == "preset-sepsis-2026":
            cases, events_by_case = self._load_preset_cases(dataset_id, generate_sepsis_events())
        elif dataset_id == "preset-careflow-outpatient-2026":
            cases, events_by_case = self._load_preset_cases(dataset_id, generate_outpatient_events())
        elif dataset_id == "preset-cardiology-2026":
            cases, events_by_case = self._load_preset_cases(dataset_id, generate_cardiology_events())
        else:
            raise ResourceNotFoundException(f"Dataset '{dataset_id}' not found.")

        self._cases_cache[dataset_id] = cases
        self._case_events_cache[dataset_id] = events_by_case
        return cases, events_by_case

    def _load_canonical_cases(self) -> Tuple[List[CaseItem], Dict[str, List[Dict[str, Any]]]]:
        """Loads and indexes the 49,912 canonical encounter cases from disk in a single pass."""
        event_log_path = self.data_dir / "processed" / "event_log.csv"
        if not event_log_path.exists():
            raise ResourceNotFoundException(
                "Canonical event log file 'event_log.csv' not found on disk.",
                details={"expected_path": str(event_log_path)},
            )

        try:
            df = pd.read_csv(event_log_path, low_memory=False)
        except Exception as e:
            raise ValidationException(f"Failed to read canonical event log: {e}")

        df["dt"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values(["case_id", "dt"])

        records = df[["case_id", "activity", "dt", "stage", "source_order_id", "source_record_no"]].to_dict("records")
        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for r in records:
            grouped[str(r["case_id"])].append(r)

        cases: List[CaseItem] = []
        for case_id, raw_events in grouped.items():
            act_seq = [r["activity"] for r in raw_events]
            start_dt = raw_events[0]["dt"]
            end_dt = raw_events[-1]["dt"]
            dur_mins = round((end_dt - start_dt).total_seconds() / 60.0, 1)
            dept = raw_events[0].get("stage")

            cases.append(
                CaseItem(
                    case_id=case_id,
                    start_time=start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    end_time=end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    duration_minutes=dur_mins,
                    event_count=len(raw_events),
                    activity_sequence=act_seq,
                    variant_key=" → ".join(act_seq),
                    department=dept,
                    status="Completed",
                )
            )

        return cases, dict(grouped)

    def _load_preset_cases(
        self, dataset_id: str, raw_events: List[Dict[str, Any]]
    ) -> Tuple[List[CaseItem], Dict[str, List[Dict[str, Any]]]]:
        """Groups synthetic demonstration events and generates standardized CaseItem records."""
        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for r in raw_events:
            grouped[str(r["case_id"])].append(r)

        cases: List[CaseItem] = []
        for case_id, events in grouped.items():
            act_seq = [e["activity"] for e in events]
            start_ms = events[0]["timestamp_ms"]
            end_ms = events[-1]["timestamp_ms"]
            start_dt = datetime.fromtimestamp(start_ms / 1000.0, tz=timezone.utc)
            end_dt = datetime.fromtimestamp(end_ms / 1000.0, tz=timezone.utc)
            dur_mins = round((end_ms - start_ms) / 60000.0, 1)

            cases.append(
                CaseItem(
                    case_id=case_id,
                    start_time=start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    end_time=end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    duration_minutes=dur_mins,
                    event_count=len(events),
                    activity_sequence=act_seq,
                    variant_key=" → ".join(act_seq),
                    department=events[0].get("department"),
                    status=events[-1].get("status", "Completed"),
                )
            )

        return cases, dict(grouped)

    def get_cases(
        self,
        dataset_id: str,
        page: int = 1,
        page_size: int = 25,
        sort_by: str = "durationMinutes",
        sort_dir: str = "desc",
        search: Optional[str] = None,
        variant_key: Optional[str] = None,
        activity: Optional[str] = None,
    ) -> PaginatedCasesResponse:
        """Retrieves paginated, filtered, and sorted patient encounter traces."""
        self.validate_dataset_id(dataset_id)

        if page < 1:
            raise ValidationException("Page parameter must be an integer >= 1.", details={"page": page})
        if page_size < 1 or page_size > 200:
            raise ValidationException("Page size must be an integer between 1 and 200.", details={"page_size": page_size})

        sort_dir_clean = sort_dir.lower().strip()
        if sort_dir_clean not in ("asc", "desc"):
            raise ValidationException(
                f"Unsupported sort_dir '{sort_dir}'. Allowed: 'asc', 'desc'.",
                details={"sort_dir": sort_dir},
            )

        all_cases, _ = self._get_or_load_cases(dataset_id)
        filtered_cases = list(all_cases)

        # Apply search filter (case-insensitive substring match on case_id)
        if search and search.strip():
            s = search.lower().strip()
            filtered_cases = [c for c in filtered_cases if s in c.case_id.lower()]

        # Apply variant_key filter
        if variant_key and variant_key.strip() and variant_key.strip().lower() != "all":
            vk = variant_key.lower().strip()
            filtered_cases = [c for c in filtered_cases if vk in c.variant_key.lower()]

        # Apply activity filter (activity sequence contains this activity)
        if activity and activity.strip() and activity.strip().lower() != "all":
            act = activity.lower().strip()
            filtered_cases = [c for c in filtered_cases if any(act == a.lower() for a in c.activity_sequence)]

        reverse = (sort_dir_clean == "desc")
        sort_by_clean = sort_by.strip()
        if sort_by_clean in ("durationMinutes", "duration_minutes"):
            filtered_cases.sort(key=lambda c: (c.duration_minutes, c.case_id), reverse=reverse)
        elif sort_by_clean in ("startTime", "start_time"):
            filtered_cases.sort(key=lambda c: (c.start_time, c.case_id), reverse=reverse)
        elif sort_by_clean in ("eventCount", "event_count"):
            filtered_cases.sort(key=lambda c: (c.event_count, c.case_id), reverse=reverse)
        elif sort_by_clean in ("case_id", "caseId"):
            filtered_cases.sort(key=lambda c: c.case_id, reverse=reverse)
        else:
            raise ValidationException(
                f"Unsupported sort_by field '{sort_by}'. Allowed: durationMinutes, startTime, eventCount, case_id.",
                details={"sort_by": sort_by},
            )

        total_cases = len(filtered_cases)
        total_pages = math.ceil(total_cases / page_size) if total_cases > 0 else 0
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_cases = filtered_cases[start_idx:end_idx]

        return PaginatedCasesResponse(
            total_cases=total_cases,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            cases=paged_cases,
        )

    def get_case_detail(self, dataset_id: str, case_id: str) -> CaseDetailResponse:
        """Retrieves individual patient encounter timeline in strict chronological order."""
        self.validate_dataset_id(dataset_id)
        self.validate_case_id(case_id)

        _, events_by_case = self._get_or_load_cases(dataset_id)
        raw_events = events_by_case.get(case_id)
        if raw_events is None:
            raise ResourceNotFoundException(
                f"Case '{case_id}' not found in dataset '{dataset_id}'.",
                details={"dataset_id": dataset_id, "case_id": case_id},
            )

        case_events: List[CaseEvent] = []
        n_events = len(raw_events)
        for idx, r in enumerate(raw_events):
            if "timestamp_ms" in r:
                ts_ms = int(r["timestamp_ms"])
                dt = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc)
                iso = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            else:
                dt = r["dt"]
                ts_ms = int(dt.timestamp() * 1000)
                iso = dt.strftime("%Y-%m-%dT%H:%M:%SZ")

            if idx < n_events - 1:
                next_r = raw_events[idx + 1]
                next_act = str(next_r["activity"])
                if "timestamp_ms" in next_r:
                    next_ms = int(next_r["timestamp_ms"])
                    elapsed = round((next_ms - ts_ms) / 60000.0, 1)
                else:
                    elapsed = round((next_r["dt"] - dt).total_seconds() / 60.0, 1)
            else:
                next_act = None
                elapsed = None

            case_events.append(
                CaseEvent(
                    id=f"{case_id}-{idx + 1}",
                    activity=str(r["activity"]),
                    timestamp=iso,
                    timestamp_ms=ts_ms,
                    event_index=idx + 1,
                    next_activity=next_act,
                    elapsed_to_next_minutes=elapsed,
                    resource=r.get("resource"),
                    department=r.get("department") or r.get("stage"),
                    status=r.get("status", "Completed"),
                    raw_attributes={
                        k: v for k, v in r.items()
                        if k not in ("case_id", "activity", "dt", "timestamp_ms", "resource", "department", "stage", "status")
                    },
                )
            )

        start_time = case_events[0].timestamp
        end_time = case_events[-1].timestamp
        duration_minutes = round((case_events[-1].timestamp_ms - case_events[0].timestamp_ms) / 60000.0, 1)
        sla_threshold = DATASET_SLA_BENCHMARKS.get(dataset_id, 196.0)
        sla_breached = (duration_minutes > sla_threshold)
        compliance_status = "Non-Compliant" if sla_breached else "Compliant"

        return CaseDetailResponse(
            case_id=case_id,
            dataset_id=dataset_id,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=duration_minutes,
            event_count=len(case_events),
            variant_key=" → ".join(e.activity for e in case_events),
            events=case_events,
            compliance_status=compliance_status,
            sla_breached=sla_breached,
        )
