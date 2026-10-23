# Learn

Aplikasi belajar pribadi di dalam Ionwyn System. Jalur belajar dibuat lewat chat Claude dengan konektor MCP, lalu dipelajari di sini: roadmap, penjelasan singkat, sumber resmi, dan satu latihan per topik.

## Struktur

```
learning/
├── server/   Express + TypeScript
│   └── src/
│       ├── learn.ts      logika jalur dan topik, dipakai API dan konektor
│       ├── mcp.ts        server MCP: alat untuk Claude
│       ├── oauth.ts      OAuth untuk konektor Claude
│       ├── routes/       API untuk web
│       ├── schemas.ts    validasi Zod, termasuk bentuk latihan
│       └── urlCheck.ts   membuang link sumber yang mati
└── web/      Vue 3 + TypeScript + Vite
```

- Supabase diakses dari server memakai `service_role` key. Tabel memakai RLS tanpa policy, jadi tidak terbaca dari browser.
- Latihan JavaScript dijalankan di browser lewat Web Worker (`web/src/lib/runTests.ts`). Latihan lain memakai daftar cek mandiri.
- Menandai topik selesai juga mencatat sesi belajar, yang dibaca Jadwal (H6) dan Leveling.

## Menjalankan

Dijalankan bersama seluruh sistem dengan `npm start` dari folder `ionwyn-system`. Isi `server/.env` dengan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`.

Cara memasang konektor di Claude ada di README utama, bagian "Konektor Claude (MCP)".
