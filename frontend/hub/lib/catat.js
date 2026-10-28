import { sessionState } from './session.js'

if ((await sessionState()) === 'signed-out') location.replace('/masuk/')

const $ = id => document.getElementById(id)
const jakarta = (options) => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta', ...options })

const say = (el, text, ok) => {
  el.textContent = text
  el.classList.toggle('is-ok', ok === true)
  el.classList.toggle('is-bad', ok === false)
}

const amount = $('amount')
amount.addEventListener('input', () => {
  const digits = amount.value.replace(/\D/g, '')
  amount.value = digits ? Number(digits).toLocaleString('id-ID') : ''
})

$('expense').addEventListener('submit', async event => {
  event.preventDefault()
  const form = event.currentTarget
  const status = form.querySelector('.quick-status')
  const value = Number(amount.value.replace(/\D/g, ''))
  if (!value) return say(status, 'Isi nominal dulu.', false)
  const button = form.querySelector('button')
  button.disabled = true
  say(status, 'Menyimpan…')
  try {
    const response = await fetch('/hub/api/quick/expense', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: value, category: form.category.value, note: $('note').value })
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error ?? 'Gagal menyimpan.')
    say(status, `Tersimpan: Rp${value.toLocaleString('id-ID')} (${form.category.value}).`, true)
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
      const response = await fetch('/timesheet/api', {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'entry', date: jakarta().slice(0, 10), type, time: h * 60 + m })
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.error) throw new Error(body.error ?? 'Gagal mengirim absen.')
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

document.getElementById('dateline').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })
