export const canWake = Boolean(navigator.mediaDevices?.getUserMedia && window.Worker && window.WebAssembly && window.AudioContext)

let worker = null
let loading = null

function load(onProgress) {
  loading ??= new Promise((resolve, reject) => {
    worker = new Worker('/lib/wake-worker.js')
    worker.addEventListener('message', ({ data }) => {
      if (data.type === 'progress') onProgress(data.percent)
      if (data.type === 'ready') resolve(worker)
      if (data.type === 'error') reject(new Error('Model suara gagal dimuat. Cek koneksi lalu coba lagi.'))
    })
    worker.addEventListener('error', () => reject(new Error('Model suara gagal dimuat. Cek koneksi lalu coba lagi.')))
  }).catch(failure => {
    worker?.terminate()
    worker = null
    loading = null
    throw failure
  })
  return loading
}

const micErrors = {
  NotAllowedError: 'Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini.',
  NotFoundError: 'Mikrofon tidak ditemukan.',
  NotReadableError: 'Mikrofon sedang dipakai aplikasi lain.'
}

export function wakeWord({ onWake, onState }) {
  let enabled = false
  let paused = false
  let ready = false
  let audio = null

  function release() {
    if (!audio) return
    audio.media.getTracks().forEach(track => track.stop())
    audio.context.close()
    removeEventListener('pointerdown', audio.unlock)
    audio = null
  }

  async function capture() {
    const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    if (!enabled || paused) return media.getTracks().forEach(track => track.stop())
    const context = new AudioContext()
    const source = context.createMediaStreamSource(media)
    const processor = context.createScriptProcessor(4096, 1, 1)
    processor.onaudioprocess = event => {
      const samples = event.inputBuffer.getChannelData(0).slice()
      worker.postMessage({ sampleRate: context.sampleRate, samples }, [samples.buffer])
    }
    source.connect(processor)
    processor.connect(context.destination)
    const unlock = () => context.resume().then(() => onState('listening'))
    audio = { media, context, unlock }
    worker.postMessage({ type: 'reset' })
    if (context.state === 'running') return onState('listening')
    onState('blocked')
    addEventListener('pointerdown', unlock, { once: true })
  }

  async function begin() {
    try {
      await capture()
    } catch (failure) {
      enabled = false
      release()
      onState('error', micErrors[failure.name] ?? failure.message)
    }
  }

  return {
    async start() {
      if (enabled) return
      enabled = true
      paused = false
      onState('loading')
      try {
        await load(percent => enabled && onState('loading', `Mengunduh model suara (sekali saja)… ${percent}%`))
      } catch (failure) {
        enabled = false
        return onState('error', failure.message)
      }
      ready = true
      worker.onmessage = ({ data }) => {
        if (data.type !== 'wake' || !enabled || paused) return
        navigator.vibrate?.(40)
        onWake()
      }
      if (enabled && !paused) await begin()
    },
    pause() {
      if (!enabled || paused) return
      paused = true
      release()
      onState('paused')
    },
    async resume() {
      if (!enabled || !paused) return
      paused = false
      if (ready) await begin()
    },
    stop() {
      enabled = false
      paused = false
      release()
      onState('off')
    }
  }
}
