import { useEffect, useMemo, useState } from 'react'
import { LAND_DOTS } from './WorldMapHotspots'

interface Props {
  /** Convicción IA (0-100) u otra lectura ya calculada — solo afina la velocidad del pulso, nada de cálculos nuevos acá. */
  pulse?: number
}

// Puerto de la esfera de datos de Hero.jsx (Agente Métricas) — misma
// distribución "phyllotaxis" (ángulo dorado) determinística y bezel de
// instrumento. Dos diferencias a propósito respecto al original: las
// órbitas tipo átomo se reemplazan por la geografía real de
// WorldMapHotspots (mismos ~5300 puntos de costa) reproyectada como globo
// visto de frente, y la curva de equity (no aplica a macro, no hay P&L)
// se reemplaza por dos pulsos de sonar sobre EEUU/Londres en vez de un
// único pulso central.
function useSphereField(count: number, radius: number) {
  return useMemo(() => {
    const golden = 137.508 * (Math.PI / 180)
    const pts: { x: number; y: number; r: number; o: number; hub: boolean }[] = []
    for (let i = 8; i < count; i++) {
      const r = radius * Math.sqrt(i / count)
      const a = i * golden
      pts.push({
        x: 260 + r * Math.cos(a),
        y: 260 + r * Math.sin(a),
        r: 0.5 + (i % 5) * 0.3,
        o: 0.12 + (i % 4) * 0.12,
        hub: i % 7 === 0,
      })
    }
    const links: { x1: number; y1: number; x2: number; y2: number; o: number }[] = []
    const THRESH = 28
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < THRESH) links.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[j].x, y2: pts[j].y, o: 0.22 - (d / THRESH) * 0.16 })
      }
    }
    const ticks = Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * Math.PI * 2
      const major = i % 3 === 0
      const rOuter = 248
      const rInner = major ? 238 : 243
      return {
        x1: 260 + rInner * Math.cos(a), y1: 260 + rInner * Math.sin(a),
        x2: 260 + rOuter * Math.cos(a), y2: 260 + rOuter * Math.sin(a),
        o: major ? 0.35 : 0.14,
      }
    })
    return { pts, links, ticks }
  }, [count, radius])
}

// Proyección ortográfica de la geografía real de WorldMapHotspots (misma
// idea que tenía WorldGlobe.tsx) — se invierte la fórmula equirectangular
// del dataset para volver a lat/lon y se reproyecta como esfera vista de
// frente, centrada sobre el Atlántico para que EEUU y Londres queden del
// lado visible.
const GLOBE_LON0_START = -74, GLOBE_LAT0 = 20, GLOBE_R = 224
const GLOBE_CX = 260, GLOBE_CY = 260

function toRad(d: number) { return (d * Math.PI) / 180 }

function equirectToLatLon([x, y]: [number, number]): [number, number] {
  return [90 - (y / 500) * 180, (x / 1000) * 360 - 180]
}

// lon0 variable (resto de la vista fija) — es lo único que cambia cuadro a
// cuadro para hacer girar el globo, sin recalcular la nube de puntos cruda.
function projectGlobe(lat: number, lon: number, lon0: number) {
  const φ1 = toRad(GLOBE_LAT0), λ0 = toRad(lon0)
  const φ = toRad(lat), λ = toRad(lon)
  const cosc = Math.sin(φ1) * Math.sin(φ) + Math.cos(φ1) * Math.cos(φ) * Math.cos(λ - λ0)
  const x = GLOBE_R * Math.cos(φ) * Math.sin(λ - λ0)
  const y = GLOBE_R * (Math.cos(φ1) * Math.sin(φ) - Math.sin(φ1) * Math.cos(φ) * Math.cos(λ - λ0))
  return { x: GLOBE_CX + x, y: GLOBE_CY - y, visible: cosc > 0.02 }
}

// Coordenadas reales de Nueva York, Londres y Tokio — se reproyectan con el
// mismo lon0 que gira, para que los pulsos sigan pegados a su continente
// (Tokio queda del lado oculto la mayor parte del giro y aparece solo
// cuando le toca estar de frente, igual que pasaría en un globo real).
const PULSE_COORDS = [
  { id: 'usa',    lat: 40.7,  lon: -74.0 },
  { id: 'london', lat: 51.5,  lon: -0.13 },
  { id: 'tokyo',  lat: 35.68, lon: 139.65 },
]

