import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from 'recharts'
import { Activity, ListChecks, ArrowRight, Calendar, Lightbulb } from 'lucide-react'
import { Card, MetricCard } from '@/components/ui'
import MetricDisplay from '@/components/ui/MetricDisplay'
import MetricPreferenceToggle from '@/components/ui/MetricPreferenceToggle'
import { useStore, usePrimaryMetric } from '@/store/useStore'
import {
  filterTradesByPeriod, filterTradesByAccountScope, accountLabel,
  computeStats, EquityTooltip,
} from './dashboard/dashboardHelpers'
import { InstrumentBars, SessionBars, WeekdayChart, HourHeatmap, RRBuckets } from './dashboard/DashboardBreakdown'
import { tradeDollar } from '@/lib/tradeDollar'
import { computeDailyResults, hourClockLabel, dayCutLabel } from './dashboard/dashboardHelpers'
import { Chips } from '@/components/accounts/accountFormShared'
import { useAccountGroupFilter, GroupFilterSelects } from '@/components/accounts/GroupFilters'
import { MetricsFiltersButton, ActiveFilterTags } from '@/components/accounts/MetricsFilters'
import { ACCOUNT_TYPE_FILTER_OPTIONS, ACCOUNT_STATUS_FILTER_OPTIONS, MARKET_FILTER_OPTIONS, PERIOD_FILTER_OPTIONS, byAccountStatus, accountOptionLabel } from '@/components/accounts/metricsFilterOptions'

// ─────────────────────────────────────────────
//  METRIX BASIC — Centro de análisis del trader
//  Responde a: "¿Por qué voy así?"
//
//  Layout:
//  1. Acceso rápido (compacto, al lado del título) — Portfolio,
//     Historial, Calendario, Setups. Antes había tabs Básico/
//     Intermedio/Pro acá, pero duplicaban la navegación del sidebar.
//  2. Insight Hero — frase generada con datos reales de computeStats()
//  3. Equity (2/3) + KPIs apilados con sparkline (1/3)
//  4. Mejor / Peor trade — click abre el gráfico en Historial
//  5. Desglose (DashboardBreakdown) — con drill-down a Historial
//  6. Actividad (DashboardActivity)
// ─────────────────────────────────────────────

/** Frase dinámica — usa tal cual lo que ya calcula computeStats() */
function buildInsight(stats) {
  if (!stats || stats.total < 10) return null
  const parts = [`Operaste ${stats.total} trades.`]
  if (stats.bestSession) parts.push(`Tu mejor sesión fue ${stats.bestSession.session} (${stats.bestSession.avgR >= 0 ? '+' : ''}${stats.bestSession.avgR}R).`)
  return parts.join(' ')
}

function InsightHero({ stats, navigate }) {
  const insight = buildInsight(stats)
  return (
    <div className="callout callout-green section-gap">
      <div className="icon-circle" style={{ width: 44, height: 44, fontSize: 22, background: 'var(--callout-bg1)', color: 'var(--callout-accent)' }}>
        <Lightbulb size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="callout-label">
          Insight de la Semana
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
          {insight || 'Bienvenido a Metrix. Registra al menos 10 trades para que tu Insight semanal empiece a mostrar patrones reales de tu operativa.'}
        </div>
      </div>
      <button className="btn btn-primary btn-sm" onClick={() => navigate('/mentor-ia')} style={{ flexShrink: 0 }}>
        Ver análisis completo <ArrowRight size={13} />
      </button>
    </div>
  )
}

/** 8 barras — últimos N trades ganadores o perdedores, en R real.
 *  Documentada en /styleguide → "Gauges y barras de progreso" (MiniSparkline).
 *  Sigue el semáforo: verde/lima para ganadoras, degradé de rojos para
 *  perdedoras (antes iba siempre en verde de marca, sin distinción). */
