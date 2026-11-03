"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

type DiagramSummary = {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  updatedAt: string;
};

export default function WorkspaceHomePage() {
  const { user, loading, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [state, setState] = useState("loading");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadDiagrams = async () => {
    try {
      const list = await apiFetch<DiagramSummary[]>("/api/diagrams");
      setDiagrams(list);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    if (!mounted || loading) {
      return;
    }

    if (!user) {
      window.location.href = "/login";
      return;
    }

    void loadDiagrams();
  }, [mounted, loading, user]);

  const handleCreateDiagram = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const created = await apiFetch<{ id: string }>("/api/diagrams", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim() || "Untitled Architecture",
          description: newDescription.trim() || null,
        }),
      });
      router.push(`/workspace/${created.id}`);
    } catch {
      setState("error");
      setIsCreating(false);
    }
  };

  if (!mounted || loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Verifying authentication...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your Architecture Diagrams</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Signed in as <span className="font-semibold text-slate-800">{user.displayName || user.email}</span> ({user.email})
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setNewTitle("Cloud Native Microservices");
              setNewDescription("Kubernetes, API Gateway, and Distributed DBs");
              setShowCreateModal(true);
            }}
            className="cursor-pointer rounded-xl bg-cyan-700 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-800 shadow-sm transition"
          >
            + New Diagram
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.href = "/login";
            }}
            className="cursor-pointer rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {state === "error" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          Could not load diagram workspace. Please verify your connection.
        </div>
      ) : null}

      {/* Diagram Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {diagrams.map((diagram) => (
          <div
            key={diagram.id}
            onClick={() => router.push(`/workspace/${diagram.id}`)}
            className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-cyan-500 hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-800">
                  Architecture
                </span>
                <span className="text-[11px] text-slate-400">
                  {new Date(diagram.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <h2 className="mt-3 text-base font-bold text-slate-900 group-hover:text-cyan-800">
                {diagram.title}
              </h2>
              <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                {diagram.description || "No description provided."}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-cyan-700 font-semibold group-hover:underline">
              <span>Open Canvas →</span>
              <span className="text-[11px] text-slate-400 font-normal">Realtime Ready</span>
            </div>
          </div>
        ))}

        {state === "ready" && diagrams.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
            <h3 className="text-sm font-bold text-slate-800">No architecture diagrams yet</h3>
            <p className="mt-1 text-xs text-slate-500">
              Create your first diagram to start collaborating with real-time editing and live cursors.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-4 cursor-pointer rounded-xl bg-cyan-700 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-800 shadow-sm"
            >
              + Create First Diagram
            </button>
          </div>
        ) : null}
      </section>

      {/* Create Diagram Modal */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">Create New Architecture Diagram</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="cursor-pointer text-slate-400 hover:text-slate-600 font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDiagram} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Diagram Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Microservices Event-Driven Pipeline"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={3}
                  placeholder="e.g. System workflow between Next.js client, Fastify gateway, Redis pub/sub, and PostgreSQL storage."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="cursor-pointer rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="cursor-pointer rounded-lg bg-cyan-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-50 shadow-sm"
                >
                  {isCreating ? "Creating..." : "Create & Open"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
