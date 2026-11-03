import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-100">
      {/* Navigation */}
      <nav className="flex items-center justify-between border-b border-slate-800 px-8 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 font-black text-white">
            O
          </div>
          <span className="text-lg font-bold tracking-tight text-white">Onelogica</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Sign In
          </Link>
          <Link
            href="/workspace"
            className="rounded-lg bg-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 shadow-sm"
          >
            Launch Workspace
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 text-xs font-semibold text-cyan-400">
          Realtime Collaborative Architecture Designer
        </span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl text-white">
          Design System Architectures <br className="hidden sm:inline" />
          <span className="text-cyan-400">Together in Real Time</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base text-slate-400 sm:text-lg">
          Create, edit, and manage technical architecture diagrams, flowcharts, and workflows.
          Inspired by Excalidraw, Miro, and Draw.io with live multiplayer cursors, graph intelligence,
          and version history.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/workspace"
            className="rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-500 shadow-md transition"
          >
            Open Interactive Canvas →
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            Multiplayer Demo Login
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-500/30 text-lg">
              ⚡
            </div>
            <h3 className="mt-4 text-sm font-bold text-white">Live Multiplayer Collaboration</h3>
            <p className="mt-2 text-xs text-slate-400">
              Real-time cursor broadcasting, WebSocket synchronization, conflict-safe last-write-wins merging, and disconnection auto-reconnect.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-lg">
              🧠
            </div>
            <h3 className="mt-4 text-sm font-bold text-white">Graph Intelligence Engine</h3>
            <p className="mt-2 text-xs text-slate-400">
              Automatic topological hierarchical layout, cycle and circular dependency detection, disconnected component analysis, and grouping containers.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-950 text-purple-400 border border-purple-500/30 text-lg">
              🕒
            </div>
            <h3 className="mt-4 text-sm font-bold text-white">Immutable Version History</h3>
            <p className="mt-2 text-xs text-slate-400">
              Snapshot creation with metadata, instant rollback/restore with room broadcast, and efficient batched operation persistence.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        Onelogica — Built with Next.js, Fastify, React Flow, WebSockets & PostgreSQL
      </footer>
    </div>
  );
}