// Contorno (no relleno) de los continentes — LAND_DOTS es una nube de
// puntos, no un trazado; para sacar una línea de costa se binea la nube en
// una grilla y se recorre con marching squares, quedándose solo con los
// segmentos de borde entre celda "tierra" y "no tierra". Se calcula una
// única vez a partir de datos estáticos (no depende de props ni de render).
function buildCoastlineSegments(cell: number): [[number, number], [number, number]][] {
  const cols = Math.ceil(1000 / cell) + 1
  const rows = Math.ceil(500 / cell) + 1
  const land = new Set<number>()
  const key = (i: number, j: number) => j * cols + i
  for (const [x, y] of LAND_DOTS) {
    const i = Math.round(x / cell), j = Math.round(y / cell)
    if (i >= 0 && i < cols && j >= 0 && j < rows) land.add(key(i, j))
  }
  // Erosión — descarta celdas de tierra sueltas/en cadenas cortas (ruido de
  // la nube de puntos) que generan mini-rombos dispersos en el contorno.
  // Dos pasadas con umbral alto: solo sobrevive tierra bien acompañada,
  // es decir los continentes reales, no islas de 1-3 celdas.
  function erode(set: Set<number>, minNeighbors: number): Set<number> {
    const out = new Set<number>()
    const has = (i: number, j: number) => set.has(key(i, j))
    for (const k of set) {
      const i = k % cols, j = Math.floor(k / cols)
      let neighbors = 0
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue
          if (has(i + di, j + dj)) neighbors++
        }
      }
      if (neighbors >= minNeighbors) out.add(k)
    }
    return out
  }
  const clean = erode(erode(land, 3), 3)
  const at = (i: number, j: number) => clean.has(key(i, j))

  const segs: [[number, number], [number, number]][] = []
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const tl = at(i, j), tr = at(i + 1, j), bl = at(i, j + 1), br = at(i + 1, j + 1)
      const x0 = i * cell, x1 = (i + 1) * cell, y0 = j * cell, y1 = (j + 1) * cell
      const top: [number, number]    = [(x0 + x1) / 2, y0]
      const bottom: [number, number] = [(x0 + x1) / 2, y1]
      const left: [number, number]   = [x0, (y0 + y1) / 2]
      const right: [number, number]  = [x1, (y0 + y1) / 2]
      const crossings: [number, number][] = []
      if (tl !== tr) crossings.push(top)
      if (bl !== br) crossings.push(bottom)
      if (tl !== bl) crossings.push(left)
      if (tr !== br) crossings.push(right)
      if (crossings.length === 2) segs.push([crossings[0], crossings[1]])
      else if (crossings.length === 4) {
        // Caso ambiguo (esquinas opuestas iguales) — se resuelve agrupando
        // según qué diagonal comparte el mismo valor de tierra.
        if (tl === br) segs.push([top, left], [bottom, right])
        else segs.push([top, right], [bottom, left])
      }
    }
  }
  return segs
}

const COASTLINE_SEGMENTS = buildCoastlineSegments(10)

// Gráticula suave (meridianos cada 60° + ecuador) — gira con el globo
// (usa el mismo lon0 dinámico), a diferencia del contorno de costa que es
// geografía real. Se arma muestreando cada línea y cortando en tramos
// cuando el punto pasa al lado oculto, para no dibujar de canto a canto.
function buildMeridianRuns(lon0: number, lonFixed: number): { x: number; y: number }[][] {
  const runs: { x: number; y: number }[][] = []
  let current: { x: number; y: number }[] = []
  for (let lat = -80; lat <= 80; lat += 4) {
    const p = projectGlobe(lat, lonFixed, lon0)
    if (p.visible) current.push({ x: p.x, y: p.y })
    else if (current.length > 1) { runs.push(current); current = [] }
    else current = []
  }
  if (current.length > 1) runs.push(current)
  return runs
}

function buildEquatorRuns(lon0: number): { x: number; y: number }[][] {
  const runs: { x: number; y: number }[][] = []
  let current: { x: number; y: number }[] = []
  for (let lon = -180; lon <= 180; lon += 4) {
    const p = projectGlobe(0, lon, lon0)
    if (p.visible) current.push({ x: p.x, y: p.y })
    else if (current.length > 1) { runs.push(current); current = [] }
    else current = []
  }
  if (current.length > 1) runs.push(current)
  return runs
}

