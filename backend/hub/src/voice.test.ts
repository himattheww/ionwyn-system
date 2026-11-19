import { describe, expect, it } from 'vitest'
import { findAmount, parseBest, parseCommand, wordsToDigits, type VoiceContext } from './voice.ts'

const ctx: VoiceContext = {
  today: '2026-11-19',
  now: '08:05',
  pos: ['Kos', 'AI subscription', 'Cicilan Garmin', 'Makan', 'Transportasi', 'Kebutuhan pribadi', 'Buffer dadakan'],
  accounts: ['Utama', 'AI', 'Tabungan']
}

const body = (text: string) => {
  const result = parseCommand(text, ctx)
  if (typeof result === 'string') throw new Error(result)
  return result.body
}

describe('findAmount', () => {
  it.each([
    ['makan 25 ribu', 25_000],
    ['makan 25rb', 25_000],
    ['kopi 18k', 18_000],
    ['bensin Rp20.000', 20_000],
    ['bensin 20.000', 20_000],
    ['kos 2,8 juta', 2_800_000],
    ['gaji 9 jt', 9_000_000],
    ['transfer 1.409.167 ke tabungan', 1_409_167],
    ['nabung sejuta', 1_000_000],
    ['makan seribu', 1_000]
  ])('%s', (text, amount) => {
    expect(findAmount(text.toLowerCase())?.amount).toBe(amount)
  })

  it.each(['absen masuk jam 8', 'pulang 17.30', 'lari 5 km', 'jadwal tanggal 25'])('ignores %s', text => {
    expect(findAmount(text)).toBeNull()
  })
})

