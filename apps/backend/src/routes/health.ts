import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "onelogica-backend",
      timestamp: new Date().toISOString(),
    };
  });
}
