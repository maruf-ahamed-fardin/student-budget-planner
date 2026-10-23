import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickClientIp } from "../src/lib/client-ip.js";

describe("client IP for rate limiting", () => {
  it("takes the address our proxy saw, not the one the client claims", () => {
    // The client sent a fake header; the proxy appended the real address.
    assert.equal(pickClientIp({ forwardedFor: "1.2.3.4, 203.0.113.9" }), "203.0.113.9");
  });

  it("can't be dodged by rotating a forged X-Forwarded-For", () => {
    const real = "203.0.113.9";
    for (const fake of ["10.0.0.1", "8.8.8.8", "spoof"]) {
      assert.equal(pickClientIp({ forwardedFor: `${fake}, ${real}` }), real);
    }
  });

  it("counts back the configured number of trusted proxies", () => {
    // client → Cloudflare → nginx → app
    assert.equal(pickClientIp({ forwardedFor: "fake, 198.51.100.7, 172.70.1.1", trustedHops: 2 }), "198.51.100.7");
  });

  it("falls back to X-Real-IP, then to a placeholder", () => {
    assert.equal(pickClientIp({ realIp: "192.0.2.5" }), "192.0.2.5");
    assert.equal(pickClientIp({}), "unknown");
  });

  it("caps the length so a giant header can't bloat the table", () => {
    assert.equal(pickClientIp({ forwardedFor: "x".repeat(500) }).length, 64);
  });
});
