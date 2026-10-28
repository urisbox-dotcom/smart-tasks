"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { priorityMeta, priorityRank, statusMeta } from "@/lib/constants";
import { formatShort, todayStr } from "@/lib/dates";
import type { Priority, Status, Task } from "@/lib/types";

export const isOverdueTask = (t: Task, today = todayStr()) =>
  !!t.due_date && t.due_date < today && t.status !== "done";

/** דחוף ראשון, אחר כך לפי תאריך יעד */
export function compareImportance(a: Task, b: Task) {
  return (
    priorityRank(b.priority) - priorityRank(a.priority) ||
    (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99") ||
    a.created_at.localeCompare(b.created_at)
  );
}

export function Modal({
  title,
  onClose,
  children,
  width = "max-w-lg",
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`pop-in flex max-h-[92dvh] w-full ${width} flex-col rounded-t-2xl bg-surface shadow-pop sm:rounded-2xl`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-bg hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function PriorityChip({ priority, compact }: { priority: Priority; compact?: boolean }) {
  const m = priorityMeta(priority);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: `${m.color}1f`, color: darken(m.color) }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {!compact && m.label}
      {compact && <span className="sr-only">{m.label}</span>}
    </span>
  );
}

export function StatusChip({ status }: { status: Status }) {
  const m = statusMeta(status);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: `${m.color}1f`, color: darken(m.color) }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function DueChip({ task }: { task: Task }) {
  if (!task.due_date) return null;
  const today = todayStr();
  const overdue = isOverdueTask(task, today);
  const isToday = task.due_date === today && task.status !== "done";
  const cls = overdue
    ? "bg-red-50 text-red-700"
    : isToday
      ? "bg-amber-50 text-amber-700"
      : "bg-bg text-muted";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {isToday ? "היום" : formatShort(task.due_date)}
      {overdue && <span className="ms-1">· באיחור</span>}
    </span>
  );
}

/** מכהה צבע hex לטקסט קריא על רקע בהיר */
function darken(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = 0.68;
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r} ${g} ${b})`;
}

export const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50";
export const btnGhost =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-ink transition hover:bg-bg disabled:opacity-50";
export const inputCls =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Empty({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-muted">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">{icon}</div>
      <div className="font-semibold text-ink">{title}</div>
      {hint && <div className="max-w-xs text-sm">{hint}</div>}
    </div>
  );
}
