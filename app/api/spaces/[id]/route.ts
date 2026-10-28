import { NextResponse } from "next/server";
import { deleteSpace, isView, updateSpace } from "@/lib/tasks";
import { bad, isUuid, readJson, serverError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return bad("מזהה לא תקין");
    const body = await readJson(req);
    const patch: { name?: string; color?: string; view?: "kanban" | "list" | "calendar" } = {};
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 60);
    if (typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color)) patch.color = body.color;
    if (isView(body.view)) patch.view = body.view;
    const space = await updateSpace(id, patch);
    if (!space) return bad("המרחב לא נמצא", 404);
    return NextResponse.json(space);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return bad("מזהה לא תקין");
    await deleteSpace(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
