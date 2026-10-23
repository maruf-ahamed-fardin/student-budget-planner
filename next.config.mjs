/**
 * Headers that are the same on every response. The Content-Security-Policy is
 * not here because it carries a per-request nonce — see src/proxy.js.
 */
const securityHeaders = [
  // Two years, subdomains included. Browsers ignore it over plain HTTP.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Don't guess a content type: a "text/plain" upload must never run as script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Older browsers that predate CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/**
 * Extra hosts allowed to post Server Actions, comma-separated — only needed
 * when a proxy rewrites the Host header (e.g. "budget.example.com"). Read at
 * build time.
 */
const allowedOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Docker image sets NEXT_OUTPUT=standalone to get a self-contained
  // server.js with only the files it needs. Left off otherwise, because
  // `next start` (what Render/Railway run) refuses a standalone build.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // db.js builds its path from process.cwd() + "data", and the file tracer
  // takes that as a reason to copy the whole folder into the build. That
  // would ship the local database — every account in it — with the app.
  outputFileTracingExcludes: { "**": ["./data/**/*", "**/*.db", "**/*.db-wal", "**/*.db-shm"] },
  // `node:sqlite` is a Node built-in; keeping it external stops the bundler
  // from trying to trace it into the server build.
  serverExternalPackages: ["node:sqlite"],
  // Don't advertise the framework version to scanners.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Every form here is a handful of short fields.
      bodySizeLimit: "64kb",
      ...(allowedOrigins.length > 0 && { allowedOrigins }),
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
