import { describe, expect, it } from 'vitest';
import { lapRows, parseLaps } from '../src/garmin/laps.ts';

const lap = (lapIndex: number, intensityType: string, wktStepIndex: number | null, duration: number, distance: number, averageHR: number) => ({
  lapIndex,
  intensityType,
  wktStepIndex,
  duration,
  movingDuration: duration,
  distance,
  averageSpeed: distance / duration,
  avgGradeAdjustedSpeed: distance / duration,
  maxSpeed: 4,
  averageHR,
  maxHR: averageHR + 5,
  elevationGain: 1,
  elevationLoss: 2,
  averageRunCadence: 170,
  maxRunCadence: 190,
  strideLength: 80,
  calories: 10,
});

const workout = {
  lapDTOs: [
    lap(1, 'WARMUP', 0, 240, 500, 120),
    lap(2, 'WARMUP', 1, 450, 1000, 140),
    lap(3, 'WARMUP', 1, 450, 1000, 150),
    lap(4, 'ACTIVE', 2, 360, 1000, 170),
    lap(5, 'RECOVERY', 3, 120, 150, 150),
    lap(6, 'ACTIVE', 2, 350, 1000, 172),
    lap(7, 'ACTIVE', 2, 10, 20, 174),
    lap(8, 'COOLDOWN', 5, 500, 1000, 155),
    lap(9, 'COOLDOWN', null, 20, 30, 160),
  ],
};

describe('lap Garmin', () => {
  it('mengubah stride cm jadi meter', () => {
    expect(parseLaps(workout)[0].stride_m).toBe(0.8);
  });

  it('mengelompokkan lap per langkah workout seperti ekspor Garmin', () => {
    const rows = lapRows(parseLaps(workout));
    expect(rows.map((r) => `${r.interval ?? ''}|${r.stepType}|${r.label}`)).toEqual([
      '|Warm Up|1',
      '|Warm Up|2 - 3',
      '|Warm Up|2',
      '|Warm Up|3',
      '1|Run|4',
      '|Recovery|5',
      '2|Run|6 - 7',
      '|Run|6',
      '|Run|7',
      '|Cool Down|8 - 9',
      '|Cool Down|8',
      '|Cool Down|9',
      '|null|Summary',
    ]);
  });

  it('menjumlah waktu dan jarak grup, rata-rata HR berbobot waktu', () => {
    const group = lapRows(parseLaps(workout)).find((r) => r.label === '2 - 3')!;
    expect(group).toMatchObject({ duration_sec: 900, distance_m: 2000, cumulative_sec: 1140, avg_hr: 145, max_hr: 155, ascent_m: 2 });
  });

  it('lari biasa tanpa workout tidak dikelompokkan dan tanpa jenis langkah', () => {
    const run = { lapDTOs: [lap(1, 'INTERVAL', null, 400, 1000, 140), lap(2, 'INTERVAL', null, 410, 1000, 150)] };
    const rows = lapRows(parseLaps(run), { avg_hr: 146, max_hr: 160, elevation_gain_m: 9, elevation_loss_m: 8, cadence_spm: 171, calories: 99 });
    expect(rows.map((r) => r.label)).toEqual(['1', '2', 'Summary']);
    expect(rows[0].stepType).toBeNull();
    expect(rows.at(-1)).toMatchObject({ distance_m: 2000, avg_hr: 146, ascent_m: 9, calories: 99 });
  });
});

describe('simpan lap', () => {
  it('tersimpan sebagai array jsonb, bukan teks', async () => {
    const { saveLaps } = await import('../src/garmin/store.ts');
    const { testDb } = await import('./pg.ts');
    const db = await testDb();
    await db.run(`INSERT INTO fit_activities (garmin_id, type, start_time, date) VALUES (1, 'running', '2026-10-26T00:00:00Z', '2026-10-26')`);
    await saveLaps(db, 1, workout);
    const row = await db.one<{ kind: string }>('SELECT jsonb_typeof(laps) AS kind FROM fit_activity_laps WHERE garmin_id = 1');
    expect(row?.kind).toBe('array');
  });
});
