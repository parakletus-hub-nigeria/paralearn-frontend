import { cbtProxy } from "@cbt/proxy";

// CBT subdomain routing lives in micro-services-cbt/frontend; matcher config must stay in this file
export const proxy = cbtProxy;

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
