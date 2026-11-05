import { timingSafeEqual } from "node:crypto";
import { runTimedAutomations } from "@/lib/automations";

export const dynamic = "force-dynamic";

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Daily sweep for time-based automations.
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends this automatically)
 * or `?key=${CRON_SECRET}` for simple schedulers.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET is not configured on the server" }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const authorized = same(header, `Bearer ${secret}`) || (key !== "" && same(key, secret));
  if (!authorized) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const report = await runTimedAutomations();
    return Response.json({
      ok: true,
      ran: report.length,
      failed: report.filter((r) => r.status === "failed").length,
      report,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
