import OpenAI from "openai";
import { query } from "./db";
import { PRIORITIES, STATUSES, priorityMeta, priorityRank, statusMeta } from "./constants";
import { addDays, startOfWeek, todayIsrael, weekdayName, ymdOfIso } from "./dates";
import {
  cleanTaskInput,
  createTask,
  deleteTasks,
  isDate,
  isPriority,
  isStatus,
  listSpaces,
  listTasks,
  updateTask,
} from "./tasks";
import type { ChatMessage, PendingAction, Scope, Space, Task, TaskInput } from "./types";

/** מעל כמה משימות נדרש אישור (מחיקה דורשת תמיד) */
export const CONFIRM_THRESHOLD = 3;
const MAX_STEPS = 8;

type NewTask = TaskInput & { space_id: string; title: string };
type PendingPayload =
  | { kind: "update"; ids: string[]; changes: TaskInput; allowed: string[]; description: string }
  | { kind: "delete"; ids: string[]; allowed: string[]; description: string }
  | { kind: "add"; items: NewTask[]; allowed: string[]; description: string };

interface Ctx {
  spaces: Space[]; // רק המרחבים שבטווח הפעולה
  scopeIsSingle: boolean;
  today: string;
  pending: PendingAction | null;
  actions: string[];
  mutated: boolean;
}

export interface AgentResult {
  reply: string;
  mutated: boolean;
  pending: PendingAction | null;
  actions: string[];
}

// ---------- כלים ----------

const filterProps = {
  space: { type: "string", description: "שם המרחב (או מזהה). אם מושמט - כל המרחבים שבטווח" },
  status: { type: "string", enum: STATUSES.map((s) => s.value), description: "סינון לפי סטטוס" },
  priority: { type: "string", enum: PRIORITIES.map((p) => p.value), description: "סינון לפי עדיפות" },
  overdue: { type: "boolean", description: "רק משימות באיחור (תאריך יעד לפני היום ולא הושלמו)" },
  due_today: { type: "boolean", description: "רק משימות שתאריך היעד שלהן היום" },
  due_on: { type: "string", description: "תאריך יעד מדויק YYYY-MM-DD" },
  due_before: { type: "string", description: "תאריך יעד לפני תאריך זה (לא כולל) YYYY-MM-DD" },
  due_after: { type: "string", description: "תאריך יעד אחרי תאריך זה (לא כולל) YYYY-MM-DD" },
  no_due_date: { type: "boolean", description: "רק משימות בלי תאריך יעד" },
  query: { type: "string", description: "חיפוש טקסט בכותרת" },
  include_done: {
    type: "boolean",
    description: "לכלול גם משימות שהושלמו. ברירת מחדל: לא (אלא אם status=done)",
  },
} as const;

