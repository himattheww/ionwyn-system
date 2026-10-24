import { sessionState, signOut } from './session.js'

const frame = document.getElementById('frame')
const nav = document.getElementById('apps')
const newTab = document.getElementById('newtab')

const home = '/beranda/'
const target = () => location.hash.slice(1) || home

function framePath() {
  try {
    const { pathname, search, hash } = frame.contentWindow.location
    return pathname === 'blank' ? null : pathname + search + hash
  } catch {
    return null
  }
}

function highlight(path) {
  const prefix = path.split('/')[1]
  for (const link of nav.querySelectorAll('a')) {
    const active = link.dataset.prefix === prefix
    link.classList.toggle('active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
  newTab.href = path
  if (prefix === 'beranda' || !prefix) delete document.documentElement.dataset.suasana
  else document.documentElement.dataset.suasana = prefix
}

function open() {
  const path = target()
  if (framePath() !== path) {
    frame.classList.add('loading')
    frame.src = path
  }
  highlight(path)
}

function sync() {
  const path = framePath()
  if (!path || path === target()) return
  history.replaceState(null, '', `#${path}`)
  highlight(path)
}

function syncTitle() {
  try {
    const title = frame.contentDocument.title
    document.title = title && title !== 'Beranda' ? `${title} · Ionwyn` : 'Ionwyn'
  } catch {
    document.title = 'Ionwyn'
  }
}

async function loadApps() {
  const apps = await fetch('/hub/api/apps').then(r => r.json())
  for (const app of apps) {
    const link = document.createElement('a')
    link.href = `#/${app.prefix}/`
    link.dataset.prefix = app.prefix
    link.textContent = app.label
    nav.append(link)
  }
  highlight(target())
}

const state = await sessionState()
if (state === 'signed-out') location.replace('/masuk/')
const signOutButton = document.getElementById('sign-out')
signOutButton.hidden = state !== 'signed-in'
signOutButton.addEventListener('click', async () => {
  await signOut()
  location.replace('/masuk/')
})

window.addEventListener('hashchange', open)
frame.addEventListener('load', () => {
  frame.classList.remove('loading')
  sync()
  syncTitle()
})
setInterval(sync, 400)
loadApps()
open()
