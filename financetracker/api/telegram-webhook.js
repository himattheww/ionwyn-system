import { createClient } from '@supabase/supabase-js'
import { randomBytes, timingSafeEqual } from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
const APP_URL = process.env.APP_URL || 'https://financetracker-taupe-nine.vercel.app'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

const CAT_LABELS = {
  utama: 'Utama', jajan: 'Jajan', tabungan: 'Tabungan', dana_darurat: 'Dana Darurat',
  gaji: 'Gaji', freelance: 'Freelance', bisnis: 'Bisnis', lainnya: 'Lainnya',
}
const EXPENSE_CATS = ['utama', 'jajan', 'tabungan', 'dana_darurat']
const INCOME_CATS = ['gaji', 'freelance', 'bisnis', 'lainnya']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TX_COLS = 'id, type, amount, category, note, date'
const NO_KEYBOARD = { inline_keyboard: [] }
const MAX_AMOUNT = 1e12
const HISTORY_MONTHS = 12
const HISTORY_PAGE = 1000
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const formatRp = (n) => 'Rp ' + Math.round(Number(n)).toLocaleString('id-ID')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const catLabel = (c) => CAT_LABELS[c] || esc(c)
const catsFor = (type) => (type === 'income' ? INCOME_CATS : EXPENSE_CATS)
const typeOfCat = (c) => (EXPENSE_CATS.includes(c) ? 'expense' : INCOME_CATS.includes(c) ? 'income' : null)
const jakartaToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)

function shiftDate(date, days) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function validDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return dt.toISOString().slice(0, 10)
}

function parseDate(input) {
  const s = String(input || '').trim().toLowerCase()
  const today = jakartaToday()
  if (['hari ini', 'hariini', 'today', 'sekarang'].includes(s)) return today
  if (s === 'kemarin' || s === 'yesterday') return shiftDate(today, -1)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return validDate(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/)
  if (m) return validDate(m[3] ? +m[3] : +today.slice(0, 4), +m[2], +m[1])
  return null
}

function parseAmount(input) {
  const s = String(input ?? '').toLowerCase().replace(/rp\.?/g, '').replace(/\s/g, '')
  const m = s.match(/^([\d.,]+)(rb|ribu|k|jt|juta)?$/)
  if (!m) return null
  let value
  if (m[2]) {
    value = parseFloat(m[1].replace(',', '.')) * (m[2] === 'jt' || m[2] === 'juta' ? 1e6 : 1e3)
  } else if (/^\d+$/.test(m[1])) {
    value = Number(m[1])
  } else if (/^\d{1,3}([.,]\d{3})+$/.test(m[1])) {
    value = Number(m[1].replace(/[.,]/g, ''))
  } else {
    return null
  }
  value = Math.round(value)
  return Number.isFinite(value) && value > 0 && value <= MAX_AMOUNT ? value : null
}

async function tg(method, payload) {
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!data.ok) console.error('Telegram', method, data.description)
    return data
  } catch (err) {
    console.error('Telegram', method, err.message)
    return null
  }
}

const sendMessage = (chatId, text, extra = {}) =>
  tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra })

const editMessage = (chatId, messageId, text, replyMarkup = NO_KEYBOARD) =>
  tg('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', reply_markup: replyMarkup })

const answerCallback = (id, text) => tg('answerCallbackQuery', { callback_query_id: id, text })

const txLine = (t) =>
  `${t.type === 'income' ? '+' : '−'} ${formatRp(t.amount)} · ${catLabel(t.category)} · ${t.date}${t.note ? ` · ${esc(t.note)}` : ''}`

const txKeyboard = (id) => ({
  inline_keyboard: [[
    { text: '✏️ Edit', callback_data: `e:${id}` },
    { text: '🗑 Hapus', callback_data: `d:${id}` },
  ]],
})

async function getUserByChatId(chatId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, currency, monthly_income')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()
  if (error) console.error('getUser', error.message)
  return data
}

