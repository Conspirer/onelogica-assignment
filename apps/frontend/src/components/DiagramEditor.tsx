"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useEdgesState,
  useNodesState,
  addEdge,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  type NodeDragHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { toPng, toSvg } from "html-to-image";
import type { CollaboratorPresence, CustomNodeData, ShapeType } from "@onelogica/shared-types";
import { ArchitectureNode } from "./ArchitectureNode";
import { PaletteSidebar } from "./PaletteSidebar";
import { InspectorPanel } from "./InspectorPanel";
import { CollaboratorCursors } from "./CollaboratorCursors";
import {
  computeAutoLayout,
  detectCycle,
  findDisconnectedComponents,
  groupNodesIntoContainer,
  ungroupContainer,
  validateConnection,
  wouldCreateCycle,
} from "@/lib/diagramIntelligence";
import { useDiagramHistory } from "@/lib/useDiagramHistory";

const nodeTypes = {
  architectureNode: ArchitectureNode,
};

const defaultInitialNodes: Node<CustomNodeData>[] = [
  {
    id: "node-client",
    type: "architectureNode",
    position: { x: 100, y: 180 },
    data: {
      label: "Web / Mobile Client",
      description: "Next.js + React Flow UI",
      shape: "rounded",
      bgColor: "#eff6ff",
      borderColor: "#2563eb",
      textColor: "#1e3a8a",
      lastUpdated: Date.now(),
    },
  },
  {
    id: "node-gateway",
    type: "architectureNode",
    position: { x: 420, y: 180 },
    data: {
      label: "API Gateway",
      description: "Cloudflare / Reverse Proxy",
      shape: "diamond",
      bgColor: "#fff1f2",
      borderColor: "#e11d48",
      textColor: "#881337",
      lastUpdated: Date.now(),
    },
  },
  {
    id: "node-backend",
    type: "architectureNode",
    position: { x: 740, y: 180 },
    data: {
      label: "Fastify Realtime Service",
      description: "Node.js WebSocket Engine",
      shape: "rectangle",
      bgColor: "#f0fdf4",
      borderColor: "#16a34a",
      textColor: "#14532d",
      lastUpdated: Date.now(),
    },
  },
  {
    id: "node-db",
    type: "architectureNode",
    position: { x: 740, y: 380 },
    data: {
      label: "PostgreSQL Database",
      description: "Versioned Diagram Store",
      shape: "cylinder",
      bgColor: "#fef3c7",
      borderColor: "#d97706",
      textColor: "#78350f",
      lastUpdated: Date.now(),
    },
  },
];

