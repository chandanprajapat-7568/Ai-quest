export const dynamic = "force-dynamic";

/** GET /api/health -> {"ok": true, "app": "AI Quest"}. AI Quest is database-free, so nothing else to check. */
export async function GET() {
  return Response.json({ ok: true, app: "AI Quest" });
}
