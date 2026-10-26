import { jakartaDate } from '../dates.ts';

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
  max_hr: number | null;
  cadence_spm: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  training_effect: number | null;
  start_lat: number | null;
  start_lon: number | null;
};

export type StrengthSet = {
  activity_garmin_id: number;
  set_order: number;
  exercise_name: string;
  reps: number | null;
  weight_kg: number | null;
  duration_sec: number | null;
};

export type SleepDay = {
  date: string;
  sleep_min: number;
  sleep_score: number | null;
  deep_min: number | null;
  light_min: number | null;
  rem_min: number | null;
  awake_min: number | null;
  sleep_respiration: number | null;
  sleep_stress: number | null;
};

export type HrvDay = {
  date: string;
  hrv_last_night: number | null;
  hrv_weekly: number | null;
  hrv_high_5min: number | null;
  hrv_baseline_low: number | null;
  hrv_baseline_high: number | null;
  hrv_low_upper: number | null;
  hrv_status: string | null;
};

export type ReadinessDay = { date: string; readiness_score: number | null; readiness_level: string | null; acute_load: number | null };
export type RhrDay = { date: string; rhr: number };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function gmtToIso(gmt: string) {
  return new Date(`${gmt.replace(' ', 'T')}Z`).toISOString();
}

export function parseActivities(json: any): Activity[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((a) => a?.activityId && a?.startTimeGMT)
    .map((a) => {
      const startTime = gmtToIso(a.startTimeGMT);
      const distance = num(a.distance);
      const speed = num(a.averageSpeed);
      return {
        garmin_id: a.activityId,
        type: a.activityType?.typeKey ?? 'other',
        name: a.activityName ?? null,
        start_time: startTime,
        date: jakartaDate(startTime),
        duration_sec: num(a.duration),
        distance_m: distance && distance > 0 ? distance : null,
        avg_hr: num(a.averageHR),
        avg_pace_sec_per_km: distance && speed && speed > 0 ? Math.round(1000 / speed) : null,
        calories: num(a.calories),
        max_hr: num(a.maxHR),
        cadence_spm: num(a.averageRunningCadenceInStepsPerMinute),
        elevation_gain_m: num(a.elevationGain),
        elevation_loss_m: num(a.elevationLoss),
        training_effect: num(a.aerobicTrainingEffect),
        start_lat: num(a.startLatitude),
        start_lon: num(a.startLongitude),
      };
    });
}

function exerciseName(exercise: any): string | null {
  const raw = exercise?.name ?? exercise?.category;
  if (!raw || typeof raw !== 'string') return null;
  return raw.toLowerCase().replace(/_/g, ' ').trim();
}

export function parseExerciseSets(json: any): StrengthSet[] {
  const activityId = json?.activityId;
  const sets = json?.exerciseSets;
  if (!activityId || !Array.isArray(sets)) return [];
  return sets
    .filter((s) => s?.setType === 'ACTIVE')
    .map((s, i) => {
      const grams = num(s.weight);
      return {
        activity_garmin_id: activityId,
        set_order: i + 1,
        exercise_name: exerciseName(s.exercises?.[0]) ?? 'tanpa nama',
        reps: num(s.repetitionCount),
        weight_kg: grams && grams > 0 ? Math.round(grams / 100) / 10 : null,
        duration_sec: num(s.duration),
      };
    });
}

export function parseSleep(json: any): SleepDay | null {
  const dto = json?.dailySleepDTO;
  const seconds = num(dto?.sleepTimeSeconds);
  if (!dto?.calendarDate || !seconds) return null;
  const minutes = (v: unknown) => (num(v) == null ? null : Math.round(num(v)! / 60));
  return {
    date: dto.calendarDate,
    sleep_min: Math.round(seconds / 60),
    sleep_score: num(dto.sleepScores?.overall?.value),
    deep_min: minutes(dto.deepSleepSeconds),
    light_min: minutes(dto.lightSleepSeconds),
    rem_min: minutes(dto.remSleepSeconds),
    awake_min: minutes(dto.awakeSleepSeconds),
    sleep_respiration: num(dto.averageRespirationValue),
    sleep_stress: num(dto.avgSleepStress),
  };
}

export function parseHrv(json: any): HrvDay | null {
  const h = json?.hrvSummary;
  if (!h?.calendarDate) return null;
  return {
    date: h.calendarDate,
    hrv_last_night: num(h.lastNightAvg),
    hrv_weekly: num(h.weeklyAvg),
    hrv_high_5min: num(h.lastNight5MinHigh),
    hrv_baseline_low: num(h.baseline?.balancedLow),
    hrv_baseline_high: num(h.baseline?.balancedUpper),
    hrv_low_upper: num(h.baseline?.lowUpper),
    hrv_status: typeof h.status === 'string' ? h.status : null,
  };
}

export function parseReadiness(json: any): ReadinessDay | null {
  if (!Array.isArray(json) || !json.length) return null;
  const morning = json.find((r) => r?.inputContext === 'AFTER_WAKEUP_RESET');
  const latest = [...json].sort((a, b) => String(b?.timestamp).localeCompare(String(a?.timestamp)))[0];
  const r = morning ?? latest;
  if (!r?.calendarDate) return null;
  return {
    date: r.calendarDate,
    readiness_score: num(r.score),
    readiness_level: typeof r.level === 'string' ? r.level : null,
    acute_load: num(r.acuteLoad),
  };
}

export function parseRhr(json: any): RhrDay[] {
  const rows = json?.allMetrics?.metricsMap?.WELLNESS_RESTING_HEART_RATE;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r?.calendarDate && num(r.value))
    .map((r) => ({ date: r.calendarDate, rhr: Math.round(r.value) }));
}
