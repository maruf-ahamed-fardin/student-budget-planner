import { NextResponse } from "next/server";

/**
 * Runs before every page request (Next 16 renamed `middleware` to `proxy`).
 *
 * 1. A per-request nonce and a strict Content-Security-Policy. Scripts run
 *    only if they carry this request's nonce ('strict-dynamic' lets those load
 *    their own chunks), so an injected <script> — the usual XSS payload — is
 *    refused by the browser even if it reaches the page.
 *
 * 2. An early redirect to /login when there is no session cookie at all.
 *    This is only a UX shortcut: it never looks inside the cookie. The real
 *    check is `requireUser()` in every page and server action.
 */

const PROTECTED = ["/dashboard", "/transactions", "/budget", "/goals", "/insights", "/semester", "/settings"];
const SESSION_COOKIES = ["__Host-bbd_session", "bbd_session"];

export function proxy(request) {
  const { pathname, search } = request.nextUrl;

  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (needsAuth && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";
  // Behind a TLS-terminating proxy the hop to Next is plain HTTP, so trust
  // the forwarded protocol. Upgrading on a plain-HTTP origin would break it.
  const https =
    request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

  const csp = [
    "default-src 'self'",
    // React needs eval only in development, for its error overlays.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style *attributes* (bar widths, animation delays) cannot carry a
    // nonce, so styles allow 'unsafe-inline'. CSS cannot execute script, so
    // the XSS protection above is unaffected.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Static files and the CSV endpoint need no nonce.
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
