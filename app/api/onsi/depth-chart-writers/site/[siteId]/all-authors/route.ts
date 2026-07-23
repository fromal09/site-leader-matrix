import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Distinct bylines with existing traffic data for this site+period, read
// directly from what's already been uploaded — unlike NewAuthorsReview's
// normal path (which only sees bylines from a CSV mid-upload), this lets
// the roster page check for uncredited authors on demand, any time, for
// data that's already sitting in the database.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { siteId } = await params;
  const siteIdNum = Number(siteId);
  const requestedPeriod = req.nextUrl.searchParams.get("period");

  try {
    let periodKey = requestedPeriod;
    if (!periodKey) {
      const latest = await sql`
        SELECT period_key FROM onsi_traffic_imports
        WHERE site_id = ${siteIdNum}
        ORDER BY period_key DESC LIMIT 1
      `;
      periodKey = (latest as any[])[0]?.period_key ?? null;
    }
    if (!periodKey) {
      return NextResponse.json({ authors: [], periodKey: null });
    }

    const rows = await sql`
      SELECT at.article_author AS name, COUNT(DISTINCT normalize_article_key(at.article_url, at.article_title, at.id))::int AS articles,
        SUM(at.pageviews)::bigint AS pageviews
      FROM onsi_article_traffic at
      JOIN onsi_traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ${siteIdNum} AND ti.period_key = ${periodKey}
        AND at.article_author IS NOT NULL
      GROUP BY at.article_author
      ORDER BY pageviews DESC
    `;

    return NextResponse.json({
      authors: (rows as any[]).map((r) => r.name as string),
      authorStats: rows,
      periodKey,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
