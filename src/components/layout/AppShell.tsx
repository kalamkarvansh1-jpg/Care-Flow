import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  GitFork,
  SlidersHorizontal,
  Database,
  Menu,
  X,
  Activity,
  ShieldAlert,
  Download,
} from 'lucide-react';
import { useDataset } from '../../context/useDataset';
import { LoadDatasetModal } from '../dataset/LoadDatasetModal';
import { ExportDataModal } from '../dataset/ExportDataModal';

export const AppShell: React.FC = () => {
  const { datasetMetadata, openLoadDataset, openExportModal } = useDataset();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isOverview = location.pathname.includes('/overview') || location.pathname === '/';
  const isSimulation = location.pathname.includes('/simulation');
  const pageTitle = isOverview ? 'Overview' : isSimulation ? 'What-If Simulation' : 'Process Analysis';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      {/* Discreet Synthetic Data Notice Bar */}
      {datasetMetadata.isSynthetic && (
        <aside
          aria-label="Dataset status"
          className="bg-slate-900 text-slate-300 px-4 py-1.5 text-xs border-b border-slate-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <span className="inline-flex items-center gap-1 font-semibold text-teal-400 shrink-0">
              <ShieldAlert className="w-3.5 h-3.5" />
              Synthetic Demo Data
            </span>
            <span className="text-slate-400 truncate">
              {datasetMetadata.name} ({datasetMetadata.validationReport.uniqueCases.toLocaleString()} cases) — All patient IDs and event timestamps are generated for clinical pathway modeling.
            </span>
          </div>
        </aside>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Backdrop Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-35 lg:hidden transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close mobile menu"
          />
        )}

        {/* Left Sidebar (Only Two Navigation Items: Overview and Process Analysis) */}
        <aside
          className={`fixed top-0 bottom-0 left-0 z-40 w-56 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-200 lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Brand Mark Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs">
                <Activity className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-bold text-white text-sm tracking-tight block leading-tight">
                  CareFlow
                </span>
                <span className="text-[10px] text-slate-400 block tracking-tight">
                  Process Mining
                </span>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Two-Page Navigation */}
          <nav className="flex-1 px-2.5 py-4 space-y-1">
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Analytical Workspace
            </p>

            <NavLink
              to="/overview"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Overview</span>
            </NavLink>

            <NavLink
              to="/process-analysis"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <GitFork className="w-4 h-4 shrink-0" />
              <span>Process Analysis</span>
            </NavLink>

            <NavLink
              to="/simulation"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
              <span>What-If Simulation</span>
            </NavLink>
          </nav>

          {/* Dataset Status Widget */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/30 text-xs space-y-2">
            <div className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                Active Log
              </span>
              <p className="font-semibold text-white text-xs truncate">
                {datasetMetadata.filename}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                <span>{datasetMetadata.validationReport.uniqueCases.toLocaleString()} cases</span>
                <span>{datasetMetadata.validationReport.parsedEvents.toLocaleString()} events</span>
              </div>
            </div>

            <button
              onClick={openLoadDataset}
              className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>Switch / Load Dataset</span>
            </button>

            <button
              onClick={openExportModal}
              className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Export Data & Reports</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-56">
          {/* Top Bar */}
          <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md lg:hidden cursor-pointer"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
                  {pageTitle}
                </h1>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  CareFlow Clinical Pathway Process Mining
                </span>
              </div>
            </div>

            {/* Top Bar Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-medium text-slate-700 truncate max-w-[200px]">
                  {datasetMetadata.name}
                </span>
              </div>

              <button
                onClick={openExportModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
                title="Export data and analytical reports"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button
                onClick={openLoadDataset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Load Dataset</span>
              </button>
            </div>
          </header>

          {/* Dynamic Page Outlet */}
          <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
            <Outlet />
          </main>

          {/* Discreet Footer */}
          <footer className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-400 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-teal-600" />
                <span className="font-semibold text-slate-600">CareFlow Healthcare Analytics</span>
                <span>•</span>
                <span>Clinical Pathway Process Mining Prototype</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span>Data Analytics Internship</span>
                <span>•</span>
                <span>Client-Side Verification Layer</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Dataset Modal (No Third Page) */}
      <LoadDatasetModal />

      {/* Export Data Modal */}
      <ExportDataModal />
    </div>
  );
};
