import { spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { ports, processes, root } from './apps.mjs'

const windows = process.platform === 'win32'
const colors = [36, 33, 35, 32, 34, 31]
const width = Math.max(...processes.map(p => p.name.length))
const children = new Map()
let stopping = false

function prefix(name, index) {
  return `\x1b[${colors[index % colors.length]}m${name.padEnd(width)}\x1b[0m │ `
}

function pipe(stream, label) {
  let rest = ''
  stream.on('data', chunk => {
    const lines = (rest + chunk).split(/\r?\n/)
    rest = lines.pop()
    for (const line of lines) process.stdout.write(label + line + '\n')
  })
}

function start(app, index) {
  const child = spawn(process.execPath, app.args, {
    cwd: resolve(root, app.dir),
    env: { ...process.env, ...Object.fromEntries(Object.entries(app.env).map(([k, v]) => [k, String(v)])) }
  })
  const label = prefix(app.name, index)
  pipe(child.stdout, label)
  pipe(child.stderr, label)
  child.on('exit', code => {
    children.delete(app.name)
    if (!stopping) console.log(`${label}berhenti (kode ${code}). Aplikasi lain tetap jalan.`)
    if (stopping && children.size === 0) process.exit(0)
  })
  children.set(app.name, child)
}

function stop() {
  if (stopping) return
  stopping = true
  console.log('\nMenghentikan semua bagian...')
  for (const child of children.values()) {
    if (windows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    else child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(0), 5000).unref()
  if (children.size === 0) process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

processes.forEach((app, index) => (app.delayMs ? setTimeout(() => !stopping && start(app, index), app.delayMs) : start(app, index)))
console.log(`Ionwyn System: buka http://localhost:${ports.hub}  (Ctrl+C untuk berhenti)`)
