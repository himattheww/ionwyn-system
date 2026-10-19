# Ionwyn System

Tujuh aplikasi pribadi yang dijalankan dengan satu perintah dan dibuka dari satu alamat: **http://localhost:4000**.

| Aplikasi | Alamat | Isi |
| --- | --- | --- |
| Beranda | `/#/beranda/` | Rangkuman hari ini dari semua aplikasi + status hubungan antar-aplikasi |
| Jadwal | `/jadwal/` | Reminder & Scheduling (React, Supabase) |
| Catatan Malam | `/catatan/` | Jurnal malam (Express, SQLite) |
| Fitness | `/fit/` | Garmin, recovery, berat, makan (Express, SQLite) |
| Learn | `/learn/` | Jalur belajar dengan AI (Express, Supabase) |
| Leveling | `/leveling/` | Exp dan level dari semua aplikasi (Express, SQLite) |
| Keuangan | `/uang/` | FinTrack (Vue, Supabase) |
| Timesheet | `/timesheet/` | Web absensi (Vue, Google Apps Script) |

Bar navigasi di atas hanya membungkus aplikasi dengan iframe. Isi setiap aplikasi tidak berubah. Alamat di address bar ikut halaman yang sedang dibuka (misalnya `/#/catatan/kalender`), jadi bisa disimpan sebagai bookmark. Tombol **Tab baru** membuka halaman itu tanpa bar navigasi.

Bagian yang tetap di cloud dan tidak dipindah: Supabase (Jadwal, Learn, Keuangan), Google Apps Script + bot Telegram Timesheet, dan Vercel + bot Telegram FinTrack.

## Prasyarat

- Node.js 24 LTS, minimal 24.15 (`node -v`)
- Opera GX atau Chrome untuk sinkron Garmin (lihat `fitness-track/README.md`)
- Claude Code CLI yang sudah login, untuk fitur AI Learn (lihat `learning/README.md`)

## Pertama kali

Semua perintah dijalankan dari folder `ionwyn-system` (cek dengan `pwd` di macOS atau `cd` di Windows; isinya harus ada `package.json`, `hub`, `scripts`).

```bash
npm run setup
```

Perintah ini menjalankan `npm ci` di root dan di setiap aplikasi.

Lalu siapkan konfigurasi:

```bash
cp .env.example .env
```

Di Windows PowerShell pakai `copy .env.example .env`. Isi `.env` (lihat bagian Konfigurasi), lalu build:

```bash
npm run build
```

## Menjalankan

```bash
npm start
```

Buka http://localhost:4000. Log semua bagian tampil di satu terminal dengan label per aplikasi. Kalau satu bagian mati, bagian lain tetap jalan, dan halaman aplikasi itu menampilkan "tidak bisa dibuka". Tekan `Ctrl+C` untuk menghentikan semuanya.

Setelah mengubah kode frontend, jalankan `npm run build` lagi. Untuk satu aplikasi saja: `npm run build -- catatan` (nama: `catatan`, `fit`, `leveling`, `learn`, `jadwal`, `uang`, `timesheet`).

Login Garmin tetap perintah terpisah karena interaktif:

```bash
cd fitness-track
npm run garmin:login
```

Pertama kali membuka `localhost:4000`, kamu perlu login sekali di Jadwal dan Keuangan, lalu mengisi Koneksi di Timesheet. Browser menyimpan sesi per alamat, dan alamatnya sekarang berbeda dari alamat lama.

## Desain

Semua aplikasi memakai satu sistem desain di `design/`. Arahnya "buku lapangan": kertas, tinta, dan satu aksen merah bata.

| File | Isi |
| --- | --- |
| `design/tokens.css` | Warna (terang dan gelap, lulus WCAG AA), font, ukuran teks, spacing, radius, durasi animasi, warna penanda per aplikasi (`--mark-*`) |
| `design/fonts.css` + `design/fonts/` | Newsreader (judul), IBM Plex Sans (teks), IBM Plex Mono (angka dan label). Self-hosted, tidak butuh internet |
| `design/base.css` | Dasar bersama: tipografi, `btn`, `field`, `tag`, `ledger`, `meter`, `reveal`, skeleton. Animasi mati otomatis kalau `prefers-reduced-motion` aktif |
| `design/system.css` | Satu file yang diimpor setiap aplikasi |

