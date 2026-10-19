<script setup lang="ts">
import { formatRp } from '@/lib/format'
import { ref, computed, onMounted, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'
import { cachedQuery } from '@/lib/offlineCache'
import { onAppActive } from '@/lib/appActive'
import dayjs from 'dayjs'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'

const { user } = useAuth()
const transactions = ref<any[]>([])
const loading = ref(true)
const period = ref<'monthly' | 'weekly'>('monthly')
const selectedMonth = ref(dayjs().format('YYYY-MM'))
const compareMonth = ref(dayjs().subtract(1, 'month').format('YYYY-MM'))

onMounted(fetchAll)
onAppActive(fetchAll)
watch([selectedMonth, compareMonth], fetchAll)

async function fetchAll() {
  if (!user.value) return
  loading.value = true
  const startDate = dayjs(selectedMonth.value).subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
  const endDate   = dayjs(selectedMonth.value).endOf('month').format('YYYY-MM-DD')
  const { data } = await cachedQuery(`${user.value.id}:charts:${startDate}:${endDate}`,
    supabase.from('transactions').select('*')
      .eq('user_id', user.value.id).gte('date', startDate).lte('date', endDate))
  transactions.value = data ?? []
  loading.value = false
}

function txForMonth(month: string) {
  return transactions.value.filter(t => t.date.startsWith(month))
}

// Pie chart — kategori pengeluaran bulan ini
const pieOptions = computed<{ series: any; options: ApexOptions }>(() => {
  const tx = txForMonth(selectedMonth.value).filter(t => t.type === 'expense')
  const cats: Record<string, number> = {}
  tx.forEach(t => { cats[t.category] = (cats[t.category] ?? 0) + t.amount })
  const labels = Object.keys(cats).map(c => ({ utama:'Utama',jajan:'Jajan',tabungan:'Tabungan',dana_darurat:'Dana Darurat',lainnya:'Lainnya' }[c] ?? c))
  return {
    series: Object.values(cats),
    options: {
      chart: { type: 'donut', background: 'transparent' },
      labels,
      colors: ['#378ADD','#EF9F27','#1D9E75','#D85A30','#888780'],
      legend: { position: 'bottom', fontSize: '13px' },
      dataLabels: { enabled: false },
      plotOptions: { pie: { donut: { size: '65%' } } },
      theme: { mode: 'light' },
    }
  }
})

// Bar chart — compare bulan ini vs bulan lalu
const barOptions = computed<{ series: any; options: ApexOptions }>(() => {
  const cur  = txForMonth(selectedMonth.value)
  const prev = txForMonth(compareMonth.value)
  const sum = (arr: any[], type: string) => arr.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0)
  return {
    series: [
      { name: 'Pemasukan', data: [sum(prev, 'income'), sum(cur, 'income')] },
      { name: 'Pengeluaran', data: [sum(prev, 'expense'), sum(cur, 'expense')] },
    ],
    options: {
      chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
      colors: ['#b68235', '#E24B4A'],
      xaxis: { categories: [dayjs(compareMonth.value).format('MMM YYYY'), dayjs(selectedMonth.value).format('MMM YYYY')] },
      yaxis: { labels: { formatter: (v: number) => 'Rp ' + (v/1000).toFixed(0) + 'K' } },
      plotOptions: { bar: { columnWidth: '50%', borderRadius: 4 } },
      legend: { position: 'top' },
      dataLabels: { enabled: false },
      theme: { mode: 'light' },
    }
  }
})

// Daily line chart
const lineOptions = computed<{ series: any; options: ApexOptions }>(() => {
  const tx = txForMonth(selectedMonth.value)
  const daysInMonth = dayjs(selectedMonth.value).daysInMonth()
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'))
  const income  = days.map(d => tx.filter(t => t.type === 'income'  && t.date.endsWith(`-${d}`)).reduce((s, t) => s + t.amount, 0))
  const expense = days.map(d => tx.filter(t => t.type === 'expense' && t.date.endsWith(`-${d}`)).reduce((s, t) => s + t.amount, 0))
  return {
    series: [
      { name: 'Pemasukan', data: income },
      { name: 'Pengeluaran', data: expense },
    ],
    options: {
      chart: { type: 'line', background: 'transparent', toolbar: { show: false }, zoom: { enabled: false } },
      colors: ['#b68235', '#E24B4A'],
      xaxis: { categories: days, labels: { rotate: 0, style: { fontSize: '11px' } }, tickAmount: 10 },
      yaxis: { labels: { formatter: (v: number) => 'Rp ' + (v/1000).toFixed(0) + 'K' } },
      stroke: { curve: 'smooth', width: 2 },
      markers: { size: 0 },
      legend: { position: 'top' },
      dataLabels: { enabled: false },
      theme: { mode: 'light' },
    }
  }
})

</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Charts</h1>
        <p class="page-sub">Analisis visual keuanganmu</p>
      </div>
      <div class="controls">
        <input type="month" v-model="selectedMonth" class="month-pick" />
      </div>
    </div>

    <div v-if="loading" class="empty-state">Memuat data...</div>
    <template v-else>
      <!-- Line chart -->
      <div class="chart-card full">
        <h2 class="chart-title">Transaksi harian — {{ dayjs(selectedMonth).format('MMMM YYYY') }}</h2>
        <VueApexCharts type="line" height="240" :series="lineOptions.series" :options="lineOptions.options" />
      </div>

      <div class="two-col">
        <!-- Donut -->
        <div class="chart-card">
          <h2 class="chart-title">Pengeluaran per kategori</h2>
          <div v-if="pieOptions.series.length === 0" class="empty-state">Belum ada pengeluaran bulan ini.</div>
          <VueApexCharts v-else type="donut" height="260" :series="pieOptions.series" :options="pieOptions.options" />
        </div>

        <!-- Bar compare -->
        <div class="chart-card">
          <h2 class="chart-title">Perbandingan bulanan</h2>
          <div class="compare-picker">
            <span class="compare-label">Bandingkan dengan:</span>
            <input type="month" v-model="compareMonth" class="month-pick small" />
          </div>
          <VueApexCharts type="bar" height="220" :series="barOptions.series" :options="barOptions.options" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped src="../styles/views/charts-view.css"></style>
