import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Production only: cbt.pln.ng → app.pln.ng/RMS/cbt
 *
 * In development, access the CBT portal directly at localhost:3000/RMS/cbt.
 * Production subdomain redirects are also handled at the nginx/CDN level
 * as the primary mechanism; this is a Next.js-layer fallback.
 */
export function proxy(request: NextRequest) {
  // Skip entirely in development — avoid redirect loops with Turbopack
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const hostname = request.headers.get("host") || "";
  const isCBT = hostname === "cbt.pln.ng" || hostname === "cbt.paralearn.com";

  if (!isCBT) return NextResponse.next();

  return NextResponse.redirect("https://app.pln.ng/RMS/cbt");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