const changeProps = {
  title: { type: "string" },
  description: { type: "string" },
  status: { type: "string", enum: STATUSES.map((s) => s.value) },
  priority: { type: "string", enum: PRIORITIES.map((p) => p.value) },
  due_date: { type: ["string", "null"], description: "YYYY-MM-DD, או null להסרת התאריך" },
  space: { type: "string", description: "העברה למרחב אחר (שם)" },
} as const;

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_tasks",
      description: "קורא משימות לפי סינון. מחזיר מזהים, כותרת, עדיפות, סטטוס ותאריך יעד.",
      parameters: { type: "object", properties: { ...filterProps, limit: { type: "integer" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "add_tasks",
      description: "מוסיף משימה אחת או יותר. כל משימה למרחב אחד.",
      parameters: {
        type: "object",
        required: ["tasks"],
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              required: ["title"],
              properties: {
                title: { type: "string" },
                space: { type: "string", description: "שם המרחב. חובה כשהטווח הוא כל המרחבים" },
                description: { type: "string" },
                priority: { type: "string", enum: PRIORITIES.map((p) => p.value) },
                status: { type: "string", enum: STATUSES.map((s) => s.value) },
                due_date: { type: "string", description: "YYYY-MM-DD" },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_tasks",
      description:
        "מעדכן משימות. מציינים אילו משימות: task_ids (מזהים) או filter (סינון, {} = כל המשימות הפתוחות בטווח). changes = מה לשנות. מעל 3 משימות נדרש אישור משתמש - הכלי יחזיר awaiting_user_confirmation.",
      parameters: {
        type: "object",
        required: ["changes"],
        properties: {
          task_ids: { type: "array", items: { type: "string" } },
          filter: { type: "object", properties: filterProps },
          changes: { type: "object", properties: changeProps },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_tasks",
      description:
        "מוחק משימות (task_ids או filter). כל מחיקה דורשת אישור משתמש - הכלי יחזיר awaiting_user_confirmation.",
      parameters: {
        type: "object",
        properties: {
          task_ids: { type: "array", items: { type: "string" } },
          filter: { type: "object", properties: filterProps },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_tasks",
      description:
        "סיכום מספרי של משימות: פתוחות, באיחור, להיום, לשבוע הקרוב, נסגרו השבוע, וה-5 החשובות ביותר. לשאלות על עדיפויות וסטטוס כללי.",
      parameters: { type: "object", properties: { space: { type: "string" } } },
    },
  },
];

// ---------- עזרים ----------

function resolveSpace(ctx: Ctx, ref: unknown): Space | null {
  if (typeof ref !== "string" || !ref.trim()) return null;
  const r = ref.trim().toLowerCase();
  return (
    ctx.spaces.find((s) => s.id === ref) ??
    ctx.spaces.find((s) => s.name.toLowerCase() === r) ??
    ctx.spaces.find((s) => s.name.toLowerCase().includes(r) || r.includes(s.name.toLowerCase())) ??
    null
  );
}

const isOverdue = (t: Task, today: string) => !!t.due_date && t.due_date < today && t.status !== "done";

function shape(ctx: Ctx, t: Task) {
  const space = ctx.spaces.find((s) => s.id === t.space_id);
  return {
    id: t.id,
    space: space?.name ?? "",
    title: t.title,
    priority: t.priority,
    status: t.status,
    due_date: t.due_date,
    overdue: isOverdue(t, ctx.today),
  };
}

function sortImportant(ctx: Ctx, tasks: Task[]) {
  const score = (t: Task) => {
    let s = priorityRank(t.priority) * 10;
    if (isOverdue(t, ctx.today)) s += 25;
    else if (t.due_date === ctx.today) s += 15;
    else if (t.due_date && t.due_date <= addDays(ctx.today, 3)) s += 6;
    return s;
  };
  return [...tasks].sort((a, b) => score(b) - score(a) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
}

type Filter = Record<string, unknown>;

async function selectTasks(
  ctx: Ctx,
  args: { task_ids?: unknown; filter?: unknown; space?: unknown } & Filter,
): Promise<{ tasks: Task[]; error?: string }> {
  const allowed = ctx.spaces.map((s) => s.id);
  const all = await listTasks(allowed);

  if (Array.isArray(args.task_ids)) {
    const ids = new Set(args.task_ids.filter((x): x is string => typeof x === "string"));
    return { tasks: all.filter((t) => ids.has(t.id)) };
  }

  const f: Filter =
    args.filter && typeof args.filter === "object" ? (args.filter as Filter) : (args as Filter);
  let spaceId: string | null = null;
  if (f.space !== undefined && f.space !== null && f.space !== "") {
    const sp = resolveSpace(ctx, f.space);
    if (!sp) return { tasks: [], error: `המרחב "${String(f.space)}" לא נמצא בטווח הפעולה הנוכחי` };
    spaceId = sp.id;
  }
  const q = typeof f.query === "string" ? f.query.trim().toLowerCase() : "";
  const explicitStatus = isStatus(f.status) ? f.status : null;

  const tasks = all.filter((t) => {
    if (spaceId && t.space_id !== spaceId) return false;
    if (explicitStatus) {
      if (t.status !== explicitStatus) return false;
    } else if (f.include_done !== true && t.status === "done") return false;
    if (isPriority(f.priority) && t.priority !== f.priority) return false;
    if (f.overdue === true && !isOverdue(t, ctx.today)) return false;
    if (f.due_today === true && t.due_date !== ctx.today) return false;
    if (isDate(f.due_on) && t.due_date !== f.due_on) return false;
    if (isDate(f.due_before) && !(t.due_date && t.due_date < f.due_before)) return false;
    if (isDate(f.due_after) && !(t.due_date && t.due_date > f.due_after)) return false;
    if (f.no_due_date === true && t.due_date) return false;
    if (q && !t.title.toLowerCase().includes(q)) return false;
    return true;
  });
  return { tasks };
}

function describeChanges(ctx: Ctx, changes: TaskInput): string {
  const parts: string[] = [];
  if (changes.status) parts.push(`סטטוס ← ${statusMeta(changes.status).label}`);
  if (changes.priority) parts.push(`עדיפות ← ${priorityMeta(changes.priority).label}`);
  if (changes.due_date !== undefined)
    parts.push(changes.due_date ? `תאריך יעד ← ${changes.due_date}` : "הסרת תאריך יעד");
  if (changes.title) parts.push(`כותרת ← ${changes.title}`);
  if (changes.space_id) {
    const sp = ctx.spaces.find((s) => s.id === changes.space_id);
    parts.push(`מרחב ← ${sp?.name ?? ""}`);
  }
  if (changes.description !== undefined) parts.push("תיאור");
  return parts.join(", ");
}

async function createPending(ctx: Ctx, payload: PendingPayload, count: number, titles: string[]) {
  const rows = await query<{ id: string }>(
    `INSERT INTO pending_actions (payload) VALUES ($1::jsonb) RETURNING id`,
    [JSON.stringify(payload)],
  );
  ctx.pending = {
    id: rows[0].id,
    kind: payload.kind,
    count,
    description: payload.description,
    titles: titles.slice(0, 5),
  };
}

const needsConfirmNote =
  "הפעולה עדיין לא בוצעה. אמור למשתמש בקצרה כמה משימות ישתנו ושהוא יכול לאשר או לבטל בכפתורים שמופיעים מתחת להודעה. אל תקרא שוב לכלי הזה.";

// ---------- ביצוע כלים ----------

async function runTool(ctx: Ctx, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "read_tasks": {
      const { tasks, error } = await selectTasks(ctx, args);
      if (error) return { error };
      const limit = Math.min(Math.max(Number(args.limit) || 100, 1), 200);
      const sorted = sortImportant(ctx, tasks);
      return { total: tasks.length, returned: Math.min(limit, tasks.length), tasks: sorted.slice(0, limit).map((t) => shape(ctx, t)) };
    }

    case "add_tasks": {
      const raw = Array.isArray(args.tasks) ? args.tasks : [];
      if (!raw.length) return { error: "לא התקבלו משימות להוספה" };
      const items: NewTask[] = [];
      for (const r of raw as Record<string, unknown>[]) {
        let space: Space | null = null;
        if (r.space) {
          space = resolveSpace(ctx, r.space);
          if (!space) return { error: `המרחב "${String(r.space)}" לא נמצא בטווח הפעולה הנוכחי` };
        } else if (ctx.spaces.length === 1) {
          space = ctx.spaces[0];
        } else {
          return { error: `חסר מרחב למשימה "${String(r.title)}". ציין באיזה מרחב להוסיף.` };
        }
        const input = cleanTaskInput(r);
        if (!input.title) return { error: "משימה בלי כותרת" };
        items.push({ ...input, title: input.title, space_id: space.id });
      }
      if (items.length > CONFIRM_THRESHOLD) {
        if (ctx.pending) return { error: "כבר ממתינה פעולה לאישור. בקש מהמשתמש לאשר או לבטל אותה קודם." };
        await createPending(
          ctx,
          { kind: "add", items, allowed: ctx.spaces.map((s) => s.id), description: `הוספת ${items.length} משימות` },
          items.length,
          items.map((i) => i.title),
        );
        return { status: "awaiting_user_confirmation", affected_count: items.length, note: needsConfirmNote };
      }
      const created = [];
      for (const it of items) created.push(await createTask(it));
      ctx.mutated = true;
      ctx.actions.push(created.length === 1 ? "נוספה משימה" : `נוספו ${created.length} משימות`);
      return { added: created.length, tasks: created.map((t) => shape(ctx, t)) };
    }

    case "update_tasks": {
      const changes = args.changes && typeof args.changes === "object" ? (args.changes as Record<string, unknown>) : {};
      const patch = cleanTaskInput(changes);
      delete patch.space_id;
      if (changes.space) {
        const sp = resolveSpace(ctx, changes.space);
        if (!sp) return { error: `המרחב "${String(changes.space)}" לא נמצא בטווח הפעולה הנוכחי` };
        patch.space_id = sp.id;
      }
      if (!Object.keys(patch).length) return { error: "לא התקבל שינוי תקין" };
      if (args.task_ids === undefined && args.filter === undefined)
        return { error: "חובה לציין task_ids או filter" };

      const { tasks, error } = await selectTasks(ctx, args);
      if (error) return { error };
      const affected = tasks.filter(
        (t) =>
          (patch.status !== undefined && t.status !== patch.status) ||
          (patch.priority !== undefined && t.priority !== patch.priority) ||
          (patch.due_date !== undefined && t.due_date !== patch.due_date) ||
          (patch.title !== undefined && t.title !== patch.title) ||
          (patch.space_id !== undefined && t.space_id !== patch.space_id) ||
          patch.description !== undefined,
      );
      if (!affected.length) return { updated: 0, note: "אין משימות שמתאימות או שכולן כבר במצב המבוקש" };

      if (affected.length > CONFIRM_THRESHOLD) {
        if (ctx.pending) return { error: "כבר ממתינה פעולה לאישור. בקש מהמשתמש לאשר או לבטל אותה קודם." };
        await createPending(
          ctx,
          {
            kind: "update",
            ids: affected.map((t) => t.id),
            changes: patch,
            allowed: ctx.spaces.map((s) => s.id),
            description: `עדכון ${affected.length} משימות: ${describeChanges(ctx, patch)}`,
          },
          affected.length,
          affected.map((t) => t.title),
        );
        return { status: "awaiting_user_confirmation", affected_count: affected.length, note: needsConfirmNote };
      }
      const updated: Task[] = [];
      for (const t of affected) {
        const u = await updateTask(t.id, patch);
        if (u) updated.push(u);
      }
      ctx.mutated = true;
      ctx.actions.push(updated.length === 1 ? "עודכנה משימה" : `עודכנו ${updated.length} משימות`);
      return { updated: updated.length, tasks: updated.map((t) => shape(ctx, t)) };
    }

    case "delete_tasks": {
      if (args.task_ids === undefined && args.filter === undefined)
        return { error: "חובה לציין task_ids או filter" };
      const { tasks, error } = await selectTasks(ctx, args);
      if (error) return { error };
      if (!tasks.length) return { deleted: 0, note: "לא נמצאו משימות שמתאימות" };
      if (ctx.pending) return { error: "כבר ממתינה פעולה לאישור. בקש מהמשתמש לאשר או לבטל אותה קודם." };
      await createPending(
        ctx,
        {
          kind: "delete",
          ids: tasks.map((t) => t.id),
          allowed: ctx.spaces.map((s) => s.id),
          description: `מחיקת ${tasks.length} ${tasks.length === 1 ? "משימה" : "משימות"}`,
        },
        tasks.length,
        tasks.map((t) => t.title),
      );
      return { status: "awaiting_user_confirmation", affected_count: tasks.length, note: needsConfirmNote };
    }

    case "summarize_tasks": {
      let spaces = ctx.spaces;
      if (args.space) {
        const sp = resolveSpace(ctx, args.space);
        if (!sp) return { error: `המרחב "${String(args.space)}" לא נמצא בטווח הפעולה הנוכחי` };
        spaces = [sp];
      }
      const all = await listTasks(spaces.map((s) => s.id));
      const weekStart = startOfWeek(ctx.today);
      const in7 = addDays(ctx.today, 7);
      const stats = (list: Task[]) => {
        const open = list.filter((t) => t.status !== "done");
        return {
          total: list.length,
          open: open.length,
          by_status: Object.fromEntries(STATUSES.map((s) => [s.value, list.filter((t) => t.status === s.value).length])),
          open_by_priority: Object.fromEntries(PRIORITIES.map((p) => [p.value, open.filter((t) => t.priority === p.value).length])),
          overdue: open.filter((t) => isOverdue(t, ctx.today)).length,
          due_today: open.filter((t) => t.due_date === ctx.today).length,
          due_next_7_days: open.filter((t) => t.due_date && t.due_date > ctx.today && t.due_date <= in7).length,
          completed_this_week: list.filter((t) => t.completed_at && ymdOfIso(t.completed_at) >= weekStart).length,
        };
      };
      return {
        today: ctx.today,
        overall: stats(all),
        per_space: spaces.map((s) => ({ space: s.name, ...stats(all.filter((t) => t.space_id === s.id)) })),
        most_important_open: sortImportant(ctx, all.filter((t) => t.status !== "done"))
          .slice(0, 5)
          .map((t) => shape(ctx, t)),
      };
    }
  }
  return { error: `כלי לא מוכר: ${name}` };
}

// ---------- הסוכן ----------

function systemPrompt(ctx: Ctx): string {
  const spaceList = ctx.spaces.map((s) => `- ${s.name}`).join("\n") || "(אין מרחבים)";
  return `אתה סוכן ניהול משימות בתוך אפליקציה בעברית. אתה עוזר למשתמש לשאול, להוסיף, לעדכן, למחוק ולסכם משימות.

היום: ${ctx.today} (יום ${weekdayName(ctx.today)}), שעון ישראל.
טווח הפעולה הנוכחי (${ctx.scopeIsSingle ? "מרחב אחד" : "כל המרחבים"}):
${spaceList}
אתה פועל אך ורק על המרחבים האלה.

כללים:
- ענה בעברית קצרה וישירה: משפט עד שלושה. רשימה קצרה עם "-" רק כשצריך. בלי כותרות, בלי הדגשות, בלי להציג מזהים (id).
- שאלה על משימות - קודם קרא אותן בכלי (read_tasks או summarize_tasks). אל תנחש ואל תמציא משימות.
- אחרי פעולה, אמור בקצרה מה עשית. אם הכלי החזיר שגיאה, אמור זאת בפשטות.
- תאריכים בכלים בפורמט YYYY-MM-DD. "מחר" = ${addDays(ctx.today, 1)}. "ה-10" = ה-10 הקרוב בחודש (אם כבר עבר החודש - החודש הבא). "ביום ראשון" = יום ראשון הקרוב.
- עדיפות ברירת מחדל למשימה חדשה: בינונית (medium). "דחוף" מפורש = urgent. סטטוס ברירת מחדל: חדשה (new).
- אישור: מחיקה או שינוי של יותר מ-${CONFIRM_THRESHOLD} משימות לא מתבצעים מיד. הכלי יחזיר awaiting_user_confirmation. אז אמור כמה משימות ישתנו ובקש אישור (המשתמש יראה כפתורי אישור/ביטול). אל תחזור על הקריאה.
- בקשה מעבר לכלים (לא קשורה למשימות) - אמור שאתה עוזר רק בניהול המשימות.`;
}

function client() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const modelName = () => (process.env.OPENAI_MODEL || "gpt-6-luna").replace(/^openai\//, "");

export async function buildScope(scope: Scope): Promise<{ spaces: Space[]; single: boolean } | null> {
  const all = await listSpaces();
  if (scope.type === "all") return { spaces: all, single: false };
  const sp = all.find((s) => s.id === scope.id);
  return sp ? { spaces: [sp], single: true } : null;
}

export async function runAgent(messages: ChatMessage[], spaces: Space[], single: boolean): Promise<AgentResult> {
  const ctx: Ctx = {
    spaces,
    scopeIsSingle: single,
    today: todayIsrael(),
    pending: null,
    actions: [],
    mutated: false,
  };
  const ai = client();
  const convo: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(ctx) },
    ...messages.map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
  ];

  let reply = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await ai.chat.completions.create({
      model: modelName(),
      messages: convo,
      tools: TOOLS,
      tool_choice: "auto",
    });
    const msg = res.choices[0]?.message;
    if (!msg) break;
    convo.push(msg);
    const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
    if (!calls.length) {
      reply = (msg.content ?? "").trim();
      break;
    }
    for (const call of calls) {
      let result: unknown;
      try {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        result = await runTool(ctx, call.function.name, args);
      } catch (e) {
        console.error("tool error", call.function.name, e);
        result = { error: "הפעולה נכשלה" };
      }
      convo.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  if (!reply) {
    reply = ctx.pending
      ? `הפעולה תשפיע על ${ctx.pending.count} משימות. לאשר?`
      : ctx.mutated
        ? "בוצע."
        : "לא הצלחתי לסיים את הבקשה. אפשר לנסות לנסח אותה אחרת?";
  }
  return { reply, mutated: ctx.mutated, pending: ctx.pending, actions: ctx.actions };
}

// ---------- אישור / ביטול של פעולה ממתינה ----------

export async function resolvePending(
  id: string,
  approve: boolean,
): Promise<{ ok: boolean; message: string; mutated: boolean }> {
  const rows = await query<{ payload: PendingPayload }>(
    `UPDATE pending_actions SET status = $2
     WHERE id = $1 AND status = 'pending' AND created_at > now() - interval '1 hour'
     RETURNING payload`,
    [id, approve ? "approved" : "rejected"],
  );
  if (!rows.length) return { ok: false, message: "הפעולה כבר טופלה או שפג תוקפה.", mutated: false };
  if (!approve) return { ok: true, message: "בוטל. לא שיניתי כלום.", mutated: false };

  const p = rows[0].payload;
  const allowed = new Set(p.allowed);
  if (p.kind === "delete") {
    const tasks = await listTasks(p.allowed);
    const ids = p.ids.filter((i) => tasks.some((t) => t.id === i));
    const n = await deleteTasks(ids);
    return { ok: true, message: n === 1 ? "נמחקה משימה אחת." : `נמחקו ${n} משימות.`, mutated: n > 0 };
  }
  if (p.kind === "update") {
    if (p.changes.space_id && !allowed.has(p.changes.space_id))
      return { ok: false, message: "המרחב המבוקש מחוץ לטווח.", mutated: false };
    const tasks = await listTasks(p.allowed);
    let n = 0;
    for (const t of tasks) {
      if (!p.ids.includes(t.id)) continue;
      if (await updateTask(t.id, p.changes)) n++;
    }
    return { ok: true, message: `עודכנו ${n} משימות.`, mutated: n > 0 };
  }
  let n = 0;
  for (const it of p.items) {
    if (!allowed.has(it.space_id)) continue;
    await createTask(it);
    n++;
  }
  return { ok: true, message: `נוספו ${n} משימות.`, mutated: n > 0 };
}
