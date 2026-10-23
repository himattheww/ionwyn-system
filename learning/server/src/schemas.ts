import { z } from 'zod'

export const levels = ['pemula', 'menengah', 'mahir'] as const
export const trackKinds = ['coding', 'praktik'] as const
export const trackStatuses = ['aktif', 'selesai', 'arsip'] as const
export const exerciseLanguages = ['javascript', 'typescript', 'python', 'csharp', 'sql', 'lainnya'] as const

export const idParam = z.object({ id: z.coerce.number().int().positive() })

const text = (max: number) => z.string().trim().min(1).max(max)
const httpUrl = z.url({ protocol: /^https?$/ })

export const sourceSchema = z.object({ title: text(200), url: httpUrl })

const testSchema = z.object({
  name: text(200).describe('Nama kasus uji'),
  call: text(500).describe('Ekspresi JavaScript yang memanggil fungsi latihan, misalnya hitung([1,2])'),
  expected: text(2000).describe('Hasil yang diharapkan dalam format JSON, misalnya "3", "[1,2]", "{\\"x\\":1}" atau "\\"teks\\""'),
})

export const exerciseSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('code'),
      title: text(200),
      prompt: text(4000).describe('Instruksi latihan tanpa solusi lengkap'),
      language: z.enum(exerciseLanguages),
      starter: z.string().max(10_000).default('').describe('Kerangka kode awal'),
      tests: z.array(testSchema).max(8).default([]).describe('Wajib 3-6 kasus untuk javascript: fungsi murni tanpa DOM, import, atau library. Kosongkan untuk bahasa lain'),
      checklist: z.array(text(300)).max(10).default([]).describe('Daftar cek mandiri. Wajib untuk bahasa selain javascript'),
    }),
    z.object({
      type: z.literal('praktik'),
      title: text(200),
      prompt: text(4000).describe('Tugas praktik nyata yang dikerjakan di luar aplikasi'),
      checklist: z.array(text(300)).min(1).max(10).describe('Daftar cek untuk menilai praktik sendiri'),
    }),
  ])
  .refine((e) => e.type === 'praktik' || (e.language === 'javascript' ? e.tests.length > 0 : e.checklist.length > 0), {
    message: 'Latihan javascript butuh tests, bahasa lain butuh checklist',
  })

export const topicInput = z.object({
  title: text(200),
  objective: text(500).describe('Satu kalimat: apa yang bisa dilakukan setelah topik ini'),
  estSessions: z.number().int().min(1).max(50).describe('Perkiraan jumlah sesi 60 menit'),
  prerequisites: z.array(text(200)).max(12).default([]).describe('Judul topik lain di jalur ini yang harus selesai dulu'),
  sources: z.array(sourceSchema).max(3).default([]).describe('Maksimal 3 sumber resmi yang pasti ada'),
  summary: text(4000).describe('Penjelasan singkat 2-4 paragraf, dipisah baris kosong. Kode inline di antara backtick'),
  exercise: exerciseSchema,
})

export const trackInput = z.object({
  goal: text(200).describe('Tujuan belajar'),
  kind: z.enum(trackKinds).describe('coding untuk jalur pemrograman, praktik untuk hal lain seperti memasak atau public speaking'),
  currentLevel: z.enum(levels),
  hoursPerWeek: z.number().int().min(1).max(80),
  topics: z.array(topicInput).min(1).max(15),
})

export const topicUpdate = z.object({
  title: text(200).optional(),
  objective: text(500).optional(),
  summary: text(4000).optional(),
  sources: z.array(sourceSchema).max(3).optional(),
  exercise: exerciseSchema.optional(),
})

export const trackStatusRequest = z.object({ status: z.enum(trackStatuses) })

export const completeRequest = z.object({ durationMin: z.number().int().min(1).max(600) })

export const codeAttemptRequest = z.object({
  code: z.string().min(1).max(20_000),
  results: z.object({ passed: z.number().int().min(0), total: z.number().int().min(1) }),
})
