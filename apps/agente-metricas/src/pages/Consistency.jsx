import { useState, useMemo } from 'react'
import { ClipboardList, Target, Flame, TrendingUp, TrendingDown, Check, X, Minus } from 'lucide-react'
import { Card, PageHeader, MetricCard } from '@/components/ui'
import PremiumGate from '@/components/premium/PremiumGate'
import { accountLabel, filterTradesByAccountScope } from '@/pages/dashboard/dashboardHelpers'
import { useAccountGroupFilter, GroupFilterSelects } from '@/components/accounts/GroupFilters'
import { MetricsFiltersButton, ActiveFilterTags } from '@/components/accounts/MetricsFilters'
import { byAccountStatus, accountOptionLabel } from '@/components/accounts/metricsFilterOptions'
import { useTrades, useSetups, useStore, usePrimaryMetric } from '@/store/useStore'
import MetricPreferenceToggle from '@/components/ui/MetricPreferenceToggle'
import { groupIntoOperations } from '@/lib/operations'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAY_LABELS = ['L','M','X','J','V','S','D']

// ── Flags de diseño (2026-10-04) — desactivan sin borrar ──
// Íconos verdes de la franja de KPIs: ruido de color (regla 6-3-1); la
// franja de Métricas Básico no lleva íconos.
const SHOW_KPI_ICONS = false
// Cajitas de rachas dentro de "Últimas 20 operaciones": repetían Racha
// actual / Mejor / Peor de la franja. Queda solo la de BE (no está arriba).
const SHOW_DUP_STREAK_BOXES = false
// Tabla "Consistencia por setup": Setup se ocultó en toda la app (commit
// 2fca324 de Bego); acá había quedado — hoy mostraría solo "Sin setup".
const SHOW_SETUP_CONSISTENCY = false
// Card "Regla de consistencia" (mejor día vs. profit total, solo cuentas de
// futuros). Guardada, sin mostrar por ahora — pendiente definir la regla
// por firma (Topstep la mide sobre el objetivo) y guardar firma/preset en
// la cuenta en vez de detectarla por nombre.
const SHOW_CONSISTENCY_RULE = false

// Límites típicos de la regla de consistencia de las prop firms (el mejor
// día no puede superar X% del profit total). Ej.: Apex 50% en financiada.
const CONSISTENCY_LIMITS = [30, 40, 50]

// La regla de consistencia es de las firmas de FUTUROS (FTMO y el resto de
// forex no la aplican). Las cuentas no guardan el mercado ni el preset, así
// que se detecta por el nombre de la firma (texto libre) — `match` en
// minúscula. `limit` = límite por defecto del mejor día; el usuario lo
// puede cambiar igual. Verificar contra la web de cada firma.
const FUTURES_FIRMS = [
  { match: 'apex',              limit: 50 },
  { match: 'topstep',           limit: 50 },
  { match: 'tradeify',          limit: 40 },
  { match: 'myfundedfutures',   limit: 40 },
  { match: 'take profit',       limit: 40 },
  { match: 'bulenox',           limit: 40 },
  { match: 'lucid',             limit: 40 },
  { match: 'alpha futures',     limit: 40 },
  { match: 'elite trader',      limit: 40 },
  { match: 'earn2trade',        limit: 40 },
]
const futuresFirmFor = (account) => {
  const name = `${account?.firm ?? ''} ${account?.name ?? ''}`.toLowerCase()
  return FUTURES_FIRMS.find(f => name.includes(f.match)) ?? null
}

// Degradé semáforo como el resto de las gráficas (ver StyleGuide → Gráficas):
// 40% más oscuro en el origen hacia el tono pleno en la punta.
const toneGradient = (tone) => `linear-gradient(90deg, color-mix(in srgb, ${tone} 60%, black) 0%, ${tone} 100%)`

// Formato del resultado de un día / mes según la preferencia global $ / % / R
// (mismo selector que Métricas Básico y Dashboard). $ abreviado en k para
// que entre en la celda del calendario.
function fmtResult(v, unit) {
  const sign = v >= 0 ? '+' : '-'
  const a = Math.abs(v)
  if (unit === 'dollar')  return `${sign}$${a >= 1000 ? `${(a / 1000).toFixed(1).replace(/\.0$/, '')}k` : Math.round(a)}`
  if (unit === 'percent') return `${sign}${a.toFixed(2)}%`
  return `${sign}${parseFloat(a.toFixed(2))}R`
}

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
function getFirstDay(y, m)    { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1 }

