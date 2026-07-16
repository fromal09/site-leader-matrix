import { letterGrade, gradeBand, BAND_COLORS } from "@/lib/grades";

export function GradeStamp({
  avg,
  size = "md",
  label = "Average",
}: {
  avg: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const grade = letterGrade(avg);
  const band = gradeBand(avg);
  const color = BAND_COLORS[band];
  const dims =
    size === "lg"
      ? "h-16 w-16 text-2xl"
      : size === "sm"
      ? "h-9 w-9 text-xs"
      : "h-12 w-12 text-base";

  return (
    <div className={`stamp ${dims}`} style={{ color }} title={`${label} ${avg.toFixed(1)}`}>
      {grade}
    </div>
  );
}
