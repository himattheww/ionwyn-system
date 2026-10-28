import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const require = createRequire(join(root, 'package.json'))
const { chromium } = require('playwright')

const [mode = 'gateway', label = mode, ...flags] = process.argv.slice(2)
const login = flags.includes('--login')
const browserPath = process.env.SCREENSHOT_BROWSER_PATH || '/Applications/Opera GX.app/Contents/MacOS/Opera'
const fixedTime = new Date('2026-10-19T20:00:00+07:00')
const viewport = { width: 1280, height: 760 }

const direct = {
  catatan: 'http://localhost:4710',
  fit: 'http://localhost:4712',
  leveling: 'http://localhost:4713',
  learn: 'http://localhost:4721',
  jadwal: 'http://localhost:4722',
  uang: 'http://localhost:4723',
  timesheet: 'http://localhost:4724'
}

const base = app => (mode === 'direct' ? direct[app] : `http://localhost:4000/${app}`)

const pages = [
  ['catatan', 'malam-ini', '/'],
  ['catatan', 'kalender', '/kalender'],
  ['catatan', 'entri', '/entri/2026-10-18'],
  ['catatan', 'pelajaran', '/pelajaran'],
  ['catatan', 'hal-baik', '/hal-baik'],
  ['catatan', 'cari', '/cari'],
  ['fit', 'ringkasan', '/'],
  ['fit', 'aktivitas', '/aktivitas'],
  ['fit', 'beban', '/beban'],
  ['fit', 'recovery', '/recovery'],
  ['fit', 'catat', '/catat'],
  ['fit', 'laporan', '/laporan'],
  ['fit', 'sinkron', '/sinkron'],
  ['fit', 'pengaturan', '/pengaturan'],
  ['leveling', 'karakter', '/'],
  ['leveling', 'riwayat', '/riwayat'],
  ['leveling', 'log', '/log'],
  ['leveling', 'achievement', '/achievement'],
  ['leveling', 'sumber', '/sumber'],
  ['learn', 'jalur', '/'],
  ['learn', 'jalur-baru', '/tracks/new'],
  ['learn', 'jalur-detail', '/tracks/1'],
  ['learn', 'topik', '/topics/1'],
  ['learn', 'sesi-baru', '/sessions/new'],
  ['jadwal', 'hari-ini', '/'],
  ['jadwal', 'rutinitas', '/', 'Rutinitas'],
  ['jadwal', 'riwayat', '/', 'Riwayat'],
  ['jadwal', 'pengaturan', '/', 'Pengaturan'],
  ['uang', 'dashboard', '/dashboard'],
  ['uang', 'transaksi', '/transactions'],
  ['uang', 'grafik', '/charts'],
  ['uang', 'goals', '/goals'],
  ['uang', 'budget', '/budget'],
  ['uang', 'ai', '/ai'],
  ['uang', 'profil', '/profile'],
  ['timesheet', 'hari-ini', '/']
]

const profileDir = join(root, '.screenshots/profile')
const outDir = join(root, '.screenshots', label)
mkdirSync(outDir, { recursive: true })

const context = await chromium.launchPersistentContext(profileDir, {
  executablePath: browserPath,
  headless: !login,
  viewport,
  deviceScaleFactor: 1,
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta'
})

const envRef = (file, key) => {
  const line = readFileSync(join(root, file), 'utf8').split(/\r?\n/).find(l => l.startsWith(`${key}=`))
  return new URL(line.slice(key.length + 1).trim()).hostname.split('.')[0]
}
const scheduleRef = envRef('backend/jadwal/.env', 'SUPABASE_URL')
const financeRef = envRef('frontend/uang/.env', 'VITE_SUPABASE_URL')

async function waitForLogin() {
  const targets = ['jadwal', 'uang', 'timesheet'].map(app => `${base(app)}/`)
  const tabs = []
  for (const target of targets) {
    const tab = await context.newPage()
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await tab.goto(target)
        break
      } catch {
        await tab.waitForTimeout(1000)
      }
    }
    tabs.push(tab)
  }
  console.log('Login di Scheduling dan FinTrack, lalu isi Koneksi di Timesheet pada jendela yang terbuka.')
  const deadline = Date.now() + 15 * 60 * 1000
  while (Date.now() < deadline) {
    const keys = await tabs[0].evaluate(() => Object.keys(localStorage).filter(k => localStorage[k])).catch(() => [])
    const others = await Promise.all(tabs.slice(1).map(tab => tab.evaluate(() => Object.keys(localStorage).filter(k => localStorage[k])).catch(() => [])))
    const all = new Set([...keys, ...others.flat()])
    const done = [scheduleRef, financeRef].map(ref => all.has(`sb-${ref}-auth-token`)).concat(all.has('timesheet.settings'))
    if (done.every(Boolean)) return console.log('Login lengkap.')
    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error('Waktu login habis')
}

if (login) {
  await waitForLogin()
  await context.close()
  process.exit(0)
}

let failed = 0
for (const [app, name, path, button] of pages) {
  const page = await context.newPage()
  await page.clock.setFixedTime(fixedTime)
  const file = join(outDir, `${app}__${name}.png`)
  try {
    await page.goto(`${base(app)}${path}`, { waitUntil: 'networkidle', timeout: 30000 })
    if (button) {
      await page.getByRole('button', { name: button, exact: true }).click()
      await page.waitForLoadState('networkidle')
    }
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(800)
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide' })
    console.log(`ok   ${app}/${name}`)
  } catch (error) {
    failed++
    console.log(`GAGAL ${app}/${name}: ${error.message.split('\n')[0]}`)
  }
  await page.close()
}

await context.close()
process.exit(failed ? 1 : 0)
