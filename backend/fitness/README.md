# Fitness

Catatan latihan, tidur, pemulihan, berat, makan, dan kalori. Data utama ditarik dari Garmin Connect, lalu dilengkapi isian manual.

| Bagian | Lokasi |
| --- | --- |
| Tampilan (Vue 3 + Vite) | `frontend/fitness` |
| Server (Express + Zod) | `backend/fitness/src` |
| Sinkron Garmin | `backend/fitness/src/garmin` |
| Kualitas udara | `backend/fitness/src/aqi.ts` |
| Strava (pemicu sinkron) | `backend/fitness/src/strava.ts` |
| Tes dan fixture | `backend/fitness/test` |

Semua perintah dijalankan dari folder root.

## Sinkron Garmin

Garmin tidak punya API resmi untuk pemakaian pribadi, jadi sinkron memanggil endpoint JSON yang sama dengan web Garmin Connect. Ada dua jalur:

- **Token** (dipakai di Vercel): token sesi disimpan di database setelah login sekali dari aplikasi Android. Dipakai untuk sinkron terjadwal (08.00, 12.00, 17.00, 20.00 WIB), sinkron dari webhook Strava, detail lap saat aktivitas dibuka, dan backfill.
- **Browser** (lokal): Playwright membuka Garmin Connect dengan profil tersimpan di `GARMIN_PROFILE_DIR`, lalu memanggil endpoint dari dalam halaman yang sudah login.

Respons mentah disimpan di `garmin_raw` maksimal 30 hari, lalu diolah ke tabel masing-masing. Data di-upsert per ID aktivitas atau tanggal, jadi sinkron ulang tidak membuat duplikat. Detail lap per aktivitas diambil saat aktivitas dibuka dan dihapus setelah 30 hari.

| Perintah | Fungsi |
| --- | --- |
| `npm run garmin:login` | Membuka browser biasa untuk login Garmin (termasuk MFA). Kode tidak pernah mengetik atau menyimpan password, hanya cookie di folder profil |
| `npm run garmin:sync` | Sinkron sekarang lewat browser lokal |
| `npm run garmin:reparse` | Mengolah ulang respons mentah setelah parser diperbaiki (`src/garmin/parse.ts`) |
| `npm run garmin:backfill -- <tanggal-mulai>` | Melengkapi aktivitas lama. Tambahkan `harian` untuk tidur, HRV, readiness, dan kalori |

Browser selain Chrome: isi `GARMIN_BROWSER_PATH` dengan executable berbasis Chromium, misalnya `opera.exe` (bukan `launcher.exe`) di Windows. Kalau ganti browser, hapus folder profil lalu login ulang.

## Data per lari

- Tabel lap mengikuti format CSV Garmin. Lap dikelompokkan per langkah workout, dan baris ringkasan memakai total aktivitas.
- Konteks: cuaca dalam Celsius dengan dew point, zona HR dengan batas bpm, sepatu, HR drift (dihitung saat diminta), dan fueling manual.
- AQI menggabungkan stasiun WAQI terdekat (kalau sinkron terjadi dalam 60 menit setelah lari selesai) dan model PM2.5 Open-Meteo yang dirata-rata per menit selama lari. Skala memakai breakpoint EPA 2024. Hanya untuk lari mulai 26 Oktober 2026.

## Environment

Isi `backend/fitness/.env` (lihat `.env.example`). `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN`, dan `WAQI_TOKEN` ada di `.env` root dan di environment Vercel.

## Troubleshooting

- **Perlu login ulang**: jalankan `npm run garmin:login`, login, tekan Enter di terminal, lalu sinkron lagi.
- **Halaman login Garmin refresh terus**: hapus folder `GARMIN_PROFILE_DIR`, lalu login ulang.
- **Sudah login tapi tetap gagal**: Garmin kadang memblokir browser headless. Set `GARMIN_HEADLESS=false`.
- **`Failed to launch`**: browser tidak ada di lokasi default, atau `GARMIN_BROWSER_PATH` salah.
- **HTTP 404 dari Garmin**: endpoint berubah. Cek tab Network (filter `gc-api`) dan perbarui path di `src/garmin`.
