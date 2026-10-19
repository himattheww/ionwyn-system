# Fitness Track

Aplikasi pribadi untuk memantau latihan dan kondisi badan. Data aktivitas, set latihan beban, tidur, dan RHR diambil dari Garmin Connect. Berat badan, makan, dan catatan kondisi diisi manual.

Satu pengguna, tanpa login, berjalan lokal di laptop.

## Prasyarat

- Node.js 24 LTS
- Google Chrome atau browser berbasis Chromium lain yang terpasang, misalnya Opera GX. Tidak perlu `npx playwright install`. Untuk browser selain Chrome, lihat [Memakai browser selain Chrome](#memakai-browser-selain-chrome).

## Setup

Jalankan semua perintah di folder root project (folder yang berisi `package.json`, `server`, dan `web`).

```powershell
npm install
copy .env.example .env
```

Di macOS atau Linux pakai `cp .env.example .env`.

| Variabel | Default | Fungsi |
| --- | --- | --- |
| `PORT` | `3000` | Port Express |
| `DB_PATH` | `./data/fitness.db` | File SQLite |
| `ALLOW_LAN` | `false` | `true` supaya bisa dibuka dari HP di Wi-Fi rumah |
| `BACKUP_FOLDER` | `./backups` | Folder backup harian |
| `GARMIN_PROFILE_DIR` | `./.garmin-profile` | Profil browser khusus yang menyimpan sesi Garmin |
| `GARMIN_HEADLESS` | `true` | `false` kalau sinkron headless diblokir Garmin |
| `GARMIN_BROWSER_PATH` | kosong | Path executable browser Chromium, misalnya Opera GX. Kosong berarti Chrome di lokasi instalasi default |
| `TARGET_LONG_RUN_KM` | `21` | Garis target di grafik long run |

Path relatif dihitung dari folder root project.

## Menjalankan

Mode pakai sehari-hari, satu port:

```powershell
npm run build
npm start
```

Buka `http://localhost:3000`.

Mode development, dua terminal di folder root:

```powershell
npm run dev:server
```

```powershell
npm run dev:web
```

Buka `http://localhost:5173`. Vite meneruskan `/api` ke Express.

## Login Garmin

```powershell
npm run garmin:login
```

Browser terbuka sebagai jendela biasa dengan profil di `GARMIN_PROFILE_DIR`, tanpa Playwright. Ini penting karena halaman login Garmin terus me-refresh kalau mendeteksi browser yang dikendalikan otomatis.

Login sendiri, termasuk MFA. Setelah dashboard Garmin tampil, kembali ke terminal dan tekan Enter. Script akan menutup browser itu dengan rapi supaya cookie tersimpan. Di Windows, menutup jendela browser juga cukup.

Kode tidak pernah mengetik atau menyimpan username dan password. Yang tersimpan hanya cookie sesi di folder profil.

Jendela login selalu terpisah dari browser harianmu, karena sesi Garmin disimpan di profil khusus. Membuka tab di browser yang sedang dipakai sengaja tidak didukung. Caranya harus mengaktifkan remote debugging di profil harian, yang membuka akses ke semua sesi login lain (email, bank) bagi program lokal mana pun. Chrome 136 ke atas juga sudah memblokir remote debugging di profil default.

Jangan jalankan login saat sinkron sedang berjalan, karena keduanya memakai profil yang sama.

## Memakai browser selain Chrome

Isi `GARMIN_BROWSER_PATH` dengan path executable browser berbasis Chromium. Contoh Opera GX:

| OS | Path |
| --- | --- |
| macOS | `/Applications/Opera GX.app/Contents/MacOS/Opera` |
| Windows | `C:\Users\<nama>\AppData\Local\Programs\Opera GX\opera.exe` |

Di Windows, cek path-nya lewat `opera://about` di Opera GX (baris "Install"). Pakai `opera.exe`, bukan `launcher.exe`. `launcher.exe` langsung keluar setelah membuka proses baru, jadi script tidak bisa menunggu atau menutup browser.

Di macOS sudah dites dengan Opera GX: cookie dari jendela login terbaca oleh sinkron headless. Opera tidak didukung resmi oleh Playwright, jadi kalau suatu saat gagal setelah update Opera, kosongkan `GARMIN_BROWSER_PATH` dan pakai Chrome.

Profil di `GARMIN_PROFILE_DIR` terpisah dari profil Opera GX harianmu. Login Garmin tetap lewat `npm run garmin:login`. Kalau ganti browser, hapus folder profil lalu login ulang, karena format profil antar-browser tidak selalu cocok.

## Cara sinkron bekerja

Garmin tidak menyediakan API resmi untuk pemakaian pribadi. Library tidak resmi juga diblokir sejak Maret 2026. Karena itu sinkron membuka Garmin Connect di browser sungguhan lewat Playwright (flag otomasi dimatikan), lalu memanggil endpoint JSON yang sama dengan yang dipakai web Garmin dari dalam halaman yang sudah login. Ini bukan cara resmi dan bisa rusak kalau Garmin mengubah web-nya.

Alurnya:

1. Buka `https://connect.garmin.com/app/home` memakai profil tersimpan.
2. Tunggu request pertama web Garmin ke `/gc-api/`. Header request itu (CSRF token, `x-app-ver`, dan lainnya) dipakai ulang.
3. Panggil endpoint di bawah satu per satu, jeda 1–2 detik.
4. Simpan setiap respons mentah ke tabel `garmin_raw`, lalu olah ke tabel masing-masing.

Kalau halaman diarahkan ke halaman login, atau Garmin membalas 401/403, status sinkron menjadi "Perlu login ulang: jalankan npm run garmin:login".

Rentang data:

- Sinkron pertama: 90 hari terakhir.
- Sinkron berikutnya: sejak sinkron sukses terakhir dikurangi 3 hari, untuk menangkap koreksi di Garmin.
- Otomatis saat server start kalau sinkron sukses terakhir lebih dari 24 jam lalu. Bisa juga dari tombol "Sinkron sekarang".

Data di-upsert berdasarkan ID aktivitas Garmin atau tanggal, jadi sinkron ulang tidak membuat duplikat. Set latihan beban per aktivitas diganti seluruhnya setiap kali diambil ulang. Tidur dan RHR dari Garmin menimpa isian manual di tanggal yang sama.

### Endpoint yang dipakai

Semua di bawah `https://connect.garmin.com/gc-api`.

| Data | Endpoint |
| --- | --- |
| Daftar aktivitas | `/activitylist-service/activities/search/activities?startDate&endDate&start&limit=100` |
| Set latihan beban | `/activity-service/activity/{activityId}/exerciseSets` |
| Tidur per malam | `/sleep-service/sleep/dailySleepData?date&nonSleepBufferMinutes=60` |
| Display name | `/userprofile-service/socialProfile` |
| RHR per hari | `/userstats-service/wellness/daily/{displayName}?fromDate&untilDate&metricId=60` |

Per 19 Oktober 2026, endpoint aktivitas, tidur, display name, dan RHR sudah terverifikasi dengan akun asli. Endpoint `exerciseSets` belum, karena belum ada aktivitas strength dalam 90 hari terakhir. Kalau sinkron gagal di tahap itu, cek di DevTools tab Network (filter `gc-api`) saat membuka detail aktivitas strength. Kalau path-nya beda, ubah di `server/src/garmin/sync.ts`.

### Umur data mentah

Respons mentah di `garmin_raw` disimpan maksimal 30 hari. Setelah setiap sinkron sukses, respons yang lebih tua dari 30 hari dihapus. Untuk tanggal atau aktivitas yang sama, hanya respons terbaru yang disimpan. Database lalu dipadatkan dengan `VACUUM`.

Respons tidur sekitar 90 KB per malam karena berisi data per menit, jadi tanpa batas ini database dan 30 file backup akan terus membesar. Tabel hasil olahan (aktivitas, tidur, RHR, berat, makan) tidak ikut dihapus dan ukurannya kecil, kurang dari 5 MB untuk 10 tahun.

### Memperbaiki parser tanpa sinkron ulang

Parser ada di `server/src/garmin/parse.ts`. Setelah diperbaiki, jalankan:

```powershell
npm run garmin:reparse
```

Perintah ini mengolah ulang respons terbaru per jenis dan referensi dari `garmin_raw`. Karena data mentah hanya disimpan 30 hari, perbaikan parser hanya berlaku untuk rentang itu. Data yang lebih lama perlu diambil ulang dari Garmin.

## Laporan bulanan

Halaman Laporan menghitung rangkuman per bulan langsung dari tabel hasil olahan, jadi selalu sesuai dengan koreksi data terbaru. Isinya: jumlah sesi dan hari aktif, total durasi, kalori aktivitas, rincian per jenis aktivitas (lari, badminton, renang, dan lainnya), kepatuhan pola lari, long run terjauh, pace tercepat untuk lari minimal 3 km, rata-rata tidur dan RHR, perubahan berat, protein, nasi, serta hari minum alkohol dan sakit. Setiap angka utama dibandingkan dengan bulan sebelumnya.

Kalori adalah kalori total per aktivitas dari Garmin (field `calories`), bukan kalori harian.

Mulai 3 hari sebelum akhir bulan sampai tanggal 3 bulan berikutnya, halaman Ringkasan menampilkan tautan ke laporan bulan itu.

## Akses dari HP

Set `ALLOW_LAN=true` di `.env`, lalu restart server. Server akan mendengarkan di `0.0.0.0`. Pakai ini hanya di Wi-Fi rumah, karena aplikasi tidak punya login.

Izinkan port di Windows Firewall lewat PowerShell yang dibuka sebagai Administrator:

```powershell
New-NetFirewallRule -DisplayName "Fitness Track" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

`-Profile Private` membuat aturan hanya berlaku di jaringan bertipe Private. Pastikan Wi-Fi rumah diset Private di Settings > Network & internet.

Cari IP laptop dengan `ipconfig` (lihat `IPv4 Address`), lalu buka `http://<ip-laptop>:3000` dari HP.

Hapus aturannya kalau tidak dipakai lagi:

```powershell
Remove-NetFirewallRule -DisplayName "Fitness Track"
```

## Backup

Saat start dan setiap jam, server mengecek `BACKUP_FOLDER`. Kalau backup terakhir lebih dari 24 jam lalu, server membuat file baru `fitness-YYYYMMDD-HHMMSS.db` memakai fungsi backup bawaan better-sqlite3. Hanya 30 backup terakhir yang disimpan.

Untuk restore, matikan server, lalu salin file backup ke lokasi `DB_PATH`.

## Tes

```powershell
npm test
npm run typecheck
```

Unit test ada di `server/test`:

- `parse.test.ts`: parser aktivitas, set latihan beban, tidur, dan RHR.
- `stats.test.ts`: format "gerakan N × reps", pencocokan pola lari, rata-rata 7 hari, batas minggu Senin–Minggu di Asia/Jakarta, dan rentang sinkron.
- `store.test.ts`: upsert tanpa duplikat, pembatasan umur data mentah, dan prioritas data Garmin atas data manual.
- `report.test.ts`: rentang bulan, total dan rincian per jenis aktivitas, long run, pace tercepat, kepatuhan pola lari, dan bulan tanpa data.

Fixture JSON di `server/test/fixtures` berisi nilai palsu dengan struktur respons Garmin. Setelah sinkron pertama berhasil, sebaiknya ganti fixture dengan contoh asli dari tabel `garmin_raw`, setelah data pribadinya diganti.

## Struktur

```
server/
  src/
    index.ts        Express, backup terjadwal, sinkron saat start
    api.ts          Endpoint /api dan validasi Zod
    db.ts           Skema SQLite
    stats.ts        Format set, pola lari, rata-rata 7 hari
    report.ts       Laporan bulanan
    dates.ts        Tanggal Asia/Jakarta
    backup.ts       Backup harian
    garmin/
      client.ts     Sesi browser dan pemanggilan endpoint Garmin
      sync.ts       Alur sinkron
      parse.ts      Parser JSON Garmin
      store.ts      Simpan mentah dan upsert
      login.ts      npm run garmin:login
      reparse.ts    npm run garmin:reparse
  test/
web/
  src/
    pages/          Satu file per halaman
    components/     StateView, TrendChart, SyncNotice
```

## Troubleshooting

- **`Perlu login ulang`**: jalankan `npm run garmin:login`, login, tekan Enter di terminal, lalu tekan "Sinkron sekarang".
- **Halaman login Garmin refresh terus**: pastikan memakai `npm run garmin:login` versi terbaru, yang membuka browser biasa tanpa Playwright. Kalau masih terjadi, hapus folder `GARMIN_PROFILE_DIR` lalu login ulang.
- **Sudah login tapi tetap gagal**: Garmin kadang memblokir browser headless. Set `GARMIN_HEADLESS=false`, restart server, lalu sinkron lagi. Jendela browser akan muncul sebentar.
- **`Browser tidak bisa dibuka` atau `Failed to launch`**: browser belum terpasang di lokasi default. Pasang Chrome, atau isi `GARMIN_BROWSER_PATH`.
- **`Failed to launch` dengan `GARMIN_BROWSER_PATH` terisi**: path salah atau mengarah ke launcher. Cek path di `opera://about`.
- **`Missing script: "garmin:login"`**: perintah dijalankan di luar folder project. Pindah dulu ke folder `fitness-track`.
- **Profil sedang dipakai**: selesaikan `garmin:login` (tekan Enter) sebelum sinkron.
- **`Sinkron gagal: Garmin ... HTTP 404`**: endpoint Garmin berubah. Cek tab Network dan perbarui path di `server/src/garmin/sync.ts`.
