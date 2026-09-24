import { useEffect, useRef } from 'react'

// Audio-reactive 3D orb for Vitoria's voice mode: ~900 points on a Fibonacci sphere, rotated in 3D
// and perspective-projected onto a canvas every frame. The surface ripples with the live audio
// level (the guest's mic while they talk, Vitoria's voice while she answers) and the palette follows
// the call state: ocean while listening, sunset while speaking, violet while thinking.
const PALETTES = {
  connecting: [[120, 170, 210], [70, 110, 170]],
  listening: [[64, 214, 255], [26, 110, 230]],
  thinking: [[190, 140, 255], [110, 70, 230]],
  speaking: [[255, 190, 90], [255, 92, 140]],
  idle: [[120, 190, 230], [60, 120, 200]],
}
const N = 900

function sphere() {
  const pts = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < N; i += 1) {
    const y = 1 - (i / (N - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const th = golden * i
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r, Math.random() * Math.PI * 2])
  }
  return pts
}

const mix = (a, b, t) => a + (b - a) * t
const mixColor = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]

export default function VoiceOrb({ levelRef, stateRef, size = 280 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const pts = sphere()
    let raf = 0
    let t = 0
    let level = 0
    let rotY = 0
    let rotX = 0.35
    let colorA = PALETTES.connecting[0]
    let colorB = PALETTES.connecting[1]

    const frame = () => {
      const state = stateRef.current || 'idle'
      const target = Math.min(1, levelRef.current || 0)
      level += (target - level) * (target > level ? 0.35 : 0.08)
      const palette = PALETTES[state] || PALETTES.idle
      colorA = mixColor(colorA, palette[0], 0.06)
      colorB = mixColor(colorB, palette[1], 0.06)
      const speed = reduce ? 0.002 : 0.004 + level * 0.02 + (state === 'thinking' ? 0.01 : 0)
      rotY += speed
      rotX = 0.35 + Math.sin(t * 0.4) * 0.15
      t += reduce ? 0.004 : 0.016

      const c = size / 2
      const R = size * 0.3 * (1 + level * 0.08 + (state === 'connecting' ? Math.sin(t * 3) * 0.02 : 0))
      ctx.clearRect(0, 0, size, size)

      // Soft glow behind the sphere, stronger with the voice.
      const glow = ctx.createRadialGradient(c, c, R * 0.2, c, c, R * 1.9)
      glow.addColorStop(0, `rgba(${colorA.map(Math.round).join(',')},${0.28 + level * 0.35})`)
      glow.addColorStop(0.5, `rgba(${colorB.map(Math.round).join(',')},${0.12 + level * 0.2})`)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, size, size)

      const cy = Math.cos(rotY)
      const sy = Math.sin(rotY)
      const cx = Math.cos(rotX)
      const sx = Math.sin(rotX)
      const f = 2.6
      const projected = []
      for (const [x0, y0, z0, phase] of pts) {
        // Ripple: travelling waves over the surface, amplified by the audio level.
        const wave =
          Math.sin(x0 * 4 + t * 2.2 + phase) * 0.5 + Math.sin(y0 * 5 - t * 1.7) * 0.35 + Math.sin(z0 * 3 + t * 2.9) * 0.3
        const d = 1 + wave * (0.03 + level * 0.22)
        let x = x0 * d
        let y = y0 * d
        let z = z0 * d
        // rotate Y then X
        const xz = x * cy - z * sy
        const zz = x * sy + z * cy
        const yy = y * cx - zz * sx
        const z2 = y * sx + zz * cx
        x = xz
        y = yy
        z = z2
        const scale = f / (f + z)
        projected.push([c + x * R * scale, c + y * R * scale, z, scale, wave])
      }
      projected.sort((a, b) => b[2] - a[2]) // far first
      for (const [px, py, z, scale, wave] of projected) {
        const depth = (1 - z) / 2 // 0 back … 1 front
        const col = mixColor(colorB, colorA, Math.min(1, depth * 0.9 + wave * 0.15))
        const alpha = 0.18 + depth * 0.75
        const r = (0.6 + depth * depth * 2.2 + level * 1.4) * scale
        ctx.beginPath()
        ctx.fillStyle = `rgba(${col.map(Math.round).join(',')},${alpha})`
        ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Two tilted orbital rings of light, counter-rotating around the sphere.
      for (const [tilt, dir, count, radius] of [[0.9, 1, 90, 1.32], [-0.55, -1, 70, 1.52]]) {
        const ct = Math.cos(tilt)
        const st = Math.sin(tilt)
        for (let i = 0; i < count; i += 1) {
          const a = (i / count) * Math.PI * 2 + t * 0.6 * dir
          const x = Math.cos(a) * radius
          const z0 = Math.sin(a) * radius
          const y = z0 * st
          const z = z0 * ct
          const scale = f / (f + z * 0.8)
          const depth = (1 - z / radius) / 2
          const pulse = 0.5 + 0.5 * Math.sin(a * 3 + t * 4)
          const col = mixColor(colorB, colorA, depth)
          ctx.beginPath()
          ctx.fillStyle = `rgba(${col.map(Math.round).join(',')},${(0.1 + depth * 0.45) * (0.6 + pulse * 0.4 + level * 0.5)})`
          ctx.arc(c + x * R * scale, c + y * R * scale, (0.6 + depth * 1.3 + level) * scale, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Bright core highlight for a glassy, three-dimensional feel.
      const core = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, 0, c, c, R * 1.05)
      core.addColorStop(0, `rgba(255,255,255,${0.22 + level * 0.25})`)
      core.addColorStop(0.35, 'rgba(255,255,255,0.04)')
      core.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(c, c, R * 1.05, 0, Math.PI * 2)
      ctx.fill()

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [levelRef, stateRef, size])

  return <canvas ref={canvasRef} className="app-voice-orb" style={{ width: size, height: size }} aria-hidden="true" />
}
