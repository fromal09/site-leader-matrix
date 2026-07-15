export type ToolStatus = "available" | "coming-soon";

export type Tool = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  href: string;
  status: ToolStatus;
};

export const TOOLS: Tool[] = [
  {
    slug: "site-leader-matrix",
    name: "Site Leader Matrix",
    tagline: "",
    description:
      "Scouting-style grades for site leaders across Fan Authority, Editorial Instincts, Ownership, and Leadership — with history tracking and division-wide trends.",
    href: "/site-leader-matrix",
    status: "available",
  },
  {
    slug: "site-depth-charts",
    name: "Site Depth Charts",
    tagline: "",
    description:
      "Roster cards for every site — writer, role, and (soon) traffic performance at a glance.",
    href: "/site-depth-charts",
    status: "available",
  },
];
