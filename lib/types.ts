import { CategoryKey } from "./categories";

export type ScoreRow = {
  site_id: number;
  category: CategoryKey;
  score: number;
  note: string;
  is_canonized: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type Site = {
  id: number;
  site_name: string;
  site_topic: string;
  leader_name: string;
  sort_order: number;
  hostname: string | null;
  scores: ScoreRow[];
};

export type HistoryRow = {
  category: CategoryKey;
  score: number;
  note: string;
  event_type: "canonized" | "update";
  changed_by: string | null;
  changed_at: string;
};
