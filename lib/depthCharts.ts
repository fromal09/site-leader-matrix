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

export type WriterNote = {
  id: number;
  content: string;
  created_by: string | null;
  created_at: string;
};

// Used when a byline is detected without a roster card yet: defaults to
// Contributor, except when the name matches the site's listed leader, in
// which case it defaults to that site's primary leader role (whichever
// site_leaders-section role sorts first — normally "Site Editor").
export function defaultRoleForNewAuthor(
  candidateName: string,
  siteLeaderName: string | null | undefined,
  roles: DepthChartRole[]
): string {
  const isLeaderMatch =
    !!siteLeaderName &&
    siteLeaderName.trim().toLowerCase() === candidateName.trim().toLowerCase();
  if (isLeaderMatch) {
    const leaderRole = roles
      .filter((r) => r.section === "site_leaders")
      .sort((a, b) => a.sort_order - b.sort_order)[0];
    if (leaderRole) return leaderRole.label;
  }
  const contributorRole = roles.find((r) => r.label.toLowerCase() === "contributor");
  if (contributorRole) return contributorRole.label;
  return roles[0]?.label ?? "";
}
