// נתוני דוגמה: שלושה מרחבים ו-16 משימות, תאריכים יחסיים להיום.
import { query } from "./db";
import { addDays, todayIsrael } from "./dates";
import type { Priority, Status, ViewType } from "./types";

const SPACES: { key: string; name: string; color: string; view: ViewType }[] = [
  { key: "home", name: "בית", color: "#0d9488", view: "list" },
  { key: "work", name: "עבודה", color: "#4f46e5", view: "kanban" },
  { key: "study", name: "לימודים", color: "#db2777", view: "calendar" },
];

// [מרחב, כותרת, עדיפות, סטטוס, הפרש ימים לתאריך יעד, הושלמה לפני X שעות]
const TASKS: [string, string, Priority, Status, number, number?][] = [
  ["home", "לקנות מצרכים לשבת", "high", "new", 0],
  ["home", "לתקן את הברז במטבח", "urgent", "new", -1],
  ["home", "להזמין טכנאי למזגן", "medium", "in_progress", 2],
  ["home", "לסדר את המחסן", "low", "new", 6],
  ["home", "להחליף נורות במסדרון", "low", "done", -3, 30],

  ["work", "להכין מצגת לפגישת צוות", "urgent", "in_progress", 0],
  ["work", "לשלוח סיכום פגישה ללקוח", "high", "new", -1],
  ["work", "לעדכן את תוכנית העבודה לרבעון", "medium", "new", 5],
  ["work", "לבדוק הצעות מחיר מספקים", "medium", "paused", 9],
  ["work", "לארגן את תיקיית המסמכים המשותפת", "low", "done", -2, 3],

  ["study", "להגיש עבודה מסכמת בקורס", "urgent", "in_progress", 3],
  ["study", "לקרוא פרק 4 בספר הלימוד", "medium", "new", 1],
  ["study", "לחזור על חומר השיעור האחרון", "medium", "new", -2],
  ["study", "להכין סיכום לקראת המבחן", "high", "new", 12],
  ["study", "להירשם לסדנת כתיבה", "low", "new", 20],
  ["study", "להשלים תרגיל 3", "medium", "done", -6, 120],
];

/** מוסיף נתוני דוגמה רק אם אין מרחבים. עם reset מוחק הכל קודם. */
export async function seedDemo(reset = false): Promise<{ seeded: boolean; spaces: number; tasks: number }> {
  const [{ n }] = await query<{ n: number }>(`SELECT count(*)::int AS n FROM spaces`);
  if (n > 0 && !reset) return { seeded: false, spaces: n, tasks: 0 };

  if (reset) {
    await query(`DELETE FROM tasks`);
    await query(`DELETE FROM spaces`);
    await query(`DELETE FROM settings`);
    await query(`DELETE FROM pending_actions`);
  }
  const today = todayIsrael();
  const ids: Record<string, string> = {};
  for (const [i, s] of SPACES.entries()) {
    const rows = await query<{ id: string }>(
      `INSERT INTO spaces (name, color, view, position) VALUES ($1,$2,$3,$4) RETURNING id`,
      [s.name, s.color, s.view, i],
    );
    ids[s.key] = rows[0].id;
  }
  for (const [space, title, priority, status, offset, doneHoursAgo] of TASKS) {
    await query(
      `INSERT INTO tasks (space_id, title, priority, status, due_date, completed_at)
       VALUES ($1,$2,$3,$4,$5, CASE WHEN $6::int IS NULL THEN NULL ELSE now() - ($6::int * interval '1 hour') END)`,
      [ids[space], title, priority, status, addDays(today, offset), doneHoursAgo ?? null],
    );
  }
  return { seeded: true, spaces: SPACES.length, tasks: TASKS.length };
}
