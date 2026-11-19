import express, { Router } from 'express'
import { db } from './db.ts'

type FinanceBody = { type: 'expense' | 'income' | 'transfer'; amount: number; pos?: string; category?: string; account?: string; to?: string; unplanned?: boolean; note: string }
type TimesheetBody = { action: 'entry'; date: string; type: 'masuk' | 'keluar' | 'kegiatan' | 'absen'; time?: number; text?: string; kind?: 'sakit' | 'izin' | 'cuti' }
type ScheduleBody = { title: string; date: string; startTime?: string; durationMin: number; kind: 'fixed' | 'flexible'; module: string }

export type VoiceAction =
  | { kind: 'finance'; summary: string; body: FinanceBody }
  | { kind: 'timesheet'; summary: string; body: TimesheetBody }
  | { kind: 'schedule'; summary: string; body: ScheduleBody }

export type VoiceContext = { today: string; now: string; pos: string[]; accounts: string[] }

const aliases: Record<string, string[]> = {
  makan: ['makan', 'minum', 'kopi', 'jajan', 'sarapan', 'makan siang', 'makan malam', 'snack', 'gofood', 'grabfood', 'shopeefood', 'warteg', 'nasi', 'galon'],
  transportasi: ['transport', 'bensin', 'ojek', 'ojol', 'gojek', 'grab', 'goride', 'grabbike', 'parkir', 'tol', 'kereta', 'krl', 'mrt', 'lrt', 'busway', 'transjakarta', 'taksi', 'bus', 'angkot'],
  kos: ['kos', 'kost', 'kosan', 'sewa kamar'],
  'kebutuhan pribadi': ['sabun', 'sampo', 'shampo', 'odol', 'skincare', 'potong rambut', 'cukur', 'laundry', 'obat'],
  'ai subscription': ['claude', 'chatgpt', 'langganan ai'],
  'cicilan garmin': ['garmin']
}

const days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']
const rupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID')
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const has = (text: string, word: string) => new RegExp(`(^|[^a-z0-9])${escape(word)}($|[^a-z0-9])`).test(text)
const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

