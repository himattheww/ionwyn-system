# Learn

Aplikasi belajar pribadi. Kamu tulis apa yang mau dipelajari dan tujuannya, AI menyusun topik berurutan, kamu review, lalu per topik AI membuat study case untuk dikerjakan. Penjelasan materi diambil dari sumber resmi yang ditautkan di tiap topik, bukan ditulis AI.

## Struktur

```
learning/
├── server/     Express + TypeScript, API di http://localhost:3001
├── web/        Vue 3 + TypeScript + Vite, UI di http://localhost:5173
└── supabase/migrations/   schema database
```

Hal penting:

- Semua panggilan AI ada di `server/src/ai.ts`. Ada dua provider, dipilih lewat `AI_PROVIDER`:
  - `cli` (default): server menjalankan Claude Code CLI (`claude -p`) memakai login langganan Pro/Max kamu. Tidak perlu API key. Pemakaian masuk ke kuota langganan. Hanya untuk pemakaian pribadi di laptop sendiri.
  - `api`: server memanggil Claude API langsung dengan `ANTHROPIC_API_KEY` (billing terpisah di console.anthropic.com).
- Validasi input memakai Zod di `server/src/schemas.ts`. Jawaban AI juga dicek dengan Zod di `server/src/ai.ts`. Kalau tidak valid, server mencoba sekali lagi, lalu mengembalikan error.
- URL sumber dari AI dicek di `server/src/urlCheck.ts`. Hanya status 200-399 yang disimpan.
- Supabase hanya diakses dari server memakai `service_role` key. Semua tabel memakai RLS tanpa policy, jadi anon key tidak bisa membaca data.

## Prasyarat

- Node.js 20.19+ (cek: `node -v`)
- Project Supabase (tier gratis cukup)
- Claude Code CLI yang sudah login dengan akun Pro/Max (cek: `claude --version`, lalu jalankan `claude` sekali untuk login). Atau API key Anthropic kalau memakai `AI_PROVIDER=api`.

## Setup

### 1. Buat project Supabase dan jalankan schema

1. Buat project baru di https://supabase.com/dashboard.
2. Buka **SQL Editor**, lalu tempel isi `supabase/migrations/20261016150000_create_learning_schema.sql`. Klik **Run**.
3. Buka **Project Settings → API Keys**, lalu salin **Secret key** (`sb_secret_...`) atau `service_role` di tab Legacy. Project URL ada di **Project Settings → Data API**.

### 2. Isi env server

Jalankan dari folder `learning`:

```bash
cd ~/Desktop/cobaconvert/learning/server
cp .env.example .env
```

Isi `server/.env`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
AI_PROVIDER=cli
CLAUDE_CLI_PATH=claude
ANTHROPIC_MODEL=claude-sonnet-5-5
ANTHROPIC_API_KEY=
PORT=3001
```

- `ANTHROPIC_API_KEY` hanya dipakai kalau `AI_PROVIDER=api`. Pada mode `cli`, key ini sengaja tidak diteruskan ke proses `claude` supaya CLI memakai login langganan.
- `ANTHROPIC_MODEL` wajib untuk `api`. Pada mode `cli`, kalau dikosongkan, CLI memakai model default-nya.
- `.env` sudah masuk `.gitignore`. Jangan commit file ini, dan jangan taruh key ini di frontend.

### 3. Install dan jalankan

Pakai dua terminal.

Terminal 1, server:

```bash
cd ~/Desktop/cobaconvert/learning/server
npm install
npm run dev
```

Output yang diharapkan: `API jalan di http://localhost:3001`

Terminal 2, web:

```bash
cd ~/Desktop/cobaconvert/learning/web
npm install
npm run dev
```

Buka http://localhost:5173. Vite meneruskan request `/api` ke server di port 3001.

## Perintah lain

| Folder | Perintah | Fungsi |
|---|---|---|
| server | `npm run typecheck` | cek tipe TypeScript |
| web | `npm run build` | typecheck + build produksi |

## Aturan yang diterapkan

- Status topik: `belum`, `sedang`, `selesai`, `sudah_bisa`. Topik menjadi `sedang` saat study case dibuat, dan `selesai` saat study case-nya ditandai selesai.
- Study case: satu per topik. Default kesulitan `sedang`. Tombol "Lebih sulit" dan "Lebih mudah" membuat study case baru yang menimpa yang lama.
- Study case menjadi `dikerjakan` saat kamu mencatat sesi untuk topik itu.
- Jalur dan topiknya disimpan bersamaan lewat fungsi `create_track` di database. Kalau gagal, tidak ada data yang tersimpan setengah.
- Minggu dihitung Senin sampai Minggu memakai tanggal lokal laptop.

## Troubleshooting

**`npm install` di `web` gagal dengan `Cannot read properties of null (reading 'edgesOut')`**
Ini bug npm 10.8 saat membaca optional peer dependency Vite 8. `web/.npmrc` sudah berisi `legacy-peer-deps=true` untuk menghindarinya. Pastikan file itu ada.

**Server langsung berhenti dengan error Zod tentang `SUPABASE_URL`**
`server/.env` belum diisi, atau kamu menjalankan `npm run dev` dari folder yang salah. Jalankan dari `learning/server`.

**Muncul "Claude Code CLI tidak ditemukan"**
Server tidak menemukan perintah `claude` di PATH. Cek lokasinya dengan `which claude`, lalu isi path lengkapnya di `CLAUDE_CLI_PATH`.

**Muncul "Claude Code gagal memanggil AI: ..."**
Biasanya karena CLI belum login, kuota langganan habis, atau internet mati. Jalankan `claude` di terminal untuk login atau cek statusnya.

**Muncul "Konfigurasi AI belum lengkap"** (mode `api`)
`ANTHROPIC_API_KEY` atau `ANTHROPIC_MODEL` kosong. Isi keduanya, lalu restart server.

**Muncul "Tidak bisa terhubung ke database Supabase"**
Cek `SUPABASE_URL` dan koneksi internet. Pastikan project Supabase tidak sedang di-pause.

**Muncul "Model AI tidak ditemukan"**
Nama di `ANTHROPIC_MODEL` salah. Cek daftar model di dokumentasi Anthropic.
