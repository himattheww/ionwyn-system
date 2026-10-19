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
};

export type StrengthSet = {
  activity_garmin_id: number;
  set_order: number;
  exercise_name: string;
  reps: number | null;
  weight_kg: number | null;
  duration_sec: number | null;
};

export type SleepDay = { date: string; sleep_min: number; sleep_score: number | null };
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
  return {
    date: dto.calendarDate,
    sleep_min: Math.round(seconds / 60),
    sleep_score: num(dto.sleepScores?.overall?.value),
  };
}

export function parseRhr(json: any): RhrDay[] {
  const rows = json?.allMetrics?.metricsMap?.WELLNESS_RESTING_HEART_RATE;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r?.calendarDate && num(r.value))
    .map((r) => ({ date: r.calendarDate, rhr: Math.round(r.value) }));
}
