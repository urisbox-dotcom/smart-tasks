import { NextResponse } from "next/server";
import { createSpace, isView } from "@/lib/tasks";
import { bad, readJson, serverError } from "@/lib/http";
import { SPACE_COLORS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
    if (!name) return bad("חסר שם למרחב");
    const color = typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : SPACE_COLORS[0];
    const view = isView(body.view) ? body.view : "kanban";
    return NextResponse.json(await createSpace({ name, color, view }), { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
