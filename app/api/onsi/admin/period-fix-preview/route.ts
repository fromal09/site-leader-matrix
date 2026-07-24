import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Read-only diagnostic for the one-time "mislabeled period" fix — reports
// exactly what would change and, critically, flags any site that already
// has real data under the target (correct) period, since onsi_traffic_imports
// and the archive tables have a UNIQUE(site_id, period_key) constraint that
// would reject the relabel outright for those sites. Nothing is written here.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const wrongPeriod = req.nextUrl.searchParams.get("wrongPeriod");
  const correctPeriod = req.nextUrl.searchParams.get("correctPeriod");
  if (!wrongPeriod || !correctPeriod) {
    return NextResponse.json({ error: "Missing wrongPeriod or correctPeriod." }, { status: 400 });
  }
  if (wrongPeriod === correctPeriod) {
    return NextResponse.json({ error: "Wrong and correct periods are the same." }, { status: 400 });
  }

  try {
    const importRows = await sql`
      SELECT ti.site_id, s.site_name
      FROM onsi_traffic_imports ti
      JOIN onsi_sites s ON s.id = ti.site_id
      WHERE ti.period_key = ${wrongPeriod}
      ORDER BY s.site_name
    `;
    const conflictRows = await sql`
      SELECT ti.site_id, s.site_name
      FROM onsi_traffic_imports ti
      JOIN onsi_sites s ON s.id = ti.site_id
      WHERE ti.period_key = ${wrongPeriod}
        AND EXISTS (
          SELECT 1 FROM onsi_traffic_imports ti2
          WHERE ti2.site_id = ti.site_id AND ti2.period_key = ${correctPeriod}
        )
      ORDER BY s.site_name
    `;

    const [siteSnapshots, writerSnapshots, siteDeltas, writerDeltas] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM onsi_site_traffic_snapshots WHERE period_key = ${wrongPeriod}`,
      sql`SELECT COUNT(*)::int AS n FROM onsi_writer_traffic_snapshots WHERE period_key = ${wrongPeriod}`,
      sql`SELECT COUNT(*)::int AS n FROM onsi_site_daily_deltas WHERE period_key = ${wrongPeriod}`,
      sql`SELECT COUNT(*)::int AS n FROM onsi_writer_daily_deltas WHERE period_key = ${wrongPeriod}`,
    ]);

    const [siteArchiveConflicts, writerArchiveConflicts] = await Promise.all([
      sql`
        SELECT sa.site_id, s.site_name FROM onsi_site_traffic_archive sa
        JOIN onsi_sites s ON s.id = sa.site_id
        WHERE sa.period_key = ${wrongPeriod}
          AND EXISTS (SELECT 1 FROM onsi_site_traffic_archive sa2 WHERE sa2.site_id = sa.site_id AND sa2.period_key = ${correctPeriod})
      `,
      sql`SELECT COUNT(*)::int AS n FROM onsi_writer_traffic_archive WHERE period_key = ${wrongPeriod}`,
    ]);

    return NextResponse.json({
      wrongPeriod,
      correctPeriod,
      totalImports: (importRows as any[]).length,
      conflictingSites: (conflictRows as any[]).map((r) => ({ siteId: r.site_id, siteName: r.site_name })),
      siteSnapshotsToFix: (siteSnapshots as any[])[0]?.n ?? 0,
      writerSnapshotsToFix: (writerSnapshots as any[])[0]?.n ?? 0,
      siteDeltasToFix: (siteDeltas as any[])[0]?.n ?? 0,
      writerDeltasToFix: (writerDeltas as any[])[0]?.n ?? 0,
      siteArchiveConflicts: (siteArchiveConflicts as any[]).map((r) => ({ siteId: r.site_id, siteName: r.site_name })),
      writerArchiveRowsAtWrongPeriod: (writerArchiveConflicts as any[])[0]?.n ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
