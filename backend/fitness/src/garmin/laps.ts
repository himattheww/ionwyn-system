export type Lap = {
  lap: number;
  intensity: string | null;
  step: number | null;
  duration_sec: number;
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

export type LapRow = Omit<Lap, 'lap' | 'intensity' | 'step'> & {
  kind: 'group' | 'lap' | 'summary';
  label: string;
  interval: number | null;
  stepType: string | null;
  cumulative_sec: number;
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parseLaps(json: any): Lap[] {
  const laps = json?.lapDTOs;
  if (!Array.isArray(laps)) return [];
  return laps
    .filter((l) => num(l?.duration) != null)
    .map((l, i) => {
      const stride = num(l.strideLength);
      return {
        lap: num(l.lapIndex) ?? i + 1,
        intensity: typeof l.intensityType === 'string' ? l.intensityType : null,
        step: num(l.wktStepIndex),
        duration_sec: num(l.duration)!,
        moving_sec: num(l.movingDuration),
        distance_m: num(l.distance) ?? 0,
        speed: num(l.averageSpeed),
        gap_speed: num(l.avgGradeAdjustedSpeed),
        max_speed: num(l.maxSpeed),
        avg_hr: num(l.averageHR),
        max_hr: num(l.maxHR),
        ascent_m: num(l.elevationGain),
        descent_m: num(l.elevationLoss),
        cadence: num(l.averageRunCadence),
        max_cadence: num(l.maxRunCadence),
        gct_ms: num(l.groundContactTime),
        stride_m: stride == null ? null : stride / 100,
        vo_cm: num(l.verticalOscillation),
        vr_pct: num(l.verticalRatio),
        np: num(l.normalizedPower),
        power: num(l.averagePower),
        max_power: num(l.maxPower),
        calories: num(l.calories),
      };
    });
}

const STEP_LABEL: Record<string, string> = {
  WARMUP: 'Warm Up',
  ACTIVE: 'Run',
  RECOVERY: 'Recovery',
  REST: 'Rest',
  COOLDOWN: 'Cool Down',
};

function combine(laps: Lap[]) {
  const total = (key: keyof Lap) => {
    const values = laps.map((l) => l[key] as number | null).filter((v): v is number => v != null);
    return values.length ? values.reduce((sum, v) => sum + v, 0) : null;
  };
  const max = (key: keyof Lap) => {
    const values = laps.map((l) => l[key] as number | null).filter((v): v is number => v != null);
    return values.length ? Math.max(...values) : null;
  };
  const weighted = (key: keyof Lap) => {
    let sum = 0;
    let weight = 0;
    for (const l of laps) {
      const v = l[key] as number | null;
      if (v == null) continue;
      sum += v * l.duration_sec;
      weight += l.duration_sec;
    }
    return weight ? sum / weight : null;
  };
  const duration = total('duration_sec') ?? 0;
  const distance = total('distance_m') ?? 0;
  return {
    duration_sec: duration,
    moving_sec: total('moving_sec'),
    distance_m: distance,
    speed: duration ? distance / duration : null,
    gap_speed: weighted('gap_speed'),
    max_speed: max('max_speed'),
    avg_hr: weighted('avg_hr'),
    max_hr: max('max_hr'),
    ascent_m: total('ascent_m'),
    descent_m: total('descent_m'),
    cadence: weighted('cadence'),
    max_cadence: max('max_cadence'),
    gct_ms: weighted('gct_ms'),
    stride_m: weighted('stride_m'),
    vo_cm: weighted('vo_cm'),
    vr_pct: weighted('vr_pct'),
    np: weighted('np'),
    power: weighted('power'),
    max_power: max('max_power'),
    calories: total('calories'),
  };
}

export type ActivityTotals = {
  avg_hr: number | null;
  max_hr: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  cadence_spm: number | null;
  calories: number | null;
};

export function lapRows(laps: Lap[], totals?: ActivityTotals): LapRow[] {
  if (!laps.length) return [];
  const workout = laps.some((l) => l.step != null);
  const groups: Lap[][] = [];
  for (const lap of laps) {
    const last = groups.at(-1);
    const previous = last?.at(-1);
    const sameStep = previous && previous.intensity === lap.intensity && (previous.step === lap.step || previous.step == null || lap.step == null);
    if (workout && last && sameStep) last.push(lap);
    else groups.push([lap]);
  }

  const rows: LapRow[] = [];
  let interval = 0;
  let cumulative = 0;
  for (const group of groups) {
    const stepType = workout ? (STEP_LABEL[group[0].intensity ?? ''] ?? null) : null;
    const number = workout && group[0].intensity === 'ACTIVE' ? ++interval : null;
    const end = cumulative + group.reduce((sum, l) => sum + l.duration_sec, 0);
    if (group.length > 1) {
      rows.push({ kind: 'group', label: `${group[0].lap} - ${group.at(-1)!.lap}`, interval: number, stepType, cumulative_sec: end, ...combine(group) });
    }
    for (const lap of group) {
      cumulative += lap.duration_sec;
      const { lap: index, intensity: _intensity, step: _step, ...metrics } = lap;
      rows.push({ kind: 'lap', label: String(index), interval: group.length > 1 ? null : number, stepType, cumulative_sec: cumulative, ...metrics });
    }
  }
  const summary = combine(laps);
  rows.push({
    kind: 'summary',
    label: 'Summary',
    interval: null,
    stepType: null,
    cumulative_sec: cumulative,
    ...summary,
    avg_hr: totals?.avg_hr ?? summary.avg_hr,
    max_hr: totals?.max_hr ?? summary.max_hr,
    ascent_m: totals?.elevation_gain_m ?? summary.ascent_m,
    descent_m: totals?.elevation_loss_m ?? summary.descent_m,
    cadence: totals?.cadence_spm ?? summary.cadence,
    calories: totals?.calories ?? summary.calories,
  });
  return rows;
}