async function getTx(userId, id) {
  const { data, error } = await supabase
    .from('transactions')
    .select(TX_COLS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) console.error('getTx', error.message)
  return data
}

async function getLastTx(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select(TX_COLS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) console.error('getLastTx', error.message)
  return data
}

async function updateTx(userId, id, patch) {
  const { data, error } = await supabase
    .from('transactions')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select(TX_COLS)
  if (error) console.error('updateTx', error.message)
  return { tx: data?.[0] || null, error }
}

async function handleStart(chatId) {
  await sendMessage(chatId,
    `👋 Halo! Selamat datang di <b>FinTrack Bot</b>.\n\n` +
    `Untuk mulai, hubungkan akun FinTrack kamu dulu:\n/login\n\n` +
    `Setelah terhubung, kamu bisa:\n` +
    `• Ketik langsung: "jajan 50rb makan siang"\n` +
    `• /add 50000 jajan makan siang\n` +
    `• /saldo — ringkasan bulan ini\n` +
    `• /transaksi — 5 transaksi terakhir (ada tombol edit &amp; hapus)\n` +
    `• /edit — edit transaksi terakhir\n` +
    `• /hapus — hapus transaksi terakhir\n` +
    `• /goals — progress saving goals\n` +
    `• Atau ketik: "hapus yang tadi", "ubah jadi 75rb"\n` +
    `• Tanya apa saja ke AI Analyst!`)
}

async function handleLogin(chatId, username) {
  const existing = await getUserByChatId(chatId)
  if (existing) {
    await sendMessage(chatId, `✅ Akun kamu (${esc(existing.full_name || 'FinTrack')}) sudah terhubung!`)
    return
  }
  const token = randomBytes(12).toString('hex')
  const { error } = await supabase.from('telegram_link_tokens').insert({
    token, chat_id: chatId, telegram_username: username || null,
  })
  if (error) {
    console.error('link token', error.message)
    await sendMessage(chatId, `❌ Gagal membuat link. Coba lagi sebentar lagi.`)
    return
  }
  await sendMessage(chatId, `🔗 Klik link berikut untuk hubungkan akun FinTrack kamu (berlaku 10 menit):\n\n${APP_URL}/telegram-link?token=${token}`)
}

async function insertTransaction(chatId, userId, type, amount, category, note, date) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({ user_id: userId, type, amount, category, note, date: date || jakartaToday() })
    .select(TX_COLS)
    .single()
  if (error) {
    await sendMessage(chatId, `❌ Gagal simpan: ${esc(error.message)}`)
    return
  }
  await sendMessage(chatId, `${type === 'income' ? '💰' : '💸'} Tersimpan!\n${txLine(data)}`, { reply_markup: txKeyboard(data.id) })
}

async function handleAdd(chatId, userId, args) {
  if (args.length < 2) {
    await sendMessage(chatId, `Format: /add &lt;jumlah&gt; &lt;kategori&gt; [catatan]\nContoh: /add 50000 jajan makan siang`)
    return
  }
  const amount = parseAmount(args[0])
  const category = args[1].toLowerCase()
  const note = args.slice(2).join(' ').slice(0, 200) || null
  if (!amount) {
    await sendMessage(chatId, `Jumlah tidak valid. Contoh: /add 50000 jajan makan siang`)
    return
  }
  const type = typeOfCat(category)
  if (!type) {
    await sendMessage(chatId, `Kategori tidak dikenal.\nPengeluaran: ${EXPENSE_CATS.join(', ')}\nPemasukan: ${INCOME_CATS.join(', ')}`)
    return
  }
  await insertTransaction(chatId, userId, type, amount, category, note)
}

async function handleSaldo(chatId, userId) {
  const monthStart = `${jakartaToday().slice(0, 8)}01`
  const { data: tx } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId)
    .gte('date', monthStart)
  const sum = (type) => (tx || []).filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0)
  const income = sum('income')
  const expense = sum('expense')
  await sendMessage(chatId,
    `📊 <b>Ringkasan bulan ini</b>\n\nPemasukan: ${formatRp(income)}\nPengeluaran: ${formatRp(expense)}\nSisa saldo: ${formatRp(income - expense)}`)
}

