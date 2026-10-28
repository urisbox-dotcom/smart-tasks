import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const ok = await verifySessionToken(req.cookies.get(COOKIE_NAME)?.value, process.env.APP_PASSWORD);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
