"""CareFlow Synthetic Demonstration Data Generators.

Provides deterministic clinical pathway event generators mirroring `src/data/demoData.ts`
for Emergency Department Sepsis, Cardiology Cath Lab, and Outpatient cohorts.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List


def generate_sepsis_events() -> List[Dict[str, Any]]:
    """Generates 9,855 synthetic acute sepsis resuscitation events across 1,428 cases."""
    events: List[Dict[str, Any]] = []
    base_date_ms = int(datetime(2026, 9, 12, 8, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
    day_ms = 24 * 60 * 60 * 1000
    total_cases = 1428

    physicians = [
        "Dr. Marcus Sterling, MD",
        "Dr. Sarah Lin, MD",
        "Dr. Elena Rostova, MD",
        "Dr. Robert Vance, MD",
        "Dr. Keith Patel, MD",
    ]
    nurses = [
        "RN H. Martinez",
        "RN T. Brooks",
        "RN K. Chen",
        "RN D. Washington",
        "RN S. Alvarez",
    ]

    for c in range(1, total_cases + 1):
        case_id = f"PAT-2026-{9000 + c:04d}"
        day_offset = (c % 28) * day_ms
        hour_offset = ((c * 17) % (14 * 60)) * 60 * 1000
        cur_time = base_date_ms + day_offset + hour_offset

        doc = physicians[c % len(physicians)]
        nurse = nurses[c % len(nurses)]

        rand = (c * 37) % 100
        if rand >= 88:
            variant_type = 4
        elif rand >= 74:
            variant_type = 3
        elif rand >= 48:
            variant_type = 2
        else:
            variant_type = 1

        # Step 1: ED Registration & Triage
        events.append({
            "case_id": case_id,
            "activity": "ED Registration & Triage",
            "timestamp_ms": cur_time,
            "resource": nurse,
            "department": "Emergency Medicine",
            "status": "Completed",
        })

        # Step 2: Initial Physician Assessment
        cur_time += (10 + (c % 15)) * 60 * 1000
        events.append({
            "case_id": case_id,
            "activity": "Initial Physician Assessment",
            "timestamp_ms": cur_time,
            "resource": doc,
            "department": "Emergency Medicine",
            "status": "Completed",
        })

        # Step 3: Stat Blood Draw & Biomarkers
        cur_time += (15 + (c % 15)) * 60 * 1000
        events.append({
            "case_id": case_id,
            "activity": "Stat Blood Draw & Biomarkers",
            "timestamp_ms": cur_time,
            "resource": nurse,
            "department": "Nursing / Phlebotomy",
            "status": "Completed",
        })

        if variant_type == 4:
            # Specimen rejection and redraw loop
            cur_time += 48 * 60 * 1000
            events.append({
                "case_id": case_id,
                "activity": "Central Laboratory Specimen Run",
                "timestamp_ms": cur_time,
                "resource": "Pathology Tech Kowalski",
                "department": "Pathology",
                "status": "Sample Rejected",
            })
            cur_time += 20 * 60 * 1000
            events.append({
                "case_id": case_id,
                "activity": "Specimen Hemolysis / Re-draw Order",
                "timestamp_ms": cur_time,
                "resource": doc,
                "department": "Emergency Medicine",
                "status": "Rework Flagged",
            })
            cur_time += 25 * 60 * 1000
            events.append({
                "case_id": case_id,
                "activity": "Stat Blood Draw & Biomarkers",
                "timestamp_ms": cur_time,
                "resource": "Phlebotomy Lead W. Jones",
                "department": "Nursing / Phlebotomy",
                "status": "Repeated Specimen",
            })

        # Step 4: Central Laboratory Specimen Run
        cur_time += (40 + (c % 20)) * 60 * 1000
        events.append({
            "case_id": case_id,
            "activity": "Central Laboratory Specimen Run",
            "timestamp_ms": cur_time,
            "resource": "Pathology Tech Kowalski",
            "department": "Pathology",
            "status": "Results Verified",
        })

        if variant_type in (2, 3):
            cur_time += (55 + (c % 25)) * 60 * 1000
            events.append({
                "case_id": case_id,
                "activity": "Diagnostic CT / Angiography Imaging",
                "timestamp_ms": cur_time,
                "resource": "Rad Tech J. Miller",
                "department": "Radiology",
                "status": "Scan Acquired",
            })

        if variant_type == 3:
            cur_time += (65 + (c % 25)) * 60 * 1000
            events.append({
                "case_id": case_id,
                "activity": "Sub-Specialist On-Call Consult",
                "timestamp_ms": cur_time,
                "resource": "Specialist Fellow Dr. K. Lee",
                "department": "Inpatient Specialty",
                "status": "Recommendation Formulated",
            })

        # Step 5: Therapy
        cur_time += (20 + (c % 15)) * 60 * 1000
        events.append({
            "case_id": case_id,
            "activity": "Empiric Antibiotic / Targeted Therapy",
            "timestamp_ms": cur_time,
            "resource": nurse,
            "department": "Emergency Medicine",
            "status": "Administered",
        })

        # Step 6: Disposition
        cur_time += (75 + (c % 30)) * 60 * 1000
        if variant_type == 3:
            final_act = "Direct ICU Bed Transfer"
        elif c % 3 == 0:
            final_act = "Discharge to Outpatient Care"
        else:
            final_act = "Inpatient Ward Bed Handover"

        events.append({
            "case_id": case_id,
            "activity": final_act,
            "timestamp_ms": cur_time,
            "resource": "Bed Placement Coordinator",
            "department": "Hospital Operations",
            "status": "Case Concluded",
        })

    return events


def generate_cardiology_events() -> List[Dict[str, Any]]:
    """Generates 4,320 synthetic cardiology door-to-balloon events across 720 cases."""
    events: List[Dict[str, Any]] = []
    base_date_ms = int(datetime(2026, 9, 18, 7, 30, 0, tzinfo=timezone.utc).timestamp() * 1000)
    day_ms = 24 * 60 * 60 * 1000
    total_cases = 720

    for c in range(1, total_cases + 1):
        case_id = f"CARD-2026-{4000 + c:04d}"
        cur_time = base_date_ms + (c % 21) * day_ms + ((c * 23) % 720) * 60 * 1000

        events.append({
            "case_id": case_id,
            "activity": "Acute Chest Pain Presentation",
            "timestamp_ms": cur_time,
            "resource": "Triage Nurse",
            "department": "Cardiology Triage",
            "status": "Assessed",
        })
        cur_time += 8 * 60 * 1000
        events.append({
            "case_id": case_id,
            "activity": "Stat 12-Lead ECG & High-Sensitivity Troponin",
            "timestamp_ms": cur_time,
            "resource": "Cardiology Tech",
            "department": "Cardiology Diagnostics",
            "status": "Completed",
        })
        cur_time += 22 * 60 * 1000
        events.append({
            "case_id": case_id,
            "activity": "Cardiologist Bedside Evaluation",
            "timestamp_ms": cur_time,
            "resource": "Dr. Evelyn Howard, FACC",
            "department": "Interventional Cardiology",
            "status": "Cath Lab Activated",
        })
        cur_time += 35 * 60 * 1000
        events.append({
            "case_id": case_id,
            "activity": "Cath Lab Suite Transfer & Sheath Insertion",
            "timestamp_ms": cur_time,
            "resource": "Cath Lab Scrub Team",
            "department": "Cardiac Catheterization Lab",
            "status": "Access Achieved",
        })
        cur_time += 45 * 60 * 1000
        events.append({
            "case_id": case_id,
            "activity": "Percutaneous Coronary Intervention (PCI)",
            "timestamp_ms": cur_time,
            "resource": "Dr. Evelyn Howard, FACC",
            "department": "Cardiac Catheterization Lab",
            "status": "Stent Deployed",
        })
        cur_time += 60 * 60 * 1000
        events.append({
            "case_id": case_id,
            "activity": "Coronary Care Unit (CCU) Transfer",
            "timestamp_ms": cur_time,
            "resource": "CCU Transport Team",
            "department": "Inpatient CCU",
            "status": "Patient Admitted",
        })

    return events


def generate_outpatient_events() -> List[Dict[str, Any]]:
    """Generates 3,100 synthetic outpatient encounter events across 1,000 cases."""
    events: List[Dict[str, Any]] = []
    base_date_ms = int(datetime(2026, 10, 1, 8, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
    day_ms = 24 * 60 * 60 * 1000
    total_cases = 1000

    physicians = [
        "Dr. Maya Lin, MD",
        "Dr. Julian Vance, MD",
        "Dr. Anita Desai, MD",
        "Dr. Marcus Thorne, MD",
        "Dr. Chloe Bennett, MD",
    ]
    nurses = [
        "RN S. Gallagher",
        "RN J. Kowalski",
        "RN T. Nguyen",
        "RN R. Washington",
        "RN E. Gomez",
    ]
    lab_techs = [
        "Lab Tech K. Bradley",
        "Lab Tech D. Morales",
        "Lab Tech P. Chen",
    ]
    rad_techs = [
        "Rad Tech H. Evans",
        "Rad Tech S. Al-Mansoor",
    ]
    pharmacists = [
        "PharmD L. Mercer",
        "PharmD B. Sterling",
    ]

    for c in range(1, total_cases + 1):
        case_id = f"OUT-2026-{1000 + c:04d}"
        day_offset = (c % 30) * day_ms
        minute_offset = ((c * 19) % (10 * 60)) * 60 * 1000
        cur_time = base_date_ms + day_offset + minute_offset

        doc = physicians[c % len(physicians)]
        nurse = nurses[c % len(nurses)]
        lab = lab_techs[c % len(lab_techs)]
        rad = rad_techs[c % len(rad_techs)]
        pharm = pharmacists[c % len(pharmacists)]

        rand = (c * 43) % 100
        if rand >= 96:
            variant = 5
        elif rand >= 89:
            variant = 4
        elif rand >= 75:
            variant = 3
        elif rand >= 52:
            variant = 2
        else:
            variant = 1

        # Step 1: Appointment Start
        events.append({
            "case_id": case_id,
            "activity": "Appointment Start",
            "timestamp_ms": cur_time,
            "resource": doc,
            "department": "Outpatient Consultation",
            "status": "In Consultation",
        })

        # Step 2: Prescription Order
        is_tail_presc = (c * 17) % 100 >= 89
        presc_dur = (90 + ((c * 7) % 30)) if is_tail_presc else (15 + ((c * 3) % 21))
        cur_time += presc_dur * 60 * 1000
        events.append({
            "case_id": case_id,
            "activity": "Prescription Order",
            "timestamp_ms": cur_time,
            "resource": doc,
            "department": "Clinical Prescribing",
            "status": "Order Authorized",
        })

        if variant in (2, 4):
            is_tail_lab = (c * 23) % 100 >= 88
            lab_dur = (60 + ((c * 5) % 15)) if is_tail_lab else (14 + ((c * 3) % 11))
            cur_time += lab_dur * 60 * 1000
            events.append({
                "case_id": case_id,
                "activity": "Laboratory Start",
                "timestamp_ms": cur_time,
                "resource": nurse,
                "department": "Diagnostic Laboratory",
                "status": "Specimen Collected",
            })

            lab_rand = (c * 29) % 100
            if lab_rand >= 88:
                end_dur = 220 + ((c * 11) % 41)
            elif lab_rand >= 72:
                end_dur = 110 + ((c * 7) % 31)
            else:
                end_dur = 65 + ((c * 3) % 33)
            cur_time += end_dur * 60 * 1000
            events.append({
                "case_id": case_id,
                "activity": "Laboratory End",
                "timestamp_ms": cur_time,
                "resource": lab,
                "department": "Diagnostic Laboratory",
                "status": "Results Validated",
            })

        if variant in (3, 4):
            is_tail_img = (c * 31) % 100 >= 88
            img_dur = (100 + ((c * 7) % 25)) if is_tail_img else (26 + ((c * 3) % 19))
            cur_time += img_dur * 60 * 1000
            events.append({
                "case_id": case_id,
                "activity": "Imaging Start",
                "timestamp_ms": cur_time,
                "resource": rad,
                "department": "Radiology & Imaging",
                "status": "Scan Initiated",
            })

            is_tail_end = (c * 13) % 100 >= 88
            end_dur = (8 + (c % 3)) if is_tail_end else (2 + (c % 3))
            cur_time += end_dur * 60 * 1000
            events.append({
                "case_id": case_id,
                "activity": "Imaging End",
                "timestamp_ms": cur_time,
                "resource": rad,
                "department": "Radiology & Imaging",
                "status": "Image Series Stored",
            })

        if variant == 5:
            is_tail_ph = (c * 37) % 100 >= 85
            ph_dur = (18 + ((c * 3) % 6)) if is_tail_ph else (5 + (c % 5))
            cur_time += ph_dur * 60 * 1000
            events.append({
                "case_id": case_id,
                "activity": "Pharmacy Start",
                "timestamp_ms": cur_time,
                "resource": pharm,
                "department": "Outpatient Pharmacy",
                "status": "Verification Queue",
            })

            is_tail_ph_end = (c * 19) % 100 >= 85
            end_ph_dur = (2 + (c % 2)) if is_tail_ph_end else (c % 2)
            cur_time += end_ph_dur * 60 * 1000
            events.append({
                "case_id": case_id,
                "activity": "Pharmacy End",
                "timestamp_ms": cur_time,
                "resource": pharm,
                "department": "Outpatient Pharmacy",
                "status": "Medication Dispensed",
            })

    return events
