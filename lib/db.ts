import { Pool, types } from "pg";

// date -> "YYYY-MM-DD" (בלי המרה לאזור זמן), timestamptz -> ISO
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1184, (v) => new Date(v).toISOString());

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#4f46e5',
  view text NOT NULL DEFAULT 'kanban',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'new',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_space_idx ON tasks(space_id);
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

const g = globalThis as unknown as { __pool?: Pool; __schema?: Promise<void> };

function pool(): Pool {
  if (!g.__pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    g.__pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX) || 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return g.__pool;
}

async function ensureSchema() {
  if (!g.__schema) {
    g.__schema = pool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((e) => {
        g.__schema = undefined;
        throw e;
      });
  }
  return g.__schema;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  await ensureSchema();
  const res = await pool().query(text, params as never[]);
  return res.rows as T[];
}
