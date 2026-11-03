import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "../config/env.js";

let initialized = false;

export function initializeFirebaseAdmin(): void {
  if (initialized || getApps().length > 0) {
    initialized = true;
    return;
  }

  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    // Graceful dev fallback if credentials are not configured yet
    return;
  }

  try {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    initialized = true;
  } catch (error) {
    console.warn("[Auth] Failed to initialize Firebase Admin:", error);
  }
}

export async function verifyFirebaseToken(idToken: string) {
  // 1. Support dev mock token format for immediate zero-config testing:
  // Format: "dev-token:<uid>:<email>:<displayName>"
  if (idToken.startsWith("dev-token:")) {
    const parts = idToken.split(":");
    const uid = parts[1] || "dev-user-1";
    const email = parts[2] || `${uid}@example.com`;
    const name = parts[3] ? decodeURIComponent(parts[3]) : `Dev User (${uid})`;
    return {
      uid,
      email,
      name,
    };
  }

  initializeFirebaseAdmin();

  // 2. If Firebase Admin was initialized, verify with official Firebase SDK
  if (initialized && getApps().length > 0) {
    return getAuth().verifyIdToken(idToken);
  }

  // 3. Fallback: Parse unverified JWT payload for offline / dev mock evaluation
  try {
    const parts = idToken.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      return {
        uid: (payload.user_id as string) || (payload.sub as string) || "dev-user-offline",
        email: (payload.email as string) || "dev@example.com",
        name: (payload.name as string) || "Dev User",
      };
    }
  } catch {
    // ignore
  }

  throw new Error("Firebase Admin is not configured with credentials and token could not be verified");
}
