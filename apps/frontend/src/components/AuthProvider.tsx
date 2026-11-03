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

function setSessionCookie(idToken: string | null) {
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
  const [user, setUser] = useState<User | null>(() => getStoredMockUser());
  const [loading, setLoading] = useState(() => Boolean(firebaseAuth && !getStoredMockUser()));

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isMockAuth: !firebaseAuth,
      signInEmail: async (email, password) => {
        const auth = getFirebaseAuth();
        if (!auth) {
          // Dev Mock Auth Fallback
          const name = email.split("@")[0] || "User";
          const uid = `dev-${name.toLowerCase().replace(/[^a-z0-9]/g, "") || "user"}`;
          const token = `dev-token:${uid}:${email}:${encodeURIComponent(name)}`;
          const mockUser = {
            uid,
            email,
            displayName: name,
            getIdToken: async () => token,
          } as unknown as User;

          localStorage.setItem("onelogica_mock_user", JSON.stringify({ uid, email, displayName: name, token }));
          setUser(mockUser);
          setSessionCookie(token);
          return;
        }
        await signInWithEmailAndPassword(auth, email, password);
      },
      signUpEmail: async (email, password) => {
        const auth = getFirebaseAuth();
        if (!auth) {
          const name = email.split("@")[0] || "User";
          const uid = `dev-${name.toLowerCase().replace(/[^a-z0-9]/g, "") || "user"}`;
          const token = `dev-token:${uid}:${email}:${encodeURIComponent(name)}`;
          const mockUser = {
            uid,
            email,
            displayName: name,
            getIdToken: async () => token,
          } as unknown as User;

          localStorage.setItem("onelogica_mock_user", JSON.stringify({ uid, email, displayName: name, token }));
          setUser(mockUser);
          setSessionCookie(token);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
      },
      signInGoogle: async () => {
        const auth = getFirebaseAuth();
        if (!auth) {
          const name = "Google Tester";
          const email = "google.tester@example.com";
          const uid = "dev-google-user";
          const token = `dev-token:${uid}:${email}:${encodeURIComponent(name)}`;
          const mockUser = {
            uid,
            email,
            displayName: name,
            getIdToken: async () => token,
          } as unknown as User;

          localStorage.setItem("onelogica_mock_user", JSON.stringify({ uid, email, displayName: name, token }));
          setUser(mockUser);
          setSessionCookie(token);
          return;
        }
        await signInWithPopup(auth, getGoogleProvider());
      },
      signInMock: async (email: string, name: string) => {
        const uid = `dev-${name.toLowerCase().replace(/[^a-z0-9]/g, "") || "user"}`;
        const token = `dev-token:${uid}:${email}:${encodeURIComponent(name)}`;
        const mockUser = {
          uid,
          email,
          displayName: name,
          getIdToken: async () => token,
        } as unknown as User;

        localStorage.setItem("onelogica_mock_user", JSON.stringify({ uid, email, displayName: name, token }));
        setUser(mockUser);
        setSessionCookie(token);
      },
      logout: async () => {
        const auth = getFirebaseAuth();
        if (auth) {
          await signOut(auth);
        }
        localStorage.removeItem("onelogica_mock_user");
        setUser(null);
        setSessionCookie(null);
      },
      getIdToken: async () => {
        if (!user) {
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
