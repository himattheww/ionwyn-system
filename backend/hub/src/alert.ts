const sent = new Map<string, number>()

export async function alert(key: string, text: string, quietMin = 30) {
  const token = process.env.ALERT_TELEGRAM_TOKEN
  const chatId = process.env.ALERT_TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  const last = sent.get(key) ?? 0
  if (Date.now() - last < quietMin * 60_000) return
  sent.set(key, Date.now())
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `Ionwyn System\n${text}` }),
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) console.error(`Notifikasi Telegram gagal: HTTP ${res.status}`)
  } catch (error) {
    console.error('Notifikasi Telegram gagal:', (error as Error).message)
  }
}
