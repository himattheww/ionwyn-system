# Checklist uji manual

Tandai `[x]` kalau lulus. Kalau gagal, catat langkah, hasil yang terjadi, dan hasil yang diharapkan.

## 0. Persiapan

- [ ] `.env` terisi (SUPABASE_URL, SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD)
- [ ] `npm run seed` → "dibuat: 61 item, 27 log"
- [ ] `npm run dev`, buka alamat yang tampil di terminal
- [ ] Sebelum uji notifikasi: izinkan notifikasi di browser (bagian 15)

Data contoh = Oktober 2026. Hari yang sudah lewat berisi selesai/dilewati, hari ini ke depan terencana.

## 1. Login

- [ ] Password salah → pesan error merah, tetap di layar login
- [ ] Email dan password benar → masuk ke jadwal
- [ ] Refresh halaman → tetap login
- [ ] Tombol Keluar → kembali ke layar login
- [ ] Setelah Keluar, buka `/` lagi → tidak ada data tampil

## 2. Kalender

- [ ] Bulan berjalan tampil, Senin di kolom pertama
- [ ] Hari ini bercetak tebal berwarna aksen
- [ ] Hari lampau punya titik hijau (selesai) dan abu (dilewati)
- [ ] Hari mendatang punya titik garis (terencana)
- [ ] Hari dengan lebih dari 4 item menampilkan `+n`
- [ ] Klik tanggal → daftar di bawah berganti ke hari itu
- [ ] Panah ‹ › pindah bulan, titik status ikut muncul di bulan lain
- [ ] Klik tanggal dari bulan sebelah (warna pudar) → pindah ke bulan itu
- [ ] Tombol Kalender menyembunyikan/menampilkan grid
- [ ] Item yang digeser: hanya klon yang bertitik, arsip tidak dihitung

## 3. Tampilan harian

- [ ] Bagian Jadwal terurut berdasarkan jam
- [ ] Bagian Kapan saja memuat item tanpa jam, terpisah dari Jadwal
- [ ] Waktu luang hanya menampilkan celah ≥ 15 menit, dalam 04.00–22.00
- [ ] Hari tanpa jadwal menampilkan "Belum ada jadwal berjam." / "Kosong."
- [ ] ‹ › pindah hari, "Hari ini" muncul saat di hari lain dan kembali ke hari ini
- [ ] Label: Hari ini / Besok / Kemarin / nama hari

## 4. Tambah jadwal

- [ ] Fleksibel tanpa jam → masuk bagian Kapan saja
- [ ] Fleksibel dengan jam → masuk bagian Jadwal sesuai urutan
- [ ] Tetap tanpa jam → error "item fixed wajib punya jam"
- [ ] Durasi 0 atau negatif → error
- [ ] Jam 23:30 + durasi 60 → error "melewati tengah malam"
- [ ] Judul hanya spasi → ditolak
- [ ] Tanggal diganti ke hari lain → item muncul di hari itu, titik kalender bertambah
- [ ] Tipe aktivitas `run_done` terisi → saat Selesai, log bertipe `run_done`
- [ ] Form menutup setelah simpan, daftar langsung terbarui

## 5. Selesai

- [ ] Tombol Selesai → item jadi redup dengan lencana "selesai", tombol aksi hilang
- [ ] Riwayat: muncul satu baris baru (tipe sesuai tipe aktivitas, default `task_done`, ada "dari jadwal")
- [ ] Item selesai tidak bisa diselesaikan lagi (tombol tidak ada)
- [ ] Titik di kalender berubah hijau
- [ ] Supabase → `activity_logs`: tepat satu baris untuk item itu

## 6. Lewati

- [ ] Lencana "dilewati", tombol hilang
- [ ] Tidak ada baris baru di `activity_logs`
- [ ] Titik kalender abu-abu

## 7. Geser

- [ ] Item tetap (fixed) tidak punya tombol Geser
- [ ] Item fleksibel berjam: dialog menampilkan 2–3 slot usulan
- [ ] Slot usulan tidak bentrok dengan item lain dan berada di 04.00–22.00
- [ ] Pilih slot → item lama hilang dari daftar, item baru muncul dengan "digeser 1x"
- [ ] Item kapan-saja: usulan berupa tanggal berikutnya tanpa jam
- [ ] Pilih sendiri (tanggal + jam) → tergeser sesuai pilihan
- [ ] Pilih slot yang sama dengan jadwal sekarang → ditolak
- [ ] Geser sampai ke-3: dialog bertanya Pertahankan / Pecah / Buang
  - [ ] Pertahankan → lanjut ke pilihan slot, hitungan jadi 3x
  - [ ] Pecah → dua item "kapan saja" di tanggal pilihan, item asli hilang
  - [ ] Buang → item jadi dilewati
- [ ] Batal menutup dialog tanpa mengubah apa pun

## 8. Lagi kosong

- [ ] Pilih modul, isi catatan, tekan Lagi kosong → bar berubah menampilkan durasi berjalan
- [ ] Bar menampilkan jumlah item "kapan saja" hari ini
- [ ] Stop → sesi tercatat di Riwayat (tipe `idle`) dengan durasi menit yang masuk akal
- [ ] Refresh saat sesi berjalan → sesi masih terbuka
- [ ] Mulai sesi saat sudah ada yang terbuka (dua tab) → ditolak
- [ ] Saat sesi terbuka dan ada item berjam yang sedang berjalan → muncul peringatan "sudah mulai. Stop kosong?"

## 9. Perlu dijawab

- [ ] Item terencana di hari lampau tampil di bagian "Perlu dijawab" bergaris oranye
- [ ] Item hari ini yang slotnya lewat punya lencana "perlu dijawab"
- [ ] Menjawab (Selesai/Geser/Lewati) → hilang dari bagian itu
- [ ] Status tidak berubah sendiri tanpa jawaban