async function handleTransaksi(chatId, userId) {
  const { data: tx } = await supabase
    .from('transactions')
    .select(TX_COLS)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5)
  if (!tx || tx.length === 0) {
    await sendMessage(chatId, `Belum ada transaksi.`)
    return
  }
  const lines = tx.map((t, i) => `${i + 1}. ${txLine(t)}`)
  const keyboard = tx.map((t, i) => [
    { text: `✏️ ${i + 1}`, callback_data: `e:${t.id}` },
    { text: `🗑 ${i + 1}`, callback_data: `d:${t.id}` },
  ])
  await sendMessage(chatId, `📋 <b>5 transaksi terakhir:</b>\n\n${lines.join('\n')}`, { reply_markup: { inline_keyboard: keyboard } })
}

async function askDeleteConfirm(chatId, tx) {
  await sendMessage(chatId, `Hapus transaksi ini?\n\n${txLine(tx)}`, {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Ya, hapus', callback_data: `dy:${tx.id}` },
        { text: 'Batal', callback_data: 'x' },
      ]],
    },
  })
}

async function handleHapusTerakhir(chatId, userId) {
  const last = await getLastTx(userId)
  if (!last) {
    await sendMessage(chatId, `Belum ada transaksi.`)
    return
  }
  await askDeleteConfirm(chatId, last)
}

async function showEditMenu(chatId, tx) {
  await sendMessage(chatId, `Mau edit apa?\n\n${txLine(tx)}`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💰 Jumlah', callback_data: `ef:${tx.id}:a` },
          { text: '🏷 Kategori', callback_data: `ec:${tx.id}` },
        ],
        [
          { text: '📝 Catatan', callback_data: `ef:${tx.id}:n` },
          { text: '📅 Tanggal', callback_data: `ef:${tx.id}:d` },
        ],
        [{ text: 'Batal', callback_data: 'x' }],
      ],
    },
  })
}

const EDIT_PROMPTS = {
  a: 'Balas pesan ini dengan jumlah baru (contoh: 50rb atau 50000).',
  n: 'Balas pesan ini dengan catatan baru (kirim - untuk menghapus catatan).',
  d: 'Balas pesan ini dengan tanggal baru (contoh: 2026-10-12, 12/10, atau kemarin).',
}
const EDIT_PLACEHOLDERS = { a: 'Jumlah baru, mis. 50rb', n: 'Catatan baru', d: 'Tanggal baru, mis. kemarin' }

async function promptEditField(chatId, tx, field) {
  await sendMessage(chatId, `${EDIT_PROMPTS[field]}\n\n${txLine(tx)}\n\nref:${tx.id}:${field}`, {
    reply_markup: { force_reply: true, input_field_placeholder: EDIT_PLACEHOLDERS[field] },
  })
}

async function handleEditReply(chatId, userId, message) {
  const ref = (message.reply_to_message?.text || '').match(/ref:([0-9a-f-]{36}):([and])\s*$/)
  if (!ref || !UUID_RE.test(ref[1])) return false
  const [, id, field] = ref
  const text = message.text.trim()
  if (text.startsWith('/')) return false
  const patch = {}
  if (field === 'a') {
    const amount = parseAmount(text)
    if (!amount) {
      await sendMessage(chatId, `Jumlah tidak valid. Balas lagi pesan sebelumnya, contoh: 50rb atau 50000.`)
      return true
    }
    patch.amount = amount
  } else if (field === 'n') {
    patch.note = text === '-' ? null : text.slice(0, 200)
  } else {
    const date = parseDate(text)
    if (!date) {
      await sendMessage(chatId, `Tanggal tidak valid. Balas lagi pesan sebelumnya, contoh: 2026-10-12, 12/10, atau kemarin.`)
      return true
    }
    patch.date = date
  }
  const { tx, error } = await updateTx(userId, id, patch)
  if (error) {
    await sendMessage(chatId, `❌ Gagal mengubah: ${esc(error.message)}`)
  } else if (!tx) {
    await sendMessage(chatId, `Transaksi tidak ditemukan (mungkin sudah dihapus).`)
  } else {
    await sendMessage(chatId, `✅ Diubah:\n${txLine(tx)}`, { reply_markup: txKeyboard(tx.id) })
  }
  return true
}

