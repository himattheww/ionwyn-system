export type Series = {
  t: number[];
  km: number[];
  hr: (number | null)[];
  speed: (number | null)[];
  gap_speed: (number | null)[];
  cadence: (number | null)[];
  elev: (number | null)[];
  power: (number | null)[];
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = (v: number | null, digits = 0) => (v == null ? null : Math.round(v * 10 ** digits) / 10 ** digits);

export function parseSeries(json: any): Series | null {
  const descriptors: { key: string; metricsIndex: number }[] = json?.metricDescriptors ?? [];
  const rows: { metrics: unknown[] }[] = json?.activityDetailMetrics ?? [];
  const index = (key: string) => descriptors.find((m) => m.key === key)?.metricsIndex;
  const at = (row: { metrics: unknown[] }, key: string) => {
    const i = index(key);
    return i === undefined ? null : num(row.metrics[i]);
  };
  const cadenceKey = index('directDoubleCadence') !== undefined ? 'directDoubleCadence' : 'directRunCadence';
  const points = rows
    .map((row) => ({
      t: at(row, 'sumDuration') ?? at(row, 'sumElapsedDuration'),
      d: at(row, 'sumDistance'),
      hr: at(row, 'directHeartRate'),
      speed: at(row, 'directSpeed'),
      gap: at(row, 'directGradeAdjustedSpeed'),
      cadence: at(row, cadenceKey),
      elev: at(row, 'directElevation'),
      power: at(row, 'directPower'),
    }))
    .filter((p): p is typeof p & { t: number; d: number } => p.t != null && p.d != null)
    .sort((a, b) => a.t - b.t);
  if (points.length < 2) return null;
  return {
    t: points.map((p) => p.t),
    km: points.map((p) => p.d / 1000),
    hr: points.map((p) => p.hr),
    speed: points.map((p) => p.speed),
    gap_speed: points.map((p) => p.gap),
    cadence: points.map((p) => p.cadence),
    elev: points.map((p) => p.elev),
    power: points.map((p) => p.power),
  };
}

export function downsample(series: Series, max: number): Series {
  const step = Math.ceil(series.t.length / max);
  const keep = <T>(values: T[]) => values.filter((_, i) => i % step === 0 || i === values.length - 1);
  return {
    t: keep(series.t).map((v) => Math.round(v)),
    km: keep(series.km).map((v) => round(v, 3)!),
    hr: keep(series.hr).map((v) => round(v)),
    speed: keep(series.speed).map((v) => round(v, 2)),
    gap_speed: keep(series.gap_speed).map((v) => round(v, 2)),
    cadence: keep(series.cadence).map((v) => round(v)),
    elev: keep(series.elev).map((v) => round(v, 1)),
    power: keep(series.power).map((v) => round(v)),
  };
}

function half(series: Series, from: number, to: number) {
  let hr = 0;
  let speed = 0;
  let count = 0;
  for (let i = 0; i < series.t.length; i++) {
    const h = series.hr[i];
    const v = series.gap_speed[i] ?? series.speed[i];
    if (series.t[i] < from || series.t[i] >= to || h == null || v == null || v < 0.8) continue;
    hr += h;
    speed += v;
    count++;
  }
  if (!count) return null;
  return { avg_hr: hr / count, speed: speed / count };
}

export function hrDrift(series: Series, warmupSec = 600) {
  const end = series.t.at(-1)!;
  const start = end > warmupSec * 3 ? warmupSec : 0;
  const middle = start + (end - start) / 2;
  const first = half(series, start, middle);
  const second = half(series, middle, end + 1);
  if (!first || !second) return null;
  const ef1 = first.speed / first.avg_hr;
  const ef2 = second.speed / second.avg_hr;
  const pace = (speed: number) => Math.round(1000 / speed);
  return {
    skipped_warmup_sec: start,
    first_half: { avg_hr: Math.round(first.avg_hr), pace_sec_per_km: pace(first.speed) },
    second_half: { avg_hr: Math.round(second.avg_hr), pace_sec_per_km: pace(second.speed) },
    decoupling_pct: Math.round(((ef1 - ef2) / ef1) * 1000) / 10,
  };
}
