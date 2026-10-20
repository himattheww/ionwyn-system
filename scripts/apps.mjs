import { resolve } from 'node:path'

export const root = resolve(import.meta.dirname, '..')

const env = process.env
export const ports = {
  hub: Number(env.HUB_PORT ?? 4000),
  catatan: Number(env.CATATAN_PORT ?? 4710),
  learnApi: Number(env.LEARN_API_PORT ?? 4711),
  fit: Number(env.FIT_PORT ?? 4712),
  leveling: Number(env.LEVELING_PORT ?? 4713)
}

export const backupFolder = resolve(root, env.BACKUP_FOLDER || 'backups')

export const installDirs = [
  '.',
  'catatan-malam',
  'fitness-track',
  'leveling',
  'learning/server',
  'learning/web',
  'reminder-and-scheduling',
  'financetracker',
  'timesheet/web'
]

export const builds = [
  { name: 'catatan', dir: 'catatan-malam', base: '/catatan/' },
  { name: 'fit', dir: 'fitness-track', base: '/fit/' },
  { name: 'leveling', dir: 'leveling', base: '/leveling/' },
  { name: 'learn', dir: 'learning/web', base: '/learn/' },
  { name: 'jadwal', dir: 'reminder-and-scheduling', base: '/jadwal/' },
  { name: 'uang', dir: 'financetracker', base: '/uang/' },
  { name: 'timesheet', dir: 'timesheet/web', base: '/timesheet/' }
]

export const processes = [
  {
    name: 'catatan',
    dir: 'catatan-malam',
    args: ['start'],
    env: { PORT: ports.catatan, ALLOW_LAN: 'false' }
  },
  {
    name: 'fit',
    dir: 'fitness-track',
    args: ['start'],
    env: { PORT: ports.fit, ALLOW_LAN: 'false' }
  },
  {
    name: 'learn',
    dir: 'learning/server',
    args: ['start'],
    env: { PORT: ports.learnApi }
  },
  {
    name: 'leveling',
    dir: 'leveling',
    args: ['start'],
    delayMs: 8000,
    env: {
      PORT: ports.leveling,
      LEARN_API_URL: `http://127.0.0.1:${ports.learnApi}`
    }
  },
  {
    name: 'hub',
    dir: '.',
    args: ['exec', '--', 'tsx', 'hub/src/index.ts'],
    env: { PORT: ports.hub }
  }
]
