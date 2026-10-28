"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Layers, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import type { ChatMessage, PendingAction, Scope } from "@/lib/types";
import { useStore } from "./store";

interface UIMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  actions?: string[];
  pending?: PendingAction;
  pendingState?: "idle" | "busy" | "approved" | "rejected" | "failed";
  error?: boolean;
}

let nextId = 1;

export default function ChatWidget() {
  const { spaces, refresh } = useStore();
  const pathname = usePathname();

  const routeScope: Scope = useMemo(() => {
    const m = pathname.match(/^\/spaces\/([0-9a-fA-F-]{36})/);
    return m ? { type: "space", id: m[1] } : { type: "all" };
  }, [pathname]);
  const routeKey = routeScope.type === "space" ? routeScope.id : "all";

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>(routeScope);
  const [menu, setMenu] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // כניסה למרחב / לדשבורד קובעת את הטווח אוטומטית; אפשר לשנות בקליק
  useEffect(() => {
    setScope(routeScope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const scopeSpace = scope.type === "space" ? spaces.find((s) => s.id === scope.id) : undefined;
  const effectiveScope: Scope = scope.type === "space" && !scopeSpace ? { type: "all" } : scope;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const suggestions =
    effectiveScope.type === "all"
      ? ["מה המשימות הכי חשובות שצריך לתת להן עדיפות?", "תדחה את כל מה שבאיחור למחר", "סכם לי איפה אני עומד"]
      : ["מה הכי דחוף כאן?", `תוסיף ל${scopeSpace?.name ?? "מרחב"}: לקנות חלב, לסדר את המחסן`, "מה באיחור?"];

  function history(extra?: UIMessage[]): ChatMessage[] {
    return [...messages, ...(extra ?? [])]
      .filter((m) => !m.error && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const userMsg: UIMessage = { id: nextId++, role: "user", content };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history([userMsg]), scope: effectiveScope }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "הסוכן לא זמין כרגע");
      setMessages((m) => [
        ...m,
        {
          id: nextId++,
          role: "assistant",
          content: data.reply,
          actions: data.actions,
          pending: data.pending ?? undefined,
          pendingState: data.pending ? "idle" : undefined,
        },
      ]);
      if (data.mutated) await refresh();
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: nextId++, role: "assistant", content: e instanceof Error ? e.message : "משהו השתבש", error: true },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function decide(msgId: number, pending: PendingAction, approve: boolean) {
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, pendingState: "busy" } : x)));
    try {
      const res = await fetch("/api/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pending.id, approve }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "שגיאה");
      setMessages((m) => [
        ...m.map((x) => (x.id === msgId ? { ...x, pendingState: (data.ok ? (approve ? "approved" : "rejected") : "failed") as UIMessage["pendingState"] } : x)),
        { id: nextId++, role: "assistant", content: data.message },
      ]);
      if (data.mutated) await refresh();
    } catch {
      setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, pendingState: "failed" } : x)));
    }
  }

  const label = effectiveScope.type === "all" ? "כל המרחבים" : (scopeSpace?.name ?? "");

  return (
    <>
      {/* חלון הצ'אט */}
      {open && (
        <section
          aria-label="סוכן המשימות"
          className="pop-in fixed inset-0 z-[65] flex flex-col bg-surface sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[min(680px,calc(100dvh-8rem))] sm:w-[400px] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-line sm:shadow-pop"
        >
          {/* כותרת + על מה הסוכן עובד */}
          <header className="shrink-0 border-b border-line bg-gradient-to-l from-brand to-violet-600 px-4 pb-3 pt-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold leading-tight">סוכן המשימות</div>
                <div className="flex items-center gap-1.5 text-xs text-white/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> מחובר
                </div>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  aria-label="שיחה חדשה"
                  title="שיחה חדשה"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/15 hover:text-white"
                >
                  <RotateCcw size={16} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="סגור"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative mt-3" ref={menuRef}>
              <button
                onClick={() => setMenu((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={menu}
                className="flex h-10 w-full items-center gap-2 rounded-lg bg-white/15 px-3 text-sm transition hover:bg-white/25"
              >
                <span className="text-white/75">עובד עכשיו על:</span>
                {scopeSpace ? (
                  <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/70" style={{ background: scopeSpace.color }} />
                ) : (
                  <Layers size={15} />
                )}
                <span className="flex-1 truncate text-start font-semibold">{label}</span>
                <ChevronDown size={16} className={`transition ${menu ? "rotate-180" : ""}`} />
              </button>
              {menu && (
                <ul
                  role="listbox"
                  className="pop-in scroll-thin absolute inset-x-0 top-full z-10 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-line bg-surface py-1 text-ink shadow-pop"
                >
                  <ScopeOption
                    selected={effectiveScope.type === "all"}
                    onClick={() => {
                      setScope({ type: "all" });
                      setMenu(false);
                    }}
                    icon={<Layers size={15} className="text-muted" />}
                    label="כל המרחבים"
                  />
                  {spaces.map((s) => (
                    <ScopeOption
                      key={s.id}
                      selected={effectiveScope.type === "space" && effectiveScope.id === s.id}
                      onClick={() => {
                        setScope({ type: "space", id: s.id });
                        setMenu(false);
                      }}
                      icon={<span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />}
                      label={s.name}
                    />
                  ))}
                </ul>
              )}
            </div>
          </header>

          {/* הודעות */}
          <div className="scroll-thin flex flex-1 flex-col gap-3 overflow-y-auto bg-bg/50 px-4 py-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="my-auto text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Sparkles size={22} />
                </div>
                <p className="font-bold">איך אפשר לעזור?</p>
                <p className="mx-auto mt-1 max-w-[16rem] text-sm text-muted">
                  אפשר לשאול על המשימות, להוסיף, לעדכן, למחוק ולסכם. אני פועל על: {label}.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-start text-sm transition hover:border-brand hover:bg-brand-soft"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <Bubble key={m.id} m={m} onDecide={(approve) => m.pending && decide(m.id, m.pending, approve)} />
            ))}

            {busy && (
              <div className="flex max-w-[85%] items-center gap-1 self-end rounded-2xl rounded-es-md border border-line bg-surface px-4 py-3 shadow-card" aria-label="הסוכן חושב">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* שליחה */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="shrink-0 border-t border-line bg-surface p-3"
          >
            <div className="flex items-end gap-2 rounded-xl border border-line bg-white p-1.5 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="כתוב לסוכן..."
                aria-label="הודעה לסוכן"
                className="max-h-[120px] min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label="שלח"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-indigo-700 disabled:opacity-40"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="-scale-x-100" />}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* כפתור צף, ימין למטה */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "סגור את הסוכן" : "שוחח עם הסוכן"}
        aria-expanded={open}
        className={`fixed bottom-5 right-5 z-[66] items-center gap-2.5 rounded-full bg-gradient-to-l from-brand to-violet-600 py-3.5 text-white shadow-pop transition hover:scale-105 hover:shadow-xl active:scale-95 ${
          open ? "hidden px-3.5 sm:flex" : "flex ps-4 pe-5 sm:ps-4 sm:pe-5"
        }`}
      >
        {open ? (
          <X size={22} />
        ) : (
          <>
            <Sparkles size={22} />
            <span className="text-sm font-bold">שאל את הסוכן</span>
          </>
        )}
      </button>
    </>
  );
}

function ScopeOption({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li role="option" aria-selected={selected}>
      <button onClick={onClick} className="flex h-10 w-full items-center gap-2.5 px-3 text-sm transition hover:bg-bg">
        <span className="flex w-4 justify-center">{icon}</span>
        <span className="flex-1 truncate text-start">{label}</span>
        {selected && <Check size={15} className="text-brand" />}
      </button>
    </li>
  );
}

function Bubble({ m, onDecide }: { m: UIMessage; onDecide: (approve: boolean) => void }) {
  if (m.role === "user") {
    return (
      <div className="max-w-[85%] self-start whitespace-pre-wrap rounded-2xl rounded-ss-md bg-brand px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-card">
        {m.content}
      </div>
    );
  }
  const text = m.content.replace(/\*\*/g, "");
  return (
    <div className="flex max-w-[88%] flex-col gap-2 self-end">
      <div
        className={`whitespace-pre-wrap rounded-2xl rounded-es-md border px-3.5 py-2.5 text-sm leading-relaxed shadow-card ${
          m.error ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-surface"
        }`}
      >
        {text}
      </div>

      {m.actions && m.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {m.actions.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <Check size={12} strokeWidth={3} /> {a}
            </span>
          ))}
        </div>
      )}

      {m.pending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-sm font-semibold text-amber-900">
            {m.pending.description}
          </div>
          {m.pending.titles.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-amber-900/80">
              {m.pending.titles.map((t, i) => (
                <li key={i} className="truncate">• {t}</li>
              ))}
              {m.pending.count > m.pending.titles.length && <li>ועוד {m.pending.count - m.pending.titles.length}...</li>}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            {m.pendingState === "idle" || m.pendingState === "busy" ? (
              <>
                <button
                  onClick={() => onDecide(true)}
                  disabled={m.pendingState === "busy"}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {m.pendingState === "busy" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3} />}
                  מאשר
                </button>
                <button
                  onClick={() => onDecide(false)}
                  disabled={m.pendingState === "busy"}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white text-sm font-semibold transition hover:bg-bg disabled:opacity-60"
                >
                  <X size={15} /> לא מאשר
                </button>
              </>
            ) : (
              <span className="text-xs font-semibold text-amber-900/80">
                {m.pendingState === "approved" ? "אושר" : m.pendingState === "rejected" ? "בוטל" : "לא הצלחתי לטפל בפעולה"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
