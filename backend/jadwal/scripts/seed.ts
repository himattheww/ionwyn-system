import { createPlannerClient } from '../adapters/supabase/store'
import { itemToRow, logToRow } from '../adapters/supabase/rows'
import { buildDummy, itemIdRange, logIdRange } from './dummy-data'

process.loadEnvFile('.env')

const { SUPABASE_URL, SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD } = process.env

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error('.env belum lengkap: SUPABASE_URL, SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD')
}

const client = createPlannerClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

const clear = async () => {
  const logs = await client
    .from('activity_logs')
    .delete({ count: 'exact' })
    .gte('id', logIdRange.from)
    .lte('id', logIdRange.to)
  check(logs.error)
  const items = await client
    .from('schedule_items')
    .delete({ count: 'exact' })
    .gte('id', itemIdRange.from)
    .lte('id', itemIdRange.to)
  check(items.error)
  console.log(`dihapus: ${items.count ?? 0} item, ${logs.count ?? 0} log`)
}

const seed = async () => {
  await clear()
  const { items, logs } = buildDummy(new Date())
  check((await client.from('schedule_items').insert(items.map(itemToRow))).error)
  check((await client.from('activity_logs').insert(logs.map(logToRow))).error)
  const byStatus = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1
    return acc
  }, {})
  console.log(`dibuat: ${items.length} item, ${logs.length} log`)
  console.log(byStatus)
}

const main = async () => {
  const { error } = await client.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD })
  check(error)
  if (process.argv[2] === 'clear') await clear()
  else await seed()
  await client.auth.signOut()
}

main().catch((failure) => {
  console.error(failure instanceof Error ? failure.message : failure)
  process.exit(1)
})
