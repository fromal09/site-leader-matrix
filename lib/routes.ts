export const SLM_BASE = "/site-leader-matrix";

export function slmLeaderHref(id: number | string) {
  return `${SLM_BASE}/leader/${id}`;
}

export function slmRubricHref(anchor?: string) {
  return `${SLM_BASE}/rubric${anchor ? `#${anchor}` : ""}`;
}
