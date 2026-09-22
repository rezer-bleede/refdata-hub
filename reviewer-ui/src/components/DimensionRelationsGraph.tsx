import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  NodeProps,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitFork,
  Sun,
  Snowflake,
  Search,
  RefreshCw,
  Layers,
  MapPin,
  ArrowRight,
  Sparkles,
  Database,
  Link as LinkIcon,
  X,
} from 'lucide-react';
import type { DimensionRelationSummary, DimensionRelationLink } from '../types';

export type LayoutMode = 'hierarchical-tb' | 'hierarchical-lr' | 'star' | 'snowflake';

interface DimensionRelationsGraphProps {
  relations: DimensionRelationSummary[];
  linksByRelation: Map<number, DimensionRelationLink[]>;
  selectedRelationId: number | null;
  onSelectRelation: (id: number | null) => void;
  showLinks?: boolean;
}

interface CustomDimensionData extends Record<string, unknown> {
  label: string;
  code: string;
  isParent?: boolean;
  isChild?: boolean;
  isSelected?: boolean;
  relationCount: number;
  description?: string;
}

interface CustomLinkData extends Record<string, unknown> {
  parentLabel: string;
  childLabel: string;
  relationLabel: string;
  isSelected?: boolean;
}

// Custom Node for Dimension
const DimensionNodeComponent: React.FC<NodeProps<Node<CustomDimensionData>>> = ({ data }) => {
  return (
    <div
      className={`px-4 py-3 rounded-2xl shadow-lg border transition-all duration-300 min-w-[200px] ${
        data.isSelected
          ? 'bg-indigo-950/90 border-indigo-400 shadow-indigo-500/30 ring-2 ring-indigo-400/50 text-white'
          : 'bg-slate-900/85 border-slate-700/80 hover:border-slate-500 text-slate-100'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-400 !w-3 !h-3 !-top-1.5" />
      <Handle type="target" position={Position.Left} className="!bg-indigo-400 !w-3 !h-3 !-left-1.5" />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-indigo-400 font-semibold text-xs tracking-wider uppercase">
          <Database className="w-3.5 h-3.5" />
          <span>{data.code}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          {data.relationCount} rel{data.relationCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="font-bold text-sm text-slate-100 truncate mb-1">{data.label}</div>

      {data.description && (
        <div className="text-xs text-slate-400 line-clamp-1">{data.description}</div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3 !-bottom-1.5" />
      <Handle type="source" position={Position.Right} className="!bg-indigo-400 !w-3 !h-3 !-right-1.5" />
    </div>
  );
};

// Custom Node for Canonical Pair / Link
const ValueLinkNodeComponent: React.FC<NodeProps<Node<CustomLinkData>>> = ({ data }) => {
  return (
    <div
      className={`px-3 py-2 rounded-xl shadow-md border text-xs transition-all ${
        data.isSelected
          ? 'bg-teal-950/90 border-teal-400 text-teal-100 ring-2 ring-teal-400/40'
          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-teal-400 !w-2.5 !h-2.5" />
      <Handle type="target" position={Position.Left} className="!bg-teal-400 !w-2.5 !h-2.5" />

      <div className="flex items-center gap-1.5 font-medium">
        <span className="text-teal-300 font-semibold">{data.parentLabel}</span>
        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="text-emerald-300 font-semibold">{data.childLabel}</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-teal-400 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Right} className="!bg-teal-400 !w-2.5 !h-2.5" />
    </div>
  );
};

const nodeTypes = {
  dimensionNode: DimensionNodeComponent,
  valueLinkNode: ValueLinkNodeComponent,
};

// Helper to compute layout positions using Dagre / Radial algorithms
const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  mode: LayoutMode,
  selectedRelationId: number | null
) => {
  if (nodes.length === 0) return { nodes, edges };

  if (mode === 'hierarchical-tb' || mode === 'hierarchical-lr') {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    const isHorizontal = mode === 'hierarchical-lr';
    dagreGraph.setGraph({
      rankdir: isHorizontal ? 'LR' : 'TB',
      nodesep: 60,
      ranksep: 90,
      marginx: 40,
      marginy: 40,
    });

    nodes.forEach((node) => {
      const isValueNode = node.type === 'valueLinkNode';
      dagreGraph.setNode(node.id, {
        width: isValueNode ? 180 : 220,
        height: isValueNode ? 50 : 80,
      });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      const isValueNode = node.type === 'valueLinkNode';
      const width = isValueNode ? 180 : 220;
      const height = isValueNode ? 50 : 80;

      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: {
          x: nodeWithPosition.x - width / 2,
          y: nodeWithPosition.y - height / 2,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }

  if (mode === 'star') {
    // Star layout: Central node surrounded radially by connected nodes
    let centerNodeId = nodes[0]?.id;
    if (selectedRelationId) {
      const found = nodes.find((n) => n.id === `rel-${selectedRelationId}` || n.id.includes(String(selectedRelationId)));
      if (found) centerNodeId = found.id;
    }

    const centerNodeIndex = nodes.findIndex((n) => n.id === centerNodeId);
    const outerNodes = nodes.filter((n) => n.id !== centerNodeId);
    const radius = Math.max(280, outerNodes.length * 45);

    const layoutedNodes = nodes.map((node) => {
      if (node.id === centerNodeId) {
        return { ...node, position: { x: 0, y: 0 } };
      }
      const outerIndex = outerNodes.findIndex((n) => n.id === node.id);
      const angle = (2 * Math.PI * outerIndex) / outerNodes.length;
      return {
        ...node,
        position: {
          x: Math.round(radius * Math.cos(angle)),
          y: Math.round(radius * Math.sin(angle)),
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }

  if (mode === 'snowflake') {
    // Snowflake layout: Radial multi-tier graph expansion
    const layoutedNodes = [...nodes];
    const degrees = new Map<string, number>();

    edges.forEach((e) => {
      degrees.set(e.source, (degrees.get(e.source) || 0) + 1);
      degrees.set(e.target, (degrees.get(e.target) || 0) + 1);
    });

    // Sort by connection degree to establish hubs
    const sortedNodes = [...nodes].sort(
      (a, b) => (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0)
    );

    const hubs = sortedNodes.slice(0, Math.max(1, Math.floor(nodes.length / 4)));
    const hubIds = new Set(hubs.map((h) => h.id));

    // Place hubs in inner ring
    const hubRadius = 200;
    hubs.forEach((hub, idx) => {
      const angle = (2 * Math.PI * idx) / hubs.length;
      const target = layoutedNodes.find((n) => n.id === hub.id);
      if (target) {
        target.position = {
          x: Math.round(hubRadius * Math.cos(angle)),
          y: Math.round(hubRadius * Math.sin(angle)),
        };
      }
    });

    // Place remaining outer nodes in outer ring
    const outerNodes = layoutedNodes.filter((n) => !hubIds.has(n.id));
    const outerRadius = 450;
    outerNodes.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, outerNodes.length);
      node.position = {
        x: Math.round(outerRadius * Math.cos(angle)),
        y: Math.round(outerRadius * Math.sin(angle)),
      };
    });

    return { nodes: layoutedNodes, edges };
  }

  return { nodes, edges };
};

const InnerGraph: React.FC<DimensionRelationsGraphProps> = ({
  relations,
  linksByRelation,
  selectedRelationId,
  onSelectRelation,
  showLinks = true,
}) => {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('hierarchical-lr');
  const [searchTerm, setSearchTerm] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // Calculate raw nodes and edges from relations and links
  useEffect(() => {
    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];
    const dimensionMap = new Map<string, { label: string; count: number; description?: string }>();

    // Collect all dimension nodes
    relations.forEach((rel) => {
      const pCode = rel.parent_dimension_code;
      const cCode = rel.child_dimension_code;

      if (!dimensionMap.has(pCode)) {
        dimensionMap.set(pCode, {
          label: rel.parent_dimension.label,
          count: 0,
          description: rel.parent_dimension.description ?? undefined,
        });
      }
      if (!dimensionMap.has(cCode)) {
        dimensionMap.set(cCode, {
          label: rel.child_dimension.label,
          count: 0,
          description: rel.child_dimension.description ?? undefined,
        });
      }

      dimensionMap.get(pCode)!.count += 1;
      dimensionMap.get(cCode)!.count += 1;
    });

    // Create Dimension Nodes
    dimensionMap.forEach((info, code) => {
      const isSearchMatch =
        searchTerm.trim() !== '' &&
        (code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          info.label.toLowerCase().includes(searchTerm.toLowerCase()));

      rawNodes.push({
        id: `dim-${code}`,
        type: 'dimensionNode',
        position: { x: 0, y: 0 },
        data: {
          label: info.label,
          code: code,
          relationCount: info.count,
          description: info.description,
          isSelected: relations.some(
            (r) =>
              r.id === selectedRelationId &&
              (r.parent_dimension_code === code || r.child_dimension_code === code)
          ),
        },
        hidden: searchTerm.trim() !== '' && !isSearchMatch,
      });
    });

    // Create Edge for each relation
    relations.forEach((rel) => {
      const isSelected = rel.id === selectedRelationId;
      rawEdges.push({
        id: `edge-rel-${rel.id}`,
        source: `dim-${rel.parent_dimension_code}`,
        target: `dim-${rel.child_dimension_code}`,
        label: rel.label,
        type: 'smoothstep',
        animated: isSelected,
        style: {
          stroke: isSelected ? '#818cf8' : '#475569',
          strokeWidth: isSelected ? 3 : 1.5,
        },
        labelStyle: { fill: isSelected ? '#a5b4fc' : '#94a3b8', fontSize: 11, fontWeight: 600 },
        labelBgStyle: { fill: '#0f172a' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isSelected ? '#818cf8' : '#475569',
        },
      });

      // Optionally show individual value links as sub-nodes if showLinks is enabled
      if (showLinks && isSelected) {
        const links = linksByRelation.get(rel.id) || [];
        links.forEach((link) => {
          const linkNodeId = `link-${rel.id}-${link.id}`;
          rawNodes.push({
            id: linkNodeId,
            type: 'valueLinkNode',
            position: { x: 0, y: 0 },
            data: {
              parentLabel: link.parent_label,
              childLabel: link.child_label,
              relationLabel: rel.label,
              isSelected: true,
            },
          });

          rawEdges.push({
            id: `edge-link-p-${link.id}`,
            source: `dim-${rel.parent_dimension_code}`,
            target: linkNodeId,
            style: { stroke: '#2dd4bf', strokeWidth: 1, strokeDasharray: '4 4' },
            type: 'default',
          });

          rawEdges.push({
            id: `edge-link-c-${link.id}`,
            source: linkNodeId,
            target: `dim-${rel.child_dimension_code}`,
            style: { stroke: '#2dd4bf', strokeWidth: 1, strokeDasharray: '4 4' },
            type: 'default',
          });
        });
      }
    });

    const layouted = getLayoutedElements(rawNodes, rawEdges, layoutMode, selectedRelationId);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [relations, linksByRelation, selectedRelationId, layoutMode, searchTerm, showLinks, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('dim-')) {
        const code = node.id.replace('dim-', '');
        const matchingRel = relations.find(
          (r) => r.parent_dimension_code === code || r.child_dimension_code === code
        );
        if (matchingRel) {
          onSelectRelation(matchingRel.id);
        }
      }
    },
    [relations, onSelectRelation]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (edge.id.startsWith('edge-rel-')) {
        const relId = Number(edge.id.replace('edge-rel-', ''));
        onSelectRelation(relId);
      }
    },
    [onSelectRelation]
  );

  const triggerFitView = useCallback(() => {
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [fitView]);

  return (
    <div className="relative w-full h-[580px] rounded-3xl border border-slate-800 bg-slate-950/90 overflow-hidden shadow-2xl">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        fitView
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#334155" gap={20} size={1} />
        <MiniMap
          nodeColor={(n) => (n.type === 'dimensionNode' ? '#6366f1' : '#14b8a6')}
          maskColor="rgba(15, 23, 42, 0.7)"
          className="!bg-slate-900/90 !border-slate-800 !rounded-xl !shadow-lg"
        />

        {/* Custom Toolbar Controls */}
        <Panel position="top-left" className="m-3 flex flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-md">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search dimensions…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none text-xs text-slate-100 placeholder-slate-500 focus:outline-none w-36 md:w-48"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-200 ml-1"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Layout Mode Buttons */}
          <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 shadow-md gap-1">
            <button
              onClick={() => setLayoutMode('hierarchical-lr')}
              title="Hierarchical Left-Right"
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 font-medium transition ${
                layoutMode === 'hierarchical-lr'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <GitFork className="w-3.5 h-3.5 rotate-90" />
              <span className="hidden sm:inline">Horizontal</span>
            </button>

            <button
              onClick={() => setLayoutMode('hierarchical-tb')}
              title="Hierarchical Top-Bottom"
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 font-medium transition ${
                layoutMode === 'hierarchical-tb'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vertical</span>
            </button>

            <button
              onClick={() => setLayoutMode('star')}
              title="Star Radial Layout"
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 font-medium transition ${
                layoutMode === 'star'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Star</span>
            </button>

            <button
              onClick={() => setLayoutMode('snowflake')}
              title="Snowflake Layout"
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 font-medium transition ${
                layoutMode === 'snowflake'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Snowflake className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Snowflake</span>
            </button>
          </div>
        </Panel>

        {/* Bottom Right Zoom Controls */}
        <Panel position="bottom-right" className="m-3 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl p-1.5 shadow-md">
          <button
            onClick={() => zoomIn({ duration: 300 })}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => zoomOut({ duration: 300 })}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={triggerFitView}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Fit View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export const DimensionRelationsGraph: React.FC<DimensionRelationsGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <InnerGraph {...props} />
    </ReactFlowProvider>
  );
};

export default DimensionRelationsGraph;
