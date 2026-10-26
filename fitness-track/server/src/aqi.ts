type Breakpoint = [number, number, number, number];

const EPA_2024: Breakpoint[] = [
  [0, 9.0, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 500],
];

const EPA_2012: Breakpoint[] = [
  [0, 12.0, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 350.4, 301, 400],
  [350.5, 500.4, 401, 500],
];

export function pm25ToAqi(pm25: number) {
  const c = Math.floor(pm25 * 10) / 10;
  const row = EPA_2024.find(([lo, hi]) => c >= lo && c <= hi) ?? EPA_2024.at(-1)!;
  const [lo, hi, aqiLo, aqiHi] = row;
  return Math.min(500, Math.round(((aqiHi - aqiLo) / (hi - lo)) * (Math.min(c, hi) - lo) + aqiLo));
}

export function legacyAqiToPm25(aqi: number) {
  const row = EPA_2012.find(([, , aqiLo, aqiHi]) => aqi >= aqiLo && aqi <= aqiHi) ?? EPA_2012.at(-1)!;
  const [lo, hi, aqiLo, aqiHi] = row;
  return Math.round(((hi - lo) / (aqiHi - aqiLo)) * (aqi - aqiLo) * 10 + lo * 10) / 10;
}

export function averageOverWindow(hours: { time: number; value: number | null }[], start: number, end: number) {
  const points = hours.filter((h): h is { time: number; value: number } => h.value != null).sort((a, b) => a.time - b.time);
  if (!points.length || end <= start) return null;
  const at = (t: number) => {
    if (t <= points[0].time) return points[0].value;
    const after = points.findIndex((p) => p.time >= t);
    if (after === -1) return points.at(-1)!.value;
    const a = points[after - 1];
    const b = points[after];
    return a.value + ((b.value - a.value) * (t - a.time)) / (b.time - a.time);
  };
  const step = 60_000;
  let sum = 0;
  let count = 0;
  for (let t = start; t <= end; t += step) {
    sum += at(t);
    count++;
  }
  return Math.round((sum / count) * 10) / 10;
}

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function modelPm25(lat: number, lon: number, start: number, end: number) {
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'pm2_5',
    timezone: 'GMT',
    start_date: utcDay(start - 3_600_000),
    end_date: utcDay(end + 3_600_000),
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const body = (await res.json()) as { hourly?: { time: string[]; pm2_5: (number | null)[] } };
  const hourly = body.hourly;
  if (!hourly) return null;
  return averageOverWindow(
    hourly.time.map((time, i) => ({ time: Date.parse(`${time}:00Z`), value: hourly.pm2_5[i] })),
    start,
    end,
  );
}

export async function stationReading(lat: number, lon: number, token: string) {
  const res = await fetch(`https://api.waqi.info/feed/geo:${lat};${lon}/?token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`WAQI HTTP ${res.status}`);
  const body = (await res.json()) as { status: string; data?: any };
  if (body.status !== 'ok' || !body.data) throw new Error(`WAQI: ${typeof body.data === 'string' ? body.data : body.status}`);
  const subIndex = typeof body.data.iaqi?.pm25?.v === 'number' ? body.data.iaqi.pm25.v : null;
  if (subIndex == null) return null;
  const pm25 = legacyAqiToPm25(subIndex);
  return { pm25, aqi: pm25ToAqi(pm25), name: String(body.data.city?.name ?? '') || null };
}
