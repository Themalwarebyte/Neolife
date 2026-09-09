// Minimal liveness probe for Cloudflare tunnel / infrastructure monitoring.
// Deliberately independent of the database and other application functionality;
// returns 200 while the application process is up. Exposes no secrets or PII.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
