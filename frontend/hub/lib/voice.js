const capacitor = window.Capacitor ?? window.parent?.Capacitor
const native = capacitor?.PluginHeaders?.some(plugin => plugin.name === 'Voice') ?? false
const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition

export const canListen = native || Boolean(Recognition)
export const examples = 'makan 25 ribu · transfer 1 juta ke Tabungan · absen masuk jam 8 · kegiatan meeting klien · jadwal lari besok jam 6 pagi'

export async function send(url, type, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': type }, body: JSON.stringify(body) })
  const reply = await response.json().catch(() => ({}))
  if (!response.ok || reply.error) throw new Error(reply.error ?? 'Gagal menyimpan.')
  return reply
}

export function listen() {
  if (native) return capacitor.nativePromise('Voice', 'listen', {}).then(result => result.text)
  return new Promise((resolve, reject) => {
    const recognition = new Recognition()
    recognition.lang = 'id-ID'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = event => resolve(event.results[0][0].transcript)
    recognition.onerror = event => reject(new Error(event.error === 'not-allowed' ? 'Izin mikrofon ditolak.' : event.error === 'no-speech' ? 'Tidak terdengar apa-apa.' : 'Pengenal suara gagal.'))
    recognition.onend = () => reject(new Error('Tidak terdengar apa-apa.'))
    recognition.start()
  })
}

export async function understand(text) {
  if (!text.trim()) throw new Error('Ucapkan atau ketik perintah dulu.')
  const reply = await send('/hub/api/voice/parse', 'application/json', { text })
  return reply.action
}

const runners = {
  finance: body => send('/hub/api/quick/expense', 'application/json', body),
  schedule: body => send('/hub/api/schedule', 'application/json', body),
  timesheet: body => send('/timesheet/api', 'text/plain;charset=utf-8', body)
}

export async function runAction(action) {
  const reply = await runners[action.kind](action.body)
  return action.kind === 'timesheet' && reply.message ? reply.message : `Tersimpan: ${action.summary}.`
}

export function voiceController({ input, mic, status, confirm, summary, save, cancel, onSaved }) {
  let pending = null

  const say = (text, ok) => {
    status.textContent = text
    status.classList.toggle('is-ok', ok === true)
    status.classList.toggle('is-bad', ok === false)
  }

  const clear = () => {
    pending = null
    confirm.hidden = true
  }

  async function check(text) {
    clear()
    say('Memahami…')
    try {
      pending = await understand(text)
      say('')
      summary.textContent = pending.summary
      confirm.hidden = false
      save.focus()
    } catch (failure) {
      say(failure.message, false)
    }
  }

  async function speak() {
    if (mic.classList.contains('is-listening')) return
    clear()
    mic.classList.add('is-listening')
    mic.setAttribute('aria-pressed', 'true')
    say('Mendengarkan…')
    try {
      const text = await listen()
      input.value = text
      await check(text)
    } catch (failure) {
      say(failure.message ?? 'Pengenal suara gagal.', false)
    } finally {
      mic.classList.remove('is-listening')
      mic.setAttribute('aria-pressed', 'false')
    }
  }

  save.addEventListener('click', async () => {
    if (!pending) return
    const action = pending
    save.disabled = true
    say('Menyimpan…')
    try {
      const message = await runAction(action)
      clear()
      input.value = ''
      say(message, true)
      onSaved?.(action)
    } catch (failure) {
      say(failure.message, false)
    } finally {
      save.disabled = false
    }
  })

  cancel.addEventListener('click', () => {
    clear()
    say('Dibatalkan.')
  })

  mic.hidden = !canListen
  mic.addEventListener('click', speak)

  return { check, speak, clear, say }
}
