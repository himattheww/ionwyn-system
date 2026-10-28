const TIME_ZONE = 'Asia/Jakarta';

export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const dayFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const shortFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const weekdayFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'long' });
const weekdayShortFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'short' });
const longFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const dateTimeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' });
const timeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });

const utcDate = (date: string) => new Date(`${date}T00:00:00Z`);

export const formatDay = (date: string) => dayFormat.format(utcDate(date));
export const formatShort = (date: string) => shortFormat.format(utcDate(date));
export const formatWeekday = (date: string) => weekdayFormat.format(utcDate(date));
export const formatWeekdayShort = (date: string) => weekdayShortFormat.format(utcDate(date));
export const formatLong = (date: string) => longFormat.format(utcDate(date));
export const dayOfMonth = (date: string) => String(Number(date.slice(8)));
export const formatDateTime = (iso: string | null) => (iso ? dateTimeFormat.format(new Date(iso)) : '-');
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

export function isoWeek(date: string) {
  const d = utcDate(date);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null) return '-';
  return value.toLocaleString('id-ID', { maximumFractionDigits: digits });
}

export function formatDuration(seconds: number | null) {
  if (seconds == null) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}j ${m}m` : `${m}m`;
}

export function formatMinutes(minutes: number | null) {
  return minutes == null ? '-' : formatDuration(minutes * 60);
}

export function formatPace(secPerKm: number | null) {
  if (secPerKm == null) return '-';
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s} /km`;
}

export function parseDecimal(input: string) {
  const value = Number(input.trim().replace(',', '.'));
  return input.trim() && Number.isFinite(value) ? value : null;
}

const monthFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'long', year: 'numeric' });
export const formatMonth = (month: string) => monthFormat.format(utcDate(`${month}-01`));

export const activityLabel = (type: string) => type.replace(/_/g, ' ');
