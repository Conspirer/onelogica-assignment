"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Edge, Node } from "reactflow";
import type { CollaboratorPresence } from "@onelogica/shared-types";
import { useAuth } from "@/components/AuthProvider";
import { DiagramEditor } from "@/components/DiagramEditor";
import { ShareModal } from "@/components/ShareModal";
import { VersionHistoryModal } from "@/components/VersionHistoryModal";
import { apiFetch } from "@/lib/api";

type DiagramPayload = {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  data: {
    nodes: Node[];
    edges: Edge[];
  };
};

export function CollaborativeWorkspace({ diagramId }: { diagramId: string }) {
  const { user, getIdToken } = useAuth();
  const [onlineCollaborators, setOnlineCollaborators] = useState<CollaboratorPresence[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "reconnecting">("connecting");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [diagram, setDiagram] = useState<DiagramPayload | null>(null);
  const [latestRemoteOp, setLatestRemoteOp] = useState<{ type: string; [key: string]: unknown } | null>(null);

  // Modals state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);

  // References
  const socketRef = useRef<WebSocket | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSnapshotRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });

  const wsUrl = useMemo(() => {
    const backend = process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8080";
    return `${backend}/ws/diagrams/${diagramId}`;
  }, [diagramId]);

  // Connect & Reconnect WebSocket with backoff (Edge Case 3: Reconnection after 30s)
  const connectWebSocket = useCallback(async () => {
    let token = await getIdToken();
    if (!token && user) {
      token = `dev-token:${user.uid}:${user.email || ""}:${user.displayName || "User"}`;
    }
    if (!token) {
      return;
    }

    try {
      const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0;

        // Request latest state in case operations occurred while disconnected
        socket.send(JSON.stringify({ type: "sync-request" }));
      };

      socket.onclose = () => {
        setConnectionStatus("disconnected");
        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, up to 15s
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000);
        reconnectAttemptsRef.current += 1;

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          setConnectionStatus("reconnecting");
          void connectWebSocket();
        }, backoffMs);
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onmessage = (event) => {
        let envelope: { type: string; payload: Record<string, unknown> };
        try {
          envelope = JSON.parse(event.data);
        } catch {
          return;
        }

        // 1. Presence Updates
        if (envelope.type === "presence") {
          const users = (envelope.payload.users as CollaboratorPresence[]) || [];
          setOnlineCollaborators(users);
        }

        // 2. Live Cursor Move from a Collaborator
        else if (envelope.type === "cursor") {
          const cursorPayload = envelope.payload as unknown as {
            clientId: string;
            userId: string;
            displayName: string;
            color: string;
            cursor: { x: number; y: number } | null;
          };

          setOnlineCollaborators((prev) => {
            const idx = prev.findIndex((c) => c.id === cursorPayload.clientId || c.userId === cursorPayload.userId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                color: cursorPayload.color,
                cursor: cursorPayload.cursor,
              };
              return updated;
            }
            return [
              ...prev,
              {
                id: cursorPayload.clientId,
                userId: cursorPayload.userId,
                displayName: cursorPayload.displayName,
                color: cursorPayload.color,
                cursor: cursorPayload.cursor,
              },
            ];
          });
        }

        // 3. Real-Time Operations from Collaborator
        else if (envelope.type === "operation") {
          setLatestRemoteOp(envelope.payload as { type: string; [key: string]: unknown });
        }

        // 4. Sync State from Server (disconnection recovery)
        else if (envelope.type === "sync-state") {
          const syncData = envelope.payload.data as { nodes: Node[]; edges: Edge[] };
          if (syncData && syncData.nodes) {
            setDiagram((d) => (d ? { ...d, data: syncData } : null));
          }
        }

        // 5. Restore Event from Collaborator
        else if (envelope.type === "restore") {
          const snapshot = envelope.payload.snapshot as { nodes: Node[]; edges: Edge[] };
          if (snapshot) {
            setLatestRemoteOp({
              type: "BATCH_UPDATE",
              nodes: snapshot.nodes,
              edges: snapshot.edges,
            });
          }
        }
      };
    } catch {
      setConnectionStatus("disconnected");
    }
  }, [getIdToken, user, wsUrl]);

  useEffect(() => {
    void connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.close();
    };
  }, [connectWebSocket]);

  // Load Diagram from API
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await apiFetch<DiagramPayload>(`/api/diagrams/${diagramId}`);
        if (!cancelled) {
          setDiagram(loaded);
          currentSnapshotRef.current = loaded.data;
        }
      } catch {
        if (!cancelled) {
          setSaveStatus("error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [diagramId]);

  // Handle Operations to send via WebSocket (Fast path: batched writes)
  const handleOperation = useCallback((op: Record<string, unknown>) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    socketRef.current.send(
      JSON.stringify({
        type: "operation",
        payload: op,
      }),
    );
  }, []);

  // Handle Cursors to send via WebSocket
  const handleCursorMove = useCallback((cursor: { x: number; y: number } | null) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    socketRef.current.send(
      JSON.stringify({
        type: "cursor",
        payload: { cursor },
      }),
    );
  }, []);

  // Debounced Save to Database (Activity 6 Scenario 7)
  const handleSnapshotChange = useCallback(
    (data: { nodes: Node[]; edges: Edge[] }) => {
      currentSnapshotRef.current = data;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      setSaveStatus("saving");
      saveTimerRef.current = setTimeout(async () => {
        try {
          await apiFetch(`/api/diagrams/${diagramId}`, {
            method: "PUT",
            body: JSON.stringify({
              data,
              title: diagram?.title,
              description: diagram?.description ?? null,
            }),
          });
          setSaveStatus("saved");
        } catch {
          setSaveStatus("error");
        }
      }, 1200);
    },
    [diagram?.description, diagram?.title, diagramId],
  );

  // Handle Restore
  const handleRestoreVersion = useCallback(
    (snapshot: { nodes: Node[]; edges: Edge[] }) => {
      setLatestRemoteOp({
        type: "BATCH_UPDATE",
        nodes: snapshot.nodes,
        edges: snapshot.edges,
      });

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "restore",
            payload: { snapshot },
          }),
        );
      }
    },
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Workspace Header Status Bar */}
      <div className="flex flex-wrap items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-3">
          {/* Connection Indicator */}
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : connectionStatus === "reconnecting"
                  ? "bg-amber-500 animate-bounce"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              {connectionStatus === "connected" ? "Realtime Live" : connectionStatus}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Active Collaborators Avatars */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Collaborators ({onlineCollaborators.length}):</span>
            <div className="flex -space-x-1.5 overflow-hidden">
              {onlineCollaborators.map((c) => (
                <div
                  key={c.id || c.userId}
                  title={c.displayName}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-2xs border-2 border-white uppercase"
                  style={{ backgroundColor: c.color || "#3b82f6" }}
                >
                  {c.displayName ? c.displayName.charAt(0) : "U"}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Actions: Save Status, Version History & Share */}
        <div className="flex items-center gap-2">
          {/* Save Status Pill */}
          <span className="text-xs text-slate-500 font-medium">
            {saveStatus === "saving" ? "Saving changes..." : saveStatus === "saved" ? "✓ All changes saved" : ""}
          </span>

          {/* Version History Button */}
          <button
            type="button"
            onClick={() => setIsVersionOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-cyan-800 shadow-2xs"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            History
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 shadow-2xs"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
        </div>
      </div>

      {/* Main Diagram Canvas */}
      <DiagramEditor
        initialData={diagram?.data ?? null}
        onSnapshotChange={handleSnapshotChange}
        onOperation={handleOperation}
        collaborators={onlineCollaborators}
        currentUserId={user?.uid}
        onCursorMove={handleCursorMove}
        remoteOperation={latestRemoteOp}
      />

      {/* Share Collaborators Modal */}
      <ShareModal
        diagramId={diagramId}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        diagramId={diagramId}
        isOpen={isVersionOpen}
        onClose={() => setIsVersionOpen(false)}
        onRestore={handleRestoreVersion}
        currentSnapshot={currentSnapshotRef.current}
      />
    </div>
  );
}
