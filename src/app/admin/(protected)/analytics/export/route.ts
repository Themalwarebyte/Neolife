import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { loadCohortAnalytics } from "@/lib/cohort-analytics-server";
import { buildCohortCsv } from "@/lib/cohort-analytics";
import { parseCrmAnalyticsRange } from "@/lib/qualification-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireCrmUser();
  const url = new URL(request.url);
  const range = parseCrmAnalyticsRange(url.searchParams.get("range"));

  try {
    const summary = await loadCohortAnalytics(user, range);
    const csv = buildCohortCsv(summary, range, new Date());
    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="neolife-cohort-${range}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "Unable to generate the cohort report. Please try again." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
