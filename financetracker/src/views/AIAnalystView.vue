<script setup lang="ts">
import { categoryLabel } from '@/lib/categories'
import { ref, onMounted, nextTick, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'
import { fetchHistoryRows, buildHistoryText, type HistoryRow } from '@/lib/financeHistory'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
dayjs.locale('id')

const { user, monthlyIncome, displayName } = useAuth()

// ─── State ────────────────────────────────────────────────────
const messages    = ref<{ role: 'user' | 'assistant'; content: string }[]>([])
const input       = ref('')
const loading     = ref(false)
const dataLoading = ref(true)
const chatBox     = ref<HTMLElement | null>(null)

// Data keuangan untuk context AI
const transactions = ref<any[]>([])
const budget       = ref<any>(null)
const goals        = ref<any[]>([])
const prevTx       = ref<any[]>([])
const history      = ref<HistoryRow[]>([])

const currentMonth = dayjs().format('YYYY-MM')
const prevMonth    = dayjs().subtract(1, 'month').format('YYYY-MM')

// ─── Quick prompts ────────────────────────────────────────────
const quickPrompts = [
  { label: 'Analisis bulan ini', prompt: 'Analisis keuangan saya bulan ini secara menyeluruh. Apa yang sudah baik dan apa yang perlu diperbaiki?' },
  { label: 'Kategori terboros',  prompt: 'Kategori mana yang paling boros bulan ini? Berikan saran konkret untuk menguranginya.' },
  { label: 'Tips hemat',         prompt: 'Berdasarkan pola pengeluaran saya, berikan 5 tips hemat yang paling relevan.' },
  { label: 'Progress goals',     prompt: 'Bagaimana progress saving goals saya? Apakah saya on track untuk mencapainya?' },
  { label: 'Bandingkan bulan',   prompt: `Bandingkan keuangan saya bulan ${dayjs().format('MMMM')} vs bulan ${dayjs().subtract(1,'month').format('MMMM')}. Ada perbaikan atau justru memburuk?` },
  { label: 'Tren bulanan',      prompt: 'Bagaimana tren pemasukan, pengeluaran, dan saving rate saya dari bulan ke bulan? Kategori mana yang paling berubah dan apa artinya?' },
  { label: 'Saran alokasi',      prompt: 'Apakah alokasi budget 50/30/20 saya sudah optimal? Berikan rekomendasi penyesuaian.' },
]

// ─── Load data ────────────────────────────────────────────────
onMounted(async () => {
  if (!user.value) return

  const uid = user.value.id
  const [txRes, prevTxRes, budgetRes, goalsRes, historyRows] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', uid)
      .gte('date', dayjs().startOf('month').format('YYYY-MM-DD'))
      .order('date', { ascending: false }),
    supabase.from('transactions').select('*').eq('user_id', uid)
      .gte('date', dayjs().subtract(1,'month').startOf('month').format('YYYY-MM-DD'))
      .lt('date', dayjs().startOf('month').format('YYYY-MM-DD')),
    supabase.from('budget_allocations').select('*').eq('user_id', uid).eq('month', currentMonth).single(),
    supabase.from('saving_goals').select('*').eq('user_id', uid).order('created_at'),
    fetchHistoryRows(supabase, uid),
  ])

  transactions.value = txRes.data    ?? []
  prevTx.value       = prevTxRes.data ?? []
  budget.value       = budgetRes.data
  goals.value        = goalsRes.data  ?? []
  history.value      = historyRows
  dataLoading.value  = false

  // Pesan pembuka
  messages.value.push({
    role: 'assistant',
    content: `Halo ${displayName.value.split(' ')[0]}! 👋 Saya AI Analyst FinTrack kamu.\n\nSaya sudah membaca data keuangan kamu bulan ini beserta riwayat beberapa bulan terakhir. Gunakan tombol di bawah untuk analisis cepat, atau tanya langsung apapun tentang keuanganmu.`
  })
})