const defaultInitialEdges: Edge[] = [
  {
    id: "edge-client-gateway",
    source: "node-client",
    target: "node-gateway",
    type: "smoothstep",
    animated: true,
    label: "HTTPS / WSS",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "edge-gateway-backend",
    source: "node-gateway",
    target: "node-backend",
    type: "smoothstep",
    label: "gRPC / TCP",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "edge-backend-db",
    source: "node-backend",
    target: "node-db",
    type: "smoothstep",
    label: "SQL Pooling",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

export interface DiagramEditorProps {
  initialData?: { nodes: Node[]; edges: Edge[] } | null;
  onOperation: (op: Record<string, unknown>) => void;
  onSnapshotChange?: (data: { nodes: Node[]; edges: Edge[] }) => void;
  collaborators?: CollaboratorPresence[];
  currentUserId?: string;
  onCursorMove?: (coords: { x: number; y: number } | null) => void;
  remoteOperation?: { type: string; [key: string]: unknown } | null;
}

export function DiagramEditor({
  initialData,
  onOperation,
  onSnapshotChange,
  collaborators = [],
  currentUserId,
  onCursorMove,
  remoteOperation,
}: DiagramEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeData>(
    (initialData?.nodes as Node<CustomNodeData>[]) || defaultInitialNodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialData?.edges || defaultInitialEdges,
  );

  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Undo / Redo Local History Manager
  const { canUndo, canRedo, pushLocalChange, undo, redo, setSnapshot } = useDiagramHistory({
    nodes,
    edges,
  });

  // Track cursor movement throttle
  const lastCursorSend = useRef<number>(0);

  // Synchronize initial data once loaded
  useEffect(() => {
    if (initialData?.nodes && initialData?.edges) {
      setNodes(initialData.nodes as Node<CustomNodeData>[]);
      setEdges(initialData.edges);
      setSnapshot({ nodes: initialData.nodes, edges: initialData.edges });
    }
  }, [initialData, setEdges, setNodes, setSnapshot]);

  // Notify parent of snapshot updates
  useEffect(() => {
    onSnapshotChange?.({ nodes, edges });
  }, [edges, nodes, onSnapshotChange]);

  // Diagram Intelligence: Disconnected Components & Cycles
  const disconnected = useMemo(() => findDisconnectedComponents(nodes, edges), [nodes, edges]);
  const cycleInfo = useMemo(() => detectCycle(nodes, edges), [nodes, edges]);

  // Apply Remote Real-Time Operations (Last-Write-Wins Conflict Resolution)
  useEffect(() => {
    if (!remoteOperation) return;

    const op = remoteOperation;
    const remoteTimestamp = typeof op.timestamp === "string" ? new Date(op.timestamp).getTime() : 0;

    if (op.type === "MOVE_NODE" || op.type === "MOVE") {
      const nodeId = op.nodeId as string;
      const position = op.position as { x: number; y: number };
      if (!nodeId || !position) return;

      setNodes((current) =>
        current.map((n) => {
          if (n.id === nodeId) {
            const localLast = (n.data as CustomNodeData)?.lastUpdated || 0;
            // Last-write-wins: apply if remote operation is newer or equal
            if (remoteTimestamp >= localLast) {
              return {
                ...n,
                position,
                data: { ...n.data, lastUpdated: remoteTimestamp },
              };
            }
          }
          return n;
        }),
      );
    } else if (op.type === "CREATE_NODE") {
      const node = op.node as Node<CustomNodeData>;
      if (node && node.id) {
        setNodes((current) => {
          if (current.some((n) => n.id === node.id)) return current;
          return [...current, node];
        });
      }
    } else if (op.type === "UPDATE_NODE_DATA") {
      const nodeId = op.nodeId as string;
      const patch = op.patch as Partial<CustomNodeData>;
      if (nodeId && patch) {
        setNodes((current) =>
          current.map((n) => {
            if (n.id === nodeId) {
              return {
                ...n,
                data: { ...n.data, ...patch, lastUpdated: remoteTimestamp },
              };
            }
            return n;
          }),
        );
      }
    } else if (op.type === "DELETE_ELEMENTS") {
      const nodeIds = (op.nodeIds as string[]) || [];
      const edgeIds = (op.edgeIds as string[]) || [];

      setNodes((current) => current.filter((n) => !nodeIds.includes(n.id)));
      setEdges((current) =>
        current.filter(
          (e) => !edgeIds.includes(e.id) && !nodeIds.includes(e.source) && !nodeIds.includes(e.target),
        ),
      );
    } else if (op.type === "CONNECT_EDGE") {
      const edge = op.edge as Edge;
      if (edge && edge.source && edge.target) {
        setEdges((current) => {
          if (current.some((e) => e.id === edge.id)) return current;
          return addEdge(edge, current);
        });
      }
    } else if (op.type === "BATCH_UPDATE" || op.type === "AUTO_LAYOUT") {
      const newNodes = op.nodes as Node<CustomNodeData>[];
      const newEdges = op.edges as Edge[];
      if (newNodes) setNodes(newNodes);
      if (newEdges) setEdges(newEdges);
    }
  }, [remoteOperation, setEdges, setNodes]);

  // Handle Drag & Drop of palette shapes onto canvas
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/reactflow-shape");
      if (!raw || !rfInstance) return;

      try {
        const item = JSON.parse(raw) as {
          shape: ShapeType;
          title: string;
          subtitle: string;
          defaultBg: string;
          defaultBorder: string;
          defaultText: string;
        };

        const position = rfInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newNodeId = `node-${Date.now()}`;
        const isContainer = item.shape === "container";
        const width = isContainer ? 320 : 160;
        const height = isContainer ? 200 : 70;

        const newNode: Node<CustomNodeData> = {
          id: newNodeId,
          type: "architectureNode",
          position,
          data: {
            label: item.title,
            description: item.subtitle,
            shape: item.shape,
            bgColor: item.defaultBg,
            borderColor: item.defaultBorder,
            textColor: item.defaultText,
            isContainer,
            width,
            height,
            lastUpdated: Date.now(),
          },
          style: isContainer ? { width, height, zIndex: -1 } : undefined,
        };

        const updated = [...nodes, newNode];
        setNodes(updated);
        pushLocalChange({ nodes: updated, edges });

        onOperation({
          type: "CREATE_NODE",
          node: newNode,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // ignore parse error
      }
    },
    [edges, nodes, onOperation, pushLocalChange, rfInstance, setNodes],
  );

  // Quick click-to-add shape
  const handleAddShape = useCallback(
    (item: {
      shape: ShapeType;
      title: string;
      subtitle: string;
      defaultBg: string;
      defaultBorder: string;
      defaultText: string;
    }) => {
      const newNodeId = `node-${Date.now()}`;
      const isContainer = item.shape === "container";
      const width = isContainer ? 320 : 160;
      const height = isContainer ? 200 : 70;

      const newNode: Node<CustomNodeData> = {
        id: newNodeId,
        type: "architectureNode",
        position: {
          x: 200 + Math.random() * 200,
          y: 150 + Math.random() * 150,
        },
        data: {
          label: item.title,
          description: item.subtitle,
          shape: item.shape,
          bgColor: item.defaultBg,
          borderColor: item.defaultBorder,
          textColor: item.defaultText,
          isContainer,
          width,
          height,
          lastUpdated: Date.now(),
        },
        style: isContainer ? { width, height, zIndex: -1 } : undefined,
      };

      const updated = [...nodes, newNode];
      setNodes(updated);
      pushLocalChange({ nodes: updated, edges });

      onOperation({
        type: "CREATE_NODE",
        node: newNode,
        timestamp: new Date().toISOString(),
      });
    },
    [edges, nodes, onOperation, pushLocalChange, setNodes],
  );

  // Connecting directional edges with validation
  const onConnect = useCallback(
    (connection: Connection) => {
      setValidationAlert(null);
      const validation = validateConnection(connection, nodes, edges);
      if (!validation.valid) {
        setValidationAlert(validation.reason || "Invalid connection");
        return;
      }

      if (wouldCreateCycle(edges, connection.source!, connection.target!)) {
        setValidationAlert("Notice: Connection introduces a circular dependency in the graph.");
      }

      const newEdge: Edge = {
        id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      };

      const updatedEdges = addEdge(newEdge, edges);
      setEdges(updatedEdges);
      pushLocalChange({ nodes, edges: updatedEdges });

      onOperation({
        type: "CONNECT_EDGE",
        edge: newEdge,
        timestamp: new Date().toISOString(),
      });
    },
    [edges, nodes, onOperation, pushLocalChange, setEdges],
  );

  // Node Drag Stop: send position update to collaborators
  const onNodeDragStop: NodeDragHandler = useCallback(
    (_, node) => {
      pushLocalChange({ nodes, edges });
      onOperation({
        type: "MOVE_NODE",
        nodeId: node.id,
        position: node.position,
        timestamp: new Date().toISOString(),
      });
    },
    [edges, nodes, onOperation, pushLocalChange],
  );

  // Pointer Move: Broadcast live cursor coordinates
  const handlePointerMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!onCursorMove || !rfInstance) return;

      const now = performance.now();
      if (now - lastCursorSend.current < 40) return; // 25fps throttle
      lastCursorSend.current = now;

      const bounds = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX - bounds.left;
      const clientY = e.clientY - bounds.top;

      onCursorMove({ x: clientX, y: clientY });
    },
    [onCursorMove, rfInstance],
  );

  const handlePointerLeave = useCallback(() => {
    onCursorMove?.(null);
  }, [onCursorMove]);

  // Selection handlers
  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      setSelectedNodeIds(selNodes.map((n) => n.id));
      if (selNodes.length === 1) {
        setSelectedNodeId(selNodes[0].id);
        setSelectedEdgeId(null);
      } else if (selEdges.length === 1 && selNodes.length === 0) {
        setSelectedEdgeId(selEdges[0].id);
        setSelectedNodeId(null);
      } else {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
      }
    },
    [],
  );

  // Update Node Data
  const handleUpdateNode = useCallback(
    (nodeId: string, patch: Partial<CustomNodeData>) => {
      const now = Date.now();
      const updated = nodes.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: { ...n.data, ...patch, lastUpdated: now },
          };
        }
        return n;
      });

      setNodes(updated);
      pushLocalChange({ nodes: updated, edges });

      onOperation({
        type: "UPDATE_NODE_DATA",
        nodeId,
        patch,
        timestamp: new Date().toISOString(),
      });
    },
    [edges, nodes, onOperation, pushLocalChange, setNodes],
  );

  // Delete Node (safely cleans up incident edges)
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const updatedNodes = nodes.filter((n) => n.id !== nodeId);
      const updatedEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

      setNodes(updatedNodes);
      setEdges(updatedEdges);
      setSelectedNodeId(null);
      pushLocalChange({ nodes: updatedNodes, edges: updatedEdges });

      onOperation({
        type: "DELETE_ELEMENTS",
        nodeIds: [nodeId],
        timestamp: new Date().toISOString(),
      });
    },
    [edges, nodes, onOperation, pushLocalChange, setEdges, setNodes],
  );

  // Update Edge
  const handleUpdateEdge = useCallback(
    (edgeId: string, label: string, styleType: string) => {
      const updatedEdges = edges.map((e) => {
        if (e.id === edgeId) {
          return {
            ...e,
            label,
            type: styleType,
          };
        }
        return e;
      });

      setEdges(updatedEdges);
      pushLocalChange({ nodes, edges: updatedEdges });

      onOperation({
        type: "BATCH_UPDATE",
        nodes,
        edges: updatedEdges,
        timestamp: new Date().toISOString(),
      });
    },
    [edges, nodes, onOperation, pushLocalChange, setEdges],
  );

  // Delete Edge
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      const updatedEdges = edges.filter((e) => e.id !== edgeId);
      setEdges(updatedEdges);
      setSelectedEdgeId(null);
      pushLocalChange({ nodes, edges: updatedEdges });

      onOperation({
        type: "DELETE_ELEMENTS",
        edgeIds: [edgeId],
        timestamp: new Date().toISOString(),
      });
    },
    [edges, nodes, onOperation, pushLocalChange, setEdges],
  );

  // Auto-Layout: Hierarchical arrangement
  const handleAutoLayout = useCallback(() => {
    const layouted = computeAutoLayout(nodes, edges);
    setNodes(layouted);
    pushLocalChange({ nodes: layouted, edges });

    onOperation({
      type: "AUTO_LAYOUT",
      nodes: layouted,
      edges,
      timestamp: new Date().toISOString(),
    });
  }, [edges, nodes, onOperation, pushLocalChange, setNodes]);

  // Group Selected Nodes
  const handleGroupSelected = useCallback(() => {
    const { updatedNodes } = groupNodesIntoContainer(selectedNodeIds, nodes);
    setNodes(updatedNodes);
    pushLocalChange({ nodes: updatedNodes, edges });

    onOperation({
      type: "BATCH_UPDATE",
      nodes: updatedNodes,
      edges,
      timestamp: new Date().toISOString(),
    });
  }, [edges, nodes, onOperation, pushLocalChange, selectedNodeIds, setNodes]);

  // Ungroup Container
  const handleUngroupContainer = useCallback(
    (containerId: string) => {
      const updatedNodes = ungroupContainer(containerId, nodes);
      setNodes(updatedNodes);
      setSelectedNodeId(null);
      pushLocalChange({ nodes: updatedNodes, edges });

      onOperation({
        type: "BATCH_UPDATE",
        nodes: updatedNodes,
        edges,
        timestamp: new Date().toISOString(),
      });
    },
    [edges, nodes, onOperation, pushLocalChange, setNodes],
  );

  // Undo / Redo triggers
  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev) {
      setNodes(prev.nodes as Node<CustomNodeData>[]);
      setEdges(prev.edges);
      onOperation({
        type: "BATCH_UPDATE",
        nodes: prev.nodes,
        edges: prev.edges,
        timestamp: new Date().toISOString(),
      });
    }
  }, [onOperation, setEdges, setNodes, undo]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) {
      setNodes(next.nodes as Node<CustomNodeData>[]);
      setEdges(next.edges);
      onOperation({
        type: "BATCH_UPDATE",
        nodes: next.nodes,
        edges: next.edges,
        timestamp: new Date().toISOString(),
      });
    }
  }, [onOperation, redo, setEdges, setNodes]);

  // Keyboard Shortcuts (Undo, Redo, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId) {
          e.preventDefault();
          handleDeleteNode(selectedNodeId);
        } else if (selectedEdgeId) {
          e.preventDefault();
          handleDeleteEdge(selectedEdgeId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDeleteEdge, handleDeleteNode, handleRedo, handleUndo, selectedEdgeId, selectedNodeId]);

  // Export pipeline
  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `architecture-diagram-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [edges, nodes]);

  const importJson = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.nodes && parsed.edges) {
            setNodes(parsed.nodes);
            setEdges(parsed.edges);
            pushLocalChange({ nodes: parsed.nodes, edges: parsed.edges });
            onOperation({
              type: "BATCH_UPDATE",
              nodes: parsed.nodes,
              edges: parsed.edges,
              timestamp: new Date().toISOString(),
            });
          }
        } catch {
          setValidationAlert("Invalid JSON diagram file.");
        }
      };
      reader.readAsText(file);
    },
    [onOperation, pushLocalChange, setEdges, setNodes],
  );

  const exportAsPng = useCallback(async () => {
    setIsExporting(true);
    const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!el) {
      setIsExporting(false);
      return;
    }

    try {
      const dataUrl = await toPng(el, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `architecture-${Date.now()}.png`;
      a.click();
    } catch {
      setValidationAlert("Failed to export PNG.");
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportAsSvg = useCallback(async () => {
    setIsExporting(true);
    const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!el) {
      setIsExporting(false);
      return;
    }

    try {
      const dataUrl = await toSvg(el, { backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `architecture-${Date.now()}.svg`;
      a.click();
    } catch {
      setValidationAlert("Failed to export SVG.");
    } finally {
      setIsExporting(false);
    }
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) || null,
    [edges, selectedEdgeId],
  );

  return (
    <div className="flex h-[78vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-2">
        <div className="flex items-center gap-1.5">
          {/* Undo Button */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-2xs"
          >
            <span>↶</span> Undo
          </button>

          {/* Redo Button */}
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-2xs"
          >
            <span>↷</span> Redo
          </button>

          <div className="mx-1 h-4 w-px bg-slate-300" />

          {/* Auto-Layout */}
          <button
            type="button"
            onClick={handleAutoLayout}
            title="Automatically arrange connected nodes"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-cyan-500 hover:text-cyan-700 shadow-2xs"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="6" height="6" x="3" y="3" rx="1" />
              <rect width="6" height="6" x="15" y="3" rx="1" />
              <rect width="6" height="6" x="9" y="15" rx="1" />
              <path d="M6 9v3a3 3 0 0 0 3 3h3" />
              <path d="M18 9v3a3 3 0 0 1-3 3" />
            </svg>
            Auto-Layout
          </button>

          {/* Group */}
          {selectedNodeIds.length > 1 ? (
            <button
              type="button"
              onClick={handleGroupSelected}
              className="rounded-lg bg-cyan-700 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-800 shadow-2xs"
            >
              Group ({selectedNodeIds.length})
            </button>
          ) : null}
        </div>

        {/* Right side: Export & Import */}
        <div className="flex items-center gap-1.5">
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={importJson}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs"
          >
            Import JSON
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs"
          >
            JSON
          </button>
          <button
            type="button"
            onClick={exportAsPng}
            disabled={isExporting}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs"
          >
            PNG
          </button>
          <button
            type="button"
            onClick={exportAsSvg}
            disabled={isExporting}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs"
          >
            SVG
          </button>
        </div>
      </div>

      {/* Intelligence & Alert Banners */}
      {validationAlert ? (
        <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
          <span>⚠️ {validationAlert}</span>
          <button type="button" onClick={() => setValidationAlert(null)} className="font-bold">
            ✕
          </button>
        </div>
      ) : null}

      {cycleInfo.hasCycle ? (
        <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-1.5 text-xs text-rose-800">
          <span className="font-bold">⚠️ Circular Dependency:</span>
          <span>{cycleInfo.cyclePath.join(" → ")}</span>
        </div>
      ) : null}

      {disconnected.count > 1 ? (
        <div className="flex items-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-xs text-sky-800">
          <span className="font-semibold">ℹ️ Architecture Topology:</span>
          <span>
            {disconnected.count} disconnected components detected. Connect isolated services to complete the pipeline.
          </span>
        </div>
      ) : null}

      {/* Main Workspace Area (Sidebar + Canvas + Inspector) */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Drag-and-Drop Palette */}
        <PaletteSidebar onAddShape={handleAddShape} />

        {/* Center React Flow Canvas */}
        <div
          className="relative flex-1 bg-slate-50"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {/* Live Collaborator Cursors Overlay */}
          <CollaboratorCursors collaborators={collaborators} currentUserId={currentUserId} />

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onInit={setRfInstance}
            onSelectionChange={onSelectionChange}
            multiSelectionKeyCode="Shift"
            selectionOnDrag
            panOnScroll
            fitView
            className="touch-none"
          >
            <MiniMap
              nodeStrokeWidth={3}
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
              }}
            />
            <Controls />
            <Background color="#94a3b8" gap={20} size={1} />
          </ReactFlow>
        </div>

        {/* Right Inspector Panel */}
        <InspectorPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onUpdateEdge={handleUpdateEdge}
          onDeleteEdge={handleDeleteEdge}
          onGroupSelected={handleGroupSelected}
          onUngroupContainer={handleUngroupContainer}
          selectedCount={selectedNodeIds.length}
        />
      </div>
    </div>
  );
}