Di setiap aplikasi:
- `src/styles/app.css` mengimpor `design/system.css`, lalu stylesheet milik aplikasi itu.
- Style komponen ada di `src/styles/` dan dipasang dengan `<style scoped src="...">`, jadi komponen Vue hanya berisi template dan logika.
- Fungsi bantu (format, tanggal, API) ada di `src/lib/`. Composable Vue ada di `src/composables/`.

Leveling punya orb three.js (`leveling/web/src/lib/orb.ts`). Bentuknya mengikuti skor lima atribut dan dimuat terpisah (lazy), jadi tidak memperlambat halaman lain.

## Struktur folder

```
ionwyn-system/
├── package.json             setup, build, start, backup, test
├── .env.example             contoh konfigurasi root (tanpa nilai rahasia)
├── scripts/
│   ├── apps.mjs             daftar aplikasi, port internal, base path
│   ├── run.mjs              npm start: menjalankan semua bagian
│   ├── build.mjs            npm run build: build semua frontend dengan base path-nya
│   ├── setup.mjs            npm run setup: npm ci di semua folder
│   ├── backup.mjs           npm run backup
│   ├── test.mjs             npm test: semua tes dan typecheck
│   ├── screenshots.mjs      screenshot halaman utama (dipakai untuk cek tampilan)
│   └── compare-screenshots.mjs
├── hub/
│   ├── src/                 gateway, integrasi, API Beranda
│   └── web/                 shell navigasi dan halaman Beranda
├── catatan-malam/  fitness-track/  learning/  leveling/
├── reminder-and-scheduling/  financetracker/  timesheet/
├── backups/                 (tidak di git)
└── docs/audit.md            audit dan rancangan
```

### Port

Hanya `4000` yang perlu dibuka. Port lain dipakai di dalam dan hanya mendengarkan di `127.0.0.1`.

| Bagian | Port |
| --- | --- |
| Hub (gateway, shell, Beranda, integrasi) | 4000 |
| Catatan Malam | 4710 |
| Learn API | 4711 |
| Fitness | 4712 |
| Leveling | 4713 |

Jadwal, Learn web, Keuangan, dan Timesheet tidak punya proses sendiri. Hasil build-nya disajikan langsung oleh hub.

## Supabase dan login

Jadwal, Learn, dan Keuangan memakai **satu project Supabase** (project FinTrack). Skema Jadwal dan Learn ditambahkan lewat `supabase/migrations/20261019230000_gabung_jadwal_learn.sql`.

- **Login sekali.** Jadwal dan Keuangan memakai project dan origin yang sama, jadi sesi login tersimpan di satu kunci (`sb-<project>-auth-token`). Login di salah satunya membuat yang lain ikut masuk, dan keluar di salah satunya ikut mengeluarkan yang lain.
- **Learn** membaca dan menulis lewat servernya sendiri dengan secret key. Tabel Learn memakai RLS tanpa policy, jadi tidak terbaca dari browser.
- **Timesheet** tidak perlu mengisi Koneksi. `API_KEY` disimpan di `.env` root, dan web memanggil Apps Script lewat hub (`/timesheet/api`).
- Project lama `scheduling-reminder` dan `learningg` tidak dipakai lagi. Datanya ada di `backups/pra-gabung-*`. Project itu bisa di-pause atau dihapus dari dashboard Supabase kapan saja.

## Konfigurasi

Ada dua tingkat:

**`.env` root**, untuk hal yang dipakai bersama:

| Variabel | Fungsi |
| --- | --- |
| `HUB_PORT`, `CATATAN_PORT`, `LEARN_API_PORT`, `FIT_PORT`, `LEVELING_PORT` | Port |
| `BACKUP_FOLDER` | Folder backup, default `backups` di root |
| `BACKUP_KEEP` | Jumlah backup harian yang disimpan, default 30 |
| `INTEGRATION_INTERVAL_MIN` | Jarak antar-siklus hubungan antar-aplikasi, default 10 menit. `0` mematikan siklus otomatis |
| `RUN_ROUTINE_DURATION_MIN` | Durasi rutinitas lari baru yang dibuat dari pola Fitness (H7) |
| `SCHEDULE_SUPABASE_URL`, `SCHEDULE_SUPABASE_KEY`, `SCHEDULE_EMAIL`, `SCHEDULE_PASSWORD` | Akun Jadwal untuk hub dan Leveling. Sejak Supabase digabung, isinya sama dengan `FINANCE_*`. Key = anon key |
| `FINANCE_SUPABASE_URL`, `FINANCE_SUPABASE_KEY`, `FINANCE_EMAIL`, `FINANCE_PASSWORD` | Akun Keuangan. Dipakai Beranda, Leveling, dan backup. Key = anon key |
| `TIMESHEET_API_URL`, `TIMESHEET_API_KEY` | URL web app Apps Script (berakhiran `/exec`) dan `API_KEY`-nya. Sama dengan isian Koneksi di web Timesheet |

