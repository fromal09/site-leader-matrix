import { formatCompactNumber } from "@/lib/trafficFormat";
import type { DepthChartWriter } from "@/lib/depthCharts";
import type { WriterQuickStats } from "@/lib/traffic";

export function CondensedRoster({
  writers,
  quickStats,
  sectionColor,
}: {
  writers: DepthChartWriter[];
  quickStats: Record<number, WriterQuickStats>;
  sectionColor: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-rule-strong">
      <table className="w-full text-left text-sm">
        <thead>
          <tr
            className="font-data text-[10px] uppercase tracking-wide text-white"
            style={{ backgroundColor: sectionColor }}
          >
            <th className="px-3 py-1.5">Name</th>
            <th className="px-3 py-1.5">Role</th>
            <th className="px-3 py-1.5 text-right">Published</th>
            <th className="px-3 py-1.5 text-right">PVs / New Article</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {writers.map((w) => {
            const s = quickStats[w.id];
            return (
              <tr key={w.id} className="border-t border-rule">
                <td className="px-3 py-1.5 font-medium text-ink">{w.name}</td>
                <td className="px-3 py-1.5 font-data text-xs text-ink-soft">{w.role}</td>
                <td className="px-3 py-1.5 text-right font-data">
                  {s ? s.articlesPublished.toLocaleString() : "—"}
                </td>
                <td className="px-3 py-1.5 text-right font-data">
                  {s && s.pvPerPublishedArticle !== null
                    ? formatCompactNumber(s.pvPerPublishedArticle)
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
