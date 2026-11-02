import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  SlidersHorizontal,
  Play,
  RotateCcw,
  Sparkles,
  Plus,
  Trash2,
  Download,
  FileText,
  Code2,
  Clock,
  TrendingDown,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Info,
  Search,
  Database,
  Check,
  Copy,
} from 'lucide-react';
import { useDataset } from '../context/useDataset';
import { DATASET_PRESETS } from '../data/demoData';
import { MetricCard } from '../components/common/MetricCard';
import { ComparativeDistributionChart } from '../components/simulation/ComparativeDistributionChart';
import { ComparativeTransitionChart } from '../components/simulation/ComparativeTransitionChart';
import {
  runWhatIfSimulation,
  exportSimulationToCSV,
  generateSimulationExecutiveReportMarkdown,
  exportSimulationReportJSON,
  SIMULATION_MODEL_DISCLAIMER,
} from '../lib/simulationEngine';
import {
  triggerBrowserDownload,
  ED_SEPSIS_EMPIRICAL_P90_SLA_MINUTES,
  CARDIOLOGY_EMPIRICAL_P90_SLA_MINUTES,
} from '../lib/dataProcessing';
import { benchmarkSimulationPerformance } from '../lib/decisionSupportReport';
import { formatDurationMinutes, formatNumber, formatPercentage } from '../lib/formatters';
import {
  SimulationIntervention,
  SimulationScenario,
  SimulationInterventionType,
} from '../types/simulation';
import { BottleneckItem } from '../types';

