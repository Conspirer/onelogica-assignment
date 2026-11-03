"use client";

import { memo } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "reactflow";
import type { CustomNodeData } from "@onelogica/shared-types";

function ArchitectureNodeComponent({ data, selected }: NodeProps<CustomNodeData>) {
  const shape = data.shape || "rectangle";
  const label = data.label || "Node";
  const description = data.description || "";
  const bgColor = data.bgColor || "#ffffff";
  const borderColor = data.borderColor || "#64748b";
  const textColor = data.textColor || "#0f172a";
  const rotation = data.rotation || 0;
  const isContainer = data.isContainer || shape === "container";

  // Common handle styles
  const handleStyle = {
    background: borderColor,
    width: 8,
    height: 8,
    border: "2px solid #ffffff",
    borderRadius: "50%",
  };

  const transformStyle = rotation ? `rotate(${rotation}deg)` : undefined;

  // 1. Container / Subsystem Boundary
  if (isContainer) {
    return (
      <div
        className="group relative h-full w-full rounded-2xl border-2 border-dashed p-4 transition-all"
        style={{
          borderColor,
          backgroundColor: bgColor,
          transform: transformStyle,
        }}
      >
        <NodeResizer minWidth={200} minHeight={120} isVisible={selected} lineClassName="border-blue-500" />
        <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: `${borderColor}40` }}>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider" style={{ color: borderColor }}>
              Container
            </span>
            <span className="text-sm font-semibold" style={{ color: textColor }}>
              {label}
            </span>
          </div>
          {description ? (
            <span className="text-xs text-slate-500">{description}</span>
          ) : null}
        </div>

        <Handle type="target" position={Position.Top} style={handleStyle} />
        <Handle type="source" position={Position.Bottom} style={handleStyle} />
        <Handle type="target" position={Position.Left} style={handleStyle} />
        <Handle type="source" position={Position.Right} style={handleStyle} />
      </div>
    );
  }

  // 2. Diamond / Decision Node
  if (shape === "diamond") {
    return (
      <div
        className="relative flex items-center justify-center p-3 transition-transform"
        style={{ transform: transformStyle }}
      >
        <NodeResizer minWidth={100} minHeight={80} isVisible={selected} lineClassName="border-blue-500" />
        <div
          className="flex min-h-[90px] min-w-[130px] flex-col items-center justify-center rounded-lg border-2 p-4 shadow-sm"
          style={{
            borderColor,
            backgroundColor: bgColor,
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
            transform: "scale(1)",
          }}
        >
          <div className="text-center">
            <div className="text-xs font-bold" style={{ color: textColor }}>
              {label}
            </div>
            {description && (
              <div className="mt-0.5 text-[10px] text-slate-600 line-clamp-1">{description}</div>
            )}
          </div>
        </div>

        <Handle type="target" position={Position.Top} style={handleStyle} />
        <Handle type="source" position={Position.Right} style={handleStyle} />
        <Handle type="source" position={Position.Bottom} style={handleStyle} />
        <Handle type="target" position={Position.Left} style={handleStyle} />
      </div>
    );
  }

  // 3. Cylinder / Database Node
  if (shape === "cylinder") {
    return (
      <div
        className="relative flex flex-col items-center p-1 transition-transform"
        style={{ transform: transformStyle }}
      >
        <NodeResizer minWidth={120} minHeight={70} isVisible={selected} lineClassName="border-blue-500" />
        <div
          className="relative flex min-h-[76px] min-w-[140px] flex-col items-center justify-center rounded-xl border-2 px-4 py-3 shadow-sm"
          style={{
            borderColor,
            backgroundColor: bgColor,
          }}
        >
          {/* Top cylinder rim */}
          <div
            className="absolute -top-2 h-4 w-full rounded-[50%] border-2"
            style={{ borderColor, backgroundColor: bgColor }}
          />
          <div className="mt-1 flex items-center gap-1.5">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke={borderColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            <span className="text-xs font-bold" style={{ color: textColor }}>
              {label}
            </span>
          </div>
          {description && (
            <div className="mt-0.5 text-[11px] text-slate-600 line-clamp-1">{description}</div>
          )}
        </div>

        <Handle type="target" position={Position.Top} style={handleStyle} />
        <Handle type="source" position={Position.Right} style={handleStyle} />
        <Handle type="source" position={Position.Bottom} style={handleStyle} />
        <Handle type="target" position={Position.Left} style={handleStyle} />
      </div>
    );
  }

  // 4. Cloud / Network Node
  if (shape === "cloud") {
    return (
      <div
        className="relative flex flex-col items-center p-1 transition-transform"
        style={{ transform: transformStyle }}
      >
        <NodeResizer minWidth={130} minHeight={80} isVisible={selected} lineClassName="border-blue-500" />
        <div
          className="flex min-h-[80px] min-w-[150px] flex-col items-center justify-center rounded-[28px] border-2 px-4 py-3 shadow-sm"
          style={{
            borderColor,
            backgroundColor: bgColor,
          }}
        >
          <div className="flex items-center gap-1.5">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke={borderColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            </svg>
            <span className="text-xs font-bold" style={{ color: textColor }}>
              {label}
            </span>
          </div>
          {description && (
            <div className="mt-0.5 text-[11px] text-slate-600 line-clamp-1">{description}</div>
          )}
        </div>

        <Handle type="target" position={Position.Top} style={handleStyle} />
        <Handle type="source" position={Position.Right} style={handleStyle} />
        <Handle type="source" position={Position.Bottom} style={handleStyle} />
        <Handle type="target" position={Position.Left} style={handleStyle} />
      </div>
    );
  }

  // 5. Standard Rectangle or Rounded Box
  const isRounded = shape === "rounded";

  return (
    <div
      className="relative flex flex-col items-center p-1 transition-transform"
      style={{ transform: transformStyle }}
    >
      <NodeResizer minWidth={110} minHeight={60} isVisible={selected} lineClassName="border-blue-500" />
      <div
        className={`flex min-h-[64px] min-w-[140px] flex-col justify-center border-2 px-3 py-2.5 shadow-sm transition-shadow ${
          isRounded ? "rounded-full px-5 text-center" : "rounded-xl"
        } ${selected ? "ring-2 ring-blue-400" : ""}`}
        style={{
          borderColor,
          backgroundColor: bgColor,
        }}
      >
        <div className="text-xs font-bold" style={{ color: textColor }}>
          {label}
        </div>
        {description && (
          <div className="mt-0.5 text-[11px] text-slate-600 line-clamp-1">{description}</div>
        )}
      </div>

      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
    </div>
  );
}

export const ArchitectureNode = memo(ArchitectureNodeComponent);
