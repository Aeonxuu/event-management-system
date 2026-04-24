"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client/api";
import type { AuthUser } from "@/lib/client/types";

function routeByRole(role: AuthUser["role"]): string {
  if (role === "STUDENT_LEADER") return "/student";
  if (["ADVISER", "DEAN", "FACILITIES", "OSA"].includes(role)) return "/approver";
  return "/admin";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await apiRequest<AuthUser>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push(routeByRole(user.role));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid-ambient flex min-h-screen items-center justify-center px-4 py-10">
      <section className="linear-panel w-full max-w-[420px] p-7">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">School EMS</p>
        <h1 className="mt-2 text-2xl font-[510] tracking-[-0.288px] text-[var(--text-primary)]">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">Enter your account credentials to continue.</p>

        <form className="mt-6 space-y-4" onSubmit={handleLogin}>
          <label className="block text-sm text-[var(--text-secondary)]">
            Email
            <input
              className="linear-input mt-1"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="block text-sm text-[var(--text-secondary)]">
            Password
            <input
              className="linear-input mt-1"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="text-sm text-[#f87171]">{error}</p>}

          <button className="linear-btn linear-btn-primary w-full" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </section>
    </div>
  );
}
