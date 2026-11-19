import { sessionState } from './session.js'
import { canListen, send, voiceController } from './voice.js'

if ((await sessionState()) === 'signed-out') location.replace('/masuk/')

const $ = id => document.getElementById(id)
const jakarta = (options) => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta', ...options })

const say = (el, text, ok) => {
  el.textContent = text
  el.classList.toggle('is-ok', ok === true)
  el.classList.toggle('is-bad', ok === false)
}

const voice = voiceController({
  input: $('command-text'),
  mic: $('mic'),
  status: $('command-status'),
  confirm: $('confirm'),
  summary: $('confirm-text'),
  save: $('confirm-save'),
  cancel: $('confirm-cancel')
})

$('command').addEventListener('submit', event => {
  event.preventDefault()
  voice.check($('command-text').value)
})

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
if (target === 'suara') canListen ? voice.speak() : $('command-text').focus()

document.getElementById('dateline').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })
