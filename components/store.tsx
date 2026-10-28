"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Settings, Space, Task, TaskInput, ViewType } from "@/lib/types";

async function api<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "שגיאה");
  }
  return res.json();
}

export type TaskModalState =
  | { mode: "edit"; id: string }
  | { mode: "new"; defaults: Partial<TaskInput> & { space_id?: string } }
  | null;

export type SpaceModalState = { mode: "new" } | { mode: "edit"; id: string } | null;

interface StoreValue {
  spaces: Space[];
  tasks: Task[];
  loaded: boolean;
  loadError: string;
  dashboardSpaceIds: string[];
  refresh: () => Promise<void>;
  createTask: (input: TaskInput & { space_id: string; title: string }) => Promise<Task | null>;
  updateTask: (id: string, patch: TaskInput) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createSpace: (input: { name: string; color: string; view: ViewType }) => Promise<Space | null>;
  updateSpace: (id: string, patch: Partial<Pick<Space, "name" | "color" | "view">>) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  setDashboardSpaces: (ids: string[]) => void;
  taskModal: TaskModalState;
  openTask: (id: string) => void;
  openNewTask: (defaults: Partial<TaskInput> & { space_id?: string }) => void;
  closeTask: () => void;
  spaceModal: SpaceModalState;
  openNewSpace: () => void;
  openEditSpace: (id: string) => void;
  closeSpaceModal: () => void;
  toast: (message: string) => void;
  toastMessage: string;
}

const Ctx = createContext<StoreValue | null>(null);

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}

function applyPatch(t: Task, patch: TaskInput): Task {
  const next: Task = { ...t, ...patch } as Task;
  if (patch.status !== undefined) {
    next.completed_at = patch.status === "done" ? (t.completed_at ?? new Date().toISOString()) : null;
  }
  return next;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<Settings>({ dashboard_spaces: null });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [taskModal, setTaskModal] = useState<TaskModalState>(null);
  const [spaceModal, setSpaceModal] = useState<SpaceModalState>(null);
  const [toastMessage, setToastMessage] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(""), 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ spaces: Space[]; tasks: Task[]; settings: Settings }>("/api/data", "GET");
      setSpaces(data.spaces);
      setTasks(data.tasks);
      setSettings(data.settings);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "שגיאה בטעינה");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTask: StoreValue["createTask"] = useCallback(
    async (input) => {
      try {
        const t = await api<Task>("/api/tasks", "POST", input);
        setTasks((prev) => [...prev, t]);
        return t;
      } catch (e) {
        toast(e instanceof Error ? e.message : "לא הצלחתי ליצור את המשימה");
        return null;
      }
    },
    [toast],
  );

  const updateTask: StoreValue["updateTask"] = useCallback(
    async (id, patch) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? applyPatch(t, patch) : t)));
      try {
        const saved = await api<Task>(`/api/tasks/${id}`, "PATCH", patch);
        setTasks((prev) => prev.map((t) => (t.id === id ? saved : t)));
      } catch (e) {
        toast(e instanceof Error ? e.message : "לא הצלחתי לשמור");
        refresh();
      }
    },
    [refresh, toast],
  );

  const deleteTask: StoreValue["deleteTask"] = useCallback(
    async (id) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      try {
        await api(`/api/tasks/${id}`, "DELETE");
      } catch {
        toast("לא הצלחתי למחוק");
        refresh();
      }
    },
    [refresh, toast],
  );

  const createSpace: StoreValue["createSpace"] = useCallback(
    async (input) => {
      try {
        const s = await api<Space>("/api/spaces", "POST", input);
        setSpaces((prev) => [...prev, s]);
        setSettings((prev) =>
          prev.dashboard_spaces ? { dashboard_spaces: [...prev.dashboard_spaces, s.id] } : prev,
        );
        if (settings.dashboard_spaces) {
          api("/api/settings", "PUT", { dashboard_spaces: [...settings.dashboard_spaces, s.id] }).catch(() => {});
        }
        return s;
      } catch (e) {
        toast(e instanceof Error ? e.message : "לא הצלחתי ליצור את המרחב");
        return null;
      }
    },
    [settings.dashboard_spaces, toast],
  );

  const updateSpace: StoreValue["updateSpace"] = useCallback(
    async (id, patch) => {
      setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      try {
        const saved = await api<Space>(`/api/spaces/${id}`, "PATCH", patch);
        setSpaces((prev) => prev.map((s) => (s.id === id ? saved : s)));
      } catch {
        toast("לא הצלחתי לשמור");
        refresh();
      }
    },
    [refresh, toast],
  );

  const deleteSpace: StoreValue["deleteSpace"] = useCallback(
    async (id) => {
      setSpaces((prev) => prev.filter((s) => s.id !== id));
      setTasks((prev) => prev.filter((t) => t.space_id !== id));
      try {
        await api(`/api/spaces/${id}`, "DELETE");
      } catch {
        toast("לא הצלחתי למחוק את המרחב");
        refresh();
      }
    },
    [refresh, toast],
  );

  const dashboardSpaceIds = useMemo(() => {
    const all = spaces.map((s) => s.id);
    if (!settings.dashboard_spaces) return all;
    return settings.dashboard_spaces.filter((id) => all.includes(id));
  }, [spaces, settings.dashboard_spaces]);

  const setDashboardSpaces = useCallback((ids: string[]) => {
    setSettings({ dashboard_spaces: ids });
    api("/api/settings", "PUT", { dashboard_spaces: ids }).catch(() => {});
  }, []);

  const value: StoreValue = {
    spaces,
    tasks,
    loaded,
    loadError,
    dashboardSpaceIds,
    refresh,
    createTask,
    updateTask,
    deleteTask,
    createSpace,
    updateSpace,
    deleteSpace,
    setDashboardSpaces,
    taskModal,
    openTask: (id) => setTaskModal({ mode: "edit", id }),
    openNewTask: (defaults) => setTaskModal({ mode: "new", defaults }),
    closeTask: () => setTaskModal(null),
    spaceModal,
    openNewSpace: () => setSpaceModal({ mode: "new" }),
    openEditSpace: (id) => setSpaceModal({ mode: "edit", id }),
    closeSpaceModal: () => setSpaceModal(null),
    toast,
    toastMessage,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
