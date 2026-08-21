import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/server/session-auth";

export async function POST() {
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
