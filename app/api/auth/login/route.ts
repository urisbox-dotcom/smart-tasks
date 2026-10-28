import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_MAX_AGE, createSessionToken, passwordMatches } from "@/lib/auth";
import { readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    return NextResponse.json({ error: "APP_PASSWORD לא מוגדר בשרת" }, { status: 500 });
  }
  const body = await readJson(req);
  const input = typeof body.password === "string" ? body.password : "";
  if (!(await passwordMatches(input, secret))) {
    await new Promise((r) => setTimeout(r, 700)); // האטה קלה נגד ניחושים
    return NextResponse.json({ error: "הסיסמה לא נכונה" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
