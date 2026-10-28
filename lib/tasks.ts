import { query } from "./db";
import type { Priority, Settings, Space, Status, Task, TaskInput, ViewType } from "./types";

const PRIORITY_VALUES: Priority[] = ["low", "medium", "high", "urgent"];
const STATUS_VALUES: Status[] = ["new", "in_progress", "paused", "done"];
const VIEW_VALUES: ViewType[] = ["kanban", "list", "calendar"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isPriority = (v: unknown): v is Priority => PRIORITY_VALUES.includes(v as Priority);
export const isStatus = (v: unknown): v is Status => STATUS_VALUES.includes(v as Status);
export const isView = (v: unknown): v is ViewType => VIEW_VALUES.includes(v as ViewType);
export const isDate = (v: unknown): v is string => typeof v === "string" && DATE_RE.test(v);

const TASK_COLS = `id, space_id, title, description, priority, status, due_date, completed_at, created_at, updated_at`;

/** מנקה קלט משימה: משאיר רק שדות חוקיים */
export function cleanTaskInput(raw: Record<string, unknown>): TaskInput {
  const out: TaskInput = {};
  if (typeof raw.title === "string") out.title = raw.title.trim().slice(0, 300);
  if (typeof raw.description === "string") out.description = raw.description.slice(0, 5000);
  if (isPriority(raw.priority)) out.priority = raw.priority;
  if (isStatus(raw.status)) out.status = raw.status;
  if (raw.due_date === null || raw.due_date === "") out.due_date = null;
  else if (isDate(raw.due_date)) out.due_date = raw.due_date;
  if (typeof raw.space_id === "string") out.space_id = raw.space_id;
  return out;
}

export async function listSpaces(): Promise<Space[]> {
  return query<Space>(`SELECT id, name, color, view, position FROM spaces ORDER BY position, created_at`);
}

export async function listTasks(spaceIds?: string[]): Promise<Task[]> {
  if (spaceIds) {
    if (!spaceIds.length) return [];
    return query<Task>(
      `SELECT ${TASK_COLS} FROM tasks WHERE space_id = ANY($1::uuid[]) ORDER BY created_at`,
      [spaceIds],
    );
  }
  return query<Task>(`SELECT ${TASK_COLS} FROM tasks ORDER BY created_at`);
}

export async function getSettings(): Promise<Settings> {
  const rows = await query<{ key: string; value: unknown }>(`SELECT key, value FROM settings`);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const ds = map.dashboard_spaces;
  return { dashboard_spaces: Array.isArray(ds) ? (ds as string[]) : null };
}

export async function setSetting(key: string, value: unknown) {
  await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  );
}

export async function createTask(
  input: TaskInput & { space_id: string; title: string },
): Promise<Task> {
  const status = input.status ?? "new";
  const rows = await query<Task>(
    `INSERT INTO tasks (space_id, title, description, priority, status, due_date, completed_at)
     VALUES ($1, $2, $3, $4, $5::text, $6, CASE WHEN $5::text = 'done' THEN now() ELSE NULL END)
     RETURNING ${TASK_COLS}`,
    [
      input.space_id,
      input.title,
      input.description ?? "",
      input.priority ?? "medium",
      status,
      input.due_date ?? null,
    ],
  );
  return rows[0];
}

export async function updateTask(id: string, patch: TaskInput): Promise<Task | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.title !== undefined) add("title", patch.title);
  if (patch.description !== undefined) add("description", patch.description);
  if (patch.priority !== undefined) add("priority", patch.priority);
  if (patch.due_date !== undefined) add("due_date", patch.due_date);
  if (patch.space_id !== undefined) add("space_id", patch.space_id);
  if (patch.status !== undefined) {
    add("status", patch.status);
    sets.push(
      patch.status === "done" ? `completed_at = COALESCE(completed_at, now())` : `completed_at = NULL`,
    );
  }
  if (!sets.length) {
    const rows = await query<Task>(`SELECT ${TASK_COLS} FROM tasks WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }
  sets.push(`updated_at = now()`);
  params.push(id);
  const rows = await query<Task>(
    `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${TASK_COLS}`,
    params,
  );
  return rows[0] ?? null;
}

export async function deleteTasks(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const rows = await query(`DELETE FROM tasks WHERE id = ANY($1::uuid[]) RETURNING id`, [ids]);
  return rows.length;
}

export async function createSpace(input: {
  name: string;
  color: string;
  view: ViewType;
}): Promise<Space> {
  const rows = await query<Space>(
    `INSERT INTO spaces (name, color, view, position)
     VALUES ($1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM spaces), 0))
     RETURNING id, name, color, view, position`,
    [input.name, input.color, input.view],
  );
  return rows[0];
}

export async function updateSpace(
  id: string,
  patch: Partial<Pick<Space, "name" | "color" | "view">>,
): Promise<Space | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const col of ["name", "color", "view"] as const) {
    if (patch[col] !== undefined) {
      params.push(patch[col]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (!sets.length) return null;
  params.push(id);
  const rows = await query<Space>(
    `UPDATE spaces SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING id, name, color, view, position`,
    params,
  );
  return rows[0] ?? null;
}

export async function deleteSpace(id: string) {
  await query(`DELETE FROM spaces WHERE id = $1`, [id]);
}
