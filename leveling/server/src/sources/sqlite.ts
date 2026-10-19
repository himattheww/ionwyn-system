import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'

export function openReadOnly(path: string | undefined) {
  if (!path) throw new Error('Path database belum diisi')
  if (!existsSync(path)) throw new Error(`File database tidak ditemukan: ${path}`)
  return new Database(path, { readonly: true, fileMustExist: true })
}