`npm start` menyuntik nilai ini ke setiap aplikasi sebagai environment proses. Nilai dari environment selalu menang atas `.env` milik aplikasi. Port dan folder backup cukup diatur di sini.

**`.env` per aplikasi**, untuk rahasia milik aplikasi itu sendiri:

| File | Isi |
| --- | --- |
| `catatan-malam/.env` | `DB_PATH` |
| `fitness-track/.env` | `DB_PATH`, pengaturan Garmin, `TARGET_LONG_RUN_KM` |
| `learning/server/.env` | Supabase Learn (service role), pengaturan AI |
| `leveling/.env` | Sumber mana yang aktif (`*_ENABLED`), `DESKTOP_NOTIFICATION` |
| `reminder-and-scheduling/.env` | Supabase Jadwal untuk build web |
| `financetracker/.env` | Supabase Keuangan untuk build web |

`PORT`, `ALLOW_LAN`, dan `BACKUP_FOLDER` di `.env` aplikasi diabaikan saat jalan lewat `npm start`. Semua `.env` ada di `.gitignore`. Hanya file `.env.example` yang masuk git.

## Backup

```bash
npm run backup
```

Hasilnya di `backups/harian/<tanggal_jam>/`:
- `catatan-malam.db`, `fitness-track.db`, `leveling.db`, dibuat dengan fungsi backup SQLite bawaan Node dan dicek dengan `integrity_check`. Aman walaupun aplikasi sedang jalan.
- `jadwal/`, `learn/`, `keuangan/`: semua tabel Supabase sebagai JSON.
- `timesheet.json`: semua bulan dari Apps Script.
- `env/`: salinan semua `.env`.

Hanya `BACKUP_KEEP` backup terbaru yang disimpan. Selain itu, Catatan Malam dan Fitness tetap membuat backup otomatis harian ke `backups/catatan-malam/` dan `backups/fitness-track/` selama `npm start` jalan.

Restore SQLite: hentikan `npm start`, salin file `.db` ke lokasi `DB_PATH` aplikasinya, hapus file `-wal` dan `-shm` di sebelahnya kalau ada, lalu jalankan lagi.

Folder `backups/` ada di laptop yang sama. Supaya aman dari laptop rusak, arahkan `BACKUP_FOLDER` ke folder yang tersinkron ke cloud.

## Hubungan antar-aplikasi

Semuanya berjalan di hub setiap `INTEGRATION_INTERVAL_MIN` menit, dan bisa dipicu dari tombol **Jalankan sekarang** di Beranda. Hasil dan error terakhir tiap hubungan tampil di Beranda.

| | Hubungan | Cara kerja |
| --- | --- | --- |
| H1 | Leveling membaca semua sumber | Fitness dan Catatan Malam lewat SQLite read-only, Jadwal dan Keuangan lewat Supabase, Learn lewat `GET /api/export`, Timesheet lewat Apps Script |
| H2 | Tanpa exp ganda | Item jadwal yang tipenya termasuk `disiplin.linkedActivityTypes` di `leveling/config/rules.json` tidak memberi exp disiplin. Exp-nya datang dari aplikasi asal faktanya |
| H3 | Leveling membaca Learn | Endpoint baru `GET /api/export` di Learn |
| H4 | Garmin menyelesaikan item latihan | Item `run_done`, `strength_done`, `swim_done` |
| H5 | Catatan Malam menyelesaikan pengingat | Item `diary_done` |
| H6 | Sesi Learn menyelesaikan item belajar | Item `learn:<id jalur>` (jalur tertentu) atau `learn_done` (jalur apa pun) |
| H7 | Pola lari Fitness menjadi rutinitas lari | Rutinitas Jadwal bertipe `run_done` dibuat atau diperbarui dari Pengaturan pola lari Fitness |
| H8 | Hadir di Timesheet menyelesaikan item kerja | Item `work_done` |

