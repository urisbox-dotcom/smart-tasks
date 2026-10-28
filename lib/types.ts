export type Priority = "low" | "medium" | "high" | "urgent";
export type Status = "new" | "in_progress" | "paused" | "done";
export type ViewType = "kanban" | "list" | "calendar";

export interface Space {
  id: string;
  name: string;
  color: string;
  view: ViewType;
  position: number;
}

export interface Task {
  id: string;
  space_id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  due_date: string | null; // YYYY-MM-DD
  completed_at: string | null; // ISO
  created_at: string;
  updated_at: string;
}

export interface Settings {
  dashboard_spaces: string[] | null; // null = כל המרחבים
}

export type TaskInput = Partial<
  Pick<Task, "title" | "description" | "priority" | "status" | "due_date" | "space_id">
>;

export type Scope = { type: "all" } | { type: "space"; id: string };

export interface PendingAction {
  id: string;
  kind: "update" | "delete" | "add";
  count: number;
  description: string;
  titles: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
