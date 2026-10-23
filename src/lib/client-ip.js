/**
 * Which address made this request, for rate limiting.
 *
 * Each proxy *appends* the address it received the request from to
 * X-Forwarded-For, so the trustworthy entries are at the END of the list. The
 * start is whatever the client chose to send: taking the first entry (the
 * common mistake) lets anyone dodge a per-IP limit by sending a fake header.
 *
 * `trustedHops` is how many proxies you run in front of the app. One (the
 * default) fits Render, Railway, Fly, or a single nginx: the last entry was
 * written by your proxy and is the real client. With Cloudflare in front of
 * nginx, use 2.
 *
 * Pure, so the test suite covers it directly.
 */
export function pickClientIp({ forwardedFor, realIp, trustedHops = 1 }) {
  const hops = Number.isInteger(trustedHops) && trustedHops > 0 ? trustedHops : 1;
  const chain = (forwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // Fewer entries than proxies means the request skipped a proxy we expect;
  // fall back to the leftmost, which is the best we have.
  const ip = chain.length > 0 ? chain[Math.max(0, chain.length - hops)] : realIp?.trim();
  return (ip || "unknown").slice(0, 64);
}
