import type { Auth } from "firebase/auth";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function hasFirebaseConfig() {
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
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
  }

  return authInstance;
}

export function getGoogleProvider() {
  if (!googleProviderInstance) {
    googleProviderInstance = new GoogleAuthProvider();
  }

  return googleProviderInstance;
}
