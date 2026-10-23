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

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `node:sqlite` is a Node built-in; keeping it external stops the bundler
  // from trying to trace it into the server build.
  serverExternalPackages: ["node:sqlite"],
  // Don't advertise the framework version to scanners.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Every form here is a handful of short fields.
      bodySizeLimit: "64kb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
