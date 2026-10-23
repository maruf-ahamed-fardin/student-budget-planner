import { one } from "@/lib/db";
import { SCHEMA_VERSION } from "@/lib/schema";

/**
 * GET /api/health — for the platform's health check and the Docker
 * HEALTHCHECK. It reports healthy only if the database opens, answers a
 * query and has been migrated to the schema this build expects, so a
 * deployment with a missing or unwritable volume fails loudly instead of
 * serving error pages.
 *
 * It returns no user data and needs no session.
 */
export const dynamic = "force-dynamic";

export function GET() {
  try {
    const { version } = one("SELECT user_version AS version FROM pragma_user_version");
    if (version !== SCHEMA_VERSION) {
      return Response.json({ status: "error", reason: "schema mismatch" }, { status: 503, headers: NO_STORE });
    }
    return Response.json({ status: "ok" }, { headers: NO_STORE });
  } catch {
    // Details go to the server log via Next; the probe only needs a status.
    return Response.json({ status: "error", reason: "database unavailable" }, { status: 503, headers: NO_STORE });
  }
}

const NO_STORE = { "Cache-Control": "no-store" };
