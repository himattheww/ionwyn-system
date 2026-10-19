import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { installDirs, root } from './apps.mjs'

let failed = 0
for (const dir of installDirs) {
  const cwd = resolve(root, dir)
  const command = existsSync(resolve(cwd, 'package-lock.json')) ? 'ci' : 'install'
  console.log(`\n== npm ${command} di ${dir}`)
  const result = spawnSync('npm', [command, '--no-audit', '--no-fund'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) failed++
}
process.exit(failed ? 1 : 0)
