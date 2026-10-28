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

export const builds = [
  { name: 'catatan', dir: 'frontend/catatan', base: '/catatan/' },
  { name: 'fit', dir: 'frontend/fitness', base: '/fit/' },
  { name: 'leveling', dir: 'frontend/leveling', base: '/leveling/' },
  { name: 'learn', dir: 'frontend/learn', base: '/learn/' },
  { name: 'jadwal', dir: 'frontend/jadwal', base: '/jadwal/' },
  { name: 'uang', dir: 'frontend/uang', base: '/uang/' },
  { name: 'timesheet', dir: 'frontend/timesheet', base: '/timesheet/' }
]

const envFiles = ['--env-file-if-exists=.env', '--env-file-if-exists=../../.env']

export const processes = [
  {
    name: 'catatan',
    dir: 'backend/catatan',
    args: [...envFiles, '--import', 'tsx', 'src/index.ts'],
    env: { PORT: ports.catatan, ALLOW_LAN: 'false' }
  },
  {
    name: 'fit',
    dir: 'backend/fitness',
    args: [...envFiles, 'src/index.ts'],
    env: { PORT: ports.fit, ALLOW_LAN: 'false' }
  },
  {
    name: 'learn',
    dir: 'backend/learn',
    args: [...envFiles, '--import', 'tsx', 'src/index.ts'],
    env: { PORT: ports.learnApi }
  },
  {
    name: 'leveling',
    dir: 'backend/leveling',
    args: [...envFiles, 'src/main.ts'],
    delayMs: 8000,
    env: {
      PORT: ports.leveling,
      LEARN_API_URL: `http://127.0.0.1:${ports.learnApi}`
    }
  },
  {
    name: 'hub',
    dir: 'backend/hub',
    args: ['--import', 'tsx', 'src/index.ts'],
    env: { PORT: ports.hub }
  }
]
