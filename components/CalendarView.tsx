"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { priorityMeta } from "@/lib/constants";
import { formatLong, toYMD, todayStr } from "@/lib/dates";
import type { Space, Task } from "@/lib/types";
import { useStore } from "./store";
import { Modal, btnGhost, btnPrimary, compareImportance } from "./ui";

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const WEEKDAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const MAX_CHIPS = 3;

export default function CalendarView({ space, tasks }: { space: Space; tasks: Task[] }) {
  const { updateTask, openTask, openNewTask } = useStore();
  const today = todayStr();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dayDialog, setDayDialog] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);

  const { days, weeks } = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const days = Array.from({ length: weeks * 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    return { days, weeks };
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const list = map.get(t.due_date) ?? [];
      list.push(t);
      map.set(t.due_date, list);
    }
    for (const list of map.values()) list.sort(compareImportance);
    return map;
  }, [tasks]);

  const undated = tasks.filter((t) => !t.due_date && t.status !== "done");

  const monthTitle = cursor.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  const shiftMonth = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const goToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };
  const isThisMonth = cursor.getFullYear() === new Date().getFullYear() && cursor.getMonth() === new Date().getMonth();

  function onCellClick(ymd: string) {
    if (window.matchMedia("(max-width: 639px)").matches) setDayDialog(ymd);
    else openNewTask({ space_id: space.id, due_date: ymd });
  }

  function onDrop(ymd: string, e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task-id") || dragId;
    setOverDay(null);
    setDragId(null);
    if (!id) return;
    const t = tasks.find((x) => x.id === id);
    if (t && t.due_date !== ymd) updateTask(id, { due_date: ymd });
  }

  const dragProps = (t: Task) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/task-id", t.id);
      e.dataTransfer.effectAllowed = "move";
      setDragId(t.id);
    },
    onDragEnd: () => {
      setDragId(null);
      setOverDay(null);
    },
  });

  return (
    <div className="space-y-3">
      {/* סרגל כלים */}
      <div className="flex items-center gap-2">
        <h2 className="min-w-[9rem] text-lg font-bold sm:text-xl">{monthTitle}</h2>
        <div className="flex items-center">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="חודש קודם"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="חודש הבא"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
        <button onClick={goToday} disabled={isThisMonth} className={`${btnGhost} ms-1 h-9`}>
          היום
        </button>
      </div>

      {/* הלוח */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="grid grid-cols-7 border-b border-line bg-bg/60">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`py-2 text-center text-xs font-semibold text-muted ${i < 6 ? "border-e border-line/70" : ""}`}>
              <span className="hidden sm:inline">{w}</span>
              <span className="sm:hidden">{WEEKDAYS_SHORT[i]}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}>
          {days.map((d, i) => {
            const ymd = toYMD(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = ymd === today;
            const list = byDay.get(ymd) ?? [];
            const col = i % 7;
            const isOver = overDay === ymd;
            const hidden = Math.max(0, list.length - MAX_CHIPS);
            const dayLabel =
              d.getDate() === 1 ? d.toLocaleDateString("he-IL", { day: "numeric", month: "short" }) : String(d.getDate());

            return (
              <div
                key={ymd}
                onClick={() => onCellClick(ymd)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overDay !== ymd) setOverDay(ymd);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverDay(null);
                }}
                onDrop={(e) => onDrop(ymd, e)}
                className={`group relative min-h-[64px] cursor-pointer border-line/70 p-1 transition sm:min-h-[112px] sm:p-1.5 ${
                  col < 6 ? "border-e" : ""
                } ${i < days.length - 7 ? "border-b" : ""} ${
                  col >= 5 ? "bg-bg/40" : ""
                } ${isOver ? "!bg-brand-soft" : "hover:bg-bg/70"}`}
                style={isOver ? { boxShadow: `inset 0 0 0 2px ${space.color}` } : undefined}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums sm:h-7 sm:min-w-7 sm:text-[13px] ${
                      isToday ? "text-white" : inMonth ? "text-ink" : "text-muted/50"
                    }`}
                    style={isToday ? { background: space.color } : undefined}
                  >
                    {dayLabel}
                  </span>
                  <span className="hidden h-6 w-6 items-center justify-center rounded-full text-muted opacity-0 transition group-hover:opacity-100 sm:flex">
                    <Plus size={14} />
                  </span>
                </div>

                {/* מחשב: פסי משימות */}
                <div className="mt-0.5 hidden space-y-1 sm:block">
                  {list.slice(0, MAX_CHIPS).map((t) => (
                    <TaskChip key={t.id} task={t} dragging={dragId === t.id} onOpen={() => openTask(t.id)} drag={dragProps(t)} />
                  ))}
                  {hidden > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDayDialog(ymd);
                      }}
                      className="w-full rounded px-1.5 py-0.5 text-start text-xs font-semibold text-muted transition hover:bg-line/60 hover:text-ink"
                    >
                      +{hidden} נוספות
                    </button>
                  )}
                </div>

                {/* נייד: נקודות */}
                {list.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 6).map((t) => (
                      <span
                        key={t.id}
                        className="h-2 w-2 rounded-full"
                        style={{ background: priorityMeta(t.priority).color, opacity: t.status === "done" ? 0.35 : 1 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* משימות בלי תאריך */}
      {undated.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-3 shadow-card">
          <div className="mb-2 text-xs font-semibold text-muted">
            ללא תאריך יעד ({undated.length}) · אפשר לגרור ללוח
          </div>
          <div className="flex flex-wrap gap-1.5">
            {undated.map((t) => (
              <div key={t.id} className="max-w-full sm:max-w-xs">
                <TaskChip task={t} dragging={dragId === t.id} onOpen={() => openTask(t.id)} drag={dragProps(t)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {dayDialog && (
        <Modal
          title={formatLong(dayDialog)}
          onClose={() => setDayDialog(null)}
          width="max-w-md"
          footer={
            <button
              className={btnPrimary}
              style={{ background: space.color }}
              onClick={() => {
                const d = dayDialog;
                setDayDialog(null);
                openNewTask({ space_id: space.id, due_date: d });
              }}
            >
              <Plus size={16} /> משימה חדשה בתאריך הזה
            </button>
          }
        >
          {(byDay.get(dayDialog) ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">אין משימות ביום הזה</p>
          ) : (
            <ul className="space-y-1.5">
              {(byDay.get(dayDialog) ?? []).map((t) => (
                <li key={t.id}>
                  <TaskChip
                    task={t}
                    large
                    onOpen={() => {
                      setDayDialog(null);
                      openTask(t.id);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}

function TaskChip({
  task,
  onOpen,
  drag,
  dragging,
  large,
}: {
  task: Task;
  onOpen: () => void;
  drag?: React.HTMLAttributes<HTMLDivElement>;
  dragging?: boolean;
  large?: boolean;
}) {
  const color = priorityMeta(task.priority).color;
  const done = task.status === "done";
  return (
    <div
      {...drag}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title={task.title}
      className={`flex cursor-pointer items-center overflow-hidden rounded-md border-s-[3px] text-start transition hover:brightness-95 ${
        large ? "px-3 py-2 text-sm" : "px-1.5 py-[3px] text-xs"
      } ${dragging ? "opacity-40" : ""}`}
      style={{ background: `${color}${done ? "10" : "20"}`, borderColor: color }}
    >
      <span className={`truncate font-medium ${done ? "text-muted line-through" : "text-ink"}`}>{task.title}</span>
    </div>
  );
}
