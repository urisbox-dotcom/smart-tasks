"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Flame, Plus } from "lucide-react";
import { formatLong, startOfWeek, todayStr, toYMD } from "@/lib/dates";
import type { Space, Task } from "@/lib/types";
import { useStore } from "./store";
import { DueChip, Empty, PriorityChip, btnPrimary, compareImportance, isOverdueTask } from "./ui";

export default function Dashboard() {
  const { spaces, tasks, loaded, loadError, dashboardSpaceIds, setDashboardSpaces, openNewSpace, openTask, refresh } = useStore();
  const today = todayStr();

  if (!loaded) return <DashboardSkeleton />;
  if (loadError)
    return (
      <Empty
        icon={<AlertTriangle size={22} />}
        title="לא הצלחתי לטעון את הנתונים"
        hint={loadError}
      />
    );

  if (spaces.length === 0)
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <Empty icon={<Plus size={22} />} title="עוד אין מרחבים" hint="מרחב הוא קבוצה של משימות, למשל בית, עבודה או לימודים." />
        <button onClick={openNewSpace} className={`${btnPrimary} mt-2`}>
          <Plus size={16} /> מרחב חדש
        </button>
      </div>
    );

  const selected = new Set(dashboardSpaceIds);
  const visibleSpaces = spaces.filter((s) => selected.has(s.id));
  const spaceById = new Map(spaces.map((s) => [s.id, s]));
  const scoped = tasks.filter((t) => selected.has(t.space_id) && t.status !== "done");

  const urgent = scoped.filter((t) => t.priority === "urgent").sort(compareImportance);
  const dueToday = scoped.filter((t) => t.due_date === today).sort(compareImportance);
  const overdue = scoped.filter((t) => isOverdueTask(t, today)).sort((a, b) => a.due_date!.localeCompare(b.due_date!));

  const toggle = (id: string) => {
    const next = selected.has(id) ? dashboardSpaceIds.filter((x) => x !== id) : [...dashboardSpaceIds, id];
    setDashboardSpaces(next);
  };

  const weekStart = startOfWeek(today);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">דשבורד</h1>
          <p className="mt-0.5 text-sm text-muted">{formatLong(today)}</p>
        </div>
        <button onClick={refresh} className="sr-only">
          רענון
        </button>
      </div>

      {/* בחירת מרחבים */}
      <section aria-label="בחירת מרחבים">
        <div className="mb-2 text-sm font-medium text-muted">מרחבים להצגה</div>
        <div className="flex flex-wrap gap-2">
          {spaces.map((s) => {
            const on = selected.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                aria-pressed={on}
                className="flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition"
                style={
                  on
                    ? { background: `${s.color}18`, borderColor: s.color, color: "#1c2033" }
                    : { background: "#fff", borderColor: "#e6e8ef", color: "#6b7185" }
                }
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? s.color : "#c9cdd9" }} />
                {s.name}
              </button>
            );
          })}
        </div>
      </section>

      {visibleSpaces.length === 0 ? (
        <Empty icon={<CheckCircle2 size={22} />} title="לא נבחר אף מרחב" hint="בחר לפחות מרחב אחד למעלה כדי לראות את המשימות שלו." />
      ) : (
        <>
          {/* מה דורש תשומת לב */}
          <section aria-label="משימות חשובות" className="grid gap-4 lg:grid-cols-3">
            <AttentionList
              title="דחוף"
              icon={<Flame size={18} />}
              color="#ef4444"
              tasks={urgent}
              spaceById={spaceById}
              empty="אין משימות דחופות"
              onOpen={openTask}
            />
            <AttentionList
              title="להיום"
              icon={<CalendarClock size={18} />}
              color="#f59e0b"
              tasks={dueToday}
              spaceById={spaceById}
              empty="אין משימות להיום"
              onOpen={openTask}
            />
            <AttentionList
              title="באיחור"
              icon={<AlertTriangle size={18} />}
              color="#dc2626"
              tasks={overdue}
              spaceById={spaceById}
              empty="אין משימות באיחור"
              onOpen={openTask}
            />
          </section>

          {/* כרטיס לכל מרחב */}
          <section aria-label="סיכום לפי מרחב">
            <h2 className="mb-3 text-base font-bold">המרחבים שלי</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleSpaces.map((s) => (
                <SpaceCard key={s.id} space={s} tasks={tasks.filter((t) => t.space_id === s.id)} today={today} weekStart={weekStart} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function AttentionList({
  title,
  icon,
  color,
  tasks,
  spaceById,
  empty,
  onOpen,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  tasks: Task[];
  spaceById: Map<string, Space>;
  empty: string;
  onOpen: (id: string) => void;
}) {
  const MAX = 6;
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${color}1a`, color }}>
          {icon}
        </span>
        <h2 className="font-bold">{title}</h2>
        <span className="ms-auto rounded-full bg-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-muted">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-8 text-sm text-muted">{empty}</div>
      ) : (
        <ul className="divide-y divide-line">
          {tasks.slice(0, MAX).map((t) => {
            const sp = spaceById.get(t.space_id);
            return (
              <li key={t.id}>
                <button onClick={() => onOpen(t.id)} className="flex w-full flex-col gap-1.5 px-4 py-2.5 text-start transition hover:bg-bg">
                  <span className="text-sm font-medium leading-snug">{t.title}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: sp?.color }} />
                      {sp?.name}
                    </span>
                    <PriorityChip priority={t.priority} />
                    <DueChip task={t} />
                  </span>
                </button>
              </li>
            );
          })}
          {tasks.length > MAX && <li className="px-4 py-2 text-xs text-muted">ועוד {tasks.length - MAX}...</li>}
        </ul>
      )}
    </div>
  );
}

function SpaceCard({ space, tasks, today, weekStart }: { space: Space; tasks: Task[]; today: string; weekStart: string }) {
  const open = tasks.filter((t) => t.status !== "done").length;
  const overdue = tasks.filter((t) => isOverdueTask(t, today)).length;
  const closedThisWeek = tasks.filter((t) => t.completed_at && toYMD(new Date(t.completed_at)) >= weekStart).length;

  return (
    <Link
      href={`/spaces/${space.id}`}
      className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop"
    >
      <span className="absolute inset-y-0 start-0 w-1.5" style={{ background: space.color }} />
      <div className="mb-4 flex items-center gap-2.5 ps-1.5">
        <span className="h-3 w-3 rounded-full" style={{ background: space.color }} />
        <h3 className="font-bold">{space.name}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 ps-1.5">
        <Stat label="פתוחות" value={open} />
        <Stat label="באיחור" value={overdue} tone={overdue > 0 ? "text-red-600" : undefined} />
        <Stat label="נסגרו השבוע" value={closedThisWeek} tone={closedThisWeek > 0 ? "text-emerald-600" : undefined} />
      </div>
    </Link>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold tabular-nums ${tone ?? ""}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-line/70" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-line/70" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-line/60" />
        ))}
      </div>
    </div>
  );
}
