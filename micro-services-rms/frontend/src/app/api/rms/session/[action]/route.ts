import { NextRequest, NextResponse } from "next/server";
import { clearRmsSession, rmsBackendUrl, setRmsSession } from "@rms/lib/rmsServer";

/**
 * Sign-in, sign-up and sign-out for rms.pln.ng.
 * The backend returns { accessToken, ... }; the token goes into an httpOnly cookie and the
 * rest of the body is returned to the page.
 */
interface RouteParams {
  params: Promise<{ action: string }>;
}

const BACKEND_ACTIONS: Record<string, string> = { login: "auth/login", signup: "auth/signup" };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { action } = await params;

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    clearRmsSession(res);
    return res;
  }

  const backendPath = BACKEND_ACTIONS[action];
  if (!backendPath) return NextResponse.json({ message: "Not found" }, { status: 404 });

  let upstream: Response;
  try {
    upstream = await fetch(`${rmsBackendUrl()}/${backendPath}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: await req.text(),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "The results service is unreachable. Please try again in a moment." },
      { status: 502 }
    );
  }

  const body = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return NextResponse.json(body, { status: upstream.status });

  const { accessToken, ...rest } = body as { accessToken?: string };
  if (!accessToken) {
    return NextResponse.json({ message: "The results service did not return a session." }, { status: 502 });
  }

  const res = NextResponse.json(rest, { status: upstream.status });
  setRmsSession(res, accessToken);
  return res;
}
