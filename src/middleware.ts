import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // Detect whether the incoming request is targeting the CBT subdomain
  // Supports production (cbt.pln.ng), local development (cbt.localhost), and wildcard staging
  const isCbtSubdomain =
    hostname.startsWith("cbt.pln.ng") ||
    hostname.startsWith("cbt.localhost") ||
    hostname.startsWith("cbt.");

  if (isCbtSubdomain) {
    const { pathname } = url;

    // Direct static asset and API passes
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname.includes(".")
    ) {
      return NextResponse.next();
    }

    // Direct student testing route: /take/:accessCode passes through cleanly
    if (pathname.startsWith("/take")) {
      return NextResponse.next();
    }

    // If pathname does not start with /cbt, rewrite internally to /cbt...
    // e.g.
    //   cbt.pln.ng/             -> /cbt
    //   cbt.pln.ng/auth         -> /cbt/auth
    //   cbt.pln.ng/candidates   -> /cbt/candidates
    //   cbt.pln.ng/exams/123    -> /cbt/exams/123
    //   cbt.pln.ng/api-docs     -> /cbt/api-docs
    if (!pathname.startsWith("/cbt")) {
      const targetUrl = new URL(`/cbt${pathname === "/" ? "" : pathname}`, req.url);
      targetUrl.search = url.search;
      return NextResponse.rewrite(targetUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
