# Leveling

Karakter RPG dari kebiasaan nyata. Exp datang dari aplikasi lain dan dibagi ke lima atribut: stamina, intelek, kebijaksanaan, disiplin, dan kekayaan. Dari situ terbentuk level, tingkatan, kelas, quest mingguan, dan achievement.

| Bagian | Lokasi |
| --- | --- |
| Tampilan (Vue 3 + Vite, orb three.js) | `frontend/leveling` |
| Server (Express + Zod) | `backend/leveling/src` |
| Pembaca sumber data | `backend/leveling/src/sources` |
| Aturan exp | `backend/leveling/config/rules.json` |
| Tes | `backend/leveling/test` |

## Sumber data

| Sumber | Dibaca dari | Catatan |
| --- | --- | --- |
| Fitness | Tabel Fitness di database yang sama | Pola lari dari pengaturan Fitness |
| Catatan Malam | Tabel `entries` | Malam terisi dan yang diisi belakangan |
| Learn | API Learn | Topik selesai dan sesi belajar |
| Timesheet | Apps Script aksi `month` | Hari kerja = hadir dengan jam masuk dan keluar |
| Jadwal | Supabase, view `exp_events` | Hanya status `selesai` |
| Uang | Supabase, `transactions` dan `budget_allocations` | Budget terjaga kalau pengeluaran sebulan ≤ alokasi utama + jajan |
| Cita-cita | Tabel `leveling_wishes` | Exp kecil 100, sedang 300, besar 1000, bebas dari batas harian |
| Saham | Supabase, tabel `STOCK_TABLE` | Mati secara default |

Sumber yang gagal dibaca tetap memakai kejadian terakhir yang tersimpan, jadi exp-nya tidak bertambah tapi juga tidak hilang. Status tiap sumber ada di halaman Sumber.

## Cara hitung

1. Setiap sumber menghasilkan kejadian seragam (`id`, `source`, `type`, `date`, `value`, `meta`). `id` = sumber + referensi asli, jadi hitung ulang tidak membuat duplikat.
2. Kejadian diubah jadi kandidat exp, lalu dipotong batas harian per aturan dan per atribut. Bagian yang terpotong tetap dicatat dan tampil di Riwayat.
3. Quest mingguan dibentuk ulang dari data. Quest selesai memberi exp tanpa batas harian.
4. Level, kelas, subkelas, achievement, dan riwayat dihitung ulang dari awal sampai hari ini.
5. Hasilnya dibandingkan dengan snapshot sebelumnya, dan perubahannya digabung jadi satu notifikasi.

Hitung ulang berjalan setiap 30 menit (cron Supabase), saat server lokal start, dan lewat tombol "Hitung ulang". Riwayat dan rincian exp adalah hasil hitungan, bukan data mentah, jadi tidak perlu dihapus berkala. Menghapusnya hanya akan menurunkan level.

Kalau isi `rules.json` berubah (dicek lewat hash), hitung ulang berjalan tanpa notifikasi dan hasilnya jadi patokan baru.

## Asumsi

- Bonus lari terjauh mingguan diberikan setelah minggu itu selesai, dengan tanggal lari tersebut.
- Streak Catatan Malam putus kalau ada lebih dari 1 hari kosong dalam 7 hari terakhir.
- Badminton, sepeda, jalan kaki, dan aktivitas lain masuk "olahraga lain" (25 exp, maksimal 1 per hari).
