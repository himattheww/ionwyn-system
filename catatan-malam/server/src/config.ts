import { isAbsolute, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '../..')

function fromRoot(path: string) {
  return isAbsolute(path) ? path : resolve(projectRoot, path)
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.ALLOW_LAN === 'true' ? '0.0.0.0' : '127.0.0.1',
  dbPath: fromRoot(process.env.DB_PATH || 'data/catatan.db'),
  backupFolder: process.env.BACKUP_FOLDER ? fromRoot(process.env.BACKUP_FOLDER) : null,
  webDist: resolve(projectRoot, 'web/dist'),
}
