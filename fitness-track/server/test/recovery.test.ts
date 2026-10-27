import { describe, expect, it } from 'vitest';
import { averageOverWindow, legacyAqiToPm25, pm25ToAqi } from '../src/aqi.ts';
import { parseShoes, parseSummary, parseWeather, parseZones } from '../src/garmin/context.ts';
import { parseCalories, parseHrv, parseReadiness, parseSleep } from '../src/garmin/parse.ts';
import { hrDrift, parseSeries } from '../src/garmin/series.ts';
import { applyRaw } from '../src/garmin/store.ts';
import { testDb } from './pg.ts';

describe('AQI', () => {
  it('memakai tabel EPA 2024', () => {
    expect(pm25ToAqi(9)).toBe(50);
    expect(pm25ToAqi(107.6)).toBe(188);
    expect(pm25ToAqi(400)).toBe(500);
  });

  it('mengubah sub-indeks WAQI (tabel lama) jadi konsentrasi', () => {
    expect(legacyAqiToPm25(50)).toBe(12);
    expect(legacyAqiToPm25(200)).toBe(150.4);
  });

  it('merata-rata per menit dengan garis lurus antar jam', () => {
    const hour = 3_600_000;
    const hours = [{ time: 5 * hour, value: 102 }, { time: 6 * hour, value: 113.2 }];
    expect(averageOverWindow(hours, 5 * hour, 6 * hour)).toBe(107.6);
    expect(averageOverWindow(hours, 5 * hour, 5 * hour)).toBeNull();
  });
});

describe('data harian Garmin', () => {
  it('membaca HRV beserta baseline dan status', () => {
    const hrv = parseHrv({
      hrvSummary: { calendarDate: '2026-10-25', weeklyAvg: 57, lastNightAvg: 44, lastNight5MinHigh: 86, baseline: { lowUpper: 57, balancedLow: 60, balancedUpper: 72 }, status: 'LOW' },
    });
    expect(hrv).toEqual({
      date: '2026-10-25', hrv_last_night: 44, hrv_weekly: 57, hrv_high_5min: 86, hrv_baseline_low: 60, hrv_baseline_high: 72, hrv_low_upper: 57, hrv_status: 'LOW',
    });
  });

  it('memilih readiness pagi setelah bangun', () => {
    const r = parseReadiness([
      { calendarDate: '2026-10-25', score: 59, level: 'LOW', acuteLoad: 160, timestamp: '2026-10-24T17:14:59.0', inputContext: 'UPDATE_REALTIME_VARIABLES' },
      { calendarDate: '2026-10-25', score: 65, level: 'MODERATE', acuteLoad: 163, timestamp: '2026-10-24T21:08:04.0', inputContext: 'AFTER_WAKEUP_RESET' },
    ]);
    expect(r).toEqual({ date: '2026-10-25', readiness_score: 65, readiness_level: 'MODERATE', acute_load: 163 });
  });

  it('membaca tahapan tidur dan respirasi', () => {
    const sleep = parseSleep({
      dailySleepDTO: { calendarDate: '2026-10-25', sleepTimeSeconds: 23159, deepSleepSeconds: 5820, lightSleepSeconds: 14160, remSleepSeconds: 3180, awakeSleepSeconds: 120, averageRespirationValue: 18, avgSleepStress: 15, sleepScores: { overall: { value: 76 } } },
    });
    expect(sleep).toMatchObject({ sleep_min: 386, deep_min: 97, light_min: 236, rem_min: 53, awake_min: 2, sleep_respiration: 18, sleep_stress: 15 });
  });

  it('HRV dan readiness masuk ke baris tidur yang sama', async () => {
    const db = await testDb();
    await applyRaw(db, 'sleep', { dailySleepDTO: { calendarDate: '2026-10-25', sleepTimeSeconds: 3600 } });
    await applyRaw(db, 'hrv', { hrvSummary: { calendarDate: '2026-10-25', lastNightAvg: 44, baseline: { balancedLow: 60, balancedUpper: 72 }, status: 'LOW' } });
    await applyRaw(db, 'readiness', [{ calendarDate: '2026-10-25', score: 65, level: 'MODERATE', acuteLoad: 163, inputContext: 'AFTER_WAKEUP_RESET' }]);
    expect(await db.one('SELECT sleep_min, hrv_last_night, hrv_baseline_low, hrv_baseline_high, hrv_status, readiness_score FROM fit_recovery_daily')).toEqual({
      sleep_min: 60, hrv_last_night: 44, hrv_baseline_low: 60, hrv_baseline_high: 72, hrv_status: 'LOW', readiness_score: 65,
    });
  });
});

describe('konteks lari', () => {
  it('mengubah cuaca Garmin ke Celsius dan km/jam', () => {
    expect(parseWeather({ temp: 81, apparentTemp: 86, dewPoint: 75, relativeHumidity: 84, windSpeed: 5, weatherTypeDTO: { desc: 'Haze' }, weatherStationDTO: { name: 'Halim' } })).toEqual({
      temp_c: 27.2, feels_like_c: 30, humidity_pct: 84, dew_point_c: 23.9, wind_kph: 8, weather: 'Haze · Halim',
    });
  });

  it('menyimpan batas bpm tiap zona', () => {
    expect(parseZones([{ zoneNumber: 2, secsInZone: 991.9, zoneLowBoundary: 146 }, { zoneNumber: 1, secsInZone: 694.2, zoneLowBoundary: 132 }])).toEqual([
      { zone: 1, seconds: 694, from_bpm: 132 },
      { zone: 2, seconds: 992, from_bpm: 146 },
    ]);
  });

  it('membaca RPE, feel, load, dan sepatu', () => {
    expect(parseSummary({ summaryDTO: { directWorkoutRpe: 50, directWorkoutFeel: 75, activityTrainingLoad: 108.23, anaerobicTrainingEffect: 0.1, trainingEffectLabel: 'TEMPO' } })).toEqual({
      rpe: 5, feel: 75, training_load: 108.2, anaerobic_te: 0.1, te_label: 'TEMPO',
    });
    expect(parseShoes([])).toBeNull();
    expect(parseShoes([{ displayName: 'Novablast 4' }])).toBe('Novablast 4');
  });
});

describe('HR drift', () => {
  it('menghitung decoupling dari paruh pertama dan kedua setelah pemanasan', () => {
    const descriptors = ['sumDuration', 'sumDistance', 'directHeartRate', 'directSpeed'].map((key, metricsIndex) => ({ key, metricsIndex }));
    const rows = Array.from({ length: 361 }, (_, i) => ({ metrics: [i * 10, i * 30, i * 10 < 2100 ? 150 : 165, 3] }));
    const drift = hrDrift(parseSeries({ metricDescriptors: descriptors, activityDetailMetrics: rows })!);
    expect(drift).toMatchObject({ skipped_warmup_sec: 600, first_half: { avg_hr: 150 }, second_half: { avg_hr: 165 } });
    expect(drift!.decoupling_pct).toBe(9.1);
  });
});

describe('kalori Garmin', () => {
  it('membaca kalori terbakar harian', () => {
    expect(parseCalories({ calendarDate: '2026-10-25', totalKilocalories: 2185, activeKilocalories: 172, bmrKilocalories: 2013, consumedKilocalories: null })).toEqual({
      date: '2026-10-25', calories_total: 2185, calories_active: 172, calories_bmr: 2013,
    });
    expect(parseCalories({ calendarDate: '2026-10-25' })).toBeNull();
  });
});
