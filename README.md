# CareFlow — Clinical Pathway Process Mining

CareFlow is a healthcare process analytics prototype designed for exploring observed clinical pathways, activity transitions, event durations, and process variants. The application provides clinical teams, operational analysts, and researchers with interactive exploratory process mining tools to inspect care bottlenecks and analyze treatment pathways from event logs.

---

## Current Features

- **Overview Dashboard**: High-level clinical pathway metrics displaying total case throughput, total recorded events, median case durations, distinct process variant counts, activity volume distributions, daily case arrival/completion trends, and observed pathway summaries.
- **KPI Cards & Interactive Charts**: Summary metric cards and Chart.js visualizations (time-series trends and horizontal activity frequency bars) that dynamically recompute in the browser based on active filters and loaded datasets.
- **Observed Process Flow Visualization**: Directed process graph (Directly-Follows Graph) rendering activity nodes, directional transition arrows, transition case counts, median elapsed step durations, and rework feedback loops, complete with transition frequency threshold filtering and interactive node inspection.
- **Process Variant Exploration**: Breakdown of observed patient pathway sequences with case counts, relative prevalence, and one-click filtering to isolate specific variants.
- **Bottleneck Analysis**: Automated ranking and breakdown of high-latency transitions between clinical activities to highlight operational delays.
- **Event Log Explorer**: Searchable, paginated event log table with an interactive case detail drawer illustrating full chronological patient journey timelines.
- **CSV Upload & Column Mapping**: In-browser CSV ingestion engine with configurable column-mapping support (Case ID, Activity, Timestamp, Department/Resource), schema pre-validation checks, and clear error reporting.
- **Filters & Data Export**: Dynamic filtering by activity, variant, transition frequency threshold, and date range presets, accompanied by summary metrics export and filtered event log CSV export.

---

## Technology Stack

The application is built entirely with modern frontend web technologies:

- **Core & Language**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tooling & Dev Server**: [Vite 8](https://vitejs.dev/)
- **Routing**: [React Router DOM v7](https://reactrouter.com/)
- **Data Visualization**: [Chart.js v4](https://www.chartjs.org/), [react-chartjs-2](https://react-chartjs-2.js.org/), and custom responsive SVG directed graphs
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Client-Side CSV Parsing**: [Papa Parse](https://www.papaparse.com/)
- **Code Quality & Linter**: [Oxlint](https://oxc.rs/)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 20.19+ or 22.12+, compatible with the installed Vite 8 version)
- `npm` (included with Node.js)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/kalamkarvansh1-jpg/Care-Flow.git
cd Care-Flow
npm install
```

### Running Locally

Start the Vite development server:

```bash
npm run dev
```

Open your browser and navigate to the local development URL (typically `http://localhost:5173/`).

---

## Development Checks

To validate type safety, production bundle creation, and linting standards:

```bash
# Type check and build production distribution bundle
npm run build

# Run Oxlint checks across the codebase
npm run lint
```

---

## Data and Privacy

- **Synthetic Demonstration Data**: The preloaded clinical pathway presets (e.g., Sepsis Pathway, Cardiology Inpatient Pathway) consist entirely of procedurally generated synthetic demonstration data. They do not represent real patients or genuine hospital databases.
- **User Uploads & Sensitive Information**: When uploading custom event logs via the CSV import modal, ensure the data is fully authorized for use and properly de-identified. Datasets must not contain Protected Health Information (PHI), Personally Identifiable Information (PII), or unauthorized patient records.

---

## Current Project Scope

This repository currently implements a **client-side frontend prototype**. 
- Ingestion, validation, variant extraction, transition timing, and bottleneck metrics are calculated directly in the browser via TypeScript data processing utilities.
- Python-based data pipelines, a dedicated FastAPI/Flask backend, and algorithmic process mining integrations (e.g., PM4Py) have not yet been implemented in this release.

---

## Future Development

Planned enhancements for subsequent phases include:
- **Backend Architecture**: Integration with a FastAPI service for handling large-scale institutional event logs.
- **Advanced Process Mining**: PM4Py integration for conformance checking, Inductive Miner algorithms, and token-based replay.
- **Data Cleaning & Preprocessing**: Automated detection and handling of missing event timestamps, case outliers, and multi-resource dependencies.
- **Real Dataset Validation**: Clinical workflow validation against standardized, authorized open healthcare datasets.
