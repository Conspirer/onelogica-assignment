import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { env } from "./config/env.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerDiagramRoutes } from "./routes/diagrams.js";
import { registerCollabGateway } from "./realtime/collabGateway.js";
import { initializeFirebaseAdmin } from "./auth/firebase.js";

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  });

  await app.register(websocket);

  initializeFirebaseAdmin();
  await registerHealthRoutes(app);
  await registerDiagramRoutes(app);
  await registerCollabGateway(app);

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
