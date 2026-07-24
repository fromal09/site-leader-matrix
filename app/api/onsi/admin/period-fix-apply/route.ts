import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Applies the one-time "mislabeled period" fix. Relabels period_key (and
// period_label where applicable) from wrongPeriod to correctPeriod across
// every table that stores it. Sites that already have real data under the
// correct period are skipped entirely for onsi_traffic_imports and the
// archive tables (both UNIQUE(site_id, period_key)) rather than risking a
// constraint violation or, worse, silently overwriting real data — those
// are reported back so they can be reviewed by hand. The snapshot and
// daily-delta tables have no such constraint (multiple historical entries
// per period are normal there), so those are relabeled unconditionally.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { wrongPeriod, correctPeriod, correctLabel } = await req.json();
  if (!wrongPeriod || !correctPeriod || !correctLabel) {
    return NextResponse.json({ error: "Missing wrongPeriod, correctPeriod, or correctLabel." }, { status: 400 });
  }
  if (wrongPeriod === correctPeriod) {
    return NextResponse.json({ error: "Wrong and correct periods are the same." }, { status: 400 });
  }

  try {
    const skippedRows = await sql`
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
    const skippedSiteIds = (skippedRows as any[]).map((r) => r.site_id);

    const importsFixed = await sql`
      UPDATE onsi_traffic_imports SET period_key = ${correctPeriod}, period_label = ${correctLabel}
      WHERE period_key = ${wrongPeriod}
        AND site_id != ALL(${skippedSiteIds.length > 0 ? skippedSiteIds : [-1]}::int[])
      RETURNING id
    `;

    const siteSnapshotsFixed = await sql`
      UPDATE onsi_site_traffic_snapshots SET period_key = ${correctPeriod} WHERE period_key = ${wrongPeriod}
      RETURNING id
    `;
    const writerSnapshotsFixed = await sql`
      UPDATE onsi_writer_traffic_snapshots SET period_key = ${correctPeriod} WHERE period_key = ${wrongPeriod}
      RETURNING id
    `;
    const siteDeltasFixed = await sql`
      UPDATE onsi_site_daily_deltas SET period_key = ${correctPeriod} WHERE period_key = ${wrongPeriod}
      RETURNING id
    `;
    const writerDeltasFixed = await sql`
      UPDATE onsi_writer_daily_deltas SET period_key = ${correctPeriod} WHERE period_key = ${wrongPeriod}
      RETURNING id
    `;

    const archiveSkippedRows = await sql`
      SELECT sa.site_id, s.site_name FROM onsi_site_traffic_archive sa
      JOIN onsi_sites s ON s.id = sa.site_id
      WHERE sa.period_key = ${wrongPeriod}
        AND EXISTS (SELECT 1 FROM onsi_site_traffic_archive sa2 WHERE sa2.site_id = sa.site_id AND sa2.period_key = ${correctPeriod})
    `;
    const archiveSkippedSiteIds = (archiveSkippedRows as any[]).map((r) => r.site_id);
    const siteArchiveFixed = await sql`
      UPDATE onsi_site_traffic_archive SET period_key = ${correctPeriod}
      WHERE period_key = ${wrongPeriod}
        AND site_id != ALL(${archiveSkippedSiteIds.length > 0 ? archiveSkippedSiteIds : [-1]}::int[])
      RETURNING id
    `;
    const writerArchiveFixed = await sql`
      UPDATE onsi_writer_traffic_archive SET period_key = ${correctPeriod} WHERE period_key = ${wrongPeriod}
      RETURNING id
    `;

    return NextResponse.json({
      importsFixed: (importsFixed as any[]).length,
      skippedSites: (skippedRows as any[]).map((r) => ({ siteId: r.site_id, siteName: r.site_name })),
      siteSnapshotsFixed: (siteSnapshotsFixed as any[]).length,
      writerSnapshotsFixed: (writerSnapshotsFixed as any[]).length,
      siteDeltasFixed: (siteDeltasFixed as any[]).length,
      writerDeltasFixed: (writerDeltasFixed as any[]).length,
      siteArchiveFixed: (siteArchiveFixed as any[]).length,
      archiveSkippedSites: (archiveSkippedRows as any[]).map((r) => ({ siteId: r.site_id, siteName: r.site_name })),
      writerArchiveFixed: (writerArchiveFixed as any[]).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
