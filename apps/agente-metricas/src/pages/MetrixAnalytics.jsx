import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, BarChart, Bar,
  CartesianGrid, Legend, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, Activity, Award, Zap, BarChart3, ArrowRight, Check, AlertTriangle, X } from 'lucide-react'
import { Card, PageHeader, Badge, IconCircle } from '@/components/ui'
import PremiumGate from '@/components/premium/PremiumGate'
import { useStore } from '@/store/useStore'
import {
  filterTradesByPeriod, filterTradesByPreviousPeriod, filterTradesByAccountScope, accountLabel,
  pctDelta, computeStats, EquityTooltip,
} from './dashboard/dashboardHelpers'
import { Chips } from '@/components/accounts/accountFormShared'
import { useAccountGroupFilter, GroupFilterSelects } from '@/components/accounts/GroupFilters'
import { MetricsFiltersButton, ActiveFilterTags } from '@/components/accounts/MetricsFilters'
import { ACCOUNT_TYPE_FILTER_OPTIONS, ACCOUNT_STATUS_FILTER_OPTIONS, MARKET_FILTER_OPTIONS, PERIOD_FILTER_OPTIONS, byAccountStatus, accountOptionLabel } from '@/components/accounts/metricsFilterOptions'

// ─────────────────────────────────────────────
//  METRIX ANALYTICS (pestaña "Intermedio")
//  Centro de descubrimiento de patrones
//  Responde a: "¿Cuáles son mis patrones de trading?"
//
//  4 Secciones:
//  1. Consistencia — Evolución, rachas, regularidad
//  2. Rentabilidad — R, $, %, PF, Expectancy
//  3. Patrones — Mejor/peor día, hora, setup
//  4. Distribuciones — Gráficos de breakdown
// ─────────────────────────────────────────────

/**
 * ConsistencySection — Evolución temporal y regularidad
 */
