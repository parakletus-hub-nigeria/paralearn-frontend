import { NextRequest, NextResponse } from "next/server";
import { clearRmsSession, rmsBackendUrl, RMS_SESSION_COOKIE } from "@rms/lib/rmsServer";

/**
 * Same-origin pass-through to the RMS backend: /api/rms/<path> -> RMS_API_URL/<path>.
 * Adds the bearer token from the httpOnly session cookie, streams request and response
 * bodies (Excel uploads, PDF downloads) without buffering, and passes redirects through
 * so the backend can hand large PDFs off to blob storage URLs.
 */
const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-disposition", "location", "cache-control", "retry-after"];

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

async function forward(req: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  const target = `${rmsBackendUrl()}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers = new Headers({ accept: req.headers.get("accept") || "*/*" });
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const token = req.cookies.get(RMS_SESSION_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json(
      { message: "The results service is unreachable. Please try again in a moment." },
      { status: 502 }
    );
  }

  const outHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) outHeaders.set(name, value);
  }

  const res = new NextResponse(upstream.body, { status: upstream.status, headers: outHeaders });
  if (upstream.status === 401 && token) clearRmsSession(res);
  return res;
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
