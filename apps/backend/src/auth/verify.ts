import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyFirebaseToken } from "./firebase.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: {
      uid: string;
      email?: string;
      name?: string;
    };
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ message: "Missing Bearer token" });
  }

  try {
    const idToken = authHeader.replace("Bearer ", "");
    const decoded = await verifyFirebaseToken(idToken);

    request.authUser = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
  } catch {
    return reply.code(401).send({ message: "Invalid authentication token" });
  }
}
