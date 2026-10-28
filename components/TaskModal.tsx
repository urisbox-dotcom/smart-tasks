"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { PRIORITIES, STATUSES } from "@/lib/constants";
import type { Priority, Status, Task } from "@/lib/types";
import { useStore } from "./store";
import { Modal, btnGhost, btnPrimary, inputCls } from "./ui";

export default function TaskModal() {
  const { taskModal, tasks, closeTask } = useStore();
  if (!taskModal) return null;
  const existing = taskModal.mode === "edit" ? tasks.find((t) => t.id === taskModal.id) : undefined;
  if (taskModal.mode === "edit" && !existing) return null;
  // key מאפס את הטופס בכל פתיחה
  const key = taskModal.mode === "edit" ? taskModal.id : `new-${JSON.stringify(taskModal.defaults)}`;
  return <TaskForm key={key} existing={existing} defaults={taskModal.mode === "new" ? taskModal.defaults : {}} onClose={closeTask} />;
}

function TaskForm({
  existing,
  defaults,
  onClose,
}: {
  existing?: Task;
  defaults: Partial<Pick<Task, "space_id" | "due_date" | "status" | "priority">>;
  onClose: () => void;
}) {
  const { spaces, createTask, updateTask, deleteTask } = useStore();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? defaults.priority ?? "medium");
  const [status, setStatus] = useState<Status>(existing?.status ?? defaults.status ?? "new");
  const [dueDate, setDueDate] = useState(existing?.due_date ?? defaults.due_date ?? "");
  const [spaceId, setSpaceId] = useState(existing?.space_id ?? defaults.space_id ?? spaces[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const space = spaces.find((s) => s.id === spaceId);
  const canSave = title.trim().length > 0 && !!spaceId && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    const data = {
      title: title.trim(),
      description,
      priority,
      status,
      due_date: dueDate || null,
      space_id: spaceId,
    };
    if (existing) await updateTask(existing.id, data);
    else await createTask(data);
    onClose();
  }

  async function remove() {
    if (!existing) return;
    await deleteTask(existing.id);
    onClose();
  }

  return (
    <Modal
      title={existing ? "עריכת משימה" : "משימה חדשה"}
      onClose={onClose}
      footer={
        <>
          <button onClick={save} disabled={!canSave} className={btnPrimary}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {existing ? "שמירה" : "יצירת משימה"}
          </button>
          <button onClick={onClose} className={btnGhost}>
            ביטול
          </button>
          {existing && (
            <div className="ms-auto">
              {confirmDelete ? (
                <span className="flex items-center gap-2 text-sm">
                  למחוק?
                  <button onClick={remove} className="h-9 rounded-lg bg-red-600 px-3 font-semibold text-white hover:bg-red-700">
                    כן, מחק
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="h-9 rounded-lg px-2 text-muted hover:text-ink">
                    לא
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  aria-label="מחיקת משימה"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="t-title">
            כותרת
          </label>
          <input
            id="t-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="מה צריך לעשות?"
            className={`${inputCls} h-11 text-base`}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="t-desc">
            תיאור
          </label>
          <textarea
            id="t-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="פרטים נוספים (לא חובה)"
            className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div>
          <div className="mb-1.5 text-sm font-medium">עדיפות</div>
          <div className="grid grid-cols-4 gap-1.5">
            {PRIORITIES.slice()
              .reverse()
              .map((p) => {
                const on = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    aria-pressed={on}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition"
                    style={
                      on
                        ? { background: `${p.color}1f`, borderColor: p.color, color: "#1c2033" }
                        : { borderColor: "#e6e8ef", color: "#6b7185" }
                    }
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    {p.label}
                  </button>
                );
              })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-sm font-medium">סטטוס</div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {STATUSES.map((s) => {
              const on = status === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  aria-pressed={on}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition"
                  style={
                    on
                      ? { background: `${s.color}1f`, borderColor: s.color, color: "#1c2033" }
                      : { borderColor: "#e6e8ef", color: "#6b7185" }
                  }
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="t-due">
              תאריך יעד
            </label>
            <div className="flex gap-1.5">
              <input id="t-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate("")}
                  aria-label="הסר תאריך"
                  className="h-10 shrink-0 rounded-lg px-2 text-xs text-muted hover:bg-bg hover:text-ink"
                >
                  נקה
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="t-space">
              מרחב
            </label>
            <div className="relative">
              <span
                className="pointer-events-none absolute start-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
                style={{ background: space?.color }}
              />
              <select id="t-space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={`${inputCls} ps-8`}>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
