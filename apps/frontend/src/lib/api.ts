import { getFirebaseAuth } from "@/lib/firebase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let token: string | undefined;

  // 1. Try Firebase Auth
  const auth = getFirebaseAuth();
  if (auth?.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch {
      // ignore
    }
  }

  // 2. Try stored local/mock user
  if (!token && typeof window !== "undefined") {
    const mockRaw = localStorage.getItem("onelogica_mock_user");
    if (mockRaw) {
      try {
        token = JSON.parse(mockRaw).token;
      } catch {
        // ignore
      }
    }

    // 3. Try session cookie
    if (!token) {
      const match = document.cookie.match(/(?:^|;\s*)onelogica_session=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
