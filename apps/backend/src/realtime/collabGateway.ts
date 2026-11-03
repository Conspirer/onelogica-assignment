import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { db } from "../db/postgres.js";
import { verifyFirebaseToken } from "../auth/firebase.js";
import { createOperationBatcher } from "./operationBatcher.js";

type Client = {
  id: string;
  userId: string;
  displayName: string;
  color: string;
  cursor: { x: number; y: number } | null;
  socket: {
    send: (payload: string) => void;
    on: (event: "message" | "close", cb: (data?: Buffer) => void) => void;
    close: () => void;
  };
};

const USER_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#9333ea", // purple
  "#ea580c", // orange
  "#db2777", // pink
  "#0891b2", // cyan
  "#d97706", // amber
  "#4f46e5", // indigo
];

const rooms = new Map<string, Map<string, Client>>();
const operationBatcher = createOperationBatcher((sql, params) => db.query(sql, params));

function broadcast(diagramId: string, payload: unknown, exceptClientId?: string) {
  const room = rooms.get(diagramId);
  if (!room) {
    return;
  }

  const json = JSON.stringify(payload);
  for (const [clientId, client] of room.entries()) {
    if (exceptClientId && clientId === exceptClientId) {
      continue;
    }
    try {
      client.socket.send(json);
    } catch {
      // ignore broken socket
    }
  }
}

async function findOrCreateUserIdByFirebaseUid(firebaseUid: string, email?: string, name?: string): Promise<string> {
  const user = await db.query(
    `
      INSERT INTO users (firebase_uid, email, display_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name
      RETURNING id
    `,
    [firebaseUid, email ?? null, name ?? null],
  );

  return user.rows[0].id as string;
}

async function hasDiagramAccess(userId: string, diagramId: string): Promise<boolean> {
  const diagram = await db.query(
    `
      SELECT d.id
      FROM diagrams d
      WHERE d.id = $1
        AND (
          d.owner_id = $2
          OR EXISTS (
            SELECT 1 FROM diagram_permissions p
            WHERE p.diagram_id = d.id AND p.user_id = $2
          )
        )
      LIMIT 1
    `,
    [diagramId, userId],
  );

  return Boolean(diagram.rows.length);
}

export async function registerCollabGateway(app: FastifyInstance) {
  app.addHook("onClose", async () => {
    await operationBatcher.stop();
  });

  app.register(async (instance) => {
    instance.get("/ws/diagrams/:diagramId", { websocket: true }, async (socket, request) => {
      const diagramId = (request.params as { diagramId: string }).diagramId;
      const token = (request.query as { token?: string }).token;

      if (!token) {
        socket.close();
        return;
      }

      let decoded;
      try {
        decoded = await verifyFirebaseToken(token);
      } catch {
        socket.close();
        return;
      }

      const userId = await findOrCreateUserIdByFirebaseUid(decoded.uid, decoded.email, decoded.name);
      const allowed = await hasDiagramAccess(userId, diagramId);
      if (!allowed) {
        socket.close();
        return;
      }

      const room = rooms.get(diagramId) ?? new Map<string, Client>();
      rooms.set(diagramId, room);

      const clientId = randomUUID();
      const color = USER_COLORS[room.size % USER_COLORS.length];
      const displayName = decoded.name ?? decoded.email?.split("@")[0] ?? "Collaborator";

      const currentClient: Client = {
        id: clientId,
        userId: decoded.uid,
        displayName,
        color,
        cursor: null,
        socket,
      };

      room.set(clientId, currentClient);

      // Send initial presence to everyone in the room
      broadcast(diagramId, {
        type: "presence",
        payload: {
          users: [...room.values()].map((c) => ({
            id: c.id,
            userId: c.userId,
            displayName: c.displayName,
            color: c.color,
            cursor: c.cursor,
          })),
        },
      });

      socket.on("message", async (raw: Buffer) => {
        let envelope: { type?: string; payload?: Record<string, unknown> };
        try {
          envelope = JSON.parse(raw.toString());
        } catch {
          return;
        }

        // 1. Live Cursors
        if (envelope.type === "cursor") {
          const cursor = envelope.payload?.cursor as { x: number; y: number } | null;
          currentClient.cursor = cursor;

          broadcast(
            diagramId,
            {
              type: "cursor",
              payload: {
                clientId,
                userId: currentClient.userId,
                displayName: currentClient.displayName,
                color: currentClient.color,
                cursor,
              },
            },
            clientId,
          );
          return;
        }

        // 2. Synchronize Operations (Move, Add, Delete, Connect, Resize, Rotate, etc.)
        if (envelope.type === "operation") {
          const op = envelope.payload ?? {};
          const timestamp = (op.timestamp as string) || new Date().toISOString();

          void operationBatcher.queueOperation({
            diagramId,
            actorId: userId,
            operation: {
              opId: (op.opId as string) || randomUUID(),
              timestamp,
              payload: op,
            },
          });

          broadcast(
            diagramId,
            {
              type: "operation",
              payload: {
                ...op,
                fromClientId: clientId,
                actorId: userId,
                actorName: currentClient.displayName,
                timestamp,
              },
            },
            clientId,
          );
          return;
        }

        // 3. Sync Request (e.g. on client reconnect after 30s)
        if (envelope.type === "sync-request") {
          const latest = await db.query(
            `SELECT data, updated_at FROM diagrams WHERE id = $1 LIMIT 1`,
            [diagramId],
          );
          if (latest.rows[0]) {
            socket.send(
              JSON.stringify({
                type: "sync-state",
                payload: {
                  data: latest.rows[0].data,
                  updatedAt: latest.rows[0].updated_at,
                },
              }),
            );
          }
          return;
        }

        // 4. Restore Version
        if (envelope.type === "restore") {
          broadcast(
            diagramId,
            {
              type: "restore",
              payload: {
                snapshot: envelope.payload?.snapshot,
                restoredBy: currentClient.displayName,
              },
            },
            clientId,
          );
          return;
        }
      });

      socket.on("close", () => {
        const existingRoom = rooms.get(diagramId);
        if (!existingRoom) {
          return;
        }

        existingRoom.delete(clientId);
        if (existingRoom.size === 0) {
          rooms.delete(diagramId);
          return;
        }

        broadcast(diagramId, {
          type: "presence",
          payload: {
            users: [...existingRoom.values()].map((c) => ({
              id: c.id,
              userId: c.userId,
              displayName: c.displayName,
              color: c.color,
              cursor: c.cursor,
            })),
          },
        });
      });
    });
  });
}
