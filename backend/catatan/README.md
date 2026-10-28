# Catatan Malam

Jurnal malam pribadi. Satu catatan per tanggal, berisi apa yang terjadi, hal baik, pelajaran, dan catatan bebas. Semua tanggal memakai zona Asia/Jakarta.

| Bagian | Lokasi |
| --- | --- |
| Tampilan (Vue 3 + Vite) | `frontend/catatan` |
| Server (Express + Zod) | `backend/catatan/src` |
| Tabel | `entries` di Supabase, migrasi di `supabase/migrations` |

Server dijalankan bersama seluruh sistem dengan `npm start` dari root. Tes jalan lewat `npm test` dan memakai PGlite, jadi tidak menyentuh database asli.

## Aturan waktu

- Catatan baru hanya bisa dibuat pukul 18.00–02.00.
- Sebelum pukul 02.00, "malam ini" berarti tanggal kemarin.
- Selama jendela terbuka, malam sebelumnya masih boleh diisi kalau kosong, dan ditandai "diisi belakangan". Tanggal yang lebih lama ditolak dengan status 422.
- Catatan yang sudah ada bisa dibaca dan diedit kapan saja.

## API

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/api/today` | Tanggal malam ini, status jendela, apakah kemarin kosong, entri terbaru, "Hari ini, dulu" |
| GET | `/api/entries?month=YYYY-MM` | Tanggal yang terisi dalam satu bulan |
| GET | `/api/entries/:date` | Satu catatan |
| PUT | `/api/entries/:date` | Buat atau ubah catatan. 201 kalau baru, 200 kalau diubah, 422 kalau melanggar aturan waktu |
| GET | `/api/lessons?from=&to=` | Kumpulan pelajaran |
| GET | `/api/good-things?from=&to=` | Kumpulan hal baik |
| GET | `/api/search?q=` | Cari kata kunci di semua isian |
