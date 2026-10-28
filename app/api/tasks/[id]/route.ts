import { NextResponse } from "next/server";
import { cleanTaskInput, deleteTasks, updateTask } from "@/lib/tasks";
import { bad, isUuid, readJson, serverError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return bad("מזהה לא תקין");
    const patch = cleanTaskInput(await readJson(req));
    if (patch.title !== undefined && !patch.title) return bad("חסרה כותרת");
    if (patch.space_id !== undefined && !isUuid(patch.space_id)) return bad("מרחב לא תקין");
    const task = await updateTask(id, patch);
    if (!task) return bad("המשימה לא נמצאה", 404);
    return NextResponse.json(task);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return bad("מזהה לא תקין");
    await deleteTasks([id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
