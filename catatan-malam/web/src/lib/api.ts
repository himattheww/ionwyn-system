export type Entry = {
  date: string
  happened: string
  goodThings: string
  lessons: string
  freeText: string | null
  isBackfilled: boolean
  createdAt: string
  updatedAt: string
}

export type EntryInput = Pick<Entry, 'happened' | 'goodThings' | 'lessons' | 'freeText'>

export type Today = {
  tonight: string
  yesterday: string
  isOpen: boolean
  tonightEntry: Entry | null
  yesterdayEmpty: boolean
  recent: Entry[]
  onThisDay: { label: string; entry: Entry }[]
}

export type MonthDay = { date: string; isBackfilled: boolean }
export type FieldItem = { date: string; text: string }
export type SearchResult = { date: string; field: string; snippet: string }

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${import.meta.env.BASE_URL}api${path}`, init)
  } catch {
    throw new ApiError('Tidak bisa terhubung ke server. Pastikan server masih berjalan.', 0)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.error ?? `Permintaan gagal (${res.status}).`, res.status)
  return body as T
}

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams(Object.entries(params).filter((p): p is [string, string] => !!p[1]))
  return search.size ? `?${search}` : ''
}

export const api = {
  today: () => request<Today>('/today'),
  month: (month: string) => request<MonthDay[]>(`/entries${query({ month })}`),
  entry: (date: string) => request<Entry>(`/entries/${date}`),
  saveEntry: (date: string, input: EntryInput) =>
    request<Entry>(`/entries/${date}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  lessons: (from?: string, to?: string) => request<FieldItem[]>(`/lessons${query({ from, to })}`),
  goodThings: (from?: string, to?: string) => request<FieldItem[]>(`/good-things${query({ from, to })}`),
  search: (q: string) => request<SearchResult[]>(`/search${query({ q })}`),
}
