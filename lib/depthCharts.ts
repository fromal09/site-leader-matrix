export type DepthChartRole = {
  id: number;
  label: string;
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
