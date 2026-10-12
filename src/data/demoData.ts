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
];
