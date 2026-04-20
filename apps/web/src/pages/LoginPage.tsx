import { useState } from "react";
import { login } from "../api";
import type { Me } from "../api";

export function LoginPage({ onLoggedIn }: { onLoggedIn: (me: Me) => void }) {
  const [username, setUsername] = useState("emilian");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const me = await login(username.trim(), password);
      onLoggedIn(me);
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-zinc-800 ring-1 ring-zinc-700" />
            <div>
              <div className="text-lg font-semibold leading-5">
                Time Tracker
              </div>
              <div className="text-sm text-zinc-400">Internal prototype</div>
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-900/60 p-6 ring-1 ring-zinc-800 shadow-xl">
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Use your prototype username + password.
            </p>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="text-sm text-zinc-300">Username</label>
                <input
                  className="mt-1 w-full rounded-xl bg-zinc-950/60 px-3 py-2 text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-zinc-300">Password</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl bg-zinc-950/60 px-3 py-2 text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/30">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-white disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>

              <div className="text-xs text-zinc-500">
                Users:{" "}
                <span className="text-zinc-300">emilian / pm1 / user1</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
