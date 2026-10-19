import {
  BufferGeometry,
  Color,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three'

export interface OrbAttribute {
  score: number
}

const clampScore = (score: number) => Math.max(0, Math.min(1.5, score))

function directions(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2
    return new Vector3(Math.cos(angle), Math.sin(angle) * 0.35, Math.sin(angle)).normalize()
  })
}

export function shapeGeometry(attributes: OrbAttribute[]) {
  const base = new IcosahedronGeometry(1, 2)
  const position = base.getAttribute('position')
  const axes = directions(attributes.length)
  const point = new Vector3()
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).normalize()
    let push = 0
    axes.forEach((axis, index) => {
      const facing = Math.max(0, point.dot(axis))
      push += clampScore(attributes[index]?.score ?? 0) * Math.pow(facing, 4) * 0.7
    })
    point.multiplyScalar(0.82 + push)
    position.setXYZ(i, point.x, point.y, point.z)
  }
  const edges = new EdgesGeometry(base, 1)
  base.dispose()
  return edges
}

function inkColor(element: HTMLElement) {
  const value = getComputedStyle(element).getPropertyValue('--ink').trim()
  return new Color(value || '#1b1a17')
}

export function mountOrb(canvas: HTMLCanvasElement, attributes: OrbAttribute[]) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  const scene = new Scene()
  const camera = new PerspectiveCamera(32, 1, 0.1, 20)
  camera.position.set(0, 0.4, 4.6)
  camera.lookAt(0, 0, 0)

  const material = new LineBasicMaterial({ color: inkColor(canvas), transparent: true, opacity: 0.75 })
  const group = new Group()
  let geometry: BufferGeometry = shapeGeometry(attributes)
  group.add(new LineSegments(geometry, material))
  group.rotation.x = 0.25
  scene.add(group)

  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let frame = 0
  let running = true

  const resize = () => {
    const { clientWidth, clientHeight } = canvas
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(clientWidth, clientHeight, false)
    camera.aspect = clientWidth / Math.max(1, clientHeight)
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
  }

  const tick = () => {
    if (!running) return
    group.rotation.y += 0.0035
    renderer.render(scene, camera)
    frame = requestAnimationFrame(tick)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  if (!reduced.matches) frame = requestAnimationFrame(tick)

  const scheme = matchMedia('(prefers-color-scheme: dark)')
  const recolor = () => {
    material.color = inkColor(canvas)
    renderer.render(scene, camera)
  }
  scheme.addEventListener('change', recolor)

  return {
    update(next: OrbAttribute[]) {
      const old = geometry
      geometry = shapeGeometry(next)
      ;(group.children[0] as LineSegments).geometry = geometry
      old.dispose()
      renderer.render(scene, camera)
    },
    dispose() {
      running = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      scheme.removeEventListener('change', recolor)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }
}
