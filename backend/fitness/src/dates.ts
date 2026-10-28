export const TIME_ZONE = 'Asia/Jakarta';

const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function jakartaDate(value: Date | string = new Date()): string {
  return dateFormat.format(typeof value === 'string' ? new Date(value) : value);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function weekRange(date: string) {
  const start = addDays(date, 1 - isoWeekday(date));
  return { start, end: addDays(start, 6) };
}

export function datesBetween(start: string, end: string): string[] {
  const dates = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
  return dates;
}
