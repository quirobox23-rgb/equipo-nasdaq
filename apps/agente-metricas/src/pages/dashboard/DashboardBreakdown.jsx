import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// ─────────────────────────────────────────────
//  DASHBOARD · Fila 3 — Desglose
//  Resultados por sesión / Distribución R:R / Resultados por hora /
//  Rendimiento por Setup. Cuatro tarjetas pequeñas y limpias,
//  mucho espacio negativo, nada de gráficos enormes.
//  Depende únicamente de `stats`.
//
//  onSessionClick / onSetupClick / onHourClick son OPCIONALES — si
//  no se pasan, las filas/celdas no son clicables (comportamiento
//  idéntico al de siempre). MetrixBasic.jsx los usa para el
//  drill-down hacia /historial; nada más cambia para quien no los pase.
// ─────────────────────────────────────────────
export function SessionBars({ sessions, onClick }) {
  if (!sessions?.length) return <div style={{ fontSize: 12, color: "var(--text3)" }}>Sin datos de sesión</div>
  const maxAbs = Math.max(...sessions.map(s => Math.abs(s.avgR)), 0.1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {sessions.map(s => (
        <div
          key={s.session}
          onClick={onClick ? () => onClick(s.session) : undefined}
          style={{
            padding: '4px 6px', margin: '-4px -6px', borderRadius: 6,
            cursor: onClick ? 'pointer' : 'default', transition: 'background 120ms',
          }}
          onMouseEnter={onClick ? (e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)') : undefined}
          onMouseLeave={onClick ? (e => e.currentTarget.style.background = 'transparent') : undefined}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: 'var(--text2)' }}>{s.session}</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: s.dollarTotal >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {s.dollarTotal >= 0 ? '+' : '-'}${Math.abs(s.dollarTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                {s.avgR >= 0 ? '+' : ''}{s.avgR}R
              </span>
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: 'var(--bg3)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, Math.abs(s.avgR) / maxAbs * 100)}%`, height: '100%',
              background: s.avgR >= 0 ? 'var(--accent-gradient)' : 'linear-gradient(135deg, #c94a4a 0%, #ed553b 100%)', borderRadius: 5,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Cuanto más grande el múltiplo de R ganado, más "fuerte" el tono —
// semáforo por magnitud de la ganancia, no por win/loss (acá todo es win).
export function RRBuckets({ buckets }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {buckets.map(b => (
        <div key={b.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: 'var(--text2)' }}>{b.label}</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{b.pct}%</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: 'var(--bg3)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ width: `${b.pct}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: 5 }} />
          </div>
        </div>
      ))}
      {/* Qué representa: operaciones completas (los parciales de una misma
          posición cuentan una vez), medidas con el riesgo de referencia */}
      <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
        Ganancias de las operaciones completas (los cierres parciales de una misma posición
        cuentan como una sola) respecto al riesgo de referencia configurado. No es necesariamente
        el riesgo-beneficio real de cada operación.
      </div>
    </div>
  )
}

function HourChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (!d.count) return null
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8,
      padding: '6px 10px', fontSize: 11,
    }}>
      <div style={{ color: 'var(--text2)', marginBottom: 2 }}>{d.hour}:00</div>
      <div style={{ fontFamily: 'var(--mono)', color: d.dollarTotal >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
        {d.dollarTotal >= 0 ? '+' : '-'}${Math.abs(d.dollarTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })} · {d.count} trades
      </div>
    </div>
  )
}

// Barras 0-23h en el eje X — de un vistazo se ve el patrón horario,
// sin depender de cuántas horas distintas tengan trades.
export function HourHeatmap({ byHour, onClick }) {
  if (!byHour?.length) return <div style={{ fontSize: 12, color: "var(--text3)" }}>Sin datos de horario</div>
  const byHourMap = Object.fromEntries(byHour.map(h => [h.hour, h]))
  const data = Array.from({ length: 24 }, (_, hour) => byHourMap[hour] ?? { hour, avgR: 0, dollarTotal: 0, count: 0 })

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          {/* Mismos gradientes que Average Win / Average Loss en Metrix Básico */}
          <linearGradient id="hourPosGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#1E40AF" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id="hourNegGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#c94a4a" />
            <stop offset="100%" stopColor="#ed553b" />
          </linearGradient>
        </defs>
        <CartesianGrid horizontal vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} interval={0}
        />
        <YAxis
          tickFormatter={v => `${v >= 0 ? '+' : '-'}$${Math.abs(v)}`} width={44}
          tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} domain={['auto', 'auto']}
        />
        <Tooltip content={<HourChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="dollarTotal" radius={[3, 3, 0, 0]} onClick={onClick ? (d) => d.count && onClick(d.hour) : undefined}
          style={{ cursor: onClick ? 'pointer' : 'default' }}>
          {data.map(d => (
            <Cell key={d.hour} fill={!d.count ? 'var(--bg3)' : d.dollarTotal >= 0 ? 'url(#hourPosGrad)' : 'url(#hourNegGrad)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Barras horizontales — mismo patrón que InstrumentBars, una fila por día.
export function WeekdayChart({ byWeekday, onClick }) {
  if (!byWeekday?.length) return <div style={{ fontSize: 12, color: "var(--text3)" }}>Sin datos por día</div>
  const maxAbs = Math.max(...byWeekday.map(d => Math.abs(d.dollarTotal)), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {byWeekday.map(d => {
        const avg = d.count ? d.dollarTotal / d.count : 0
        return (
          <div
            key={d.day}
            onClick={onClick && d.count ? () => onClick(d.day) : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: onClick && d.count ? 'pointer' : 'default' }}
          >
            <span style={{ fontSize: 12, color: 'var(--text2)', width: 34, flexShrink: 0 }}>{d.day}</span>
            <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--bg3)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{
                width: `${d.count ? Math.min(100, Math.abs(d.dollarTotal) / maxAbs * 100) : 0}%`, height: '100%',
                background: d.dollarTotal >= 0 ? 'var(--accent-gradient)' : 'linear-gradient(135deg, #c94a4a 0%, #ed553b 100%)', borderRadius: 5,
              }} />
            </div>
            <span style={{
              fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', minWidth: 84, textAlign: 'right',
              color: !d.count ? 'var(--text3)' : d.dollarTotal >= 0 ? 'var(--pos)' : 'var(--neg)',
            }}>
              {d.count ? `${d.dollarTotal >= 0 ? '+' : '-'}$${Math.abs(d.dollarTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 96, textAlign: 'right' }}>
              {d.count ? `avg ${avg >= 0 ? '+' : '-'}$${Math.abs(avg).toLocaleString(undefined, { maximumFractionDigits: 0 })}/trade` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function InstrumentBars({ byInstrument, onClick }) {
  if (!byInstrument?.length) return <div style={{ fontSize: 12, color: "var(--text3)" }}>Sin datos de instrumento</div>
  const maxAbs = Math.max(...byInstrument.map(i => Math.abs(i.dollarTotal)), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {byInstrument.map(i => (
        <div
          key={i.pair}
          onClick={onClick ? () => onClick(i.pair) : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: onClick ? 'pointer' : 'default' }}
        >
          <span style={{ fontSize: 12, color: 'var(--text2)', width: 90, flexShrink: 0 }}>{i.pair}</span>
          <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--bg3)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, Math.abs(i.dollarTotal) / maxAbs * 100)}%`, height: '100%',
              background: i.dollarTotal >= 0 ? 'var(--accent-gradient)' : 'linear-gradient(135deg, #c94a4a 0%, #ed553b 100%)', borderRadius: 5,
            }} />
          </div>
          <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: i.dollarTotal >= 0 ? 'var(--pos)' : 'var(--neg)', minWidth: 84, textAlign: 'right' }}>
            {i.dollarTotal >= 0 ? '+' : '-'}${Math.abs(i.dollarTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 56, textAlign: 'right' }}>{i.count} trades</span>
        </div>
      ))}
    </div>
  )
}