describe('parseCommand', () => {
  it('reads an expense with pos alias, account and dadakan flag', () => {
    expect(body('Bensin 20 ribu dari Utama')).toMatchObject({ type: 'expense', amount: 20_000, pos: 'Transportasi', account: 'Utama', unplanned: false })
    expect(body('beli obat 35rb dadakan')).toMatchObject({ pos: 'Kebutuhan pribadi', unplanned: true })
    expect(body('makan siang 30 ribu')).toMatchObject({ pos: 'Makan' })
    expect(body('grabfood 45 ribu')).toMatchObject({ pos: 'Makan' })
    expect(body('beli payung 60 ribu')).toMatchObject({ pos: 'lainnya' })
    expect(body('bayar cicilan garmin 1.000.833')).toMatchObject({ pos: 'Cicilan Garmin', amount: 1_000_833 })
  })

  it('reads income and transfers', () => {
    expect(body('gaji 9 juta')).toMatchObject({ type: 'income', category: 'gaji', account: 'Utama' })
    expect(body('dapat freelance 2 juta ke Tabungan')).toMatchObject({ type: 'income', category: 'freelance', account: 'Tabungan' })
    expect(body('transfer 430 ribu ke AI')).toMatchObject({ type: 'transfer', account: 'Utama', to: 'AI' })
    expect(body('nabung 500 ribu')).toMatchObject({ type: 'transfer', to: 'Tabungan' })
    expect(parseCommand('transfer 100 ribu', ctx)).toMatch(/rekening mana/)
    expect(body('Transfer 500.000 dari rekening Tabungan ke rekening utama')).toMatchObject({ type: 'transfer', amount: 500_000, account: 'Tabungan', to: 'Utama' })
    expect(body('pindahkan 200 ribu ke rek AI')).toMatchObject({ account: 'Utama', to: 'AI' })
    expect(parseCommand('Transfer 500.000.000 ke rekening utama', ctx)).toMatch(/Transfer ke Utama dari rekening mana/)
    expect(body('bensin 20 ribu pakai rekening AI')).toMatchObject({ account: 'AI' })
    expect(body('transfer 430 ribu ke rekening artificial intelligence')).toMatchObject({ to: 'AI' })
    expect(body('transfer 430 ribu ke langganan')).toMatchObject({ to: 'AI' })
    expect(parseBest(['transfer 430 ribu ke ayah'], ctx)).toMatch(/rekening mana/)
    expect(parseCommand('transfer 430 ribu ke langganan', { ...ctx, accounts: ['Utama', 'Langganan', 'Tabungan'] })).toMatchObject({ body: { to: 'Langganan' } })
    expect(parseCommand('transfer 430 ribu ke AI', { ...ctx, accounts: ['Utama', 'Langganan', 'Tabungan'] })).toMatchObject({ body: { to: 'Langganan' } })
    const renamed = { ...ctx, accounts: ['Utama', 'Artificial Intelligence', 'Tabungan'] }
    for (const spoken of ['Artificial Intelligence', 'artificial inteligence', 'AI', 'langganan']) {
      expect(parseCommand(`transfer 430 ribu ke rekening ${spoken}`, renamed)).toMatchObject({ body: { to: 'Artificial Intelligence' } })
    }
  })

  it('strips a wake phrase', () => {
    expect(body('Hey Miyon, makan 25 ribu')).toMatchObject({ amount: 25_000, pos: 'Makan' })
  })

  it('reads attendance', () => {
    expect(body('absen masuk')).toEqual({ action: 'entry', date: '2026-11-19', type: 'masuk', time: 8 * 60 + 5 })
    expect(body('pulang jam 5 sore')).toMatchObject({ type: 'keluar', time: 17 * 60 })
    expect(body('pulang 17.30')).toMatchObject({ type: 'keluar', time: 17 * 60 + 30 })
    expect(body('masuk jam setengah 9')).toMatchObject({ type: 'masuk', time: 8 * 60 + 30 })
    expect(body('kemarin pulang jam 18.15')).toMatchObject({ date: '2026-11-18', time: 18 * 60 + 15 })
    expect(body('hari ini sakit')).toMatchObject({ type: 'absen', kind: 'sakit', date: '2026-11-19' })
    expect(body('besok ijin')).toMatchObject({ type: 'absen', kind: 'izin', date: '2026-11-20' })
  })

  it('reads an activity', () => {
    expect(body('Kegiatan: Meeting klien soal invoice')).toMatchObject({ type: 'kegiatan', text: 'Meeting klien soal invoice' })
  })

  it('reads a schedule item', () => {
    expect(body('jadwal lari besok jam 6 pagi')).toEqual({ title: 'Lari', date: '2026-11-20', startTime: '06:00', durationMin: 60, kind: 'fixed', module: 'kesehatan' })
    expect(body('ingatkan bayar kos tanggal 30 selama 15 menit')).toMatchObject({ title: 'Bayar kos', date: '2026-11-30', durationMin: 15, kind: 'flexible', module: 'keuangan' })
    expect(body('jadwal belajar sabtu jam 9')).toMatchObject({ title: 'Belajar', date: '2026-11-21', startTime: '09:00', module: 'belajar' })
  })

  it('explains what it does not understand', () => {
    expect(parseCommand('halo apa kabar', ctx)).toMatch(/Belum paham/)
  })
})

describe('parseBest', () => {
  it('falls back to the first alternative that makes sense', () => {
    const result = parseBest(['makan dua puluh lima', 'makan 25 ribu'], ctx)
    expect(result).toMatchObject({ heard: 'makan 25 ribu', action: { body: { amount: 25_000, pos: 'Makan' } } })
  })

  it('keeps the first error when nothing parses', () => {
    expect(parseBest(['halo', 'apa kabar'], ctx)).toMatch(/Belum paham/)
  })
})

describe('wordsToDigits', () => {
  it.each([
    ['makan dua puluh lima ribu', 'makan 25000'],
    ['kos dua juta delapan ratus ribu', 'kos 2800000'],
    ['bensin seratus lima puluh ribu', 'bensin 150000'],
    ['parkir lima belas ribu', 'parkir 15000'],
    ['nabung sejuta', 'nabung 1000000'],
    ['masuk jam setengah sembilan', 'masuk jam setengah 9'],
    ['makan 25 ribu', 'makan 25 ribu']
  ])('%s', (text, expected) => {
    expect(wordsToDigits(text)).toBe(expected)
  })

  it('feeds spoken numbers into commands', () => {
    expect(body('makan dua puluh lima ribu')).toMatchObject({ amount: 25_000, pos: 'Makan' })
    expect(body('pulang jam lima sore')).toMatchObject({ type: 'keluar', time: 17 * 60 })
  })
})
