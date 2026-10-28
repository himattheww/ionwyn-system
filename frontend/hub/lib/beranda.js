import { clock, dateTime, escapeHtml as esc, hhmm, hours, longDate, rupiah, shortWeekday, sleep, timeNow } from './format.js'
import { countUp, stagger } from './motion.js'

const $ = id => document.getElementById(id)
const statusTag = { selesai: 'tag-ok', dilewati: 'tag-warn', terencana: '' }

const meter = (value, max) => `<div class="meter"><span style="width:${Math.min(100, max ? (value / max) * 100 : 0)}%"></span></div>`
const failed = card => `<div class="failed"><p>Tidak bisa dibaca: ${esc(card.error)}. Blok lain tetap jalan.</p><button class="btn retry" type="button">Coba lagi</button></div>`
const counted = (value, digits = 0, format = '{}') => `<b data-count="${value}" data-digits="${digits}" data-format="${format}">0</b>`

function stat(label, card, body) {
  const content = !card ? '<div class="skeleton"></div>' : card.ok ? body(card.data) : '<span class="error">tidak terbaca</span>'
  return `<div class="stat reveal"><small>${label}</small><div class="value">${content}</div></div>`
}

function block(index, title, app, card, body) {
  const content = !card ? '<div class="skeleton"></div><div class="skeleton" style="width:60%;margin-top:10px"></div>' : card.ok ? body(card.data) : failed(card)
  return `<section class="block reveal">
    <div class="section-title"><span class="index">${index}</span><h3>${title}</h3><a class="open" href="/#/${app}/" target="_top">Buka</a></div>
    ${content}
  </section>`
}

function renderStrip(cards) {
  $('strip').innerHTML = [
    stat('Lari minggu ini', cards?.fit, d => `${counted(d.runKm, 1)}<i>km</i>`),
    stat('Tidur rata-rata 7 hari', cards?.fit, d => (d.sleepAvg7 == null ? '<b>—</b>' : `<b>${sleep(d.sleepAvg7)}</b>`)),
    stat('Belajar minggu ini', cards?.learn, d => {
      const minutes = d.reduce((sum, t) => sum + t.minutes, 0)
      const target = d.reduce((sum, t) => sum + t.targetMin, 0)
      return `${counted(minutes / 60, 1)}<i>/ ${hours(target)} jam</i>`
    }),
    stat('Pengeluaran hari ini', cards?.uang, d => `<b>${rupiah(d.today)}</b>`),
    stat('Level', cards?.leveling, d => (d ? `${counted(d.level)}<i>${d.levelExp} / ${d.levelNeed} exp</i>` : '<b>—</b>'))
  ].join('')
}

function renderBlocks(cards) {
  $('left').innerHTML = [
    block('01', 'Jadwal hari ini', 'jadwal', cards?.jadwal, d => {
      if (!d.items.length) return '<p class="state">Belum ada jadwal hari ini.</p>'
      const rows = d.items
        .map(i => `<li><time>${hhmm(i.startTime)}</time><span>${esc(i.title)}</span><span class="tag ${statusTag[i.status] ?? ''}">${esc(i.status)}</span></li>`)
        .join('')
      const pending = d.unanswered ? `<p class="note"><span class="tag tag-accent">${d.unanswered} perlu dijawab</span></p>` : ''
      return `<ol class="rows">${rows}</ol>${pending}`
    }),
    block('02', 'Catatan malam', 'catatan', cards?.catatan, d => {
      const state = d.written
        ? '<span class="tag tag-ok">sudah ditulis</span>'
        : d.isOpen
          ? '<span class="tag tag-warn">belum ditulis</span>'
          : '<span class="tag">dibuka pukul 18.00</span>'
      const late = d.yesterdayEmpty && d.isOpen ? '<p class="note">Malam sebelumnya masih kosong dan masih bisa diisi sampai 02.00.</p>' : ''
      return `<div class="pair"><span>Malam ${esc(longDate(d.tonight))}</span>${state}</div>${late}`
    }),
    block('03', 'Lari minggu ini', 'fit', cards?.fit, d => {
      const rows = d.runDays
        .filter(day => day.plan)
        .map(day => `<li><time>${esc(shortWeekday(day.date))}</time><span>${esc(day.plan)}</span><span class="tag ${day.done ? 'tag-ok' : ''}">${day.done ? `${day.km.toLocaleString('id-ID')} km` : 'terencana'}</span></li>`)
        .join('')
      const sync =
        d.sync.last_error_at && (!d.sync.last_success_at || d.sync.last_error_at > d.sync.last_success_at)
          ? `<p class="note state-error">Sinkron Garmin gagal: ${esc(d.sync.last_error)}</p>`
          : `<p class="note">Sinkron Garmin terakhir ${dateTime(d.sync.last_success_at)}</p>`
      return `<ol class="rows">${rows}</ol>${sync}`
    })
  ].join('')

  $('right').innerHTML = [
    block('04', 'Belajar', 'learn', cards?.learn, d => {
      if (!d.length) return '<p class="state">Belum ada jalur aktif.</p>'
      return d
        .map(t => `<div class="track"><div class="pair"><span>${esc(t.goal)}</span><span class="num">${hours(t.minutes)} / ${hours(t.targetMin)} jam</span></div>${meter(t.minutes, t.targetMin)}</div>`)
        .join('')
    }),
    block('05', 'Leveling', 'leveling', cards?.leveling, d => {
      if (!d) return '<p class="state">Belum ada exp tercatat.</p>'
      return `<div class="track"><div class="pair"><span>Level ${d.level} · ${esc(d.tier)}</span><span class="num">${d.levelExp} / ${d.levelNeed}</span></div>${meter(d.levelExp, d.levelNeed)}</div>`
    }),
    block('06', 'Keuangan', 'uang', cards?.uang, d => {
      if (!d.budget) return `<div class="pair"><span>Bulan ini</span><span class="num">${rupiah(d.month)}</span></div><p class="note">Belum ada alokasi budget bulan ini.</p>`
      return `<div class="track"><div class="pair"><span>Bulan ini</span><span class="num">${rupiah(d.month)} / ${rupiah(d.budget)}</span></div>${meter(d.month, d.budget)}</div>`
    }),
    block('07', 'Absensi', 'timesheet', cards?.timesheet, d => {
      if (!d) return '<p class="state">Tidak ada baris untuk hari ini.</p>'
      if (d.holiday) return '<p class="state">Hari libur.</p>'
      const hadir = d.hadir === 'Y' ? '<span class="tag tag-ok">hadir</span>' : d.hadir === 'N' ? `<span class="tag tag-warn">${esc(d.note || 'tidak hadir')}</span>` : '<span class="tag">belum diisi</span>'
      return `<div class="pair"><span>Status</span>${hadir}</div>
        <div class="pair"><span>Masuk</span><span class="num">${clock(d.start)}</span></div>
        <div class="pair"><span>Keluar</span><span class="num">${clock(d.end)}</span></div>`
    })
  ].join('')
}

