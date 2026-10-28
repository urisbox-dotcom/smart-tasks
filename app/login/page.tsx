"use client";

import { useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "משהו השתבש, נסה שוב");
    } catch {
      setError("אין חיבור לשרת, נסה שוב");
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="pop-in w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-pop"
      >
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
          <Check size={26} strokeWidth={3} />
        </div>
        <h1 className="text-center text-xl font-bold">המשימות שלי</h1>
        <p className="mt-1 text-center text-sm text-muted">הכנס סיסמה כדי להמשיך</p>

        <label className="mt-6 block text-sm font-medium" htmlFor="pw">
          סיסמה
        </label>
        <div className="relative mt-1.5">
          <Lock size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="pw"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-lg border border-line bg-white ps-9 pe-3 text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={!password || busy}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          כניסה
        </button>
      </form>
    </main>
  );
}
