# Audit: menggabungkan aplikasi pribadi

Tanggal audit: 19 Oktober 2026. Mesin: macOS (Darwin 25.6), Node v24.22.0, npm 11.19.1.
Belum ada kode yang diubah. Satu-satunya file baru adalah laporan ini.

Tes dan typecheck yang ada dijalankan sebagai baseline, semuanya lulus:

| Aplikasi | Perintah | Hasil |
| --- | --- | --- |
| Catatan Malam | `npm test` | 14 tes lulus |
| Fitness Track | `npm test`, `npm run typecheck` | 33 tes lulus, typecheck bersih |
| Leveling | `npm test`, `npm run typecheck` | 38 tes lulus, typecheck bersih |
| Scheduling | `npx vitest run core scripts`, `npm run typecheck` | 67 tes lulus, typecheck bersih |
| Learn | `npm run typecheck` di `server` dan `web` | bersih (tidak ada tes) |
| FinTrack, Timesheet | tidak ada tes | - |

Tes integrasi Scheduling (`adapters/supabase/store.integration.test.ts`) sengaja tidak dijalankan. Tes itu menulis lalu menghapus baris di project Supabase asli.

---

## 1. Per aplikasi

### 1.1 Catatan Malam (`catatan-malam/`)

**Fungsi.** Jurnal malam. Satu catatan per tanggal berisi apa yang terjadi, hal baik, pelajaran, dan catatan bebas. Catatan baru hanya bisa dibuat pukul 18.00–02.00 WIB. Sebelum 02.00, "malam ini" berarti tanggal kemarin. Satu hari sebelumnya boleh diisi belakangan (`is_backfilled`).

**Fitur.** Halaman malam ini dengan "Hari ini, dulu" (sebulan lalu, setahun lalu), kalender bulanan, kumpulan pelajaran, kumpulan hal baik, pencarian kata kunci.

| Hal | Isi |
| --- | --- |
| Stack | Express 5 + TypeScript (tsx untuk dev, `tsc` untuk build), better-sqlite3 13, Zod 4. Web: Vue 3.5, vue-router 5, Vite 8, TypeScript 6, Phosphor icons |
| Runtime | Node ≥24 (`engines`) |
| Jalankan | `npm run build` lalu `npm start` (satu port). Dev: `npm run dev:server` + `npm run dev:web` |
| Port | `PORT=3000`. Vite dev 5173, proxy `/api` |
| Host | `127.0.0.1`, atau `0.0.0.0` kalau `ALLOW_LAN=true` |
| Database | SQLite `data/catatan.db` (WAL). Satu tabel `entries(id, entry_date UNIQUE, happened, good_things, lessons, free_text, is_backfilled, created_at, updated_at)` |
| `.env` | `PORT`, `DB_PATH`, `ALLOW_LAN`, `BACKUP_FOLDER` |
| Backup | Bawaan: backup SQLite saat start dan tiap jam kalau backup terakhir >24 jam, simpan 30 file `catatan-YYYY-MM-DD_HHmmss.db` di `BACKUP_FOLDER` (sekarang `backups/`) |
| Halaman | `/`, `/kalender`, `/entri/:date`, `/pelajaran`, `/hal-baik`, `/cari` |
| API | `GET /api/today`, `GET /api/entries?month=`, `GET/PUT /api/entries/:date`, `GET /api/lessons`, `GET /api/good-things`, `GET /api/search?q=` |
| Tes | `server/src/time.test.ts` (aturan jendela waktu) |

### 1.2 Fitness Track (`fitness-track/`), di Leveling disebut "Fit Tracker"

**Fungsi.** Memantau latihan dan kondisi badan. Aktivitas, set latihan beban, tidur, dan RHR diambil dari Garmin Connect lewat Playwright yang membuka browser sungguhan. Berat, makan, dan kondisi (alkohol, sakit) diisi manual.

**Fitur.** Ringkasan minggu ini (kepatuhan pola lari, km, sesi beban, rata-rata 7 hari tidur/RHR/berat, protein, nasi), daftar aktivitas, riwayat beban per gerakan, recovery, form catat, laporan bulanan, sinkron Garmin, pengaturan pola lari.

| Hal | Isi |
| --- | --- |
| Stack | Express 5, TypeScript dijalankan langsung oleh Node (type stripping), better-sqlite3 13, Zod 4, Playwright 1.64. Web: Vue 3.5, vue-router 5, Vite 8, TypeScript 5.9 |
| Runtime | Node ≥24 |
| Jalankan | `npm run build` lalu `npm start`. Login Garmin: `npm run garmin:login` (interaktif, di terminal) |
| Port | `.env` sekarang `PORT=3010` (default kode 3000). Vite dev 5173 |
| Host | `127.0.0.1`, atau `0.0.0.0` kalau `ALLOW_LAN=true` |
| Database | SQLite `data/fitness.db` (8,4 MB). Tabel: `activities(garmin_id PK, type, name, start_time, date, duration_sec, distance_m, avg_hr, avg_pace_sec_per_km, calories)`, `strength_sets`, `recovery_daily`, `condition_daily`, `weights`, `meals`, `garmin_raw`, `sync_status`, `settings(key, value)`. Pola lari ada di `settings.run_pattern`, JSON kunci 1 = Senin sampai 7 = Minggu, default `{1:'easy',3:'tempo',5:'easy',7:'long run'}` |
| `.env` | `PORT`, `DB_PATH`, `ALLOW_LAN`, `BACKUP_FOLDER`, `GARMIN_PROFILE_DIR`, `GARMIN_HEADLESS`, `GARMIN_BROWSER_PATH` (sekarang Opera GX macOS), `TARGET_LONG_RUN_KM` |
| Backup | Bawaan, sama seperti Catatan Malam, file `fitness-YYYYMMDD-HHMMSS.db` di `backups/` |
| Sinkron | Otomatis saat start kalau sinkron sukses terakhir >24 jam, atau `POST /api/sync`. Tidak ada jadwal berkala dan tidak ada hook selesai sinkron |
| Halaman | `/`, `/aktivitas`, `/beban`, `/beban/:name`, `/recovery`, `/catat`, `/laporan`, `/sinkron`, `/pengaturan` |
| API | `GET /api/summary`, `/activities`, `/long-runs`, `/strength`, `/strength/exercise`, `/recovery`, `/weights`, `/meals`, `/report`, `/sync`, `/settings`; `PUT /recovery/:date`, `/condition/:date`, `/weights/:date`, `/meals/:date`, `/settings/run-pattern`; `POST /sync` |
| Tes | `server/test`: parse, stats, store, report |

### 1.3 Reminder & Scheduling (`reminder-and-scheduling/`)

**Fungsi.** Jadwal harian satu pengguna: item manual, rutinitas mingguan, pengingat, geser, dan catatan realisasi (`activity_logs`). README-nya memang menyebut tabel-tabel ini disiapkan untuk dibaca dan ditulis modul lain.

**Fitur.** Planner harian dengan kalender bulan, item `fixed` (punya jam) dan `flexible`, rutinitas mingguan yang tampil sebagai draf lalu diterapkan, geser dengan usulan slot, pecah item, sesi "lagi kosong", catat langsung, riwayat, pengaturan jam tenang dan ringkasan. Notifikasi dihitung di browser, hanya saat tab atau PWA terbuka.