async function handleEditLast(chatId, userId, parsed) {
  const last = await getLastTx(userId)
  if (!last) {
    await sendMessage(chatId, `Belum ada transaksi.`)
    return
  }
  const patch = {}
  const amount = parsed.amount != null ? parseAmount(String(parsed.amount)) : null
  if (amount) patch.amount = amount
  const category = String(parsed.category || '').toLowerCase()
  if (catsFor(last.type).includes(category)) patch.category = category
  if (typeof parsed.note === 'string' && parsed.note.trim()) patch.note = parsed.note.trim().slice(0, 200)
  const date = parsed.date ? parseDate(parsed.date) : null
  if (date) patch.date = date
  if (Object.keys(patch).length === 0) {
    await showEditMenu(chatId, last)
    return
  }
  const { tx, error } = await updateTx(userId, last.id, patch)
  if (error || !tx) {
    await sendMessage(chatId, `❌ Gagal mengubah transaksi.`)
    return
  }
  await sendMessage(chatId, `✏️ Diubah\nSebelumnya: ${txLine(last)}\nSekarang: ${txLine(tx)}`, { reply_markup: txKeyboard(tx.id) })
}

async function handleCallback(cb) {
  const chatId = cb.message?.chat?.id
  const messageId = cb.message?.message_id
  if (!chatId || !messageId || !cb.data) return
  const user = await getUserByChatId(chatId)
  if (!user) return 'Akun belum terhubung'

  const [action, id, extra] = cb.data.split(':')
  if (action === 'x') {
    await editMessage(chatId, messageId, 'Dibatalkan.')
    return
  }
  if (!UUID_RE.test(id || '')) return 'Data tidak valid'

  if (action === 'dy') {
    const { data, error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select(TX_COLS)
    if (error) {
      console.error('delete', error.message)
      await editMessage(chatId, messageId, `❌ Gagal menghapus: ${esc(error.message)}`)
    } else if (!data || data.length === 0) {
      await editMessage(chatId, messageId, `Transaksi sudah tidak ada.`)
    } else {
      await editMessage(chatId, messageId, `🗑 Terhapus:\n${txLine(data[0])}`)
    }
    return
  }

  const tx = await getTx(user.id, id)
  if (!tx) return 'Transaksi tidak ditemukan'

  if (action === 'd') {
    await askDeleteConfirm(chatId, tx)
  } else if (action === 'e') {
    await showEditMenu(chatId, tx)
  } else if (action === 'ef') {
    if (!EDIT_PROMPTS[extra]) return 'Data tidak valid'
    await promptEditField(chatId, tx, extra)
  } else if (action === 'ec') {
    const cats = catsFor(tx.type)
    const rows = []
    for (let i = 0; i < cats.length; i += 2) {
      rows.push(cats.slice(i, i + 2).map((c) => ({ text: CAT_LABELS[c], callback_data: `sc:${tx.id}:${c}` })))
    }
    rows.push([{ text: 'Batal', callback_data: 'x' }])
    await editMessage(chatId, messageId, `Pilih kategori baru:\n\n${txLine(tx)}`, { inline_keyboard: rows })
  } else if (action === 'sc') {
    if (!catsFor(tx.type).includes(extra)) return 'Kategori tidak valid'
    const { tx: updated, error } = await updateTx(user.id, tx.id, { category: extra })
    if (error || !updated) {
      await editMessage(chatId, messageId, `❌ Gagal mengubah kategori.`)
    } else {
      await editMessage(chatId, messageId, `✅ Kategori diubah:\n${txLine(updated)}`, txKeyboard(updated.id))
    }
  } else {
    return 'Aksi tidak dikenal'
  }
}

async function handleGoals(chatId, userId) {
  const { data: goals } = await supabase
    .from('saving_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
  if (!goals || goals.length === 0) {
    await sendMessage(chatId, `Belum ada saving goals.`)
    return
  }
  const lines = goals.map((g) => {
    const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0
    return `${g.is_completed ? '✅' : '🎯'} ${esc(g.name)}: ${formatRp(g.current_amount)} / ${formatRp(g.target_amount)} (${pct}%)`
  })
  await sendMessage(chatId, `🎯 <b>Saving Goals:</b>\n\n${lines.join('\n')}`)
}

async function askClaude(system, content, maxTokens) {
  if (!ANTHROPIC_API_KEY) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
      }),
    })
    if (!res.ok) {
      console.error('Anthropic', res.status)
      return null
    }
    const data = await res.json()
    return data.content?.[0]?.text ?? null
  } catch (err) {
    console.error('Anthropic', err.message)
    return null
  }
}

