const locale = 'id-ID'

export const formatAmount = (value: number) => value.toLocaleString(locale)

export const formatRp = (value: number) => `Rp ${formatAmount(value)}`

export const formatRpAbs = (value: number) => formatRp(Math.abs(value))

export const formatRpRounded = (value: number) => formatRp(Math.round(value))

export const percentOf = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0)

export const cappedPercent = (value: number, total: number) => Math.min(100, percentOf(value, total))
