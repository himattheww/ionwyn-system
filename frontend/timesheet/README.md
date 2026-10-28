# Timesheet

Web absensi untuk Google Sheets. Datanya ada di Sheets, dan web ini membaca serta menulis lewat Apps Script.

| Bagian | Lokasi |
| --- | --- |
| Tampilan (Vue 3 + Vite) | `frontend/timesheet` |
| Apps Script | `backend/timesheet/Code.gs` |

Lewat Ionwyn, web memanggil Apps Script melalui hub, jadi Koneksi tidak perlu diisi. Data bulan yang terakhir dibuka disimpan di browser, sehingga halaman langsung tampil lalu diperbarui di belakang. Tombol catat baru aktif setelah data terbaru masuk.

## Memperbarui Apps Script

1. Tempel `backend/timesheet/Code.gs` ke project Apps Script, lalu deploy versi baru (Deploy > Manage deployments > edit > New version).
2. Di Script properties ada `API_KEY` berisi string acak panjang. Nilai yang sama dipakai `TIMESHEET_API_KEY` di `.env` root.

## Catatan

- Tab bulan berjalan dibuat otomatis saat pertama diakses: salinan tab `YYYY-MM` terakhir, dengan tanggal dan jumlah baris disesuaikan. Harus ada minimal satu tab `YYYY-MM` sebagai sumber.
- "Hari ini" mengikuti zona Asia/Jakarta.
