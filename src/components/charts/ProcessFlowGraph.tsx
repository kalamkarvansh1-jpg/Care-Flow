import React, { useMemo, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  GitFork,
} from 'lucide-react';
import { ActivityMetric, ActivityTransition, CaseSummary } from '../../types';
import { formatNumber, formatDurationMinutes } from '../../lib/formatters';

interface ProcessFlowGraphProps {
  activities: ActivityMetric[];
  transitions: ActivityTransition[];
  cases: CaseSummary[];
  selectedNodeActivity: string | null;
  onSelectNode: (activity: string | null) => void;
  onSelectTransition?: (transition: ActivityTransition) => void;
  transitionThreshold: number;
}

interface NodeLayout {
  activity: string;
  metric: ActivityMetric;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
  indexInLayer: number;
}

interface EdgeLayout {
  id: string;
  from: string;
  to: string;
  transition: ActivityTransition;
  pathD: string;
  labelX: number;
  labelY: number;
  isBackward: boolean;
  strokeWidth: number;
  severity: 'nominal' | 'moderate' | 'high';
}

export const ProcessFlowGraph: React.FC<ProcessFlowGraphProps> = ({
  activities,
  transitions,
  cases,
  selectedNodeActivity,
  onSelectNode,
  onSelectTransition,
  transitionThreshold,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'graph' | 'grid'>('graph');
  const [durationMetric, setDurationMetric] = useState<'both' | 'median' | 'p90'>('both');

  // Compute node dimensions and layout
  const nodeWidth = 200;
  const nodeHeight = 72;
  const layerSpacing = 270;
  const verticalGap = 28;

  const { nodesList, edgesList, graphWidth, graphHeight } = useMemo(() => {
    if (activities.length === 0) {
      return {
        nodesList: [],
        edgesList: [],
        graphWidth: 600,
        graphHeight: 300,
      };
    }

    // 1. Calculate chronological sequential progression of activities across cases
    const progressMap = new Map<string, number>();

    for (const act of activities) {
      let totalPos = 0;
      let count = 0;
      for (const c of cases) {
        const seq = c.activitySequence;
        const idx = seq.indexOf(act.activity);
        if (idx !== -1) {
          totalPos += seq.length > 1 ? idx / (seq.length - 1) : 0;
          count++;
        }
      }
      progressMap.set(act.activity, count > 0 ? totalPos / count : 0);
    }

    // 2. Sort activities monotonically by progression
    const sortedActivities = [...activities].sort((a, b) => {
      const pA = progressMap.get(a.activity) ?? 0;
      const pB = progressMap.get(b.activity) ?? 0;
      return pA - pB;
    });

    // 3. Cluster activities into topological layers
    const directTransSet = new Set<string>();
    transitions.forEach((t) => directTransSet.add(`${t.from}___${t.to}`));

    const layers: ActivityMetric[][] = [];

    for (const act of sortedActivities) {
      const actProg = progressMap.get(act.activity) ?? 0;
      let placed = false;

      if (layers.length > 0) {
        const lastLayer = layers[layers.length - 1];
        const lastProg = progressMap.get(lastLayer[0].activity) ?? 0;

        // Group together into the same layer if progress is close and no direct transition between them
        const hasDirectEdge = lastLayer.some(
          (existing) =>
            directTransSet.has(`${existing.activity}___${act.activity}`) ||
            directTransSet.has(`${act.activity}___${existing.activity}`)
        );

        if (!hasDirectEdge && Math.abs(actProg - lastProg) <= 0.12) {
          lastLayer.push(act);
          placed = true;
        }
      }

      if (!placed) {
        layers.push([act]);
      }
    }

    // Find maximum vertical layer height to center all layers
    const maxNodesInLayer = Math.max(...layers.map((l) => l.length), 1);
    const contentHeight = maxNodesInLayer * nodeHeight + (maxNodesInLayer - 1) * verticalGap;
    const computedGraphHeight = Math.max(380, contentHeight + 120);
    const computedGraphWidth = Math.max(800, layers.length * layerSpacing + 80);

    const computedNodeMap = new Map<string, NodeLayout>();
    const computedNodesList: NodeLayout[] = [];

    // Assign (X, Y) coordinates to each node
    layers.forEach((layerActs, layerIdx) => {
      const x = 40 + layerIdx * layerSpacing;
      const layerTotalHeight =
        layerActs.length * nodeHeight + (layerActs.length - 1) * verticalGap;
      const startY = (computedGraphHeight - layerTotalHeight) / 2;

      layerActs.forEach((act, actIdxInLayer) => {
        const y = startY + actIdxInLayer * (nodeHeight + verticalGap);
        const nodeLayout: NodeLayout = {
          activity: act.activity,
          metric: act,
          x,
          y,
          width: nodeWidth,
          height: nodeHeight,
          layer: layerIdx,
          indexInLayer: actIdxInLayer,
        };
        computedNodeMap.set(act.activity, nodeLayout);
        computedNodesList.push(nodeLayout);
      });
    });

    // 4. Calculate edge paths and label coordinates for visible transitions
    const computedEdgesList: EdgeLayout[] = [];

    transitions.forEach((t) => {
      const fromNode = computedNodeMap.get(t.from);
      const toNode = computedNodeMap.get(t.to);
      if (!fromNode || !toNode) return;

      const isBackward = toNode.layer <= fromNode.layer;

      // Stroke width proportional to frequency
      const strokeWidth = Math.max(
        1.5,
        Math.min(4.5, 1.5 + (t.percentageOfDepartures / 100) * 3)
      );

      // Severity based on median duration or P90 tail latency
      let severity: 'nominal' | 'moderate' | 'high' = 'nominal';
      if (t.medianElapsedMinutes >= 60 || t.p90ElapsedMinutes >= 120) severity = 'high';
      else if (t.medianElapsedMinutes >= 30 || t.p90ElapsedMinutes >= 60) severity = 'moderate';

      let pathD = '';
      let labelX = 0;
      let labelY = 0;

      if (!isBackward) {
        // Forward progression edge (Right anchor to Left anchor)
        const startX = fromNode.x + fromNode.width;
        const startY = fromNode.y + fromNode.height / 2;
        const endX = toNode.x;
        const endY = toNode.y + toNode.height / 2;

        const dx = endX - startX;
        const ctrl1X = startX + dx * 0.45;
        const ctrl1Y = startY;
        const ctrl2X = endX - dx * 0.45;
        const ctrl2Y = endY;

        pathD = `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${endX} ${endY}`;
        labelX = (startX + endX) / 2;
        labelY = (startY + endY) / 2 - 12;
      } else {
        // Backward / loopback rework edge (Curves over the top)
        const startX = fromNode.x + fromNode.width * 0.5;
        const startY = fromNode.y;
        const endX = toNode.x + toNode.width * 0.5;
        const endY = toNode.y;

        const loopHeight = Math.max(65, Math.abs(fromNode.layer - toNode.layer) * 35);
        const ctrlY = Math.min(startY, endY) - loopHeight;

        pathD = `M ${startX} ${startY} C ${startX} ${ctrlY}, ${endX} ${ctrlY}, ${endX} ${endY}`;
        labelX = (startX + endX) / 2;
        labelY = ctrlY + 16;
      }

      computedEdgesList.push({
        id: t.id,
        from: t.from,
        to: t.to,
        transition: t,
        pathD,
        labelX,
        labelY,
        isBackward,
        strokeWidth,
        severity,
      });
    });

    return {
      nodeMap: computedNodeMap,
      nodesList: computedNodesList,
      edgesList: computedEdgesList,
      graphWidth: computedGraphWidth,
      graphHeight: computedGraphHeight,
    };
  }, [activities, transitions, cases]);

  // Helper to split long activity names into two readable lines
  const splitActivityLabel = (text: string): [string, string] => {
    if (text.length <= 22) return [text, ''];
    const words = text.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      if ((line1 + ' ' + word).trim().length <= 20 && !line2) {
        line1 = (line1 + ' ' + word).trim();
      } else {
        line2 = (line2 + ' ' + word).trim();
      }
    }
    return [line1 || text.slice(0, 20), line2 || text.slice(20)];
  };

  return (
    <div className="space-y-4">
      {/* Graph Toolbar & Legend Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 text-xs text-slate-500">
        {/* Left: Summary Metrics & Filter Status */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-slate-700">
            {activities.length} Activities • {edgesList.length} Visible Transitions
          </span>
          {transitionThreshold > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-medium text-[11px]">
              Filtered at ≥ {transitionThreshold}% departure volume
            </span>
          )}
          {selectedNodeActivity && (
            <button
              onClick={() => onSelectNode(null)}
              className="text-[11px] text-sky-600 hover:underline font-medium cursor-pointer"
            >
              Clear Node Focus
            </button>
          )}
        </div>

        {/* Right: View Controls (Zoom & Toggle) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Legend Items */}
          <div className="hidden md:flex items-center gap-2.5 text-[11px] text-slate-400 mr-2 border-r border-slate-200 pr-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-slate-400" />
              <span>Flow</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-amber-500" />
              <span>30-60m</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-rose-500" />
              <span>&gt;60m / P90&gt;120m</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 border-t border-dashed border-teal-600" />
              <span>Rework</span>
            </span>
          </div>

          {/* Metric Mode Selector */}
          {viewMode === 'graph' && (
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs text-[11px]">
              <span className="text-slate-400 px-1.5 font-medium">Metric:</span>
              <button
                type="button"
                onClick={() => setDurationMetric('both')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
                  durationMetric === 'both'
                    ? 'bg-sky-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Both (Med + P90)
              </button>
              <button
                type="button"
                onClick={() => setDurationMetric('median')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
                  durationMetric === 'median'
                    ? 'bg-sky-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Median
              </button>
              <button
                type="button"
                onClick={() => setDurationMetric('p90')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
                  durationMetric === 'p90'
                    ? 'bg-sky-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                P90 Tail
              </button>
            </div>
          )}

          {/* Zoom Buttons */}
          {viewMode === 'graph' && (
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.min(1.6, prev + 0.15))}
                title="Zoom In"
                className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-50 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 font-mono text-[10px] text-slate-500">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.max(0.65, prev - 0.15))}
                title="Zoom Out"
                className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-50 cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                title="Reset Zoom"
                className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                viewMode === 'graph'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <GitFork className="w-3.5 h-3.5 text-sky-600" />
              <span>Directed Graph</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Cards Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Graph Canvas Area */}
      {viewMode === 'graph' ? (
        <div className="relative w-full overflow-x-auto overflow-y-auto border border-slate-200/90 rounded-xl bg-slate-50/60 shadow-inner max-h-[580px]">
          {nodesList.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No activity nodes available for current filter selection.
            </div>
          ) : (
            <div
              style={{
                width: `${graphWidth * zoomLevel}px`,
                height: `${graphHeight * zoomLevel}px`,
                minWidth: '100%',
              }}
              className="relative transition-all duration-150"
            >
              <svg
                width={graphWidth * zoomLevel}
                height={graphHeight * zoomLevel}
                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                className="w-full h-full select-none"
              >
                <defs>
                  {/* Arrowhead Markers */}
                  <marker
                    id="arrow-default"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#94a3b8" />
                  </marker>

                  <marker
                    id="arrow-incoming"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0d9488" />
                  </marker>

                  <marker
                    id="arrow-outgoing"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0284c7" />
                  </marker>

                  <marker
                    id="arrow-moderate"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#d97706" />
                  </marker>

                  <marker
                    id="arrow-high"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#e11d48" />
                  </marker>

                  <filter id="node-shadow" x="-5%" y="-5%" width="110%" height="115%">
                    <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.06" />
                  </filter>
                </defs>

                {/* 1. Render Directed Transition Edges */}
                <g className="edges-layer">
                  {edgesList.map((edge) => {
                    const isIncoming = selectedNodeActivity === edge.to;
                    const isOutgoing = selectedNodeActivity === edge.from;
                    const isDimmed =
                      selectedNodeActivity !== null && !isIncoming && !isOutgoing;

                    // Choose edge stroke color and marker
                    let strokeColor = '#94a3b8';
                    let markerId = 'arrow-default';

                    if (isIncoming) {
                      strokeColor = '#0d9488'; // Teal
                      markerId = 'arrow-incoming';
                    } else if (isOutgoing) {
                      strokeColor = '#0284c7'; // Sky
                      markerId = 'arrow-outgoing';
                    } else if (edge.severity === 'high') {
                      strokeColor = '#e11d48'; // Rose
                      markerId = 'arrow-high';
                    } else if (edge.severity === 'moderate') {
                      strokeColor = '#d97706'; // Amber
                      markerId = 'arrow-moderate';
                    }

                    let badgeWidth = 92;
                    let badgeX = -46;
                    let labelText = '';

                    const caseStr = formatNumber(edge.transition.caseCount);
                    const medStr = `${edge.transition.medianElapsedMinutes}m`;
                    const p90Str = `${edge.transition.p90ElapsedMinutes}m`;

                    if (durationMetric === 'both') {
                      labelText = `${caseStr} (${medStr} • P90:${p90Str})`;
                      badgeWidth = 146;
                      badgeX = -73;
                    } else if (durationMetric === 'p90') {
                      labelText = `${caseStr} (P90:${p90Str})`;
                      badgeWidth = 108;
                      badgeX = -54;
                    } else {
                      labelText = `${caseStr} (${medStr})`;
                      badgeWidth = 92;
                      badgeX = -46;
                    }

                    const tooltipText =
                      `Transition: ${edge.from} → ${edge.to}\n` +
                      `Cases: ${caseStr} (${edge.transition.percentageOfDepartures}% of departures)\n` +
                      `Observations: ${formatNumber(edge.transition.observationCount)}\n` +
                      `Median Duration: ${edge.transition.medianElapsedMinutes} min (${formatDurationMinutes(edge.transition.medianElapsedMinutes)})\n` +
                      `P90 Tail Duration: ${edge.transition.p90ElapsedMinutes} min (${formatDurationMinutes(edge.transition.p90ElapsedMinutes)})\n` +
                      `Mean Duration: ${edge.transition.meanElapsedMinutes} min (${formatDurationMinutes(edge.transition.meanElapsedMinutes)})\n` +
                      `Flow Type: ${edge.isBackward ? 'Rework Loop / Recurrence' : 'Forward Progression'}`;

                    return (
                      <g
                        key={edge.id}
                        className={`transition-opacity duration-200 ${
                          isDimmed ? 'opacity-20' : 'opacity-100'
                        }`}
                      >
                        {/* Curve Path */}
                        <path
                          d={edge.pathD}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={edge.strokeWidth}
                          strokeDasharray={edge.isBackward ? '5 4' : undefined}
                          markerEnd={`url(#${markerId})`}
                          className={`transition-colors duration-200 ${onSelectTransition ? 'cursor-pointer hover:stroke-sky-600' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTransition?.(edge.transition);
                          }}
                        >
                          <title>{tooltipText}</title>
                        </path>

                        {/* Edge Label Badge */}
                        <g
                          transform={`translate(${edge.labelX}, ${edge.labelY})`}
                          className={onSelectTransition ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTransition?.(edge.transition);
                          }}
                        >
                          <title>{tooltipText}</title>
                          <rect
                            x={badgeX}
                            y="-9"
                            width={badgeWidth}
                            height="18"
                            rx="9"
                            fill="#ffffff"
                            stroke={
                              isIncoming
                                ? '#0d9488'
                                : isOutgoing
                                ? '#0284c7'
                                : edge.severity === 'high'
                                ? '#fecdd3'
                                : edge.severity === 'moderate'
                                ? '#fde68a'
                                : '#e2e8f0'
                            }
                            strokeWidth="1"
                            filter="url(#node-shadow)"
                          />
                          <text
                            x="0"
                            y="3"
                            textAnchor="middle"
                            className="text-[9px] font-mono font-medium fill-slate-700"
                          >
                            {labelText}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>

                {/* 2. Render Activity Nodes */}
                <g className="nodes-layer">
                  {nodesList.map((node) => {
                    const isSelected = selectedNodeActivity === node.activity;
                    const isDimmed =
                      selectedNodeActivity !== null &&
                      selectedNodeActivity !== node.activity &&
                      !edgesList.some(
                        (e) =>
                          (e.from === selectedNodeActivity && e.to === node.activity) ||
                          (e.to === selectedNodeActivity && e.from === node.activity)
                      );

                    const [line1, line2] = splitActivityLabel(node.activity);

                    return (
                      <g
                        key={node.activity}
                        transform={`translate(${node.x}, ${node.y})`}
                        onClick={() =>
                          onSelectNode(isSelected ? null : node.activity)
                        }
                        className={`cursor-pointer transition-opacity duration-200 ${
                          isDimmed ? 'opacity-35' : 'opacity-100'
                        }`}
                      >
                        {/* Node Card Box */}
                        <rect
                          width={node.width}
                          height={node.height}
                          rx="10"
                          fill={isSelected ? '#f0f9ff' : '#ffffff'}
                          stroke={isSelected ? '#0284c7' : '#cbd5e1'}
                          strokeWidth={isSelected ? '2.5' : '1'}
                          filter="url(#node-shadow)"
                          className="hover:stroke-sky-400 transition-colors"
                        />

                        {/* Top Step Circle Indicator */}
                        <circle
                          cx="18"
                          cy="20"
                          r="9"
                          fill={isSelected ? '#0284c7' : '#f1f5f9'}
                        />
                        <text
                          x="18"
                          y="23"
                          textAnchor="middle"
                          className={`text-[9px] font-bold ${
                            isSelected ? 'fill-white' : 'fill-slate-600'
                          }`}
                        >
                          {node.layer + 1}
                        </text>

                        {/* Activity Name */}
                        <text
                          x="34"
                          y="18"
                          className="text-[11px] font-bold fill-slate-900 font-sans"
                        >
                          {line1}
                        </text>
                        {line2 && (
                          <text
                            x="34"
                            y="30"
                            className="text-[11px] font-bold fill-slate-900 font-sans"
                          >
                            {line2}
                          </text>
                        )}

                        {/* Divider Line */}
                        <line
                          x1="12"
                          y1="46"
                          x2="188"
                          y2="46"
                          stroke="#f1f5f9"
                          strokeWidth="1"
                        />

                        {/* Footer Statistics */}
                        <text
                          x="14"
                          y="60"
                          className="text-[10px] font-medium fill-slate-500 font-sans"
                        >
                          {formatNumber(node.metric.caseCount)} cases
                        </text>
                        <text
                          x="186"
                          y="60"
                          textAnchor="end"
                          className="text-[10px] font-mono font-semibold fill-teal-700"
                        >
                          {node.metric.medianElapsedMinutes}m med
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          )}
        </div>
      ) : (
        /* Alternative Cards Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {activities.map((act, idx) => {
            const isSelected = selectedNodeActivity === act.activity;
            return (
              <div
                key={act.activity}
                onClick={() => onSelectNode(isSelected ? null : act.activity)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer text-xs relative ${
                  isSelected
                    ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-200'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-bold text-slate-900 text-xs leading-tight">
                    {act.activity}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">{formatNumber(act.caseCount)} cases</span>
                  <span className="font-semibold text-teal-700">
                    {act.medianElapsedMinutes}m median
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
