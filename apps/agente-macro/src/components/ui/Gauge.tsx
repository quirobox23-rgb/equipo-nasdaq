'use client'

// Gauge — semicírculo de zonas de color con aguja, tipo "Fear & Greed
// Index". Genérico: recibe las zonas (color + límite superior) en vez de
// tenerlas hardcodeadas, así sirve para cualquier métrica de rango fijo
// (0-100), no solo sentimiento. Zonas en semáforo (pos/neg/neutral) —
// nunca marca, es un resultado/lectura, no una acción.
export interface GaugeZone {
  to: number
  color: string // hex — mismo valor que --pos/--neg/--neutral, no var() (SVG no resuelve custom properties de Tailwind fuera del DOM con clases)
  label: string
}

interface Props {
  value: number
  max?: number
  zones: GaugeZone[] // ordenadas, cada `to` es el límite superior de la zona
  label?: string
  size?: number
}

export function Gauge({ value, max = 100, zones, label, size = 200 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 14
  const strokeWidth = 16

  const angleAt = (v: number) => 180 - (Math.max(0, Math.min(v, max)) / max) * 180
  const pointAt = (angleDeg: number, radius: number) => {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) }
  }

  let from = 0
  const arcs = zones.map((zone, i) => {
    const a0 = angleAt(from)
    const a1 = angleAt(zone.to)
    const p0 = pointAt(a0, r)
    const p1 = pointAt(a1, r)
    from = zone.to
    return {
      ...zone,
      gradientId: `gauge-zone-${i}`,
      d: `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
      x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y,
    }
  })

  const needleAngle = angleAt(value)
  const needleTip = pointAt(needleAngle, r - strokeWidth / 2 - 4)

  return (
    <div className="inline-flex flex-col items-center">
      <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
        <defs>
          {/* Mismo criterio que el Donut: degradé oscuro → pleno a lo
              largo de cada arco, no un color plano. */}
          {arcs.map(arc => (
            <linearGradient key={arc.gradientId} id={arc.gradientId} gradientUnits="userSpaceOnUse" x1={arc.x1} y1={arc.y1} x2={arc.x2} y2={arc.y2}>
              <stop offset="0%" stopColor={`color-mix(in srgb, ${arc.color} 60%, black)`} />
              <stop offset="100%" stopColor={arc.color} />
            </linearGradient>
          ))}
        </defs>
        {arcs.map(arc => (
          <path key={arc.label} d={arc.d} fill="none" stroke={`url(#${arc.gradientId})`} strokeWidth={strokeWidth} strokeLinecap="butt" />
        ))}
        {/* Aguja */}
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="currentColor" className="text-base-text" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" className="fill-base-text" />
      </svg>
      <div className="text-center -mt-2">
        <div className="font-mono text-[28px] font-bold text-base-text leading-none">{value}</div>
        {label && <div className="text-xs text-base-muted uppercase tracking-wide mt-1">{label}</div>}
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3 max-w-[220px]">
        {zones.map(z => (
          <div key={z.label} className="flex items-center gap-1.5 text-[11px] text-base-muted">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: z.color }} />
            {z.label}
          </div>
        ))}
      </div>
    </div>
  )
}