// Calculate consecutive streak — win/loss/be por separado
// BE no interrumpe ni suma a rachas de win ni loss
function calcStreaks(sorted) {
  if (!sorted.length) return { current: 0, currentType: null, maxWin: 0, maxLoss: 0, maxBe: 0 }

  // Racha actual: último resultado no-BE define el tipo, contar consecutivos del mismo tipo
  let currentType = null
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i] !== 'be') { currentType = sorted[i]; break }
  }

  let currentStreak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i] === currentType) currentStreak++
    else if (sorted[i] === 'be') continue  // BE no rompe la racha
    else break
  }

  // Max streaks (BE no interrumpe win ni loss, tampoco suma)
  let maxWin = 0, maxLoss = 0, maxBe = 0
  let wTemp = 0, lTemp = 0, bTemp = 0

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] === 'win') {
      wTemp++; lTemp = 0; bTemp = 0
      maxWin = Math.max(maxWin, wTemp)
    } else if (sorted[i] === 'loss') {
      lTemp++; wTemp = 0; bTemp = 0
      maxLoss = Math.max(maxLoss, lTemp)
    } else {
      bTemp++; // BE no resetea win/loss streak
      maxBe = Math.max(maxBe, bTemp)
    }
  }

  return { current: currentStreak, currentType, maxWin, maxLoss, maxBe }
}

// Mismo criterio que Métricas, Calendario e Historial: el resultado
// del propio trade (win / loss / be).
function classifyResult(trade) {
  if (trade.result === 'win' || trade.result === 'loss') return trade.result
  return 'be'
}

// Fila de filtros anterior (solo Ciclo y Mapa a la vista). Rediseño
// 01/11/2026, igual que Métricas: Cuenta a la vista y botón "Filtros" con
// Tipo de cuenta, Mercado y (Intermedio+) Ciclo y Mapa. En true vuelve la
// fila anterior.
const CONSISTENCY_FILTERS_V1 = false

