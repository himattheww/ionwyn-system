import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] })
const date = z.iso.date().describe('Tanggal YYYY-MM-DD')
const month = z.string().regex(/^\d{4}-\d{2}$/).describe('Bulan YYYY-MM')
const readOnly = { readOnlyHint: true }

async function call(method: string, path: string, body?: unknown, contentType = 'application/json') {
  const base = process.env.HUB_APP_BASE?.replace(/\/$/, '')
  const secret = process.env.INTERNAL_SECRET
  if (!base || !secret) throw new Error('HUB_APP_BASE atau INTERNAL_SECRET belum diisi')
  const res = await fetch(base + path, {
    method,
    headers: { 'x-ionwyn-internal': secret, 'content-type': contentType },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok || data?.error) throw new Error(data?.error ?? data?.message ?? `HTTP ${res.status}`)
  return data
}

const get = (path: string) => call('GET', path)
const timesheet = (body: Record<string, unknown>) => call('POST', '/timesheet/api', body, 'text/plain;charset=utf-8')
const query = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}

export function registerSystemTools(server: McpServer) {
  server.registerTool(
    'today_summary',
    { title: 'Ringkasan hari ini', description: 'Ringkasan Beranda: jadwal hari ini, Catatan Malam, lari minggu ini, belajar, level, absensi, dan pengeluaran.', annotations: readOnly },
    async () => json(await get('/hub/api/today')),
  )

  server.registerTool(
    'run_integrations',
    { title: 'Jalankan integrasi', description: 'Menjalankan integrasi H4-H8 sekarang: item Jadwal diselesaikan dari Garmin, Catatan Malam, Learn, dan Timesheet.' },
    async () => json(await call('POST', '/hub/api/integrations/run')),
  )

  server.registerTool(
    'diary_tonight',
    { title: 'Catatan Malam hari ini', description: 'Status Catatan Malam malam ini: apakah sudah dibuka atau ditulis, catatan terbaru, dan catatan di tanggal yang sama tahun lalu.', annotations: readOnly },
    async () => json(await get('/catatan/api/today')),
  )

  server.registerTool(
    'diary_get',
    { title: 'Baca Catatan Malam', description: 'Isi Catatan Malam untuk satu tanggal.', inputSchema: { date }, annotations: readOnly },
    async ({ date }) => json(await get(`/catatan/api/entries/${date}`)),
  )

  server.registerTool(
    'diary_month',
    { title: 'Daftar Catatan Malam sebulan', description: 'Tanggal-tanggal yang punya Catatan Malam di satu bulan.', inputSchema: { month }, annotations: readOnly },
    async ({ month }) => json(await get(`/catatan/api/entries${query({ month })}`)),
  )

  server.registerTool(
    'diary_search',
    { title: 'Cari Catatan Malam', description: 'Mencari kata di semua Catatan Malam.', inputSchema: { keyword: z.string().trim().min(1).max(100) }, annotations: readOnly },
    async ({ keyword }) => json(await get(`/catatan/api/search${query({ q: keyword })}`)),
  )

  server.registerTool(
    'diary_collection',
    {
      title: 'Kumpulan pelajaran atau hal baik',
      description: 'Semua "Pelajaran" atau "Hal baik" dari Catatan Malam dalam rentang tanggal.',
      inputSchema: { kind: z.enum(['lessons', 'good-things']), from: date.optional(), to: date.optional() },
      annotations: readOnly,
    },
    async ({ kind, from, to }) => json(await get(`/catatan/api/${kind}${query({ from, to })}`)),
  )

  server.registerTool(
    'diary_save',
    {
      title: 'Tulis Catatan Malam',
      description: 'Menulis atau mengubah Catatan Malam untuk satu tanggal. Aturan jam buka tetap berlaku. Tulis dengan kata-kata pengguna sendiri, jangan mengarang isinya.',
      inputSchema: {
        date,
        happened: z.string().trim().min(1).max(4000).describe('Apa yang terjadi hari ini'),
        goodThings: z.string().trim().min(1).max(4000).describe('Hal baik'),
        lessons: z.string().trim().min(1).max(4000).describe('Pelajaran'),
        freeText: z.string().trim().max(10_000).optional().describe('Catatan bebas'),
      },
    },
    async ({ date, ...entry }) => json(await call('PUT', `/catatan/api/entries/${date}`, { ...entry, freeText: entry.freeText ?? null })),
  )

  server.registerTool(
    'fitness_summary',
    { title: 'Ringkasan Fitness', description: 'Ringkasan minggu: hari lari sesuai pola, km, sesi beban, tidur, RHR, berat, makan, dan status sinkron Garmin.', inputSchema: { date: date.optional() }, annotations: readOnly },
    async ({ date }) => json(await get(`/fit/api/summary${query({ date })}`)),
  )

  server.registerTool(
    'fitness_activities',
    {
      title: 'Aktivitas Fitness',
      description: 'Aktivitas Garmin terbaru, bisa difilter per tipe (misalnya running, strength_training).',
      inputSchema: { type: z.string().max(60).optional(), limit: z.number().int().min(1).max(100).default(20) },
      annotations: readOnly,
    },
    async ({ type, limit }) => {
      const data = await get(`/fit/api/activities${query({ type })}`)
      return json({ types: data.types, activities: data.activities.slice(0, limit) })
    },
  )

  server.registerTool(
    'fitness_activity_detail',
    {
      title: 'Lap satu lari',
      description:
        'Tabel lap satu aktivitas Garmin, sama seperti ekspor CSV Garmin Connect: interval dan jenis langkah workout, waktu, jarak, pace, GAP, HR, ascent, cadence, GCT, stride, vertical oscillation, power, kalori, best pace, moving time, plus baris Summary. Kecepatan dalam m/s (pace = 1000 / speed detik per km). Juga context: cuaca dalam Celsius (temp_c, feels_like_c, dew_point_c, humidity_pct, wind_kph), AQI saat sesi (aqi dengan aqi_source station/model, aqi_station + pm25_station + station_name dari stasiun WAQI terdekat, aqi_model + pm25_model rata-rata selama lari dari Open-Meteo; hanya untuk lari sejak 26 Okt 2026), zona HR dengan batas bpm Garmin (hr_zones), RPE 1–10 dan feel 0–100 dari jam, training load, TE anaerob, label TE, sepatu. Plus fueling manual. id = garmin_id dari fitness_activities. Lap diambil dari Garmin saat diminta; kalau laps null, lihat lapsError. Kalau context null, jalankan garmin_sync.',
      inputSchema: { id: z.number().int().positive() },
      annotations: readOnly,
    },
    async ({ id }) => {
      const data = await get(`/fit/api/activities/${id}`)
      return json(data)
    },
  )

  server.registerTool(
    'fitness_fueling',
    {
      title: 'Catat fueling lari',
      description: 'Mencatat fueling satu aktivitas: jumlah gel, di km berapa saja, minum (ml), elektrolit, catatan. Menimpa catatan fueling sebelumnya untuk aktivitas itu. id = garmin_id.',
      inputSchema: {
        id: z.number().int().positive(),
        gels: z.number().int().min(0).max(30),
        gelKm: z.string().trim().max(200).optional().describe('Contoh: "8, 15"'),
        drinkMl: z.number().int().min(0).max(10000).optional(),
        electrolytes: z.string().trim().max(200).optional(),
        note: z.string().trim().max(1000).optional(),
      },
    },
    async ({ id, gels, gelKm, drinkMl, electrolytes, note }) => {
      await call('PUT', `/fit/api/activities/${id}/fueling`, { gels, gel_km: gelKm ?? null, drink_ml: drinkMl ?? null, electrolytes: electrolytes ?? null, note: note ?? null })
      return json({ id, saved: true })
    },
  )

  server.registerTool(
    'fitness_activity_series',
    {
      title: 'Deret per detik satu lari',
      description:
        'Mengambil deret per detik satu aktivitas langsung dari Garmin (tidak disimpan): t (detik), km, hr, speed dan gap_speed (m/s), cadence, elev, power, diringkas maksimal 300 titik. Plus drift: HR dan pace paruh pertama vs kedua setelah 10 menit pemanasan, dan decoupling_pct (Pa:HR). Pakai hanya kalau perlu, misalnya long run.',
      inputSchema: { id: z.number().int().positive() },
      annotations: readOnly,
    },
    async ({ id }) => json(await get(`/fit/api/activities/${id}/series`)),
  )

  server.registerTool(
    'fitness_calories',
    {
      title: 'Kalori harian',
      description:
        'Kalori per hari: burned (total terbakar dari Garmin = bmr + active; hari ini masih berjalan, partial=true), intake (kalori masuk yang dicatat manual), deficit (burned - intake), target makan harian yang tersimpan, dan left_to_target. Pakai untuk menghitung atau mengevaluasi target diet.',
      inputSchema: { days: z.number().int().min(1).max(90).default(14) },
      annotations: readOnly,
    },
    async ({ days }) => json(await get(`/fit/api/calories${query({ days })}`)),
  )

  server.registerTool(
    'fitness_set_calorie_target',
    {
      title: 'Simpan target makan harian',
      description:
        'Menyimpan target kalori masuk per hari (kkal) beserta alasannya, misalnya hasil hitungan dari rata-rata kalori terbakar dikurangi defisit yang disepakati. Tampil di Fitness sebagai "Target makan". Menimpa target sebelumnya.',
      inputSchema: { kcal: z.number().int().min(800).max(6000), note: z.string().trim().max(1000).describe('Dasar hitungan, misalnya "TDEE 14 hari 2.450 - defisit 500"') },
    },
    async ({ kcal, note }) => {
      await call('PUT', '/fit/api/calorie-target', { kcal, note })
      return json({ kcal, note, saved: true })
    },
  )

  server.registerTool(
    'fitness_air',
    {
      title: 'Udara per jam',
      description:
        'AQI per jam di lokasi GPS lari terakhir: pm25 dan aqi (tabel EPA 2024) dari model Open-Meteo untuk kemarin sampai besok, plus pembacaan stasiun WAQI terdekat saat ini kalau ada. Pakai untuk memilih jam lari.',
      annotations: readOnly,
    },
    async () => json(await get('/fit/api/air')),
  )

  server.registerTool(
    'fitness_recovery',
    {
      title: 'Recovery',
      description:
        'Data harian dari Garmin: tidur (durasi, skor, deep/light/REM/awake dalam menit, respirasi, stres saat tidur), RHR, HRV (hrv_last_night, hrv_weekly, baseline balanced hrv_baseline_low–hrv_baseline_high, hrv_low_upper, hrv_status), training readiness (skor, level, acute_load). Plus catatan kondisi harian (alcohol, sick, injured, note).',       inputSchema: { days: z.number().int().min(7).max(365).default(30) },
      annotations: readOnly,
    },
    async ({ days }) => json(await get(`/fit/api/recovery${query({ days })}`)),
  )

  server.registerTool(
    'fitness_report',
    { title: 'Laporan Fitness bulanan', description: 'Laporan satu bulan dibanding bulan sebelumnya.', inputSchema: { month }, annotations: readOnly },
    async ({ month }) => json(await get(`/fit/api/report${query({ month })}`)),
  )

  server.registerTool(
    'fitness_log',
    {
      title: 'Catat data badan',
      description: 'Mencatat data manual untuk satu tanggal. Isi hanya yang diketahui; nilai lain di tanggal itu dipertahankan.',
      inputSchema: {
        date,
        weightKg: z.number().min(20).max(300).optional(),
        sleepMin: z.number().int().min(0).max(1440).optional().describe('Lama tidur dalam menit'),
        rhr: z.number().int().min(25).max(150).optional().describe('Resting heart rate'),
        proteinMet: z.boolean().optional().describe('Target protein tercapai'),
        ricePortions: z.number().min(0).max(20).optional(),
        alcohol: z.boolean().optional(),
        sick: z.boolean().optional(),
        injured: z.boolean().optional().describe('Sedang cedera'),
        intakeKcal: z.number().int().min(0).max(10000).optional().describe('Total kalori yang dimakan hari itu'),
        note: z.string().trim().max(1000).optional().describe('Catatan kondisi atau gejala'),
      },
    },
    async ({ date, weightKg, sleepMin, rhr, proteinMet, ricePortions, alcohol, sick, injured, note, intakeKcal }) => {
      const saved: string[] = []
      if (intakeKcal !== undefined) {
        await call('PUT', `/fit/api/intake/${date}`, { kcal: intakeKcal })
        saved.push('kalori masuk')
      }
      if (weightKg !== undefined) {
        await call('PUT', `/fit/api/weights/${date}`, { kg: weightKg })
        saved.push('berat')
      }
      const recent = sleepMin !== undefined || rhr !== undefined || alcohol !== undefined || sick !== undefined || injured !== undefined || note !== undefined
        ? await get('/fit/api/recovery?days=365')
        : null
      if (sleepMin !== undefined || rhr !== undefined) {
        const current = recent.recovery.find((r: { date: string }) => r.date === date)
        await call('PUT', `/fit/api/recovery/${date}`, { sleep_min: sleepMin ?? current?.sleep_min ?? null, rhr: rhr ?? current?.rhr ?? null })
        saved.push('tidur/RHR')
      }
      if (proteinMet !== undefined || ricePortions !== undefined) {
        const current = (await get('/fit/api/meals')).find((m: { date: string }) => m.date === date)
        await call('PUT', `/fit/api/meals/${date}`, { protein_met: proteinMet ?? Boolean(current?.protein_met), rice_portions: ricePortions ?? current?.rice_portions ?? 0 })
        saved.push('makan')
      }
      if (alcohol !== undefined || sick !== undefined || injured !== undefined || note !== undefined) {
        const current = recent.conditions.find((c: { date: string }) => c.date === date)
        await call('PUT', `/fit/api/condition/${date}`, {
          alcohol: alcohol ?? Boolean(current?.alcohol),
          sick: sick ?? Boolean(current?.sick),
          injured: injured ?? Boolean(current?.injured),
          note: note ?? current?.note ?? null,
        })
        saved.push('kondisi')
      }
      return json({ date, saved })
    },
  )

  server.registerTool(
    'garmin_sync',
    { title: 'Sinkron Garmin', description: 'Mengambil aktivitas, tidur, dan RHR terbaru dari Garmin. Butuh Garmin sudah dihubungkan dari aplikasi Android.' },
    async () => json(await call('POST', '/fit/api/sync')),
  )

  server.registerTool(
    'leveling_character',
    { title: 'Karakter Leveling', description: 'Level, tier, gelar, exp, lima atribut, dan quest saat ini.', annotations: readOnly },
    async () => json(await get('/leveling/api/character')),
  )

  server.registerTool(
    'leveling_log',
    {
      title: 'Log exp Leveling',
      description: 'Riwayat exp per kejadian, bisa difilter per atribut dan rentang tanggal.',
      inputSchema: { from: date.optional(), to: date.optional(), attribute: z.string().max(40).optional() },
      annotations: readOnly,
    },
    async ({ from, to, attribute }) => json(await get(`/leveling/api/log${query({ from, to, attribute })}`)),
  )

  server.registerTool(
    'leveling_achievements',
    { title: 'Pencapaian Leveling', description: 'Daftar pencapaian dan tanggal didapat.', annotations: readOnly },
    async () => json(await get('/leveling/api/achievements')),
  )

  server.registerTool(
    'wish_list',
    { title: 'Daftar cita-cita', description: 'Cita-cita di Leveling: yang sedang dikejar dan yang sudah tercapai, beserta ukuran dan atributnya.', annotations: readOnly },
    async () => json(await get('/leveling/api/wishes')),
  )

  server.registerTool(
    'wish_add',
    {
      title: 'Tulis cita-cita',
      description: 'Menambah cita-cita di Leveling. Ukuran menentukan exp saat tercapai: kecil 100, sedang 300, besar 1000. Exp masuk ke atribut yang dipilih.',
      inputSchema: {
        title: z.string().trim().min(1).max(200),
        why: z.string().trim().max(2000).optional(),
        size: z.enum(['kecil', 'sedang', 'besar']),
        attribute: z.enum(['stamina', 'intelek', 'kebijaksanaan', 'disiplin', 'kekayaan']),
        targetDate: date.optional(),
      },
    },
    async (input) => json(await call('POST', '/leveling/api/wishes', input)),
  )

  server.registerTool(
    'wish_achieve',
    {
      title: 'Tandai cita-cita tercapai',
      description: 'Menandai cita-cita tercapai pada tanggal tertentu (default hari ini) lalu menghitung ulang exp. Butuh id dari wish_list.',
      inputSchema: { id: z.number().int().positive(), achievedOn: date.optional() },
    },
    async ({ id, achievedOn }) =>
      json(await call('PATCH', `/leveling/api/wishes/${id}`, { achievedOn: achievedOn ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }) })),
  )

  server.registerTool(
    'schedule_list',
    { title: 'Daftar jadwal', description: 'Item Jadwal dalam rentang tanggal beserta statusnya.', inputSchema: { from: date, to: date }, annotations: readOnly },
    async ({ from, to }) => json(await get(`/hub/api/schedule${query({ from, to })}`)),
  )

  server.registerTool(
    'schedule_add',
    {
      title: 'Tambah jadwal',
      description: 'Menambah item Jadwal. activityType opsional (run_done, strength_done, swim_done, diary_done, learn_done, work_done) membuat item selesai otomatis lewat integrasi.',
      inputSchema: {
        title: z.string().trim().min(1).max(200),
        date,
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('Jam mulai HH:MM, wajib untuk kind fixed'),
        durationMin: z.number().int().min(5).max(1440),
        kind: z.enum(['fixed', 'flexible']).default('flexible'),
        module: z.enum(['umum', 'kesehatan', 'belajar', 'keuangan', 'kerja']).default('umum'),
        activityType: z.string().max(60).optional(),
      },
    },
    async (input) => json(await call('POST', '/hub/api/schedule', input)),
  )

  server.registerTool(
    'schedule_complete',
    { title: 'Selesaikan jadwal', description: 'Menandai item Jadwal selesai. Butuh id dan tanggal item dari schedule_list.', inputSchema: { id: z.string().min(1), date } },
    async ({ id, date }) => json(await call('POST', `/hub/api/schedule/${encodeURIComponent(id)}/complete`, { date })),
  )

  server.registerTool(
    'schedule_skip',
    { title: 'Lewati jadwal', description: 'Menandai item Jadwal dilewati.', inputSchema: { id: z.string().min(1), date } },
    async ({ id, date }) => json(await call('POST', `/hub/api/schedule/${encodeURIComponent(id)}/skip`, { date })),
  )

  server.registerTool(
    'finance_month',
    { title: 'Keuangan sebulan', description: 'Pemasukan, pengeluaran, budget, total per kategori, dan daftar transaksi satu bulan.', inputSchema: { month }, annotations: readOnly },
    async ({ month }) => json(await get(`/hub/api/finance${query({ month })}`)),
  )

  server.registerTool(
    'finance_add',
    {
      title: 'Catat transaksi',
      description: 'Mencatat transaksi hari ini. Pengeluaran: utama, jajan, tabungan, dana_darurat, lainnya. Pemasukan: gaji, freelance, bisnis, lainnya.',
      inputSchema: {
        type: z.enum(['expense', 'income']).default('expense'),
        amount: z.number().int().positive().max(1_000_000_000).describe('Nominal rupiah tanpa titik'),
        category: z.string().min(1).max(40),
        note: z.string().trim().max(200).optional(),
      },
    },
    async (input) => json(await call('POST', '/hub/api/quick/expense', input)),
  )

  server.registerTool(
    'timesheet_month',
    { title: 'Timesheet sebulan', description: 'Absensi satu bulan: jam masuk, keluar, kegiatan, izin, dan lembur.', inputSchema: { month }, annotations: readOnly },
    async ({ month }) => json(await timesheet({ action: 'month', date: `${month}-01` })),
  )

  server.registerTool(
    'timesheet_entry',
    {
      title: 'Isi Timesheet',
      description: 'Mengisi absensi satu tanggal: masuk atau keluar (butuh time), kegiatan (butuh text), atau absen (butuh kind sakit/izin/cuti).',
      inputSchema: {
        date,
        type: z.enum(['masuk', 'keluar', 'kegiatan', 'absen']),
        time: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('Jam HH:MM untuk masuk/keluar'),
        text: z.string().trim().max(500).optional().describe('Isi kegiatan'),
        kind: z.enum(['sakit', 'izin', 'cuti']).optional(),
      },
    },
    async ({ date, type, time, text, kind }) => {
      const body: Record<string, unknown> = { action: 'entry', date, type }
      if (type === 'masuk' || type === 'keluar') {
        if (!time) throw new Error('Isi time HH:MM')
        const [h, m] = time.split(':').map(Number)
        body.time = h! * 60 + m!
      }
      if (type === 'kegiatan') body.text = text
      if (type === 'absen') body.kind = kind
      const result = await timesheet(body)
      return json({ message: result.message, date })
    },
  )
}
