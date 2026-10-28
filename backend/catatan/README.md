# Catatan Malam

> Sekarang aplikasi ini bagian dari `ionwyn-system`: tampilannya di `frontend/`, servernya di `backend/`, dan semua dependency ada di satu `package.json` root. Install, build, test, dan perintah `npm run ...` dijalankan dari folder root (lihat README utama). Langkah `npm install` per folder di bawah sudah tidak berlaku.

Jurnal malam pribadi. Satu catatan per tanggal, diisi antara pukul 18.00 dan 02.00 (WIB), berisi apa yang terjadi, hal baik, pelajaran, dan catatan bebas.

- `server/` — Express + TypeScript + SQLite (better-sqlite3), validasi dengan Zod
- `web/` — Vue 3 + TypeScript + Vite

Semua perhitungan tanggal memakai zona waktu Asia/Jakarta, apa pun zona waktu laptopnya.

## Prasyarat

- Node.js 24 LTS (`node -v` harus menampilkan `v24.x`)
- better-sqlite3 v13 sudah membawa prebuilt binary untuk Windows x64, jadi tidak perlu Visual Studio Build Tools

## Setup

Jalankan dari folder `catatan-malam`:

```powershell
npm install
copy .env.example .env
```

Di macOS/Linux, ganti `copy` dengan `cp`.

Isi `.env`:

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `PORT` | `3000` | Port server |
| `DB_PATH` | `data/catatan.db` | Lokasi file database. Path relatif dihitung dari folder `catatan-malam` |
| `ALLOW_LAN` | `false` | `true` supaya bisa dibuka dari HP di Wi-Fi yang sama |
| `BACKUP_FOLDER` | kosong | Folder backup. Kosong berarti backup otomatis mati |

## Menjalankan untuk development

Buka dua terminal, keduanya di folder `catatan-malam`:

```powershell
npm run dev:server
```

```powershell
npm run dev:web
```

Buka http://localhost:5173. Vite meneruskan semua request `/api` ke Express di port `PORT`.

Unit test aturan waktu:

```powershell
npm test
```

## Menjalankan untuk produksi

```powershell
npm run build
npm start
```

`npm run build` membangun `web/dist` lalu meng-compile server ke `server/dist`. Setelah itu Express menyajikan aplikasi dan API di satu port: http://localhost:3000.

## Akses dari HP

Aplikasi ini tidak punya login. Siapa pun yang tersambung ke jaringan yang sama bisa membaca dan mengubah catatan. **Aktifkan hanya di Wi-Fi rumah**, jangan di Wi-Fi kantor, kafe, atau hotspot umum.

1. Di `.env`, ubah `ALLOW_LAN=true`, lalu restart server. Server sekarang mendengarkan di `0.0.0.0`, bukan hanya `127.0.0.1`.
2. Saat start, server menampilkan alamat untuk HP, misalnya `Dari HP: http://192.168.1.10:3000`. Bisa juga dicek dengan `ipconfig` (cari "IPv4 Address" di adapter Wi-Fi).
3. Izinkan port di Windows Firewall. Buka PowerShell **sebagai Administrator**:

   ```powershell
   New-NetFirewallRule -DisplayName "Catatan Malam" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
   ```

   Rule ini hanya berlaku di jaringan berprofil **Private**. Pastikan Wi-Fi rumah diset Private di Settings → Network & internet → Wi-Fi → (nama Wi-Fi) → Network profile type. Kalau `PORT` diganti, sesuaikan `-LocalPort`.

4. Dari HP yang tersambung ke Wi-Fi yang sama, buka alamat dari langkah 2.

Untuk menonaktifkan lagi, kembalikan `ALLOW_LAN=false` dan hapus rule firewall-nya:

```powershell
Remove-NetFirewallRule -DisplayName "Catatan Malam"
```

## Backup

Isi `BACKUP_FOLDER` dengan folder yang tersinkron ke cloud, misalnya:

```
BACKUP_FOLDER=C:\Users\Matthew\OneDrive\Backup\catatan-malam
BACKUP_FOLDER=G:\My Drive\Backup\catatan-malam
```

Folder dibuat otomatis kalau belum ada.

- Backup memakai fungsi backup bawaan SQLite lewat better-sqlite3, jadi aman walaupun database sedang dipakai.
- Saat server start, lalu setiap jam, server mengecek backup terakhir. Kalau sudah lebih dari 24 jam, backup baru dibuat.
- Nama file: `catatan-YYYY-MM-DD_HHmmss.db` (jam WIB).
- Hanya 30 backup terbaru yang disimpan. Yang lebih lama dihapus otomatis.

Untuk restore: hentikan server, salin file backup ke lokasi `DB_PATH` (ganti nama menjadi `catatan.db`), hapus file `catatan.db-wal` dan `catatan.db-shm` kalau ada, lalu start server lagi.

## Aturan waktu

- Catatan baru hanya bisa dibuat pukul 18.00–02.00.
- Sebelum pukul 02.00, "malam ini" berarti tanggal kemarin.
- Selama jendela terbuka, catatan untuk satu hari sebelum "malam ini" masih boleh dibuat kalau kosong, dan ditandai "diisi belakangan". Tanggal yang lebih lama ditolak dengan status 422.
- Catatan yang sudah ada bisa dibaca dan diedit kapan saja.

## API

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/api/today` | Tanggal malam ini, status jendela, apakah kemarin kosong, entri terbaru, "Hari ini, dulu" |
| GET | `/api/entries?month=YYYY-MM` | Daftar tanggal terisi dalam satu bulan |
| GET | `/api/entries/:date` | Satu catatan |
| PUT | `/api/entries/:date` | Buat atau ubah catatan. 201 kalau baru, 200 kalau diubah, 422 kalau melanggar aturan waktu |
| GET | `/api/lessons?from=&to=` | Kumpulan pelajaran |
| GET | `/api/good-things?from=&to=` | Kumpulan hal baik |
| GET | `/api/search?q=` | Cari kata kunci di semua isian |
