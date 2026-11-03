"use client";

import { Suspense, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CollaborativeWorkspace } from "@/components/CollaborativeWorkspace";
import { useAuth } from "@/components/AuthProvider";

function WorkspacePageContent({
  params,
}: {
  params: Promise<{ diagramId: string }> | { diagramId: string };
}) {
  const resolvedParams = "then" in params ? use(params) : params;
  const diagramId = resolvedParams.diagramId;
  const { user, loading, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) {
      return;
    }

    if (!user) {
      window.location.href = "/login";
    }
  }, [mounted, loading, user]);

  if (!mounted || loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Verifying session...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5">
      <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/workspace"
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            ← Diagrams
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <h1 className="text-sm font-bold text-slate-900">Architecture Canvas</h1>
            <p className="text-[11px] text-slate-400 font-mono">ID: {diagramId}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden sm:inline">
            Logged in as <strong className="text-slate-700">{user.displayName || user.email}</strong>
          </span>
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.href = "/login";
            }}
            className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      <CollaborativeWorkspace diagramId={diagramId} />
    </main>
  );
}

export default function WorkspacePage(props: {
  params: Promise<{ diagramId: string }> | { diagramId: string };
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-600">Loading canvas workspace...</p>
        </div>
      }
    >
      <WorkspacePageContent {...props} />
    </Suspense>
  );
}