function MiniSparkline({ trades, tone = 'pos' }) {
  const recent = trades.slice(-8)
  if (!recent.length) return null
  const max = Math.max(...recent.map(t => Math.abs(t.rPnl)), 0.1)
  const gradient = tone === 'neg'
    ? 'linear-gradient(0deg, #c94a4a 0%, #ed553b 100%)'
    : 'linear-gradient(0deg, #1E40AF 0%, #3B82F6 100%)'
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
        {recent.map((t, i) => (
          <div
            key={i}
            title={`${t.date} · ${t.rPnl >= 0 ? '+' : ''}${t.rPnl}R`}
            style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '100%' }}
          >
            <div style={{
              width: '80%', height: `${Math.max(10, (Math.abs(t.rPnl) / max) * 100)}%`,
              background: gradient,
              borderRadius: 5,
            }} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Últimos {recent.length} trades</div>
    </div>
  )
}

/** Variante en cuadraditos de MiniSparkline — mismo lenguaje visual que
 *  "Últimas 20 operaciones" (Consistency.jsx), con el valor de cada trade
 *  en el centro. Últimos 8 trades ganadores o perdedores.
 *  Respeta el toggle $ / % / R de arriba (primaryMetric, igual que
 *  MetricDisplay): si la unidad elegida no está disponible para el trade
 *  (sin capital inicial para % o sin R), cae a $ — nunca inventa valores. */
const compactNum = (v, decimals) => {
  const abs = Math.abs(v)
  return abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(decimals)
}