function renderIntegrations(list) {
  $('integrations').innerHTML = list
    .map(r => {
      const result = r.lastError
        ? `<span class="tag tag-bad">${esc(r.lastError)}</span>`
        : r.lastResult
          ? `<span class="tag tag-ok">${esc(r.lastResult)}</span>`
          : '<span class="tag">belum jalan</span>'
      return `<tr><td><span class="id">${esc(r.id)}</span>${esc(r.label)}</td><td class="num">${dateTime(r.lastRunAt)}</td><td>${result}</td></tr>`
    })
    .join('')
}

function drawSun() {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const f = Math.min(1, Math.max(0, (minutes - 300) / (1380 - 300)))
  const angle = Math.PI * (1 - f)
  const sun = $('sun')
  const x = 85 + 73 * Math.cos(angle)
  const y = 84 - 73 * Math.sin(angle)
  sun.querySelector('.sun-done').style.strokeDasharray = `${f * 100} 100`
  const dot = sun.querySelector('.sun-dot')
  dot.setAttribute('cx', x.toFixed(1))
  dot.setAttribute('cy', y.toFixed(1))
  const label = sun.querySelector('.sun-time')
  label.setAttribute('x', x.toFixed(1))
  label.setAttribute('y', (y - 9).toFixed(1))
  label.textContent = timeNow().replace(':', '.')
}

function render(data) {
  renderStrip(data?.cards)
  renderBlocks(data?.cards)
  stagger()
  if (!data) return
  renderIntegrations(data.integrations)
  countUp()
}

const cacheKey = 'beranda:terakhir'
const todayJakarta = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(cacheKey))
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(data))
  } catch {}
}

async function load() {
  const button = $('refresh')
  button.disabled = true
  const cached = readCache()
  const fresh = cached?.today === todayJakarta() ? cached : null
  render(fresh)
  if (fresh) {
    $('dateline').textContent = `${longDate(fresh.today)} · memperbarui...`
    document.body.classList.add('still')
  }
  const timesheet = fetch('/hub/api/today/timesheet').then(r => r.json())
  try {
    const data = await fetch('/hub/api/today?timesheet=nanti').then(r => r.json())
    data.cards.timesheet = fresh?.cards.timesheet
    $('dateline').textContent = `${longDate(data.today)} · diperbarui ${timeNow()}`
    render(data)
    document.body.classList.add('still')
    data.cards.timesheet = await timesheet.catch(() => ({ ok: false, error: 'Timesheet tidak bisa dihubungi' }))
    renderBlocks(data.cards)
    writeCache(data)
  } catch {
    $('dateline').innerHTML = '<span class="state-error">Hub tidak bisa dihubungi.</span>'
  } finally {
    button.disabled = false
  }
}

$('refresh').addEventListener('click', load)
document.addEventListener('click', event => {
  if (event.target.closest('.retry')) load()
})
drawSun()
setInterval(drawSun, 60_000)
$('run').addEventListener('click', async event => {
  const button = event.currentTarget
  button.disabled = true
  try {
    renderIntegrations(await fetch('/hub/api/integrations/run', { method: 'POST' }).then(r => r.json()))
  } finally {
    button.disabled = false
  }
})

load()
