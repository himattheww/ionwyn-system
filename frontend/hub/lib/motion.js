const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('still')

export function countUp(root = document) {
  for (const el of root.querySelectorAll('[data-count]')) {
    const end = Number(el.dataset.count)
    const format = el.dataset.format ?? ''
    const digits = Number(el.dataset.digits ?? 0)
    const render = value => {
      const text = value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })
      el.textContent = format.replace('{}', text) || text
    }
    if (reduced() || !Number.isFinite(end)) {
      render(end)
      continue
    }
    const start = performance.now()
    const duration = 700
    const step = now => {
      const t = Math.min(1, (now - start) / duration)
      render(end * (1 - Math.pow(1 - t, 3)))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
}

export function stagger(root = document) {
  root.querySelectorAll('.reveal').forEach((el, i) => el.style.setProperty('--i', String(i)))
}
