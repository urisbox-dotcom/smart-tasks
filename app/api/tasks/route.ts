import { NextResponse } from "next/server";
import { cleanTaskInput, createTask } from "@/lib/tasks";
import { bad, isUuid, readJson, serverError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const input = cleanTaskInput(await readJson(req));
    if (!input.title) return bad("חסרה כותרת");
    if (!isUuid(input.space_id)) return bad("חסר מרחב");
    const task = await createTask({ ...input, space_id: input.space_id, title: input.title });
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
