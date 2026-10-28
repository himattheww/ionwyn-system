import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'
import { builds, root } from './apps.mjs'

const output = resolve(root, '.vercel/output')
const staticDir = join(output, 'static')
const functionDir = join(output, 'functions/api.func')
const skipFrontend = process.argv.includes('--skip-frontend')

if (!skipFrontend) {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/build.mjs')], { stdio: 'inherit', env: process.env })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

rmSync(output, { recursive: true, force: true })
mkdirSync(staticDir, { recursive: true })
mkdirSync(functionDir, { recursive: true })

cpSync(resolve(root, 'frontend/hub'), staticDir, { recursive: true })
cpSync(resolve(root, 'design'), join(staticDir, 'design'), { recursive: true })

for (const app of builds) {
  const dist = resolve(root, app.dir, 'dist')
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`${app.name} belum di-build: ${dist}`)
  cpSync(dist, join(staticDir, app.name), { recursive: true })
}

await build({
  entryPoints: [resolve(root, 'backend/vercel/api.ts')],
  outfile: join(functionDir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  external: ['playwright', 'playwright-core', 'fsevents'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'warning'
})

writeFileSync(
  join(functionDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs24.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      maxDuration: 300,
      environment: { GARMIN_SYNC: 'false', PG_POOL_MAX: '1' }
    },
    null,
    2
  )
)

const prefixes = builds.map(b => b.name)
const apiApps = ['catatan', 'fit', 'leveling', 'learn']
writeFileSync(
  join(output, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: `^/(${apiApps.join('|')})/api/(.*)$`, dest: '/api?__path=/$1/api/$2' },
        { src: '^/hub/api/(.*)$', dest: '/api?__path=/hub/api/$1' },
        { src: '^/timesheet/api$', dest: '/api?__path=/timesheet/api' },
        { src: '^/(authorize|token|register|revoke|consent|mcp)$', dest: '/api?__path=/$1' },
        { src: '^/\\.well-known/(oauth-[a-z-]+.*)$', dest: '/api?__path=/.well-known/$1' },
        { src: `^/(${prefixes.join('|')})$`, status: 308, headers: { Location: '/$1/' } },
        { handle: 'filesystem' },
        ...prefixes.map(prefix => ({ src: `^/${prefix}/(?!assets/).*$`, dest: `/${prefix}/index.html` })),
        { src: '^/(beranda|masuk|konsep|catat)/?$', dest: '/$1/index.html' }
      ]
    },
    null,
    2
  )
)

console.log(`Vercel output siap di ${output}`)
