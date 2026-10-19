import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { root } from './apps.mjs'

const steps = [
  ['hub', '.', ['run', 'test:hub']],
  ['hub typecheck', '.', ['run', 'typecheck']],
  ['catatan-malam', 'catatan-malam', ['test']],
  ['fitness-track', 'fitness-track', ['test']],
  ['fitness-track typecheck', 'fitness-track', ['run', 'typecheck']],
  ['leveling', 'leveling', ['test']],
  ['leveling typecheck', 'leveling', ['run', 'typecheck']],
  ['jadwal', 'reminder-and-scheduling', ['exec', '--', 'vitest', 'run', 'core', 'scripts', 'adapters/supabase/rows.test.ts']],
  ['jadwal typecheck', 'reminder-and-scheduling', ['run', 'typecheck']],
  ['learn server typecheck', 'learning/server', ['run', 'typecheck']],
  ['learn web typecheck', 'learning/web', ['run', 'typecheck']]
]

const results = steps.map(([name, dir, args]) => {
  console.log(`\n== ${name}`)
  const { status } = spawnSync('npm', args, { cwd: resolve(root, dir), stdio: 'inherit', shell: process.platform === 'win32' })
  return [name, status === 0]
})

console.log('\nRingkasan:')
for (const [name, ok] of results) console.log(`${ok ? 'lulus ' : 'GAGAL '} ${name}`)
process.exit(results.every(([, ok]) => ok) ? 0 : 1)
