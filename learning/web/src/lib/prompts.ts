export const claudeUrl = 'https://claude.ai/new'

export const prompts = {
  coding: 'Pakai Ionwyn Learn. Buatkan jalur belajar coding: [tulis tujuanmu, misalnya "React untuk dashboard"]. Levelku [pemula/menengah/mahir], waktuku [sekian] jam per minggu.',
  praktik: 'Pakai Ionwyn Learn. Buatkan jalur belajar non-coding dengan latihan praktik: [tulis tujuanmu, misalnya "public speaking"]. Levelku [pemula/menengah/mahir], waktuku [sekian] jam per minggu.',
  next: 'Pakai Ionwyn Learn. Lihat progres belajarku, lalu sarankan 3 pilihan yang bisa kupelajari berikutnya beserta alasannya. Tanyakan dulu aku mau ke arah mana sebelum membuat jalur.',
  finished: (goal: string) =>
    `Pakai Ionwyn Learn. Aku baru menyelesaikan jalur "${goal}". Sarankan apa yang sebaiknya kupelajari berikutnya, boleh di bidang lain, lalu tanyakan aku mau ke arah mana sebelum membuat jalur baru.`,
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
