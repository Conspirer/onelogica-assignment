import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerDiagramRoutes } from "./diagrams.js";

async function createTestApp() {
  const app = Fastify();
  await registerDiagramRoutes(app);
  return app;
}

describe("Diagram REST Routes (Activity 1, 2 & 5)", () => {
  const devToken = "Bearer dev-token:test-user-1:test@example.com:Alice";

  it("creates, retrieves, and updates an architecture diagram", async () => {
    const app = await createTestApp();

    // 1. Create diagram
    const createRes = await app.inject({
      method: "POST",
      url: "/api/diagrams",
      headers: { authorization: devToken },
      payload: {
        title: "Event-Driven System",
        description: "Kafka & Microservices",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.id).toBeDefined();
    expect(created.title).toBe("Event-Driven System");

    // 2. Retrieve diagram
    const getRes = await app.inject({
      method: "GET",
      url: `/api/diagrams/${created.id}`,
      headers: { authorization: devToken },
    });

    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.body);
    expect(fetched.title).toBe("Event-Driven System");
    expect(fetched.data.nodes).toBeDefined();

    // 3. Update diagram
    const updateRes = await app.inject({
      method: "PUT",
      url: `/api/diagrams/${created.id}`,
      headers: { authorization: devToken },
      payload: {
        title: "Updated Event-Driven System",
        data: {
          nodes: [{ id: "n1", position: { x: 50, y: 50 }, data: { label: "Ingest" } }],
          edges: [],
        },
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.body);
    expect(updated.title).toBe("Updated Event-Driven System");
  });

  it("handles version snapshots and restoration (Activity 5)", async () => {
    const app = await createTestApp();

    // Create diagram
    const createRes = await app.inject({
      method: "POST",
      url: "/api/diagrams",
      headers: { authorization: devToken },
      payload: { title: "Versioned Pipeline" },
    });
    const diagram = JSON.parse(createRes.body);

    // Create a snapshot version
    const versionRes = await app.inject({
      method: "POST",
      url: `/api/diagrams/${diagram.id}/versions`,
      headers: { authorization: devToken },
      payload: { label: "v1.0 Milestone" },
    });

    expect(versionRes.statusCode).toBe(201);
    const version = JSON.parse(versionRes.body);
    expect(version.label).toBe("v1.0 Milestone");

    // List versions
    const listVersionsRes = await app.inject({
      method: "GET",
      url: `/api/diagrams/${diagram.id}/versions`,
      headers: { authorization: devToken },
    });

    expect(listVersionsRes.statusCode).toBe(200);
    const versions = JSON.parse(listVersionsRes.body);
    expect(versions.length).toBeGreaterThanOrEqual(1);

    // Restore version
    const restoreRes = await app.inject({
      method: "POST",
      url: `/api/diagrams/${diagram.id}/versions/${version.id}/restore`,
      headers: { authorization: devToken },
    });

    expect(restoreRes.statusCode).toBe(200);
    const restored = JSON.parse(restoreRes.body);
    expect(restored.restored).toBe(true);
  });

  it("manages collaborator permissions and sharing (Activity 1)", async () => {
    const app = await createTestApp();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/diagrams",
      headers: { authorization: devToken },
      payload: { title: "Shared Diagram" },
    });
    const diagram = JSON.parse(createRes.body);

    // Share with collaborator
    const shareRes = await app.inject({
      method: "POST",
      url: `/api/diagrams/${diagram.id}/permissions`,
      headers: { authorization: devToken },
      payload: {
        email: "collaborator@company.com",
        role: "EDITOR",
      },
    });

    expect(shareRes.statusCode).toBe(200);
    const shareData = JSON.parse(shareRes.body);
    expect(shareData.success).toBe(true);
    expect(shareData.role).toBe("EDITOR");

    // List permissions
    const permListRes = await app.inject({
      method: "GET",
      url: `/api/diagrams/${diagram.id}/permissions`,
      headers: { authorization: devToken },
    });

    expect(permListRes.statusCode).toBe(200);
    const permData = JSON.parse(permListRes.body);
    expect(permData.permissions.some((p: any) => p.email === "collaborator@company.com")).toBe(true);
  });
});
