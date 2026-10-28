# Learn

Jalur belajar pribadi. Jalur dibuat lewat chat Claude dengan konektor MCP, lalu dipelajari di sini: roadmap, penjelasan singkat, maksimal tiga sumber resmi, dan satu latihan per topik.

| Bagian | Lokasi |
| --- | --- |
| Tampilan (Vue 3 + Vite) | `frontend/learn` |
| Server (Express + Supabase) | `backend/learn/src` |
| Konektor MCP untuk Claude | `backend/learn/src/mcp.ts` dan `systemTools.ts` |
| Skema awal | `backend/learn/supabase/migrations` |

- Latihan JavaScript dijalankan di browser lewat Web Worker (`frontend/learn/src/lib/runTests.ts`). Latihan lain memakai daftar cek.
- Saat jalur selesai, halaman jalur dan daftar jalur menampilkan prompt siap salin. Claude lalu membaca progres belajar, cita-cita, catatan malam, dan ringkasan fitness, kemudian menyarankan beberapa pilihan dari bidang berbeda.

Isi `backend/learn/.env` dengan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` (lihat `.env.example`). Server jalan bersama seluruh sistem lewat `npm start` dari root.
