export type SyncStatus = {
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  running: boolean;
  local?: boolean;
  garmin?: { connected: boolean; expiresAt: number | null };
};

export type Activity = {
  garmin_id: number;
  type: string;
  name: string | null;
  start_time: string;
  date: string;
  duration_sec: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  avg_pace_sec_per_km: number | null;
  calories: number | null;
};

export type Recovery = {
  date: string;
  sleep_min: number | null;
  sleep_score: number | null;
  rhr: number | null;
  source: 'garmin' | 'manual';
};

export type Condition = { date: string; alcohol: number; sick: number; note: string | null };
export type Meal = { date: string; protein_met: number; rice_portions: number };
