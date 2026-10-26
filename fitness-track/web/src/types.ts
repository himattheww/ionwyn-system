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
  max_hr?: number | null;
  cadence_spm?: number | null;
  elevation_gain_m?: number | null;
  elevation_loss_m?: number | null;
  training_effect?: number | null;
};

export type LapRow = {
  kind: 'group' | 'lap' | 'summary';
  label: string;
  interval: number | null;
  stepType: string | null;
  duration_sec: number;
  cumulative_sec: number;
  moving_sec: number | null;
  distance_m: number;
  speed: number | null;
  gap_speed: number | null;
  max_speed: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  ascent_m: number | null;
  descent_m: number | null;
  cadence: number | null;
  max_cadence: number | null;
  gct_ms: number | null;
  stride_m: number | null;
  vo_cm: number | null;
  vr_pct: number | null;
  np: number | null;
  power: number | null;
  max_power: number | null;
  calories: number | null;
};

export type ActivityDetail = {
  activity: Activity;
  weightKg: number | null;
  laps: LapRow[] | null;
  lapsError?: string | null;
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
