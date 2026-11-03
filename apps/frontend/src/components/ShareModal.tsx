"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface CollaboratorItem {
  id: string;
  diagramId: string;
  userId: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  createdAt: string;
  email: string | null;
  displayName: string | null;
}

interface ShareModalProps {
  diagramId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ diagramId, isOpen, onClose }: ShareModalProps) {
  const [collaborators, setCollaborators] = useState<CollaboratorItem[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPermissions = async () => {
    try {
      const res = await apiFetch<{ ownerId: string; permissions: CollaboratorItem[] }>(
        `/api/diagrams/${diagramId}/permissions`,
      );
      setCollaborators(res.permissions);
    } catch {
      setError("Failed to load collaborator list.");
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadPermissions();
    }
  }, [isOpen, diagramId]);

  if (!isOpen) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);

    try {
      await apiFetch(`/api/diagrams/${diagramId}/permissions`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      setEmail("");
      await loadPermissions();
    } catch (err: unknown) {
      setError("Could not add collaborator. Ensure you are the owner.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    try {
      await apiFetch(`/api/diagrams/${diagramId}/permissions/${userId}`, {
        method: "DELETE",
      });
      await loadPermissions();
    } catch {
      setError("Failed to revoke collaborator permission.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-bold text-slate-900">Share Diagram</h2>
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

        <form onSubmit={handleInvite} className="mt-4 flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-700">Invite by Email</label>
          <div className="flex gap-2">
            <input
              type="email"
              required
              placeholder="collaborator@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-cyan-500 focus:outline-hidden"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "EDITOR" | "VIEWER")}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-cyan-500 focus:outline-hidden"
            >
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
            >
              Invite
            </button>
          </div>
        </form>

        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Collaborators</h3>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {collaborators.length === 0 ? (
              <p className="text-xs text-slate-400">No collaborators added yet.</p>
            ) : (
              collaborators.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {c.displayName || c.email || "Unknown User"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {c.email} • <span className="font-medium text-cyan-800">{c.role}</span>
                    </p>
                  </div>
                  {c.role !== "OWNER" ? (
                    <button
                      type="button"
                      onClick={() => handleRevoke(c.userId)}
                      className="text-xs text-rose-600 hover:text-rose-800"
                    >
                      Remove
                    </button>
                  ) : null}
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
