import { NextResponse } from "next/server";
import { setSetting } from "@/lib/tasks";
import { isUuid, readJson, serverError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  try {
    const body = await readJson(req);
    if ("dashboard_spaces" in body) {
      const v = body.dashboard_spaces;
      const value = Array.isArray(v) ? v.filter(isUuid) : null;
      await setSetting("dashboard_spaces", value);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
