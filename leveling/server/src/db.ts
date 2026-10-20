import postgres from 'postgres'

export interface Db {
  all<T = any>(text: string, params?: unknown[]): Promise<T[]>
  one<T = any>(text: string, params?: unknown[]): Promise<T | undefined>
  run(text: string, params?: unknown[]): Promise<number>
  transaction<T>(work: (tx: Db) => Promise<T>): Promise<T>
}

export function numbered(text: string) {
  let index = 0
  return text.replace(/\?/g, () => `$${++index}`)
}

export const parsers = {
  int8: (value: string) => Number(value),
  date: (value: string) => value,
  timestamptz: (value: string) => new Date(value).toISOString(),
}

type Unsafe = (text: string, params: never[]) => Promise<any[] & { count: number }>

function wrap(unsafe: Unsafe, begin?: <T>(work: (unsafe: Unsafe) => Promise<T>) => Promise<T>): Db {
  const db: Db = {
    all: async (text, params = []) => Array.from(await unsafe(numbered(text), params as never[])),
    one: async (text, params = []) => (await unsafe(numbered(text), params as never[]))[0],
    run: async (text, params = []) => (await unsafe(numbered(text), params as never[])).count,
    transaction: (work) => (begin ? begin((tx) => work(wrap(tx))) : work(db)),
  }
  return db
}

export function openDb(url: string): Db {
  const sql = postgres(url, {
    prepare: false,
    max: Number(process.env.PG_POOL_MAX ?? 3),
    idle_timeout: 20,
    types: {
      int8: { to: 20, from: [20], serialize: String, parse: parsers.int8 },
      date: { to: 1082, from: [1082], serialize: String, parse: parsers.date },
      timestamptz: { to: 1184, from: [1184], serialize: (v: unknown) => String(v), parse: parsers.timestamptz },
    } as never,
  })
  const unsafe: Unsafe = (text, params) => sql.unsafe(text, params) as never
  return wrap(unsafe, (work) => sql.begin((tx) => work((text, params) => tx.unsafe(text, params) as never)) as never)
}

export function dbFromUnsafe(unsafe: Unsafe, begin?: <T>(work: (unsafe: Unsafe) => Promise<T>) => Promise<T>) {
  return wrap(unsafe, begin)
}
