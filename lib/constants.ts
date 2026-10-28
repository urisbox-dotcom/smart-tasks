import type { Priority, Status, ViewType } from "./types";

export const PRIORITIES: { value: Priority; label: string; color: string; rank: number }[] = [
  { value: "urgent", label: "דחוף", color: "#ef4444", rank: 4 },
  { value: "high", label: "גבוהה", color: "#f97316", rank: 3 },
  { value: "medium", label: "בינונית", color: "#eab308", rank: 2 },
  { value: "low", label: "נמוכה", color: "#64748b", rank: 1 },
];

export const STATUSES: { value: Status; label: string; color: string }[] = [
  { value: "new", label: "חדשה", color: "#8b5cf6" },
  { value: "in_progress", label: "בעבודה", color: "#0ea5e9" },
  { value: "paused", label: "בהשהייה", color: "#a1a1aa" },
  { value: "done", label: "הושלמה", color: "#22c55e" },
];

export const VIEWS: { value: ViewType; label: string; hint: string }[] = [
  { value: "kanban", label: "קנבן", hint: "עמודות לפי סטטוס, גרירה בין עמודות" },
  { value: "list", label: "רשימה", hint: "רשימת TODO עם וי, לפי עדיפות" },
  { value: "calendar", label: "לוח שנה", hint: "חודש שלם, משימה על תאריך היעד" },
];

export const SPACE_COLORS = [
  "#4f46e5",
  "#0d9488",
  "#db2777",
  "#ea580c",
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#ca8a04",
  "#e11d48",
  "#0891b2",
];

export const priorityMeta = (p: Priority) => PRIORITIES.find((x) => x.value === p)!;
export const statusMeta = (s: Status) => STATUSES.find((x) => x.value === s)!;
export const priorityRank = (p: Priority) => priorityMeta(p).rank;
