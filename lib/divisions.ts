export type DivisionStatus = "available" | "coming-soon";

export type Division = {
  key: string; // matches sites.division in the DB
  name: string;
  tagline: string;
  status: DivisionStatus;
};

export const DIVISIONS: Division[] = [
  { key: "NFL", name: "NFL", tagline: "", status: "available" },
  { key: "NBA", name: "NBA", tagline: "", status: "available" },
  { key: "NCAA", name: "NCAA", tagline: "Coming soon", status: "coming-soon" },
  { key: "MLB", name: "MLB", tagline: "", status: "available" },
  { key: "NHL", name: "NHL", tagline: "", status: "available" },
  { key: "Soccer", name: "Soccer", tagline: "Coming soon", status: "coming-soon" },
  { key: "Entertainment", name: "Entertainment", tagline: "Coming soon", status: "coming-soon" },
  { key: "Locals", name: "Locals", tagline: "Coming soon", status: "coming-soon" },
];

export function divisionByKey(key: string): Division | undefined {
  return DIVISIONS.find((d) => d.key.toLowerCase() === key.toLowerCase());
}
