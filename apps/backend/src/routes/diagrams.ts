import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/postgres.js";
import { requireAuth } from "../auth/verify.js";

const createDiagramSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
});

const createVersionSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateDiagramSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  data: z.record(z.string(), z.unknown()),
});

const shareDiagramSchema = z.object({
  email: z.string().email(),
  role: z.enum(["EDITOR", "VIEWER"]),
});

const diagramIdParamSchema = z.object({
  diagramId: z.string().uuid(),
});

const restoreParamsSchema = z.object({
  diagramId: z.string().uuid(),
  versionId: z.string().uuid(),
});

const deletePermissionParamsSchema = z.object({
  diagramId: z.string().uuid(),
  userId: z.string().uuid(),
});

async function ensureUserRecord(uid: string, email?: string, name?: string) {
  const inserted = await db.query(
    `
      INSERT INTO users (firebase_uid, email, display_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name
      RETURNING id, firebase_uid
    `,
    [uid, email ?? null, name ?? null],
  );

  return inserted.rows[0] as { id: string; firebase_uid: string };
}

async function ensureDiagramAccess(diagramId: string, userId: string) {
  const result = await db.query(
    `
      SELECT d.id, d.data, d.owner_id AS "ownerId"
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

  return result.rows[0] as
    | {
        id: string;
        data: unknown;
        ownerId: string;
      }
    | undefined;
}

export async function registerDiagramRoutes(app: FastifyInstance) {
  // 1. List user's diagrams
  app.get("/api/diagrams", { preHandler: requireAuth }, async (request, reply) => {
    const authUser = request.authUser;
    if (!authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const user = await ensureUserRecord(authUser.uid, authUser.email, authUser.name);

    const diagrams = await db.query(
      `
        SELECT d.id, d.title, d.description, d.owner_id AS "ownerId", d.updated_at AS "updatedAt"
        FROM diagrams d
        WHERE d.owner_id = $1
           OR EXISTS (
             SELECT 1 FROM diagram_permissions p
             WHERE p.diagram_id = d.id AND p.user_id = $1
           )
        ORDER BY d.updated_at DESC
      `,
      [user.id],
    );

    return diagrams.rows;
  });

  // 2. Create new diagram
  app.post("/api/diagrams", { preHandler: requireAuth }, async (request, reply) => {
    const authUser = request.authUser;
    if (!authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const payload = createDiagramSchema.parse(request.body);
    const user = await ensureUserRecord(authUser.uid, authUser.email, authUser.name);

    const diagram = await db.query(
      `
        INSERT INTO diagrams (title, description, owner_id, data)
        VALUES ($1, $2, $3, $4::jsonb)
        RETURNING id, title, description, owner_id AS "ownerId", updated_at AS "updatedAt"
      `,
      [
        payload.title,
        payload.description ?? null,
        user.id,
        JSON.stringify({
          nodes: [
            {
              id: "node-1",
              type: "architectureNode",
              position: { x: 250, y: 150 },
              data: {
                label: "API Gateway",
                description: "Reverse Proxy & Load Balancer",
                shape: "rectangle",
                bgColor: "#f0fdf4",
                borderColor: "#16a34a",
                textColor: "#14532d",
              },
            },
            {
              id: "node-2",
              type: "architectureNode",
              position: { x: 550, y: 150 },
              data: {
                label: "Core Service",
                description: "Fastify / Node.js Engine",
                shape: "rounded",
                bgColor: "#eff6ff",
                borderColor: "#2563eb",
                textColor: "#1e3a8a",
              },
            },
            {
              id: "node-3",
              type: "architectureNode",
              position: { x: 550, y: 350 },
              data: {
                label: "PostgreSQL DB",
                description: "Persistent Diagram Store",
                shape: "cylinder",
                bgColor: "#fef3c7",
                borderColor: "#d97706",
                textColor: "#78350f",
              },
            },
          ],
          edges: [
            {
              id: "edge-1-2",
              source: "node-1",
              target: "node-2",
              type: "smoothstep",
              animated: true,
              label: "HTTP / WS",
            },
            {
              id: "edge-2-3",
              source: "node-2",
              target: "node-3",
              type: "smoothstep",
              label: "SQL Queries",
            },
          ],
          viewport: { x: 0, y: 0, zoom: 1 },
        }),
      ],
    );

    await db.query(
      `
        INSERT INTO diagram_permissions (diagram_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (diagram_id, user_id) DO NOTHING
      `,
      [diagram.rows[0].id, user.id, "OWNER"],
    );

    return reply.code(201).send(diagram.rows[0]);
  });

  // 3. Get single diagram
  app.get("/api/diagrams/:diagramId", { preHandler: requireAuth }, async (request, reply) => {
    const authUser = request.authUser;
    if (!authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const { diagramId } = diagramIdParamSchema.parse(request.params);
    const user = await ensureUserRecord(authUser.uid, authUser.email, authUser.name);
    const diagram = await ensureDiagramAccess(diagramId, user.id);

    if (!diagram) {
      return reply.code(404).send({ message: "Diagram not found" });
    }

    const full = await db.query(
      `
        SELECT id, title, description, owner_id AS "ownerId", data, updated_at AS "updatedAt"
        FROM diagrams
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [diagramId],
    );

    return full.rows[0];
  });

  // 4. Update diagram
  app.put("/api/diagrams/:diagramId", { preHandler: requireAuth }, async (request, reply) => {
    const authUser = request.authUser;
    if (!authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const { diagramId } = diagramIdParamSchema.parse(request.params);
    const payload = updateDiagramSchema.parse(request.body);
    const user = await ensureUserRecord(authUser.uid, authUser.email, authUser.name);
    const diagram = await ensureDiagramAccess(diagramId, user.id);

    if (!diagram) {
      return reply.code(404).send({ message: "Diagram not found" });
    }

    const updated = await db.query(
      `
        UPDATE diagrams
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          data = $3::jsonb,
          updated_at = NOW()
        WHERE id = $4::uuid
        RETURNING id, title, description, owner_id AS "ownerId", updated_at AS "updatedAt"
      `,
      [payload.title ?? null, payload.description ?? null, JSON.stringify(payload.data), diagramId],
    );

    return updated.rows[0];
  });

  // 5. Version History - List
  app.get("/api/diagrams/:diagramId/versions", { preHandler: requireAuth }, async (request, reply) => {
    const authUser = request.authUser;
    if (!authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const { diagramId } = diagramIdParamSchema.parse(request.params);
    const user = await ensureUserRecord(authUser.uid, authUser.email, authUser.name);
    const diagram = await ensureDiagramAccess(diagramId, user.id);

    if (!diagram) {
      return reply.code(404).send({ message: "Diagram not found" });
    }

    const versions = await db.query(
      `
        SELECT
          v.id,
          v.diagram_id AS "diagramId",
          v.actor_id AS "actorId",
          v.label,
          v.metadata,
          v.created_at AS "createdAt",
          u.display_name AS "actorName",
          u.email AS "actorEmail"
        FROM diagram_versions v
        JOIN users u ON u.id = v.actor_id
        WHERE v.diagram_id = $1
        ORDER BY v.created_at DESC
      `,
      [diagramId],
    );

    return versions.rows;
  });

  // 6. Version History - Create Snapshot
  app.post("/api/diagrams/:diagramId/versions", { preHandler: requireAuth }, async (request, reply) => {
    const authUser = request.authUser;
    if (!authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const { diagramId } = diagramIdParamSchema.parse(request.params);
    const payload = createVersionSchema.parse(request.body ?? {});
    const user = await ensureUserRecord(authUser.uid, authUser.email, authUser.name);
    const diagram = await ensureDiagramAccess(diagramId, user.id);

    if (!diagram) {
      return reply.code(404).send({ message: "Diagram not found" });
    }

    const version = await db.query(
      `
        INSERT INTO diagram_versions (diagram_id, actor_id, label, snapshot, metadata)
        VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::jsonb)
        RETURNING id, diagram_id AS "diagramId", actor_id AS "actorId", label, metadata, created_at AS "createdAt"
      `,
      [
        diagramId,
        user.id,
        payload.label ?? "Manual snapshot",
        JSON.stringify(diagram.data),
        JSON.stringify(payload.metadata ?? {}),
      ],
    );

    return reply.code(201).send(version.rows[0]);
  });

  // 7. Version History - Restore
  app.post(
    "/api/diagrams/:diagramId/versions/:versionId/restore",
    { preHandler: requireAuth },
    async (request, reply) => {
      const authUser = request.authUser;
      if (!authUser) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const { diagramId, versionId } = restoreParamsSchema.parse(request.params);
      const user = await ensureUserRecord(authUser.uid, authUser.email, authUser.name);
      const diagram = await ensureDiagramAccess(diagramId, user.id);

      if (!diagram) {
        return reply.code(404).send({ message: "Diagram not found" });
      }

      const versionResult = await db.query(
        `
          SELECT id, snapshot
          FROM diagram_versions
          WHERE id = $1::uuid AND diagram_id = $2::uuid
          LIMIT 1
        `,
        [versionId, diagramId],
      );

      const version = versionResult.rows[0] as { id: string; snapshot: unknown } | undefined;
      if (!version) {
        return reply.code(404).send({ message: "Version not found" });
      }

      await db.query(
        `
          UPDATE diagrams
          SET data = $1::jsonb, updated_at = NOW()
          WHERE id = $2::uuid
        `,
        [JSON.stringify(version.snapshot), diagramId],
      );

      const restoreVersion = await db.query(
        `
          INSERT INTO diagram_versions (diagram_id, actor_id, label, snapshot, metadata)
          VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::jsonb)
          RETURNING id, diagram_id AS "diagramId", actor_id AS "actorId", label, metadata, created_at AS "createdAt"
        `,
        [
          diagramId,
          user.id,
          `Restored from ${version.id.slice(0, 8)}`,
          JSON.stringify(version.snapshot),
          JSON.stringify({ restoredFromVersionId: version.id }),
        ],
      );

      return {
        restored: true,
        snapshot: version.snapshot,
        version: restoreVersion.rows[0],
      };
    },
  );

  // 8. Permissions - List Collaborators
  app.get("/api/diagrams/:diagramId/permissions", { preHandler: requireAuth }, async (request, reply) => {
    const authUser = request.authUser;
    if (!authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const { diagramId } = diagramIdParamSchema.parse(request.params);
    const user = await ensureUserRecord(authUser.uid, authUser.email, authUser.name);
    const diagram = await ensureDiagramAccess(diagramId, user.id);

    if (!diagram) {
      return reply.code(404).send({ message: "Diagram not found" });
    }

    const perms = await db.query(
      `
        SELECT
          p.id,
          p.diagram_id AS "diagramId",
          p.user_id AS "userId",
          p.role,
          p.created_at AS "createdAt",
          u.email,
          u.display_name AS "displayName"
        FROM diagram_permissions p
        JOIN users u ON u.id = p.user_id
        WHERE p.diagram_id = $1::uuid
      `,
      [diagramId],
    );

    return {
      ownerId: diagram.ownerId,
      permissions: perms.rows,
    };
  });

  // 9. Permissions - Add/Invite Collaborator
  app.post("/api/diagrams/:diagramId/permissions", { preHandler: requireAuth }, async (request, reply) => {
    const authUser = request.authUser;
    if (!authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const { diagramId } = diagramIdParamSchema.parse(request.params);
    const payload = shareDiagramSchema.parse(request.body);
    const user = await ensureUserRecord(authUser.uid, authUser.email, authUser.name);
    const diagram = await ensureDiagramAccess(diagramId, user.id);

    if (!diagram) {
      return reply.code(404).send({ message: "Diagram not found" });
    }

    // Only OWNER can grant permissions
    if (diagram.ownerId !== user.id) {
      return reply.code(403).send({ message: "Only the diagram owner can manage collaborators" });
    }

    // Find or create target collaborator user record by email
const normalizedEmail = payload.email.trim().toLowerCase();

const targetUser = await ensureUserRecord(
  `dev-${normalizedEmail.replace(/[^a-z0-9]/g, "") || "user"}`,
  normalizedEmail,
  normalizedEmail.split("@")[0],
);

    await db.query(
      `
        INSERT INTO diagram_permissions (diagram_id, user_id, role)
        VALUES ($1::uuid, $2::uuid, $3)
        ON CONFLICT (diagram_id, user_id)
        DO UPDATE SET role = EXCLUDED.role
      `,
      [diagramId, targetUser.id, payload.role],
    );

    return reply.code(200).send({
      success: true,
      email: payload.email,
      role: payload.role,
    });
  });

  // 10. Permissions - Revoke Collaborator
  app.delete("/api/diagrams/:diagramId/permissions/:userId", { preHandler: requireAuth }, async (request, reply) => {
    const authUser = request.authUser;
    if (!authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const { diagramId, userId } = deletePermissionParamsSchema.parse(request.params);
    const user = await ensureUserRecord(authUser.uid, authUser.email, authUser.name);
    const diagram = await ensureDiagramAccess(diagramId, user.id);

    if (!diagram) {
      return reply.code(404).send({ message: "Diagram not found" });
    }

    if (diagram.ownerId !== user.id) {
      return reply.code(403).send({ message: "Only the diagram owner can remove collaborators" });
    }

    await db.query(
      `
        DELETE FROM diagram_permissions
        WHERE diagram_id = $1::uuid AND user_id = $2::uuid
      `,
      [diagramId, userId],
    );

    return reply.code(200).send({ success: true });
  });
}
