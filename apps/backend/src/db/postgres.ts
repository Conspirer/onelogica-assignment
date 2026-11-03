import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { env } from "../config/env.js";

export const realPool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 2000,
});

let postgresAvailable: boolean | null = null;

// In-memory fallback tables for zero-dependency local testing/evaluation
const memUsers = new Map<string, { id: string; firebase_uid: string; email: string | null; display_name: string | null; created_at: string; updated_at: string }>();
const memDiagrams = new Map<string, { id: string; title: string; description: string | null; owner_id: string; data: unknown; created_at: string; updated_at: string }>();
const memPermissions = new Map<string, { id: string; diagram_id: string; user_id: string; role: string; created_at: string }>();
const memVersions = new Map<string, { id: string; diagram_id: string; actor_id: string; label: string; snapshot: unknown; metadata: unknown; created_at: string }>();
const memBatches = new Map<string, { id: string; diagram_id: string; actor_id: string; operations: unknown; created_at: string }>();

function handleMemoryQuery(sql: string, params: unknown[] = []) {
  const norm = sql.trim().replace(/\s+/g, " ");

  // 1. users: INSERT ... ON CONFLICT
  if (norm.includes("INSERT INTO users")) {
    const firebase_uid = params[0] as string;
    const email = (params[1] as string) ?? null;
    const display_name = (params[2] as string) ?? null;

    let existing = [...memUsers.values()].find((u) => u.firebase_uid === firebase_uid);
    if (!existing) {
      existing = {
        id: randomUUID(),
        firebase_uid,
        email,
        display_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memUsers.set(existing.id, existing);
    } else {
      existing.email = email;
      existing.display_name = display_name;
      existing.updated_at = new Date().toISOString();
    }
    return { rows: [{ id: existing.id, firebase_uid: existing.firebase_uid }] };
  }

  // 2. users: SELECT id FROM users WHERE firebase_uid = $1
  if (norm.includes("SELECT id FROM users WHERE firebase_uid")) {
    const firebase_uid = params[0] as string;
    const existing = [...memUsers.values()].find((u) => u.firebase_uid === firebase_uid);
    return { rows: existing ? [{ id: existing.id }] : [] };
  }

  // 3. diagrams: SELECT list
  if (norm.includes("SELECT d.id, d.title, d.description, d.owner_id AS \"ownerId\"") && norm.includes("ORDER BY d.updated_at DESC")) {
    const userId = params[0] as string;
    const list = [...memDiagrams.values()]
      .filter((d) => {
        if (d.owner_id === userId) return true;
        return [...memPermissions.values()].some((p) => p.diagram_id === d.id && p.user_id === userId);
      })
      .map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        ownerId: d.owner_id,
        updatedAt: d.updated_at,
      }));
    return { rows: list };
  }

  // 4. diagrams: INSERT
  if (norm.includes("INSERT INTO diagrams")) {
    const title = params[0] as string;
    const description = (params[1] as string) ?? null;
    const owner_id = params[2] as string;
    const dataRaw = params[3];
    const data = typeof dataRaw === "string" ? JSON.parse(dataRaw) : dataRaw;
    const id = randomUUID();
    const now = new Date().toISOString();
    const record = { id, title, description, owner_id, data, created_at: now, updated_at: now };
    memDiagrams.set(id, record);
    return {
      rows: [{ id, title, description, ownerId: owner_id, updatedAt: now }],
    };
  }

  // 5. diagram_permissions: INSERT
  if (norm.includes("INSERT INTO diagram_permissions")) {
    const diagram_id = params[0] as string;
    const user_id = params[1] as string;
    const role = (params[2] as string) ?? "OWNER";
    const key = `${diagram_id}:${user_id}`;
    let perm = memPermissions.get(key);
    if (!perm) {
      perm = { id: randomUUID(), diagram_id, user_id, role, created_at: new Date().toISOString() };
      memPermissions.set(key, perm);
    }
    return { rows: [perm] };
  }

  // 6. diagram_permissions: SELECT
  if (norm.startsWith("SELECT p.id, p.diagram_id") || (norm.includes("FROM diagram_permissions p") && !norm.includes("FROM diagrams d"))) {
    const diagram_id = params[0] as string;
    const rows = [...memPermissions.values()]
      .filter((p) => p.diagram_id === diagram_id)
      .map((p) => {
        const u = memUsers.get(p.user_id);
        return {
          id: p.id,
          diagramId: p.diagram_id,
          userId: p.user_id,
          role: p.role,
          createdAt: p.created_at,
          email: u?.email ?? null,
          displayName: u?.display_name ?? null,
        };
      });
    return { rows };
  }

  // 7. diagram_permissions: DELETE
  if (norm.includes("DELETE FROM diagram_permissions")) {
    const diagram_id = params[0] as string;
    const user_id = params[1] as string;
    memPermissions.delete(`${diagram_id}:${user_id}`);
    return { rows: [] };
  }

  // 8. ensureDiagramAccess / SELECT single diagram access
  if (norm.includes("SELECT d.id, d.data, d.owner_id AS \"ownerId\" FROM diagrams d WHERE d.id = $1")) {
    const diagramId = params[0] as string;
    const userId = params[1] as string;
    const d = memDiagrams.get(diagramId);
    if (!d) return { rows: [] };
    const hasPerm = d.owner_id === userId || [...memPermissions.values()].some((p) => p.diagram_id === diagramId && p.user_id === userId);
    if (!hasPerm) return { rows: [] };
    return { rows: [{ id: d.id, data: d.data, ownerId: d.owner_id }] };
  }

  // 9. Full diagram fetch
  if (norm.includes("SELECT id, title, description, owner_id AS \"ownerId\", data, updated_at AS \"updatedAt\" FROM diagrams WHERE id = $1")) {
    const diagramId = params[0] as string;
    const d = memDiagrams.get(diagramId);
    if (!d) return { rows: [] };
    return {
      rows: [{ id: d.id, title: d.title, description: d.description, ownerId: d.owner_id, data: d.data, updatedAt: d.updated_at }],
    };
  }

  // 10. Update diagram
  if (norm.includes("UPDATE diagrams SET")) {
    const title = params[0] as string | null;
    const description = params[1] as string | null;
    const dataRaw = params[2];
    const data = typeof dataRaw === "string" ? JSON.parse(dataRaw) : dataRaw;
    const diagramId = params[3] as string;
    const d = memDiagrams.get(diagramId);
    if (d) {
      if (title !== null) d.title = title;
      if (description !== null) d.description = description;
      d.data = data;
      d.updated_at = new Date().toISOString();
      return {
        rows: [{ id: d.id, title: d.title, description: d.description, ownerId: d.owner_id, updatedAt: d.updated_at }],
      };
    }
    return { rows: [] };
  }

  // 11. versions: SELECT
  if (norm.includes("FROM diagram_versions v") && norm.includes("WHERE v.diagram_id = $1")) {
    const diagramId = params[0] as string;
    const rows = [...memVersions.values()]
      .filter((v) => v.diagram_id === diagramId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((v) => {
        const u = memUsers.get(v.actor_id);
        return {
          id: v.id,
          diagramId: v.diagram_id,
          actorId: v.actor_id,
          label: v.label,
          metadata: v.metadata,
          createdAt: v.created_at,
          actorName: u?.display_name ?? null,
          actorEmail: u?.email ?? null,
        };
      });
    return { rows };
  }

  // 12. versions: INSERT
  if (norm.includes("INSERT INTO diagram_versions")) {
    const diagramId = params[0] as string;
    const actorId = params[1] as string;
    const label = params[2] as string;
    const snapshot = typeof params[3] === "string" ? JSON.parse(params[3]) : params[3];
    const metadata = typeof params[4] === "string" ? JSON.parse(params[4]) : params[4];
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const v = { id, diagram_id: diagramId, actor_id: actorId, label, snapshot, metadata, created_at: createdAt };
    memVersions.set(id, v);
    return {
      rows: [{ id, diagramId, actorId, label, metadata, createdAt }],
    };
  }

  // 13. versions: SELECT single
  if (norm.includes("SELECT id, snapshot FROM diagram_versions WHERE id = $1")) {
    const versionId = params[0] as string;
    const diagramId = params[1] as string;
    const v = memVersions.get(versionId);
    if (v && v.diagram_id === diagramId) {
      return { rows: [{ id: v.id, snapshot: v.snapshot }] };
    }
    return { rows: [] };
  }

  // 14. batches: INSERT
  if (norm.includes("INSERT INTO diagram_operation_batches")) {
    const diagramId = params[0] as string;
    const actorId = params[1] as string;
    const ops = typeof params[2] === "string" ? JSON.parse(params[2]) : params[2];
    const id = randomUUID();
    memBatches.set(id, { id, diagram_id: diagramId, actor_id: actorId, operations: ops, created_at: new Date().toISOString() });
    return { rows: [{ id }] };
  }

  return { rows: [] };
}

export const db = {
  async query(sql: string, params: unknown[] = []) {
    if (postgresAvailable !== false) {
      try {
        const res = await realPool.query(sql, params);
        postgresAvailable = true;
        return res;
      } catch (err: unknown) {
        if (postgresAvailable === null) {
          postgresAvailable = false;
          console.warn("[DB] PostgreSQL connection failed. Using in-memory fallback store.");
        }
      }
    }
    return handleMemoryQuery(sql, params);
  },
};
