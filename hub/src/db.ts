import postgres from 'postgres'

let sql: postgres.Sql | null = null

export const db = () => (sql ??= postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, idle_timeout: 20 }))
