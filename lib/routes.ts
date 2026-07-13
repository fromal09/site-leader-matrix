export const SLM_BASE = "/site-leader-matrix";

export function slmLeaderHref(id: number | string) {
  return `${SLM_BASE}/leader/${id}`;
}

export function slmRubricHref(anchor?: string) {
  return `${SLM_BASE}/rubric${anchor ? `#${anchor}` : ""}`;
}

export const DC_BASE = "/site-depth-charts";

export function dcSiteHref(id: number | string) {
  return `${DC_BASE}/${id}`;
}

export const TRAFFIC_BASE = "/site-depth-charts/traffic";

export function trafficImportHref(id: number | string) {
  return `${TRAFFIC_BASE}/${id}`;
}
