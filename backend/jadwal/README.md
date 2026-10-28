# Jadwal

Perencana harian: item tetap (berjam) dan fleksibel ("kapan saja"), rutinitas mingguan, geser jadwal, catat langsung, dan sesi "lagi kosong".

| Bagian | Lokasi |
| --- | --- |
| Tampilan (React + Vite, PWA) | `frontend/jadwal` |
| Logika inti, tanpa UI | `backend/jadwal/core` |
| Penyimpanan Supabase | `backend/jadwal/adapters/supabase` |
| Data contoh | `backend/jadwal/scripts` (`npm run jadwal:seed`) |
| Skema awal | `backend/jadwal/supabase/migrations` |

Logika inti dipakai bersama oleh tampilan dan hub, misalnya untuk integrasi yang menyelesaikan item otomatis dari Garmin, Catatan Malam, Learn, dan Timesheet.

`backend/jadwal/.env` berisi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` untuk build web lokal. Tes unit ikut `npm test`. Tes integrasi menulis ke database asli, jadi hanya dijalankan manual: `cd backend/jadwal` lalu `npx vitest run`.

## Aturan inti

- `fixed` wajib punya jam. `flexible` boleh hanya tanggal.
- Status: `terencana`, `selesai`, `dilewati`, `digeser`.
- Geser hanya untuk `flexible`. Item lama diarsip (`digeser`), item baru dibuat dengan `rescheduledFromId` dan `rescheduleCount + 1`. Geseran ketiga bertanya: pertahankan, pecah, atau buang.
- Selesai menulis tepat satu baris `activity_logs` per item.
- Jam tenang default 22.00–04.00. Ringkasan pagi 04.30, malam 20.30. Semua bisa diubah di Pengaturan.

## Notifikasi

| Notifikasi | Pemicu |
| --- | --- |
| Pengingat | `remindBeforeMin` menit sebelum mulai |
| Tanya selesai | Slot berakhir, sekali |
| Tanya ulang | 60 menit setelah ditanya, sekali |
| Ringkasan pagi dan malam | Sesuai pengaturan |

Notifikasi di web hanya muncul saat halaman terbuka. Notifikasi saat aplikasi tertutup ditangani aplikasi Android.

## Keamanan

Kunci anon ada di bundle web. Isolasi data mengandalkan RLS (`owner = auth.uid()`).
