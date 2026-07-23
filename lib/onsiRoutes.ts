export const ONSI_DC_BASE = "/onsi/site-depth-charts";

export function onsiDcSiteHref(id: number | string) {
  return `${ONSI_DC_BASE}/${id}`;
}

export const ONSI_TRAFFIC_BASE = "/onsi/traffic-data";

export function onsiTrafficImportHref(id: number | string) {
  return `${ONSI_TRAFFIC_BASE}/${id}`;
}

export function onsiWriterTrafficHref(cardId: number | string) {
  return `/onsi/site-depth-charts/writer/${cardId}/traffic`;
}
