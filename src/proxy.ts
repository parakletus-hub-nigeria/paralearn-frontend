import type { NextRequest } from "next/server";
import { cbtProxy } from "@cbt/proxy";
import { isRmsHost, rmsProxy } from "@rms/proxy";

// Subdomain routing lives in each micro-service's frontend; matcher config must stay in this file
// rms.pln.ng -> micro-services-rms, everything else (incl. cbt.pln.ng) -> cbtProxy
export function proxy(req: NextRequest) {
  if (isRmsHost(req.headers.get("host") || "")) return rmsProxy(req);
  return cbtProxy(req);
}

export default proxy;

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
