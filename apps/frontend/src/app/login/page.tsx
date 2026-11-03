"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { signInEmail, signUpEmail, signInGoogle, signInMock } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInEmail(email, password);
      window.location.href = "/workspace";
    } catch {
      setError("Could not sign in with email/password.");
      setLoading(false);
    }
  }

  const handleRegister = async () => {
    if (!email || !password) {
      setError("Please provide an email and password to register.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUpEmail(email, password);
      window.location.href = "/workspace";
    } catch {
      setError("Could not register account.");
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInGoogle();
      window.location.href = "/workspace";
    } catch {
      setError("Google sign-in failed.");
      setLoading(false);
    }
  };

  const handleAlice = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInMock("alice@example.com", "Alice (Architect)");
      window.location.href = "/workspace";
    } catch {
      setError("Could not sign in as Alice.");
      setLoading(false);
    }
  };

  const handleBob = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInMock("bob@example.com", "Bob (Engineer)");
      window.location.href = "/workspace";
    } catch {
      setError("Could not sign in as Bob.");
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Onelogica</h1>
        <p className="mt-2 text-sm text-slate-600">
          Collaborative Architecture & Workflow Designer
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <h2 className="text-base font-semibold text-slate-800">Sign in to your account</h2>
        <p className="mt-1 text-xs text-slate-500">
          Supports Firebase Authentication with Email/Password & Google OAuth.
        </p>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Email Address</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden"
              type="email"
              required
              placeholder="engineer@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Password</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer rounded-lg bg-cyan-700 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 shadow-2xs disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleRegister}
              className="w-full cursor-pointer rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Register New Account
            </button>

            <div className="relative my-2 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white px-2 text-[11px] uppercase tracking-wider text-slate-400">
                or
              </span>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleGoogle}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>
          </div>
        </form>

        {/* Demo Fast-Login Section */}
        <div className="mt-6 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3.5">
          <p className="text-xs font-bold text-cyan-950 uppercase tracking-wider">
            Quick Multi-User Collaboration Demo
          </p>
          <p className="mt-1 text-[11px] text-cyan-800">
            Click below to instantly sign in as different collaborators across two tabs to test live cursors and concurrent edits:
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleAlice}
              className="flex-1 cursor-pointer rounded-lg border border-cyan-300 bg-white py-1.5 text-xs font-semibold text-cyan-900 hover:bg-cyan-50 shadow-2xs"
            >
              Sign in as Alice
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleBob}
              className="flex-1 cursor-pointer rounded-lg border border-cyan-300 bg-white py-1.5 text-xs font-semibold text-cyan-900 hover:bg-cyan-50 shadow-2xs"
            >
              Sign in as Bob
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