function ConsistencySection({ stats }) {
  if (!stats) return null

  // Calcular rachas simples desde la equity curve
  const streaks = (() => {
    if (!stats.equityCurve.length) return { longest: 0, current: 0 }
    const sorted = (stats.trades || []).sort((a, b) => a.datetime?.localeCompare(b.datetime) ?? 0)
    let currentWinStreak = 0, longestWinStreak = 0
    let currentLossStreak = 0, longestLossStreak = 0
    
    sorted.forEach(t => {
      if (t.result === 'win') {
        currentWinStreak++
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak)
        currentLossStreak = 0
      } else if (t.result === 'loss') {
        currentLossStreak++
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak)
        currentWinStreak = 0
      }
    })
    return { longestWin: longestWinStreak, longestLoss: longestLossStreak }
  })()

  return (
    <div className="grid-2 section-gap" style={{ gap: 12 }}>
      {/* Regularidad - Consistency Score */}
      <Card title="Regularidad de Resultados">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Consistency Score
            </div>
            <div style={{
              fontSize: 48, fontWeight: 700,
              color: stats.consistency >= 70 ? 'var(--pos)' : stats.consistency >= 40 ? 'var(--neutral)' : 'var(--neg)',
              fontFamily: 'var(--mono)', lineHeight: 1,
            }}>
              {stats.consistency}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              Suavidad de la curva de equity
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border2)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <div>
              <div style={{ color: 'var(--text3)', marginBottom: 4, fontSize: 12 }}>Mejor racha</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--pos)' }}>
                +{streaks.longestWin}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>wins consecutivos</div>
            </div>
            <div>
              <div style={{ color: 'var(--text3)', marginBottom: 4, fontSize: 12 }}>Peor racha</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--neg)' }}>
                -{streaks.longestLoss}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>losses consecutivos</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Sharpe & ROR */}
      <Card title="Riesgo Ajustado">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Sharpe Ratio
            </div>
            <div style={{
              fontSize: 36, fontWeight: 700, color: stats.sharpe >= 1 ? 'var(--pos)' : 'var(--neutral)',
              fontFamily: 'var(--mono)',
            }}>
              {stats.sharpe}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              {stats.sharpe >= 2 && 'Excelente (2+)'}
              {stats.sharpe >= 1 && stats.sharpe < 2 && 'Bueno (1-2)'}
              {stats.sharpe < 1 && 'Mejorable (<1)'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Risk of Ruin
            </div>
            <div style={{
              fontSize: 36, fontWeight: 700,
              color: stats.ror <= 5 ? 'var(--pos)' : stats.ror <= 20 ? 'var(--neutral)' : 'var(--neg)',
              fontFamily: 'var(--mono)',
            }}>
              {stats.ror}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              probabilidad de ruina
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

/**
 * ProfitabilitySection — Métricas de rentabilidad (R > $)
 */
function ProfitabilitySection({ stats }) {
  if (!stats) return null

  const metrics = [
    {
      label: 'R Total',
      value: `${stats.totalR >= 0 ? '+' : ''}${stats.totalR}R`,
      secondary: `${stats.totalDollar >= 0 ? '+' : ''}$${Math.abs(stats.totalDollar).toLocaleString()}`,
      color: stats.totalR >= 0 ? 'var(--pos)' : 'var(--neg)',
    },
    {
      label: 'Profit Factor',
      value: stats.profitFactor,
      secondary: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {stats.profitFactor >= 1.5
            ? <Check size={12} />
            : stats.profitFactor >= 1
              ? <AlertTriangle size={12} />
              : <X size={12} />}
          {stats.profitFactor >= 1.5 ? 'Sano' : stats.profitFactor >= 1 ? 'Mínimo' : 'Deficiente'}
        </span>
      ),
      color: stats.profitFactor >= 1.5 ? 'var(--pos)' : stats.profitFactor >= 1 ? 'var(--neutral)' : 'var(--neg)',
    },
    {
      label: 'Expectativa',
      value: `${stats.expectancy >= 0 ? '+' : ''}${stats.expectancy}R`,
      secondary: `${stats.expectancyPctCapital >= 0 ? '+' : ''}${stats.expectancyPctCapital}% del capital`,
      color: stats.expectancy >= 0 ? 'var(--pos)' : 'var(--neg)',
    },
    {
      label: 'Win Rate',
      value: `${stats.winRateReal}%`,
      secondary: `${stats.wins}/${stats.wins + stats.losses} decisivos`,
      color: stats.winRateReal >= 55 ? 'var(--pos)' : stats.winRateReal >= 45 ? 'var(--neutral)' : 'var(--neg)',
    },
  ]

  return (
    <div className="grid-4 section-gap" style={{ gap: 12 }}>
      {metrics.map((m, i) => (
        <Card key={i} title={m.label}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              fontSize: 36, fontWeight: 700, color: m.color,
              fontFamily: 'var(--mono)', marginBottom: 8,
            }}>
              {m.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>
              {m.secondary}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

/**
 * PatternsSection — Mejores y peores patrones
 */
function PatternsSection({ stats }) {
  if (!stats) return null

  // Extraer peor día, hora (ordenando inverso)
  const worstDay = stats.byWeekday && stats.byWeekday.length > 0
    ? [...stats.byWeekday].sort((a, b) => a.r - b.r)[0]
    : null

  const worstHour = stats.byHour && stats.byHour.length > 0
    ? [...stats.byHour].sort((a, b) => a.avgR - b.avgR)[0]
    : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
      {/* Mejor & Peor Día */}
      <Card title="Por Día de la Semana">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
              Mejor
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{stats.bestDay?.day}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--pos)', fontFamily: 'var(--mono)', letterSpacing: '-1px' }}>
                +{stats.bestDay?.r}R
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {stats.bestDay?.count} operaciones
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border2)' }} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
              Peor
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{worstDay?.day}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--neg)', fontFamily: 'var(--mono)', letterSpacing: '-1px' }}>
                {worstDay?.r >= 0 ? '+' : ''}{worstDay?.r}R
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {worstDay?.count} operaciones
            </div>
          </div>
        </div>
      </Card>

      {/* Mejor & Peor Hora */}
      <Card title="Por Horario">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
              Mejor
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--mono)' }}>
                {String(stats.bestHour?.hour).padStart(2, '0')}:00
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--pos)', fontFamily: 'var(--mono)', letterSpacing: '-1px' }}>
                +{stats.bestHour?.avgR}R
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              horario más rentable
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border2)' }} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
              Peor
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--mono)' }}>
                {String(worstHour?.hour).padStart(2, '0')}:00
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--neg)', fontFamily: 'var(--mono)', letterSpacing: '-1px' }}>
                {worstHour?.avgR >= 0 ? '+' : ''}{worstHour?.avgR}R
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              horario con menor rendimiento
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

/**
 * MfeMaeBlock — MFE / MAE reales, calculados a partir de los trades
 * del período. mfeR/maeR son campos opcionales que el usuario rellena
 * a mano al registrar/editar un trade en Historial (no son datos
 * inventados ni simulados) — por eso cada tarjeta muestra también
 * cuántos trades tienen el dato relleno, ya que no todos lo tendrán.
 */
