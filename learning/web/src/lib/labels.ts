export const levelLabel: Record<string, string> = { pemula: 'Pemula', menengah: 'Menengah', mahir: 'Mahir' }

export const statusLabel: Record<string, string> = {
  aktif: 'Aktif',
  arsip: 'Arsip',
  belum: 'Belum',
  sedang: 'Sedang',
  dikerjakan: 'Dikerjakan',
  selesai: 'Selesai',
  sudah_bisa: 'Sudah bisa',
}

export const difficultyLabel: Record<string, string> = { mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit' }

export function formatMinutes(total: number) {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (!hours) return `${minutes} mnt`
  return minutes ? `${hours} jam ${minutes} mnt` : `${hours} jam`
}

export const weekPercent = (minutes: number, hoursPerWeek: number) =>
  Math.min(100, Math.round((minutes / (hoursPerWeek * 60)) * 100))

export function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
