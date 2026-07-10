export type CategoryKey =
  | "fan_authority"
  | "editorial_instincts"
  | "ownership"
  | "leadership";

export const CATEGORIES: { key: CategoryKey; label: string; short: string }[] = [
  { key: "fan_authority", label: "Fan Authority", short: "FAN" },
  { key: "editorial_instincts", label: "Editorial Instincts", short: "ED" },
  { key: "ownership", label: "Ownership", short: "OWN" },
  { key: "leadership", label: "Leadership", short: "LEAD" },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
