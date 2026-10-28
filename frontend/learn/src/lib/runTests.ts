import type { ExerciseTest, TestOutcome } from '../types'

const workerSource = `
const show = (value) => {
  if (value === undefined) return 'undefined'
  try { return JSON.stringify(value) } catch { return String(value) }
}
const sorted = (value) => {
  if (Array.isArray(value)) return value.map(sorted)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sorted(value[k])]))
  return value
}
const same = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))
}
self.onmessage = ({ data: { code, tests } }) => {
  const outcomes = tests.map((test) => {
    let expected
    try { expected = JSON.parse(test.expected) } catch { expected = test.expected }
    try {
      const actual = new Function(code + '\\n;return (' + test.call + ');')()
      return { name: test.name, passed: same(actual, expected), actual: show(actual), error: null }
    } catch (error) {
      return { name: test.name, passed: false, actual: '', error: String(error && error.message || error) }
    }
  })
  self.postMessage(outcomes)
}
`

export function runTests(code: string, tests: ExerciseTest[], timeoutMs = 3000): Promise<TestOutcome[]> {
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))
  const worker = new Worker(url)
  return new Promise<TestOutcome[]>((resolve) => {
    const finish = (outcomes: TestOutcome[]) => {
      clearTimeout(timer)
      worker.terminate()
      URL.revokeObjectURL(url)
      resolve(outcomes)
    }
    const timer = setTimeout(
      () => finish(tests.map((t) => ({ name: t.name, passed: false, actual: '', error: `Melebihi ${timeoutMs / 1000} detik, kemungkinan loop tanpa akhir` }))),
      timeoutMs,
    )
    worker.onmessage = (event: MessageEvent<TestOutcome[]>) => finish(event.data)
    worker.onerror = (event) => {
      event.preventDefault()
      finish(tests.map((t) => ({ name: t.name, passed: false, actual: '', error: event.message || 'Kode gagal dijalankan' })))
    }
    worker.postMessage({ code, tests: tests.map(({ name, call, expected }) => ({ name, call, expected })) })
  })
}
