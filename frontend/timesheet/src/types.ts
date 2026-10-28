export type Hadir = '' | 'Y' | 'N'

export interface DayRow {
  date: string
  weekday: number
  holiday: boolean
  hadir: Hadir
  start: number | null
  end: number | null
  lunch: number | null
  worked: number | null
  note: string
}

export interface Count {
  workdays: number
  hadir: number
  sakit: number
  izin: number
  cuti: number
  kosong: number
  late: number
  short: number
  over: number
}

export interface MonthData {
  year: number
  month: number
  overtimeMin: number
  days: DayRow[]
  count: Count
}

export interface ApiResult {
  today: string
  month: MonthData
  message?: string
}

export type AbsenceKind = 'sakit' | 'izin' | 'cuti'

export type Entry =
  | { type: 'masuk' | 'keluar'; time: number }
  | { type: 'kegiatan'; text: string }
  | { type: 'absen'; kind: AbsenceKind }

export interface Settings {
  url: string
  apiKey: string
}