function shiftDate(date: string, offset: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

const dayLabel = (date: string, today: string) => {
  if (date === today) return 'hari ini'
  if (date === shiftDate(today, 1)) return 'besok'
  if (date === shiftDate(today, -1)) return 'kemarin'
  const d = new Date(`${date}T00:00:00Z`)
  return `${days[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}

const digitWords: Record<string, number> = { nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 }
const startWords: Record<string, number> = { ...digitWords, sepuluh: 10, sebelas: 11, seratus: 100, seribu: 1_000, sejuta: 1_000_000 }
const scaleWords = new Set(['belas', 'puluh', 'ratus', 'ribu', 'juta'])

export function wordsToDigits(text: string) {
  const tokens = text.split(' ')
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    if (!(tokens[i]! in startWords)) {
      out.push(tokens[i]!)
      continue
    }
    let total = 0
    let small = 0
    let unit = 0
    for (; i < tokens.length && (tokens[i]! in startWords || scaleWords.has(tokens[i]!)); i++) {
      const word = tokens[i]!
      if (word in digitWords) {
        unit = digitWords[word]!
        small += unit
      } else if (word === 'belas') small += 10
      else if (word === 'puluh') small += unit * 9
      else if (word === 'ratus') small += unit * 99
      else if (word === 'ribu' || word === 'seribu') {
        total += (word === 'seribu' ? 1 : small || 1) * 1_000
        small = 0
      } else if (word === 'juta' || word === 'sejuta') {
        total += (word === 'sejuta' ? 1 : small || 1) * 1_000_000
        small = 0
      } else small += startWords[word]!
      if (!(word in digitWords)) unit = 0
    }
    i--
    out.push(String(total + small))
  }
  return out.join(' ')
}

export function normalize(raw: string) {
  return wordsToDigits(raw
    .toLowerCase()
    .replace(/^\s*(hey|hei|hai|halo)\s+\S+[\s,.!]+/, '')
    .replace(/'/g, '')
    .replace(/[!?;"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim())
}

const wordAmounts: [RegExp, number][] = [
  [/\bsetengah juta\b/, 500_000],
  [/\bsejuta\b/, 1_000_000],
  [/\bseratus ribu\b/, 100_000],
  [/\bseribu\b/, 1_000]
]

export function findAmount(text: string) {
  const pattern = /(rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(ribu|rb|k|juta|jt)?(?![a-z0-9])/g
  for (const match of text.matchAll(pattern)) {
    const [whole, currency, digits, unit] = match
    const before = text.slice(0, match.index)
    if (/(jam|pukul|tanggal|tgl|setengah|selama)\s*$/.test(before) || /^[:]/.test(text.slice(match.index! + whole.length))) continue
    if (!unit && !currency && /^\d{1,2}[.:]\d{2}$/.test(digits!)) continue
    const multiplier = unit === 'juta' || unit === 'jt' ? 1_000_000 : unit ? 1_000 : 1
    const grouped = /^\d{1,3}([.,]\d{3})+$/.test(digits!)
    const value = unit && !grouped ? Number(digits!.replace(',', '.')) : Number(digits!.replace(/[.,]/g, ''))
    const amount = Math.round(value * multiplier)
    if (Number.isFinite(amount) && (unit || currency || amount >= 500)) return { amount, text: whole }
  }
  for (const [pattern, amount] of wordAmounts) {
    const match = text.match(pattern)
    if (match) return { amount, text: match[0] }
  }
  return null
}

export function findTime(text: string) {
  const half = text.match(/(?:jam|pukul)\s+setengah\s+(\d{1,2})/)
  let hour: number
  let minute = 0
  let rest: string
  if (half) {
    hour = Number(half[1]) - 1
    minute = 30
    rest = text.slice(half.index! + half[0].length)
  } else {
    const match = text.match(/(?:jam|pukul)\s+(\d{1,2})(?:[.:](\d{2}))?/) ?? text.match(/(?<![\d.,])(\d{1,2})[:.](\d{2})(?![\d.,])/)
    if (!match) return null
    hour = Number(match[1])
    minute = Number(match[2] ?? 0)
    rest = text.slice(match.index! + match[0].length)
  }
  const period = rest.match(/^\s*(pagi|siang|sore|malam)/)?.[1]
  if ((period === 'sore' || period === 'malam') && hour < 12) hour += 12
  if (period === 'siang' && hour <= 6) hour += 12
  if (period === 'malam' && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

export function findDate(text: string, today: string) {
  if (has(text, 'lusa')) return shiftDate(today, 2)
  if (has(text, 'besok')) return shiftDate(today, 1)
  if (has(text, 'kemarin')) return shiftDate(today, -1)
  const dayOfMonth = text.match(/(?:tanggal|tgl)\s+(\d{1,2})/)
  if (dayOfMonth) {
    const n = Number(dayOfMonth[1])
    const month = today.slice(0, 7)
    const candidate = `${month}-${pad(n)}`
    if (candidate >= today) return candidate
    const next = new Date(`${month}-01T00:00:00Z`)
    next.setUTCMonth(next.getUTCMonth() + 1)
    return `${next.toISOString().slice(0, 7)}-${pad(n)}`
  }
  const todayIndex = new Date(`${today}T00:00:00Z`).getUTCDay()
  for (const [index, name] of days.entries()) {
    if (has(text, name)) return shiftDate(today, ((index - todayIndex + 7) % 7) || 7)
  }
  return today
}

function findAccount(text: string, accounts: string[], words: string[]) {
  for (const name of [...accounts].sort((a, b) => b.length - a.length)) {
    if (words.some(word => has(text, `${word} ${name.toLowerCase()}`))) return name
  }
  return undefined
}

export function findPos(text: string, pos: string[]) {
  let best: { name: string; length: number } | undefined
  for (const name of pos) {
    const key = name.toLowerCase()
    for (const word of [key, ...(aliases[key] ?? [])]) {
      if (has(text, word) && (!best || word.length > best.length)) best = { name, length: word.length }
    }
  }
  return best?.name
}

function finance(text: string, raw: string, amount: number, ctx: VoiceContext): VoiceAction | string {
  const note = raw.trim().slice(0, 200)
  const from = findAccount(text, ctx.accounts, ['dari', 'pakai', 'pake', 'via', 'lewat'])
  if (/\b(transfer|tf|pindah|pindahkan|pindahin|nabung|menabung|setor)\b/.test(text)) {
    const to = findAccount(text, ctx.accounts, ['ke']) ?? (/\b(nabung|menabung|setor)\b/.test(text) ? ctx.accounts.find(a => /tabungan/i.test(a)) : undefined)
    if (!to) return `Transfer ke rekening mana? Pilihan: ${ctx.accounts.join(', ')}.`
    const source = from ?? ctx.accounts[0]
    if (source === to) return 'Rekening asal dan tujuan transfer sama.'
    return { kind: 'finance', summary: `Transfer ${rupiah(amount)} dari ${source} ke ${to}`, body: { type: 'transfer', amount, account: source, to, note } }
  }
  if (/\b(gaji|gajian|pemasukan|terima|dapat|dapet|freelance|proyek|project|bonus|bisnis|jualan|thr)\b/.test(text)) {
    const category = /\b(gaji|gajian|thr)\b/.test(text) ? 'gaji' : /\b(freelance|proyek|project)\b/.test(text) ? 'freelance' : /\b(bisnis|jualan)\b/.test(text) ? 'bisnis' : 'lainnya'
    const account = findAccount(text, ctx.accounts, ['ke', 'di']) ?? from ?? ctx.accounts[0]
    return { kind: 'finance', summary: `Pemasukan ${rupiah(amount)} · ${category} · ke ${account}`, body: { type: 'income', amount, category, account, note } }
  }
  const pos = findPos(text, ctx.pos) ?? 'lainnya'
  const unplanned = /\b(dadakan|mendadak|darurat)\b/.test(text)
  const summary = [`Pengeluaran ${rupiah(amount)}`, `pos ${pos}`, from ? `dari ${from}` : 'dari rekening pos', unplanned ? 'dadakan' : ''].filter(Boolean).join(' · ')
  return { kind: 'finance', summary, body: { type: 'expense', amount, pos, ...(from ? { account: from } : {}), unplanned, note } }
}

const moduleOf = (text: string) =>
  /\b(lari|run|gym|renang|olahraga|jogging|workout|latihan|yoga|sepeda)\b/.test(text) ? 'kesehatan'
  : /\b(belajar|kursus|kelas|baca|membaca)\b/.test(text) ? 'belajar'
  : /\b(kerja|meeting|rapat|kantor|klien|client)\b/.test(text) ? 'kerja'
  : /\b(bayar|tagihan|cicilan|nabung)\b/.test(text) ? 'keuangan'
  : 'umum'

function schedule(rest: string, ctx: VoiceContext): VoiceAction | string {
  const date = findDate(rest, ctx.today)
  const start = findTime(rest)
  const duration = rest.match(/(?:selama\s+)?(\d{1,3})\s*(menit|jam)\b/)
  const durationMin = duration ? Number(duration[1]) * (duration[2] === 'jam' ? 60 : 1) : 60
  const title = rest
    .replace(/(?:selama\s+)?\d{1,3}\s*(menit|jam)\b/g, ' ')
    .replace(/(?:jam|pukul)\s+(setengah\s+)?\d{1,2}([.:]\d{2})?(\s+(pagi|siang|sore|malam))?/g, ' ')
    .replace(/(?<![\d.,])\d{1,2}[:.]\d{2}(?![\d.,])/g, ' ')
    .replace(/(?:tanggal|tgl)\s+\d{1,2}/g, ' ')
    .replace(new RegExp(`(^|\\s)(hari ini|nanti|besok|lusa|(hari\\s+)?(${days.join('|')}))(?=\\s|$)`, 'g'), ' ')
    .replace(/^\s*(untuk|buat|:)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!title) return 'Judul jadwalnya apa? Contoh: jadwal lari besok jam 6 pagi.'
  if (durationMin < 5 || durationMin > 1440) return 'Durasi jadwal harus 5 menit sampai 24 jam.'
  const name = title[0]!.toUpperCase() + title.slice(1)
  const body: ScheduleBody = { title: name, date, durationMin, kind: start == null ? 'flexible' : 'fixed', module: moduleOf(rest), ...(start == null ? {} : { startTime: hhmm(start) }) }
  return { kind: 'schedule', summary: `Jadwal "${name}" ${dayLabel(date, ctx.today)}${start == null ? '' : ` jam ${hhmm(start)}`} · ${durationMin} menit`, body }
}

export function parseCommand(raw: string, ctx: VoiceContext): VoiceAction | string {
  const text = normalize(raw)
  if (!text) return 'Perintahnya kosong.'

  const activity = text.match(/^(?:catat\s+)?kegiatan\s*[:,]?\s*(.*)$/)
  if (activity) {
    const body = activity[1]!.trim()
    if (!body) return 'Isi kegiatannya apa?'
    const value = raw.trim().replace(/^.*?kegiatan\s*[:,]?\s*/i, '').slice(0, 500)
    return { kind: 'timesheet', summary: `Kegiatan hari ini: ${value}`, body: { action: 'entry', date: ctx.today, type: 'kegiatan', text: value } }
  }

  const plan = text.match(/^(?:tambah\s+|buat\s+)?(?:jadwal(?:kan)?|ingatkan|ingetin|reminder|agenda)\b\s*(.*)$/)
  if (plan) return schedule(plan[1]!, ctx)

  const money = findAmount(text)
  if (money) return finance(text, raw, money.amount, ctx)

  const leave = text.match(/\b(sakit|izin|ijin|cuti)\b/)
  if (leave) {
    const kind = leave[1] === 'ijin' ? 'izin' : (leave[1] as 'sakit' | 'izin' | 'cuti')
    const date = findDate(text, ctx.today)
    return { kind: 'timesheet', summary: `Absen ${kind} ${dayLabel(date, ctx.today)}`, body: { action: 'entry', date, type: 'absen', kind } }
  }

  const clock = text.match(/\b(masuk|datang|check ?in|pulang|keluar|check ?out)\b/)
  if (clock) {
    const type = /^(masuk|datang|check ?in)$/.test(clock[1]!) ? 'masuk' : 'keluar'
    const date = has(text, 'kemarin') ? shiftDate(ctx.today, -1) : ctx.today
    const [h, m] = ctx.now.split(':').map(Number)
    const time = findTime(text) ?? h! * 60 + m!
    return { kind: 'timesheet', summary: `Absen ${type} ${dayLabel(date, ctx.today)} jam ${hhmm(time)}`, body: { action: 'entry', date, type, time } }
  }

  return 'Belum paham. Contoh: "makan 25 ribu", "transfer 1 juta ke Tabungan", "absen masuk jam 8", "kegiatan meeting klien", "jadwal lari besok jam 6 pagi".'
}

export function parseBest(texts: string[], ctx: VoiceContext) {
  let first: string | undefined
  for (const text of texts) {
    const result = parseCommand(text, ctx)
    if (typeof result !== 'string') return { action: result, heard: text }
    first ??= result
  }
  return first ?? 'Perintahnya kosong.'
}

const keywords = ['ribu', 'juta', 'rupiah', 'transfer', 'nabung', 'gaji', 'pemasukan', 'dadakan', 'absen', 'masuk', 'pulang', 'kegiatan', 'jadwal', 'ingatkan', 'besok', 'lusa', 'jam', 'setengah', 'sakit', 'izin', 'cuti']

const jakarta = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' })

export function voiceRoutes() {
  const router = Router()
  const lists = async () => {
    const owner = process.env.OWNER_USER_ID
    if (!owner || !process.env.DATABASE_URL) throw Object.assign(new Error('OWNER_USER_ID atau DATABASE_URL belum diisi.'), { status: 500 })
    const [accounts, items] = await Promise.all([
      db()<{ name: string }[]>`select name from public.accounts where user_id = ${owner} and not archived order by sort, created_at`,
      db()<{ name: string }[]>`select name from public.budget_items where user_id = ${owner} and not archived and kind <> 'tabungan' order by sort`
    ])
    return { accounts: accounts.map(a => a.name), pos: items.map(i => i.name) }
  }

  router.get('/hub/api/voice/hints', async (_req, res) => {
    const { accounts, pos } = await lists()
    res.json({ hints: [...new Set([...pos, ...accounts, ...keywords])] })
  })

  router.post('/hub/api/voice/parse', express.json(), async (req, res) => {
    const { text, alternatives = [] } = req.body ?? {}
    const valid = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 300
    if (!valid(text) || !Array.isArray(alternatives) || alternatives.length > 10 || !alternatives.every(valid)) {
      return res.status(400).json({ error: 'Isi perintah, maksimal 300 karakter.' })
    }
    const now = jakarta()
    const result = parseBest([...new Set([text, ...alternatives])], { today: now.slice(0, 10), now: now.slice(11, 16), ...(await lists()) })
    if (typeof result === 'string') return res.status(422).json({ error: result })
    res.json(result)
  })
  return router
}
