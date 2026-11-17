'use client'
import { useState, useEffect, type ReactNode } from 'react'
import { PanelHeader } from '@/components/ui'

// Sprint "Mercado" — extraído tal cual desde terminal/page.tsx (Sprint 6) para
// que la parte cuantitativa (Fear & Greed, VIX, DXY) viva en la pantalla
// Mercado. Los tres con datos reales (ver abajo).

// ── Sparkline SVG component ───────────────────────────────────

// Curva siempre en gradiente verde de marca, el mismo de la curva de equity
// del style guide (#1E40AF → #3B82F6, relleno vertical que se desvanece) — el
// color de estado (pos/neg/neutral) queda solo para el valor y la etiqueta,
// nunca para la línea.
function Sparkline({ data, gradientId, height = 40, thresholds = [] }: {
  data:   number[]
  gradientId: string
  height?: number
  /** Líneas de referencia horizontales (límites de zona del semáforo, ej. VIX 20/30) — se ocultan si caen fuera del rango visible de datos. */
  thresholds?: number[]
}) {
  if (data.length < 2) return null
  const w = 380
  const h = height
  const padX = 3
  const padTop = 16    // deja lugar arriba para la etiqueta del máximo
  const padBottom = 18 // deja lugar abajo para la etiqueta del mínimo
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const visibleThresholds = thresholds.filter(t => t >= min && t <= max)

  const xAt = (i: number) => padX + (i / (data.length - 1)) * (w - padX * 2)
  const yAt = (v: number) => (h - padBottom) - ((v - min) / range) * (h - padTop - padBottom)

  const pts = data.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)

  const lastIdx = data.length - 1
  const lastX = xAt(lastIdx)
  const lastY = yAt(data[lastIdx])

  // Máximo/mínimo del período — marcados en el punto donde ocurrieron, no
  // en un eje aparte. Si coinciden con el último punto (el actual) o entre
  // sí, no se duplican.
  let maxIdx = 0
  let minIdx = 0
  data.forEach((v, i) => {
    if (v > data[maxIdx]) maxIdx = i
    if (v < data[minIdx]) minIdx = i
  })
  const maxX = xAt(maxIdx)
  const maxY = yAt(data[maxIdx])
  const minX = xAt(minIdx)
  const minY = yAt(data[minIdx])
  // Si el máximo/mínimo está pegado al punto actual (1–2 días antes), su
  // etiqueta se superpone con la del valor actual: se omite.
  const showMaxMarker = lastIdx - maxIdx > 2
  const showMinMarker = lastIdx - minIdx > 2 && minIdx !== maxIdx
  // Etiquetas cerca de los bordes: se alinean hacia adentro para no cortarse.
  const anchorAt = (x: number) => (x < 24 ? 'start' : x > w - 24 ? 'end' : 'middle')

  const areaPath = `M${pts[0]} L${pts.join(' L')} L${(w - padX)},${h} L${padX},${h} Z`
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Líneas de referencia (límites de zona) */}
      {visibleThresholds.map(t => (
        <g key={t}>
          <text x={padX + 20} y={yAt(t) + 4} textAnchor="end" fontSize="11" fontFamily="'JetBrains Mono', monospace" className="fill-base-muted">
            {fmt(t)}
          </text>
          <line
            x1={padX + 24} x2={w - padX}
            y1={yAt(t)} y2={yAt(t)}
            className="stroke-base-muted/40"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        </g>
      ))}
      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradientId}-fill)`} />
      {/* Line */}
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Máximo del período */}
      {showMaxMarker && (
        <>
          <circle cx={maxX} cy={maxY} r="2" className="fill-base-bg stroke-brand" strokeWidth="1.2" />
          <text x={maxX} y={maxY - 5} textAnchor={anchorAt(maxX)} fontSize="11" fontFamily="'JetBrains Mono', monospace" className="fill-base-text">
            {fmt(max)}
          </text>
        </>
      )}
      {/* Mínimo del período */}
      {showMinMarker && (
        <>
          <circle cx={minX} cy={minY} r="2" className="fill-base-bg stroke-brand" strokeWidth="1.2" />
          <text x={minX} y={minY + 14} textAnchor={anchorAt(minX)} fontSize="11" fontFamily="'JetBrains Mono', monospace" className="fill-base-text">
            {fmt(min)}
          </text>
        </>
      )}
      {/* Punto actual */}
      <circle cx={lastX} cy={lastY} r="2.5" fill="#3B82F6" />
      <text x={lastX} y={lastY - 5} textAnchor="end" fontSize="11" fontFamily="'JetBrains Mono', monospace" className="fill-brand">
        {fmt(data[lastIdx])}
      </text>
    </svg>
  )
}

// ── Sentiment mini chart ──────────────────────────────────────
// Tarjeta completa: cabecera (título · subtítulo + fuente o badge), valor en
// blanco con la zona en color (el semáforo solo interpreta el nivel), la
// variación contra el día anterior en texto y el gráfico.

function MiniChart({ label, subtitle, meta, value, delta, data, zoneClass, zoneLabel, gradientId, thresholds, days, sample = false }: {
  label:      string
  subtitle:   string
  /** Fuente y fecha del dato, o el badge "Dato de muestra". */
  meta:       ReactNode
  value:      string
  /** Variación contra el día anterior, ya formateada (ej. "−0.5"). */
  delta:      string
  data:       number[]
  zoneClass:  string
  zoneLabel:  string
  gradientId: string
  thresholds?: number[]
  days:       string[]
  /** Dato de muestra: borde punteado y valor/gráfico atenuados. */
  sample?:    boolean
}) {
  return (
    <section className={`card ${sample ? 'border-dashed' : ''}`}>
      <PanelHeader title={label} subtitle={subtitle} aside={meta} />
      <div className={`p-4 ${sample ? 'opacity-55' : ''}`}>
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-mono text-[30px] font-bold leading-none text-base-text">{value}</span>
          <span className={`text-[13px] font-semibold ${zoneClass}`}>{zoneLabel}</span>
        </div>
        <p className="mt-1.5 text-xs text-base-muted"><b className="font-mono font-semibold text-base-text">{delta}</b> vs. día anterior</p>
        <div className="mt-3.5">
          <Sparkline data={data} gradientId={gradientId} height={200} thresholds={thresholds} />
          <DayLabels days={days} />
        </div>
      </div>
    </section>
  )
}

// ── Days label row ────────────────────────────────────────────

function DayLabels({ days }: { days: string[] }) {
  return (
    <div className="flex justify-between px-0.5 mt-0.5">
      {days.map((d, i) => (
        <span key={i} className="font-mono text-[11px] text-base-faint">{d}</span>
      ))}
    </div>
  )
}

// VIX (Yahoo casi en vivo, o FRED si Yahoo falla), DXY (Yahoo) y Fear &
// Greed (CNN) vienen de /api/market-data — la misma ruta que usa
// PendingMetricsCard. El panel vuelve a pedir los datos cada 5 minutos
// mientras la pestaña está visible, sin recargar la página.
interface Series { available: boolean; history: number[]; dates: string[]; last: number | null; updatedAt?: string | null; source?: 'yahoo' | 'fred' }
interface MarketData { vix: Series; dxy: Series; fear_greed?: Series }

const REFRESH_MS = 5 * 60 * 1000

const WEEKDAY_LETTER = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const POINTS = 14

function dayLetters(dates: string[]): string[] {
  return dates.map(d => WEEKDAY_LETTER[new Date(`${d}T00:00:00Z`).getUTCDay()])
}

function closeLabel(source: string, dates: string[]): string {
  const last = dates[dates.length - 1]
  if (!last) return source
  const d = new Date(`${last}T00:00:00Z`)
  return `${source} · cierre ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`
}

/** "Yahoo · 4 nov 22:15" (hora de Madrid) para datos con hora; si no hay hora, como closeLabel. */
function liveLabel(source: string, iso: string | null | undefined, dates: string[]): string {
  if (!iso) return closeLabel(source, dates)
  const d = new Date(iso)
  const day = d.toLocaleDateString('es-ES', { day: 'numeric', timeZone: 'Europe/Madrid' })
  const month = MONTH_SHORT[Number(d.toLocaleDateString('en-US', { month: 'numeric', timeZone: 'Europe/Madrid' })) - 1]
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
  return `${source} · ${day} ${month} ${time}`
}

function trendOf(data: number[]): 'up' | 'down' | 'flat' {
  const cur = data[data.length - 1], prev = data[data.length - 2]
  return cur > prev ? 'up' : cur < prev ? 'down' : 'flat'
}

function Unavailable({ label, loading }: { label: string; loading: boolean }) {
  return (
    <section className="card">
      <PanelHeader title={label} />
      <p className="p-4 text-xs text-base-faint italic">{loading ? 'Cargando…' : 'Sin datos disponibles'}</p>
    </section>
  )
}

export function SentimentPanel() {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch('/api/market-data', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        // Si un refresco falla, se mantienen los últimos datos buenos.
        .then(d => { if (!cancelled && d) setData(d) })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false) })
    }
    load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, REFRESH_MS)
    // Al volver a la pestaña después de un rato, refresca enseguida.
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { cancelled = true; clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  // Fear & Greed — índice de CNN (0–100).
  const fear = data?.fear_greed?.available && data.fear_greed.history.length >= 2 ? data.fear_greed : null
  const fearData  = fear ? fear.history.slice(-POINTS) : []
  const fearDates = fear ? fear.dates.slice(-POINTS) : []
  const fearCurrent = fearData[fearData.length - 1]
  const fearLabel   = fearCurrent < 25 ? 'Extremo miedo' : fearCurrent < 45 ? 'Miedo' : fearCurrent < 55 ? 'Neutral' : fearCurrent < 75 ? 'Codicia' : 'Extrema codicia'
  const fearColorClass = fearCurrent < 45 ? 'text-neg' : fearCurrent < 55 ? 'text-neutral' : 'text-pos'

  const vix = data?.vix?.available && data.vix.history.length >= 2 ? data.vix : null
  const dxy = data?.dxy?.available && data.dxy.history.length >= 2 ? data.dxy : null

  const vixData  = vix ? vix.history.slice(-POINTS) : []
  const vixDates = vix ? vix.dates.slice(-POINTS) : []
  const vixCurrent = vixData[vixData.length - 1]
  const vixLabel   = vixCurrent < 15 ? 'Vol. baja' : vixCurrent < 20 ? 'Vol. moderada' : vixCurrent < 30 ? 'Vol. elevada' : 'Vol. extrema'
  const vixColorClass = vixCurrent < 20 ? 'text-pos' : vixCurrent < 30 ? 'text-neutral' : 'text-neg'

  const dxyData  = dxy ? dxy.history.slice(-POINTS) : []
  const dxyDates = dxy ? dxy.dates.slice(-POINTS) : []
  const dxyCurrent = dxyData[dxyData.length - 1]
  const dxyTrend   = dxy ? trendOf(dxyData) : 'flat'
  const dxyColorClass = dxyTrend === 'up' ? 'text-pos' : dxyTrend === 'down' ? 'text-neg' : 'text-neutral'
  // DXY no tiene zona buena/mala fija (a diferencia de Fear&Greed/VIX) —
  // la línea de referencia es el promedio del período, para ver si el
  // valor actual está por encima o por debajo de su propia media.
  const dxyAvg = dxy ? Number((dxyData.reduce((a, b) => a + b, 0) / dxyData.length).toFixed(1)) : 0

  // "−0.5" con signo menos tipográfico; 0 sin signo.
  const deltaOf = (d: number[], digits: number) => {
    const v = d[d.length - 1] - d[d.length - 2]
    const r = Number(v.toFixed(digits))
    return r === 0 ? '0' : `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(digits)}`
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 items-start">
      {vix ? (
        <MiniChart
          label="VIX"
          subtitle="Volatilidad implícita"
          meta={vix.source === 'yahoo' ? liveLabel('Yahoo', vix.updatedAt, vixDates) : closeLabel('FRED', vixDates)}
          value={vixCurrent.toFixed(1)}
          delta={deltaOf(vixData, 1)}
          data={vixData}
          zoneClass={vixColorClass}
          zoneLabel={vixLabel}
          gradientId="sparkline-vix"
          thresholds={[20, 30]}
          days={dayLetters(vixDates)}
        />
      ) : <Unavailable label="VIX" loading={loading} />}

      {dxy ? (
        <MiniChart
          label="DXY"
          subtitle="Índice dólar"
          meta={closeLabel('Yahoo', dxyDates)}
          value={dxyCurrent.toFixed(1)}
          delta={deltaOf(dxyData, 1)}
          data={dxyData}
          zoneClass={dxyColorClass}
          zoneLabel={dxyTrend === 'up' ? 'USD en alza' : dxyTrend === 'down' ? 'USD en caída' : 'USD lateral'}
          gradientId="sparkline-dxy"
          thresholds={[dxyAvg]}
          days={dayLetters(dxyDates)}
        />
      ) : <Unavailable label="DXY" loading={loading} />}

      {fear ? (
        <MiniChart
          label="Fear & Greed"
          subtitle="Miedo y codicia"
          meta={liveLabel('CNN', fear.updatedAt, fearDates)}
          value={String(fearCurrent)}
          delta={deltaOf(fearData, 0)}
          data={fearData}
          zoneClass={fearColorClass}
          zoneLabel={fearLabel}
          gradientId="sparkline-fear"
          thresholds={[45, 55]}
          days={dayLetters(fearDates)}
        />
      ) : <Unavailable label="Fear & Greed" loading={loading} />}
    </div>
  )
}
