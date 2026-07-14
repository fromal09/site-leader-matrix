export function pageviewWeightedAverage(
  rows: { value: number | null; pageviews: number }[]
): number | null {
  const valid = rows.filter((r) => r.value !== null);
  const denom = valid.reduce((s, r) => s + r.pageviews, 0);
  if (valid.length === 0 || denom === 0) return null;
  return valid.reduce((s, r) => s + (r.value as number) * r.pageviews, 0) / denom;
}
