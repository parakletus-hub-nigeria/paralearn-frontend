// Server-side only: imported by the /api/rms route handlers, never by pages
import type { NextResponse } from "next/server";

/** httpOnly cookie that carries the RMS backend's JWT; page scripts never see the token */
export const RMS_SESSION_COOKIE = "rms_session";
export const RMS_COOKIE_PATH = "/api/rms";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function rmsBackendUrl(): string {
  return (process.env.RMS_API_URL || "http://localhost:4100").replace(/\/+$/, "");
}

export function setRmsSession(res: NextResponse, token: string) {
  res.cookies.set(RMS_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: RMS_COOKIE_PATH,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearRmsSession(res: NextResponse) {
  res.cookies.set(RMS_SESSION_COOKIE, "", { path: RMS_COOKIE_PATH, maxAge: 0 });
}