### Cara memakai H4–H8

Isi kolom **Tipe aktivitas** di item atau rutinitas Jadwal:

| Tipe aktivitas | Selesai otomatis kalau |
| --- | --- |
| `run_done` | Ada aktivitas lari Garmin di tanggal itu |
| `strength_done` | Ada sesi `strength_training` di tanggal itu |
| `swim_done` | Ada aktivitas renang di tanggal itu |
| `diary_done` | Catatan Malam untuk tanggal itu tersimpan (sebelum 02.00 dihitung malam sebelumnya) |
| `learn:2` | Ada sesi Learn untuk jalur id 2 di tanggal itu (id terlihat di alamat `/learn/tracks/2`) |
| `learn_done` | Ada sesi Learn jalur apa pun di tanggal itu |
| `work_done` | Timesheet hari itu Hadir = Y dan jam masuk terisi |

Aturan:
- Hanya item `terencana` dalam 7 hari terakhir yang dicek.
- Item yang sudah selesai, dilewati, atau digeser tidak pernah diubah.
- Satu fakta hanya menyelesaikan satu item. Dua item lari di hari yang sama butuh dua aktivitas lari.
- Waktu selesai diisi waktu fakta itu terjadi, misalnya jam mulai lari. Log realisasinya berisi nilai nyata (km atau menit) dan `meta.source` + `meta.ref` asal faktanya.
- Penyelesaian ditulis lewat `completeItem` milik Jadwal (`reminder-and-scheduling/core`), dengan akun `SCHEDULE_EMAIL`.
- Item dari rutinitas baru bisa diselesaikan setelah rutinitas minggu itu diterapkan di Jadwal. Draf rutinitas belum punya baris di database.

H7 hanya mengubah judul dan status aktif rutinitas `run_done`. Jam dan durasi yang kamu ubah sendiri di Jadwal tetap dipertahankan.

### Kalau satu aplikasi mati

Hubungan yang membutuhkan aplikasi itu dilewati di siklus tersebut. Error-nya tercatat di Beranda dan di log terminal. Hubungan lain tetap jalan. Leveling memakai data terakhir dari sumber yang gagal dibaca.

## Tes

```bash
npm test
```

Menjalankan tes hub, tes Catatan Malam, Fitness, Leveling, Jadwal (unit), dan typecheck semua aplikasi yang punya. Tes integrasi Jadwal ke Supabase tidak ikut, karena menulis ke database asli. Jalankan manual di `reminder-and-scheduling` dengan `npm test` kalau perlu.

Cek tampilan (sebelum/sesudah perubahan):

```bash
node scripts/screenshots.mjs gateway sesudah
node scripts/compare-screenshots.mjs baseline sesudah
```

Login sekali dulu dengan `node scripts/screenshots.mjs gateway login --login`. Profil browser tes disimpan di `.screenshots/profile` (tidak di git).

## Perbedaan dari aplikasi aslinya

Semua perbedaan ini tidak mengubah tampilan:
- Frontend membaca base path dari `APP_BASE` saat build (`vite.config.ts`, router `createWebHistory(import.meta.env.BASE_URL)`, fetch API memakai `BASE_URL`). Tanpa `APP_BASE`, misalnya `npm run dev` atau deploy Vercel FinTrack, semuanya tetap di `/` seperti sebelumnya.
- Scheduling: service worker dan manifest memakai path relatif.
- FinTrack: `redirectTo` login Google dan reset password ikut base path. Tambahkan `http://localhost:4000/uang/auth/callback` dan `http://localhost:4000/uang/auth/reset-password` di Supabase → Authentication → URL Configuration.
- Learn: server hanya mendengarkan di `127.0.0.1`, plus endpoint baru `GET /api/export`.
- Leveling: adapter Learn membaca API Learn, adapter Timesheet membaca Apps Script, aturan `linkedActivityTypes` (H2).

## Windows

Script root memakai Node saja (tanpa bash), dan proses dihentikan dengan `taskkill /T /F` di Windows. Yang perlu disesuaikan di Windows:
- `fitness-track/.env`: `GARMIN_BROWSER_PATH` ke `opera.exe`, atau kosongkan untuk Chrome.
- `learning/server/.env`: `CLAUDE_CLI_PATH` ke `claude.exe`.
- `SCREENSHOT_BROWSER_PATH` kalau memakai script screenshot.
