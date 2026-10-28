"use client";

import Link from "next/link";
import { CalendarDays, Columns3, ListTodo, Pencil, Plus, SearchX } from "lucide-react";
import { VIEWS } from "@/lib/constants";
import type { ViewType } from "@/lib/types";
import { useStore } from "./store";
import { Empty, btnPrimary } from "./ui";
import KanbanView from "./KanbanView";
import ListView from "./ListView";
import CalendarView from "./CalendarView";

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  kanban: <Columns3 size={16} />,
  list: <ListTodo size={16} />,
  calendar: <CalendarDays size={16} />,
};

export default function SpaceView({ spaceId }: { spaceId: string }) {
  const { spaces, tasks, loaded, updateSpace, openNewTask, openEditSpace } = useStore();
  const space = spaces.find((s) => s.id === spaceId);

  if (!loaded) {
    return (
      <div className="space-y-5">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-line/70" />
        <div className="h-96 animate-pulse rounded-2xl bg-line/60" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="pt-16">
        <Empty icon={<SearchX size={22} />} title="המרחב לא נמצא" hint="יכול להיות שהוא נמחק." />
        <div className="text-center">
          <Link href="/" className={btnPrimary}>
            חזרה לדשבורד
          </Link>
        </div>
      </div>
    );
  }

  const spaceTasks = tasks.filter((t) => t.space_id === space.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ background: space.color }} />
        <h1 className="text-2xl font-bold">{space.name}</h1>
        <button
          onClick={() => openEditSpace(space.id)}
          aria-label="עריכת מרחב"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-ink"
        >
          <Pencil size={16} />
        </button>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="תצוגה" className="flex rounded-lg border border-line bg-surface p-0.5 shadow-card">
            {VIEWS.map((v) => {
              const on = space.view === v.value;
              return (
                <button
                  key={v.value}
                  role="tab"
                  aria-selected={on}
                  onClick={() => !on && updateSpace(space.id, { view: v.value })}
                  className={`flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition ${
                    on ? "text-white" : "text-muted hover:text-ink"
                  }`}
                  style={on ? { background: space.color } : undefined}
                >
                  {VIEW_ICONS[v.value]}
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => openNewTask({ space_id: space.id })} className={btnPrimary} style={{ background: space.color }}>
            <Plus size={16} /> משימה חדשה
          </button>
        </div>
      </div>

      {space.view === "kanban" && <KanbanView space={space} tasks={spaceTasks} />}
      {space.view === "list" && <ListView space={space} tasks={spaceTasks} />}
      {space.view === "calendar" && <CalendarView space={space} tasks={spaceTasks} />}
    </div>
  );
}
