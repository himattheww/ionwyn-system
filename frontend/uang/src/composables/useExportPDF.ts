import { ref } from 'vue'
import jsPDF from 'jspdf'
import { categoryLabel } from '@/lib/categories'
import { formatRpAbs } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
dayjs.locale('id')

export function useExportPDF() {
  const exporting = ref(false)

  async function exportMonthlyReport(userId: string, month: string, userName: string) {
    exporting.value = true

    try {
      // ── Fetch semua data ──────────────────────────────────────────
      const startDate = dayjs(month).startOf('month').format('YYYY-MM-DD')
      const endDate   = dayjs(month).endOf('month').format('YYYY-MM-DD')

      const [txRes, budgetRes, goalsRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', userId)
          .gte('date', startDate).lte('date', endDate)
          .order('date', { ascending: true }),
        supabase.from('budget_allocations').select('*').eq('user_id', userId)
          .eq('month', month).single(),
        supabase.from('saving_goals').select('*').eq('user_id', userId)
          .order('created_at', { ascending: true }),
      ])

      const transactions = txRes.data ?? []
      const budget       = budgetRes.data
      const goals        = goalsRes.data ?? []

      // ── Kalkulasi ─────────────────────────────────────────────────
      const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      const balance      = totalIncome - totalExpense

      const catSpend: Record<string, number> = {}
      transactions.filter(t => t.type === 'expense').forEach(t => {
        catSpend[t.category] = (catSpend[t.category] ?? 0) + t.amount
      })

      // ── Setup PDF ─────────────────────────────────────────────────
      const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W      = 210  // A4 width
      const margin = 18
      const col2   = W / 2 + 4
      let   y      = 0

      // Warna tema
      const GREEN      = [15,  110, 86]   as [number,number,number]
      const GREEN_LIGHT= [225, 245, 238]  as [number,number,number]
      const DARK       = [20,  20,  20]   as [number,number,number]
      const GRAY       = [100, 100, 100]  as [number,number,number]
      const LIGHT_GRAY = [245, 245, 243]  as [number,number,number]
      const RED        = [226, 75,  74]   as [number,number,number]
      const WHITE      = [255, 255, 255]  as [number,number,number]

      // Helper: set font color
      const setColor = (rgb: [number,number,number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2])
      const setFill  = (rgb: [number,number,number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2])
      const setDraw  = (rgb: [number,number,number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2])

      // ── HEADER ────────────────────────────────────────────────────
      setFill(GREEN)
      doc.rect(0, 0, W, 38, 'F')

      // Brand
      setFill(WHITE)
      doc.roundedRect(margin, 9, 9, 9, 1.5, 1.5, 'F')
      setColor(GREEN)
      doc.setFontSize(7); doc.setFont('helvetica', 'bold')
      doc.text('FT', margin + 4.5, 15, { align: 'center' })

      setColor(WHITE)
      doc.setFontSize(14); doc.setFont('helvetica', 'bold')
      doc.text('FinTrack', margin + 12, 15)

      // Title
      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      doc.text('Laporan Keuangan Bulanan', margin + 12, 21)

      // Month + username (right)
      doc.setFontSize(10); doc.setFont('helvetica', 'bold')
      const monthStr = dayjs(month).format('MMMM YYYY')
      doc.text(monthStr, W - margin, 14, { align: 'right' })
      doc.setFontSize(8); doc.setFont('helvetica', 'normal')
      doc.text(userName, W - margin, 20, { align: 'right' })
      doc.text(`Digenerate: ${dayjs().format('DD MMM YYYY')}`, W - margin, 26, { align: 'right' })

      y = 46

      // ── SUMMARY CARDS ─────────────────────────────────────────────
      const cardW = (W - margin * 2 - 12) / 4
      const cards = [
        { label: 'Pemasukan',  value: formatRpAbs(totalIncome),  color: GREEN },
        { label: 'Pengeluaran',value: formatRpAbs(totalExpense), color: RED },
        { label: 'Sisa Saldo', value: formatRpAbs(balance),      color: balance >= 0 ? GREEN : RED },
        { label: 'Transaksi',  value: `${transactions.length}x`, color: [55, 138, 221] as [number,number,number] },
      ]
      cards.forEach((card, i) => {
        const x = margin + i * (cardW + 4)
        setFill(LIGHT_GRAY); setDraw(LIGHT_GRAY)
        doc.roundedRect(x, y, cardW, 20, 2, 2, 'FD')
        setColor(GRAY)
        doc.setFontSize(7); doc.setFont('helvetica', 'normal')
        doc.text(card.label, x + cardW / 2, y + 6, { align: 'center' })
        setColor(card.color)
        doc.setFontSize(9); doc.setFont('helvetica', 'bold')
        doc.text(card.value, x + cardW / 2, y + 14, { align: 'center' })
      })
      y += 26

      // ── BUDGET vs AKTUAL ──────────────────────────────────────────
      if (budget) {
        setColor(DARK)
        doc.setFontSize(10); doc.setFont('helvetica', 'bold')
        doc.text('Alokasi vs Pengeluaran Aktual', margin, y)
        y += 6

        const cats = [
          { key: 'utama',       label: 'Utama',        color: [55, 138, 221] as [number,number,number] },
          { key: 'jajan',       label: 'Jajan',        color: [239, 159, 39] as [number,number,number] },
          { key: 'tabungan',    label: 'Tabungan',     color: GREEN },
          { key: 'dana_darurat',label: 'Dana Darurat', color: [216, 90, 48]  as [number,number,number] },
        ]

        cats.forEach(cat => {
          const budgeted = (budget as Record<string, any>)[`${cat.key}_amount`] ?? 0
          const spent    = catSpend[cat.key] ?? 0
          const pct      = budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0
          const barW     = 60

          // Label
          setColor(DARK)
          doc.setFontSize(8); doc.setFont('helvetica', 'bold')
          doc.text(cat.label, margin, y + 4)

          // Bar background
          setFill(LIGHT_GRAY); setDraw(LIGHT_GRAY)
          doc.roundedRect(margin + 28, y, barW, 5, 1, 1, 'FD')
          // Bar fill
          if (pct > 0) {
            setFill(spent > budgeted ? RED : cat.color)
            doc.roundedRect(margin + 28, y, barW * (pct / 100), 5, 1, 1, 'F')
          }

          // Amounts
          setColor(GRAY)
          doc.setFontSize(7); doc.setFont('helvetica', 'normal')
          doc.text(`${formatRpAbs(spent)} / ${formatRpAbs(budgeted)}`, margin + 92, y + 4)

          // Pct
          setColor(spent > budgeted ? RED : DARK)
          doc.setFontSize(7); doc.setFont('helvetica', 'bold')
          doc.text(`${Math.round(pct)}%`, W - margin, y + 4, { align: 'right' })

          y += 9
        })
        y += 4
      }

      // ── GOALS ─────────────────────────────────────────────────────
      if (goals.length > 0) {
        setColor(DARK)
        doc.setFontSize(10); doc.setFont('helvetica', 'bold')
        doc.text('Saving Goals', margin, y)
        y += 6

        goals.slice(0, 5).forEach(g => {
          const pct  = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0
          const barW = 50

          setColor(DARK)
          doc.setFontSize(8); doc.setFont('helvetica', 'bold')
          doc.text(g.name.length > 22 ? g.name.slice(0, 20) + '...' : g.name, margin, y + 4)

          setFill(LIGHT_GRAY); setDraw(LIGHT_GRAY)
          doc.roundedRect(margin + 46, y, barW, 5, 1, 1, 'FD')
          if (pct > 0) {
            setFill(g.is_completed ? GREEN : [55, 138, 221] as [number,number,number])
            doc.roundedRect(margin + 46, y, barW * (pct / 100), 5, 1, 1, 'F')
          }

          setColor(GRAY)
          doc.setFontSize(7); doc.setFont('helvetica', 'normal')
          doc.text(`${formatRpAbs(g.current_amount)} / ${formatRpAbs(g.target_amount)}`, margin + 100, y + 4)

          setColor(GREEN)
          doc.setFontSize(7); doc.setFont('helvetica', 'bold')
          doc.text(`${Math.round(pct)}%`, W - margin, y + 4, { align: 'right' })

          y += 9
        })
        y += 4
      }

      // ── DAFTAR TRANSAKSI ──────────────────────────────────────────
      // Cek apakah perlu halaman baru
      if (y > 200) { doc.addPage(); y = 18 }

      setColor(DARK)
      doc.setFontSize(10); doc.setFont('helvetica', 'bold')
      doc.text('Daftar Transaksi', margin, y)
      y += 5

      // Table header
      setFill(GREEN); setDraw(GREEN)
      doc.rect(margin, y, W - margin * 2, 7, 'F')
      setColor(WHITE)
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
      doc.text('Tanggal',   margin + 2,    y + 4.5)
      doc.text('Kategori',  margin + 24,   y + 4.5)
      doc.text('Catatan',   margin + 60,   y + 4.5)
      doc.text('Tipe',      margin + 118,  y + 4.5)
      doc.text('Jumlah',    W - margin - 2, y + 4.5, { align: 'right' })
      y += 7

      // Table rows
      transactions.forEach((tx, idx) => {
        if (y > 275) { doc.addPage(); y = 18 }

        const isEven = idx % 2 === 0
        if (isEven) {
          setFill(LIGHT_GRAY); setDraw(LIGHT_GRAY)
          doc.rect(margin, y, W - margin * 2, 6.5, 'F')
        }

        setColor(GRAY)
        doc.setFontSize(7); doc.setFont('helvetica', 'normal')
        doc.text(dayjs(tx.date).format('DD/MM/YY'), margin + 2, y + 4.2)
        doc.text(categoryLabel(tx.category), margin + 24, y + 4.2)

        const note = tx.note ? (tx.note.length > 30 ? tx.note.slice(0, 28) + '..' : tx.note) : '-'
        doc.text(note, margin + 60, y + 4.2)

        setColor(tx.type === 'income' ? GREEN : RED)
        doc.setFont('helvetica', 'bold')
        doc.text(tx.type === 'income' ? 'Masuk' : 'Keluar', margin + 118, y + 4.2)

        setColor(tx.type === 'income' ? GREEN : RED)
        doc.text(
          (tx.type === 'income' ? '+' : '−') + ' ' + formatRpAbs(tx.amount),
          W - margin - 2, y + 4.2, { align: 'right' }
        )

        y += 6.5
      })

      if (transactions.length === 0) {
        setColor(GRAY)
        doc.setFontSize(8); doc.setFont('helvetica', 'normal')
        doc.text('Tidak ada transaksi bulan ini.', margin + 2, y + 5)
        y += 10
      }

      // ── FOOTER ────────────────────────────────────────────────────
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        setColor(GRAY)
        doc.setFontSize(7); doc.setFont('helvetica', 'normal')
        doc.text(`FinTrack · Laporan ${monthStr} · ${userName}`, margin, 292)
        doc.text(`Hal ${i} dari ${pageCount}`, W - margin, 292, { align: 'right' })
        setDraw([220, 220, 220])
        doc.line(margin, 289, W - margin, 289)
      }

      // ── SAVE ──────────────────────────────────────────────────────
      const filename = `FinTrack_Laporan_${dayjs(month).format('YYYY-MM')}.pdf`
      doc.save(filename)

    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportMonthlyReport }
}