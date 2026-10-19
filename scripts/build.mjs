import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { builds, root } from './apps.mjs'

const only = process.argv.slice(2)
let failed = 0
for (const app of builds.filter(b => !only.length || only.includes(b.name))) {
  console.log(`\n== build ${app.name} (${app.base})`)
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: resolve(root, app.dir),
    env: { ...process.env, APP_BASE: app.base },
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) failed++
}
process.exit(failed ? 1 : 0)
