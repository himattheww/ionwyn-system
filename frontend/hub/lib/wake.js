const capacitor = window.Capacitor ?? window.parent?.Capacitor
export const nativeWake = capacitor?.PluginHeaders?.some(plugin => plugin.name === 'Wake') ?? false
export const canWake = nativeWake || Boolean(navigator.mediaDevices?.getUserMedia && window.Worker && window.WebAssembly && window.AudioContext)

const callNative = method => capacitor.nativePromise('Wake', method, {})

export async function popupAllowed() {
  return (await callNative('popup')).popup
}

export const allowPopup = () => callNative('allowPopup')

function nativeWakeWord({ onState }) {
  let enabled = false
  let paused = false

  return {
    async start() {
      if (enabled) return
      enabled = true
      paused = false
      onState('loading')
      try {
        await callNative('start')
      } catch (failure) {
        enabled = false
        return onState('error', failure?.message ?? 'Pendengar gagal dimulai.')
      }
      if (!enabled) return
      if (paused) return callNative('pause')
      onState('listening')
    },
    pause() {
      if (!enabled || paused) return
      paused = true
      callNative('pause')
      onState('paused')
    },
    async resume() {
      if (!enabled || !paused) return
      paused = false
      await callNative('resume')
      onState('listening')
    },
    stop() {
      enabled = false
      paused = false
      callNative('stop')
      onState('off')
    }
  }
}

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
  if (nativeWake) return nativeWakeWord({ onState })
  let enabled = false
  let paused = false
  let ready = false
  let audio = null

  function release() {
    if (!audio) return
    audio.media.getTracks().forEach(track => track.stop())
    audio.context?.close()
    removeEventListener('pointerdown', audio.unlock)
    audio = null
  }

  async function pump(track) {
    const reader = new MediaStreamTrackProcessor({ track }).readable.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      const samples = new Float32Array(value.numberOfFrames)
      value.copyTo(samples, { planeIndex: 0, format: 'f32-planar' })
      worker.postMessage({ sampleRate: value.sampleRate, samples }, [samples.buffer])
      value.close()
    }
  }

  async function capture() {
    const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    if (!enabled || paused) return media.getTracks().forEach(track => track.stop())
    worker.postMessage({ type: 'reset' })
    if (window.MediaStreamTrackProcessor) {
      audio = { media }
      pump(media.getAudioTracks()[0]).catch(failure => audio?.media === media && onState('error', failure.message))
      return onState('listening')
    }
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
    await Promise.race([context.resume(), new Promise(done => setTimeout(done, 500))])
    if (audio?.context !== context) return
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
