# Timesheet web

> Sekarang aplikasi ini bagian dari `ionwyn-system`: tampilannya di `frontend/`, servernya di `backend/`, dan semua dependency ada di satu `package.json` root. Install, build, test, dan perintah `npm run ...` dijalankan dari folder root (lihat README utama). Langkah `npm install` per folder di bawah sudah tidak berlaku.

Versi web dari bot timesheet. Membaca dan menulis Google Sheets lewat Apps Script yang sama dengan bot Telegram.

## Menjalankan

Di folder `web`:

```
npm install
npm run dev
```

Build statis ke folder `dist`:

```
npm run build
```

## Menghubungkan ke Apps Script

1. Tempel `Code.gs` terbaru ke project Apps Script, lalu deploy versi baru (Deploy > Manage deployments > edit > New version).
2. Di Script properties tambahkan `API_KEY` berisi string acak panjang. Kunci ini berbeda dari `WEBHOOK_KEY`.
3. Buka web, tekan Koneksi, isi URL web app (berakhiran `/exec`) dan `API_KEY`. Keduanya disimpan di browser ini saja.

## Catatan

- Tab bulan berjalan dibuat otomatis saat pertama diakses: salinan tab `YYYY-MM` terakhir, tanggal dan jumlah baris disesuaikan, kolom rekap bulan baru ditambah. Harus ada minimal satu tab `YYYY-MM` sebagai sumber.
- Tanggal merah diisi manual di tab `Libur` (kolom A, mulai A2). Dipakai rumus rekap, bot, dan web.
- Baris biru: jam kerja bersih lebih dari `OVERTIME_MIN` di `Code.gs`.