async function parseNaturalLanguage(text) {
  const raw = await askClaude(
    `Kamu adalah parser pesan finansial. Kembalikan HANYA JSON valid, tanpa teks lain. Hari ini: ${jakartaToday()}.

Catat transaksi baru:
{"intent":"add_transaction","type":"expense"|"income","amount":<number>,"category":"<utama|jajan|tabungan|dana_darurat|gaji|freelance|bisnis|lainnya>","note":"<deskripsi atau null>","date":"<YYYY-MM-DD atau null>"}

Hapus transaksi terakhir ("hapus yang tadi", "batalin transaksi barusan"):
{"intent":"delete_last"}

Ubah transaksi terakhir ("ubah jadi 75rb", "salah, harusnya kategori utama"). Isi null untuk bagian yang tidak diubah:
{"intent":"edit_last","amount":<number atau null>,"category":"<kategori atau null>","note":"<teks atau null>","date":"<YYYY-MM-DD atau null>"}

Pertanyaan soal keuangan: {"intent":"ai_question"}
Tidak jelas: {"intent":"unknown"}

Konversi: "50rb"/"50ribu"=50000, "1jt"/"1juta"=1000000.`,
    text,
    300,
  )
  const match = raw && raw.match(/\{[\s\S]*\}/)
  if (!match) return { intent: 'unknown' }
  try {
    return JSON.parse(match[0])
  } catch {
    return { intent: 'unknown' }
  }
}

async function fetchHistoryRows(userId) {
  const [year, month] = jakartaToday().slice(0, 7).split('-').map(Number)
  const from = new Date(Date.UTC(year, month - HISTORY_MONTHS, 1)).toISOString().slice(0, 10)
  const rows = []
  for (let offset = 0; ; offset += HISTORY_PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, type, amount, category, date')
      .eq('user_id', userId)
      .gte('date', from)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + HISTORY_PAGE - 1)
    if (error) {
      console.error('fetchHistoryRows', error.message)
      return []
    }
    rows.push(...data)
    if (data.length < HISTORY_PAGE) break
  }
  return rows
}

