export const categoryLabels: Record<string, string> = {
  utama: 'Utama',
  jajan: 'Jajan',
  tabungan: 'Tabungan',
  dana_darurat: 'Dana darurat',
  gaji: 'Gaji',
  freelance: 'Freelance',
  bisnis: 'Bisnis',
  lainnya: 'Lainnya',
}

export const categoryLabel = (category: string) => categoryLabels[category] ?? category
