const base = '/vendor/kws/'
const model = name => `./${name}-epoch-12-avg-2-chunk-16-left-64.onnx`
const keywords = ['▁HA LO ▁AS IST EN @halo_asisten', '▁HA LO ▁AS S IST ANT @halo_assistant'].join('\n')

let spotter = null
let stream = null
let shown = -1

self.Module = {
  locateFile: file => base + file,
  setStatus(text) {
    const [, loaded, total] = text.match(/\((\d+)\/(\d+)\)/) ?? []
    if (!total) return
    const percent = Math.min(99, Math.floor((loaded / total) * 100))
    if (percent === shown) return
    shown = percent
    postMessage({ type: 'progress', percent })
  },
  onRuntimeInitialized() {
    spotter = createKws(self.Module, {
      featConfig: { samplingRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: { encoder: model('encoder'), decoder: model('decoder'), joiner: model('joiner') },
        tokens: './tokens.txt',
        provider: 'cpu',
        modelType: '',
        numThreads: 1,
        debug: 0,
        modelingUnit: 'bpe',
        bpeVocab: ''
      },
      maxActivePaths: 4,
      numTrailingBlanks: 1,
      keywordsScore: 1.2,
      keywordsThreshold: 0.2,
      keywords
    })
    stream = spotter.createStream()
    postMessage({ type: 'ready' })
  },
  onAbort: reason => postMessage({ type: 'error', message: String(reason) })
}

addEventListener('unhandledrejection', ({ reason }) => postMessage({ type: 'error', message: String(reason) }))

importScripts(base + 'sherpa-onnx-kws.js', base + 'sherpa-onnx-wasm-kws-main.js')

onmessage = ({ data }) => {
  if (!stream) return
  if (data.type === 'reset') return spotter.reset(stream)
  stream.acceptWaveform(data.sampleRate, data.samples)
  while (spotter.isReady(stream)) {
    spotter.decode(stream)
    if (!spotter.getResult(stream).keyword) continue
    spotter.reset(stream)
    postMessage({ type: 'wake' })
  }
}
