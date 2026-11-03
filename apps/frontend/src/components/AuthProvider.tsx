"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  type User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInMock: (email: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  isMockAuth: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function setSessionCookie(idToken: string | null) {
  if (typeof document === "undefined") return;

  if (!idToken) {
    document.cookie = "onelogica_session=; Path=/; Max-Age=0; SameSite=Lax";
    return;
  }

  document.cookie = `onelogica_session=${encodeURIComponent(idToken)}; Path=/; Max-Age=86400; SameSite=Lax`;
}

function getStoredMockUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("onelogica_mock_user");
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return {
      uid: data.uid,
      email: data.email,
      displayName: data.displayName,
      getIdToken: async () => data.token,
    } as unknown as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const firebaseAuth = getFirebaseAuth();
  // Start with null to prevent SSR / Client hydration mismatch
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Populate stored user after mounting on client
    const stored = getStoredMockUser();
    if (stored) {
      setUser(stored);
      setSessionCookie(stored.uid);
      setLoading(false);
    } else if (!firebaseAuth) {
      setLoading(false);
    }

    if (!firebaseAuth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      if (nextUser) {
        setUser(nextUser);
        const token = await nextUser.getIdToken();
        setSessionCookie(token);
        localStorage.removeItem("onelogica_mock_user");
      } else {
        const storedMock = getStoredMockUser();
        if (storedMock) {
          setUser(storedMock);
          const token = await storedMock.getIdToken();
          setSessionCookie(token);
        } else {
          setUser(null);
          setSessionCookie(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseAuth]);

const createMockSession = (email: string, name: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name || normalizedEmail.split("@")[0] || "User";

  // Use email instead of display name so the user's ID stays consistent.
  const uid = `dev-${normalizedEmail.replace(/[^a-z0-9]/g, "") || "user"}`;
  const token = `dev-token:${uid}:${normalizedEmail}:${encodeURIComponent(cleanName)}`;

  const mockUser = {
    uid,
    email: normalizedEmail,
    displayName: cleanName,
    getIdToken: async () => token,
  } as unknown as User;

  localStorage.setItem(
    "onelogica_mock_user",
    JSON.stringify({ uid, email: normalizedEmail, displayName: cleanName, token }),
  );

  setSessionCookie(token);
  setUser(mockUser);
  setLoading(false);
  return mockUser;
};

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isMockAuth: !firebaseAuth,
      signInEmail: async (email, password) => {
        const auth = getFirebaseAuth();
        if (auth) {
          try {
            await signInWithEmailAndPassword(auth, email, password);
            return;
          } catch (err) {
            console.warn("[Auth] Firebase sign-in failed, using local session:", err);
          }
        }
        createMockSession(email, email.split("@")[0]);
      },
      signUpEmail: async (email, password) => {
        const auth = getFirebaseAuth();
        if (auth) {
          try {
            await createUserWithEmailAndPassword(auth, email, password);
            return;
          } catch (err) {
            console.warn("[Auth] Firebase registration failed, using local session:", err);
          }
        }
        createMockSession(email, email.split("@")[0]);
      },
      signInGoogle: async () => {
        const auth = getFirebaseAuth();
        if (auth) {
          try {
            await signInWithPopup(auth, getGoogleProvider());
            return;
          } catch (err) {
            console.warn("[Auth] Google OAuth failed or was blocked, using demo session:", err);
          }
        }
        createMockSession("google.user@example.com", "Google Architect");
      },
      signInMock: async (email: string, name: string) => {
        createMockSession(email, name);
      },
      logout: async () => {
        const auth = getFirebaseAuth();
        if (auth) {
          try {
            await signOut(auth);
          } catch {
            // ignore
          }
        }
        localStorage.removeItem("onelogica_mock_user");
        setSessionCookie(null);
        setUser(null);
      },
      getIdToken: async () => {
        if (!user) {
          const stored = getStoredMockUser();
          if (stored) {
            return stored.getIdToken();
          }
          return null;
        }
        return user.getIdToken();
      },
    }),
    [firebaseAuth, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
