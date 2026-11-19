const capacitor = window.Capacitor ?? window.parent?.Capacitor
const native = capacitor?.PluginHeaders?.some(plugin => plugin.name === 'Voice') ?? false
const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
const blockedBrowser = /\bOPR\/|\bOPT\//.test(navigator.userAgent) || 'brave' in navigator
const unsupported = 'Browser ini tidak mendukung pengenal suara. Pakai Chrome atau Edge, atau ketik perintahnya.'

export const canListen = native || (Boolean(Recognition) && !blockedBrowser)
export const examples = 'makan 25 ribu · transfer 1 juta ke Tabungan · absen masuk jam 8 · kegiatan meeting klien · jadwal lari besok jam 6 pagi'

export async function send(url, type, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': type }, body: JSON.stringify(body) })
  const reply = await response.json().catch(() => ({}))
  if (!response.ok || reply.error) throw new Error(reply.error ?? 'Gagal menyimpan.')
  return reply
}

let hintList
const hints = () => (hintList ??= fetch('/hub/api/voice/hints').then(r => (r.ok ? r.json() : { hints: [] })).then(r => r.hints).catch(() => []))

let stopCurrent = null

export function stopListening() {
  stopCurrent?.()
}

async function listenNative(onUpdate) {
  const handle = capacitor.addListener('Voice', 'voice', data => onUpdate(data))
  stopCurrent = () => capacitor.nativePromise('Voice', 'stop', {})
  try {
    const result = await capacitor.nativePromise('Voice', 'listen', { hints: await hints() })
    return { text: result.text, alternatives: result.alternatives ?? [result.text] }
  } catch (failure) {
    throw new Error(failure?.message ?? 'Pengenal suara gagal.')
  } finally {
    stopCurrent = null
    handle.remove()
  }
}

const webErrors = {
  'not-allowed': 'Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini di pengaturan browser.',
  'no-speech': 'Tidak terdengar apa-apa. Coba lagi dan bicara lebih dekat ke mikrofon.',
  'audio-capture': 'Mikrofon tidak ditemukan.',
  aborted: 'Berhenti mendengarkan.',
  network: unsupported,
  'service-not-allowed': unsupported,
  'language-not-supported': unsupported
}

function listenWeb(onUpdate) {
  return new Promise((resolve, reject) => {
    const recognition = new Recognition()
    recognition.lang = 'id-ID'
    recognition.interimResults = true
    recognition.maxAlternatives = 5
    let started = false
    let done = false
    const end = (fn, value) => {
      if (done) return
      done = true
      clearTimeout(timer)
      stopCurrent = null
      fn(value)
    }
    const timer = setTimeout(() => {
      if (started) return
      recognition.abort()
      end(reject, new Error(unsupported))
    }, 5000)
    stopCurrent = () => recognition.stop()
    recognition.onstart = () => {
      started = true
      onUpdate({ stage: 'ready' })
    }
    recognition.onspeechend = () => onUpdate({ stage: 'thinking' })
    recognition.onresult = event => {
      const result = event.results[event.results.length - 1]
      if (!result.isFinal) return onUpdate({ stage: 'partial', text: result[0].transcript })
      end(resolve, { text: result[0].transcript, alternatives: Array.from(result, alt => alt.transcript) })
    }
    recognition.onerror = event => end(reject, new Error(webErrors[event.error] ?? 'Pengenal suara gagal.'))
    recognition.onend = () => end(reject, new Error(webErrors['no-speech']))
    recognition.start()
  })
}

export function listen(onUpdate = () => {}) {
  if (native) return listenNative(onUpdate)
  if (!canListen) return Promise.reject(new Error(Recognition ? unsupported : 'Browser ini tidak punya pengenal suara. Pakai Chrome atau Edge, atau ketik perintahnya.'))
  return listenWeb(onUpdate)
}

