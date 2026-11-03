"use client";

import { useEffect, useState } from "react";
import type { Edge, Node } from "reactflow";
import { apiFetch } from "@/lib/api";

export interface VersionItem {
  id: string;
  diagramId: string;
  actorId: string;
  label: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
}

interface VersionHistoryModalProps {
  diagramId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (snapshot: { nodes: Node[]; edges: Edge[] }) => void;
  currentSnapshot: { nodes: Node[]; edges: Edge[] };
}

export function VersionHistoryModal({
  diagramId,
  isOpen,
  onClose,
  onRestore,
  currentSnapshot,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = async () => {
    try {
      const res = await apiFetch<VersionItem[]>(`/api/diagrams/${diagramId}/versions`);
      setVersions(res);
    } catch {
      setError("Failed to load version history.");
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadVersions();
    }
  }, [isOpen, diagramId]);

  if (!isOpen) return null;

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiFetch(`/api/diagrams/${diagramId}/versions`, {
        method: "POST",
        body: JSON.stringify({
          label: snapshotLabel.trim() || `Snapshot ${new Date().toLocaleTimeString()}`,
          metadata: {
            nodeCount: currentSnapshot.nodes.length,
            edgeCount: currentSnapshot.edges.length,
          },
        }),
      });
      setSnapshotLabel("");
      await loadVersions();
    } catch {
      setError("Failed to create snapshot.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    if (!confirm("Are you sure you want to restore this version? Any unsaved edits will be replaced.")) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<{
        restored: boolean;
        snapshot: { nodes: Node[]; edges: Edge[] };
      }>(`/api/diagrams/${diagramId}/versions/${versionId}/restore`, {
        method: "POST",
      });

      if (res.snapshot) {
        onRestore(res.snapshot);
        onClose();
      }
    } catch {
      setError("Failed to restore version.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Version History</h2>
            <p className="text-xs text-slate-500">Track and restore previous diagram states</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-semibold"
          >
            ✕
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        {/* Snapshot creation form */}
        <form onSubmit={handleCreateSnapshot} className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="Version name (e.g. Pre-migration architecture)"
            value={snapshotLabel}
            onChange={(e) => setSnapshotLabel(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-cyan-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
          >
            Save Snapshot
          </button>
        </form>

        {/* Version List */}
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Past Versions</h3>
          <div className="mt-2 max-h-64 space-y-2.5 overflow-y-auto pr-1">
            {versions.length === 0 ? (
              <p className="text-xs text-slate-400">No versions saved yet.</p>
            ) : (
              versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition hover:bg-slate-50"
                >
                  <div className="overflow-hidden pr-2">
                    <p className="text-xs font-bold text-slate-900 truncate">{v.label}</p>
                    <p className="text-[11px] text-slate-500">
                      by {v.actorName || v.actorEmail || "Collaborator"} • {new Date(v.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(v.id)}
                    disabled={loading}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-cyan-700 shadow-2xs"
                  >
                    Restore
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