function SetupBars({ setups, onClick }) {
  if (!setups?.length) return <div style={{ fontSize: 12, color: "var(--text3)" }}>Sin setups registrados</div>
  const maxAbs = Math.max(...setups.map(s => Math.abs(s.avgR)), 0.1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {setups.slice(0, 5).map(s => (
        <div
          key={s.setup}
          onClick={onClick ? () => onClick(s.setup) : undefined}
          style={{
            padding: '4px 6px', margin: '-4px -6px', borderRadius: 6,
            cursor: onClick ? 'pointer' : 'default', transition: 'background 120ms',
          }}
          onMouseEnter={onClick ? (e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)') : undefined}
          onMouseLeave={onClick ? (e => e.currentTarget.style.background = 'transparent') : undefined}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: 'var(--text2)' }}>{s.setup}</span>
            <span style={{ fontFamily: 'var(--mono)', color: s.avgR >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
              {s.avgR >= 0 ? '+' : ''}{s.avgR}R · {s.wr}%WR
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: 'var(--bg3)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, Math.abs(s.avgR) / maxAbs * 100)}%`, height: '100%',
              background: s.avgR >= 0 ? 'var(--accent-gradient)' : 'linear-gradient(135deg, #c94a4a 0%, #ed553b 100%)', borderRadius: 5,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DashboardBreakdown({ stats, onSessionClick, onSetupClick, onHourClick, onDayClick }) {
  return (
    <>
      <div className="section-gap">
        <div className="card-sm">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 10 }}>Distribución R:R</div>
          <RRBuckets buckets={stats.rrBuckets} />
        </div>
      </div>
      <div className="section-gap">
        {/*
        <div className="card-sm">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 10 }}>Resultados por sesión</div>
          <SessionBars sessions={stats.bySessions} onClick={onSessionClick} />
        </div>
        */}
        <div className="card-sm">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 10 }}>Resultados por hora</div>
          <HourHeatmap byHour={stats.byHour} onClick={onHourClick} />
        </div>
        {/*
        <div className="card-sm">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 10 }}>Rendimiento por día</div>
          <WeekdayChart byWeekday={stats.byWeekday} onClick={onDayClick} />
        </div>
        */}
        {/*
        <div className="card-sm">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 10 }}>Rendimiento por Setup</div>
          <SetupBars setups={stats.bySetup} onClick={onSetupClick} />
        </div>
        */}
      </div>
    </>
  )
}