// ─── Build context untuk AI ───────────────────────────────────
function buildContext() {
  const sumIncome  = (arr: any[]) => arr.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const sumExpense = (arr: any[]) => arr.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const catSpend: Record<string, number> = {}
  transactions.value.filter(t => t.type === 'expense').forEach(t => {
    catSpend[t.category] = (catSpend[t.category] ?? 0) + t.amount
  })

  const prevCatSpend: Record<string, number> = {}
  prevTx.value.filter(t => t.type === 'expense').forEach(t => {
    prevCatSpend[t.category] = (prevCatSpend[t.category] ?? 0) + t.amount
  })

  const curIncome  = sumIncome(transactions.value)
  const curExpense = sumExpense(transactions.value)
  const prevIncome = sumIncome(prevTx.value)
  const prevExpense= sumExpense(prevTx.value)

  const fmtCat = (obj: Record<string, number>) =>
    Object.entries(obj).map(([k, v]) => `${categoryLabel(k)}: Rp ${v.toLocaleString('id-ID')}`).join(', ')

  return `
DATA KEUANGAN USER: ${displayName.value}
Tanggal hari ini: ${dayjs().format('DD MMMM YYYY')}

=== BULAN INI (${dayjs().format('MMMM YYYY')}) ===
- Income bulanan (dari profil): Rp ${monthlyIncome.value.toLocaleString('id-ID')}
- Total pemasukan: Rp ${curIncome.toLocaleString('id-ID')}
- Total pengeluaran: Rp ${curExpense.toLocaleString('id-ID')}
- Sisa saldo: Rp ${(curIncome - curExpense).toLocaleString('id-ID')}
- Saving rate: ${monthlyIncome.value > 0 ? Math.round(((curIncome - curExpense) / monthlyIncome.value) * 100) : 0}%
- Pengeluaran per kategori: ${fmtCat(catSpend) || 'belum ada'}
- Jumlah transaksi: ${transactions.value.length}

=== BULAN LALU (${dayjs().subtract(1,'month').format('MMMM YYYY')}) ===
- Total pemasukan: Rp ${prevIncome.toLocaleString('id-ID')}
- Total pengeluaran: Rp ${prevExpense.toLocaleString('id-ID')}
- Sisa saldo: Rp ${(prevIncome - prevExpense).toLocaleString('id-ID')}
- Pengeluaran per kategori: ${fmtCat(prevCatSpend) || 'belum ada'}

=== RIWAYAT BULAN-BULAN SEBELUMNYA (maks. 12 bulan terakhir) ===
${buildHistoryText(history.value, monthlyIncome.value) || 'Belum ada riwayat sebelum bulan ini'}

=== BUDGET ALOKASI ===
${budget.value
  ? `Utama: ${budget.value.utama_pct}% (Rp ${budget.value.utama_amount?.toLocaleString('id-ID')}), Jajan: ${budget.value.jajan_pct}% (Rp ${budget.value.jajan_amount?.toLocaleString('id-ID')}), Tabungan: ${budget.value.tabungan_pct}% (Rp ${budget.value.tabungan_amount?.toLocaleString('id-ID')}), Dana Darurat: ${budget.value.dana_darurat_pct}% (Rp ${budget.value.dana_darurat_amount?.toLocaleString('id-ID')})`
  : 'Belum diset'}

=== SAVING GOALS ===
${goals.value.length > 0
  ? goals.value.map(g => `- ${g.name}: Rp ${g.current_amount.toLocaleString('id-ID')} / Rp ${g.target_amount.toLocaleString('id-ID')} (${Math.round((g.current_amount/g.target_amount)*100)}%)${g.deadline ? `, deadline ${dayjs(g.deadline).format('MMM YYYY')}` : ''}${g.is_completed ? ' ✓ SELESAI' : ''}`).join('\n')
  : 'Belum ada saving goals'}
`.trim()
}

// ─── Send message ─────────────────────────────────────────────
async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return

  input.value = ''
  messages.value.push({ role: 'user', content: text })
  loading.value = true
  await nextTick(); scrollBottom()

  try {
    const { data, error: fnError } = await supabase.functions.invoke('ai-chat', {
      body: {
        system: `Kamu adalah AI financial analyst untuk aplikasi FinTrack. Tugasmu membantu user memahami dan memperbaiki kondisi keuangan mereka.

Panduan menjawab:
- Gunakan Bahasa Indonesia yang ramah dan mudah dipahami
- Berikan jawaban yang konkret dan actionable, bukan hanya teori
- Gunakan angka spesifik dari data user saat relevan
- Format angka dalam Rupiah: Rp X.XXX.XXX
- Gunakan bullet points atau numbering untuk tips/rekomendasi
- Maksimal 3-4 paragraf atau 5-6 poin, jangan terlalu panjang
- Akhiri dengan satu kalimat motivasi singkat jika sesuai konteks
- Untuk pertanyaan tren, gunakan data riwayat; jika riwayat hanya beberapa bulan, sebutkan bahwa kesimpulannya masih terbatas

Berikut data keuangan user terkini:
${buildContext()}`,
        messages: messages.value
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-10) // Ambil 10 pesan terakhir saja untuk hemat token
          .map(m => ({ role: m.role, content: m.content })),
      },
    })

    if (fnError) {
      const status = (fnError as { context?: Response }).context?.status
      throw new Error(status ? `HTTP ${status}` : fnError.message)
    }

    const reply = data.content?.[0]?.text ?? 'Maaf, tidak ada respons dari AI.'
    messages.value.push({ role: 'assistant', content: reply })

  } catch (err: any) {
    let errMsg = 'Maaf, terjadi kesalahan. '
    if (err.message?.includes('429')) errMsg += 'Terlalu banyak request. Tunggu sebentar lalu coba lagi.'
    else errMsg += err.message ?? 'Coba lagi.'
    messages.value.push({ role: 'assistant', content: errMsg })
  }

  loading.value = false
  await nextTick(); scrollBottom()
}

