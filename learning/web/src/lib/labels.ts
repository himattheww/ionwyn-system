export const levelLabel: Record<string, string> = { pemula: 'Pemula', menengah: 'Menengah', mahir: 'Mahir' }

export const statusLabel: Record<string, string> = {
  aktif: 'Aktif',
  arsip: 'Arsip',
  belum: 'Belum',
  sedang: 'Sedang',
  selesai: 'Selesai',
  sudah_bisa: 'Sudah bisa',
}

export function formatMinutes(total: number) {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (!hours) return `${minutes} mnt`
  return minutes ? `${hours} jam ${minutes} mnt` : `${hours} jam`
}

export const weekPercent = (minutes: number, hoursPerWeek: number) =>
  Math.min(100, Math.round((minutes / (hoursPerWeek * 60)) * 100))

export const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
