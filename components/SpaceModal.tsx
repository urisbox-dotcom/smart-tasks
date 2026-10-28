"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Columns3, ListTodo, Loader2, Trash2 } from "lucide-react";
import { SPACE_COLORS, VIEWS } from "@/lib/constants";
import type { Space, ViewType } from "@/lib/types";
import { useStore } from "./store";
import { Modal, btnGhost, btnPrimary, inputCls } from "./ui";

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  kanban: <Columns3 size={22} />,
  list: <ListTodo size={22} />,
  calendar: <CalendarDays size={22} />,
};

export default function SpaceModal() {
  const { spaceModal, spaces, closeSpaceModal } = useStore();
  if (!spaceModal) return null;
  const existing = spaceModal.mode === "edit" ? spaces.find((s) => s.id === spaceModal.id) : undefined;
  if (spaceModal.mode === "edit" && !existing) return null;
  return <SpaceForm key={existing?.id ?? "new"} existing={existing} onClose={closeSpaceModal} />;
}

function SpaceForm({ existing, onClose }: { existing?: Space; onClose: () => void }) {
  const { spaces, createSpace, updateSpace, deleteSpace } = useStore();
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState(existing?.color ?? SPACE_COLORS[spaces.length % SPACE_COLORS.length]);
  const [view, setView] = useState<ViewType>(existing?.view ?? "kanban");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canSave = name.trim().length > 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    if (existing) {
      await updateSpace(existing.id, { name: name.trim(), color, view });
      onClose();
    } else {
      const s = await createSpace({ name: name.trim(), color, view });
      onClose();
      if (s) router.push(`/spaces/${s.id}`);
    }
  }

  async function remove() {
    if (!existing) return;
    await deleteSpace(existing.id);
    onClose();
    router.push("/");
  }

  return (
    <Modal
      title={existing ? "עריכת מרחב" : "מרחב חדש"}
      onClose={onClose}
      footer={
        <>
          <button onClick={save} disabled={!canSave} className={btnPrimary}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {existing ? "שמירה" : "יצירת מרחב"}
          </button>
          <button onClick={onClose} className={btnGhost}>
            ביטול
          </button>
          {existing && (
            <div className="ms-auto">
              {confirmDelete ? (
                <span className="flex items-center gap-2 text-sm">
                  למחוק עם כל המשימות?
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
                  aria-label="מחיקת מרחב"
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
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="s-name">
            שם המרחב
          </label>
          <input
            id="s-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="למשל: בית, עבודה, לימודים"
            className={`${inputCls} h-11 text-base`}
          />
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">צבע</div>
          <div className="flex flex-wrap gap-2">
            {SPACE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`צבע ${c}`}
                aria-pressed={color === c}
                className="flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 transition hover:scale-110"
                style={{ background: c, boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }}
              >
                {color === c && <Check size={16} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">תצוגה</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {VIEWS.map((v) => {
              const on = view === v.value;
              return (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setView(v.value)}
                  aria-pressed={on}
                  className="flex flex-col items-start gap-1.5 rounded-xl border p-3 text-start transition"
                  style={on ? { borderColor: color, background: `${color}12` } : { borderColor: "#e6e8ef" }}
                >
                  <span style={{ color: on ? color : "#6b7185" }}>{VIEW_ICONS[v.value]}</span>
                  <span className="text-sm font-semibold">{v.label}</span>
                  <span className="text-xs leading-snug text-muted">{v.hint}</span>
                </button>
              );
            })}
          </div>
          {existing && <p className="mt-2 text-xs text-muted">אפשר להחליף תצוגה גם מתוך המרחב עצמו.</p>}
        </div>
      </div>
    </Modal>
  );
}