function quickAsk(prompt: string) {
  input.value = prompt
  send()
}

function scrollBottom() {
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
}

// Format message: bold **text** dan newline
function formatMessage(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

const hasData = computed(() => transactions.value.length > 0 || goals.value.length > 0)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">AI Analyst</h1>
        <p class="page-sub">Tanya apapun tentang keuanganmu</p>
      </div>
      <div class="header-badge">
        <span class="badge-dot"></span>
        claude-sonnet
      </div>
    </div>

    <!-- Data context info -->
    <div v-if="!dataLoading" class="context-bar">
      <div class="context-item">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        {{ transactions.length }} transaksi bulan ini
      </div>
      <div class="context-item">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        {{ goals.filter((g: any) => !g.is_completed).length }} goals aktif
      </div>
      <div class="context-item">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        Data {{ dayjs().format('MMMM YYYY') }}
      </div>
      <div v-if="!hasData" class="context-warn">
        Belum ada data transaksi — tambah dulu untuk analisis lebih akurat
      </div>
    </div>

    <div class="chat-layout">
      <!-- Quick prompts sidebar -->
      <div class="quick-sidebar">
        <p class="quick-title">Tanya cepat</p>
        <div class="quick-list">
          <button
            v-for="q in quickPrompts"
            :key="q.label"
            class="quick-btn"
            @click="quickAsk(q.prompt)"
            :disabled="loading || dataLoading"
          >
            {{ q.label }}
          </button>
        </div>

        <div class="sidebar-divider"></div>
        <p class="quick-title">Contoh pertanyaan</p>
        <div class="example-list">
          <p class="example-item" @click="input = 'Kalau aku mau nabung Rp 15 juta dalam 8 bulan, berapa yang harus kutabung tiap bulan?'">
            💰 Kalau mau nabung Rp 15 juta dalam 8 bulan?
          </p>
          <p class="example-item" @click="input = 'Pengeluaran jajan saya kemarin berapa?'">
            🧾 Pengeluaran jajan bulan ini berapa?
          </p>
          <p class="example-item" @click="input = 'Rata-rata tabungan saya per bulan berapa, dan bulan apa saya paling boros?'">
            📈 Rata-rata tabungan dan bulan terboros?
          </p>
          <p class="example-item" @click="input = 'Kapan kira-kira saya bisa mencapai goal laptop?'">
            🎯 Kapan bisa capai goal laptop?
          </p>
        </div>
      </div>

      <!-- Chat area -->
      <div class="chat-container">
        <!-- Loading data -->
        <div v-if="dataLoading" class="chat-loading">
          <div class="spinner"></div>
          <p>Membaca data keuangan...</p>
        </div>

        <template v-else>
          <!-- Messages -->
          <div class="chat-messages" ref="chatBox">
            <div
              v-for="(msg, i) in messages"
              :key="i"
              class="msg-wrap"
              :class="msg.role"
            >
              <div v-if="msg.role === 'assistant'" class="ai-avatar">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              </div>
              <div class="msg-bubble" :class="msg.role">
                <div class="msg-text" v-html="formatMessage(msg.content)"></div>
              </div>
            </div>

            <!-- Typing indicator -->
            <div v-if="loading" class="msg-wrap assistant">
              <div class="ai-avatar">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              </div>
              <div class="msg-bubble assistant">
                <div class="typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Input -->
          <div class="chat-input-row">
            <input
              v-model="input"
              type="text"
              placeholder="Tanya tentang keuanganmu..."
              @keydown.enter.prevent="send"
              :disabled="loading"
              class="chat-input"
            />
            <button
              class="send-btn"
              @click="send"
              :disabled="loading || !input.trim()"
              aria-label="Kirim"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped src="../styles/views/a-i-analyst-view.css"></style>
