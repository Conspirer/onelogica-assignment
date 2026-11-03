"use client";

import { memo } from "react";
import type { ShapeType } from "@onelogica/shared-types";

interface PaletteItem {
  shape: ShapeType;
  title: string;
  subtitle: string;
  defaultBg: string;
  defaultBorder: string;
  defaultText: string;
  icon: React.ReactNode;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    shape: "rectangle",
    title: "Microservice",
    subtitle: "Backend Service / API",
    defaultBg: "#f0fdf4",
    defaultBorder: "#16a34a",
    defaultText: "#14532d",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect width="18" height="18" x="3" y="3" rx="3" />
      </svg>
    ),
  },
  {
    shape: "rounded",
    title: "Client / App",
    subtitle: "Web / Mobile / UI",
    defaultBg: "#eff6ff",
    defaultBorder: "#2563eb",
    defaultText: "#1e3a8a",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect width="20" height="14" x="2" y="5" rx="7" />
      </svg>
    ),
  },
  {
    shape: "cylinder",
    title: "Database",
    subtitle: "PostgreSQL / Redis / Store",
    defaultBg: "#fef3c7",
    defaultBorder: "#d97706",
    defaultText: "#78350f",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    shape: "cloud",
    title: "Cloud Provider",
    subtitle: "AWS / GCP / Cloudflare",
    defaultBg: "#fdf4ff",
    defaultBorder: "#a855f7",
    defaultText: "#581c87",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      </svg>
    ),
  },
  {
    shape: "diamond",
    title: "Decision / Router",
    subtitle: "Gateway / Load Balancer",
    defaultBg: "#fff1f2",
    defaultBorder: "#e11d48",
    defaultText: "#881337",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 22 12 12 22 2 12" />
      </svg>
    ),
  },
  {
    shape: "container",
    title: "VPC / Container",
    subtitle: "Subsystem Boundary",
    defaultBg: "rgba(241, 245, 249, 0.6)",
    defaultBorder: "#64748b",
    defaultText: "#334155",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect width="18" height="18" x="3" y="3" rx="2" strokeDasharray="4 2" />
      </svg>
    ),
  },
];

interface PaletteSidebarProps {
  onAddShape: (item: PaletteItem) => void;
}

function PaletteSidebarComponent({ onAddShape }: PaletteSidebarProps) {
  const onDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData("application/reactflow-shape", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white p-3 shadow-xs">
      <div className="mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Components</h3>
        <p className="text-[11px] text-slate-400">Drag & drop or click to add</p>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto pr-1">
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.shape}
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            onClick={() => onAddShape(item)}
            className="group flex cursor-grab items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 transition hover:border-cyan-500 hover:bg-white hover:shadow-sm active:cursor-grabbing"
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs transition group-hover:scale-105"
              style={{
                backgroundColor: item.defaultBg,
                borderColor: item.defaultBorder,
                color: item.defaultBorder,
              }}
            >
              {item.icon}
            </div>
            <div className="flex flex-col overflow-hidden text-left">
              <span className="text-xs font-semibold text-slate-800 group-hover:text-cyan-800">
                {item.title}
              </span>
              <span className="text-[10px] text-slate-500 truncate">{item.subtitle}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export const PaletteSidebar = memo(PaletteSidebarComponent);