export const SimulationPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const {
    datasetMetadata,
    filteredCases,
    filteredBottlenecks,
    filteredTransitions,
    loadPreset,
  } = useDataset();

  // Dynamic empirical threshold determination based on active dataset
  const cohortDefaultThreshold = useMemo(() => {
    const nameLower = (datasetMetadata.name || '').toLowerCase();
    const idLower = (datasetMetadata.id || '').toLowerCase();
    if (nameLower.includes('sepsis') || idLower.includes('sepsis')) {
      return ED_SEPSIS_EMPIRICAL_P90_SLA_MINUTES; // 332.0m
    }
    if (nameLower.includes('cardiology') || idLower.includes('cardiology')) {
      return CARDIOLOGY_EMPIRICAL_P90_SLA_MINUTES; // 180.0m
    }
    if (nameLower.includes('outpatient') || idLower.includes('outpatient')) {
      return 196.0; // Outpatient overall benchmark fallback
    }
    return 180.0;
  }, [datasetMetadata]);

  // Available unique transitions in current dataset
  const availableTransitions = useMemo(() => {
    const list: Array<{ from: string; to: string; label: string; count: number }> = [];
    filteredTransitions.forEach((t) => {
      list.push({
        from: t.from,
        to: t.to,
        label: `${t.from} → ${t.to}`,
        count: t.observationCount,
      });
    });
    return list.sort((a, b) => b.count - a.count);
  }, [filteredTransitions]);

  // Scenario configuration state
  const [scenarioName, setScenarioName] = useState<string>('Operational Queue Latency Streamlining');
  const [scenarioNotes, setScenarioNotes] = useState<string>(
    'Parametric simulation targeting high-latency bottleneck transitions to model patient throughput recovery.'
  );
  const [userCustomThreshold, setUserCustomThreshold] = useState<number | null>(null);

  // Effective threshold: user specified or dataset empirical default
  const activeThreshold = userCustomThreshold ?? cohortDefaultThreshold;

  // Interventions builder state
  const [interventions, setInterventions] = useState<SimulationIntervention[]>(() => {
    // If URL search params provide from and to, initialize with that transition
    const qFrom = searchParams.get('from');
    const qTo = searchParams.get('to');
    if (qFrom && qTo) {
      return [
        {
          id: `int-${Date.now()}`,
          from: qFrom,
          to: qTo,
          type: 'percentage',
          reductionPercentage: 30,
          label: `${qFrom} → ${qTo} Streamlining`,
        },
      ];
    }
    // Otherwise pick the top bottleneck transition if available
    const topB = filteredBottlenecks[0];
    if (topB) {
      const [from, to] = topB.label.split(' → ');
      if (from && to) {
        return [
          {
            id: `int-initial-${Date.now()}`,
            from,
            to,
            type: 'percentage',
            reductionPercentage: 25,
            label: `${topB.label} Optimization`,
          },
        ];
      }
    }
    return [];
  });

  const [caseSearchTerm, setCaseSearchTerm] = useState<string>('');
  const [manualRunCounter, setManualRunCounter] = useState<number>(0);
  const [reportActiveTab, setReportActiveTab] = useState<'scenarios' | 'stats' | 'preview' | 'perf'>('scenarios');
  const [isReportCopied, setIsReportCopied] = useState<boolean>(false);

  // Pure reactive simulation outcome evaluation
  const simulationResult = useMemo(() => {
    const validInterventions = interventions.filter((i) => i.from.trim() && i.to.trim());
    if (validInterventions.length === 0 || filteredCases.length === 0) {
      return null;
    }

    const scenario: SimulationScenario = {
      id: `scen-${scenarioName.replace(/\s+/g, '-').toLowerCase()}-${manualRunCounter}`,
      name: scenarioName.trim() || 'Operational Intervention Scenario',
      description: scenarioNotes.trim(),
      interventions: validInterventions,
      empiricalThresholdMinutes: activeThreshold > 0 ? activeThreshold : undefined,
    };

    try {
      return runWhatIfSimulation(filteredCases, scenario);
    } catch (err) {
      console.error('Simulation execution error:', err);
      return null;
    }
  }, [filteredCases, interventions, scenarioName, scenarioNotes, activeThreshold, manualRunCounter]);

  // Comprehensive Decision-Support Analysis & Performance Metrics
  const decisionSupportData = useMemo(() => {
    if (!simulationResult || filteredCases.length === 0) return null;

    const topB = filteredBottlenecks[0]
      ? {
          from: filteredBottlenecks[0].label.split(' → ')[0] || '',
          to: filteredBottlenecks[0].label.split(' → ')[1] || '',
          label: filteredBottlenecks[0].label,
        }
      : undefined;

    const validInterventions = interventions.filter((i) => i.from.trim() && i.to.trim());
    const scenarioConfig: SimulationScenario = {
      id: `scen-${scenarioName.replace(/\s+/g, '-').toLowerCase()}-${manualRunCounter}`,
      name: scenarioName.trim() || 'Operational Intervention Scenario',
      description: scenarioNotes.trim(),
      interventions: validInterventions,
      empiricalThresholdMinutes: activeThreshold > 0 ? activeThreshold : undefined,
    };

    const totalEventsInCohort = filteredCases.reduce((sum, c) => sum + (c.events?.length || 0), 0);

    try {
      return benchmarkSimulationPerformance(filteredCases, scenarioConfig, {
        cohortName: datasetMetadata.name || 'CareFlow Cohort',
        eventsCount: totalEventsInCohort,
        topBottleneck: topB,
      });
    } catch (err) {
      console.error('Decision-support calculation error:', err);
      return null;
    }
  }, [
    simulationResult,
    filteredCases,
    filteredBottlenecks,
    interventions,
    scenarioName,
    scenarioNotes,
    activeThreshold,
    manualRunCounter,
    datasetMetadata.name,
  ]);

  // Execute simulation manual trigger / scroll to results
  const handleRunSimulation = useCallback(() => {
    setManualRunCounter((prev) => prev + 1);
    const resultsEl = document.getElementById('simulation-results');
    if (resultsEl) {
      resultsEl.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Reset scenario back to empty / defaults
  const handleResetScenario = () => {
    const topB = filteredBottlenecks[0];
    if (topB) {
      const [from, to] = topB.label.split(' → ');
      setInterventions([
        {
          id: `int-${Date.now()}`,
          from: from || '',
          to: to || '',
          type: 'percentage',
          reductionPercentage: 25,
          label: `${topB.label} Optimization`,
        },
      ]);
    } else {
      setInterventions([]);
    }
    setScenarioName('Operational Queue Latency Streamlining');
    setScenarioNotes('Parametric simulation targeting high-latency bottleneck transitions.');
    setUserCustomThreshold(null);
  };

  // Add an intervention row
  const handleAddIntervention = () => {
    const fallbackPair = availableTransitions[0];
    setInterventions((prev) => [
      ...prev,
      {
        id: `int-${Date.now()}-${prev.length}`,
        from: fallbackPair?.from || '',
        to: fallbackPair?.to || '',
        type: 'percentage',
        reductionPercentage: 25,
        label: fallbackPair ? `${fallbackPair.label} Improvement` : '',
      },
    ]);
  };

  // Update a specific intervention
  const handleUpdateIntervention = (id: string, partial: Partial<SimulationIntervention>) => {
    setInterventions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...partial } : item))
    );
  };

  // Remove a specific intervention
  const handleRemoveIntervention = (id: string) => {
    setInterventions((prev) => prev.filter((item) => item.id !== id));
  };

  // Quick 1-click Target from Bottleneck Summary
  const handleTargetBottleneck = (b: BottleneckItem) => {
    const [from, to] = b.label.split(' → ');
    if (!from || !to) return;

    setInterventions((prev) => {
      const existsIndex = prev.findIndex((i) => i.from === from && i.to === to);
      if (existsIndex >= 0) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `int-${Date.now()}`,
          from,
          to,
          type: 'percentage',
          reductionPercentage: 30,
          label: `${b.label} Intervention`,
        },
      ];
    });

    const builderEl = document.getElementById('intervention-builder');
    if (builderEl) {
      builderEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Quick Clinical Templates
  const handleLoadTemplate = (templateName: string) => {
    if (templateName === 'sepsis-antibiotics') {
      setScenarioName('ED Sepsis Antibiotic Acceleration');
      setScenarioNotes('Targeted 50% turnaround reduction for empiric antibiotic administration.');
      setUserCustomThreshold(ED_SEPSIS_EMPIRICAL_P90_SLA_MINUTES);
      setInterventions([
        {
          id: `int-sepsis-${Date.now()}`,
          from: 'Central Laboratory Specimen Run',
          to: 'Empiric Antibiotic / Targeted Therapy',
          type: 'combined',
          reductionPercentage: 50,
          maxDurationMinutes: 60,
          label: 'Stat Sepsis Antibiotic Protocol',
        },
      ]);
    } else if (templateName === 'cardiology-cathlab') {
      setScenarioName('Cardiology Cath Lab Rapid Transfer');
      setScenarioNotes('Streamlining cardiologist bedside evaluation to sheath insertion in cath lab.');
      setUserCustomThreshold(CARDIOLOGY_EMPIRICAL_P90_SLA_MINUTES);
      setInterventions([
        {
          id: `int-cardio-${Date.now()}`,
          from: 'Cardiologist Bedside Evaluation',
          to: 'Cath Lab Suite Transfer & Sheath Insertion',
          type: 'combined',
          reductionPercentage: 35,
          maxDurationMinutes: 45,
          label: 'Direct STEMI Cath Lab Transfer',
        },
      ]);
    } else if (templateName === 'outpatient-radiology') {
      setScenarioName('Outpatient Radiology Fast-Track');
      setScenarioNotes('Automated scheduling and fast-track protocol from prescription to radiology.');
      setUserCustomThreshold(196.0);
      setInterventions([
        {
          id: `int-radio-${Date.now()}`,
          from: 'Prescription Order',
          to: 'Radiology Start',
          type: 'combined',
          reductionPercentage: 30,
          maxDurationMinutes: 90,
          label: 'Radiology Rapid Protocol',
        },
      ]);
    } else if (templateName === 'stat-lab') {
      setScenarioName('Stat Laboratory Resuscitation Turnaround');
      setScenarioNotes('Pneumatic tube transport and priority blood specimen analyzer queuing.');
      setUserCustomThreshold(cohortDefaultThreshold);
      setInterventions([
        {
          id: `int-lab-${Date.now()}`,
          from: 'Stat Blood Draw & Biomarkers',
          to: 'Central Laboratory Specimen Run',
          type: 'percentage',
          reductionPercentage: 40,
          maxDurationMinutes: 45,
          label: 'Stat Blood Specimen Automation',
        },
      ]);
    }
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!simulationResult) return;
    const csvString = exportSimulationToCSV(simulationResult);
    const filename = `CareFlow_Simulation_${simulationResult.scenarioName.replace(/\s+/g, '_')}_${Date.now()}.csv`;
    triggerBrowserDownload(csvString, filename, 'text/csv');
  };

  // Export Executive Markdown Report Handler
  const handleExportMarkdown = useCallback(() => {
    if (!simulationResult) return;
    const mdString =
      decisionSupportData?.reportMarkdown ||
      generateSimulationExecutiveReportMarkdown(simulationResult, {
        scenarioNotes,
        cohortName: datasetMetadata.name,
      });
    const filename = `CareFlow_Decision_Support_Report_${simulationResult.scenarioName.replace(/\s+/g, '_')}_${Date.now()}.md`;
    triggerBrowserDownload(mdString, filename, 'text/markdown');
  }, [decisionSupportData, simulationResult, scenarioNotes, datasetMetadata.name]);

  // Export JSON Report Handler
  const handleExportJSON = useCallback(() => {
    if (!simulationResult) return;
    const jsonString =
      decisionSupportData?.reportJson ||
      exportSimulationReportJSON(simulationResult, {
        scenarioNotes,
        cohortName: datasetMetadata.name,
      });
    const filename = `CareFlow_Decision_Support_Report_${simulationResult.scenarioName.replace(/\s+/g, '_')}_${Date.now()}.json`;
    triggerBrowserDownload(jsonString, filename, 'application/json');
  }, [decisionSupportData, simulationResult, scenarioNotes, datasetMetadata.name]);

  // Copy Markdown Report to Clipboard
  const handleCopyMarkdown = useCallback(async () => {
    const md = decisionSupportData?.reportMarkdown;
    if (!md) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(md);
        setIsReportCopied(true);
        setTimeout(() => setIsReportCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy markdown to clipboard:', err);
    }
  }, [decisionSupportData]);

  // Filtered case drill-down table results
  const filteredCaseResults = useMemo(() => {
    if (!simulationResult) return [];
    const term = caseSearchTerm.trim().toLowerCase();
    if (!term) return simulationResult.caseResults.slice(0, 15);
    return simulationResult.caseResults
      .filter((c) => c.caseId.toLowerCase().includes(term))
      .slice(0, 15);
  }, [simulationResult, caseSearchTerm]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <SlidersHorizontal className="w-3 h-3 text-teal-600" />
              Phase 6 Feature
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Operational Process Engineering</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            What-If Scenario Simulation
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
            Model hypothetical parametric duration reductions and service-level caps on empirical bottleneck transitions. Evaluate projected throughput gains, percentile shifts, and SLA delay recovery.
          </p>
        </div>

        {/* Cohort Dataset Selector */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
          <Database className="w-4 h-4 text-sky-600 shrink-0" />
          <div className="text-xs">
            <label htmlFor="cohort-select" className="text-[10px] uppercase font-bold text-slate-400 block">
              Active Pathway Cohort
            </label>
            <select
              id="cohort-select"
              aria-label="Active Pathway Cohort"
              value={datasetMetadata.id}
              onChange={(e) => loadPreset(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
            >
              {DATASET_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
              {!DATASET_PRESETS.some((p) => p.id === datasetMetadata.id) && (
                <option value={datasetMetadata.id}>{datasetMetadata.name} (Custom)</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Epistemological & Methodology Notice Banner */}
      <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-900 space-y-1">
          <div className="font-semibold text-amber-950 flex items-center gap-2">
            <span>Epistemological Model Notice & Operational Scope</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded border border-amber-300/80">
              Deterministic Re-timing
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800/90">
            {SIMULATION_MODEL_DISCLAIMER}
          </p>
        </div>
      </div>

      {/* Baseline Bottleneck Summary Ribbon */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Observed Baseline Bottlenecks (Top Latencies)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Click &quot;+ Target&quot; to pre-fill an intervention into the scenario builder
          </span>
        </div>

        {filteredBottlenecks.length === 0 ? (
          <div className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
            No significant bottleneck transitions identified in current filtered cohort.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {filteredBottlenecks.slice(0, 4).map((b) => {
              const isTargeted = interventions.some((i) => `${i.from} → ${i.to}` === b.label);
              return (
                <div
                  key={b.id}
                  className={`p-3 rounded-lg border transition-all ${
                    isTargeted
                      ? 'bg-teal-50/50 border-teal-300 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                        b.severity === 'high'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : b.severity === 'moderate'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {b.severity}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatNumber(b.caseCount)} cases
                    </span>
                  </div>

                  <p className="font-semibold text-slate-900 text-xs truncate" title={b.label}>
                    {b.label}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Median</span>
                      <span className="font-mono font-medium">{formatDurationMinutes(b.medianElapsedMinutes)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">P90 Tail</span>
                      <span className="font-mono font-medium text-rose-600">{formatDurationMinutes(b.p90ElapsedMinutes)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTargetBottleneck(b)}
                    disabled={isTargeted}
                    className={`mt-2.5 w-full py-1 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                      isTargeted
                        ? 'bg-teal-600 text-white cursor-default'
                        : 'bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 hover:border-teal-300 shadow-2xs'
                    }`}
                  >
                    {isTargeted ? (
                      <>
                        <Check className="w-3 h-3 text-white" />
                        <span>Targeted</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>Target in Scenario</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scenario Builder Container */}
      <div id="intervention-builder" className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              Scenario Configuration & Intervention Builder
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify mathematical duration reductions and caps per transition.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Templates:</span>
            <button
              onClick={() => handleLoadTemplate('sepsis-antibiotics')}
              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
            >
              ED Sepsis Antibiotics
            </button>
            <button
              onClick={() => handleLoadTemplate('cardiology-cathlab')}
              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
            >
              Cardiology Cath Lab
            </button>
            <button
              onClick={() => handleLoadTemplate('outpatient-radiology')}
              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
            >
              Radiology Fast-Track
            </button>
            <button
              onClick={() => handleLoadTemplate('stat-lab')}
              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
            >
              Stat Lab Specimen
            </button>
          </div>
        </div>

        {/* Scenario Name & Threshold Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1">
            <label htmlFor="scenario-name" className="text-[11px] uppercase font-bold text-slate-600">
              Scenario Title
            </label>
            <input
              id="scenario-name"
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g. Radiology Fast-Track Protocol"
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="sla-threshold" className="text-[11px] uppercase font-bold text-slate-600 flex items-center justify-between">
              <span>Empirical SLA Benchmark</span>
              <span className="text-[10px] text-slate-400 font-mono">P90 Benchmark</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="sla-threshold"
                type="number"
                min="0"
                step="5"
                value={activeThreshold}
                onChange={(e) => setUserCustomThreshold(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
              <span className="text-xs text-slate-500 font-medium">min</span>
            </div>
          </div>
        </div>

        {/* Interventions Dynamic Form List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Targeted Transition Interventions ({interventions.length})
            </span>
            <button
              onClick={handleAddIntervention}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Intervention</span>
            </button>
          </div>

          {interventions.length === 0 ? (
            <div className="p-6 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              No interventions added yet. Click &quot;Add Intervention&quot; or choose a template above.
            </div>
          ) : (
            <div className="space-y-3">
              {interventions.map((int, idx) => {
                const currentTransitionKey = `${int.from}|||${int.to}`;
                return (
                  <div
                    key={int.id}
                    className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          aria-label={`Intervention ${idx + 1} label`}
                          value={int.label || ''}
                          onChange={(e) => handleUpdateIntervention(int.id, { label: e.target.value })}
                          placeholder="Optional intervention title"
                          className="bg-transparent text-xs font-semibold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-hidden px-1 py-0.5"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveIntervention(int.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
                        title="Remove intervention"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      {/* Transition Pair Selector */}
                      <div className="md:col-span-5 space-y-1">
                        <label htmlFor={`transition-select-${int.id}`} className="text-[10px] uppercase font-bold text-slate-400 block">
                          Transition Path (From → To)
                        </label>
                        <select
                          id={`transition-select-${int.id}`}
                          aria-label={`Transition Path for Intervention ${idx + 1}`}
                          value={currentTransitionKey}
                          onChange={(e) => {
                            const [f, t] = e.target.value.split('|||');
                            handleUpdateIntervention(int.id, { from: f || '', to: t || '' });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:border-teal-500 cursor-pointer"
                        >
                          {!availableTransitions.some((t) => `${t.from}|||${t.to}` === currentTransitionKey) && (
                            <option value={currentTransitionKey}>
                              {int.from} → {int.to}
                            </option>
                          )}
                          {availableTransitions.map((t) => (
                            <option key={`${t.from}|||${t.to}`} value={`${t.from}|||${t.to}`}>
                              {t.label} ({formatNumber(t.count)} steps)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Intervention Type */}
                      <div className="md:col-span-2 space-y-1">
                        <label htmlFor={`mechanism-select-${int.id}`} className="text-[10px] uppercase font-bold text-slate-400 block">
                          Mechanism
                        </label>
                        <select
                          id={`mechanism-select-${int.id}`}
                          aria-label={`Mechanism for Intervention ${idx + 1}`}
                          value={int.type}
                          onChange={(e) =>
                            handleUpdateIntervention(int.id, {
                              type: e.target.value as SimulationInterventionType,
                            })
                          }
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:border-teal-500 cursor-pointer"
                        >
                          <option value="percentage">Percentage</option>
                          <option value="cap">Max Cap</option>
                          <option value="combined">Combined</option>
                        </select>
                      </div>

                      {/* Reduction Percentage Slider/Input */}
                      {(int.type === 'percentage' || int.type === 'combined') && (
                        <div className="md:col-span-3 space-y-1">
                          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
                            <span>Reduction %</span>
                            <span className="font-mono text-teal-700">{int.reductionPercentage || 0}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={int.reductionPercentage ?? 25}
                              onChange={(e) =>
                                handleUpdateIntervention(int.id, {
                                  reductionPercentage: Number(e.target.value),
                                })
                              }
                              className="w-full accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                            />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={int.reductionPercentage ?? 25}
                              onChange={(e) =>
                                handleUpdateIntervention(int.id, {
                                  reductionPercentage: Math.max(0, Math.min(100, Number(e.target.value))),
                                })
                              }
                              className="w-14 px-1.5 py-1 text-xs font-mono bg-white border border-slate-200 rounded text-center"
                            />
                          </div>
                        </div>
                      )}

                      {/* Max Duration Cap Input */}
                      {(int.type === 'cap' || int.type === 'combined') && (
                        <div className={`${int.type === 'cap' ? 'md:col-span-5' : 'md:col-span-2'} space-y-1`}>
                          <label htmlFor={`cap-input-${int.id}`} className="text-[10px] uppercase font-bold text-slate-400 block">
                            Duration Cap (min)
                          </label>
                          <input
                            id={`cap-input-${int.id}`}
                            type="number"
                            min="0"
                            placeholder="e.g. 60"
                            value={int.maxDurationMinutes ?? ''}
                            onChange={(e) =>
                              handleUpdateIntervention(int.id, {
                                maxDurationMinutes: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-hidden focus:border-teal-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Builder Primary Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            <span>
              Real-time reactive evaluation across <span className="font-mono font-semibold text-slate-700">{formatNumber(filteredCases.length)}</span> encounters
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleResetScenario}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Scenario</span>
            </button>

            <button
              onClick={handleRunSimulation}
              disabled={interventions.length === 0}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run What-If Simulation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Results Section */}
      {simulationResult && (
        <div id="simulation-results" className="space-y-5 animate-in fade-in duration-300">
          {/* Results Summary Header Bar */}
          <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 bg-teal-950/60 border border-teal-800 px-2 py-0.5 rounded">
                  Simulation Outcome
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {simulationResult.scenarioName}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1">
                Hypothetical Impact on {formatNumber(simulationResult.totalCasesEvaluated)} Encounters
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportMarkdown}
                title="Download comprehensive Executive Decision-Support Markdown Report"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                <span>Executive Report (MD)</span>
              </button>
              <button
                onClick={handleExportCSV}
                title="Download raw encounter-level simulation CSV dataset"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handleExportJSON}
                title="Download audit-grade structured JSON simulation payload"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* KPI Delta Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <MetricCard
              label="Hypothetical Time Saved"
              value={`${simulationResult.totalHypotheticalHoursSaved.toFixed(1)}`}
              unit="hours"
              definition="Total cumulative patient dwell time eliminated across the cohort in this simulation scenario."
              subtitle={`${formatNumber(simulationResult.totalHypotheticalMinutesSaved)} total patient minutes`}
            />

            <MetricCard
              label="Cohort Impact"
              value={formatPercentage(simulationResult.affectedCasesPercentage)}
              definition="Percentage and count of cases in the active cohort traversing at least one intervened transition."
              subtitle={`${formatNumber(simulationResult.affectedCasesCount)} of ${formatNumber(simulationResult.totalCasesEvaluated)} cases`}
            />

            <MetricCard
              label="Median Duration (P50)"
              value={formatDurationMinutes(simulationResult.medianDuration.simulated)}
              definition="50th-percentile encounter duration under simulation vs baseline."
              subtitle={`Base: ${formatDurationMinutes(simulationResult.medianDuration.baseline)} (${simulationResult.medianDuration.percentageDelta > 0 ? '+' : ''}${simulationResult.medianDuration.percentageDelta.toFixed(1)}%)`}
            />

            <MetricCard
              label="Tail Latency (P90)"
              value={formatDurationMinutes(simulationResult.p90Duration.simulated)}
              definition="90th-percentile prolonged duration threshold under simulation vs baseline."
              subtitle={`Base: ${formatDurationMinutes(simulationResult.p90Duration.baseline)} (${simulationResult.p90Duration.percentageDelta > 0 ? '+' : ''}${simulationResult.p90Duration.percentageDelta.toFixed(1)}%)`}
            />

            <MetricCard
              label="Modeled SLA Recovery"
              value={formatNumber(simulationResult.recoveredCasesCount)}
              unit="cases"
              definition="Cases exceeding the empirical benchmark threshold at baseline that dropped within SLA under simulation."
              subtitle={`${formatPercentage(simulationResult.recoveredCasesPercentage)} recovery rate (${simulationResult.empiricalThresholdMinutes}m SLA)`}
            />
          </div>

          {/* Visualizations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Distribution Shift Chart */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Encounter Duration Cohort Shift
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Percentage of cases across duration brackets: Baseline vs. Simulated
                  </p>
                </div>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <ComparativeDistributionChart caseResults={simulationResult.caseResults} height={230} />
            </div>

            {/* Intervened Transition Latency Shift */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Targeted Transition Latency Shifts
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Median and P90 tail response before vs. after intervention
                  </p>
                </div>
                <TrendingDown className="w-4 h-4 text-teal-600" />
              </div>
              <ComparativeTransitionChart transitionResults={simulationResult.transitionResults} height={230} />
            </div>
          </div>

          {/* High-Impact Cases Drill-Down Table */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  High-Impact Patient Encounters (Top Time Saved)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Individual case re-timing and empirical SLA threshold recovery status.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by Case ID..."
                  value={caseSearchTerm}
                  onChange={(e) => setCaseSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-teal-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200/80">
                    <th className="py-2.5 px-4">Case ID</th>
                    <th className="py-2.5 px-4">Baseline Duration</th>
                    <th className="py-2.5 px-4">Simulated Duration</th>
                    <th className="py-2.5 px-4 text-teal-700">Hypothetical Saved</th>
                    <th className="py-2.5 px-4">Reduction %</th>
                    <th className="py-2.5 px-4">Interventions Traversed</th>
                    <th className="py-2.5 px-4">Empirical SLA Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCaseResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        No cases match search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCaseResults.map((c) => (
                      <tr key={c.caseId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-4 font-mono font-medium text-slate-900">
                          {c.caseId}
                        </td>
                        <td className="py-2 px-4 font-mono text-slate-600">
                          {formatDurationMinutes(c.baselineDurationMinutes)}
                        </td>
                        <td className="py-2 px-4 font-mono font-semibold text-slate-900">
                          {formatDurationMinutes(c.simulatedDurationMinutes)}
                        </td>
                        <td className="py-2 px-4 font-mono font-bold text-teal-600">
                          -{formatDurationMinutes(c.savedMinutes)}
                        </td>
                        <td className="py-2 px-4 font-mono text-slate-700">
                          {c.percentageReduction.toFixed(1)}%
                        </td>
                        <td className="py-2 px-4 text-slate-600 font-mono">
                          {c.traversedInterventionsCount}
                        </td>
                        <td className="py-2 px-4">
                          {c.isThresholdRecovered ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              SLA Recovered
                            </span>
                          ) : c.isExceedingThresholdSimulated ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" />
                              Still Exceeding SLA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Within SLA
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Showing top {filteredCaseResults.length} high-impact cases</span>
              <span>Empirical benchmark: {simulationResult.empiricalThresholdMinutes}m</span>
            </div>
          </div>

          {/* Executive Decision-Support Report & Multi-Scenario Section */}
          {decisionSupportData && (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-0">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-50 border border-teal-200/80 rounded-lg text-teal-700">
                    <FileText className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Executive Decision-Support Report & Multi-Scenario Matrix
                    </h3>
                    <p className="text-xs text-slate-500">
                      Standardized linear quantile comparison, scenario sensitivity ranking, and audit-grade Markdown preview
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-200/60 p-1 rounded-lg border border-slate-200/90 text-xs">
                    <button
                      type="button"
                      onClick={() => setReportActiveTab('scenarios')}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                        reportActiveTab === 'scenarios'
                          ? 'bg-white text-teal-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Scenario Matrix
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportActiveTab('stats')}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                        reportActiveTab === 'stats'
                          ? 'bg-white text-teal-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Statistical Quantiles
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportActiveTab('preview')}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                        reportActiveTab === 'preview'
                          ? 'bg-white text-teal-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Markdown Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportActiveTab('perf')}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                        reportActiveTab === 'perf'
                          ? 'bg-white text-teal-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Performance
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab 1: Scenario Comparison Matrix */}
              {reportActiveTab === 'scenarios' && (
                <div className="p-5 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3.5">Scenario Configuration</th>
                          <th className="py-2.5 px-3">Steps</th>
                          <th className="py-2.5 px-3">Affected Encounters</th>
                          <th className="py-2.5 px-3">Simulated P50 / P90</th>
                          <th className="py-2.5 px-3 text-teal-700">Cumulative Time Saved</th>
                          <th className="py-2.5 px-3">Modeled Recovery</th>
                          <th className="py-2.5 px-3 text-right">Optimization Ranking</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {decisionSupportData.comparisonScenarios.map((scen) => (
                          <tr
                            key={scen.scenarioId}
                            className={`transition-colors ${
                              scen.isOptimalSavings ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50/60'
                            }`}
                          >
                            <td className="py-3 px-3.5">
                              <span className="font-semibold text-slate-900 block">{scen.scenarioName}</span>
                              <span className="text-[11px] text-slate-500 line-clamp-1">{scen.scenarioDescription}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">{scen.interventionsCount}</td>
                            <td className="py-3 px-3">
                              <span className="font-mono text-slate-800">{formatNumber(scen.affectedCasesCount)}</span>
                              <span className="text-[10px] text-slate-400 block">({scen.affectedCasesPercentage.toFixed(1)}%)</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-700">
                              {formatDurationMinutes(scen.simulatedMedianMinutes)} <span className="text-slate-400">•</span> {formatDurationMinutes(scen.simulatedP90Minutes)}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-teal-700">
                              {scen.totalHoursSaved.toFixed(1)} hrs <span className="text-[10px] font-normal text-slate-500">({formatNumber(scen.totalMinutesSaved)}m)</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-mono text-slate-800">{formatNumber(scen.recoveredCasesCount)}</span>
                              <span className="text-[10px] text-slate-400 block">({scen.recoveredCasesPercentage.toFixed(1)}% rate)</span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              {scen.isOptimalSavings ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Sparkles className="w-3 h-3 text-emerald-600" />
                                  Optimal Efficiency
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-lg text-[11px] text-amber-900/90 leading-relaxed">
                    <strong>Operational Decision-Support Note:</strong> Scenarios are evaluated across the identical cohort without state carryover. The <em>Optimal Efficiency</em> designation represents maximum mathematical dwell-time reduction under parametric assumptions. Implementation feasibility must be validated against staffing and clinical safety constraints.
                  </div>
                </div>
              )}

              {/* Tab 2: Statistical Quantile Comparison */}
              {reportActiveTab === 'stats' && (
                <div className="p-5 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3.5">Statistical Quantile Metric</th>
                          <th className="py-2.5 px-3">Empirical Baseline</th>
                          <th className="py-2.5 px-3 font-semibold text-slate-800">Hypothetical Simulated</th>
                          <th className="py-2.5 px-3 text-teal-700">Absolute Shift</th>
                          <th className="py-2.5 px-3 text-right">Relative Shift (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {[
                          { label: 'Minimum (Min)', data: decisionSupportData.stats.min },
                          { label: '25th Percentile (P25)', data: decisionSupportData.stats.p25 },
                          { label: '50th Percentile (Median P50)', data: decisionSupportData.stats.p50, highlight: true },
                          { label: 'Arithmetic Mean', data: decisionSupportData.stats.mean },
                          { label: '75th Percentile (P75)', data: decisionSupportData.stats.p75 },
                          { label: '90th Percentile (Tail P90)', data: decisionSupportData.stats.p90, highlight: true },
                          { label: 'Maximum (Max)', data: decisionSupportData.stats.max },
                          { label: 'Interquartile Range (IQR)', data: decisionSupportData.stats.iqr },
                        ].map((row) => (
                          <tr key={row.label} className={row.highlight ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'}>
                            <td className="py-2.5 px-3.5 font-sans font-medium text-slate-800">{row.label}</td>
                            <td className="py-2.5 px-3 text-slate-600">{formatDurationMinutes(row.data.baseline)}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{formatDurationMinutes(row.data.simulated)}</td>
                            <td className={`py-2.5 px-3 font-semibold ${row.data.absoluteDelta <= 0 ? 'text-teal-700' : 'text-rose-700'}`}>
                              {row.data.absoluteDelta > 0 ? '+' : ''}{formatDurationMinutes(row.data.absoluteDelta)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-semibold ${row.data.percentageDelta <= 0 ? 'text-teal-700' : 'text-rose-700'}`}>
                              {row.data.percentageDelta > 0 ? '+' : ''}{row.data.percentageDelta.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Linear continuous quantile interpolation matching PM4Py / NumPy <code>method='linear'</code>.</span>
                    <span>Evaluated cases: {formatNumber(filteredCases.length)}</span>
                  </div>
                </div>
              )}

              {/* Tab 3: Markdown Preview */}
              {reportActiveTab === 'preview' && (
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-medium text-slate-500">
                      CareFlow_Decision_Support_Report.md
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyMarkdown}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      >
                        {isReportCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-600" />
                            <span>Copy Markdown</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleExportMarkdown}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .md</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono leading-relaxed overflow-x-auto max-h-96 border border-slate-800 shadow-inner select-text">
                      {decisionSupportData.reportMarkdown}
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab 4: Performance Timings */}
              {reportActiveTab === 'perf' && (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-400 block">Scenario Calculation</span>
                      <span className="text-lg font-bold font-mono text-slate-800">
                        {decisionSupportData.metrics.scenarioCalculationMs.toFixed(1)} ms
                      </span>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-400 block">Statistical Quantiles</span>
                      <span className="text-lg font-bold font-mono text-slate-800">
                        {decisionSupportData.metrics.statisticalCalculationMs.toFixed(1)} ms
                      </span>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-400 block">Report Generation</span>
                      <span className="text-lg font-bold font-mono text-slate-800">
                        {decisionSupportData.metrics.markdownGenerationMs.toFixed(1)} ms
                      </span>
                    </div>
                    <div className="p-3.5 bg-teal-50 rounded-lg border border-teal-200">
                      <span className="text-[11px] text-teal-600 block">Total Pipeline</span>
                      <span className="text-lg font-bold font-mono text-teal-800">
                        {decisionSupportData.metrics.totalExecutionMs.toFixed(1)} ms
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    All timings captured in-browser via the High Resolution Time API (<code>performance.now()</code>). Timings reflect local thread execution; universal performance guarantees are not claimed.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
