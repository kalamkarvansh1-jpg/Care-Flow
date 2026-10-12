import React, { useState } from 'react';
import { ShieldAlert, X, Info } from 'lucide-react';

export const SyntheticBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (dismissed) {
    return (
      <div className="bg-amber-50/80 border-b border-amber-200/80 px-4 py-1 text-xs text-amber-900 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Synthetic Demo Cohort Active — Not Real Patient Records
        </span>
        <button
          onClick={() => setShowModal(true)}
          className="underline hover:text-amber-950 cursor-pointer text-xs"
        >
          View Governance Notice
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-sky-950 text-white px-4 py-2 border-b border-slate-800 text-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="inline-flex items-center gap-1 bg-teal-500/20 text-teal-300 font-semibold px-2 py-0.5 rounded-full border border-teal-500/30 text-[11px] shrink-0">
            <ShieldAlert className="w-3 h-3 text-teal-400" />
            SYNTHETIC DATASET
          </span>
          <p className="truncate text-slate-200 font-normal">
            CareFlow Clinical Pathway Mining Environment — All cases, timestamps, and patient metrics are simulated for demonstration.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowModal(true)}
            className="text-sky-300 hover:text-sky-200 underline font-medium cursor-pointer"
          >
            Data Provenance
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-teal-50 text-teal-700">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Healthcare Data Governance & Provenance Notice
                </h3>
                <p className="text-xs text-slate-500">CareFlow Process Mining Compliance</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200/80">
              <p>
                <strong>1. Synthetic Generation:</strong> All patient trajectories, emergency department timestamps, and clinical activities were synthetically generated for demonstration and evaluation of clinical pathway process mining algorithms. No real hospital records or verified clinical findings are used.
              </p>
              <p>
                <strong>2. HIPAA & GDPR De-identification:</strong> No Protected Health Information (PHI) or identifiable individual human records are stored or exposed within this system.
              </p>
              <p>
                <strong>3. Clinical Purpose:</strong> This interface is engineered for process-mining algorithmic evaluation, hospital operations bottleneck discovery, and clinical pathway adherence research.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Understood & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