export function DataSphere({ pulse = 50 }: Props) {
  const { pts, links, ticks } = useSphereField(72, 224)

  // Más convicción → pulso más rápido/activo, sin volverse frenético.
  const dur = Math.max(2.2, 4.4 - (pulse / 100) * 2.2)
  const rings = [0, 1]

  // Rotación lenta del globo — un giro completo cada ~3 minutos. Solo se
  // recalcula la proyección (barata: unos cientos de segmentos de costa ya
  // simplificados), nunca la nube de puntos cruda ni el marching squares.
  const [lon0, setLon0] = useState(GLOBE_LON0_START)
  useEffect(() => {
    const id = setInterval(() => {
      setLon0(prev => prev + 0.3)
    }, 150)
    return () => clearInterval(id)
  }, [])

  const coastlines = useMemo(() => {
    return COASTLINE_SEGMENTS
      .map(([a, b]) => {
        const [latA, lonA] = equirectToLatLon(a)
        const [latB, lonB] = equirectToLatLon(b)
        return { a: projectGlobe(latA, lonA, lon0), b: projectGlobe(latB, lonB, lon0) }
      })
      .filter(s => s.a.visible && s.b.visible)
  }, [lon0])

  const pulsePoints = useMemo(
    () => PULSE_COORDS.map(p => ({ id: p.id, ...projectGlobe(p.lat, p.lon, lon0) })),
    [lon0],
  )

  const graticule = useMemo(() => {
    const meridians = [-120, -60, 0, 60, 120, 180].flatMap(lon => buildMeridianRuns(lon0, lon))
    const equator = buildEquatorRuns(lon0)
    return [...meridians, ...equator]
  }, [lon0])

  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-[6%] rounded-full overflow-hidden pointer-events-none" style={{
        background: 'conic-gradient(from 0deg, transparent 0deg, rgba(59,130,246,0.10) 18deg, transparent 50deg)',
        animation: 'heroSweep 16s linear infinite',
      }} />

      <svg viewBox="0 0 520 520" width="100%" height="100%" style={{ display: 'block', position: 'relative' }}>
        <defs>
          <radialGradient id="dsCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(59,130,246,0.55)" />
            <stop offset="40%" stopColor="rgba(59,130,246,0.12)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0)" />
          </radialGradient>
          <linearGradient id="dsRim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(150,242,110,0.55)" />
            <stop offset="45%" stopColor="rgba(59,130,246,0.08)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0)" />
          </linearGradient>
        </defs>

        <circle cx="260" cy="260" r="90" fill="url(#dsCore)" />

        <circle cx="260" cy="260" r="224" fill="none" stroke="url(#dsRim)" strokeWidth="1.1" />
        <circle cx="260" cy="260" r="224" fill="none" stroke="#343941" strokeWidth="1" />
        <circle cx="260" cy="260" r="168" fill="none" stroke="#343941" strokeWidth="1" strokeDasharray="1 7" />
        <circle cx="260" cy="260" r="112" fill="none" stroke="#343941" strokeWidth="1" strokeDasharray="1 5" opacity="0.6" />

        {ticks.map((t, i) => (
          <line key={i} x1={t.x1.toFixed(2)} y1={t.y1.toFixed(2)} x2={t.x2.toFixed(2)} y2={t.y2.toFixed(2)} stroke="#3B82F6" strokeWidth="1" opacity={t.o} />
        ))}

        {/* Contorno real de los continentes, proyectado como globo — línea sutil, sin relleno, en vez de órbitas tipo átomo */}
        {coastlines.map((s, i) => (
          <line key={i} x1={s.a.x.toFixed(2)} y1={s.a.y.toFixed(2)} x2={s.b.x.toFixed(2)} y2={s.b.y.toFixed(2)} stroke="#3B82F6" strokeWidth="1.7" opacity="0.4" strokeLinecap="round" />
        ))}
        {/* Gráticula suave — meridianos + ecuador, gira con el globo */}
        {graticule.map((run, i) => (
          <polyline
            key={i}
            points={run.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none" stroke="#3B82F6" strokeWidth="0.6" opacity="0.16"
          />
        ))}

        {links.map((l, i) => (
          <line key={i} x1={l.x1.toFixed(2)} y1={l.y1.toFixed(2)} x2={l.x2.toFixed(2)} y2={l.y2.toFixed(2)} stroke="#3B82F6" strokeWidth="0.6" opacity={l.o} />
        ))}
        {pts.map((p, i) => (
          <circle
            key={i} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={p.hub ? p.r + 0.8 : p.r}
            fill={p.hub ? '#e7eaf0' : '#3B82F6'} opacity={p.o}
            style={p.hub ? { animation: `heroNodePulse 3.6s ease-in-out ${(i % 9) * 0.3}s infinite` } : undefined}
          />
        ))}

        {/* Pulso de sonar — dos focos (EEUU / Londres) en vez de un único centro; se ocultan al rotar hacia el lado oculto */}
        {pulsePoints.filter(p => p.visible).map(p => {
          const cx = p.x.toFixed(2), cy = p.y.toFixed(2)
          return (
            <g key={p.id}>
              {rings.map(i => (
                <circle key={i} cx={cx} cy={cy} r="3" fill="none" stroke="#38BDF8" strokeWidth="3">
                  <animate attributeName="r" values="3;90" dur={`${dur * 2.4}s`} begin={`${i * dur * 1.2}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0" dur={`${dur * 2.4}s`} begin={`${i * dur * 1.2}s`} repeatCount="indefinite" />
                  <animate attributeName="stroke-width" values="3;0.4" dur={`${dur * 2.4}s`} begin={`${i * dur * 1.2}s`} repeatCount="indefinite" />
                </circle>
              ))}
              <circle cx={cx} cy={cy} r="9" fill="#22D3EE" opacity="0.55" style={{ filter: 'blur(2.5px)' }} />
              <circle cx={cx} cy={cy} r="3.2" fill="#E0F2FE" />
            </g>
          )
        })}

        {/* Núcleo — energía de fondo del globo, no un tercer pulso */}
        <circle cx="260" cy="260" r="8" fill="#67E8F9" opacity="0.25" style={{ filter: 'blur(3px)' }}>
          <animate attributeName="opacity" values="0.3;0.12;0.3" dur="2.8s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  )
}
