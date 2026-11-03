"use client";

import { memo } from "react";
import type { Edge, Node } from "reactflow";
import type { CustomNodeData, ShapeType } from "@onelogica/shared-types";

interface InspectorPanelProps {
  selectedNode: Node<CustomNodeData> | null;
  selectedEdge: Edge | null;
  onUpdateNode: (nodeId: string, patch: Partial<CustomNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateEdge: (edgeId: string, label: string, styleType: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onGroupSelected: () => void;
  onUngroupContainer: (containerId: string) => void;
  selectedCount: number;
}

const COLOR_PRESETS = [
  { name: "Emerald", bg: "#f0fdf4", border: "#16a34a", text: "#14532d" },
  { name: "Blue", bg: "#eff6ff", border: "#2563eb", text: "#1e3a8a" },
  { name: "Amber", bg: "#fef3c7", border: "#d97706", text: "#78350f" },
  { name: "Purple", bg: "#fdf4ff", border: "#a855f7", text: "#581c87" },
  { name: "Rose", bg: "#fff1f2", border: "#e11d48", text: "#881337" },
  { name: "Slate", bg: "#f8fafc", border: "#475569", text: "#0f172a" },
];

function InspectorPanelComponent({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onDeleteNode,
  onUpdateEdge,
  onDeleteEdge,
  onGroupSelected,
  onUngroupContainer,
  selectedCount,
}: InspectorPanelProps) {
  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="flex w-72 flex-col border-l border-slate-200 bg-white p-4 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Inspector</h3>
        <p className="mt-4 text-xs text-slate-400">
          Select any node or connection on the canvas to inspect and customize its properties.
        </p>

        {selectedCount > 1 ? (
          <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3">
            <p className="text-xs font-semibold text-cyan-900">{selectedCount} elements selected</p>
            <button
              type="button"
              onClick={onGroupSelected}
              className="mt-2.5 w-full rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-800 shadow-2xs"
            >
              Group into Container
            </button>
          </div>
        ) : null}
      </aside>
    );
  }

  // 1. Edge Inspector
  if (selectedEdge) {
    return (
      <aside className="flex w-72 flex-col gap-4 border-l border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Connection</h3>
          <button
            type="button"
            onClick={() => onDeleteEdge(selectedEdge.id)}
            className="text-xs text-rose-600 hover:text-rose-800 font-medium"
          >
            Delete
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Connector Label</label>
          <input
            type="text"
            value={(selectedEdge.label as string) || ""}
            onChange={(e) => onUpdateEdge(selectedEdge.id, e.target.value, selectedEdge.type || "smoothstep")}
            placeholder="e.g. gRPC / Kafka / HTTP"
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-cyan-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Router Style</label>
          <select
            value={selectedEdge.type || "smoothstep"}
            onChange={(e) => onUpdateEdge(selectedEdge.id, (selectedEdge.label as string) || "", e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-cyan-500 focus:outline-hidden"
          >
            <option value="smoothstep">SmoothStep (Orthogonal)</option>
            <option value="bezier">Bezier (Curved)</option>
            <option value="straight">Straight Line</option>
          </select>
        </div>
      </aside>
    );
  }

  // 2. Node Inspector
  const data = selectedNode!.data;
  const isContainer = data.isContainer || data.shape === "container";

  return (
    <aside className="flex w-72 flex-col gap-3.5 border-l border-slate-200 bg-white p-4 shadow-xs overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {isContainer ? "Container" : "Node Properties"}
        </h3>
        <button
          type="button"
          onClick={() => onDeleteNode(selectedNode!.id)}
          className="text-xs text-rose-600 hover:text-rose-800 font-medium"
        >
          Delete
        </button>
      </div>

      {/* Label */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-700">Label</label>
        <input
          type="text"
          value={data.label || ""}
          onChange={(e) => onUpdateNode(selectedNode!.id, { label: e.target.value })}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-cyan-500 focus:outline-hidden"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-700">Description</label>
        <textarea
          rows={2}
          value={data.description || ""}
          onChange={(e) => onUpdateNode(selectedNode!.id, { description: e.target.value })}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-cyan-500 focus:outline-hidden resize-none"
        />
      </div>

      {/* Shape Selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-700">Shape</label>
        <select
          value={data.shape || "rectangle"}
          onChange={(e) => onUpdateNode(selectedNode!.id, { shape: e.target.value as ShapeType })}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-cyan-500 focus:outline-hidden"
        >
          <option value="rectangle">Rectangle (Microservice)</option>
          <option value="rounded">Rounded Pill (Client/UI)</option>
          <option value="diamond">Diamond (Decision/Gate)</option>
          <option value="cylinder">Cylinder (Database/Storage)</option>
          <option value="cloud">Cloud (Provider/API)</option>
          <option value="container">Container (Boundary Box)</option>
        </select>
      </div>

      {/* Color Presets */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-700">Color Presets</label>
        <div className="grid grid-cols-6 gap-1.5">
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              title={p.name}
              onClick={() =>
                onUpdateNode(selectedNode!.id, {
                  bgColor: p.bg,
                  borderColor: p.border,
                  textColor: p.text,
                })
              }
              className="h-7 w-7 rounded-md border shadow-2xs transition hover:scale-110"
              style={{ backgroundColor: p.bg, borderColor: p.border }}
            />
          ))}
        </div>
      </div>

      {/* Rotation Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700">Rotation</label>
          <span className="text-[11px] text-slate-500">{data.rotation || 0}°</span>
        </div>
        <input
          type="range"
          min="0"
          max="360"
          step="5"
          value={data.rotation || 0}
          onChange={(e) => onUpdateNode(selectedNode!.id, { rotation: Number(e.target.value) })}
          className="h-1.5 w-full cursor-pointer accent-cyan-600"
        />
      </div>

      {/* Container Ungroup Action */}
      {isContainer ? (
        <button
          type="button"
          onClick={() => onUngroupContainer(selectedNode!.id)}
          className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Ungroup Container
        </button>
      ) : null}
    </aside>
  );
}

export const InspectorPanel = memo(InspectorPanelComponent);