export async function understand(text, alternatives = []) {
  if (!text.trim()) throw new Error('Ucapkan atau ketik perintah dulu.')
  return send('/hub/api/voice/parse', 'application/json', { text, alternatives: alternatives.filter(alt => alt && alt !== text).slice(0, 5) })
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

function element(tag, className, text) {
  const node = document.createElement(tag)
  node.className = className
  if (text) node.textContent = text
  return node
}

export function voiceController({ input, mic, status, confirm, summary, save, cancel, onSaved, onListening }) {
  let pending = null
  let listening = false

  const live = element('div', 'voice-live')
  const dot = element('span', 'voice-dot')
  const stage = element('p', 'voice-stage')
  const partial = element('p', 'voice-partial')
  const level = element('span', 'voice-level')
  const levelBar = element('span', '')
  const stop = element('button', 'btn voice-stop', 'Selesai bicara')
  stop.type = 'button'
  level.append(levelBar)
  const words = element('div', '')
  words.append(stage, partial)
  live.append(dot, words, level, stop)
  live.hidden = true

  const choices = element('div', 'voice-choices')
  choices.hidden = true
  status.after(live, choices)

  const say = (text, ok) => {
    status.textContent = text
    status.classList.toggle('is-ok', ok === true)
    status.classList.toggle('is-bad', ok === false)
  }

  const clear = () => {
    pending = null
    confirm.hidden = true
    choices.hidden = true
    choices.replaceChildren()
  }

  function showChoices(heard, alternatives) {
    const others = [...new Set(alternatives)].filter(alt => alt && alt !== heard).slice(0, 3)
    if (!others.length) return
    choices.append(element('span', 'voice-choices-label', 'Bukan itu? Pilih yang benar:'))
    for (const alt of others) {
      const button = element('button', 'voice-choice', alt)
      button.type = 'button'
      button.addEventListener('click', () => {
        input.value = alt
        check(alt)
      })
      choices.append(button)
    }
    choices.hidden = false
  }

  async function check(text, alternatives = []) {
    clear()
    say('Memahami…')
    try {
      const reply = await understand(text, alternatives)
      pending = reply.action
      if (reply.heard && reply.heard !== input.value) input.value = reply.heard
      say('')
      summary.textContent = pending.summary
      confirm.hidden = false
      showChoices(reply.heard ?? text, [text, ...alternatives])
      save.focus()
    } catch (failure) {
      say(failure.message, false)
      showChoices(text, alternatives)
    }
  }

  function setListening(on) {
    listening = on
    live.hidden = !on
    mic.classList.toggle('is-listening', on)
    mic.setAttribute('aria-pressed', String(on))
    mic.setAttribute('aria-label', on ? 'Berhenti mendengarkan' : 'Bicara')
    onListening?.(on)
    if (on) {
      stage.textContent = 'Menyiapkan mikrofon…'
      partial.textContent = ''
      levelBar.style.width = '0%'
      live.dataset.stage = 'starting'
    }
  }

  function update({ stage: next, text, level: value }) {
    if (next === 'ready') {
      stage.textContent = 'Bicara sekarang…'
      live.dataset.stage = 'ready'
    }
    if (next === 'partial') {
      partial.textContent = text
      live.dataset.stage = 'ready'
    }
    if (next === 'thinking') {
      stage.textContent = 'Memproses suara…'
      live.dataset.stage = 'thinking'
    }
    if (next === 'level') levelBar.style.width = `${Math.round(value * 100)}%`
  }

  async function speak() {
    if (listening) return stopListening()
    clear()
    say('')
    setListening(true)
    try {
      const { text, alternatives } = await listen(update)
      setListening(false)
      input.value = text
      await check(text, alternatives)
    } catch (failure) {
      setListening(false)
      say(failure.message ?? 'Pengenal suara gagal.', false)
    }
  }

  stop.addEventListener('click', stopListening)

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

  mic.addEventListener('click', speak)

  return { check, speak, clear, say, stop: stopListening }
}