## 10. Rutinitas

- [ ] Daftar per hari, urut Senin → Minggu
- [ ] Tambah rutinitas fleksibel tanpa jam → tersimpan
- [ ] Tambah rutinitas tetap tanpa jam → error
- [ ] Nonaktifkan → tampil redup "nonaktif"; Aktifkan → kembali normal
- [ ] Hapus → ada konfirmasi; setelah OK hilang dari daftar
- [ ] Item yang sudah dibangkitkan dari rutinitas yang dihapus tetap ada

## 11. Isi dari rutinitas

Prasyarat: ada beberapa rutinitas aktif.

- [ ] Isi minggu ini → membuat item hanya untuk hari ini dan seterusnya (bukan hari lampau)
- [ ] Isi 4 minggu ke depan → jumlah masuk akal (rutinitas × 4 minggu)
- [ ] Tekan lagi → "sudah lengkap", tidak menggandakan
- [ ] Rutinitas nonaktif tidak ikut
- [ ] Item yang sudah digeser ke hari lain tidak dibuat ulang di hari asalnya
- [ ] Menambah rutinitas baru lalu tekan lagi → hanya yang baru yang masuk

## 12. Draf

- [ ] Panel "Rutinitas hari ini belum masuk jadwal" muncul di hari yang punya rutinitas belum terbentuk
- [ ] Panel "Draf besok dari rutinitas" muncul saat melihat hari ini
- [ ] Hapus centang satu item → jumlah di tombol berkurang
- [ ] Tambahkan → hanya yang tercentang masuk, panel hilang
- [ ] Tidak ada panel kalau semua rutinitas sudah masuk

## 13. Salin minggu lalu

- [ ] Menyalin item minggu lalu ke minggu yang sedang dibuka (tanggal +7 hari)
- [ ] Status salinan `terencana`, hitungan geser 0
- [ ] Arsip "digeser" tidak ikut tersalin
- [ ] Tekan lagi → "Tidak ada item baru untuk disalin"

## 14. Riwayat

- [ ] Ringkasan 7 hari dan 30 hari tampil per modul (selesai, dilewati, belum terjawab, menit, persen)
- [ ] Angka cocok dengan titik di kalender untuk rentang itu
- [ ] Filter modul menyaring daftar aktivitas
- [ ] Catat langsung: tipe + nilai + satuan → muncul di daftar tanpa "dari jadwal"
- [ ] Tipe kosong → ditolak; tipe `idle` → ditolak
- [ ] Nilai kosong → tersimpan tanpa satuan

## 15. Pengaturan

- [ ] Ubah ringkasan pagi dan malam → Simpan → "Tersimpan."
- [ ] Refresh → nilai tetap
- [ ] Tombol Aktifkan notifikasi memunculkan prompt izin browser
- [ ] Status izin berubah ke `granted`
- [ ] Mengubah jam tenang memengaruhi usulan slot geser (celah mengikuti jendela baru)

## 16. Notifikasi

Siapkan item berjam dengan mulai ±12 menit dari sekarang.

- [ ] 10 menit sebelum mulai → toast + notifikasi browser "Mulai HH:mm: …"
- [ ] Setelah slot berakhir → "Sudah selesai? …" dengan pilihan sesuai jenis (fixed tanpa Geser)
- [ ] Refresh halaman setelah notifikasi → tidak muncul lagi
- [ ] Tidak dijawab 60 menit → "Belum dijawab: …" tepat sekali
- [ ] Ringkasan pagi: set jam ke 2 menit lagi (sebelum 12.00) → muncul sekali per hari
- [ ] Ringkasan malam: set jam ke 2 menit lagi → memuat item kapan-saja yang belum dijawab dan jumlah draf besok
- [ ] Set jam tenang mencakup waktu sekarang → tidak ada notifikasi
- [ ] Keluar dari jam tenang → notifikasi yang tertunda muncul
- [ ] Banyak notifikasi sekaligus (> 3) → satu notifikasi browser gabungan
- [ ] Toast bisa ditutup dengan ×
- [ ] Pembukaan pertama dengan data contoh → tidak ada banjir "sudah selesai?"

## 17. PWA

- [ ] DevTools → Application → Manifest terbaca, ikon tampil
- [ ] Service worker status `activated`
- [ ] Opsi Install app muncul di Chrome (localhost atau HTTPS)
- [ ] Notifikasi dari PWA yang diinstal tampil, klik membuka aplikasi
- [ ] Catatan: aplikasi tertutup = tidak ada notifikasi (batasan yang diketahui)

## 18. Data dan keamanan

- [ ] Setelah Keluar, request ke tabel tanpa sesi tidak mengembalikan data (RLS)
- [ ] `npm run seed:clear` menghapus hanya data contoh, jadwal buatan sendiri aman
- [ ] Sign up pengguna baru dimatikan di dashboard Supabase
- [ ] `.env` tidak ikut commit (cek `.gitignore`)

## 19. Tampilan

- [ ] Lebar 375px: tidak ada scroll horizontal, tombol bisa ditekan
- [ ] Dark mode terbaca (kontras teks, titik kalender)
- [ ] Dialog geser tidak terpotong di layar kecil
- [ ] Kalender 6 baris tidak menimpa konten di bawahnya

## 20. Perintah otomatis

- [ ] `npm run typecheck` bersih
- [ ] `npm test` hijau (81 tes saat ini)
- [ ] `npm run build` sukses

## Hasil

| Bagian | Lulus | Gagal | Catatan |
|---|---|---|---|
| 1–4 | | | |
| 5–9 | | | |
| 10–14 | | | |
| 15–17 | | | |
| 18–20 | | | |
