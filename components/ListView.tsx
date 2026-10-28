"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ListChecks } from "lucide-react";
import { PRIORITIES } from "@/lib/constants";
import type { Space, Task } from "@/lib/types";
import { useStore } from "./store";
import { DueChip, Empty, StatusChip, compareImportance } from "./ui";

export default function ListView({ tasks }: { space: Space; tasks: Task[] }) {
  const { updateTask, openTask } = useStore();
  const [showDone, setShowDone] = useState(false);

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  if (tasks.length === 0)
    return (
      <div className="rounded-2xl border border-line bg-surface">
        <Empty icon={<ListChecks size={22} />} title="הרשימה ריקה" hint='לחץ על "משימה חדשה" כדי להתחיל.' />
      </div>
    );

  const toggle = (t: Task) => updateTask(t.id, { status: t.status === "done" ? "new" : "done" });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {open.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface">
          <Empty icon={<Check size={22} />} title="הכל הושלם" hint="אין משימות פתוחות במרחב הזה." />
        </div>
      )}

      {PRIORITIES.map((p) => {
        const group = open.filter((t) => t.priority === p.value).sort(compareImportance);
        if (!group.length) return null;
        return (
          <section key={p.value} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <h2 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-bold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
              {p.label}
              <span className="text-xs font-semibold tabular-nums text-muted">{group.length}</span>
            </h2>
            <ul className="divide-y divide-line">
              {group.map((t) => (
                <Row key={t.id} task={t} color={p.color} onToggle={() => toggle(t)} onOpen={() => openTask(t.id)} />
              ))}
            </ul>
          </section>
        );
      })}

      {done.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <button
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold transition hover:bg-bg"
          >
            {showDone ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
            הושלמו
            <span className="text-xs font-semibold tabular-nums text-muted">{done.length}</span>
          </button>
          {showDone && (
            <ul className="divide-y divide-line border-t border-line">
              {done.map((t) => (
                <Row key={t.id} task={t} color="#22c55e" onToggle={() => toggle(t)} onOpen={() => openTask(t.id)} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Row({
  task,
  color,
  onToggle,
  onOpen,
}: {
  task: Task;
  color: string;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const done = task.status === "done";
  return (
    <li className="group flex items-center gap-3 px-4 py-2.5 transition hover:bg-bg">
      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? "החזר לפתוחה" : "סמן כהושלמה"}
        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition hover:scale-110"
        style={done ? { background: "#22c55e", borderColor: "#22c55e" } : { borderColor: color }}
      >
        {done && <Check size={13} className="text-white" strokeWidth={4} />}
      </button>
      <button onClick={onOpen} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 py-0.5 text-start">
        <span className={`min-w-0 flex-1 basis-40 text-sm font-medium ${done ? "text-muted line-through" : ""}`}>{task.title}</span>
        <span className="flex items-center gap-1.5">
          {!done && task.status !== "new" && <StatusChip status={task.status} />}
          <DueChip task={task} />
        </span>
      </button>
    </li>
  );
}
