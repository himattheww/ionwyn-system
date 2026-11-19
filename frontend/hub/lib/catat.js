import { sessionState } from './session.js'

if ((await sessionState()) === 'signed-out') location.replace('/masuk/')

const $ = id => document.getElementById(id)
const jakarta = (options) => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta', ...options })

const say = (el, text, ok) => {
  el.textContent = text
  el.classList.toggle('is-ok', ok === true)
  el.classList.toggle('is-bad', ok === false)
}

async function send(url, type, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': type }, body: JSON.stringify(body) })
  const reply = await response.json().catch(() => ({}))
  if (!response.ok || reply.error) throw new Error(reply.error ?? 'Gagal menyimpan.')
  return reply
}

const native = window.Capacitor?.PluginHeaders?.some(plugin => plugin.name === 'Voice') ?? false
const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition

function listen() {
  if (native) return window.Capacitor.nativePromise('Voice', 'listen', {}).then(result => result.text)
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

const command = $('command-text')
const commandStatus = $('command-status')
const confirmBox = $('confirm')
const mic = $('mic')
let pending = null

function clearPending() {
  pending = null
  confirmBox.hidden = true
}

async function understand(text) {
  clearPending()
  if (!text.trim()) return say(commandStatus, 'Ucapkan atau ketik perintah dulu.', false)
  say(commandStatus, 'Memahami…')
  try {
    const reply = await send('/hub/api/voice/parse', 'application/json', { text })
    pending = reply.action
    say(commandStatus, '')
    $('confirm-text').textContent = pending.summary
    confirmBox.hidden = false
    $('confirm-save').focus()
  } catch (failure) {
    say(commandStatus, failure.message, false)
  }
}

const runners = {
  finance: body => send('/hub/api/quick/expense', 'application/json', body),
  schedule: body => send('/hub/api/schedule', 'application/json', body),
  timesheet: body => send('/timesheet/api', 'text/plain;charset=utf-8', body)
}

$('command').addEventListener('submit', event => {
  event.preventDefault()
  understand(command.value)
})

$('confirm-cancel').addEventListener('click', () => {
  clearPending()
  say(commandStatus, 'Dibatalkan.')
})

$('confirm-save').addEventListener('click', async event => {
  if (!pending) return
  const button = event.currentTarget
  const action = pending
  button.disabled = true
  say(commandStatus, 'Menyimpan…')
  try {
    const reply = await runners[action.kind](action.body)
    clearPending()
    command.value = ''
    say(commandStatus, action.kind === 'timesheet' && reply.message ? reply.message : `Tersimpan: ${action.summary}.`, true)
  } catch (failure) {
    say(commandStatus, failure.message, false)
  } finally {
    button.disabled = false
  }
})

async function speak() {
  if (mic.classList.contains('is-listening')) return
  clearPending()
  mic.classList.add('is-listening')
  say(commandStatus, 'Mendengarkan…')
  try {
    const text = await listen()
    command.value = text
    await understand(text)
  } catch (failure) {
    say(commandStatus, failure.message ?? 'Pengenal suara gagal.', false)
  } finally {
    mic.classList.remove('is-listening')
  }
}

mic.hidden = !(native || Recognition)
mic.addEventListener('click', speak)

const amount = $('amount')
amount.addEventListener('input', () => {
  const digits = amount.value.replace(/\D/g, '')
  amount.value = digits ? Number(digits).toLocaleString('id-ID') : ''
})

async function loadPos() {
  const response = await fetch(`/hub/api/finance?month=${jakarta().slice(0, 7)}`)
  if (!response.ok) return
  const { budgetItems } = await response.json()
  const items = budgetItems.filter(item => item.kind !== 'tabungan')
  const daily = items.find(item => item.kind === 'harian')
  const labels = items.map(item => {
    const label = document.createElement('label')
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'pos', value: item.name, checked: item === daily })
    const span = document.createElement('span')
    span.textContent = item.name
    label.append(input, span)
    return label
  })
  $('pos').querySelector('legend').after(...labels)
}

loadPos().catch(() => {})

$('expense').addEventListener('submit', async event => {
  event.preventDefault()
  const form = event.currentTarget
  const status = form.querySelector('.quick-status')
  const value = Number(amount.value.replace(/\D/g, ''))
  if (!value) return say(status, 'Isi nominal dulu.', false)
  const pos = form.querySelector('input[name="pos"]:checked')?.value ?? 'lainnya'
  const button = form.querySelector('button[type="submit"]')
  button.disabled = true
  say(status, 'Menyimpan…')
  try {
    await send('/hub/api/quick/expense', 'application/json', { amount: value, pos, note: $('note').value })
    say(status, `Tersimpan: Rp${value.toLocaleString('id-ID')} (${pos}).`, true)
    amount.value = ''
    $('note').value = ''
  } catch (failure) {
    say(status, failure.message, false)
  } finally {
    button.disabled = false
  }
})

const time = $('time')
time.value = jakarta({ hour: '2-digit', minute: '2-digit' }).slice(-5)
time.addEventListener('input', () => {
  const digits = time.value.replace(/\D/g, '').slice(0, 4)
  time.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
})

for (const button of document.querySelectorAll('[data-entry]')) {
  button.addEventListener('click', async () => {
    const status = $('absen-status')
    if (!time.checkValidity()) return say(status, 'Isi jam dengan format 08:00.', false)
    const [h, m] = time.value.split(':').map(Number)
    const type = button.dataset.entry
    button.disabled = true
    say(status, 'Mengirim…')
    try {
      const body = await send('/timesheet/api', 'text/plain;charset=utf-8', { action: 'entry', date: jakarta().slice(0, 10), type, time: h * 60 + m })
      say(status, body.message ?? `Absen ${type} ${time.value} tercatat.`, true)
    } catch (failure) {
      say(status, failure.message, false)
    } finally {
      button.disabled = false
    }
  })
}

const target = new URLSearchParams(location.search).get('mode')
if (target === 'uang') amount.focus()
if (target === 'absen') $('absen').scrollIntoView()
if (target === 'suara') native ? speak() : command.focus()

document.getElementById('dateline').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })
