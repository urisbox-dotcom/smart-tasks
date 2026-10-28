// נתוני דוגמה: שלושה מרחבים ו-16 משימות, תאריכים יחסיים להיום.
// הרצה: npm run seed        (מוסיף רק אם המסד ריק)
//       npm run seed -- --reset   (מוחק הכל ויוצר מחדש)
import { readFileSync } from "node:fs";
import pg from "pg";

pg.types.setTypeParser(1082, (v) => v);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("חסר DATABASE_URL");
  process.exit(1);
}

const dbSource = readFileSync(new URL("../lib/db.ts", import.meta.url), "utf8");
const schema = dbSource.match(/SCHEMA_SQL = `([\s\S]*?)`;/)?.[1];
if (!schema) throw new Error("לא נמצאה סכמה ב-lib/db.ts");

const reset = process.argv.includes("--reset");
const pool = new pg.Pool({ connectionString: url, max: 1 });

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

function day(offset) {
  if (offset === null) return null;
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return dt.toISOString().slice(0, 10);
}

const spaces = [
  { key: "home", name: "בית", color: "#0d9488", view: "list" },
  { key: "work", name: "עבודה", color: "#4f46e5", view: "kanban" },
  { key: "study", name: "לימודים", color: "#db2777", view: "calendar" },
];

// [מרחב, כותרת, עדיפות, סטטוס, הפרש ימים לתאריך יעד, הושלמה לפני X שעות]
const tasks = [
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

const client = await pool.connect();
try {
  await client.query(schema);
  const { rows } = await client.query("SELECT count(*)::int AS n FROM spaces");
  if (rows[0].n > 0 && !reset) {
    console.log(`במסד כבר יש ${rows[0].n} מרחבים. להרצה מחדש: npm run seed -- --reset`);
    process.exit(0);
  }
  await client.query("BEGIN");
  if (reset) {
    await client.query("DELETE FROM tasks");
    await client.query("DELETE FROM spaces");
    await client.query("DELETE FROM settings");
    await client.query("DELETE FROM pending_actions");
  }
  const ids = {};
  for (const [i, s] of spaces.entries()) {
    const r = await client.query(
      "INSERT INTO spaces (name, color, view, position) VALUES ($1,$2,$3,$4) RETURNING id",
      [s.name, s.color, s.view, i],
    );
    ids[s.key] = r.rows[0].id;
  }
  for (const [space, title, priority, status, offset, doneHoursAgo] of tasks) {
    await client.query(
      `INSERT INTO tasks (space_id, title, priority, status, due_date, completed_at)
       VALUES ($1,$2,$3,$4,$5, CASE WHEN $6::int IS NULL THEN NULL ELSE now() - ($6::int * interval '1 hour') END)`,
      [ids[space], title, priority, status, day(offset), doneHoursAgo ?? null],
    );
  }
  await client.query("COMMIT");
  console.log(`נוצרו ${spaces.length} מרחבים ו-${tasks.length} משימות.`);
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
