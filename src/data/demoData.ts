import { RawEventRow, ColumnMapping } from '../types';

export interface DatasetPreset {
  id: string;
  name: string;
  filename: string;
  description: string;
  fileSizeBytes: number;
  mapping: ColumnMapping;
  generateRows: () => RawEventRow[];
}

/**
 * Generate Emergency Department Sepsis Pathway Cohort (1,428 Cases, ~10,000 events)
 */
function generateEmergencySepsisRows(): RawEventRow[] {
  const rows: RawEventRow[] = [];
  const baseDate = new Date('2026-09-12T08:00:00Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const totalCases = 1428;

  const physicians = [
    'Dr. Marcus Sterling, MD',
    'Dr. Sarah Lin, MD',
    'Dr. Elena Rostova, MD',
    'Dr. Robert Vance, MD',
    'Dr. Keith Patel, MD',
  ];

  const nurses = [
    'RN H. Martinez',
    'RN T. Brooks',
    'RN K. Chen',
    'RN D. Washington',
    'RN S. Alvarez',
  ];

  for (let c = 1; c <= totalCases; c++) {
    const caseId = `PAT-2026-${(9000 + c).toString().padStart(4, '0')}`;
    const dayOffset = (c % 28) * dayMs;
    const hourOffset = ((c * 17) % (14 * 60)) * 60 * 1000;
    let curTime = baseDate + dayOffset + hourOffset;

    const assignedPhysician = physicians[c % physicians.length];
    const assignedNurse = nurses[c % nurses.length];

    // Determine variant probabilistically
    const rand = (c * 37) % 100;
    let variantType = 1; // 48%
    if (rand >= 48 && rand < 74) variantType = 2; // 26%
    else if (rand >= 74 && rand < 88) variantType = 3; // 14%
    else if (rand >= 88) variantType = 4; // 12%

    // Step 1: ED Registration & Triage
    rows.push({
      case_id: caseId,
      activity: 'ED Registration & Triage',
      timestamp: new Date(curTime).toISOString(),
      performer: assignedNurse,
      department: 'Emergency Medicine',
      status: 'Completed',
    });

    // Step 2: Initial Physician Assessment (10-25 mins later)
    curTime += (10 + (c % 15)) * 60 * 1000;
    rows.push({
      case_id: caseId,
      activity: 'Initial Physician Assessment',
      timestamp: new Date(curTime).toISOString(),
      performer: assignedPhysician,
      department: 'Emergency Medicine',
      status: 'Completed',
    });

    // Step 3: Stat Blood Draw & Biomarkers (15-30 mins later)
    curTime += (15 + (c % 15)) * 60 * 1000;
    rows.push({
      case_id: caseId,
      activity: 'Stat Blood Draw & Biomarkers',
      timestamp: new Date(curTime).toISOString(),
      performer: assignedNurse,
      department: 'Nursing / Phlebotomy',
      status: 'Completed',
    });

    if (variantType === 4) {
      // Variant 4: Laboratory Specimen Re-collection Loop (Rework)
      curTime += 48 * 60 * 1000;
      rows.push({
        case_id: caseId,
        activity: 'Central Laboratory Specimen Run',
        timestamp: new Date(curTime).toISOString(),
        performer: 'Pathology Tech Kowalski',
        department: 'Pathology',
        status: 'Sample Rejected',
      });

      curTime += 20 * 60 * 1000;
      rows.push({
        case_id: caseId,
        activity: 'Specimen Hemolysis / Re-draw Order',
        timestamp: new Date(curTime).toISOString(),
        performer: assignedPhysician,
        department: 'Emergency Medicine',
        status: 'Rework Flagged',
      });

      curTime += 25 * 60 * 1000;
      rows.push({
        case_id: caseId,
        activity: 'Stat Blood Draw & Biomarkers',
        timestamp: new Date(curTime).toISOString(),
        performer: 'Phlebotomy Lead W. Jones',
        department: 'Nursing / Phlebotomy',
        status: 'Repeated Specimen',
      });
    }

    // Step 4: Central Laboratory Specimen Run
    curTime += (40 + (c % 20)) * 60 * 1000;
    rows.push({
      case_id: caseId,
      activity: 'Central Laboratory Specimen Run',
      timestamp: new Date(curTime).toISOString(),
      performer: 'Pathology Tech Kowalski',
      department: 'Pathology',
      status: 'Results Verified',
    });

    // If Variant 2 or 3: Diagnostic CT Imaging
    if (variantType === 2 || variantType === 3) {
      curTime += (55 + (c % 25)) * 60 * 1000; // Bottleneck latency
      rows.push({
        case_id: caseId,
        activity: 'Diagnostic CT / Angiography Imaging',
        timestamp: new Date(curTime).toISOString(),
        performer: 'Rad Tech J. Miller',
        department: 'Radiology',
        status: 'Scan Acquired',
      });
    }

    // If Variant 3: Specialist Consult
    if (variantType === 3) {
      curTime += (65 + (c % 25)) * 60 * 1000; // Bottleneck latency
      rows.push({
        case_id: caseId,
        activity: 'Sub-Specialist On-Call Consult',
        timestamp: new Date(curTime).toISOString(),
        performer: 'Specialist Fellow Dr. K. Lee',
        department: 'Inpatient Specialty',
        status: 'Recommendation Formulated',
      });
    }

    // Therapy / Antibiotic Infusion
    curTime += (20 + (c % 15)) * 60 * 1000;
    rows.push({
      case_id: caseId,
      activity: 'Empiric Antibiotic / Targeted Therapy',
      timestamp: new Date(curTime).toISOString(),
      performer: assignedNurse,
      department: 'Emergency Medicine',
      status: 'Administered',
    });

    // Final Step: Disposition
    curTime += (75 + (c % 30)) * 60 * 1000; // Inpatient bed transfer delay
    const finalActivity =
      variantType === 3
        ? 'Direct ICU Bed Transfer'
        : c % 3 === 0
        ? 'Discharge to Outpatient Care'
        : 'Inpatient Ward Bed Handover';

    rows.push({
      case_id: caseId,
      activity: finalActivity,
      timestamp: new Date(curTime).toISOString(),
      performer: 'Bed Placement Coordinator',
      department: 'Hospital Operations',
      status: 'Case Concluded',
    });
  }

  return rows;
}

/**
 * Generate Cardiology Cath Lab Acute Log (720 Cases)
 */
function generateCardiologyRows(): RawEventRow[] {
  const rows: RawEventRow[] = [];
  const baseDate = new Date('2026-09-18T07:30:00Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const totalCases = 720;

  for (let c = 1; c <= totalCases; c++) {
    const caseId = `CARD-2026-${(4000 + c).toString().padStart(4, '0')}`;
    let curTime = baseDate + (c % 21) * dayMs + ((c * 23) % 720) * 60 * 1000;

    rows.push({
      case_id: caseId,
      activity: 'Acute Chest Pain Presentation',
      timestamp: new Date(curTime).toISOString(),
      performer: 'Triage Nurse',
      department: 'Cardiology Triage',
      status: 'Assessed',
    });

    curTime += 8 * 60 * 1000;
    rows.push({
      case_id: caseId,
      activity: 'Stat 12-Lead ECG & High-Sensitivity Troponin',
      timestamp: new Date(curTime).toISOString(),
      performer: 'Cardiology Tech',
      department: 'Cardiology Diagnostics',
      status: 'Completed',
    });

    curTime += 22 * 60 * 1000;
    rows.push({
      case_id: caseId,
      activity: 'Cardiologist Bedside Evaluation',
      timestamp: new Date(curTime).toISOString(),
      performer: 'Dr. Evelyn Howard, FACC',
      department: 'Interventional Cardiology',
      status: 'Cath Lab Activated',
    });

    curTime += 35 * 60 * 1000;
    rows.push({
      case_id: caseId,
      activity: 'Cath Lab Suite Transfer & Sheath Insertion',
      timestamp: new Date(curTime).toISOString(),
      performer: 'Cath Lab Scrub Team',
      department: 'Cardiac Catheterization Lab',
      status: 'Access Achieved',
    });

    curTime += 45 * 60 * 1000;
    rows.push({
      case_id: caseId,
      activity: 'Percutaneous Coronary Intervention (PCI)',
      timestamp: new Date(curTime).toISOString(),
      performer: 'Dr. Evelyn Howard, FACC',
      department: 'Cardiac Catheterization Lab',
      status: 'Stent Deployed',
    });

    curTime += 60 * 60 * 1000;
    rows.push({
      case_id: caseId,
      activity: 'Coronary Care Unit (CCU) Transfer',
      timestamp: new Date(curTime).toISOString(),
      performer: 'CCU Transport Team',
      department: 'Inpatient CCU',
      status: 'Patient Admitted',
    });
  }

  return rows;
}

/**
 * Generate CareFlow Outpatient Pathway Cohort (1,000 Cases, 3,100 events)
 *
 * Explicitly labeled as Synthetic Demonstration Data.
 *
 * Implements the CareFlow outpatient pathway across the 5 core clinical departments:
 * - Consultation (Appointment Start)
 * - Prescription (Prescription Order)
 * - Diagnostic Laboratory (Laboratory Start -> Laboratory End)
 * - Radiology & Imaging (Imaging Start -> Imaging End)
 * - Outpatient Pharmacy (Pharmacy Start -> Pharmacy End)
 *
 * Calibrated with realistic elapsed durations and positive tail latency skews referencing
 * verified Phase 3 empirical process mining benchmarks:
 * - Appointment Start -> Prescription Order (Median ~24m, P90 ~93m; Ref: 25.0m / 92.0m)
 * - Prescription Order -> Laboratory Start (Median ~20m, P90 ~65m; Ref: 19.0m / 65.0m)
 * - Laboratory Start -> Laboratory End (Median ~95m, P90 ~231m; Ref: 81.0m / 230.0m)
 * - Prescription Order -> Imaging Start (Median ~37.5m, P90 ~118m; Ref: 35.0m / 108.2m)
 * - Imaging Start -> Imaging End (Median ~3m, P90 ~9m; Ref: 3.0m / 9.0m)
 * - Prescription Order -> Pharmacy Start (Median ~7.5m, P90 ~9m; Ref: 7.0m / 19.0m)
 * - Pharmacy Start -> Pharmacy End (Median ~0.5m, P90 ~1m; Ref: 0.0m / 2.0m)
 * - Laboratory End -> Imaging Start (Intra-visit demo: Median ~37m, P90 ~106m; Empirical multi-encounter ref: 191.0m / 12,916.0m)
 */
function generateCareFlowOutpatientRows(): RawEventRow[] {
  const rows: RawEventRow[] = [];
  const baseDate = new Date('2026-10-01T08:00:00Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const totalCases = 1000;

  const physicians = [
    'Dr. Maya Lin, MD',
    'Dr. Julian Vance, MD',
    'Dr. Anita Desai, MD',
    'Dr. Marcus Thorne, MD',
    'Dr. Chloe Bennett, MD',
  ];

  const nurses = [
    'RN S. Gallagher',
    'RN J. Kowalski',
    'RN T. Nguyen',
    'RN R. Washington',
    'RN E. Gomez',
  ];

  const labTechs = [
    'Lab Tech K. Bradley',
    'Lab Tech D. Morales',
    'Lab Tech P. Chen',
  ];

  const radTechs = [
    'Rad Tech H. Evans',
    'Rad Tech S. Al-Mansoor',
  ];

  const pharmacists = [
    'PharmD L. Mercer',
    'PharmD B. Sterling',
  ];

  for (let c = 1; c <= totalCases; c++) {
    // Synthetic deterministic case identifier (never real patient identifiers)
    const caseId = `OUT-2026-${(1000 + c).toString().padStart(4, '0')}`;
    const dayOffset = (c % 30) * dayMs;
    const minuteOffset = ((c * 19) % (10 * 60)) * 60 * 1000;
    let curTime = baseDate + dayOffset + minuteOffset;

    const physician = physicians[c % physicians.length];
    const nurse = nurses[c % nurses.length];
    const labTech = labTechs[c % labTechs.length];
    const radTech = radTechs[c % radTechs.length];
    const pharmacist = pharmacists[c % pharmacists.length];

    // Stratified variant distribution:
    // Variant 1: Consultation -> Prescription (52%)
    // Variant 2: Consultation -> Prescription -> Lab (23%)
    // Variant 3: Consultation -> Prescription -> Imaging (14%)
    // Variant 4: Consultation -> Prescription -> Lab + Imaging (7%)
    // Variant 5: Consultation -> Prescription -> Pharmacy (4%)
    const rand = (c * 43) % 100;
    let variant = 1;
    if (rand >= 52 && rand < 75) variant = 2;
    else if (rand >= 75 && rand < 89) variant = 3;
    else if (rand >= 89 && rand < 96) variant = 4;
    else if (rand >= 96) variant = 5;

    // Step 1: Appointment Start (Outpatient Consultation)
    rows.push({
      case_id: caseId,
      activity: 'Appointment Start',
      timestamp: new Date(curTime).toISOString(),
      performer: physician,
      department: 'Outpatient Consultation',
      status: 'In Consultation',
    });

    // Step 2: Prescription Order
    // Empirical reference: Median ~25m, P90 ~92m
    const isTailPresc = (c * 17) % 100 >= 89;
    const prescDuration = isTailPresc
      ? 90 + ((c * 7) % 30) // 90 to 119 mins (tail)
      : 15 + ((c * 3) % 21); // 15 to 35 mins (median ~25)
    curTime += prescDuration * 60 * 1000;

    rows.push({
      case_id: caseId,
      activity: 'Prescription Order',
      timestamp: new Date(curTime).toISOString(),
      performer: physician,
      department: 'Clinical Prescribing',
      status: 'Order Authorized',
    });

    if (variant === 2 || variant === 4) {
      // Diagnostic Laboratory workup
      // Prescription -> Lab Start: Empirical reference Median ~19m, P90 ~65m
      const isTailLabStart = (c * 23) % 100 >= 88;
      const labStartDuration = isTailLabStart
        ? 60 + ((c * 5) % 15) // 60 to 74 mins (tail)
        : 14 + ((c * 3) % 11); // 14 to 24 mins (median ~19)
      curTime += labStartDuration * 60 * 1000;

      rows.push({
        case_id: caseId,
        activity: 'Laboratory Start',
        timestamp: new Date(curTime).toISOString(),
        performer: nurse,
        department: 'Diagnostic Laboratory',
        status: 'Specimen Collected',
      });

      // Lab Start -> Lab End: Empirical reference Median ~81m, P90 ~230m
      const labRand = (c * 29) % 100;
      let labEndDuration: number;
      if (labRand >= 88) {
        // Tail P90 tier: 220 to 260 mins (tail)
        labEndDuration = 220 + ((c * 11) % 41);
      } else if (labRand >= 72) {
        // Extended tier: 110 to 140 mins
        labEndDuration = 110 + ((c * 7) % 31);
      } else {
        // Rapid assay tier: 65 to 97 mins (median ~81)
        labEndDuration = 65 + ((c * 3) % 33);
      }
      curTime += labEndDuration * 60 * 1000;

      rows.push({
        case_id: caseId,
        activity: 'Laboratory End',
        timestamp: new Date(curTime).toISOString(),
        performer: labTech,
        department: 'Diagnostic Laboratory',
        status: 'Results Validated',
      });
    }

    if (variant === 3 || variant === 4) {
      // Radiology / Imaging workup
      // - Variant 3 (from Prescription Order): Empirical reference Median ~35-37m, P90 ~108-128m (Ref: 35.0m / 108.2m)
      // - Variant 4 (from Laboratory End): Modeled as intra-visit handoff (Median ~37m, P90 ~106m);
      //   note empirical multi-encounter log exhibits 191.0m / 12,916.0m due to cross-department inter-day restaging
      const isTailImgStart = (c * 31) % 100 >= 88;
      const imgStartDuration = isTailImgStart
        ? 100 + ((c * 7) % 25) // 100 to 124 mins (tail)
        : 26 + ((c * 3) % 19); // 26 to 44 mins (median ~35)
      curTime += imgStartDuration * 60 * 1000;

      rows.push({
        case_id: caseId,
        activity: 'Imaging Start',
        timestamp: new Date(curTime).toISOString(),
        performer: radTech,
        department: 'Radiology & Imaging',
        status: 'Scan Initiated',
      });

      // Imaging Start -> Imaging End: Empirical reference Median ~3m, P90 ~9m
      const isTailImgEnd = (c * 13) % 100 >= 88;
      const imgEndDuration = isTailImgEnd
        ? 8 + (c % 3) // 8 to 10 mins (tail)
        : 2 + (c % 3); // 2 to 4 mins (median ~3)
      curTime += imgEndDuration * 60 * 1000;

      rows.push({
        case_id: caseId,
        activity: 'Imaging End',
        timestamp: new Date(curTime).toISOString(),
        performer: radTech,
        department: 'Radiology & Imaging',
        status: 'Image Series Stored',
      });
    }

    if (variant === 5) {
      // Outpatient Pharmacy Dispensation
      // Prescription -> Pharmacy Start: Empirical reference Median ~7m, P90 ~19m
      const isTailPharmStart = (c * 37) % 100 >= 85;
      const pharmStartDuration = isTailPharmStart
        ? 18 + ((c * 3) % 6) // 18 to 23 mins
        : 5 + (c % 5); // 5 to 9 mins (median ~7)
      curTime += pharmStartDuration * 60 * 1000;

      rows.push({
        case_id: caseId,
        activity: 'Pharmacy Start',
        timestamp: new Date(curTime).toISOString(),
        performer: pharmacist,
        department: 'Outpatient Pharmacy',
        status: 'Verification Queue',
      });

      // Pharmacy Start -> Pharmacy End: Empirical reference Median ~0-1m, P90 ~2m
      const isTailPharmEnd = (c * 19) % 100 >= 85;
      const pharmEndDuration = isTailPharmEnd
        ? 2 + (c % 2) // 2 to 3 mins
        : c % 2; // 0 to 1 min
      curTime += pharmEndDuration * 60 * 1000;

      rows.push({
        case_id: caseId,
        activity: 'Pharmacy End',
        timestamp: new Date(curTime).toISOString(),
        performer: pharmacist,
        department: 'Outpatient Pharmacy',
        status: 'Medication Dispensed',
      });
    }
  }

  return rows;
}

export const DATASET_PRESETS: DatasetPreset[] = [
  {
    id: 'preset-sepsis-2026',
    name: 'Emergency Department Sepsis Pathway (Synthetic Demo)',
    filename: 'ED_Sepsis_Pathway_2026_Q3.csv',
    description:
      'Synthetic demonstration acute sepsis & resuscitation cohort modeling simulated door-to-antibiotic intervals, CT scan queues, specimen redraw loops, and inpatient bed turnover.',
    fileSizeBytes: 2458900,
    mapping: {
      caseId: 'case_id',
      activity: 'activity',
      timestamp: 'timestamp',
      resource: 'performer',
      department: 'department',
      status: 'status',
    },
    generateRows: generateEmergencySepsisRows,
  },
  {
    id: 'preset-cardiology-2026',
    name: 'Cardiology Cath Lab Acute Inpatient Log (Synthetic Demo)',
    filename: 'Cardiology_CathLab_Inpatient_Log.csv',
    description:
      'Synthetic demonstration acute coronary syndrome door-to-balloon log modeling simulated ECG acquisition, cath lab activation latency, and CCU transfer milestones.',
    fileSizeBytes: 1845000,
    mapping: {
      caseId: 'case_id',
      activity: 'activity',
      timestamp: 'timestamp',
      resource: 'performer',
      department: 'department',
      status: 'status',
    },
    generateRows: generateCardiologyRows,
  },
  {
    id: 'preset-careflow-outpatient-2026',
    name: 'CareFlow Outpatient Pathway (Synthetic Demo)',
    filename: 'CareFlow_Outpatient_Pathway_2026.csv',
    description:
      'Synthetic demonstration outpatient cohort (1,000 cases, 3,100 events) modeling Consultation, Prescription, Diagnostic Laboratory, Radiology Imaging, and Outpatient Pharmacy stages with realistic tail latencies and Phase 3 reference P90 benchmark metrics.',
    fileSizeBytes: 1650000,
    mapping: {
      caseId: 'case_id',
      activity: 'activity',
      timestamp: 'timestamp',
      resource: 'performer',
      department: 'department',
      status: 'status',
    },
    generateRows: generateCareFlowOutpatientRows,
  },
];
