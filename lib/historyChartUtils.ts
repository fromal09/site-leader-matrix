export type ChronoPoint = {
  periodKey: string; // "YYYY-MM"
  periodLabel: string;
  [key: string]: any;
};

export function filterByRange<T extends ChronoPoint>(
  points: T[],
  startKey: string | null,
  endKey: string | null
): T[] {
  return points.filter(
    (p) => (!startKey || p.periodKey >= startKey) && (!endKey || p.periodKey <= endKey)
  );
}

export function distinctYears(points: ChronoPoint[]): string[] {
  const years = new Set(points.map((p) => p.periodKey.slice(0, 4)));
  return Array.from(years).sort();
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Pivots chronological points into one row per calendar month (Jan..Dec),
 * with a `${year}::${key}` column for each value key, for every year found
 * in the data. Lets a chart hold a static Jan->Dec x-axis with one line per
 * year instead of a single line marching across years.
 */
export function pivotByYear(
  points: ChronoPoint[],
  valueKeys: string[]
): Record<string, any>[] {
  const rows: Record<string, any>[] = MONTH_NAMES.map((m, i) => ({
    month: m,
    monthNum: i + 1,
  }));
  for (const p of points) {
    const year = p.periodKey.slice(0, 4);
    const monthNum = Number(p.periodKey.slice(5, 7));
    const row = rows.find((r) => r.monthNum === monthNum);
    if (!row) continue;
    for (const key of valueKeys) {
      row[`${year}::${key}`] = p[key];
    }
    row[`${year}::periodLabel`] = p.periodLabel;
  }
  return rows;
}
