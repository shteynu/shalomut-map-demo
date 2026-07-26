import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/server/session-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
