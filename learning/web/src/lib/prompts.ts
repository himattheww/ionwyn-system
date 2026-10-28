export const claudeUrl = 'https://claude.ai/new'

export const prompts = {
  coding: 'Pakai Ionwyn Learn. Buatkan jalur belajar coding: [tulis tujuanmu, misalnya "React untuk dashboard"]. Levelku [pemula/menengah/mahir], waktuku [sekian] jam per minggu.',
  praktik: 'Pakai Ionwyn Learn. Buatkan jalur belajar non-coding dengan latihan praktik: [tulis tujuanmu, misalnya "public speaking"]. Levelku [pemula/menengah/mahir], waktuku [sekian] jam per minggu.',
  next: 'Pakai Ionwyn. Lihat progres belajarku, cita-citaku, catatan malam bulan ini, dan ringkasan fitness. Sarankan 3 hal yang bisa kupelajari berikutnya dari bidang berbeda, boleh di luar IT, beserta alasannya. Tanyakan dulu aku pilih yang mana sebelum membuat jalur.',
  finished: (goal: string) =>
    `Pakai Ionwyn. Aku baru menyelesaikan jalur "${goal}". Lihat progres belajarku, cita-citaku, catatan malam bulan ini, dan ringkasan fitness, lalu sarankan 3 hal yang bisa kupelajari berikutnya dari bidang berbeda, boleh di luar IT dan tidak harus lanjutan jalur ini. Tanyakan dulu aku pilih yang mana sebelum membuat jalur baru.`,
  fill: (topic: string, track: string, topicId: number) =>
    `Pakai Ionwyn Learn. Lengkapi topik "${topic}" (id ${topicId}) di jalur "${track}" dengan penjelasan singkat dan satu latihan.`,
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
