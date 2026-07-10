// Converts a 0-10 average score into a scouting-style letter grade + color band.

export function letterGrade(avg: number): string {
  if (avg >= 9.5) return "A+";
  if (avg >= 9) return "A";
  if (avg >= 8.5) return "A-";
  if (avg >= 8) return "B+";
  if (avg >= 7.5) return "B";
  if (avg >= 7) return "B-";
  if (avg >= 6.5) return "C+";
  if (avg >= 6) return "C";
  if (avg >= 5.5) return "C-";
  if (avg >= 5) return "D+";
  if (avg >= 4) return "D";
  return "F";
}

// band: good / mid / low, used to color-code UI
export function gradeBand(score: number): "good" | "mid" | "low" {
  if (score >= 8) return "good";
  if (score >= 6) return "mid";
  return "low";
}

export const BAND_COLORS: Record<"good" | "mid" | "low", string> = {
  good: "#1F7A4C",
  mid: "#C68A1E",
  low: "#B23A2E",
};

export function average(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
