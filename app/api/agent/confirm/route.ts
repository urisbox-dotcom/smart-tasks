import { NextResponse } from "next/server";
import { resolvePending } from "@/lib/agent";
import { bad, isUuid, readJson, serverError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    if (!isUuid(body.id) || typeof body.approve !== "boolean") return bad("בקשה לא תקינה");
    return NextResponse.json(await resolvePending(body.id, body.approve));
  } catch (e) {
    return serverError(e);
  }
}
