import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const require = createRequire(join(root, 'fitness-track/server/package.json'))
const { chromium } = require('playwright')

const [before, after] = process.argv.slice(2).map(label => join(root, '.screenshots', label))
const diffDir = `${after}-diff`
mkdirSync(diffDir, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.SCREENSHOT_BROWSER_PATH || '/Applications/Opera GX.app/Contents/MacOS/Opera' })
const page = await browser.newPage()

async function diff(a, b) {
  return page.evaluate(
    async ([a, b]) => {
      const load = src =>
        new Promise(done => {
          const img = new Image()
          img.onload = () => done(img)
          img.src = src
        })
      const [x, y] = await Promise.all([load(a), load(b)])
      if (x.width !== y.width || x.height !== y.height) return { size: `${x.width}x${x.height} vs ${y.width}x${y.height}`, pixels: -1 }
      const read = img => {
        const canvas = new OffscreenCanvas(img.width, img.height)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        return ctx.getImageData(0, 0, img.width, img.height)
      }
      const p = read(x)
      const q = read(y)
      const out = new OffscreenCanvas(x.width, x.height)
      const ctx = out.getContext('2d')
      ctx.globalAlpha = 0.25
      ctx.drawImage(x, 0, 0)
      ctx.globalAlpha = 1
      const marks = ctx.getImageData(0, 0, x.width, x.height)
      let pixels = 0
      for (let i = 0; i < p.data.length; i += 4) {
        if (p.data[i] !== q.data[i] || p.data[i + 1] !== q.data[i + 1] || p.data[i + 2] !== q.data[i + 2] || p.data[i + 3] !== q.data[i + 3]) {
          pixels++
          marks.data.set([255, 0, 0, 255], i)
        }
      }
      if (!pixels) return { pixels }
      ctx.putImageData(marks, 0, 0)
      const blob = await out.convertToBlob()
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return { pixels, image: btoa(binary) }
    },
    [a, b]
  )
}

const asData = file => `data:image/png;base64,${readFileSync(file).toString('base64')}`
let changed = 0
for (const name of readdirSync(before).filter(f => f.endsWith('.png')).sort()) {
  let result
  try {
    result = await diff(asData(join(before, name)), asData(join(after, name)))
  } catch {
    result = { missing: true }
  }
  if (result.missing) {
    changed++
    console.log(`HILANG ${name}`)
  } else if (result.size) {
    changed++
    console.log(`BEDA   ${name}: ukuran ${result.size}`)
  } else if (result.pixels) {
    changed++
    writeFileSync(join(diffDir, name), Buffer.from(result.image, 'base64'))
    console.log(`BEDA   ${name}: ${result.pixels} piksel`)
  } else {
    console.log(`sama   ${name}`)
  }
}

await browser.close()
console.log(changed ? `${changed} halaman berbeda` : 'Semua halaman sama persis')
process.exit(changed ? 1 : 0)
