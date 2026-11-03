import type { Auth } from "firebase/auth";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function hasFirebaseConfig() {
  const key = firebaseConfig.apiKey;
  // If keys are missing or still placeholder values from .env.example, return false
  if (!key || key === "your-api-key" || key.includes("your-") || key.length < 10) {
    return false;
  }
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

let authInstance: Auth | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;

export function getFirebaseAuth() {
  if (typeof window === "undefined" || !hasFirebaseConfig()) {
    return null;
  }

  if (!authInstance) {
    try {
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      authInstance = getAuth(app);
    } catch (error) {
      console.warn("[Firebase] Could not initialize Firebase client, using local auth:", error);
      return null;
    }
  }

  return authInstance;
}

export function getGoogleProvider() {
  if (!googleProviderInstance) {
    googleProviderInstance = new GoogleAuthProvider();
  }

  return googleProviderInstance;
}
