import type { Db } from '../db.ts';
import { modelPm25, pm25ToAqi, stationReading } from '../aqi.ts';

export const AQI_FROM = '2026-10-26';
const STATION_FRESH_MS = 60 * 60_000;

type Source = { get(path: string): Promise<unknown> };
type Run = { garmin_id: number; date: string; start_time: string; duration_sec: number | null; start_lat: number | null; start_lon: number | null };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const celsius = (f: unknown) => (num(f) == null ? null : Math.round(((num(f)! - 32) * 5) / 9 * 10) / 10);
const kph = (mph: unknown) => (num(mph) == null ? null : Math.round(num(mph)! * 1.609 * 10) / 10);

export function parseWeather(json: any) {
  if (!json || typeof json !== 'object') return null;
  const condition = json.weatherTypeDTO?.desc ?? null;
  const station = json.weatherStationDTO?.name ?? null;
  return {
    temp_c: celsius(json.temp),
    feels_like_c: celsius(json.apparentTemp),
    humidity_pct: num(json.relativeHumidity),
    dew_point_c: celsius(json.dewPoint),
    wind_kph: kph(json.windSpeed),
    weather: [condition, station].filter(Boolean).join(' · ') || null,
  };
}

export function parseSummary(json: any) {
  const s = json?.summaryDTO ?? {};
  const rpe = num(s.directWorkoutRpe);
  return {
    rpe: rpe == null ? null : Math.round(rpe / 10),
    feel: num(s.directWorkoutFeel),
    training_load: num(s.activityTrainingLoad) == null ? null : Math.round(num(s.activityTrainingLoad)! * 10) / 10,
    anaerobic_te: num(s.anaerobicTrainingEffect) == null ? null : Math.round(num(s.anaerobicTrainingEffect)! * 10) / 10,
    te_label: typeof s.trainingEffectLabel === 'string' ? s.trainingEffectLabel : null,
  };
}

export function parseZones(json: any) {
  if (!Array.isArray(json)) return [];
  return json
    .filter((z) => num(z?.zoneNumber) != null)
    .map((z) => ({ zone: z.zoneNumber, seconds: Math.round(num(z.secsInZone) ?? 0), from_bpm: Math.round(num(z.zoneLowBoundary) ?? 0) }))
    .sort((a, b) => a.zone - b.zone);
}

export function parseShoes(json: any) {
  if (!Array.isArray(json) || !json.length) return null;
  return json.map((g) => g?.displayName || g?.customMakeModel || g?.gearMakeName).filter(Boolean).join(', ') || null;
}

async function airQuality(run: Run, now: number) {
  if (run.date < AQI_FROM || run.start_lat == null || run.start_lon == null || !run.duration_sec) return null;
  const start = Date.parse(run.start_time);
  const end = start + run.duration_sec * 1000;
  const pm25Model = await modelPm25(run.start_lat, run.start_lon, start, end).catch((error) => {
    console.error(`AQI model ${run.garmin_id}: ${(error as Error).message}`);
    return null;
  });
  const token = process.env.WAQI_TOKEN;
  const station =
    token && now - end <= STATION_FRESH_MS
      ? await stationReading(run.start_lat, run.start_lon, token).catch((error) => {
          console.error(`AQI stasiun ${run.garmin_id}: ${(error as Error).message}`);
          return null;
        })
      : null;
  const aqiModel = pm25Model == null ? null : pm25ToAqi(pm25Model);
  return {
    aqi: station?.aqi ?? aqiModel,
    aqi_source: station ? 'station' : aqiModel == null ? null : 'model',
    aqi_station: station?.aqi ?? null,
    pm25_station: station?.pm25 ?? null,
    station_name: station?.name ?? null,
    aqi_model: aqiModel,
    pm25_model: pm25Model,
  };
}

export async function fetchContext(session: Source, run: Run, now = Date.now()) {
  const id = run.garmin_id;
  const [summary, weather, zones, gear] = await Promise.all([
    session.get(`/activity-service/activity/${id}`),
    session.get(`/activity-service/activity/${id}/weather`).catch(() => null),
    session.get(`/activity-service/activity/${id}/hrTimeInZones`).catch(() => []),
    session.get(`/gear-service/gear/filterGear?activityId=${id}`).catch(() => []),
  ]);
  return {
    ...parseSummary(summary),
    ...(parseWeather(weather) ?? {}),
    hr_zones: parseZones(zones),
    shoes: parseShoes(gear),
    ...((await airQuality(run, now)) ?? {}),
  };
}

const COLUMNS = [
  'temp_c', 'feels_like_c', 'humidity_pct', 'dew_point_c', 'wind_kph', 'weather', 'rpe', 'feel', 'training_load', 'anaerobic_te', 'te_label',
  'shoes', 'aqi', 'aqi_source', 'aqi_station', 'pm25_station', 'station_name', 'aqi_model', 'pm25_model',
] as const;

export async function saveContext(db: Db, garminId: number, context: Record<string, unknown>) {
  const values = COLUMNS.map((c) => context[c] ?? null);
  await db.run(
    `INSERT INTO fit_activity_context (garmin_id, fetched_at, hr_zones, ${COLUMNS.join(', ')})
     VALUES (?, ?, ?::text::jsonb, ${COLUMNS.map(() => '?').join(', ')})
     ON CONFLICT (garmin_id) DO UPDATE SET fetched_at = excluded.fetched_at, hr_zones = excluded.hr_zones,
       ${COLUMNS.map((c) => `${c} = excluded.${c}`).join(', ')}`,
    [garminId, new Date().toISOString(), JSON.stringify(context.hr_zones ?? []), ...values],
  );
}
