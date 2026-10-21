import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { loadTriageTotals } from "@/lib/crm-triage-server";
import { buildTriageCsv, parseTriageWindow } from "@/lib/crm-triage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Authenticated, role-scoped aggregate report: never exports lead-level PII. */
export async function GET(request: Request) {
  const user = await requireCrmUser();
  const url = new URL(request.url);
  const days = parseTriageWindow(url.searchParams.get("days"));
  try {
    const now = new Date();
    const totals = await loadTriageTotals(user, days, now);
    return new Response(`\uFEFF${buildTriageCsv(totals, days, now)}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="neolife-attention-${days}d.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Unable to export the attention report." }, {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
