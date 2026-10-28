# Reminder & Scheduling

> Sekarang aplikasi ini bagian dari `ionwyn-system`: tampilannya di `frontend/`, servernya di `backend/`, dan semua dependency ada di satu `package.json` root. Install, build, test, dan perintah `npm run ...` dijalankan dari folder root (lihat README utama). Langkah `npm install` per folder di bawah sudah tidak berlaku.

Modul jadwal harian satu pengguna: jadwal manual, rutinitas mingguan, pengingat, geser, dan catatan realisasi (ActivityLog) yang bisa dibaca modul lain.

## Struktur

```
core/       logika murni TypeScript, tanpa I/O (dipakai web dan nanti Android)
adapters/   SupabaseStore: implementasi interface Store
web/        React + Vite, PWA
supabase/   migration SQL
```

## Prasyarat

- Node 20.19+ (dipakai: 20.20.2)
- Project Supabase dengan migration di `supabase/migrations/` sudah diterapkan, urut
- Satu user di Authentication → Users (Auto Confirm dicentang)

## Setup

Dari root project:

```bash
npm install
cp .env.example .env
```

Isi `.env`:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
TEST_EMAIL=
TEST_PASSWORD=
```

`TEST_*` hanya dipakai tes integrasi dan tidak masuk bundle web.

## Perintah

```bash
npm run dev        # web di http://localhost:5173
npm run build      # hasil di dist/
npm test           # unit + integrasi (integrasi jalan kalau .env lengkap)
npm run typecheck
```

Tes integrasi memakai tanggal 2099-01-05 dan menghapus baris yang dibuatnya.

## Aturan inti

- `fixed` wajib punya jam. `flexible` boleh hanya tanggal ("kapan saja").
- Status: `terencana`, `selesai`, `dilewati`, `digeser`.
- Geser hanya untuk `flexible`. Item lama diarsip (`digeser`), item baru dibuat dengan `rescheduledFromId` dan `rescheduleCount + 1`.
- Geseran ketiga bertanya: pertahankan, pecah, atau buang.
- Selesai menulis tepat satu baris `activity_logs` (unik per `item_id`).
- Sesi "lagi kosong" = baris `activity_logs` `type = 'idle'`, satu yang terbuka sekaligus.
- Jam tenang default 22.00–04.00. Ringkasan pagi 04.30, malam 20.30. Semua bisa diubah di Pengaturan.

## Notifikasi

| Notifikasi | Pemicu |
|---|---|
| Pengingat | `remindBeforeMin` menit sebelum mulai |
| Tanya selesai | slot berakhir, sekali |
| Tanya ulang | 60 menit setelah ditanya, sekali |
| Ringkasan pagi | `morningSummary` sampai tengah hari |
| Ringkasan malam | `eveningSummary` (item "kapan saja" dan draf besok) |

Item yang tidak dijawab tidak berubah status otomatis. Item tampil sebagai "Perlu dijawab" sampai dijawab.

Batasan: notifikasi dihitung di klien dan hanya muncul saat web atau PWA terbuka. Notifikasi yang sampai saat aplikasi tertutup butuh push server atau notifikasi lokal Android (lihat di bawah).

## Data untuk modul lain

Modul lain membaca lewat Supabase (REST/JS client) dengan sesi user yang sama. RLS memastikan hanya baris milik pemilik yang terbaca.

| Sumber | Isi | Dipakai untuk |
|---|---|---|
| `activity_logs` | realisasi: `module`, `type`, `occurred_at`, `value`, `unit`, `meta`, `item_id` | riwayat kesehatan (mis. `run_done`), riwayat belajar, sumber exp |
| `exp_events` (view) | item selesai, dilewati, atau terencana beserta `date`, `module`, `reschedule_count` | exp: selesai = `status = 'selesai'`; tidak selesai = `dilewati` atau `terencana` dengan `date` lampau |
| `schedule_items` | rencana | modul lain bisa menulis item (`module`, `kind`, `date`, `start_time`, `duration_min`); otomatis ikut diingatkan |

Konvensi `activity_logs.type`: `task_done` (default), `run_done` (item dengan `activity_type = 'run_done'`), `idle`, atau tipe bebas dari "Catat langsung". Log dari jadwal punya `item_id`; log manual punya `meta.source = 'manual'`.

Belum ada: saran "lanjut materi berikutnya" (versi awal hanya riwayat) dan modul leveling.

## Android

PWA sudah siap diinstal (`web/public/manifest.webmanifest`, `sw.js`, `icon.svg`). Syarat: halaman dilayani lewat HTTPS.

1. `npm run build`, taruh `dist/` di hosting statis (variabel `SUPABASE_URL` dan `SUPABASE_ANON_KEY` harus ada saat build).
2. Buka di Chrome Android → menu → Install app.
3. Untuk notifikasi saat aplikasi tertutup: bungkus dengan Capacitor dan jadwalkan notifikasi lokal dari jam item. Logika di `core/` dipakai ulang tanpa perubahan.

## Keamanan

- Kunci anon ada di bundle web. Isolasi data mengandalkan RLS (`owner = auth.uid()`).
- Matikan "Allow new users to sign up" di dashboard Supabase karena aplikasi ini satu pengguna.
- `.env` tidak boleh masuk git (sudah di `.gitignore`).
