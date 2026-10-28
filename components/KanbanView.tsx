"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { STATUSES, priorityMeta } from "@/lib/constants";
import type { Space, Status, Task } from "@/lib/types";
import { useStore } from "./store";
import { DueChip, PriorityChip, compareImportance } from "./ui";

export default function KanbanView({ space, tasks }: { space: Space; tasks: Task[] }) {
  const { updateTask, openTask, openNewTask } = useStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  function drop(status: Status, e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task-id") || dragId;
    setOverCol(null);
    setDragId(null);
    if (!id) return;
    const t = tasks.find((x) => x.id === id);
    if (t && t.status !== status) updateTask(id, { status });
  }

  return (
    <div className="scroll-thin -mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      <div className="grid min-w-[960px] grid-cols-4 gap-4 lg:min-w-0">
        {STATUSES.map((col) => {
          const items = tasks
            .filter((t) => t.status === col.value)
            .sort(col.value === "done" ? (a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "") : compareImportance);
          const isOver = overCol === col.value;
          return (
            <section
              key={col.value}
              aria-label={col.label}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overCol !== col.value) setOverCol(col.value);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
              }}
              onDrop={(e) => drop(col.value, e)}
              className={`flex min-h-[420px] flex-col rounded-2xl border p-2.5 transition ${
                isOver ? "border-dashed bg-white" : "border-transparent bg-black/[0.035]"
              }`}
              style={isOver ? { borderColor: col.color, boxShadow: `0 0 0 3px ${col.color}22` } : undefined}
            >
              <div className="mb-2.5 flex items-center gap-2 px-1.5 pt-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
                <h2 className="text-sm font-bold">{col.label}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-muted shadow-card">
                  {items.length}
                </span>
                <button
                  onClick={() => openNewTask({ space_id: space.id, status: col.value })}
                  aria-label={`משימה חדשה ב${col.label}`}
                  className="ms-auto flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-white hover:text-ink"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-2.5">
                {items.map((t) => (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/task-id", t.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(t.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    onClick={() => openTask(t.id)}
                    className={`group relative cursor-grab overflow-hidden rounded-xl border border-line bg-surface p-3 ps-4 shadow-card transition hover:shadow-pop active:cursor-grabbing ${
                      dragId === t.id ? "opacity-40" : ""
                    }`}
                  >
                    <span className="absolute inset-y-0 start-0 w-1" style={{ background: priorityMeta(t.priority).color }} />
                    <h3 className={`text-sm font-medium leading-snug ${t.status === "done" ? "text-muted line-through" : ""}`}>
                      {t.title}
                    </h3>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <PriorityChip priority={t.priority} />
                      <DueChip task={t} />
                    </div>
                  </article>
                ))}
                {items.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line/80 py-10 text-xs text-muted">
                    גרור לכאן משימה
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
