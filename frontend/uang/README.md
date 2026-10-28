# Uang

Keuangan pribadi: transaksi, alokasi budget bulanan (utama dan jajan), target tabungan, dan uang saku harian tetap.

| Bagian | Lokasi |
| --- | --- |
| Tampilan (Vue 3 + Vite + Tailwind + Pinia) | `frontend/uang` |
| Data | Supabase langsung dari browser, dibatasi RLS per pemilik |

Tidak ada server sendiri. Login memakai sesi Supabase yang sama dengan Jadwal.

- Uang saku harian = alokasi bulan ini dibagi jumlah hari. Dashboard menampilkan "Sudah menabung/defisit bulan ini sebesar" dari selisih jatah dan pengeluaran sampai kemarin.
- Saat build, `frontend/uang/.env` (lokal) atau environment Vercel perlu `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
- Ringkasan bulan untuk Beranda dan Claude dibaca hub lewat `/hub/api/finance`.