| Hal | Isi |
| --- | --- |
| Stack | React 19, Vite 8, TypeScript 5.9, `@supabase/supabase-js` 2.100.1. Tidak ada server sendiri |
| Struktur | `core/` logika murni TypeScript tanpa I/O (`completeItem`, `generateWeek`, `suggestSlots`, dst.), `adapters/supabase/` implementasi `Store`, `web/` UI |
| Runtime | README: Node 20.19+ (dipakai 20.20.2). Jalan juga di Node 24 (tes dan typecheck lulus) |
| Jalankan | `npm run dev` (dev), `npm run build` ke `dist/` lalu `npm run preview` |
| Port | Vite 5173 |
| Database | Supabase project `qrlt…` (cloud). Tabel `routine_templates`, `schedule_items`, `activity_logs`, `planner_settings`, view `exp_events`. Semua RLS `owner = auth.uid()` |
| Login | Supabase email/password di halaman Login. Sesi disimpan di `localStorage` origin web |
| `.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (masuk bundle), `TEST_EMAIL`, `TEST_PASSWORD` (hanya tes integrasi dan seed) |
| Halaman | Satu halaman, layar diganti lewat state (`home`, `routines`, `history`, `settings`) |
| Tes | `core/test` (unit), `adapters/supabase/*.test.ts` (rows + integrasi), `scripts/dummy-data.test.ts` |

Catatan penting untuk integrasi:
- `completeItem(item, now, newId)` mengubah status ke `selesai` dan membuat tepat satu `activity_logs` (unik per `item_id`). Ini satu-satunya cara "menyelesaikan" item, dan bisa dipanggil dari Node.
- `routine_templates.weekday` memakai 0 = Minggu sampai 6 = Sabtu. Fitness Track memakai 1 = Senin sampai 7 = Minggu.
- Item rutinitas yang belum diterapkan hanya draf di layar, belum ada barisnya di database.
- Planner memuat ulang data hanya saat dibuka, ganti tanggal, atau setelah aksi. Perubahan dari luar baru terlihat setelah itu.

### 1.4 Learn (`learning/`)

**Fungsi.** Belajar terarah. Kamu tulis tujuan, AI menyusun topik berurutan, kamu review, lalu per topik AI membuat study case. Materi diambil dari sumber resmi yang URL-nya dicek.

**Fitur.** Daftar jalur dengan menit belajar minggu ini dibanding target `hours_per_week`, buat jalur (plan AI lalu simpan), detail jalur, detail topik dan study case (lebih sulit / lebih mudah / selesai), catat sesi belajar.

| Hal | Isi |
| --- | --- |
| Stack | Server: Express 5, tsx, Zod 4, `@supabase/supabase-js` 2.105.0. Web: Vue 3.5.44, vue-router 4.6.4, Vite 8.3.4, TypeScript 5.9.3 |
| AI | `AI_PROVIDER=cli` menjalankan `claude -p` (path `CLAUDE_CLI_PATH`, sekarang path macOS), atau `api` dengan `ANTHROPIC_API_KEY` |
| Runtime | README: Node 20.19+. Jalan di Node 24 |
| Jalankan | Dua terminal: `learning/server` `npm run dev`, `learning/web` `npm run dev`. Tidak ada mode produksi: server tidak menyajikan `web/dist` |
| Port | API `PORT=3001`. Web Vite 5173, proxy `/api` ke 3001 |
| Host | `app.listen(env.PORT)` tanpa host, jadi mendengarkan di semua interface |
| Database | Supabase project `mpbn…` (cloud). Tabel `tracks`, `topics`, `study_cases`, `learning_sessions`, fungsi `create_track`. RLS aktif tanpa policy, hanya diakses server dengan service role key |
| `.env` (`server/.env`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_PROVIDER`, `CLAUDE_CLI_PATH`, `ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY`, `PORT` |
| Halaman | `/`, `/tracks/new`, `/tracks/:id`, `/topics/:id`, `/sessions/new` |
| API | `GET /api/tracks`, `POST /api/tracks/plan`, `POST /api/tracks`, `GET/PATCH /api/tracks/:id`, `GET /api/topics/:id`, `POST /api/topics/:id/study-case`, `POST /api/topics/:id/study-case/complete`, `POST /api/sessions` |
| Tes | Tidak ada |

`POST /api/sessions` butuh `trackId`, `occurredAt`, `durationMin`, dan `summary` 1–200 karakter. Tidak ada endpoint untuk membaca semua sesi.

### 1.5 Leveling (`leveling/`)

**Fungsi.** RPG untuk satu orang. Exp dihitung ulang dari data aplikasi lain (semua dibaca saja): stamina, intelek, kebijaksanaan, disiplin, kekayaan. Ada level, kelas, quest mingguan, achievement, log exp, dan notifikasi desktop.

| Hal | Isi |
| --- | --- |
| Stack | Express 5, TypeScript lewat type stripping Node, better-sqlite3 13, Zod 4, node-notifier 11. Web: Vue 3.5, vue-router 5, Vite 8, TypeScript 6 |
| Runtime | Node ≥24.15 |
| Jalankan | `npm run build` lalu `npm start` (`node --env-file=.env`, file wajib ada) |
| Port | `PORT=3100`, host `127.0.0.1` |
| Database | SQLite `data/leveling.db`, bisa dibangun ulang dari sumber |
| Aturan | `config/rules.json` |
| `.env` | Belum ada. `.env.example`: `PORT`, `LEVELING_DB_PATH`, `RULES_PATH`, `TARGET_LONG_RUN_KM`, `DESKTOP_NOTIFICATION`, lalu per sumber `*_ENABLED` dan path/URL/key/email/password untuk FIT, DIARY, LEARN, TIMESHEET, SCHEDULE, FINANCE, STOCK |
| Halaman | Karakter, Log exp, Riwayat, Achievement, Sumber |
| API | `GET /api/character`, `/history`, `/log`, `/achievements`, `/sources`, `/notifications`; `POST /api/recalculate` |
| Tes | `server/test`: exp, progress, recalculate, sources |

Status sumber:

| Sumber | Cara baca | Status |
| --- | --- | --- |
| Fit Tracker | SQLite read-only | Siap, tinggal isi path |
| Catatan Malam | SQLite read-only | Siap, tinggal isi path |
| Learn | SQLite read-only `LEARN_DB_PATH` | **Tidak cocok.** Learn memakai Supabase, tidak ada file SQLite. Adapter perlu diganti |
| Timesheet | Google Sheets API dengan service account | Butuh service account dan kunci di `keys/` |
| Scheduling | Supabase REST, view `exp_events` | Siap, butuh anon key + email/password |
| Keuangan | Supabase REST `transactions`, `budget_allocations` | Siap kalau akun FinTrack punya password. Kalau login Google, butuh service role key |
| Saham | Supabase REST | Tidak ada aplikasi saham di folder ini. Biarkan mati |

Leveling belum pernah dijalankan: `data/` kosong dan `.env` belum dibuat.

### 1.6 Timesheet (`timesheet/`)

**Fungsi.** Absensi kerja harian di Google Sheets. Diisi lewat bot Telegram atau web.

**Bagian cloud.** `Code.gs` adalah Google Apps Script (V8, zona Asia/Jakarta) yang dideploy sebagai web app `ANYONE_ANONYMOUS`. `doPost` menangani dua hal:
- Webhook bot Telegram (parameter `key` = `WEBHOOK_KEY`, chat dibatasi `ALLOWED_CHAT_ID`). Perintah: `masuk`, `keluar`, `kegiatan`, `sakit`, `izin`, `cuti`, `rekap`, `help`.
- JSON API untuk web (`apiKey` di body = `API_KEY`): aksi `month` (data satu bulan + rekap) dan `entry` (masuk/keluar/kegiatan/absen).

Script properties: `TELEGRAM_TOKEN`, `SPREADSHEET_ID`, `WEBHOOK_KEY`, `API_KEY`, `ALLOWED_CHAT_ID`, `WEBAPP_URL`. Tab bulan `YYYY-MM` dibuat otomatis, baris 7 ke bawah: tanggal, Hadir, Start, Finish, istirahat, total, catatan. Tab `Libur` berisi tanggal merah.

| Hal | Isi |
| --- | --- |
| Web | Vue 3.5, Vite 8, TypeScript 6, tanpa router. `base: './'`, jadi bisa dibuka dari folder mana pun |
| Runtime | Node 24 (dari `@types/node` 24) |
| Jalankan | `web`: `npm run dev`, atau `npm run build` lalu sajikan `dist/` |
| Port | Vite 5173 |
| Konfigurasi | Tidak ada `.env`. URL web app dan `API_KEY` diisi di layar Koneksi dan disimpan di `localStorage` key `timesheet.settings` |
| Git | Repo sendiri, remote `github.com/himattheww/timesheet-web` (publik). Ada perubahan belum di-commit (komponen baru `ClockDial`, `AppIcon`, beberapa komponen lama dihapus) |
| Skrip | `commit-bertahap.sh`, `staggered-push.sh` (bash) |

### 1.7 FinTrack (`financetracker/`)

**Fungsi.** Keuangan pribadi: transaksi, budget per kategori, goals tabungan, grafik, AI analyst, export PDF, bot Telegram untuk mencatat transaksi.

| Hal | Isi |
| --- | --- |
| Stack | Vue 3.5, Vite **5.4**, vue-router **4**, Pinia 2, Tailwind 3, ApexCharts, vite-plugin-pwa, TypeScript 5.6, ESLint 9 |
| Bagian cloud | Dideploy di Vercel (`financetracker-taupe-nine.vercel.app`). `api/telegram-webhook.js` serverless function untuk bot. AI analyst lewat Supabase Edge Function `ai-chat` |
| Jalankan lokal | `npm run dev`, atau `npm run build` lalu `npm run preview` |
| Port | Vite 5173 |
| Database | Supabase project `sgcy…` (cloud). Tabel `profiles`, `transactions`, `recurring_transactions`, `budget_allocations`, `saving_goals`, `monthly_reports`, storage avatar. RLS per user |
| Login | Supabase Auth email/password dan Google OAuth |
| `.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ANTHROPIC_API_KEY` |
| Env Vercel (dari kode webhook) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `APP_URL` |
| Halaman | `/auth/login`, `/auth/register`, `/auth/callback`, `/auth/forgot`, `/auth/reset-password`, `/onboarding`, `/telegram-link`, `/dashboard`, `/transactions`, `/charts`, `/goals`, `/budget`, `/ai`, `/profile` |
| Git | Repo sendiri, remote `github.com/himattheww/financetracker` (privat). Banyak perubahan belum di-commit |

---

## 2. Temuan keamanan (perlu keputusanmu, di luar penggabungan)

1. **`.env` FinTrack ada di git history dan sudah di-push.** Commit pertama `217e9c0d` memuat `.env` (URL Supabase, anon key, `VITE_ANTHROPIC_API_KEY`), dan file itu ikut di-track sampai sekarang. Repo-nya privat.
   **Sudah dibersihkan 19 Oktober 2026**, atas persetujuanmu:
   - Backup dulu ke `backups/pra-bersih-fintrack-20261019-220439/`: mirror repo lama dan arsip folder kerja.
   - `git filter-repo` menghapus `.env` dan `node_modules/` dari ke-20 commit.
   - `git push --force` ke `main` (`aff2c72` menjadi `0463b4b`).
   - Folder kerja di-reset ke history baru. Semua perubahan yang belum di-commit tetap utuh. `.env` sekarang tidak di-track dan diabaikan `.gitignore`.
   - Scan history baru untuk `sk-ant-`, JWT, dan `sb_secret_` hanya menemukan teks placeholder `VITE_ANTHROPIC_API_KEY=sk-ant-...` di `AIAnalystView.vue` versi lama.

   **Masih perlu:** ganti API key Anthropic. Membersihkan history tidak mencabut key yang sempat ter-clone atau ter-cache. Backup mirror di `backups/` masih memuat `.env` lama, jadi folder itu jangan pernah di-commit atau dibagikan.
2. **`node_modules` FinTrack ikut ter-commit** (22.163 file). Sudah ikut dibersihkan dari history di poin 1.
3. **`VITE_ANTHROPIC_API_KEY` memakai prefix `VITE_`.** Prefix ini membuat Vite menanam nilainya ke bundle kalau suatu saat dipakai di `src`. Sekarang belum dipakai di `src`, dan `dist/` tidak berisi `sk-ant` (sudah dicek). Sebaiknya ganti nama jadi `ANTHROPIC_API_KEY` di env Vercel saja.
4. **Server Learn mendengarkan di semua interface**, karena `app.listen(env.PORT)` tanpa host. Ini melanggar batasan "hanya localhost". Perbaikannya satu argumen: `'127.0.0.1'`.
5. `fitness-track/.garmin-profile` (63 MB) berisi cookie sesi Garmin. Folder ini sudah di `.gitignore` Fitness Track. `.gitignore` root nanti juga wajib mengecualikannya, dan folder ini tidak ikut backup.

---

## 3. Konflik

### Port

| Port | Dipakai oleh |
| --- | --- |
| 5173 | Vite dev semua frontend: Catatan, Fitness, Learn, Leveling, Scheduling, FinTrack, Timesheet. Vite akan pindah ke 5174, 5175, dst. kalau bentrok, jadi alamatnya tidak bisa ditebak |
| 3000 | Catatan Malam. Juga default kode Fitness Track (sekarang di-override `.env` ke 3010) |
| 3001 | Learn API |
| 3010 | Fitness Track |
| 3100 | Leveling |

Mode produksi Catatan, Fitness, dan Leveling sudah satu port per aplikasi dan tidak bentrok. Learn, Scheduling, FinTrack, dan Timesheet hanya punya Vite, jadi perlu port tetap dengan `--port X --strictPort` lewat argumen CLI, tanpa ubah kode.

### Variabel `.env` yang sama namanya

- `PORT`: Catatan, Fitness, Learn, Leveling. Aman selama tiap aplikasi membaca `.env` di foldernya sendiri. Jadi masalah kalau digabung jadi satu `.env` root tanpa prefix.
- `DB_PATH`, `ALLOW_LAN`, `BACKUP_FOLDER`: Catatan dan Fitness.
- `SUPABASE_URL`: Scheduling dan Learn, tapi project Supabase-nya **berbeda** (`qrlt…` dan `mpbn…`). FinTrack memakai project ketiga (`sgcy…`) dengan nama `VITE_SUPABASE_URL`.
- `ANTHROPIC_API_KEY`: Learn (server) dan FinTrack (Vercel).

Penting: Node `--env-file` dan Vite sama-sama mengutamakan variabel yang sudah ada di environment proses dibanding isi file `.env`. Jadi runner bisa menyuntik `PORT` dan path per aplikasi tanpa mengubah file `.env` aplikasi.

### Versi runtime dan dependency

- Node: Catatan, Fitness, Leveling minta ≥24 (Leveling ≥24.15). Learn dan Scheduling ditulis untuk 20.19+ tapi lulus di 24.22. **Satu versi untuk semua: Node 24 LTS.**
- Fitness dan Leveling menjalankan `.ts` langsung dengan Node. Scheduling `core/` memakai import tanpa ekstensi, jadi tidak bisa dijalankan Node langsung dan butuh tsx atau bundler.
- Versi yang berbeda antar-aplikasi: Vite 5 (FinTrack) vs 8 (lainnya), vue-router 4 (FinTrack, Learn) vs 5 (Catatan, Fitness, Leveling), TypeScript 5.6 / 5.9 / 6.0, Tailwind hanya di FinTrack, React hanya di Scheduling. Tidak masalah selama tiap aplikasi punya `node_modules` sendiri. **Jadi masalah besar kalau frontend digabung.**
- `learning/web/.npmrc` berisi `legacy-peer-deps=true` untuk bug npm 10.8. Dengan npm 11 mungkin tidak perlu lagi, tapi tidak usah disentuh.

### Hanya jalan di satu OS

| Hal | OS | Dampak |
| --- | --- | --- |
| `GARMIN_BROWSER_PATH` di `.env` Fitness | macOS (Opera GX) | Di Windows harus diganti path `opera.exe` atau dikosongkan (Chrome) |
| `CLAUDE_CLI_PATH` di `.env` Learn | macOS | Di Windows `execFile` tidak bisa menjalankan `claude.cmd` tanpa shell. Pakai `claude.exe` dari installer native |
| `.env.example` Leveling | Windows (`C:/Users/kamu/...`) | Path relatif lebih aman untuk dua OS |
| README Leveling | menyebut Windows 10/11 | Kodenya portable (node-notifier jalan di macOS juga) |
| Perintah firewall di README Catatan dan Fitness | Windows | Tidak relevan, karena akses HP tidak dipakai |
| `commit-bertahap.sh`, `staggered-push.sh` Timesheet | bash | Di Windows butuh Git Bash |
| `npm run garmin:login` | dua OS | Interaktif (menunggu Enter), jadi tidak bisa masuk runner. Tetap perintah terpisah |
| Menghentikan proses anak | Windows | `child.kill()` tidak ikut mematikan cucu proses di Windows. Runner perlu `taskkill /T /F` |

### Penyimpanan browser per origin

Scheduling (sesi Supabase), FinTrack (sesi Supabase), dan Timesheet (URL + `API_KEY`) menyimpan data di `localStorage`. Sekarang mereka semua berjalan di origin yang sama, `localhost:5173`. Begitu semuanya pindah ke gateway `localhost:4000`, origin-nya berubah. Akibatnya kamu perlu **login ulang sekali** di Scheduling dan FinTrack, dan **mengisi ulang Koneksi** di Timesheet. Data di database tidak terpengaruh.

---

## 4. Ketergantungan yang sudah ada

| Dari | Ke | Lewat | Arah |
| --- | --- | --- | --- |
| Leveling | Fitness Track | SQLite read-only | baca |
| Leveling | Catatan Malam | SQLite read-only | baca |
| Leveling | Learn | SQLite read-only (rusak, Learn di Supabase) | baca |
| Leveling | Scheduling | Supabase REST `exp_events` | baca |
| Leveling | FinTrack | Supabase REST | baca |
| Leveling | Timesheet | Google Sheets API | baca |
| Timesheet web | Apps Script | HTTPS + `API_KEY` | baca/tulis |
| Bot Telegram Timesheet | Apps Script | webhook | tulis |
| Bot Telegram FinTrack | Vercel function lalu Supabase (service role) | webhook | tulis |
| FinTrack web | Supabase Edge Function `ai-chat` | HTTPS | baca |
| Learn server | Claude Code CLI / Claude API | proses / HTTPS | - |
| Fitness Track | Garmin Connect | Playwright + profil browser | baca |

Belum ada aplikasi yang menulis ke aplikasi lain. Scheduling sudah dirancang untuk itu (`schedule_items`, `activity_logs`).

---

## 5. Rancangan hubungan antar-aplikasi

### Pola utama

Setelah membaca semuanya, sebagian besar ide awalmu ternyata adalah pola yang sama:

> **Fakta tercatat di aplikasi pemiliknya, lalu item jadwal yang cocok di Scheduling selesai otomatis.**

Garmin mencatat lari, Catatan Malam mencatat entri, Learn mencatat sesi. Ketiganya cukup ditangani **satu modul integrasi** dengan satu aturan pencocokan. Kuncinya adalah field **Tipe aktivitas** (`activity_type`) yang sudah ada di form item dan rutinitas Scheduling. Kamu isi `run_done`, `diary_done`, atau `learn:<id jalur>` di rutinitas, dan integrasi tahu item itu harus dicocokkan ke mana. Tampilan Scheduling tidak berubah sama sekali.

Modul integrasi berjalan di proses baru `hub/` (lihat bagian 6) setiap 10 menit, dan juga sesaat setelah start. Untuk menyelesaikan item, hub memanggil `completeItem` dari `reminder-and-scheduling/core` lewat `SupabaseStore`, dengan login akun yang sama. Jadi aturan Scheduling (status harus `terencana`, satu log per item) tetap dijaga kode Scheduling sendiri. Hub tidak menulis SQL ke tabel Scheduling.

Aturan pencocokan umum:
- Hanya item `terencana`, tanggal 7 hari terakhir sampai hari ini, dan `activity_type` dikenal.
- Satu fakta menyelesaikan paling banyak satu item. Dua item lari di hari yang sama butuh dua aktivitas lari.
- `completedAt` diisi waktu fakta itu terjadi (misalnya jam mulai aktivitas), bukan waktu hub berjalan.
- Log yang dibuat diberi `meta.source` (misalnya `fit`) dan referensi aslinya (misalnya `garminId`), lalu `value`/`unit` diisi nilai nyata (km, menit).
- Idempoten: item yang sudah `selesai` tidak disentuh lagi. Indeks unik `activity_logs_one_per_item` menolak log kedua.
- Item yang kamu tandai `dilewati` atau `digeser` tidak pernah diubah.

Aturan exp ganda untuk Leveling:
- **Satu fakta, satu exp, di aplikasi pemilik fakta.** Lari dapat exp dari Fitness (stamina, termasuk bonus "lari terjadwal" yang sudah ada). Entri malam dapat exp dari Catatan Malam. Menit belajar dapat exp dari Learn.
- Item jadwal yang `activity_type`-nya termasuk tipe terhubung **tidak** memberi exp disiplin, baik diselesaikan otomatis maupun manual. Kalau tidak begitu, satu lari memberi tiga exp: stamina, bonus terjadwal, dan disiplin.

### Daftar hubungan, urut dari manfaat terbesar dibanding usaha

#### H1. Leveling membaca sumber yang sudah siap

- **Manfaat:** besar. Leveling sudah selesai dibangun tapi belum pernah jalan. Empat sumber langsung hidup.
- **Arah:** Fitness, Catatan, Scheduling, FinTrack ke Leveling (baca).
- **Pemicu:** jadwal Leveling yang sudah ada (start, tiap 30 menit, tombol).
- **Data:** SQLite Fitness dan Catatan (read-only), Supabase Scheduling `exp_events`, Supabase FinTrack `transactions`/`budget_allocations`.
- **Ditulis lewat:** tidak menulis.
- **Perubahan di pemilik data:** tidak ada. Hanya `leveling/.env`, dengan path relatif `../fitness-track/data/fitness.db` dan `../catatan-malam/data/catatan.db` supaya jalan di dua OS.
- **Risiko:** FinTrack. Kalau akunmu login lewat Google tanpa password, Leveling butuh service role key FinTrack. Key itu melewati RLS, jadi simpan hanya di `.env`. Timesheet dan Saham dibiarkan mati dulu.

#### H2. Leveling: tipe terhubung tidak memberi exp disiplin

- **Manfaat:** syarat untuk H4–H6. Mencegah exp ganda.
- **Arah:** di dalam Leveling.
- **Data:** `exp_events.activity_type`, kolom ini sudah ada di view.
- **Perubahan:** Leveling saja. Tambah `activity_type` ke `select` di `sources/schedule.ts`, filter dengan daftar baru `disiplin.linkedActivityTypes` di `config/rules.json`, dan satu tes. Sekitar 10 baris.
- **Risiko:** kecil. Exp disiplin lama dari item `run_done` yang kamu centang manual akan hilang di hitung ulang berikutnya. Ini memang perilaku yang diinginkan.

#### H3. Leveling membaca Learn lewat API Learn

- **Manfaat:** besar. Atribut intelek (menit belajar, topik selesai, study case selesai) sekarang tidak bisa terisi sama sekali.
- **Arah:** Learn ke Leveling (baca).
- **Pemicu:** jadwal Leveling.
- **Data:** endpoint baru `GET /api/export` di Learn yang mengembalikan `tracks`, `topics`, `study_cases`, `learning_sessions` apa adanya.
- **Ditulis lewat:** tidak menulis.
- **Perubahan di pemilik data:** Learn +1 route baca, sekitar 15 baris. Leveling: `sources/learn.ts` mengambil baris dari API, bukan dari SQLite. Logika pemetaan event tetap. `LEARN_DB_PATH` diganti `LEARN_API_URL`.
- **Kenapa lewat API, bukan Supabase langsung:** satu-satunya key yang bisa membaca tabel Learn adalah service role key (RLS tanpa policy). Key itu bisa menulis apa saja. Dengan API, key tetap di satu aplikasi dan Leveling benar-benar read-only.
- **Risiko:** Learn harus jalan supaya data terbaru terbaca. Kalau mati, Leveling tetap memakai kejadian terakhir (perilaku bawaan Leveling).

#### H4. Aktivitas Garmin menyelesaikan item latihan (ide awalmu, dipertahankan)

- **Manfaat:** besar. Ini input manual harian yang paling sering. Tanya "sudah selesai?" untuk latihan berhenti muncul.
- **Arah:** Fitness ke Scheduling.
- **Pemicu:** siklus hub tiap 10 menit, membaca aktivitas 7 hari terakhir. Sinkron Garmin tetap seperti sekarang (saat start Fitness, atau tombol).
- **Data:** `GET /api/activities` Fitness. Kalau API mati, hubungan ini dilewati di siklus itu dan dicatat sebagai error.
- **Pencocokan:** `run_done` ke tipe lari (`running`, `treadmill_running`, dst., memakai daftar yang sama dengan `rules.json` Leveling), `strength_done` ke `strength_training`, `swim_done` ke tipe renang.
- **Ditulis lewat:** `completeItem` + `SupabaseStore` Scheduling, login `SCHEDULE_EMAIL`/`SCHEDULE_PASSWORD`.
- **Perubahan di pemilik data:** tidak ada di Fitness maupun Scheduling. Kamu cukup mengisi Tipe aktivitas di rutinitas lari/beban yang sudah ada.
- **Risiko:** item yang masih draf rutinitas (belum diterapkan) tidak punya baris, jadi tidak bisa diselesaikan. Solusinya: terapkan rutinitas per minggu seperti biasa. Opsi tambahan (bisa diputuskan nanti): hub membuat item dari rutinitas dengan `generateWeek` lalu langsung menyelesaikannya.

#### H5. Entri Catatan Malam menyelesaikan pengingat malam (ide awalmu, dipertahankan)

- **Manfaat:** sedang. Pengingat menulis tetap jalan lewat notifikasi Scheduling, dan berhenti menanyakan "sudah selesai?" begitu entri tersimpan.
- **Arah:** Catatan Malam ke Scheduling.
- **Pemicu:** siklus hub.
- **Data:** `GET /api/entries?month=` Catatan Malam (bulan ini dan bulan lalu), dicocokkan dengan `entry_date`.
- **Pencocokan:** `diary_done`, tanggal item = `entry_date`. Karena "malam ini" sebelum 02.00 adalah tanggal kemarin, entri yang ditulis pukul 01.00 tetap menyelesaikan item tanggal kemarin.
- **Ditulis lewat:** `completeItem`.
- **Perubahan di pemilik data:** tidak ada. Pengingatnya sendiri adalah rutinitas harian di Scheduling yang kamu buat (misalnya fixed 21.00, 15 menit, tipe `diary_done`). Ini data, bukan kode.
- **Risiko:** entri yang diisi belakangan (`is_backfilled`) juga menyelesaikan item kemarin. Menurut saya ini benar.

#### H6. Sesi Learn menyelesaikan item belajar (pengganti ide "tadi belajar apa?")

- **Manfaat:** sedang. Satu kali catat (di Learn, lengkap dengan ringkasan dan topik), jadwal ikut tercentang.
- **Arah:** Learn ke Scheduling. **Kebalikan dari ide awalmu.**
- **Pemicu:** siklus hub.
- **Data:** `GET /api/export` dari H3, bagian `learning_sessions`.
- **Pencocokan:** `learn:<trackId>` untuk satu jalur tertentu, atau `learn_done` untuk jalur apa pun, dengan tanggal item = `occurred_at`.
- **Ditulis lewat:** `completeItem`.
- **Perubahan di pemilik data:** tidak ada, selain endpoint dari H3.
- **Risiko:** Learn menghitung minggu dengan tanggal lokal laptop, sedangkan aplikasi lain memakai Asia/Jakarta. Di laptop yang zonanya WIB hasilnya sama.

#### H7. Pola lari Fitness jadi sumber rutinitas lari Scheduling (diubah, prioritas rendah)

- **Manfaat:** kecil. Pola lari jarang berubah, dan sekali isi rutinitas di Scheduling sudah cukup.
- **Arah:** Fitness ke Scheduling.
- **Pemicu:** siklus hub, hanya kalau isi `run_pattern` berubah (dibandingkan hash-nya).
- **Data:** `GET /api/settings` Fitness.
- **Ditulis lewat:** `createTemplate` + `saveTemplates` Scheduling. Template dengan `activity_type = run_done` dianggap milik integrasi. Hari yang tidak ada di pola di-nonaktifkan (`active = false`), tidak dihapus.
- **Perubahan di pemilik data:** tidak ada.
- **Risiko:** `run_pattern` hanya berisi label ("easy", "long run"), tanpa jam dan durasi. Item jadi `flexible` dengan durasi default dari config hub. Hari dipetakan 1–7 (Senin–Minggu) ke 0–6 (Minggu–Sabtu). Perubahan manual di template lari Scheduling akan tertimpa. Usul saya: kerjakan paling akhir, atau lewati.

#### H8. Status hadir Timesheet ke item kerja (pengganti ide "jam kerja sebagai blok tetap", opsional)

- **Manfaat:** kecil.
- **Arah:** Timesheet ke Scheduling.
- **Data:** aksi `month` Apps Script dengan `API_KEY` (URL dan key disimpan di `.env` hub).
- **Pencocokan:** item `work_done`. Hadir Y menyelesaikan item. Sakit, izin, cuti, atau tanggal di tab Libur melewati item (`skipItem`).
- **Perubahan di pemilik data:** tidak ada.
- **Risiko:** sebaiknya mulai hanya dengan "selesai saat hadir". Melewati otomatis lebih berisiko kalau datanya salah.

#### Beranda (halaman baru)

- **Manfaat:** besar untuk dipakai sehari-hari. Satu layar untuk hari ini.
- **Isi per kartu, masing-masing dibaca terpisah:** jadwal hari ini dan item yang perlu dijawab (Scheduling), status jendela menulis dan apakah entri malam ini sudah ada (Catatan), lari minggu ini vs pola dan tidur/RHR 7 hari (Fitness), menit belajar minggu ini vs target per jalur (Learn), level, exp hari ini, dan quest (Leveling), masuk/keluar hari ini (Timesheet), dan status sinkron/error integrasi terakhir.
- **Data:** API tiap aplikasi lewat hub. Scheduling lewat `SupabaseStore` dengan login hub.
- **Perubahan di pemilik data:** tidak ada.
- **Keuangan:** kartu FinTrack (pengeluaran hari ini vs jatah harian) baru bisa kalau ada cara baca server-side: akun dengan password, atau service role key. Saya usulkan kartu ini menyusul setelah H1 jelas.
- **Kalau satu sumber mati:** kartunya menampilkan "tidak bisa dibaca" dengan pesan error, kartu lain tetap tampil.

### Ide awal yang dibuang atau diubah

| Ide awal | Keputusan | Alasan |
| --- | --- | --- |
| Garmin menyelesaikan item latihan | Dipertahankan (H4) | Manfaat terbesar, tanpa ubah kode pemilik |
| Pola lari Fitness jadi satu-satunya sumber jadwal lari | Diubah jadi opsional, prioritas terakhir (H7) | Pola jarang berubah, tidak punya jam/durasi, dan berisiko menimpa editan manual. Manfaatnya kecil dibanding H4 |
| Target jam belajar jadi item jadwal | **Dibuang** | Membagi "5 jam per minggu" ke hari dan jam tertentu itu keputusan pribadi. Rutinitas Scheduling sudah melakukannya kalau kamu isi sekali. Otomasi di sini cuma menebak |
| Item belajar selesai, jawab "tadi belajar apa?", jadi sesi Learn | **Dibuang, diganti H6** | Pertanyaan itu butuh dialog baru di Scheduling, padahal tampilan tidak boleh berubah. Sesi Learn juga wajib ringkasan dan idealnya topik, yang paling enak diisi di Learn. Arah sebaliknya (sesi Learn menyelesaikan item) memberi hasil yang sama tanpa UI baru |
| Pengingat Catatan Malam selesai saat entri tersimpan | Dipertahankan (H5) | Pengingatnya cukup rutinitas Scheduling, tidak perlu kode |
| Jam kerja Timesheet jadi blok tetap | **Dibuang, diganti rutinitas "Kerja" manual + H8 opsional** | `suggestSlots` sudah menghindari item `fixed` yang ada. Rutinitas "Kerja 09.00, 540 menit, fixed" langsung membuat jam kerja terblokir, tanpa kode. Timesheet hanya berisi jam aktual setelah kejadian, jadi tidak membantu merencanakan hari depan |
| Leveling membaca semua sumber tanpa exp ganda | Dipertahankan, dipecah (H1, H2, H3) | Learn perlu adapter baru. Exp ganda dicegah dengan aturan "satu fakta, satu exp" |
| Beranda | Dipertahankan | Halaman baru, tidak menyentuh tampilan lama |

---

## 6. Opsi penggabungan

Masalah dasar yang menentukan pilihan: **semua aplikasi menganggap dirinya ada di root `/`.** Router memakai `createWebHistory()` tanpa base, fetch ke `/api/...`, aset di `/assets/...`, service worker Scheduling dan FinTrack ber-scope `/`. Semua ini bekerja apa adanya kalau tiap aplikasi tetap di origin-nya sendiri, dan rusak kalau dipasang di bawah prefix.

### Opsi A: Gateway dengan prefix route + shell navigasi

Satu reverse proxy di satu port. `/catatan/*` ke Catatan, `/fit/*` ke Fitness, dst. Shell berisi navigasi atas dan `<iframe>` ke `/catatan/`.

- **Kelebihan:** benar-benar satu alamat dan satu origin. Shell bisa membaca URL iframe, jadi deep link (`/catatan/kalender`) bisa disinkronkan ke address bar. Izin notifikasi browser berlaku normal karena satu origin.
- **Kekurangan:** tiap aplikasi harus diubah supaya sadar prefix: `base` di Vite, `createWebHistory(import.meta.env.BASE_URL)`, fetch ke `${BASE_URL}api`, scope service worker, `start_url` manifest PWA. Itu 3–5 tempat di 7 aplikasi. Redirect OAuth Google di FinTrack harus ditambah URL baru di dashboard Supabase.
- **Risiko terhadap tampilan:** kecil tapi nyata. Path aset yang salah (font, ikon Phosphor, favicon, gambar di CSS) langsung terlihat sebagai halaman rusak. Bisa tertangkap screenshot, tapi tiap aplikasi tetap harus disentuh.

### Opsi B: Penyatuan frontend

Frontend Vue (Catatan, Fitness, Learn, Leveling, Timesheet, FinTrack) digabung jadi satu aplikasi Vite dengan router per modul. Scheduling (React) tetap terpisah. Backend tetap terpisah.

- **Kelebihan:** satu build dan satu bundle untuk sebagian besar aplikasi. Navigasi tanpa iframe.
- **Kekurangan:** versi tidak cocok. Vite 5 vs 8, vue-router 4 vs 5, TypeScript 5.6 vs 6, Tailwind hanya di FinTrack. CSS global tiap aplikasi (`style.css` 200–1300 baris dengan selector umum seperti `.page`, `.topbar`, `.tab`) akan saling menimpa. FinTrack punya guard auth global di router. Ini praktis menulis ulang struktur frontend.
- **Risiko terhadap tampilan:** **tinggi.** Bentrok CSS global hampir pasti mengubah tampilan, dan menjaga "sama persis" butuh scoping CSS di semua aplikasi. Bertentangan langsung dengan batasan utama.


### Opsi C: Shell + iframe ke port tiap aplikasi

Setiap aplikasi tetap di port tetapnya sendiri. Proses baru `hub/` di satu port menyajikan shell (bar navigasi + `<iframe>` ke `http://localhost:3000`, `:3010`, dst.), Beranda, dan modul integrasi.

- **Kelebihan:** nol perubahan kode aplikasi untuk penggabungan. Setiap aplikasi tetap bisa dibuka langsung di portnya.
- **Kekurangan:** tiap aplikasi tetap punya alamat sendiri. Address bar hanya menunjukkan alamat shell. Iframe beda origin tidak boleh meminta izin notifikasi (masalah untuk Scheduling), dan login Google FinTrack tidak bisa tampil di iframe. Bentuk ini tidak bisa dideploy ke satu domain tanpa dirombak menjadi Opsi A.
- **Risiko terhadap tampilan:** isi halaman tidak berubah.

### Rekomendasi: Opsi A (diperbarui 19 Oktober 2026)

Rekomendasi awal adalah Opsi C. Setelah kamu menyebut target **semua aplikasi di satu tempat, tanpa port masing-masing, dan nanti dideploy**, rekomendasinya pindah ke **Opsi A**:

1. Hanya Opsi A yang memberi satu alamat dan satu origin. Port internal tetap ada, tapi tidak pernah kamu buka.
2. Bentuk ini sama dengan bentuk deploy ke satu domain nanti (`domain.com/catatan`, `/fit`, dst.). Pekerjaan sekarang tidak terbuang.
3. Masalah Opsi C ikut hilang: notifikasi Scheduling dan sesi login berjalan normal karena semua satu origin.
4. Perubahan per aplikasi kecil, dan hanya di konfigurasi alamat, bukan tampilan. Semua dicek dengan perbandingan screenshot. Opsi B tetap ditolak karena bentrok versi dan CSS.

### Perubahan per aplikasi untuk Opsi A

Proxy di hub **memotong prefix** sebelum meneruskan request. Jadi server Express aplikasi tetap menerima `/api/...` dan `/assets/...` seperti sekarang, dan **tidak ada server yang diubah**. Yang diubah hanya frontend. Base dipasang saat build dengan `vite build --base=/<prefix>/` dari runner, sehingga `npm run dev` per aplikasi tetap jalan di root seperti biasa. Path absolut di `index.html` (favicon, manifest, script) ditulis ulang otomatis oleh Vite saat build.

| Aplikasi | Prefix | Yang diubah |
| --- | --- | --- |
| Catatan Malam | `/catatan/` | `createWebHistory(import.meta.env.BASE_URL)` di `main.ts`, fetch `/api` di `api.ts` jadi `${import.meta.env.BASE_URL}api` |
| Fitness Track | `/fit/` | sama: `main.ts`, `api.ts` |
| Learn | `/learn/` | sama: `main.ts`, `api.ts` |
| Leveling | `/leveling/` | sama: `main.ts`, `api.ts` |
| Scheduling | `/jadwal/` | `register('/sw.js')` di `notify.ts` pakai `BASE_URL`, `start_url`/`scope`/ikon di `manifest.webmanifest` dibuat relatif |
| FinTrack | `/uang/` | router sudah memakai `BASE_URL`. `redirectTo` di `stores/auth.ts` dan `ForgotPasswordPage.vue` ditambah `BASE_URL`, `start_url`/`scope`/ikon manifest PWA di `vite.config.ts` ikut base. Tambah redirect URL `http://localhost:4000/uang/auth/callback` dan `/uang/auth/reset-password` di Supabase Auth → URL Configuration. Deploy Vercel tetap jalan di root, karena base hanya dipasang saat build dari runner |
| Timesheet web | `/timesheet/` | tidak ada. Sudah memakai `base: './'` dan tidak punya router |

### Bentuk teknis

```
cobaconvert/
├── package.json          npm run setup, npm run build, npm start, npm run backup
├── .env.example          port internal, login integrasi, URL dan key Apps Script
├── .env                  (tidak di git)
├── scripts/
│   ├── run.mjs           menjalankan semua bagian, log berlabel per aplikasi
│   └── backup.mjs        backup semua database ke backups/
├── hub/                  gateway, shell, Beranda, integrasi, status
├── backups/              (tidak di git)
├── docs/
└── <tujuh aplikasi, tidak dipindah>
```

Satu alamat yang kamu buka: **`http://localhost:4000`**. Port internal (hanya `127.0.0.1`, tidak perlu dibuka):

| Bagian | Port internal | Cara dijalankan |
| --- | --- | --- |
| Hub (gateway, shell, Beranda, integrasi) | 4000 | `tsx hub/src/index.ts` |
| Catatan Malam | 3000 | `npm start` (setelah build) |
| Learn API | 3001 | `npm start` di `learning/server` |
| Fitness Track | 3010 | `npm start` (setelah build) |
| Leveling | 3100 | `npm start` (setelah build) |
| Learn web, Scheduling, FinTrack, Timesheet | - | Hasil build (`dist/`) disajikan langsung oleh hub sebagai file statis. `/learn/api` diteruskan ke 3001. Proses Vite tidak diperlukan |

- **Satu perintah.** `npm start` di root menjalankan semuanya dengan `scripts/run.mjs`, tanpa dependency baru (`node:child_process`). Di Windows proses dijalankan dengan `shell: true` dan dihentikan dengan `taskkill /T /F`. Kalau satu proses mati, yang lain tetap jalan, log-nya menandai aplikasi itu, dan gateway menampilkan halaman "aplikasi tidak jalan" untuk prefix-nya. `npm run build` membangun semua frontend dengan base masing-masing. `npm run setup` menjalankan `npm install` di setiap folder.
- **Shell.** Bar navigasi tipis di atas, dan iframe **satu origin** di bawahnya. Karena satu origin, shell bisa membaca alamat di dalam iframe. Address bar ikut menunjukkan halaman aktif (`/#/catatan/kalender`), dan link itu bisa dibuka ulang. Setiap aplikasi juga bisa dibuka langsung tanpa shell di `http://localhost:4000/catatan/`.
- **Konfigurasi.** Rahasia tetap di `.env` masing-masing aplikasi. `.env` root hanya untuk hal bersama: port internal, login integrasi hub (`SCHEDULE_*`, `FINANCE_*`), dan URL + `API_KEY` Apps Script Timesheet. Runner menyuntik nilai itu sebagai environment proses, yang otomatis menang atas isi `.env` aplikasi. Path sumber Leveling ditulis relatif (`../fitness-track/data/fitness.db`) supaya jalan di dua OS.
- **Backup.** `npm run backup` ke `backups/<tanggal>/` di root project:
  - SQLite (Catatan, Fitness, Leveling) memakai `backup()` dari `node:sqlite` bawaan Node 24. Aman walaupun database sedang dipakai dan file WAL masih berisi data. Menyalin file mentah bisa kehilangan data: `catatan.db` utama baru 4 KB, isinya kemungkinan masih di WAL.
  - Supabase (Scheduling, Learn, FinTrack) diekspor per tabel ke JSON lewat REST, dengan key dan login yang sudah ada.
  - Timesheet: ekspor JSON per bulan lewat aksi `month` Apps Script. Google Sheets juga punya version history sendiri.
  - Backup otomatis bawaan Catatan dan Fitness tetap jalan, diarahkan ke `backups/catatan-malam` dan `backups/fitness-track` lewat runner.
  - `backups/` masuk `.gitignore`. Catatan: backup di disk yang sama tidak melindungi dari laptop rusak atau hilang. Kalau suatu saat mau aman dari itu, cukup ganti `BACKUP_FOLDER` ke folder Google Drive atau iCloud.
- **Hub.** Node 24 + TypeScript. Dependency baru:
  - `tsx` ^4.23 (sudah dipakai Learn dan Scheduling, mendukung Node 24), supaya bisa mengimpor `reminder-and-scheduling/core` yang import-nya tanpa ekstensi.
  - Express 5 (sama dengan aplikasi lain).
  - Proxy memakai `fetch` bawaan Node dan stream, tanpa library proxy. Versi final dicek kompatibilitasnya sebelum dipasang.
  - `@supabase/supabase-js` diambil dari `node_modules` Scheduling lewat adapter-nya sendiri.
  - Hub hanya mendengarkan di `127.0.0.1`.

### Leveling membaca Timesheet lewat Apps Script (keputusan)

Adapter `leveling/server/src/sources/timesheet.ts` diganti. Sebelumnya membaca Google Sheets API dengan service account, sekarang memanggil aksi `month` Apps Script yang sudah ada dengan `API_KEY`, per bulan sejak bulan pertama yang ada. Ini tidak butuh Google Cloud Console. Service account sebenarnya gratis untuk pemakaian sekecil ini, tapi setupnya tetap tidak perlu. Event yang dihasilkan sama (hari hadir), jadi aturan exp tidak berubah. Variabel `GOOGLE_SA_KEY_PATH` dan `TIMESHEET_SPREADSHEET_ID` diganti `TIMESHEET_API_URL` dan `TIMESHEET_API_KEY`. URL dan key yang sama dipakai H8 dan Beranda.

### Learn dan langganan Claude kalau nanti dideploy

Selama semuanya jalan di laptop, Learn tetap memakai `AI_PROVIDER=cli` dengan langgananmu, tanpa biaya per token. Ini berlaku untuk Opsi A juga, karena hub dan Learn sama-sama di laptop.

Kalau nanti dideploy, ada tiga cara supaya tetap memakai langganan:

1. **Server sendiri (VPS atau mini PC), Claude Code dipasang di server.** Jalankan `claude setup-token` di laptop. Perintah ini membuat token jangka panjang untuk langgananmu, yang memang disediakan untuk pemakaian headless. Isi token itu sebagai `CLAUDE_CODE_OAUTH_TOKEN` di environment server. Learn tetap memanggil `claude -p` seperti sekarang, tanpa ubah kode. Ini tidak bisa di Vercel: function Vercel tidak bisa menjalankan CLI dan punya batas waktu, sementara pembuatan plan bisa lebih dari satu menit.
2. **Antrean, AI tetap di laptop.** Learn versi online menyimpan permintaan plan atau study case sebagai "menunggu". Worker kecil di laptop mengambil antrean itu, menjalankan `claude -p`, lalu menyimpan hasilnya. Hasil baru muncul saat laptop menyala. Butuh perubahan kode Learn (tabel antrean + status di UI), jadi bertentangan dengan "tampilan tidak berubah".
3. **Manual dari sesi Claude Code.** Kamu minta di sini, misalnya "buatkan plan jalur X", lalu hasilnya saya simpan lewat API Learn. Tanpa ubah kode, tapi tidak otomatis.

Usul saya: cara 1 kalau nanti deploy ke server sendiri. Satu catatan: langganan Claude untuk pemakaian pribadi satu orang. Kalau aplikasinya dipakai orang lain, cek dulu ketentuan langganan Anthropic, atau pindah ke mode `api`. Deploy berada di luar tahap 2. Deploy juga butuh login di semua aplikasi, karena sekarang semuanya tanpa login.

---

## 7. Rencana langkah demi langkah (tahap 2, setelah disetujui)

Setiap langkah ditutup dengan: tes aplikasi yang ada, smoke test, screenshot ulang dibandingkan baseline, dan laporan hasil.

0. **Backup dan baseline.**
   - Backup `.env` semua aplikasi dan semua database ke `backups/pra-gabung-<tanggal>/`: SQLite dengan `node:sqlite backup`, Supabase sebagai ekspor JSON.
   - Ambil screenshot baseline setiap halaman utama dengan Playwright, **di alamat aplikasi sekarang** (sebelum ada prefix). Playwright diambil dari `fitness-track/node_modules` dengan `channel: 'chrome'`, tanpa install browser baru. Halaman:
     - Catatan 6, Fitness 9, Learn 5 (pakai id jalur/topik yang ada), Leveling 5,
     - Scheduling 4 layar, FinTrack 7 halaman setelah login, Timesheet 1 (+ layar Koneksi).
   - Viewport tetap, jam dibekukan (`page.clock`) supaya jam dan tanggal di layar tidak membuat beda palsu.
1. **Satu perintah.** `package.json` root, `scripts/run.mjs`, `.env.example` root, port internal tetap, perbaikan host Learn (`127.0.0.1`). Uji `npm start` di macOS. Windows: lihat bagian Verifikasi.
2. **Gateway dan shell.**
   - Base path per aplikasi (tabel di atas).
   - Gateway di hub, shell navigasi.
   - Login ulang sekali di Scheduling dan FinTrack, dan isi ulang Koneksi Timesheet, karena origin berubah ke `localhost:4000`.
   - Screenshot setiap halaman lewat gateway dibandingkan dengan baseline.
   - Uji notifikasi Scheduling, dan login + reset password FinTrack.
3. **Konfigurasi dan backup terpadu.** `scripts/backup.mjs`, arahkan backup bawaan Catatan dan Fitness ke `backups/`, buat `leveling/.env` dengan path relatif. Uji restore satu backup ke file sementara.
4. **Hubungan, satu per satu, urut H1 sampai H8**, masing-masing dengan tes sendiri:
   - H1 Leveling membaca sumber yang siap (config), termasuk FinTrack dengan email/password akunmu.
   - H2 aturan exp untuk tipe terhubung (Leveling + tes).
   - H3 endpoint `GET /api/export` Learn + adapter Leveling (+ tes adapter). Di langkah yang sama, adapter Timesheet Leveling diganti ke Apps Script (+ tes adapter).
   - H4 Garmin ke item latihan. Modul pencocokan di hub + tes unit pencocokan.
   - H5 Catatan Malam ke item `diary_done`.
   - H6 sesi Learn ke item `learn:*`.
   - H7 pola lari Fitness ke rutinitas Scheduling.
   - H8 hadir Timesheet ke item `work_done`. Mulai dengan "selesai saat hadir" saja. Melewati item otomatis saat sakit, cuti, atau libur hanya kalau kamu minta.
   - Semua tes integrasi memakai item uji bertanggal 2099 (cara yang sama dengan tes integrasi Scheduling) dan menghapusnya setelah selesai, kecuali kamu minta dibiarkan.
5. **Beranda.** Halaman pertama shell, termasuk kartu keuangan.
6. **Dokumentasi.** `README.md` root.

---

## 8. Keputusan

| No | Hal | Keputusan |
| --- | --- | --- |
| 1 | Opsi penggabungan | **Opsi A** (satu alamat `localhost:4000` dengan prefix per aplikasi). Deploy menyusul, di luar tahap 2 |
| 2 | Hubungan | **H1–H8** semua |
| 3 | Akun FinTrack | Email/password, sudah ada. Leveling dan Beranda memakai anon key + login, tanpa service role key |
| 4 | Timesheet di Leveling | Lewat Apps Script yang sudah ada, tanpa Google Cloud |
| 5 | Backup | `backups/` di root project |
| 6 | Git | Repo baru di root setelah semua tergabung. Folder `.git` lama `financetracker/` dan `timesheet/` dipindah ke `backups/`, supaya isinya masuk repo baru sebagai file biasa |
| 7 | History FinTrack | **Sudah dibersihkan** (lihat bagian 2). Ganti API key Anthropic menyusul, oleh kamu |

Belum diputuskan: persetujuan untuk mulai tahap 2 dengan rencana di atas.
