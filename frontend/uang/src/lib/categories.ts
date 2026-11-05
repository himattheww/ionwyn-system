export const categoryLabels: Record<string, string> = {
  utama: 'Utama',
  jajan: 'Jajan',
  tabungan: 'Ambil tabungan',
  dana_darurat: 'Ambil dana darurat',
  setor_tabungan: 'Setor tabungan',
  setor_dana_darurat: 'Setor dana darurat',
  gaji: 'Gaji',
  freelance: 'Freelance',
  bisnis: 'Bisnis',
  lainnya: 'Lainnya',
}

export const categoryLabel = (category: string) => categoryLabels[category] ?? category
