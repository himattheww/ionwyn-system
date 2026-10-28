import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { root } from './apps.mjs'

const bin = name => resolve(root, 'node_modules/.bin', name)
const vitest = bin('vitest')
const tsc = bin('tsc')
const vueTsc = bin('vue-tsc')

const steps = [
  ['hub', 'backend/hub', [vitest, 'run']],
  ['hub typecheck', 'backend/hub', [tsc, '-p', '.']],
  ['catatan', 'backend/catatan', [vitest, 'run']],
  ['catatan typecheck', 'backend/catatan', [tsc, '-p', '.', '--noEmit']],
  ['fitness', 'backend/fitness', [vitest, 'run']],
  ['fitness typecheck', 'backend/fitness', [tsc, '-p', '.']],
  ['leveling', 'backend/leveling', [vitest, 'run']],
  ['leveling typecheck', 'backend/leveling', [tsc, '-p', '.']],
  ['jadwal', 'backend/jadwal', [vitest, 'run', 'core', 'scripts', 'adapters/supabase/rows.test.ts']],
  ['jadwal typecheck', 'backend/jadwal', [tsc, '-p', '.']],
  ['learn typecheck', 'backend/learn', [tsc, '-p', '.']],
  ['web catatan', 'frontend/catatan', [vueTsc, '--noEmit']],
  ['web fitness', 'frontend/fitness', [vueTsc, '--noEmit']],
  ['web leveling', 'frontend/leveling', [vueTsc, '-p', '.']],
  ['web learn', 'frontend/learn', [vueTsc, '-b']],
  ['web jadwal', 'frontend/jadwal', [tsc, '-p', '.']],
  ['web uang', 'frontend/uang', [vueTsc, '--noEmit', '-p', 'tsconfig.app.json']],
  ['web timesheet', 'frontend/timesheet', [vueTsc, '-b']]
]

const typesOnly = process.argv.includes('--tipe')
const chosen = typesOnly ? steps.filter(([, , [command]]) => command !== vitest) : steps

const results = chosen.map(([name, dir, [command, ...args]]) => {
  console.log(`\n== ${name}`)
  const { status } = spawnSync(command, args, { cwd: resolve(root, dir), stdio: 'inherit', shell: process.platform === 'win32' })
  return [name, status === 0]
})

console.log('\nRingkasan:')
for (const [name, ok] of results) console.log(`${ok ? 'lulus ' : 'GAGAL '} ${name}`)
process.exit(results.every(([, ok]) => ok) ? 0 : 1)
