import { NextResponse } from "next/server";
import { seedDemo } from "@/lib/seed";
import { readJson, serverError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// דורש כניסה (proxy). מוסיף נתוני דוגמה רק אם המסד ריק; {"reset": true} מאפס הכל.
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    return NextResponse.json(await seedDemo(body.reset === true));
  } catch (e) {
    return serverError(e);
  }
}
