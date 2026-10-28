import { NextResponse } from "next/server";
import { buildScope, runAgent } from "@/lib/agent";
import { bad, isUuid, readJson } from "@/lib/http";
import type { ChatMessage, Scope } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await readJson(req);

  const rawScope = body.scope as { type?: string; id?: string } | undefined;
  const scope: Scope | null =
    rawScope?.type === "all"
      ? { type: "all" }
      : rawScope?.type === "space" && isUuid(rawScope.id)
        ? { type: "space", id: rawScope.id }
        : null;
  if (!scope) return bad("טווח פעולה לא תקין");

  const messages: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter(
      (m): m is ChatMessage =>
        !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && !!m.content.trim(),
    )
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return bad("אין הודעה");

  try {
    const resolved = await buildScope(scope);
    if (!resolved) return bad("המרחב לא נמצא", 404);
    const result = await runAgent(messages, resolved.spaces, resolved.single);
    return NextResponse.json(result);
  } catch (e) {
    console.error("agent error", e);
    return NextResponse.json(
      { error: "הסוכן לא זמין כרגע. נסה שוב בעוד רגע." },
      { status: 502 },
    );
  }
}
