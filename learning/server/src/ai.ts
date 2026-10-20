import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { z } from 'zod'
import { env } from './env.js'

export class AiError extends Error {}

const sourceSchema = z.object({ title: z.string().trim().min(1), url: z.string().trim().min(1) })

const topicPlanSchema = z.object({
  topics: z
    .array(
      z.object({
        order: z.number().int(),
        title: z.string().trim().min(1),
        objective: z.string().trim().min(1),
        estSessions: z.number().int().positive(),
        prerequisites: z.array(z.string()).default([]),
        sources: z.array(sourceSchema).default([]).transform((s) => s.slice(0, 3)),
      }),
    )
    .min(1)
    .max(12),
})

const studyCaseSchema = z.object({
  title: z.string().trim().min(1),
  scenario: z.string().trim().min(1),
  requirements: z.array(z.string()).min(1),
  acceptanceCriteria: z.array(z.string()).min(1),
  stretchGoals: z.array(z.string()).default([]),
  estSessions: z.number().int().positive(),
})

export type AiTopic = z.infer<typeof topicPlanSchema>['topics'][number]
export type AiStudyCase = z.infer<typeof studyCaseSchema>

export type TopicPlanInput = { goal: string; currentLevel: string; hoursPerWeek: number; knownTopics: string[] }
export type StudyCaseInput = {
  goal: string
  topicTitle: string
  topicObjective: string
  currentLevel: string
  difficulty: string
  domainHint: string | null
}

export interface AiService {
  planTopics(input: TopicPlanInput): Promise<AiTopic[]>
  createStudyCase(input: StudyCaseInput): Promise<AiStudyCase>
}

const jsonOnly = 'Jawab hanya dengan JSON valid sesuai skema, tanpa teks lain. Bahasa Indonesia, istilah teknis tetap English.'

const plannerSystem = `Kamu perencana belajar. ${jsonOnly}`

const plannerInstruction = `Susun 5-12 topik berurutan untuk mencapai goal dari currentLevel. Lewati topik yang ada di knownTopics.
Tiap topik berisi judul singkat, tujuan satu kalimat tentang apa yang bisa dilakukan setelahnya, perkiraan jumlah sesi 60 menit, prasyarat berupa judul topik lain di daftar ini, dan maksimal 3 sumber dari dokumentasi resmi atau sumber yang sangat dikenal.
Jangan menulis materi atau penjelasan. Hanya cantumkan URL yang kamu yakin ada; kalau ragu, jangan cantumkan sumber itu.
Skema: {"topics":[{"order":1,"title":"","objective":"","estSessions":2,"prerequisites":[],"sources":[{"title":"","url":""}]}]}`

const caseSystem = `Kamu pembuat latihan praktik. ${jsonOnly}`

const caseInstruction = `Buat satu study case praktik yang bisa diselesaikan dalam 1-3 sesi 60 menit dan memaksa penerapan topik ini sesuai difficulty.
Kalau domainHint terisi, pakai domain itu untuk skenarionya. Berikan skenario realistis, requirement bernomor, kriteria selesai yang bisa dicek, dan 1-2 tantangan tambahan opsional. Jangan berikan kode solusi.
Skema: {"title":"","scenario":"","requirements":[],"acceptanceCriteria":[],"stretchGoals":[],"estSessions":1}`

type Complete = (system: string, prompt: string, jsonSchema: object) => Promise<string>

type CliResult = { is_error?: boolean; result?: string; structured_output?: unknown }