export default function Consistency() {
  const allTrades   = useTrades()
  const allAccounts = useStore(s => s.accounts)
  // Ciclo de compra y estrategia (como en Portafolio): toda la página
  // trabaja sobre las cuentas y trades del grupo elegido.
  const group    = useAccountGroupFilter(allTrades, allAccounts)
  // Cuenta, Tipo de cuenta y Mercado recortan sobre el grupo (una
  // cuenta puntual tiene prioridad, como en Métricas)
  const [accountType,   setAccountType]   = useState('all')
  const [accountMarket, setAccountMarket] = useState('all')
  const [selectedAccountId, setSelectedAccountId] = useState('all')
  const scopeAccounts = useMemo(
    () => group.groupAccounts.filter(a => (accountType === 'all' || a.type === accountType) && (accountMarket === 'all' || a.market === accountMarket)),
    [group.groupAccounts, accountType, accountMarket]
  )
  const accounts = useMemo(
    () => (selectedAccountId === 'all' ? scopeAccounts : group.groupAccounts.filter(a => a.id === selectedAccountId)),
    [scopeAccounts, group.groupAccounts, selectedAccountId]
  )
  const trades = useMemo(
    () => filterTradesByAccountScope(group.groupTrades, group.groupAccounts, { accountType, accountMarket, accountId: selectedAccountId }),
    [group.groupTrades, group.groupAccounts, accountType, accountMarket, selectedAccountId]
  )
  const filterProps = {
    accountType, setAccountType, market: accountMarket, setMarket: setAccountMarket,
    group, accounts: allAccounts, onScopeChange: () => setSelectedAccountId('all'),
  }
  const now      = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const unit     = usePrimaryMetric() // 'dollar' | 'percent' | 'r'
  // % de cada trade sobre el tamaño de SU cuenta (las cuentas tienen
  // tamaños distintos); el % del día es la suma de esos %.
  const accSize  = useMemo(() => Object.fromEntries((accounts || []).map(a => [a.id, parseFloat(a.size) || 0])), [accounts])
  const tradePct = (t) => accSize[t.accountId] > 0 ? ((t.dollarPnl || 0) / accSize[t.accountId]) * 100 : 0

  // Build day map for calendar: date → { result: 'win'|'loss'|'mixed', totalR, count }
  const dayMap = useMemo(() => {
    const map = {}
    trades.forEach(t => {
      if (!map[t.date]) map[t.date] = { wins: 0, losses: 0, totalR: 0, totalDollar: 0, totalPct: 0, count: 0 }
      map[t.date].count++
      map[t.date].totalR = parseFloat((map[t.date].totalR + t.rPnl).toFixed(2))
      map[t.date].totalDollar += t.dollarPnl || 0
      map[t.date].totalPct    += tradePct(t)
      if (t.result === 'win')  map[t.date].wins++
      if (t.result === 'loss') map[t.date].losses++
    })
    // Classify each day
    Object.keys(map).forEach(d => {
      const { wins, losses } = map[d]
      map[d].result = wins > losses ? 'win' : losses > wins ? 'loss' : 'mixed'
    })
    return map
  }, [trades, accSize])

  // Win rate y rachas por operación completa (parciales de una misma
  // posición = una operación); el mapa por día sigue con cada fila
  const sorted = useMemo(() =>
    [...groupIntoOperations(trades)].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  , [trades])

  // Clasificar cada trade como win/loss/be (BE = dentro del 0.1% del balance de la cuenta)
  const results  = sorted.map(t => classifyResult(t))
  const bes      = results.filter(r => r === 'be').length
  const streaks  = useMemo(() => calcStreaks(results), [results])
  const wins     = results.filter(r => r === 'win').length
  const losses   = results.filter(r => r === 'loss').length
  const totalClassified = wins + losses + bes || 1
  const winRate  = wins > 0 ? (wins / totalClassified * 100).toFixed(1) : '0.0'
  const lossRate = losses > 0 ? (losses / totalClassified * 100).toFixed(1) : '0.0'
  const beRate   = bes > 0 ? (bes / totalClassified * 100).toFixed(1) : '0.0'

  // Monthly stats
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthTrades = trades.filter(t => t.date.startsWith(monthPrefix))
  const monthWins   = monthTrades.filter(t => t.result === 'win').length
  const monthLosses = monthTrades.filter(t => t.result === 'loss').length
  const monthR      = parseFloat(monthTrades.reduce((s, t) => s + t.rPnl, 0).toFixed(2))
  const monthValue  = unit === 'dollar' ? monthTrades.reduce((s, t) => s + (t.dollarPnl || 0), 0)
                    : unit === 'percent' ? monthTrades.reduce((s, t) => s + tradePct(t), 0)
                    : monthR
  const dayValue    = (d) => unit === 'dollar' ? d.totalDollar : unit === 'percent' ? d.totalPct : d.totalR
  const greenDays   = Object.entries(dayMap).filter(([k]) => k.startsWith(monthPrefix) && dayMap[k].result === 'win').length
  const redDays     = Object.entries(dayMap).filter(([k]) => k.startsWith(monthPrefix) && dayMap[k].result === 'loss').length

  // Calendar grid
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay    = getFirstDay(year, month)
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11) } else setMonth(m => m-1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0)  } else setMonth(m => m+1) }

  // Last 20 trades for streak visualization
  const last20 = sorted.slice(-20)

  return (
    <PremiumGate feature="consistency">
    <div className="page-inner">
      <PageHeader title="Consistencia" subtitle="Rachas · Win/Loss · Calendario de resultados" />

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24, alignItems: 'flex-end' }}>
        {CONSISTENCY_FILTERS_V1 && <GroupFilterSelects accounts={allAccounts} group={group} />}
        {!CONSISTENCY_FILTERS_V1 && (
          <div className="form-group" style={{ marginBottom: 0, width: 220, flex: '0 0 220px' }}>
            <label>Cuenta</label>
            <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
              <option value="all">Todas las cuentas</option>
              {[...scopeAccounts].sort(byAccountStatus).map(a => <option key={a.id} value={a.id}>{accountOptionLabel(a)}</option>)}
            </select>
          </div>
        )}
        {!CONSISTENCY_FILTERS_V1 && <MetricsFiltersButton {...filterProps} />}
        {!CONSISTENCY_FILTERS_V1 && <ActiveFilterTags {...filterProps} />}
      </div>

      {/* Global KPIs */}
      <div className="grid-5 section-gap">
        {/* iconColor="green" en los 5 — mismo criterio que Dashboard:
            el ícono es un ancla visual de marca, no un indicador de
            resultado (eso ya lo lleva el valor/delta con su propio
            color). Sin esto, MetricCard caía a su default ligado a
            deltaUp, que en "Racha actual" pintaba el ícono en rojo
            incluso sin ninguna racha activa (deltaUp=false por defecto
            cuando currentType es null). */}
        {/* Textos en español y sin letras sueltas (W/L) — 2026-10-04. */}
        <MetricCard size="hero" icon={SHOW_KPI_ICONS ? <ClipboardList size={15} /> : undefined} label="Operaciones" value={trades.length} iconColor="green" />
        <MetricCard size="hero" icon={SHOW_KPI_ICONS ? <Target size={15} /> : undefined} label="Win Rate" value={`${winRate}%`} iconColor="green"
          delta={`${wins} ganadas · ${bes} BE · ${losses} perdidas`} deltaUp={parseFloat(winRate) >= 55} deltaMuted />
        <MetricCard size="hero" icon={SHOW_KPI_ICONS ? <Flame size={15} /> : undefined} label={streaks.currentType === 'win' ? 'Racha ganadora actual' : streaks.currentType === 'loss' ? 'Racha perdedora actual' : 'Racha actual'} iconColor="green"
          value={streaks.currentType ? `${streaks.current}` : '—'}
          deltaUp={streaks.currentType === 'win' ? true : streaks.currentType === 'loss' ? false : undefined}
          delta={streaks.currentType ? 'operaciones seguidas' : 'sin racha activa'} deltaMuted />
        <MetricCard size="hero" icon={SHOW_KPI_ICONS ? <TrendingUp size={15} /> : undefined} label="Mejor racha ganadora"  value={`${streaks.maxWin}`}  delta="operaciones seguidas" deltaUp={true} deltaMuted iconColor="green" />
        <MetricCard size="hero" icon={SHOW_KPI_ICONS ? <TrendingDown size={15} /> : undefined} label="Peor racha perdedora" value={`${streaks.maxLoss}`} delta="operaciones seguidas" deltaUp={false} deltaMuted iconColor="green" />
      </div>

      {/* Columna izquierda: Regla de consistencia (la métrica que más se
          asocia a "consistencia" para un trader de fondeo) + Últimas 20.
          Columna derecha: Calendario de resultados, a la altura de la regla. */}
      <div className="grid-2 section-gap" style={{ alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SHOW_CONSISTENCY_RULE && <ConsistencyRule key={`${group.cycle}|${group.map}|${accountType}|${accountMarket}|${selectedAccountId}`} trades={trades} accounts={accounts} />}

        {/* Streak dots */}
        {/* flex: 1 — estira hasta emparejar la altura del calendario */}
        <Card title="Últimas 20 operaciones" style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {last20.map((t, i) => (
              <div key={t.id} title={`${t.date} · ${t.pair} · ${t.result === 'win' ? 'Ganada' : t.result === 'loss' ? 'Perdida' : 'BE'} · ${t.rPnl >= 0 ? '+' : ''}${t.rPnl}R`}
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: t.result === 'win' ? 'var(--pos2)' : t.result === 'loss' ? 'var(--red2)' : 'var(--neutral2)',
                  border: `1px solid ${t.result === 'win' ? 'var(--pos)' : t.result === 'loss' ? 'var(--red)' : 'var(--neutral)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700,
                  color: t.result === 'win' ? 'var(--pos)' : t.result === 'loss' ? 'var(--red)' : 'var(--neutral)',
                  cursor: 'default',
                }}>
                {/* Ícono en vez de W/L/B (letras en inglés, no se entendían) */}
                {t.result === 'win' ? <Check size={14} strokeWidth={2.5} /> : t.result === 'loss' ? <X size={14} strokeWidth={2.5} /> : <Minus size={14} strokeWidth={2.5} />}
              </div>
            ))}
            {last20.length === 0 && (
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>Sin trades registrados</div>
            )}
          </div>

          <div className="divider" />

          {/* Win / Loss / BE bar */}
          <div style={{ marginBottom: 12 }}>
            <div className="flex-between mb-2">
              <span style={{ fontSize: 12 }}>Ganadas / BE / Perdidas</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{wins} · {bes} · {losses}</span>
            </div>
            {(() => {
              const total = wins + bes + losses || 1
              const wPct  = (wins   / total * 100).toFixed(1)
              const bPct  = (bes    / total * 100).toFixed(1)
              const lPct  = (losses / total * 100).toFixed(1)
              return (<>
                {/* Segmentos separados (gap 3px) con degradé semáforo, cada
                    uno con sus puntas redondeadas — 2026-10-04. */}
                <div style={{ height: 10, display: 'flex', gap: 3 }}>
                  {[
                    { pct: wPct, tone: 'var(--pos)' },
                    { pct: bPct, tone: 'var(--neutral)' },
                    { pct: lPct, tone: 'var(--neg)' },
                  ].filter(seg => parseFloat(seg.pct) > 0).map(seg => (
                    <div key={seg.tone} style={{
                      width: `${seg.pct}%`, borderRadius: 5,
                      background: toneGradient(seg.tone), transition: 'width 0.4s',
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--pos)' }}>{wPct}% ganadas</span>
                  <span style={{ color: 'var(--neutral)'  }}>{bPct}% BE</span>
                  <span style={{ color: 'var(--red)'   }}>{lPct}% perdidas</span>
                </div>
              </>)
            })()}
          </div>

          {/* Streak summary boxes */}
          <div className="grid-2" style={{ gap: 8 }}>
            {[
              { dup: true, label: 'Racha actual',   v: `${streaks.current} ${streaks.currentType === 'win' ? 'ganadoras' : streaks.currentType === 'loss' ? 'perdedoras' : '—'}`, c: streaks.currentType === 'win' ? 'var(--pos)' : streaks.currentType === 'loss' ? 'var(--red)' : 'var(--text2)' },
              { dup: true, label: 'Mejor racha',  v: `${streaks.maxWin} seguidas`,  c: 'var(--pos)' },
              { dup: true, label: 'Peor racha',   v: `${streaks.maxLoss} seguidas`, c: 'var(--red)'   },
              { label: 'Racha más larga de BE',   v: `${streaks.maxBe} seguidas`,   c: 'var(--neutral)'  },
            ].filter(b => SHOW_DUP_STREAK_BOXES || !b.dup).map(({ label, v, c }) => (
              <div key={label} style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: c, fontSize: 13 }}>{v}</div>
              </div>
            ))}
          </div>
        </Card>

        </div>

        {/* Monthly calendar */}
        <Card title="Calendario de resultados">
          {/* Month nav */}
          <div className="flex-between mb-4">
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}>←</button>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>{MONTHS[month]} {year}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MetricPreferenceToggle />
              <button className="btn btn-ghost btn-sm" onClick={nextMonth}>→</button>
            </div>
          </div>

          {/* Monthly stats mini */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { l: 'Operaciones', v: monthTrades.length },
              { l: 'Ganadas',   v: monthWins,   c: 'var(--pos)' },
              { l: 'Perdidas',  v: monthLosses, c: 'var(--red)'   },
              { l: 'PnL',       v: fmtResult(monthValue, unit), c: monthValue >= 0 ? 'var(--pos)' : 'var(--red)' },
              { l: 'Días +',    v: greenDays,   c: 'var(--pos)' },
              { l: 'Días -',    v: redDays,     c: 'var(--red)'   },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>{l}</div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: c ?? 'var(--text)' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
            {DAY_LABELS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', fontWeight: 600, padding: '3px 0' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - firstDay + 1
              if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} />
              const key  = `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
              const data = dayMap[key]
              const isWeekend = (i % 7) >= 5

              let bg = 'transparent', color = isWeekend ? 'var(--text3)' : 'var(--bg5)', border = 'transparent'
              if (data) {
                if (data.result === 'win')   { bg = 'var(--pos2)';    color = 'var(--pos)';    border = 'var(--pos)' }
                if (data.result === 'loss')  { bg = 'var(--red2)';    color = 'var(--red)';    border = 'var(--red)' }
                if (data.result === 'mixed') { bg = 'var(--amber2)';  color = 'var(--amber)';  border = 'var(--amber)' }
              }

              return (
                <div key={i} title={data ? `${data.count} operaciones · ${fmtResult(data.totalDollar, 'dollar')} · ${fmtResult(data.totalPct, 'percent')} · ${fmtResult(data.totalR, 'r')}` : ''}
                  style={{
                    // Alto fijo en vez de aspectRatio 1 (2026-10-04): con la
                    // columna ancha, las celdas cuadradas hacían el mes muy alto.
                    height: 46, borderRadius: 6,
                    background: bg,
                    border: `1px solid ${border}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 1, cursor: data ? 'default' : 'default',
                  }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color, fontWeight: data ? 700 : 400 }}>{dayNum}</span>
                  {data && (
                    <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color, opacity: 0.9 }}>
                      {fmtResult(dayValue(data), unit)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex-center" style={{ marginTop: 12, gap: 12, justifyContent: 'center' }}>
            {[['var(--pos)','Día ganador'],['var(--red)','Día perdedor'],['var(--amber)','Mixto']].map(([c,l]) => (
              <div key={l} className="flex-center" style={{ gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c, opacity: 0.5 }} />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{l}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Setup consistency table — desactivada, ver SHOW_SETUP_CONSISTENCY */}
      {SHOW_SETUP_CONSISTENCY && <SetupConsistency trades={trades} />}
    </div>
    </PremiumGate>
  )
}

/**
 * ConsistencyRule — regla de consistencia de las prop firms: el mejor día
 * no puede superar X% del profit total. Por cuenta (las reglas son por
 * cuenta, mezclar cuentas no significa nada). Límite elegible 30/40/50%
 * hasta que la cuenta tenga la regla cargada como dato.
 */
function ConsistencyRule({ trades, accounts }) {
  // Solo cuentas activas de firmas de futuros — ver FUTURES_FIRMS.
  const activeAccounts = (accounts || []).filter(a => a.status === 'active' && futuresFirmFor(a))
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id ?? '')
  const [limit, setLimit] = useState(futuresFirmFor(activeAccounts[0])?.limit ?? 40)
  const pickAccount = (id) => {
    setAccountId(id)
    const firm = futuresFirmFor(activeAccounts.find(a => a.id === id))
    if (firm) setLimit(firm.limit)
  }

  const { totalProfit, bestDay, tradeCount } = useMemo(() => {
    const byDay = {}
    const accTrades = trades.filter(t => t.accountId === accountId)
    // Mismo cálculo de $ que Portfolio: si el trade no trae dollarPnl
    // (ej. carga manual), cae a rPnl × 100.
    accTrades.forEach(t => {
      byDay[t.date] = (byDay[t.date] || 0) + (t.dollarPnl || t.rPnl * 100 || 0)
    })
    const days = Object.entries(byDay)
    const total = days.reduce((sum, [, v]) => sum + v, 0)
    const best = days.reduce((b, [date, v]) => (!b || v > b.value ? { date, value: v } : b), null)
    return { totalProfit: total, bestDay: best, tradeCount: accTrades.length }
  }, [trades, accountId])

  const fmt = (v) => `$${Math.round(v).toLocaleString()}`
  const hasProfit = totalProfit > 0 && bestDay && bestDay.value > 0
  const pct = hasProfit ? (bestDay.value / totalProfit) * 100 : null
  const ok = pct !== null && pct <= limit
  // Profit total necesario para que el mejor día quede dentro del límite
  const neededTotal = hasProfit ? bestDay.value / (limit / 100) : null

  const selectStyle = { width: 'auto', padding: '5px 8px', paddingRight: 30, fontSize: 12 } // paddingRight: espacio para la flecha global

  return (
    <Card title="Regla de consistencia">
      {activeAccounts.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
          No tenés cuentas activas de futuros. La regla de consistencia (el mejor día no puede superar un % del profit total) la aplican firmas de futuros como Apex o Topstep.
        </div>
      ) : (<>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <select value={accountId} onChange={e => pickAccount(e.target.value)} style={selectStyle}>
          {activeAccounts.map(a => <option key={a.id} value={a.id}>{accountLabel(a)} · {a.type}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Límite del mejor día</span>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={selectStyle}>
          {CONSISTENCY_LIMITS.map(l => <option key={l} value={l}>{l}%</option>)}
        </select>
      </div>

      {!hasProfit ? (
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          {tradeCount === 0
            ? 'Esta cuenta no tiene operaciones cargadas todavía.'
            : <>Profit total <span style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{totalProfit < 0 ? '-' : ''}{fmt(Math.abs(totalProfit))}</span> en {tradeCount} operaciones — la regla solo se aplica con profit positivo.</>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          <div>
            <div className="metric-label">Tu mejor día</div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)', color: ok ? 'var(--text)' : 'var(--neg)', letterSpacing: '-1px' }}>
              {pct.toFixed(0)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>del profit total · {fmt(bestDay.value)} el {bestDay.date}</div>
          </div>

          <div>
            {/* Barra 0–100% con marca del límite */}
            <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--bg3)' }}>
              <div style={{
                width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: 5,
                background: toneGradient(ok ? 'var(--pos)' : 'var(--neg)'), transition: 'width 0.4s',
              }} />
              <div title={`Límite ${limit}%`} style={{
                position: 'absolute', top: -4, bottom: -4, left: `${limit}%`, width: 2,
                background: 'var(--text)', borderRadius: 1,
              }} />
            </div>
            <div style={{ position: 'relative', height: 16, marginTop: 4 }}>
              <span style={{ position: 'absolute', left: `${limit}%`, transform: 'translateX(-50%)', fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                límite {limit}%
              </span>
            </div>
            <div style={{ fontSize: 13, marginTop: 8, color: ok ? 'var(--pos)' : 'var(--neg)', fontWeight: 700 }}>
              {ok ? 'Dentro del límite' : 'Supera el límite'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {ok
                ? <>Profit total {fmt(totalProfit)} — tu mejor día podría llegar hasta {fmt(totalProfit * limit / 100)} sin pasarte.</>
                : <>Profit total {fmt(totalProfit)} — necesitás llegar a {fmt(neededTotal)} (sin otro día más grande) para cumplir la regla.</>}
            </div>
          </div>
        </div>
      )}
      </>)}
    </Card>
  )
}

function SetupConsistency({ trades }) {
  const bySetup = useMemo(() => {
    const map = {}
    trades.forEach(t => {
      const s = t.setup || 'Sin setup'
      if (!map[s]) map[s] = { wins: 0, losses: 0, totalR: 0 }
      if (t.result === 'win')  map[s].wins++
      if (t.result === 'loss') map[s].losses++
      map[s].totalR = parseFloat((map[s].totalR + t.rPnl).toFixed(2))
    })
    return Object.entries(map)
      .map(([setup, v]) => ({ setup, ...v, total: v.wins + v.losses, wr: v.wins + v.losses ? Math.round(v.wins / (v.wins + v.losses) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
  }, [trades])

  return (
    <Card title="Consistencia por setup">
      <table>
        <thead>
          <tr>
            <th>Setup</th><th>Trades</th><th>Wins</th><th>Losses</th>
            <th>Win Rate</th><th>PnL (R)</th><th>Consistencia</th>
          </tr>
        </thead>
        <tbody>
          {bySetup.map(({ setup, total, wins, losses, wr, totalR }) => (
            <tr key={setup}>
              <td style={{ fontWeight: 500 }}>{setup}</td>
              <td className="mono">{total}</td>
              <td className="mono up">{wins}</td>
              <td className="mono down">{losses}</td>
              <td>
                <div className="flex-center" style={{ gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                    <div style={{ width: `${wr}%`, height: '100%', background: wr >= 60 ? 'var(--pos)' : wr >= 45 ? 'var(--amber)' : 'var(--red)', borderRadius: 3 }} />
                  </div>
                  <span className="mono" style={{ fontSize: 12, color: wr >= 60 ? 'var(--pos)' : wr >= 45 ? 'var(--amber)' : 'var(--red)', minWidth: 34 }}>{wr}%</span>
                </div>
              </td>
              <td className={`mono ${totalR >= 0 ? 'up' : 'down'}`}>{totalR >= 0 ? '+' : ''}{totalR}R</td>
              <td>
                <span style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600,
                  background: wr >= 60 ? 'var(--pos2)' : wr >= 45 ? 'var(--amber2)' : 'var(--red2)',
                  color:      wr >= 60 ? 'var(--pos)'  : wr >= 45 ? 'var(--amber)'  : 'var(--red)',
                }}>
                  {wr >= 60 ? 'BUENO' : wr >= 45 ? 'REGULAR' : 'BAJO'}
                </span>
              </td>
            </tr>
          ))}
          {bySetup.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px 0' }}>Sin trades</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}
