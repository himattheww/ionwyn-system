import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { addTopics, completeTopic, createTrack, learningProgress, listTracks, logSession, setTrackStatus, topicDetail, trackDetail, updateTopic } from './learn.js'
import { topicInput, topicUpdate, trackInput, trackStatuses } from './schemas.js'
import { registerSystemTools } from './systemTools.js'

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] })

const guide = `Ionwyn adalah sistem pribadi satu orang: Beranda, Jadwal, Catatan Malam, Fitness, Learn, Leveling, Keuangan, dan Timesheet. Tanggal memakai zona Asia/Jakarta.
Alat yang menulis data (diary_save, fitness_log, schedule_*, finance_add, timesheet_entry, create_track, add_topics, update_topic, complete_topic, log_session) hanya dipakai kalau pengguna memintanya, dengan nilai dari pengguna. Konfirmasi dulu kalau ada yang ambigu.
Ionwyn Learn menyimpan jalur belajar milik satu orang. Tiap jalur berisi topik berurutan, dan tiap topik punya penjelasan singkat, maksimal 3 sumber resmi, dan satu latihan.
Saat membuat jalur: tanyakan dulu tujuan, level, dan waktu per minggu kalau belum jelas. Susun 5-12 topik. Penjelasan cukup 2-4 paragraf pendek.
Jalur coding berbahasa JavaScript memakai latihan type "code" language "javascript" berupa fungsi murni dengan 3-6 tests yang hasilnya pasti benar. Bahasa lain memakai type "code" dengan checklist. Jalur bukan coding memakai type "praktik" dengan checklist.
Untuk saran belajar berikutnya, baca learning_progress dulu, lalu wish_list, diary_month bulan ini, dan fitness_summary untuk melihat cita-cita, minat, dan kondisi pengguna. Saran boleh di luar IT dan tidak harus lanjutan jalur yang sama, misalnya bahasa, musik, keuangan, kesehatan, atau keterampilan yang mendukung cita-cita. Beri 2-3 pilihan dari bidang berbeda, masing-masing dengan alasan yang merujuk ke data tadi, lalu tanyakan pilihan pengguna sebelum membuat jalur.`

export function createMcpServer() {
  const server = new McpServer({ name: 'ionwyn', version: '1.1.0' }, { instructions: guide })

  server.registerTool(
    'list_tracks',
    { title: 'Daftar jalur', description: 'Daftar semua jalur belajar beserta progres topiknya.', annotations: { readOnlyHint: true } },
    async () => json(await listTracks()),
  )

  server.registerTool(
    'get_track',
    {
      title: 'Lihat jalur',
      description: 'Detail satu jalur: topik berurutan, status, prasyarat, dan riwayat sesi belajar.',
      inputSchema: { trackId: z.number().int().positive() },
      annotations: { readOnlyHint: true },
    },
    async ({ trackId }) => json(await trackDetail(trackId)),
  )

  server.registerTool(
    'get_topic',
    {
      title: 'Lihat topik',
      description: 'Isi lengkap satu topik: penjelasan, sumber, latihan, dan percobaan terakhir.',
      inputSchema: { topicId: z.number().int().positive() },
      annotations: { readOnlyHint: true },
    },
    async ({ topicId }) => json(await topicDetail(topicId)),
  )

  server.registerTool(
    'learning_progress',
    {
      title: 'Progres belajar',
      description: 'Ringkasan semua jalur, topik yang baru selesai, dan menit belajar minggu ini. Pakai sebelum menyarankan apa yang dipelajari berikutnya.',
      annotations: { readOnlyHint: true },
    },
    async () => json(await learningProgress()),
  )

  server.registerTool(
    'create_track',
    {
      title: 'Buat jalur',
      description: 'Membuat jalur belajar baru lengkap dengan semua topik, penjelasan singkat, sumber, dan latihannya.',
      inputSchema: trackInput,
    },
    async (input) => {
      const id = await createTrack(input)
      return json({ trackId: id, message: `Jalur "${input.goal}" tersimpan dengan ${input.topics.length} topik.` })
    },
  )

  server.registerTool(
    'add_topics',
    {
      title: 'Tambah topik',
      description: 'Menambahkan topik baru di akhir jalur yang sudah ada, misalnya untuk melanjutkan roadmap.',
      inputSchema: { trackId: z.number().int().positive(), topics: z.array(topicInput).min(1).max(10) },
    },
    async ({ trackId, topics }) => json({ topicIds: await addTopics(trackId, topics) }),
  )

  server.registerTool(
    'update_topic',
    {
      title: 'Ubah topik',
      description: 'Mengubah judul, tujuan, penjelasan, sumber, atau latihan satu topik. Kirim hanya bagian yang berubah.',
      inputSchema: { topicId: z.number().int().positive(), changes: topicUpdate },
    },
    async ({ topicId, changes }) => {
      await updateTopic(topicId, changes)
      return json(await topicDetail(topicId))
    },
  )

  server.registerTool(
    'complete_topic',
    {
      title: 'Tandai topik selesai',
      description: 'Menandai satu topik selesai dan mencatat sesi belajarnya, sama seperti tombol tandai selesai di web. Kalau semua topik selesai, jalur ikut selesai. Tanyakan durasi belajar kalau pengguna belum menyebutnya.',
      inputSchema: { topicId: z.number().int().positive(), durationMin: z.number().int().min(1).max(600) },
    },
    async ({ topicId, durationMin }) => json(await completeTopic(topicId, durationMin)),
  )

  server.registerTool(
    'log_session',
    {
      title: 'Catat sesi belajar',
      description: 'Mencatat sesi belajar hari ini untuk satu topik tanpa menandainya selesai. Menit masuk ke progres mingguan dan menyelesaikan item belajar di Jadwal hari ini.',
      inputSchema: { topicId: z.number().int().positive(), durationMin: z.number().int().min(1).max(600) },
    },
    async ({ topicId, durationMin }) => json(await logSession(topicId, durationMin)),
  )

  server.registerTool(
    'set_track_status',
    {
      title: 'Ubah status jalur',
      description: 'Mengubah status jalur menjadi aktif, selesai, atau arsip.',
      inputSchema: { trackId: z.number().int().positive(), status: z.enum(trackStatuses) },
    },
    async ({ trackId, status }) => {
      await setTrackStatus(trackId, status)
      return json({ trackId, status })
    },
  )

  registerSystemTools(server)
  return server
}

export async function handleMcp(req: Request, res: Response) {
  const server = createMcpServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  res.on('close', () => {
    transport.close()
    server.close()
  })
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
}