const completeWithCli: Complete = (system, prompt, jsonSchema) =>
  new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', '--system-prompt', system, '--json-schema', JSON.stringify(jsonSchema)]
    args.push('--tools', '', '--strict-mcp-config', '--no-session-persistence', '--setting-sources', '')
    if (env.ANTHROPIC_MODEL) args.push('--model', env.ANTHROPIC_MODEL)

    const { ANTHROPIC_API_KEY: _, ...childEnv } = process.env
    const child = execFile(
      env.CLAUDE_CLI_PATH,
      args,
      {
        cwd: tmpdir(),
        env: { CLAUDE_CODE_MAX_RETRIES: '2', ...childEnv },
        timeout: 180_000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        let output: CliResult | null = null
        try {
          output = JSON.parse(stdout)
        } catch {}

        if (output && !output.is_error) {
          resolve(output.structured_output ? JSON.stringify(output.structured_output) : (output.result ?? ''))
          return
        }

        console.error('Claude Code gagal', { err, stdout, stderr })
        if ((err as NodeJS.ErrnoException | null)?.code === 'ENOENT') {
          reject(new AiError('Claude Code CLI tidak ditemukan. Pastikan perintah `claude` bisa dijalankan, atau isi CLAUDE_CLI_PATH.'))
        } else if (err?.killed) {
          reject(new AiError('Claude Code tidak merespons dalam 3 menit. Coba lagi.'))
        } else {
          const detail = (output?.result || stderr || 'tanpa pesan').trim().slice(0, 300)
          reject(new AiError(`Claude Code gagal memanggil AI: ${detail}`))
        }
      },
    )
    child.stdin?.end(prompt)
  })

const completeWithApi: Complete = async (system, prompt) => {
  if (!env.ANTHROPIC_API_KEY || !env.ANTHROPIC_MODEL) {
    throw new AiError('Konfigurasi AI belum lengkap. Isi ANTHROPIC_API_KEY dan ANTHROPIC_MODEL di server/.env.')
  }

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(90_000),
    })
  } catch (err) {
    console.error('Gagal menghubungi API AI', err)
    throw new AiError('Tidak bisa terhubung ke layanan AI. Cek koneksi internet lalu coba lagi.')
  }

  if (!res.ok) {
    console.error(`API AI membalas ${res.status}`, await res.text())
    const messages: Record<number, string> = {
      401: 'API key AI ditolak. Cek ANTHROPIC_API_KEY.',
      403: 'API key AI tidak punya akses. Cek ANTHROPIC_API_KEY.',
      404: 'Model AI tidak ditemukan. Cek ANTHROPIC_MODEL.',
      429: 'Batas pemakaian AI tercapai. Tunggu sebentar lalu coba lagi.',
    }
    throw new AiError(messages[res.status] ?? `Layanan AI sedang bermasalah (${res.status}). Coba lagi nanti.`)
  }

  const body = (await res.json()) as { content?: { type: string; text?: string }[] }
  return body.content?.find((c) => c.type === 'text')?.text ?? ''
}

function parseJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

async function ask<T>(system: string, instruction: string, input: object, schema: z.ZodType<T>) {
  const prompt = `${instruction}\n\nInput:\n${JSON.stringify(input)}`
  const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema, { io: 'input', target: 'draft-7' })
  for (let attempt = 1; attempt <= 2; attempt++) {
    const text = await complete(system, prompt, jsonSchema)
    const parsed = schema.safeParse(parseJson(text))
    if (parsed.success) return parsed.data
    console.warn(`Jawaban AI tidak sesuai skema (percobaan ${attempt})`, text)
  }
  throw new AiError('Jawaban AI tidak sesuai format setelah 2 percobaan. Coba lagi sebentar lagi.')
}

const completeOff = async (): Promise<never> => {
  throw new AiError('Fitur AI dijalankan dari laptop. Buka Ionwyn lokal untuk membuat jalur atau study case.')
}

const complete = env.AI_PROVIDER === 'api' ? completeWithApi : env.AI_PROVIDER === 'off' ? completeOff : completeWithCli

export const ai: AiService = {
  async planTopics(input) {
    const plan = await ask(plannerSystem, plannerInstruction, input, topicPlanSchema)
    return plan.topics.sort((a, b) => a.order - b.order)
  },
  createStudyCase(input) {
    return ask(caseSystem, caseInstruction, input, studyCaseSchema)
  },
}
