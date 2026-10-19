# Leveling

Aplikasi leveling ala RPG untuk satu orang. Exp diambil dari aktivitas yang sudah tercatat di aplikasi lain (Fit Tracker, Catatan Malam, Learn, Timesheet, Scheduling, Keuangan, Saham). Semua sumber hanya dibaca, tidak pernah diubah.

## Prasyarat

- Node.js 24 LTS (minimal 24.15, karena `node-notifier` 11). Server TypeScript dijalankan langsung oleh Node (type stripping), tanpa build.
- Windows atau macOS. Server hanya mendengarkan di `127.0.0.1`.

## Setup

Jalankan dari folder `leveling` (cek dengan `cd`, isinya harus ada `package.json`, `server`, `web`, `config`):

```powershell
npm install
copy .env.example .env
```

Isi `.env`, lalu nyalakan sumber yang mau dipakai dengan `*_ENABLED=true`. `better-sqlite3` 13 sudah membawa binary prebuilt untuk Windows, jadi tidak perlu Visual Studio Build Tools.

## Menjalankan

Development (dua terminal, keduanya di folder `leveling`):

```powershell
npm run dev:server
npm run dev:web
```

Buka http://localhost:5173. Vite meneruskan `/api` ke Express di port `PORT` (default 3100).

Produksi:

```powershell
npm run build
npm start
```

Buka http://127.0.0.1:3100.

## Perintah lain

```powershell
npm test
npm run typecheck
```

## Sumber data

| Sumber | Akses | Catatan |
|---|---|---|
| Fit Tracker | SQLite read-only `FIT_DB_PATH` | Pola lari dari `settings.run_pattern`, kunci 1 = Senin sampai 7 = Minggu |
| Catatan Malam | SQLite read-only `DIARY_DB_PATH` | `entries.entry_date`, `is_backfilled` |
| Learn | API Learn `GET /api/export` di `LEARN_API_URL` | Jalur, topik, study case, dan sesi. Learn harus jalan |
| Timesheet | Apps Script aksi `month` di `TIMESHEET_API_URL` dengan `TIMESHEET_API_KEY` | Hari kerja = Hadir Y dengan jam masuk dan keluar. Bulan yang sudah lewat disimpan sebagai cache di memori |
| Scheduling | Supabase REST, view `exp_events` | Hanya status `selesai` |
| Keuangan | Supabase REST, `transactions` dan `budget_allocations` | Budget terjaga: pengeluaran sebulan ≤ `utama_amount + jajan_amount` |
| Saham | Supabase REST, tabel `STOCK_TABLE` | Butuh kolom `id` dan `STOCK_DATE_COLUMN` |

Supabase: isi `*_SUPABASE_KEY` dengan anon key, plus `*_EMAIL` dan `*_PASSWORD` akun kamu supaya RLS mengizinkan baca. Kalau login lewat Google (tanpa password), isi key dengan service role key dan kosongkan email. Service role key melewati RLS, jadi simpan hanya di `.env`.

Timesheet: isi URL web app Apps Script (berakhiran `/exec`) dan `API_KEY` yang sama dengan isian Koneksi di web Timesheet. Tidak perlu Google Cloud.

Sumber yang mati atau gagal dibaca tetap memakai kejadian terakhir yang tersimpan, jadi exp-nya tidak bertambah tapi juga tidak hilang. Status dan error terlihat di halaman Sumber.

## Aturan

Semua angka ada di `config/rules.json`. Server membaca file ini setiap hitung ulang. Kalau isinya berubah (dicek lewat hash SHA-256), hitung ulang berjalan tanpa notifikasi dan hasilnya jadi patokan baru.

Yang perlu diisi sendiri:

- `intelek.trackCategories`: ID jalur Learn ke `pemrograman`, `bahasa`, atau `lainnya`. Contoh `{ "1": "pemrograman", "4": "bahasa" }`.
- `intelek.doneStatuses`: nilai status topik/study case yang dianggap selesai. Default `selesai` dan `2` (urutan enum kalau EF Core menyimpan enum sebagai angka).
- `stamina.activityTypes.ignore`: tipe aktivitas Garmin yang tidak dihitung, misalnya `walking`.

## Cara hitung

1. Setiap adapter menghasilkan kejadian seragam (`id`, `source`, `type`, `date`, `value`, `meta`). `id` = sumber + referensi asli, jadi hitung ulang tidak membuat duplikat.
2. Kejadian diubah jadi kandidat exp, lalu dipotong batas harian per aturan dan per atribut. Bagian yang terpotong disimpan dan tampil di Log exp.
3. Quest mingguan dibentuk ulang dari data. Quest selesai memberi exp tanpa terkena batas harian.
4. Level, kelas, subkelas, achievement, dan riwayat dihitung ulang dari awal sampai hari ini.
5. Hasilnya dibandingkan dengan snapshot sebelumnya. Semua perubahan digabung jadi satu notifikasi (toast di aplikasi dan notifikasi desktop).

Hitung ulang berjalan saat server start, setiap 30 menit, dan lewat tombol "Hitung ulang" di halaman Sumber. Database `data/leveling.db` bisa dihapus kapan saja karena bisa dibangun ulang dari sumber.

## Asumsi

- Bonus lari terjauh mingguan diberikan setelah minggu itu selesai (Senin berikutnya), dengan tanggal lari tersebut.
- Streak Catatan Malam = jumlah malam terisi. Streak putus kalau ada lebih dari 1 hari kosong dalam 7 hari terakhir.
- Tanggal topik Learn selesai: kolom `CompletedAt`/`UpdatedAt` kalau ada, kalau tidak sesi terakhir topik itu, kalau tidak tanggal jalur dibuat.
- Badminton, sepeda, jalan kaki, dan aktivitas lain masuk "olahraga lain" (25 exp, maksimal 1 per hari).

## Troubleshooting

- `File database tidak ditemukan`: cek path di `.env`. Pakai `/` atau `\\` di path Windows.
- `Tabel tracks tidak ditemukan`: pesan error menampilkan tabel yang ada di database Learn. Pastikan path menunjuk ke database Learn yang benar.
- `Login Supabase gagal (400)`: email/password salah atau akun login lewat Google. Pakai service role key.
- Notifikasi desktop tidak muncul: cek Focus Assist / Do Not Disturb di Windows, atau set `DESKTOP_NOTIFICATION=false`.
