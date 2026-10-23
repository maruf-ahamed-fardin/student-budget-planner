import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { getExportRows } from "@/lib/queries";
import { categoryLabel, methodLabel, today } from "@/lib/utils";

/**
 * GET /api/export — the signed-in student's whole ledger as CSV.
 *
 * Auth is checked here, not by the proxy (which skips /api). The session
 * cookie is SameSite=Lax, so it is sent on a top-level link click but a
 * cross-site page can't read the response anyway.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const rows = getExportRows(user.id).map((row) => [
    row.occurredOn,
    row.type,
    categoryLabel(row.category),
    methodLabel(row.method),
    row.description,
    // A signed *number* so a spreadsheet can SUM the column directly. (As a
    // string, "-500" would be escaped as a possible formula by csvCell.)
    ((row.type === "expense" ? -1 : 1) * row.amountPoisha) / 100,
  ]);

  const csv = toCsv(["Date", "Type", "Category", "Paid via", "Description", "Amount (BDT)"], rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="budgetbd-ledger-${today()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
