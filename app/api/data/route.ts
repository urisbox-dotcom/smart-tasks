import { NextResponse } from "next/server";
import { getSettings, listSpaces, listTasks } from "@/lib/tasks";
import { serverError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [spaces, tasks, settings] = await Promise.all([listSpaces(), listTasks(), getSettings()]);
    return NextResponse.json({ spaces, tasks, settings });
  } catch (e) {
    return serverError(e);
  }
}