function buildHistoryText(rows, monthlyIncome) {
  const currentMonth = jakartaToday().slice(0, 7)
  const label = (m) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
  const byMonth = new Map()
  for (const row of rows) {
    const month = row.date.slice(0, 7)
    if (month >= currentMonth) continue
    const stat = byMonth.get(month) || { income: 0, expense: 0, cats: {} }
    const amount = Number(row.amount)
    if (row.type === 'income') {
      stat.income += amount
    } else {
      stat.expense += amount
      stat.cats[row.category] = (stat.cats[row.category] || 0) + amount
    }
    byMonth.set(month, stat)
  }
  const months = [...byMonth.keys()].sort()
  if (months.length === 0) return ''
  const stats = months.map((m) => byMonth.get(m))
  const savingRate = (s) => {
    const base = s.income > 0 ? s.income : monthlyIncome
    return base > 0 ? Math.round(((s.income - s.expense) / base) * 100) : null
  }
  const catText = (cats) =>
    Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${CAT_LABELS[k] || k} ${formatRp(v)}`)
      .join(', ') || 'tidak ada pengeluaran'
  const lines = months.map((m, i) => {
    const s = stats[i]
    const rate = savingRate(s)
    return `- ${label(m)}: pemasukan ${formatRp(s.income)}, pengeluaran ${formatRp(s.expense)}, sisa ${formatRp(s.income - s.expense)}${rate === null ? '' : ` (saving rate ${rate}%)`} | ${catText(s.cats)}`
  })
  const n = months.length
  const avgIncome = stats.reduce((t, s) => t + s.income, 0) / n
  const avgExpense = stats.reduce((t, s) => t + s.expense, 0) / n
  const catTotals = {}
  stats.forEach((s) => Object.entries(s.cats).forEach(([k, v]) => { catTotals[k] = (catTotals[k] || 0) + v }))
  const avgCats = {}
  Object.entries(catTotals).forEach(([k, v]) => { avgCats[k] = v / n })
  const highest = stats.reduce((a, s, i) => (s.expense > stats[a].expense ? i : a), 0)
  const lowest = stats.reduce((a, s, i) => (s.expense < stats[a].expense ? i : a), 0)
  return [
    `(${n} bulan berdata sebelum bulan ini; bulan tanpa transaksi tidak dicantumkan)`,
    ...lines,
    `Rata-rata per bulan: pemasukan ${formatRp(avgIncome)}, pengeluaran ${formatRp(avgExpense)}, sisa ${formatRp(avgIncome - avgExpense)}`,
    `Rata-rata pengeluaran per kategori: ${catText(avgCats)}`,
    `Pengeluaran tertinggi: ${label(months[highest])} (${formatRp(stats[highest].expense)}); terendah: ${label(months[lowest])} (${formatRp(stats[lowest].expense)})`,
  ].join('\n')
}

async function handleAIQuestion(chatId, userId, userName, question) {
  await sendMessage(chatId, `🤔 Sedang menganalisis...`)
  const monthStart = `${jakartaToday().slice(0, 8)}01`
  const [txRes, goalsRes, profileRes, historyRows] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', userId).gte('date', monthStart),
    supabase.from('saving_goals').select('*').eq('user_id', userId),
    supabase.from('profiles').select('monthly_income').eq('id', userId).single(),
    fetchHistoryRows(userId),
  ])
  const tx = txRes.data || []
  const goals = goalsRes.data || []
  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const catSpend = {}
  tx.filter((t) => t.type === 'expense').forEach((t) => {
    catSpend[t.category] = (catSpend[t.category] || 0) + Number(t.amount)
  })
  const context = `Data keuangan ${userName} bulan ini:
- Income bulanan: ${formatRp(profileRes.data?.monthly_income || 0)}
- Pemasukan: ${formatRp(income)}, Pengeluaran: ${formatRp(expense)}, Saldo: ${formatRp(income - expense)}
- Per kategori: ${Object.entries(catSpend).map(([k, v]) => `${CAT_LABELS[k] || k}: ${formatRp(v)}`).join(', ') || 'belum ada'}
- Goals: ${goals.map((g) => `${g.name} ${formatRp(g.current_amount)}/${formatRp(g.target_amount)}`).join(', ') || 'belum ada'}
Riwayat bulan-bulan sebelumnya (maks. 12 bulan):
${buildHistoryText(historyRows, Number(profileRes.data?.monthly_income || 0)) || 'belum ada riwayat sebelum bulan ini'}`
  const answer = await askClaude(
    `Kamu AI financial analyst FinTrack. Jawab singkat (maks 4-5 kalimat, format chat Telegram, tanpa markdown heading), ramah, Bahasa Indonesia.\n${context}`,
    question,
    500,
  )
  await sendMessage(chatId, esc((answer || 'Maaf, terjadi kesalahan.').slice(0, 4000)))
}

async function handleNaturalLanguage(chatId, user, text) {
  const parsed = await parseNaturalLanguage(text)
  if (parsed.intent === 'add_transaction') {
    const category = String(parsed.category || '').toLowerCase()
    const type = typeOfCat(category)
    const amount = parseAmount(String(parsed.amount))
    if (type && amount) {
      const note = typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim().slice(0, 200) : null
      const date = parsed.date ? parseDate(parsed.date) : null
      await insertTransaction(chatId, user.id, type, amount, category, note, date)
      return
    }
  } else if (parsed.intent === 'delete_last') {
    await handleHapusTerakhir(chatId, user.id)
    return
  } else if (parsed.intent === 'edit_last') {
    await handleEditLast(chatId, user.id, parsed)
    return
  } else if (parsed.intent === 'ai_question') {
    await handleAIQuestion(chatId, user.id, user.full_name || 'kamu', text)
    return
  }
  await sendMessage(chatId, `Maaf, belum paham. Ketik /help untuk bantuan.`)
}

async function handleMessage(message) {
  if (!message?.text) return
  const chatId = message.chat.id
  const text = message.text.trim()
  const [rawCmd, ...rest] = text.split(/\s+/)
  const cmd = rawCmd.toLowerCase().replace(/@\w+$/, '')

  if (cmd === '/start' || cmd === '/help') {
    await handleStart(chatId)
    return
  }
  if (cmd === '/login') {
    await handleLogin(chatId, message.from?.username)
    return
  }

  const user = await getUserByChatId(chatId)
  if (!user) {
    await sendMessage(chatId, `Akun belum terhubung. Ketik /login untuk menghubungkan akun FinTrack.`)
    return
  }

  if (message.reply_to_message && (await handleEditReply(chatId, user.id, message))) return

  if (cmd === '/add') await handleAdd(chatId, user.id, rest)
  else if (cmd === '/saldo' || cmd === '/balance') await handleSaldo(chatId, user.id)
  else if (cmd === '/transaksi' || cmd === '/list') await handleTransaksi(chatId, user.id)
  else if (cmd === '/hapus' || cmd === '/delete') await handleHapusTerakhir(chatId, user.id)
  else if (cmd === '/edit') {
    const last = await getLastTx(user.id)
    if (last) await showEditMenu(chatId, last)
    else await sendMessage(chatId, `Belum ada transaksi.`)
  } else if (cmd === '/goals') await handleGoals(chatId, user.id)
  else if (text.startsWith('/')) await sendMessage(chatId, `Command tidak dikenal. Ketik /help untuk bantuan.`)
  else await handleNaturalLanguage(chatId, user, text)
}

function hasValidSecret(req) {
  const got = req.headers['x-telegram-bot-api-secret-token']
  if (typeof got !== 'string') return false
  const a = Buffer.from(got)
  const b = Buffer.from(TELEGRAM_WEBHOOK_SECRET)
  return a.length === b.length && timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true })
    return
  }
  if (!TELEGRAM_WEBHOOK_SECRET) {
    console.error('TELEGRAM_WEBHOOK_SECRET is not set')
    res.status(500).json({ ok: false })
    return
  }
  if (!hasValidSecret(req)) {
    res.status(401).json({ ok: false })
    return
  }
  try {
    const update = req.body || {}
    if (update.callback_query) {
      let toast
      try {
        toast = await handleCallback(update.callback_query)
      } finally {
        await answerCallback(update.callback_query.id, toast)
      }
    } else if (update.message) {
      await handleMessage(update.message)
    }
  } catch (err) {
    console.error('Webhook error:', err)
  }
  res.status(200).json({ ok: true })
}