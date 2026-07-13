export type SectionKey =
  | "site_leaders"
  | "specialists"
  | "contributors"
  | "division_resources";

export const SECTIONS: { key: SectionKey; label: string; color: string }[] = [
  { key: "site_leaders", label: "Site Leaders", color: "var(--navy)" },
  { key: "specialists", label: "Specialists", color: "var(--grade-mid)" },
  { key: "contributors", label: "Contributors", color: "var(--grade-good)" },
  { key: "division_resources", label: "Division Resources", color: "var(--ink-soft)" },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);

export function sectionLabel(key: string): string {
  return SECTIONS.find((s) => s.key === key)?.label ?? key;
}

export function sectionColor(key: string): string {
  return SECTIONS.find((s) => s.key === key)?.color ?? "var(--ink-soft)";
}

export type DepthChartRole = {
  id: number;
  label: string;
  section: SectionKey;
  sort_order: number;
};

export type DepthChartWriter = {
  id: number;
  site_id: number;
  name: string;
  role: string;
  traffic_dashboard_name: string;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