function MfeMaeBlock({ trades }) {
  const withMfe = trades.filter(t => t.mfeR != null && t.mfeR > 0)
  const withMae = trades.filter(t => t.maeR != null && t.maeR > 0)

  const avgMfe = withMfe.length
    ? (withMfe.reduce((s, t) => s + t.mfeR, 0) / withMfe.length).toFixed(2)
    : null
  // Eficiencia: cuánto del movimiento a favor (MFE) capturaste de verdad
  // en el resultado (rPnl) — mismo cálculo que ya existe por trade en
  // el formulario de Historial, aquí promediado sobre las ganadoras.
  const winnersWithMfe = withMfe.filter(t => t.rPnl > 0)
  const avgEfficiency = winnersWithMfe.length
    ? (winnersWithMfe.reduce((s, t) => s + Math.min(t.rPnl / t.mfeR, 1), 0) / winnersWithMfe.length * 100).toFixed(0)
    : null

  const avgMae = withMae.length
    ? (withMae.reduce((s, t) => s + t.maeR, 0) / withMae.length).toFixed(2)
    : null

  const items = [
    {
      title: 'MFE — Máxima Excursión Favorable',
      icon: TrendingUp,
      count: withMfe.length,
      main: avgMfe !== null ? `${avgMfe}R` : null,
      mainLabel: 'de media a favor antes de cerrar',
      secondary: avgEfficiency !== null ? `${avgEfficiency}%` : null,
      secondaryLabel: 'eficiencia media (cuánto del movimiento capturaste)',
      empty: 'Todavía no registraste MFE en ningún trade — es un campo opcional al añadir o editar un trade en Historial.',
    },
    {
      title: 'MAE — Máxima Excursión Adversa',
      icon: TrendingDown,
      count: withMae.length,
      main: avgMae !== null ? `${avgMae}R` : null,
      mainLabel: 'de media en contra antes de cerrar/recuperarse',
      secondary: null,
      secondaryLabel: null,
      empty: 'Todavía no registraste MAE en ningún trade — es un campo opcional al añadir o editar un trade en Historial.',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
      {items.map(item => {
        const Icon = item.icon
        return (
          <Card key={item.title} title={item.title} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconCircle icon={<Icon size={16} />} color="primary" size={30} />
                {item.count > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.count} trades con dato</span>
                )}
              </div>

              {item.main !== null ? (
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                    {item.main}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{item.mainLabel}</div>
                  {item.secondary !== null && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border2)' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--pos)' }}>
                        {item.secondary}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{item.secondaryLabel}</div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, margin: 0 }}>
                  {item.empty}
                </p>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// Fila de filtros anterior (todo a la vista). Rediseño 01/11/2026,
// igual que Métricas Básico: Cuenta y Periodo a la vista y el resto en
// "Filtros" (MetricsFilters). En true vuelve la fila anterior.
const METRICS_FILTERS_V1 = false

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────

export default function MetrixAnalytics() {
  const navigate = useNavigate()
  const trades = useStore(s => s.trades)
  const accounts = useStore(s => s.accounts)
  // Ciclo de compra y estrategia (como en Portafolio): recortan cuentas
  // y trades antes del resto de filtros.
  const group = useAccountGroupFilter(trades, accounts)

  const [accountType, setAccountType] = useState('all')
  const [accountMarket, setAccountMarket] = useState('all')
  const [accountStatus, setAccountStatus] = useState('all')
  const [selectedAccountId, setSelectedAccountId] = useState('all')
  const [selectedPeriod, setPeriod] = useState('ALL')

  // Filtrar trades según selección (Sprint 31: mismo sistema de
  // filtros que Dashboard). Cuenta concreta tiene prioridad sobre
  // tipo de cuenta — nunca se mezclan datos de otras cuentas.
  const filteredTrades = useMemo(
    () => filterTradesByAccountScope(group.groupTrades, group.groupAccounts, { accountType, accountStatus, accountMarket, accountId: selectedAccountId }),
    [group.groupTrades, group.groupAccounts, accountType, accountStatus, accountMarket, selectedAccountId]
  )

  const periodFilteredTrades = useMemo(
    () => filterTradesByPeriod(filteredTrades, selectedPeriod),
    [filteredTrades, selectedPeriod]
  )

  const initialCapital = 10000

  // Props compartidas del botón "Filtros" y sus etiquetas activas
  const filterProps = {
    accountType, setAccountType, market: accountMarket, setMarket: setAccountMarket,
    status: accountStatus, setStatus: setAccountStatus,
    group, accounts, onScopeChange: () => setSelectedAccountId('all'),
  }
  // Sin trades computeStats() devuelve null: se mantiene null (antes el
  // spread lo convertía en { trades: [] }, el estado vacío no salía y
  // la página se quedaba en negro al filtrar sin resultados).
  const stats = useMemo(() => {
    const base = computeStats(periodFilteredTrades, initialCapital)
    return base ? { ...base, rowTrades: periodFilteredTrades } : null
  }, [periodFilteredTrades])

  return (
    <PremiumGate feature="metrixAnalytics">
    <div className="page-inner">
      {/* Header */}
      <PageHeader 
        title="Intermedio" 
        subtitle={`Descubrimiento de patrones de rendimiento${stats ? ` · ${stats.total} trades` : ''}`} 
      />

      {/* Filtros — mismo diseño de desplegables que Dashboard (Sprint 31) */}
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
        <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>Estado</label>
          <Chips size="xs" label="Estado" value={accountStatus} options={ACCOUNT_STATUS_FILTER_OPTIONS}
            onChange={v => { setAccountStatus(v); setSelectedAccountId('all') }} />
          {/* <select value={accountStatus} onChange={e => { setAccountStatus(e.target.value); setSelectedAccountId('all') }}>
            <option value="all">Todas</option>
            <option value="active">Activas</option>
            <option value="approved">Completadas</option>
            <option value="lost">Perdidas</option>
          </select> */}
        </div>
        </>)}
        {/* Ancho fijo: antes se estiraba y empujaba los otros filtros a otra fila */}
        <div className="form-group" style={{ marginBottom: 0, width: 220, flex: '0 0 220px' }}>
          <label>Cuenta</label>
          <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
            <option value="all">Todas las cuentas</option>
            {group.groupAccounts
              .filter(a => (accountType === 'all' || a.type === accountType) && (accountStatus === 'all' || a.status === accountStatus) && (accountMarket === 'all' || a.market === accountMarket))
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
          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', paddingBottom: 9 }}>
            {stats.total} trades
          </span>
        )}
      </div>

      {/* Empty state */}
      {!stats && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text3)', fontSize: 12 }}>
          No hay trades para el filtro seleccionado
        </div>
      )}

      {stats && (
        <>
          {/* ══════════════════════════════════════
              SECCIÓN 1: CONSISTENCIA
          ══════════════════════════════════════ */}
          <div className="section-gap">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h2 style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '1.2px',
                textTransform: 'uppercase', color: 'var(--section-accent)', whiteSpace: 'nowrap',
              }}>
                1. Consistencia
              </h2>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <ConsistencySection stats={stats} />
          </div>

          {/* ══════════════════════════════════════
              SECCIÓN 2: RENTABILIDAD — comentada, se repite con
              Metrix Básico (R Total, Profit Factor, Expectancy, Win Rate)
          ══════════════════════════════════════ */}
          {/*
          <div className="section-gap">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h2 style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '1.2px',
                textTransform: 'uppercase', color: 'var(--section-accent)', whiteSpace: 'nowrap',
              }}>
                2. Rentabilidad
              </h2>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <ProfitabilitySection stats={stats} />
          </div>
          */}

          {/* ══════════════════════════════════════
              SECCIÓN 3: PATRONES — comentada, se repite con
              Metrix Básico (Resultados por sesión/hora/día, Rendimiento por Setup)
          ══════════════════════════════════════ */}
          {/*
          <div className="section-gap">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h2 style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '1.2px',
                textTransform: 'uppercase', color: 'var(--section-accent)', whiteSpace: 'nowrap',
              }}>
                2. Patrones Clave
              </h2>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <PatternsSection stats={stats} />
          </div>
          */}

          {/* ══════════════════════════════════════
              MFE / MAE — reales (mfeR/maeR, campos opcionales
              registrados a mano en Historial)
          ══════════════════════════════════════ */}
          <div className="section-gap">
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h2 style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: '1.2px',
                  textTransform: 'uppercase', color: 'var(--section-accent)', whiteSpace: 'nowrap',
                }}>
                  2. Excursión Favorable / Adversa
                </h2>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Análisis de excursión favorable y adversa por trade
              </p>
            </div>
            <MfeMaeBlock trades={stats.trades} />
          </div>
        </>
      )}
    </div>
    </PremiumGate>
  )
}