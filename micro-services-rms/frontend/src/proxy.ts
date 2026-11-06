import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * RMS subdomain proxy: rms.pln.ng (and rms.localhost in development) serves the pages under
 * /result-studio. The internal prefix is not /rms because the host app already has /RMS, and
 * the two folders would be the same folder on Windows.
 *   rms.pln.ng/               -> /result-studio
 *   rms.pln.ng/batches/abc    -> /result-studio/batches/abc
 *   rms.pln.ng/api/rms/...    -> unchanged (same-origin backend proxy)
 * Mounted by the host app's src/proxy.ts, which owns the matcher config.
 */
export const RMS_ROUTE_PREFIX = "/result-studio";

export function isRmsHost(hostname: string): boolean {
  return hostname.startsWith("rms.");
}

export function rmsProxy(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }
  if (pathname === RMS_ROUTE_PREFIX || pathname.startsWith(`${RMS_ROUTE_PREFIX}/`)) {
    return NextResponse.next();
  }

  const target = new URL(`${RMS_ROUTE_PREFIX}${pathname === "/" ? "" : pathname}`, req.url);
  target.search = search;
  return NextResponse.rewrite(target);
}