function MiniSquares({ trades, tone = 'pos', initialCapital, noun = 'trades' }) {
  const preference = usePrimaryMetric() // 'dollar' | 'percent' | 'r'
  const recent = trades.slice(-8)
  if (!recent.length) return null

  const dollarOf = (t) => tradeDollar(t) // mismo criterio que BestWorstTrades
  const unit = preference === 'percent' && !(initialCapital > 0) ? 'dollar'
    : preference === 'r' && recent.some(t => t.rPnl == null) ? 'dollar'
    : preference

  const valueOf = (t) => unit === 'r' ? t.rPnl
    : unit === 'percent' ? (dollarOf(t) / initialCapital) * 100
    : dollarOf(t)
  const format = (t) => {
    const v = valueOf(t)
    const sign = v >= 0 ? '+' : '-'
    if (unit === 'dollar')  return `${sign}${compactNum(v, 0)}`
    if (unit === 'percent') return `${sign}${compactNum(v, Math.abs(v) >= 1 ? 1 : 2)}`
    return `${sign}${compactNum(v, 1)}`
  }
  const unitLabel = { dollar: '$', percent: '%', r: 'R' }[unit]

  const bg     = tone === 'neg' ? 'var(--red2)' : 'var(--pos2)'
  const border = tone === 'neg' ? 'var(--red)'  : 'var(--pos)'
  // Mapa de calor solo en el borde: opacidad según el tamaño del trade
  // respecto al mayor de los 8 (15% → 100%). El texto queda sólido para
  // que siempre se lea.
  const maxAbs = Math.max(...recent.map(t => Math.abs(valueOf(t))), 0.0001)
  const borderFor = (t) => `color-mix(in srgb, ${border} ${Math.round(15 + (Math.abs(valueOf(t)) / maxAbs) * 85)}%, transparent)`
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {recent.map((t, i) => (
          <div
            key={i}
            title={`${t.date} · ${t.rPnl >= 0 ? '+' : ''}${t.rPnl}R · ${dollarOf(t) >= 0 ? '+' : '-'}$${Math.abs(dollarOf(t)).toFixed(0)}`}
            style={{
              flex: 1, maxWidth: 32, aspectRatio: '1', borderRadius: 6,
              background: bg, border: `1px solid ${borderFor(t)}`, color: border,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700,
              cursor: 'default',
            }}
          >
            {format(t)}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Últimos {recent.length} {noun} · en {unitLabel}</div>
    </div>
  )
}

// Panel a la derecha de la Curva de Equity — mismo criterio que Dashboard.jsx
function StackedKPIs({ stats, initialCapital }) {
  // Expectativa por trade en las 3 unidades — respeta el toggle $ / % / R
  // (primaryMetric). Principal grande según la preferencia, las otras
  // dos chicas en el delta. Si falta capital inicial, % no se muestra
  // y cae a $, igual que MetricDisplay.
  const preference = usePrimaryMetric() // 'dollar' | 'percent' | 'r'
  const expDollar  = stats.total ? stats.totalDollar / stats.total : 0
  const expValues  = {
    dollar:  expDollar,
    percent: initialCapital > 0 ? (expDollar / initialCapital) * 100 : null,
    r:       stats.expectancy,
  }
  const expFormat = {
    dollar:  (v) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(0)}`,
    percent: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
    r:       (v) => `${v >= 0 ? '+' : ''}${v}R`,
  }
  const expAvailable = (k) => expValues[k] !== null && expValues[k] !== undefined && !Number.isNaN(expValues[k])
  const expMain = expAvailable(preference) ? preference : 'dollar'
  const expRest = ['dollar', 'percent', 'r'].filter(k => k !== expMain && expAvailable(k))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <MetricCard
            size="hero"
            label="Expectativa" value={expFormat[expMain](expValues[expMain])}
            delta={`${expRest.map(k => expFormat[k](expValues[k])).join(' · ')} /trade`}
            deltaUp={expValues[expMain] >= 0}
          />
        </div>
        <div style={{ flex: 1 }}>
          <MetricCard
            size="hero"
            label="Operaciones" value={stats.total}
            delta={stats.rows > stats.total ? `en el período · ${stats.rows} cierres` : 'en el período'}
          />
        </div>
      </div>
      <Card title="Distribución R:R" style={{ flex: 1 }}>
        <RRBuckets buckets={stats.rrBuckets} />
      </Card>
    </div>
  )
}

function BestWorstTrades({ stats, onOpenChart, initialCapital }) {
  const bestTrade  = stats.trades.length ? [...stats.trades].sort((a, b) => b.rPnl - a.rPnl)[0] : null
  const worstTrade = stats.trades.length ? [...stats.trades].sort((a, b) => a.rPnl - b.rPnl)[0] : null
  const wins   = stats.trades.filter(t => t.result === 'win').sort((a, b) => a.date.localeCompare(b.date))
  const losses = stats.trades.filter(t => t.result === 'loss').sort((a, b) => a.date.localeCompare(b.date))

  // Average Win / Loss por día (por defecto) o por trade
  const [avgUnit, setAvgUnit] = useState('day')
  // Por día se suman las filas tal cual (como el Calendario): una operación
  // que dura dos días reparte su resultado en cada uno
  const daily = useMemo(() => computeDailyResults(stats.rowTrades), [stats.rowTrades])
  const byDay = avgUnit === 'day'
  const bestDay  = daily.days.length ? daily.days.reduce((m, d) => (d.dollarPnl > m.dollarPnl ? d : m)) : null
  const worstDay = daily.days.length ? daily.days.reduce((m, d) => (d.dollarPnl < m.dollarPnl ? d : m)) : null
  const unitSuffix = <span style={{ fontWeight: 400, color: 'var(--text3)', textTransform: 'none', letterSpacing: 0 }}>· {byDay ? 'por día' : 'por trade'}</span>
  const unitToggle = (
    <Chips size="xs" label="Unidad de mejor, peor y promedios" value={avgUnit} onChange={setAvgUnit}
      options={[{ value: 'day', label: 'Por día' }, { value: 'trade', label: 'Por trade' }]} />
  )
  // Mejor / peor día (el selector Por día / Por trade aplica a las 4 tarjetas)
  const dayCard = (title, d) => (
    <div className="card">
      <div className="card-title">{title} {unitSuffix}</div>
      {d ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MetricDisplay dollar={d.dollarPnl} percent={initialCapital > 0 ? (d.dollarPnl / initialCapital) * 100 : null} r={d.rPnl} />
          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div><span style={{ color: 'var(--text3)' }}>Fecha: </span><span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{d.date}</span></div>
            <div><span style={{ color: 'var(--text3)' }}>Trades: </span><span style={{ fontWeight: 600 }}>{d.count}</span></div>
          </div>
        </div>
      ) : <div style={{ color: 'var(--text3)', fontSize: 12 }}>Sin trades registrados</div>}
    </div>
  )

  return (<>
    {/* Selector Por día / Por trade: fuera de las cajas, aplica a las 4 */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      {unitToggle}
    </div>
    <div className="grid-4" style={{ gap: 12 }}>
      {byDay && dayCard('Mejor resultado', bestDay)}
      {byDay && dayCard('Peor resultado', worstDay)}
      {!byDay && (<>
      <div className="card" onClick={() => bestTrade && onOpenChart(bestTrade)} style={{ cursor: bestTrade ? 'pointer' : 'default' }}>
        <div className="card-title">Mejor resultado {unitSuffix}</div>
        {bestTrade ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MetricDisplay
              dollar={tradeDollar(bestTrade)}
              percent={initialCapital > 0 ? (tradeDollar(bestTrade) / initialCapital) * 100 : null}
              r={bestTrade.rPnl}
            />
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div><span style={{ color: 'var(--text3)' }}>Fecha: </span><span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{bestTrade.date}</span></div>
              <div><span style={{ color: 'var(--text3)' }}>Dirección: </span><span style={{ fontWeight: 600 }}>{bestTrade.direction}</span></div>
            </div>
          </div>
        ) : <div style={{ color: 'var(--text3)', fontSize: 12 }}>Sin trades registrados</div>}
      </div>

      <div className="card" onClick={() => worstTrade && onOpenChart(worstTrade)} style={{ cursor: worstTrade ? 'pointer' : 'default' }}>
        <div className="card-title">Peor resultado {unitSuffix}</div>
        {worstTrade ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MetricDisplay
              dollar={tradeDollar(worstTrade)}
              percent={initialCapital > 0 ? (tradeDollar(worstTrade) / initialCapital) * 100 : null}
              r={worstTrade.rPnl}
            />
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div><span style={{ color: 'var(--text3)' }}>Fecha: </span><span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{worstTrade.date}</span></div>
              <div><span style={{ color: 'var(--text3)' }}>Dirección: </span><span style={{ fontWeight: 600 }}>{worstTrade.direction}</span></div>
            </div>
          </div>
        ) : <div style={{ color: 'var(--text3)', fontSize: 12 }}>Sin trades registrados</div>}
      </div>

      </>)}

      {/* Average Win / Loss: Por día (por defecto) o Por trade. Las
          tarjetas de antes (solo por trade) quedan comentadas abajo. */}
      <div className="card">
        <div className="card-title">Ganancia promedio {unitSuffix}</div>
        <MetricDisplay
          dollar={byDay ? daily.avgWinDollar : stats.avgWinDollar}
          percent={initialCapital > 0 ? ((byDay ? daily.avgWinDollar : stats.avgWinDollar) / initialCapital) * 100 : null}
          r={byDay ? daily.avgWinR : stats.avgWin}
          style={{ marginTop: 8 }}
        />
        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 4 }}>
          {byDay
            ? `${daily.green.length} de ${daily.total} días positivos (${Math.round(daily.positiveRate * 100)}%)`
            : `En promedio · ${stats.wins} operaciones`}
        </div>
        <MiniSquares trades={byDay ? daily.green : wins} initialCapital={initialCapital} noun={byDay ? 'días positivos' : 'trades'} />
      </div>
      <div className="card">
        <div className="card-title">Pérdida promedio {unitSuffix}</div>
        <MetricDisplay
          dollar={byDay ? daily.avgLossDollar : stats.avgLossDollar}
          percent={initialCapital > 0 ? ((byDay ? daily.avgLossDollar : stats.avgLossDollar) / initialCapital) * 100 : null}
          r={byDay ? daily.avgLossR : stats.avgLoss}
          style={{ marginTop: 8 }}
        />
        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 4 }}>
          {byDay
            ? `${daily.red.length} de ${daily.total} días negativos`
            : `En promedio · ${stats.losses} operaciones`}
        </div>
        <MiniSquares trades={byDay ? daily.red : losses} tone="neg" initialCapital={initialCapital} noun={byDay ? 'días negativos' : 'trades'} />
      </div>
      {/* Tarjetas anteriores (solo por trade), desactivadas */}
      {false && (<>
      <Card title="Average Win">
        <MetricDisplay
          dollar={stats.avgWinDollar}
          percent={initialCapital > 0 ? (stats.avgWinDollar / initialCapital) * 100 : null}
          r={stats.avgWin}
          style={{ marginTop: 8 }}
        />
        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 4 }}>En promedio · {stats.wins} operaciones</div>
        {/* <MiniSparkline trades={wins} /> — versión barras, en prueba cuadraditos */}
        <MiniSquares trades={wins} initialCapital={initialCapital} />
      </Card>
      <Card title="Average Loss">
        <MetricDisplay
          dollar={stats.avgLossDollar}
          percent={initialCapital > 0 ? (stats.avgLossDollar / initialCapital) * 100 : null}
          r={stats.avgLoss}
          style={{ marginTop: 8 }}
        />
        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 4 }}>En promedio · {stats.losses} operaciones</div>
        {/* <MiniSparkline trades={losses} tone="neg" /> — versión barras, en prueba cuadraditos */}
        <MiniSquares trades={losses} tone="neg" initialCapital={initialCapital} />
      </Card>
      </>)}
    </div>
    {/* Cómo se calcula la unidad elegida (letra chica) */}
    <div className="section-gap" style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
      {byDay
        ? `Por día: se suman los trades de cada día y cada día cuenta como un resultado. ${dayCutLabel(stats.trades)}`
        : 'Por trade: cada operación cuenta como un resultado. Si promediás, cada entrada puede contar por separado: para ver la idea completa, usá el filtro "Por día".'}
    </div>
  </>)
}

/**
 * QuickNavigation — Accesos rápidos a otras secciones de análisis
 */
const QUICK_LINKS = [
  { icon: Activity, label: 'Portfolio', to: '/portafolio' },
  { icon: ListChecks, label: 'Historial', to: '/historial' },
  { icon: Calendar, label: 'Calendario', to: '/calendar' },
]

// Versión compacta — comparte fila con el título de la página (al
// lado de "Básico"), sin flecha ni círculo de ícono.
function QuickNavigation({ navigate, accountId = 'all' }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {QUICK_LINKS.map(link => {
        const Icon = link.icon
        return (
          <button
            key={link.label}
            // Historial se abre filtrado por la cuenta elegida aquí
            onClick={() => navigate(link.to, link.to === '/historial' && accountId !== 'all' ? { state: { filterAccountId: accountId } } : undefined)}
            className="btn"
            style={{
              padding: '7px 12px', borderRadius: 999, background: 'var(--bg)',
              border: '1px solid var(--border2)',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
              transition: 'border-color 0.14s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--pos)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
          >
            <Icon size={13} style={{ color: 'var(--text2)' }} />
            {link.label}
          </button>
        )
      })}
    </div>
  )
}

// Fila de filtros anterior (Tipo, Mercado, Cuenta, Ciclo, Mapa, Periodo
// todos a la vista). Rediseño 01/11/2026 (opción B): Cuenta y Periodo a
// la vista y el resto en "Filtros" (MetricsFilters). En true vuelve la
// fila anterior.
const METRICS_FILTERS_V1 = false

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────

export default function MetrixBasic() {
  const navigate = useNavigate()
  const location = useLocation()
  const trades = useStore(s => s.trades)
  const accounts = useStore(s => s.accounts)
  // Ciclo de compra y estrategia (como en Portafolio): recortan cuentas
  // y trades antes del resto de filtros.
  const group = useAccountGroupFilter(trades, accounts)

  // Si se llega desde Portfolio ("Ver dashboard" de una cuenta puntual),
  // arranca con esa cuenta ya seleccionada en vez de "Todas".
  const [accountType, setAccountType] = useState('all')
  const [accountMarket, setAccountMarket] = useState('all')
  const [selectedAccountId, setSelectedAccountId] = useState(location.state?.accountId ?? 'all')
  const [selectedPeriod, setPeriod] = useState('ALL')

  const filteredTrades = useMemo(
    () => filterTradesByAccountScope(group.groupTrades, group.groupAccounts, { accountType, accountMarket, accountId: selectedAccountId }),
    [group.groupTrades, group.groupAccounts, accountType, accountMarket, selectedAccountId]
  )
  const periodFilteredTrades = useMemo(
    () => filterTradesByPeriod(filteredTrades, selectedPeriod),
    [filteredTrades, selectedPeriod]
  )

  // Capital inicial real de la(s) cuenta(s) en el alcance actual —
  // antes estaba fijo a $10.000 para TODAS las cuentas, lo que hacía
  // que los porcentajes salieran mal en cualquier cuenta de tamaño
  // distinto. Misma prioridad de filtro que filterTradesByAccountScope
  // (accountId > accountType > todas), para que capital y trades
  // siempre midan exactamente el mismo conjunto de cuentas.
  const initialCapital = useMemo(() => {
    let scoped = group.groupAccounts
    if (selectedAccountId !== 'all') {
      scoped = accounts.filter(a => a.id === selectedAccountId)
    } else if (accountType !== 'all' || accountMarket !== 'all') {
      scoped = group.groupAccounts.filter(a => (accountType === 'all' || a.type === accountType) && (accountMarket === 'all' || a.market === accountMarket))
    }
    const sum = scoped.reduce((s, a) => s + (a.size || 0), 0)
    return sum > 0 ? sum : 10000
  }, [accounts, group.groupAccounts, accountType, accountMarket, selectedAccountId])

  // computeStats() devuelve null sin trades — antes, el spread
  // ({...null, trades:[...]}) escondía ese null detrás de un objeto
  // que SIEMPRE tenía al menos la clave `trades`, así que cualquier
  // comprobación de "¿hay stats?" en el render lo daba por bueno con
  // total/winRate/etc. en undefined — de ahí que la pantalla se
  // quedara en blanco o rompiera al intentar formatear un undefined.
  const stats = useMemo(() => {
    const base = computeStats(periodFilteredTrades, initialCapital)
    return base ? { ...base, rowTrades: periodFilteredTrades } : null
  }, [periodFilteredTrades, initialCapital])

  // Drill-down: navega a Historial ya filtrado por lo que se ha clicado
  // Props compartidas del botón "Filtros" y sus etiquetas activas
  const filterProps = {
    accountType, setAccountType, market: accountMarket, setMarket: setAccountMarket,
    group, accounts, onScopeChange: () => setSelectedAccountId('all'),
  }

  const goToHistorial = (patch) => navigate('/historial', { state: { ...(selectedAccountId !== 'all' && { filterAccountId: selectedAccountId }), ...patch } })
  const openTradeChart = (trade) => navigate('/historial', { state: { openChartTradeId: trade.id } })

  return (
    <div className="page-inner">
      {/* Header + Tabs */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            Básico
            <span aria-hidden="true" style={{ width: 1, height: 16, background: 'var(--border3)', flexShrink: 0 }} />
            <span className="page-sub-inline">Métricas de rendimiento{stats ? ` · ${stats.total} trades` : ''}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <QuickNavigation navigate={navigate} accountId={selectedAccountId} />
          {/* Preferencia $/%/R — la misma de toda la app (Dashboard,
              Portfolio, Metrix...), se guarda al cambiarla aquí. */}
          <MetricPreferenceToggle />
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24, alignItems: 'flex-end' }}>
        {METRICS_FILTERS_V1 && (<>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>Tipo de cuenta</label>
          {/* Selector segmentado (igual que el Portafolio); el select de antes queda comentado */}
          <Chips size="xs" label="Tipo de cuenta" value={accountType} options={ACCOUNT_TYPE_FILTER_OPTIONS}
            onChange={v => { setAccountType(v); setSelectedAccountId('all') }} />
          {/* <select value={accountType} onChange={e => { setAccountType(e.target.value); setSelectedAccountId('all') }}>
            <option value="all">Todas</option>
            <option value="Challenge">Challenge</option>
            <option value="Funded">Funded</option>
            <option value="Personal">Personal</option>
          </select> */}
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Mercado</label>
          <Chips size="xs" label="Mercado" value={accountMarket} options={MARKET_FILTER_OPTIONS}
            onChange={v => { setAccountMarket(v); setSelectedAccountId('all') }} />
        </div>
        </>)}
        {/* Ancho fijo: antes se estiraba y empujaba los otros filtros a otra fila */}
        <div className="form-group" style={{ marginBottom: 0, width: 220, flex: '0 0 220px' }}>
          <label>Cuenta</label>
          <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
            <option value="all">Todas las cuentas</option>
            {group.groupAccounts
              .filter(a => (accountType === 'all' || a.type === accountType) && (accountMarket === 'all' || a.market === accountMarket))
              .sort(byAccountStatus).map(a => <option key={a.id} value={a.id}>{accountOptionLabel(a)}</option>)}
          </select>
        </div>
        {METRICS_FILTERS_V1 && <GroupFilterSelects accounts={accounts} group={group} onChange={() => setSelectedAccountId('all')} />}
        <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>Periodo</label>
          <Chips size="xs" label="Periodo" value={selectedPeriod} options={PERIOD_FILTER_OPTIONS} onChange={setPeriod} />
          {/* <select value={selectedPeriod} onChange={e => setPeriod(e.target.value)}>
            <option value="1W">7 días</option>
            <option value="1M">30 días</option>
            <option value="3M">90 días</option>
            <option value="ALL">Todo</option>
          </select> */}
        </div>
        {!METRICS_FILTERS_V1 && <MetricsFiltersButton {...filterProps} />}
        {!METRICS_FILTERS_V1 && <ActiveFilterTags {...filterProps} />}
        {/* Cantidad de trades: pasó al lado del subtítulo */}
        {false && stats && (
          <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)', paddingBottom: 9 }}>
            {stats.total} trades
          </span>
        )}
      </div>

      {!stats?.total && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text3)', fontSize: 12 }}>
          No hay trades para el filtro seleccionado
        </div>
      )}

      {stats?.total > 0 && (
        <>
          {/* FRANJA HERO — Nivel 2 (5 métricas), idéntica a la del Dashboard.jsx.
              No es card — ver "Jerarquía de la información" en /styleguide. */}
          <div className="section-gap" style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 20,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 20 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>PnL Total</div>
                <MetricDisplay
                  dollar={stats.totalDollar}
                  percent={initialCapital > 0 ? (stats.totalDollar / initialCapital) * 100 : null}
                  r={stats.totalR}
                />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Win Rate</div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)', color: stats.winRateReal >= 55 ? 'var(--pos)' : stats.winRateReal >= 45 ? 'var(--neutral)' : 'var(--neg)' }}>
                  {stats.winRateReal}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{stats.wins}/{stats.total} operaciones</div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Profit Factor</div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)', color: stats.profitFactor >= 1.5 ? 'var(--pos)' : stats.profitFactor >= 1 ? 'var(--neutral)' : 'var(--neg)' }}>
                  {stats.profitFactor}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>objetivo: 1.5+</div>
              </div>
              {/*
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Expectativa</div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)', color: stats.expectancy >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {stats.expectancy >= 0 ? '+' : ''}{stats.expectancy}R
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>por trade</div>
              </div>
              */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Max Drawdown</div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--neg)' }}>{stats.maxDD}%</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>desde el máximo</div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Payoff Ratio</div>
                <div style={{
                  fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)',
                  color: stats.avgLossDollar === 0 ? 'var(--text)'
                    : Math.abs(stats.avgWinDollar / stats.avgLossDollar) >= 1.5 ? 'var(--pos)'
                    : Math.abs(stats.avgWinDollar / stats.avgLossDollar) >= 1 ? 'var(--neutral)' : 'var(--neg)',
                }}>
                  {stats.avgLossDollar !== 0 ? Math.abs(stats.avgWinDollar / stats.avgLossDollar).toFixed(2) : '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>ganancia prom. ÷ pérdida prom.</div>
              </div>
              {/*
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Operaciones</div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{stats.total}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>en el período</div>
              </div>
              */}
            </div>
          </div>

          {/* ROW 1 — Equity (2/3) + KPIs apilados (1/3) */}
          <div className="section-gap" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <Card title="Curva de Equity">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={stats.equityCurve} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="metrixEqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="metrixEqStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#1E40AF" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={['auto','auto']} />
                  <ReferenceLine y={stats.equityCurve[0]?.value ?? initialCapital} stroke="var(--border2)" strokeDasharray="3 3" strokeWidth={1} />
                  <Tooltip content={<EquityTooltip />} />
                  <Area type="monotone" dataKey="value" stroke="url(#metrixEqStroke)" strokeWidth={4} fill="url(#metrixEqGrad)"
                    dot={false} activeDot={{ r: 4, fill: '#3B82F6', stroke: 'var(--bg)' }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <StackedKPIs stats={stats} initialCapital={initialCapital} />
          </div>

          {/* INSIGHT — jerarquía menor, debajo de la Curva de Equity
              (ver docs/buenas-practicas-ui-design.md, regla 6-3-1): no
              es tan relevante como para ir arriba de todo. Mismo CTA a
              Mentor IA — el Resumen Ejecutivo de esa pantalla no está
              bloqueado para Básico, solo el resto (Diagnóstico,
              Perfil, etc. sí requieren Pro vía PremiumGate). */}
          {/* ROW 2 — Mejor / Peor trade + promedios */}
          <BestWorstTrades stats={stats} onOpenChart={openTradeChart} initialCapital={initialCapital} />

          {/* Insight de la Semana: bajado debajo de las 4 tarjetas (antes iba arriba) */}
          <InsightHero stats={stats} navigate={navigate} />

          {/* ROW 3 — Rendimiento por instrumento + Rendimiento por sesión */}
          <div className="section-gap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card title="Rendimiento por instrumento">
              <InstrumentBars byInstrument={stats.byInstrument} />
            </Card>
            <Card title="Rendimiento por sesión">
              <SessionBars sessions={stats.bySessions} />
            </Card>
          </div>

          {/* ROW 4 — Rendimiento por día + Resultados por hora */}
          <div className="section-gap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card title="Rendimiento por día">
              <WeekdayChart byWeekday={stats.byWeekday} />
            </Card>
            <Card title="Resultados por hora">
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: -8, marginBottom: 12 }}>{hourClockLabel(stats.trades)}</div>
              <HourHeatmap byHour={stats.byHour} onClick={(hour) => goToHistorial({ filterHour: hour })} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}