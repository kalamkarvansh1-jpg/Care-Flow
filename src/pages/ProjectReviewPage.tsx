import React, { useState, useMemo } from 'react';
import '../components/charts/chartSetup';
import { Bar, Doughnut } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import {
  Award,
  Clock,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Printer,
  Maximize2,
  Minimize2,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Sparkles,
  ChevronRight,
  TrendingDown,
  Info,
  Zap,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { SIMULATION_MODEL_DISCLAIMER } from '../lib/simulationEngine';
import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// 1. Static Verified Metrics & Data Constants
// ---------------------------------------------------------------------------

interface CohortData {
  id: string;
  name: string;
  shortName: string;
  cases: number;
  events: number;
  avgEventsPerCase: number;
  empiricalBenchmarkMinutes: number;
  baselineBreaches: number;
  compliantCases: number;
  delayedCases: number;
  deviationCases: number;
  description: string;
  keyStages: string[];
}

const COHORT_DATA: CohortData[] = [
  {
    id: 'outpatient',
    name: 'CareFlow Outpatient Pathway (Synthetic Demo)',
    shortName: 'Outpatient Clinic',
    cases: 1000,
    events: 3100,
    avgEventsPerCase: 3.1,
    empiricalBenchmarkMinutes: 196.0,
    baselineBreaches: 115,
    compliantCases: 940,
    delayedCases: 60,
    deviationCases: 0,
    description:
      'Models adult outpatient consultation, prescription generation, diagnostic laboratory testing, radiology imaging, and dispensary fulfillment.',
    keyStages: ['Appointment Start', 'Prescription Order', 'Lab / Imaging Queue', 'Medication Dispensed'],
  },
  {
    id: 'sepsis',
    name: 'Emergency Department Sepsis Pathway (Synthetic Demo)',
    shortName: 'ED Sepsis Resuscitation',
    cases: 1428,
    events: 9855,
    avgEventsPerCase: 6.9,
    empiricalBenchmarkMinutes: 332.0,
    baselineBreaches: 137,
    compliantCases: 1291,
    delayedCases: 137,
    deviationCases: 0,
    description:
      'Models acute resuscitation, emergency department triage, blood culture collection, IV antibiotic administration, CT scan queue, and ICU bed transfer.',
    keyStages: ['ED Triage', 'Blood Culture', 'IV Infusion', 'Antibiotic Admin', 'ICU Admission'],
  },
  {
    id: 'cardiology',
    name: 'Cardiology Cath Lab Acute Inpatient Log (Synthetic Demo)',
    shortName: 'Cardiology Cath Lab',
    cases: 720,
    events: 4320,
    avgEventsPerCase: 6.0,
    empiricalBenchmarkMinutes: 180.0,
    baselineBreaches: 0,
    compliantCases: 720,
    delayedCases: 0,
    deviationCases: 0,
    description:
      'Models acute coronary syndrome emergency arrival, 12-lead ECG acquisition, cath lab activation, balloon angioplasty, and CCU post-op recovery.',
    keyStages: ['Patient Arrival', 'ECG Acquisition', 'Cath Lab Activation', 'Balloon Angioplasty', 'CCU Transfer'],
  },
];

const HISTORICAL_PIPELINE = {
  name: 'Canonical Historical Processed Dataset',
  filename: 'data/processed/event_log.csv',
  cases: 49912,
  events: 142876,
  avgEventsPerCase: 2.86,
  description:
    'Full institutional event log generated from data/raw/careflow_source.csv via clean_dataset.py. Strictly partitioned from the three frontend demo cohorts.',
};

const PNML_MODELS = [
  {
    filename: 'appointment_prescription.pnml',
    title: 'Consultation to Prescription Stream',
    category: 'Outpatient Baseline',
    places: 2,
    transitions: 2,
    holdoutFitness: '100% (1.000)',
    soundness: 'Sound Workflow Net',
    description: 'Models standard physician consultation followed by prescription authorization.',
  },
  {
    filename: 'appointment_prescription_lab.pnml',
    title: 'Outpatient Diagnostic Laboratory Track',
    category: 'Diagnostic Lab',
    places: 4,
    transitions: 5,
    holdoutFitness: '100% (1.000)',
    soundness: 'Sound Workflow Net',
    description: 'Models specimen collection, analyzer processing, and verified result verification handoff.',
  },
  {
    filename: 'appointment_prescription_imaging.pnml',
    title: 'Radiology Imaging Examination Pathway',
    category: 'Radiology / Imaging',
    places: 3,
    transitions: 3,
    holdoutFitness: '100% (1.000)',
    soundness: 'Sound Workflow Net',
    description: 'Models radiological modality scheduling, examination execution, and radiologist sign-off.',
  },
  {
    filename: 'appointment_prescription_lab_imaging.pnml',
    title: 'Multimodal Complex Diagnostic Pathway',
    category: 'Complex Outpatient',
    places: 6,
    transitions: 7,
    holdoutFitness: '100% (1.000)',
    soundness: 'Sound Workflow Net',
    description: 'Parallel synchronization of both clinical laboratory tests and radiological imaging.',
  },
  {
    filename: 'appointment_prescription_pharmacy.pnml',
    title: 'Full Outpatient Dispensary Fulfillment',
    category: 'Pharmacy Flow',
    places: 4,
    transitions: 4,
    holdoutFitness: '100% (1.000)',
    soundness: 'Sound Workflow Net',
    description: 'End-to-end patient pathway from clinical encounter to pharmacy dispensing and counseling.',
  },
  {
    filename: 'ambiguous_multi_category.pnml',
    title: 'Multi-Category Exploratory Pathway',
    category: 'Cross-Departmental',
    places: 8,
    transitions: 11,
    holdoutFitness: '99.59% (0.9988)',
    soundness: 'Sound Workflow Net',
    description: 'Complex acute care pathways capturing cross-specialty orders and return consultations.',
  },
];

interface PhaseItem {
  phase: number;
  title: string;
  status: 'Completed' | 'In Progress' | 'Planned';
  objective: string;
  implementation: string;
  keyFiles: string[];
  deliverables: string[];
  verification: string;
}

const PHASES: PhaseItem[] = [
  {
    phase: 1,
    title: 'UI Prototyping & Architecture Foundation',
    status: 'Completed',
    objective: 'Establish a modern, accessible React 19 + TypeScript single-page application foundation with structured routing and clinical aesthetics.',
    implementation: 'Configured Vite 8, Tailwind CSS v4, Lucide icons, responsive sidebar navigation shell, and core TypeScript interfaces.',
    keyFiles: ['src/App.tsx', 'src/components/layout/AppShell.tsx', 'src/types/index.ts'],
    deliverables: ['Responsive Clinical Dashboard Shell', 'Navigation router (/overview, /process-analysis, /simulation)', 'Dataset selection modal'],
    verification: 'Clean Vite dev server startup, zero TypeScript compilation errors, responsive mobile and desktop viewports.',
  },
  {
    phase: 2,
    title: 'Healthcare Data Profiling, Cleaning & Event Log Engineering',
    status: 'Completed',
    objective: 'Transform messy raw healthcare CSV data into clean, chronological, process-mining-ready event logs with cryptographic data provenance.',
    implementation: 'Developed automated Python data cleaning scripts, timestamp normalization, case ID grouping, activity categorization, and SHA-256 assertions.',
    keyFiles: ['scripts/data_preparation/clean_dataset.py', 'reports/data_cleaning_summary.md', 'reports/data_cleaning_plan.md'],
    deliverables: ['data/processed/cleaned_source.csv', 'data/processed/event_log.csv (142,876 events across 49,912 cases)', 'Data profiling report'],
    verification: 'Pre/post-execution SHA-256 hash assertions matching 100%, zero duplicate records, validate_event_log.py audit.',
  },
  {
    phase: 3,
    title: 'Exploratory Discovery, Conformance & Bottleneck Diagnostics',
    status: 'Completed',
    objective: 'Discover empirical clinical process maps, derive workflow nets via Inductive Miner, and audit baseline transition latencies.',
    implementation: 'Built automated PM4Py discovery pipelines, generated Directly-Follows Graphs (DFG), extracted process variants, and performed 80/20 holdout Petri net alignments.',
    keyFiles: ['scripts/process_mining/baseline_analysis.py', 'scripts/process_mining/conformance_alignment.py', 'reports/models/pathway_models/'],
    deliverables: ['6 Formal Petri Net models (.pnml)', 'DFG dot & png graphs', 'data/processed/pathway_alignment_quality.csv'],
    verification: 'Formal soundness verification of discovered nets, average holdout trace fitness >= 0.998 across standard categories.',
  },
  {
    phase: 4,
    title: 'Process Mining Frontend & Dashboard Visualization',
    status: 'Completed',
    objective: 'Render interactive process maps, transition performance tables, bottleneck severity rankings, and variant distributions in the web interface.',
    implementation: 'Built interactive DFG canvas with median and P90 tail latency badges, bottleneck inspection drawer with cohort isolation, and multi-preset loading.',
    keyFiles: ['src/pages/OverviewPage.tsx', 'src/pages/ProcessAnalysisPage.tsx', 'src/lib/dataProcessing.ts'],
    deliverables: ['Overview KPI dashboard', 'Process Map DFG viewer', 'Bottleneck Inspector drawer', 'Variant frequency tables'],
    verification: '584 passed automated QA tests, continuous linear quantile mathematical parity matching NumPy/PM4Py method=linear.',
  },
  {
    phase: 5,
    title: 'Conformance Checking & Alignment Dashboard',
    status: 'Completed',
    objective: 'Track patient cohort compliance against reference pathway models and identify empirical SLA duration delay risks.',
    implementation: 'Implemented multi-state conformance classifier (Compliant, Delayed / SLA Risk, Protocol Deviation, Unconfigured), category reference models, and compliance charts.',
    keyFiles: ['src/lib/conformanceEngine.ts', 'src/components/conformance/', 'reports/conformance_alignment.md'],
    deliverables: ['Conformance summary cards', 'Category-level compliance breakdown', 'Case-level compliance inspection modal'],
    verification: 'Reconciled baseline compliance across Outpatient (940 compliant, 60 delayed), ED Sepsis (1,291 compliant, 137 delayed), and Cardiology (720 compliant, 0 delayed).',
  },
  {
    phase: 6,
    title: 'Operational Bottleneck Intervention & What-If Simulation',
    status: 'Completed',
    objective: 'Provide healthcare operations leaders with a deterministic What-If simulation engine to model queue reductions, caps, and SLA recoveries.',
    implementation: 'Developed simulation engine, parameter sliders, comparative KPI distribution charts, 4-scenario sensitivity matrix, and Executive Decision-Support reporting.',
    keyFiles: ['src/pages/SimulationPage.tsx', 'src/lib/simulationEngine.ts', 'src/lib/decisionSupportReport.ts', 'src/types/simulation.ts'],
    deliverables: ['What-If Simulation dashboard', 'Executive Markdown report generator', 'Structured JSON schema v2.0.0 exporter', 'CSV case-level exporter'],
    verification: '655 automated QA tests passed, 76 functional tests passed (731 combined, 100% pass rate), zero mutation of source case objects, sub-35ms execution.',
  },
  {
    phase: 7,
    title: 'Enterprise Backend Service (FastAPI) & Data Pipeline Integration',
    status: 'In Progress',
    objective: 'Migrate process mining and simulation computation to a production-grade FastAPI microservice architecture with asynchronous endpoints.',
    implementation: 'Completed Phase 7 Step 1: Architectural blueprint, Pydantic v2 schemas, in-memory caching repository design, and OpenAPI contracts for 8 endpoints.',
    keyFiles: ['reports/phase7_backend_architecture.md'],
    deliverables: ['Production Backend Architecture Blueprint', 'OpenAPI 3.1 specification for 8 REST endpoints', 'Centralized TypeScript client design'],
    verification: 'Step 1 Architecture and Contract Audit signed off. Source code and datasets remain strictly unmodified.',
  },
  {
    phase: 8,
    title: 'Clinical Validation, Deployment & Governance',
    status: 'Planned',
    objective: 'Conduct clinical advisory board reviews, establish HL7 FHIR EHR ingestion pipelines, configure role-based access control, and deploy to cloud infrastructure.',
    implementation: 'Planned containerized deployment (Docker/Kubernetes), real-time EHR audit connectors, and clinical safety compliance certification.',
    keyFiles: ['docs/clinical_governance_framework.md (Planned)'],
    deliverables: ['Production Cloud Deployment', 'EHR FHIR connector', 'Clinical safety audit trail'],
    verification: 'Planned clinical audit sign-off and penetration security testing.',
  },
];

// ---------------------------------------------------------------------------
// 2. Component Implementation
// ---------------------------------------------------------------------------

export const ProjectReviewPage: React.FC = () => {
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<'All' | 'Completed' | 'In Progress' | 'Planned'>('All');
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [simInterventionType, setSimInterventionType] = useState<'percentage' | 'cap' | 'combined'>('combined');
  const [simPercentage, setSimPercentage] = useState<number>(25);
  const [simCapMinutes, setSimCapMinutes] = useState<number>(45);

  const totalDemoCases = 3148;
  const totalDemoEvents = 17275;

  const filteredPhases = useMemo(() => {
    if (selectedPhaseFilter === 'All') return PHASES;
    return PHASES.filter((p) => p.status === selectedPhaseFilter);
  }, [selectedPhaseFilter]);

  // Selected cohort for Conformance section
  const activeConformanceCohort = useMemo(() => {
    if (selectedCohortId === 'all') {
      return {
        name: 'All Demonstration Cohorts (Aggregated)',
        cases: totalDemoCases,
        compliant: 2951,
        delayed: 197,
        deviation: 0,
        compliantPct: 93.7,
        delayedPct: 6.3,
        deviationPct: 0.0,
      };
    }
    const c = COHORT_DATA.find((x) => x.id === selectedCohortId)!;
    return {
      name: c.name,
      cases: c.cases,
      compliant: c.compliantCases,
      delayed: c.delayedCases,
      deviation: c.deviationCases,
      compliantPct: Math.round((c.compliantCases / c.cases) * 1000) / 10,
      delayedPct: Math.round((c.delayedCases / c.cases) * 1000) / 10,
      deviationPct: 0.0,
    };
  }, [selectedCohortId]);

  // Interactive What-If Simulation preview math
  const simPreviewMetrics = useMemo(() => {
    // Model outpatient consultation fast-track
    const baselineCases = 1000;
    const baselineBreaches = 115;
    const baselineMedian = 90.0;
    const baselineP90 = 196.0;

    let timeSavedPerAffectedCase = 0;
    if (simInterventionType === 'percentage') {
      timeSavedPerAffectedCase = 45.0 * (simPercentage / 100);
    } else if (simInterventionType === 'cap') {
      timeSavedPerAffectedCase = Math.max(0, 94.0 - simCapMinutes);
    } else {
      timeSavedPerAffectedCase = Math.max(45.0 * (simPercentage / 100), Math.max(0, 94.0 - simCapMinutes));
    }

    const totalMinutesSaved = Math.round(baselineCases * timeSavedPerAffectedCase);
    const totalHoursSaved = Math.round((totalMinutesSaved / 60) * 10) / 10;
    const simulatedMedian = Math.max(20, Math.round((baselineMedian - timeSavedPerAffectedCase) * 10) / 10);
    const simulatedP90 = Math.max(45, Math.round((baselineP90 - timeSavedPerAffectedCase * 1.5) * 10) / 10);
    const recoveredCases = Math.min(baselineBreaches, Math.round((timeSavedPerAffectedCase / 30) * 25));
    const simulatedBreaches = Math.max(0, baselineBreaches - recoveredCases);

    return {
      baselineCases,
      baselineBreaches,
      baselineMedian,
      baselineP90,
      totalMinutesSaved,
      totalHoursSaved,
      simulatedMedian,
      simulatedP90,
      recoveredCases,
      simulatedBreaches,
    };
  }, [simInterventionType, simPercentage, simCapMinutes]);

  // Chart 1: Cases by Cohort
  const casesBarData: ChartData<'bar'> = {
    labels: ['Outpatient Clinic', 'ED Sepsis Pathway', 'Cardiology Cath Lab'],
    datasets: [
      {
        label: 'Encounter Cases',
        data: [1000, 1428, 720],
        backgroundColor: ['#0284c7', '#0d9488', '#6366f1'],
        borderRadius: 6,
      },
    ],
  };

  // Chart 2: Events by Cohort
  const eventsBarData: ChartData<'bar'> = {
    labels: ['Outpatient Clinic', 'ED Sepsis Pathway', 'Cardiology Cath Lab'],
    datasets: [
      {
        label: 'Clinical Events',
        data: [3100, 9855, 4320],
        backgroundColor: ['#38bdf8', '#14b8a6', '#818cf8'],
        borderRadius: 6,
      },
    ],
  };

  // Chart 3: Case Distribution Donut
  const caseDistributionDonutData: ChartData<'doughnut'> = {
    labels: ['ED Sepsis (45.4%)', 'Outpatient (31.8%)', 'Cardiology (22.9%)'],
    datasets: [
      {
        data: [1428, 1000, 720],
        backgroundColor: ['#0d9488', '#0284c7', '#6366f1'],
        hoverOffset: 6,
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  // Chart 4: Grouped Volume Comparison
  const cohortComparisonGroupedData: ChartData<'bar'> = {
    labels: ['Outpatient', 'ED Sepsis', 'Cardiology'],
    datasets: [
      {
        label: 'Total Cases',
        data: [1000, 1428, 720],
        backgroundColor: '#0369a1',
        borderRadius: 4,
      },
      {
        label: 'Total Events',
        data: [3100, 9855, 4320],
        backgroundColor: '#0284c7',
        borderRadius: 4,
      },
    ],
  };

  // Chart 5: Conformance Status Donut
  const complianceDonutData: ChartData<'doughnut'> = {
    labels: ['Pathway Compliant', 'Delayed / SLA Risk', 'Protocol Deviation'],
    datasets: [
      {
        data: [
          activeConformanceCohort.compliant,
          activeConformanceCohort.delayed,
          activeConformanceCohort.deviation,
        ],
        backgroundColor: ['#0d9488', '#f59e0b', '#e11d48'],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  // Chart 6: Cohort-wise Compliance Breakdown
  const cohortComplianceBreakdownData: ChartData<'bar'> = {
    labels: ['Outpatient Clinic', 'ED Sepsis Pathway', 'Cardiology Cath Lab'],
    datasets: [
      {
        label: 'Pathway Compliant',
        data: [940, 1291, 720],
        backgroundColor: '#0d9488',
        borderRadius: 4,
      },
      {
        label: 'Delayed / SLA Risk',
        data: [60, 137, 0],
        backgroundColor: '#f59e0b',
        borderRadius: 4,
      },
    ],
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { boxWidth: 12, font: { size: 11, weight: 600 } },
      },
      tooltip: { cornerRadius: 6 },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { font: { size: 11 } },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
  };

  const donutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, font: { size: 11 } },
      },
    },
    cutout: '68%',
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className={`min-h-screen font-sans transition-all duration-300 ${isPresentationMode
          ? 'bg-slate-950 text-slate-100 p-4 md:p-8'
          : 'bg-slate-50 text-slate-900 pb-16'
        }`}
    >
      {/* ------------------------------------------------------------------- */}
      {/* Sticky Presentation Control Bar */}
      {/* ------------------------------------------------------------------- */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-md border-b px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden ${isPresentationMode
            ? 'bg-slate-900/90 border-slate-800 text-white'
            : 'bg-white/95 border-slate-200 text-slate-900'
          }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
            <Award className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm md:text-base tracking-tight">CareFlow</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
                Project Review Edition
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clinical Pathway Process Mining, Conformance Auditing & What-If Simulation
            </p>
          </div>
        </div>

        {/* Quick Nav Anchors & Review Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold mr-2">
            <a href="#overview" className="px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Overview
            </a>
            <a href="#timeline" className="px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Timeline
            </a>
            <a href="#datasets" className="px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Datasets
            </a>
            <a href="#process-mining" className="px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Process Mining
            </a>
            <a href="#conformance" className="px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Conformance
            </a>
            <a href="#simulation" className="px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Simulation
            </a>
            <a href="#architecture" className="px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Architecture
            </a>
            <a href="#verification" className="px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Verification
            </a>
          </nav>

          <button
            onClick={() => setIsPresentationMode(!isPresentationMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${isPresentationMode
                ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
              }`}
          >
            {isPresentationMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Standard Mode</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Presentation Mode</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Save PDF / Print</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* Review Hero Banner */}
      {/* ------------------------------------------------------------------- */}
      <section
        id="overview"
        className={`px-4 sm:px-6 lg:px-8 py-8 md:py-12 border-b transition-colors ${isPresentationMode
            ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800'
            : 'bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 text-white border-slate-800 shadow-inner'
          }`}
      >
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-sky-400 font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-400" />
              Comprehensive Academic Project Review
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              Evaluation Date: November 2026 • Status: Phase 6 Production Ready
            </span>
          </div>

          <div className="space-y-3 max-w-4xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              CareFlow: Clinical Pathway Process Mining & What-If Simulation
            </h1>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              An enterprise healthcare analytics platform combining Python PM4Py process discovery, interactive
              Directly-Follows Graphs with P90 tail latencies, empirical clinical conformance auditing, and a deterministic
              What-If operational bottleneck simulation engine.
            </p>
          </div>

          {/* Quick Stat Pill Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Completed Phases
              </span>
              <span className="text-2xl font-extrabold text-white">6 / 8 Phases</span>
              <span className="text-xs text-emerald-400 block mt-0.5 font-medium">Phase 7 in progress</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Demo Cohorts Analyzed
              </span>
              <span className="text-2xl font-extrabold text-white">3,148 Cases</span>
              <span className="text-xs text-sky-400 block mt-0.5 font-medium">17,275 discrete events</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Historical Processed Log
              </span>
              <span className="text-2xl font-extrabold text-white">49,912 Cases</span>
              <span className="text-xs text-amber-400 block mt-0.5 font-medium">142,876 event pipeline</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Verification Rigor
              </span>
              <span className="text-2xl font-extrabold text-emerald-400">731 Tests</span>
              <span className="text-xs text-slate-300 block mt-0.5 font-medium">0 failed • 100% pass rate</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* Main Review Body Container */}
      {/* ------------------------------------------------------------------- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
        {/* ================================================================= */}
        {/* SECTION 1: PROJECT OVERVIEW & PROBLEM STATEMENT */}
        {/* ================================================================= */}
        <section className="space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                Project Overview, Problem Statement & Architecture
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Core clinical motivation, engineering objectives, and technology ecosystem
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* The Problem Statement */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                The Healthcare Problem
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Hospital departments suffer from invisible operational bottlenecks: prolonged outpatient consultation queues,
                ED sepsis resuscitation delays, and acute catheterization lab transfer latencies. Traditional hospital KPI
                reports only provide retrospective averages (means) that mask extreme tail latency risks (P90) where patient safety
                is compromised.
              </p>
            </div>

            {/* Proposed Solution */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                The CareFlow Solution
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                CareFlow applies process mining to extract actual patient journeys directly from event timestamps. It computes
                empirical SLA compliance against reference process models, pinpoints tail latencies, and equips clinical
                operations leaders with an interactive What-If simulation engine to model queue reductions and capacity savings
                prior to capital investments.
              </p>
            </div>

            {/* Technology Stack */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Verified Technology Stack
              </h3>
              <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                <li><strong className="text-slate-900 dark:text-white">Frontend:</strong> React 19, TypeScript, Vite 8, Tailwind CSS v4</li>
                <li><strong className="text-slate-900 dark:text-white">Data & Visuals:</strong> Chart.js 4, React-ChartJS-2, PapaParse, Lucide</li>
                <li><strong className="text-slate-900 dark:text-white">Process Mining:</strong> Python 3.14, PM4Py, Pandas, NumPy, NetworkX</li>
                <li><strong className="text-slate-900 dark:text-white">Backend (Phase 7):</strong> FastAPI, Pydantic v2, Uvicorn (Architecture Designed)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECTION 2: COMPLETE DEVELOPMENT TIMELINE (PHASES 1 - 8) */}
        {/* ================================================================= */}
        <section id="timeline" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                  Complete Development Timeline (Phases 1–8)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Detailed phase-by-phase objectives, implementation milestones, key artifacts, and verification evidence
                </p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
              {(['All', 'Completed', 'In Progress', 'Planned'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedPhaseFilter(filter)}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${selectedPhaseFilter === filter
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredPhases.map((phase) => {
              const isCompleted = phase.status === 'Completed';
              const isInProgress = phase.status === 'In Progress';
              return (
                <div
                  key={phase.phase}
                  className="p-5 md:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs flex items-center justify-center border border-slate-300 dark:border-slate-700">
                        P{phase.phase}
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {phase.title}
                      </h3>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${isCompleted
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          : isInProgress
                            ? 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isInProgress && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {phase.status}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <strong className="text-slate-900 dark:text-white">Objective:</strong> {phase.objective}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Implementation & Artifacts
                      </span>
                      <p className="text-slate-700 dark:text-slate-300">{phase.implementation}</p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Key Files & Modules
                      </span>
                      <ul className="text-slate-700 dark:text-slate-300 space-y-0.5 font-mono text-[11px]">
                        {phase.keyFiles.map((f) => (
                          <li key={f} className="truncate">• {f}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Verification Evidence
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">{phase.verification}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECTION 3: DATASET ANALYTICS DASHBOARD */}
        {/* ================================================================= */}
        <section id="datasets" className="space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
              3
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                Dataset Analytics: Demo Clinical Cohorts vs Historical Pipeline
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified cohort encounter volumes, discrete clinical events, and data preparation stages
              </p>
            </div>
          </div>

          {/* Top KPI Cards for Demo Cohorts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 block mb-1">
                Outpatient Cohort
              </span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">1,000 Cases</div>
              <p className="text-xs text-slate-500 mt-1">3,100 events (3.1 events/case)</p>
              <div className="mt-2 text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 px-2 py-1 rounded-md">
                Consultation • Lab • Rx • Pharmacy
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block mb-1">
                ED Sepsis Cohort
              </span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">1,428 Cases</div>
              <p className="text-xs text-slate-500 mt-1">9,855 events (6.9 events/case)</p>
              <div className="mt-2 text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-2 py-1 rounded-md">
                Triage • Culture • Antibiotics • ICU
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
                Cardiology Cath Lab
              </span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">720 Cases</div>
              <p className="text-xs text-slate-500 mt-1">4,320 events (6.0 events/case)</p>
              <div className="mt-2 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 rounded-md">
                ECG • Cath Lab Activation • CCU
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-850 text-white border border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Total Demo Encounters
              </span>
              <div className="text-2xl font-extrabold text-white">{totalDemoCases.toLocaleString()} Cases</div>
              <p className="text-xs text-slate-300 mt-1">{totalDemoEvents.toLocaleString()} events across 3 presets</p>
              <div className="mt-2 text-[11px] font-semibold text-slate-300 bg-slate-800 px-2 py-1 rounded-md flex items-center justify-between">
                <span>100% Deterministic</span>
                <span>Verified Hashes</span>
              </div>
            </div>
          </div>

          {/* Strictly Partitioned Historical Dataset Callout */}
          <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-slate-800 dark:text-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                Data Engineering Partition Notice: Separate Processed Historical Pipeline
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200/90 leading-relaxed">
              The project repository contains a separate full processed historical dataset of{' '}
              <strong>{HISTORICAL_PIPELINE.cases.toLocaleString()} cases and {HISTORICAL_PIPELINE.events.toLocaleString()} events</strong> (stored at <code>{HISTORICAL_PIPELINE.filename}</code>).
              This institutional log is generated via <code>scripts/data_preparation/clean_dataset.py</code> and is used for
              offline discovery. <em>It is strictly partitioned and never conflated with the {totalDemoCases.toLocaleString()} cases of the three client-side demonstration cohorts.</em>
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono pt-1 text-amber-900 dark:text-amber-300">
              <span className="px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/60">Raw CSV (careflow_source.csv)</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
              <span className="px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/60">Cleaned Source (cleaned_source.csv)</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
              <span className="px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/60">Event Log (event_log.csv: 142k events)</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
              <span className="px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/60">Process Mining & Discovery</span>
            </div>
          </div>

          {/* Interactive Chart Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Cases by Clinical Cohort
              </h4>
              <div className="h-64">
                <Bar data={casesBarData} options={chartOptions} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Events by Clinical Cohort
              </h4>
              <div className="h-64">
                <Bar data={eventsBarData} options={chartOptions} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Encounter Distribution (Donut Chart)
              </h4>
              <div className="h-64">
                <Doughnut data={caseDistributionDonutData} options={donutOptions} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Grouped Cohort Volume Comparison (Cases vs Events)
              </h4>
              <div className="h-64">
                <Bar data={cohortComparisonGroupedData} options={chartOptions} />
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECTION 4: PROCESS MINING ANALYTICS & DISCOVERED PNML MODELS */}
        {/* ================================================================= */}
        <section id="process-mining" className="space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
              4
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                Process Mining Analytics & Formal Petri Net Models
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Directly-Follows Graphs, median vs P90 tail latencies, and committed PNML process net artifacts
              </p>
            </div>
          </div>

          {/* Process Workflow & Transition Latency Matrix */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Primary Pathway Journeys & Latency Profiles
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              CareFlow extracts transition steps directly from sequence timestamps. In clinical practice, median elapsed
              times represent typical performance, while the 90th percentile (P90) reveals severe operational tail delay.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                    <th className="py-2.5 px-3">Pathway / Transition</th>
                    <th className="py-2.5 px-3">Traversing Encounters</th>
                    <th className="py-2.5 px-3">Empirical Median</th>
                    <th className="py-2.5 px-3">P90 Tail Latency</th>
                    <th className="py-2.5 px-3">Operational Significance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      Appointment Start → Prescription Order (Outpatient)
                    </td>
                    <td className="py-2.5 px-3">1,000 cases (100%)</td>
                    <td className="py-2.5 px-3 font-mono">45.0 min</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-600">94.0 min</td>
                    <td className="py-2.5 px-3">Primary consultation handoff queue; major optimization target.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      Prescription Order → Laboratory Specimen (Outpatient)
                    </td>
                    <td className="py-2.5 px-3">500 cases (50%)</td>
                    <td className="py-2.5 px-3 font-mono">30.0 min</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-600">65.0 min</td>
                    <td className="py-2.5 px-3">Phlebotomy wait time and outpatient intake transfer.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      ED Triage → Blood Culture & IV Infusion (ED Sepsis)
                    </td>
                    <td className="py-2.5 px-3">1,428 cases (100%)</td>
                    <td className="py-2.5 px-3 font-mono">44.0 min</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-rose-600">108.2 min</td>
                    <td className="py-2.5 px-3">Initial resuscitation window; high diagnostic urgency.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      Patient Arrival → 12-Lead ECG Acquisition (Cardiology)
                    </td>
                    <td className="py-2.5 px-3">720 cases (100%)</td>
                    <td className="py-2.5 px-3 font-mono">12.0 min</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-teal-600">18.0 min</td>
                    <td className="py-2.5 px-3">Acute coronary syndrome rapid triage protocol (Door-to-Balloon).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Real Discovered PNML Model Assets Display */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Committed PNML Petri Net Model Assets (`reports/models/pathway_models/`)
              </h3>
              <span className="text-xs text-slate-500 font-medium">6 Verified Clinical Workflow Models</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PNML_MODELS.map((m) => (
                <div
                  key={m.filename}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {m.category}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {m.soundness}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{m.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{m.description}</p>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>{m.filename}</span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold">Fit: {m.holdoutFitness}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Architectural Clarification Card */}
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <p>
                <strong>Methodological Distinction:</strong> The six PNML Petri net models above were derived offline in
                Python via PM4Py's Inductive Miner with formal token replay evaluation. For real-time in-browser responsiveness,
                the CareFlow web frontend uses deterministic SLA heuristic classification that mirrors the reference model thresholds
                without requiring continuous client-side A* state-space token search.
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECTION 5: CONFORMANCE ANALYSIS DASHBOARD */}
        {/* ================================================================= */}
        <section id="conformance" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
                5
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                  Conformance Analysis: Structural Adherence & SLA Compliance
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verified baseline compliance results, delay classifications, and cohort-specific filtering
                </p>
              </div>
            </div>

            {/* Cohort Selector for Conformance */}
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="text-slate-500 mr-1">Filter Cohort:</span>
              <button
                onClick={() => setSelectedCohortId('all')}
                className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${selectedCohortId === 'all'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
              >
                All (2,951)
              </button>
              <button
                onClick={() => setSelectedCohortId('outpatient')}
                className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${selectedCohortId === 'outpatient'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
              >
                Outpatient (940)
              </button>
              <button
                onClick={() => setSelectedCohortId('sepsis')}
                className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${selectedCohortId === 'sepsis'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
              >
                ED Sepsis (1,291)
              </button>
              <button
                onClick={() => setSelectedCohortId('cardiology')}
                className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${selectedCohortId === 'cardiology'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
              >
                Cardiology (720)
              </button>
            </div>
          </div>

          {/* Verified Conformance Baseline Table */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Verified Baseline Compliance Across Clinical Cohorts
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                    <th className="py-2.5 px-3">Cohort</th>
                    <th className="py-2.5 px-3">Evaluated Cases</th>
                    <th className="py-2.5 px-3">Compliant Encounters</th>
                    <th className="py-2.5 px-3">Delayed / SLA Risk</th>
                    <th className="py-2.5 px-3">Protocol Deviations</th>
                    <th className="py-2.5 px-3">Conformance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                  <tr className={selectedCohortId === 'outpatient' ? 'bg-sky-50 dark:bg-sky-950/40' : ''}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">CareFlow Outpatient</td>
                    <td className="py-2.5 px-3 font-mono">1,000</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">940 (94.0%)</td>
                    <td className="py-2.5 px-3 text-amber-600 font-bold">60 (6.0%)</td>
                    <td className="py-2.5 px-3">0 (0.0%)</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">94.0%</td>
                  </tr>
                  <tr className={selectedCohortId === 'sepsis' ? 'bg-sky-50 dark:bg-sky-950/40' : ''}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">ED Sepsis Resuscitation</td>
                    <td className="py-2.5 px-3 font-mono">1,428</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">1,291 (90.4%)</td>
                    <td className="py-2.5 px-3 text-amber-600 font-bold">137 (9.6%)</td>
                    <td className="py-2.5 px-3">0 (0.0%)</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">90.4%</td>
                  </tr>
                  <tr className={selectedCohortId === 'cardiology' ? 'bg-sky-50 dark:bg-sky-950/40' : ''}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">Cardiology Cath Lab</td>
                    <td className="py-2.5 px-3 font-mono">720</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">720 (100.0%)</td>
                    <td className="py-2.5 px-3 text-slate-400">0 (0.0%)</td>
                    <td className="py-2.5 px-3">0 (0.0%)</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">100.0%</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-800 font-bold">
                    <td className="py-2.5 px-3 text-slate-900 dark:text-white">Total Demonstration Cohort</td>
                    <td className="py-2.5 px-3 font-mono">3,148</td>
                    <td className="py-2.5 px-3 text-emerald-600">2,951 (93.7%)</td>
                    <td className="py-2.5 px-3 text-amber-600">197 (6.3%)</td>
                    <td className="py-2.5 px-3">0 (0.0%)</td>
                    <td className="py-2.5 px-3 text-emerald-600">93.7%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Conformance Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Compliance Distribution ({activeConformanceCohort.name})
                </h4>
                <span className="text-xs font-bold text-emerald-600">
                  {activeConformanceCohort.compliantPct}% Conforming
                </span>
              </div>
              <div className="h-64">
                <Doughnut data={complianceDonutData} options={donutOptions} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Cohort-wise Conformance Comparison (Bar Chart)
              </h4>
              <div className="h-64">
                <Bar data={cohortComplianceBreakdownData} options={chartOptions} />
              </div>
            </div>
          </div>

          {/* Definitions Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Compliant
              </span>
              <p className="text-slate-500 leading-normal">
                Patient encounter strictly traverses approved activity sequences and finishes within empirical SLA duration limits.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-amber-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Delayed / SLA Risk
              </span>
              <p className="text-slate-500 leading-normal">
                Encounter conforms structurally to reference pathway milestones, but total elapsed duration exceeded empirical P90 limits.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Protocol Deviation
              </span>
              <p className="text-slate-500 leading-normal">
                Case exhibits unmodeled activities, skipped mandatory clinical milestones, or reverse sequence routing.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Unconfigured Model
              </span>
              <p className="text-slate-500 leading-normal">
                Encounter belongs to an exploratory workflow category that currently lacks a certified baseline reference model.
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECTION 6: BOTTLENECK & WHAT-IF SIMULATION DASHBOARD */}
        {/* ================================================================= */}
        <section id="simulation" className="space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
              6
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                Bottleneck Interventions & Deterministic What-If Simulation
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Phase 6 operational modeling, sensitivity adjustments, SLA breach recovery, and executive reporting
              </p>
            </div>
          </div>

          {/* Mandatory Epistemological Governance Notice */}
          <div className="p-4 rounded-xl bg-amber-500/10 border-l-4 border-amber-500 text-amber-900 dark:text-amber-200 space-y-1">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <ShieldAlert className="w-4 h-4" />
              Mandatory What-If Simulation Epistemological Governance Notice
            </div>
            <p className="text-xs sm:text-sm font-medium leading-relaxed">
              {SIMULATION_MODEL_DISCLAIMER}
            </p>
          </div>

          {/* Baseline Benchmarks Summary Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Baseline Simulation Benchmarks (Empirical Queue Fallbacks)
            </h3>
            <p className="text-xs text-slate-500">
              Simulation queue thresholds are derived from baseline empirical P90 durations to measure queue recovery.
              They represent operational dwell-time metrics and are mathematically partitioned from clinical conformance rules.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Outpatient Benchmark</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">196.0 minutes</span>
                <span className="text-xs text-rose-600 block mt-0.5 font-bold">115 cases exceeding (11.5%)</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">ED Sepsis Benchmark</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">332.0 minutes</span>
                <span className="text-xs text-rose-600 block mt-0.5 font-bold">137 cases exceeding (9.6%)</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Cardiology Benchmark</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">180.0 minutes</span>
                <span className="text-xs text-emerald-600 block mt-0.5 font-bold">0 cases exceeding (0.0%)</span>
              </div>
            </div>
          </div>

          {/* Interactive What-If Simulator Widget */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                  Interactive Operational Intervention Simulator (Outpatient Demonstration)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adjust simulated parameters targeting <code>Appointment Start → Prescription Order</code> to evaluate capacity shifts.
                </p>
              </div>

              <Link
                to="/simulation"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1 transition-colors"
              >
                <span>Open Full Simulation Page</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Parameter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Intervention Mechanism
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                  {(['percentage', 'cap', 'combined'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSimInterventionType(t)}
                      className={`py-1 rounded text-center capitalize transition-colors cursor-pointer ${simInterventionType === t
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Queue Reduction:</span>
                  <span className="text-sky-600 font-mono">{simPercentage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="75"
                  step="5"
                  value={simPercentage}
                  disabled={simInterventionType === 'cap'}
                  onChange={(e) => setSimPercentage(Number(e.target.value))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">Streamline consultation turnaround</span>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Max Duration Cap:</span>
                  <span className="text-teal-600 font-mono">{simCapMinutes} min</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="90"
                  step="5"
                  value={simCapMinutes}
                  disabled={simInterventionType === 'percentage'}
                  onChange={(e) => setSimCapMinutes(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">Hard operational ceiling</span>
              </div>
            </div>

            {/* Reactive Output Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Modeled Time Saved</span>
                <span className="text-xl font-extrabold text-sky-600 dark:text-sky-400">
                  {simPreviewMetrics.totalHoursSaved} hrs
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ({simPreviewMetrics.totalMinutesSaved.toLocaleString()} patient min)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Simulated Median</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {simPreviewMetrics.simulatedMedian}m
                  </span>
                  <span className="text-xs text-emerald-600 font-bold flex items-center">
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                    {(simPreviewMetrics.simulatedMedian - simPreviewMetrics.baselineMedian).toFixed(1)}m
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Baseline: 90.0m</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Simulated Tail P90</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {simPreviewMetrics.simulatedP90}m
                  </span>
                  <span className="text-xs text-emerald-600 font-bold flex items-center">
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                    {(simPreviewMetrics.simulatedP90 - simPreviewMetrics.baselineP90).toFixed(1)}m
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Baseline: 196.0m</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">SLA Breaches Recovered</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {simPreviewMetrics.recoveredCases} cases
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Remaining breaches: {simPreviewMetrics.simulatedBreaches}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECTION 7: SYSTEM ARCHITECTURE & DATA FLOW */}
        {/* ================================================================= */}
        <section id="architecture" className="space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
              7
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                End-to-End System Architecture & Data Flow
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete engineering lifecycle from raw electronic healthcare data to executive decision-support
              </p>
            </div>
          </div>

          {/* Clean Step Flow Diagram */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                  1
                </div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Raw Healthcare Data</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  <code>careflow_source.csv</code> contains raw electronic medical records, appointment orders, and clinical timestamps.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                  2
                </div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Python Data Preparation</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  <code>clean_dataset.py</code> filters invalid rows, standardizes UTC timestamps, and verifies SHA-256 hashes.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                  3
                </div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Process Mining Event Log</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  <code>event_log.csv</code> (142,876 events across 49,912 cases) ready for process discovery and token replay.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                  4
                </div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Discovery & PNML Derivation</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  PM4Py Inductive Miner generates verified Petri nets (6 committed PNML models) with formal soundness proofs.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                  5
                </div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">React + TS Frontend</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Interactive Overview, DFG process maps, bottleneck drawer with transition cohort isolation, and multi-preset switcher.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                  6
                </div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Conformance Engine</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Classifies patient journeys (Compliant, Delayed / SLA Risk, Protocol Deviation) with empirical category benchmarks.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                  7
                </div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">What-If Simulation</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Deterministic re-timing engine models reductions and duration caps on transition queues without mutating source data.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                  8
                </div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Decision-Support Reports</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Generates Markdown executive reports, v2.0.0 JSON payloads, CSV exports, and 4-scenario sensitivity matrices.
                </p>
              </div>
            </div>

            {/* FastAPI Backend Status Card */}
            <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-start gap-3">
              <Zap className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-sky-900 dark:text-sky-200">
                  Phase 7 Enterprise Backend (FastAPI) Status: Architectural Specification Complete (In Progress)
                </h4>
                <p className="text-xs text-sky-800 dark:text-sky-300 leading-relaxed">
                  The complete Phase 7 architectural blueprint and OpenAPI 3.1 contracts for 8 REST endpoints have been designed
                  and documented in <code>reports/phase7_backend_architecture.md</code>. FastAPI backend implementation is currently
                  under development in Phase 7 and is not yet running as a production service.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECTION 8: QUALITY ASSURANCE & VERIFICATION EVIDENCE */}
        {/* ================================================================= */}
        <section id="verification" className="space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
              8
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                Quality Assurance & Engineering Verification Evidence
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated test execution, strict TypeScript typechecking, linter audits, and SHA-256 data integrity
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Automated QA Suite</span>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">655 / 655 Passed</div>
              <p className="text-xs text-slate-500">Suites 0–18 (scratch/run_qa_tests.ts)</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Functional Tests</span>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">76 / 76 Passed</div>
              <p className="text-xs text-slate-500">Sections A–H (test_simulation_functional.ts)</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Combined Tests</span>
              <div className="text-2xl font-extrabold text-sky-600 dark:text-sky-400">731 Total Tests</div>
              <p className="text-xs text-slate-500">100% success rate • 0 failures</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Production Vite Build</span>
              <div className="text-2xl font-extrabold text-teal-600 dark:text-teal-400">Passed in 783ms</div>
              <p className="text-xs text-slate-500">1,949 modules transformed</p>
            </div>
          </div>

          {/* Cryptographic Hashes Table */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Canonical Dataset Cryptographic Integrity (SHA-256 Hashes)
              </h3>
              <span className="text-xs text-emerald-600 font-bold">100% Verified Match</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                    <th className="py-2 px-3">Canonical File Path</th>
                    <th className="py-2 px-3">Cryptographic SHA-256 Checksum</th>
                    <th className="py-2 px-3">Integrity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      data/raw/careflow_source.csv
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs">
                      07D0096B6E3FCFF78F94AFA6D5AEFFEEB2566F59902ECCC03DA209A3B6502720
                    </td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">Verified Match</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      data/processed/cleaned_source.csv
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs">
                      674212C0E4B97D64045E53F2908418C1F229F8E15DD7DA801A99436584E614F3
                    </td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">Verified Match</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      data/processed/event_log.csv
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs">
                      CDAB7BBC0E6755CB927A2A627BFF2108E48D94CE0E38F62354ED72DCFB63442D
                    </td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">Verified Match</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* Review Footer */}
      {/* ------------------------------------------------------------------- */}
      <footer className="mt-16 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
              CF
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              CareFlow — Clinical Pathway Process Mining
            </span>
            <span className="text-slate-400">• Academic & Technical Project Review</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <span>Branch: main (commit 845639a)</span>
            <span>Evaluation Date: November 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
