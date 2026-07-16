import { rankTier } from "@/lib/rankColor";

export function HighlightValue({
  children,
  rank,
}: {
  children: React.ReactNode;
  rank: { rank: number; total: number } | null;
}) {
  if (!rank) return <>{children}</>;
  const tier = rankTier(rank.rank, rank.total);
  if (tier === "strong-good") {
    return <span className="highlighter-mark highlighter-mark--green">{children}</span>;
  }
  if (tier === "strong-bad") {
    return <span className="highlighter-mark highlighter-mark--red">{children}</span>;
  }
  return <>{children}</>;
}
