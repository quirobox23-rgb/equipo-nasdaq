import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Beaker, TrendingUp, AlertCircle, Target, Zap, ArrowRight, Check, AlertTriangle } from 'lucide-react'
import { Card, PageHeader, Badge, IconCircle } from '@/components/ui'
import PremiumGate from '@/components/premium/PremiumGate'
import { useStore } from '@/store/useStore'
import {
  filterTradesByPeriod, filterTradesByAccountScope, accountLabel,
  computeStats,
} from './dashboard/dashboardHelpers'
import { Chips } from '@/components/accounts/accountFormShared'
import { useAccountGroupFilter, GroupFilterSelects } from '@/components/accounts/GroupFilters'
import { MetricsFiltersButton, ActiveFilterTags } from '@/components/accounts/MetricsFilters'
import { ACCOUNT_TYPE_FILTER_OPTIONS, ACCOUNT_STATUS_FILTER_OPTIONS, MARKET_FILTER_OPTIONS, PERIOD_FILTER_OPTIONS, byAccountStatus, accountOptionLabel } from '@/components/accounts/metricsFilterOptions'

// ─────────────────────────────────────────────
//  METRIX LAB (pestaña "Pro")
//  Laboratorio de simulación y análisis de riesgo
//  Responde a: "¿Qué pasaría si...?"
//
//  3 Bloques:
//  1. Risk — Kelly, ROR, Position Size
//  2. Simulación — Monte Carlo protagonista
//  3. Escenarios — Estructura para futuras simulaciones
// ─────────────────────────────────────────────

/**
 * RiskBlock — Kelly, Risk of Ruin, Position Sizing
 */
function RiskBlock({ stats }) {
  if (!stats) return null

  // Kelly Criterion: (WR% * AvgWin - LR% * |AvgLoss|) / AvgWin
  // Simplified approach: using win rate real y avg win/loss
  const kellyValue = (() => {
    if (!stats.avgWin || stats.avgWin === 0) return 0
    const w = stats.winRateReal / 100
    const avgWinAbs = Math.abs(stats.avgWin)
    const avgLossAbs = Math.abs(stats.avgLoss)
    if (avgWinAbs === 0) return 0
    const kelly = (w * avgWinAbs - (1 - w) * avgLossAbs) / avgWinAbs
    return Math.max(0, Math.min(kelly * 100, 100)) // Clamped 0-100%
  })()

  const kellyMult = kellyValue / 100
  const recommendedSize = (kellyMult * 0.5).toFixed(3) // Half Kelly for safety

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
      {/* Kelly Criterion */}
      <Card title="Kelly Criterion">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Fracción Óptima
            </div>
            <div style={{
              fontSize: 36, fontWeight: 700, color: kellyValue > 0 ? 'var(--pos)' : 'var(--neutral)',
              fontFamily: 'var(--mono)', lineHeight: 1,
            }}>
              {kellyValue.toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              del capital por trade
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border2)' }} />

          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Recomendación (Half Kelly)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 3 }}>Fracción</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
                  {recommendedSize}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 3 }}>Estado</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: kellyValue > 0 ? 'var(--pos)' : 'var(--neutral)' }}>
                  {kellyValue > 0 ? <Check size={13} /> : <AlertTriangle size={13} />}
                  {kellyValue > 0 ? 'Rentable' : 'Revisar'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: 10, fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
            Formula: (WR% × AvgWin - LR% × |AvgLoss|) / AvgWin
          </div>
        </div>
      </Card>

      {/* Risk of Ruin */}
      <Card title="Risk of Ruin">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Probabilidad de Ruina
            </div>
            <div style={{
              fontSize: 36, fontWeight: 700,
              color: stats.ror <= 5 ? 'var(--pos)' : stats.ror <= 20 ? 'var(--neutral)' : 'var(--neg)',
              fontFamily: 'var(--mono)', lineHeight: 1,
            }}>
              {stats.ror}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              sobre el capital inicial
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border2)' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 3 }}>Interpretación</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {stats.ror <= 5 && 'Muy seguro'}
                {stats.ror > 5 && stats.ror <= 20 && 'Aceptable'}
                {stats.ror > 20 && 'Alto riesgo'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 3 }}>Win Rate</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)' }}>
                {stats.winRateReal}%
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: 10, fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
            Monte Carlo: Probabilidad de quedar en 0 antes de alcanzar ganancias
          </div>
        </div>
      </Card>

      {/* Position Sizing */}
      <Card title="Dimensionamiento de Posición">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Lot Promedio
            </div>
            <div style={{
              fontSize: 36, fontWeight: 700, color: 'var(--text)',
              fontFamily: 'var(--mono)', lineHeight: 1,
            }}>
              {stats.lotStats?.avg ? stats.lotStats.avg.toFixed(2) : 'N/A'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              contratos/lotes operados
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border2)' }} />

          {stats.lotStats && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Análisis
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--text3)' }}>Rango: </span>
                  <span style={{ fontFamily: 'var(--mono)' }}>
                    {stats.lotStats.min} - {stats.lotStats.max}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text3)' }}>Std: </span>
                  <span style={{ fontFamily: 'var(--mono)' }}>
                    {stats.lotStats.std}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text3)' }}>CV: </span>
                  <span style={{ fontFamily: 'var(--mono)', color: stats.lotStats.cv <= 20 ? 'var(--pos)' : stats.lotStats.cv <= 50 ? 'var(--neutral)' : 'var(--neg)' }}>
                    {stats.lotStats.cv}%
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text3)' }}>Trades: </span>
                  <span style={{ fontFamily: 'var(--mono)' }}>
                    {stats.lotStats.count}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: 8, marginTop: 10, fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>
                {stats.lotStats.cv <= 20
                  ? <Check size={13} style={{ color: 'var(--pos)', flexShrink: 0 }} />
                  : <AlertTriangle size={13} style={{ color: stats.lotStats.cv <= 50 ? 'var(--neutral)' : 'var(--neg)', flexShrink: 0 }} />}
                {stats.lotStats.cv <= 20
                  ? 'Dimensionamiento consistente'
                  : 'Variabilidad en el tamaño de posición'}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

/**
 * SimulationBlock — Monte Carlo como simulador principal
 */
function SimulationBlock({ navigate, stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
      <Card title="Simulador Monte Carlo" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Herramienta Principal
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
              Simula múltiples trayectorias de tu curva de equity basándose en tus trades históricos.
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border2)' }} />

          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Qué descubrirás
            </div>
            <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8, paddingLeft: 0, margin: 0, listStyle: 'none' }}>
              <li style={{ marginBottom: 4 }}>• Rango probable de resultados futuros</li>
              <li style={{ marginBottom: 4 }}>• Peores casos y mejores casos</li>
              <li style={{ marginBottom: 4 }}>• Drawdown máximo esperado</li>
              <li>• Confianza en tu sistema</li>
            </ul>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <button
              onClick={() => navigate('/montecarlo')}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <Zap size={16} />
              Ir a Monte Carlo
            </button>
          </div>
        </div>
      </Card>

      {/* Resumen de Monte Carlo basado en stats */}
      {stats && (
        <Card title="Resumen de Riesgo">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                Máximo Drawdown Observado
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--neg)', fontFamily: 'var(--mono)' }}>
                {stats.maxDD}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                desde el pico más alto
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border2)' }} />

            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                Sharpe Ratio
              </div>
              <div style={{
                fontSize: 24, fontWeight: 700,
                color: stats.sharpe >= 1 ? 'var(--pos)' : 'var(--neutral)',
                fontFamily: 'var(--mono)',
              }}>
                {stats.sharpe}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                rendimiento ajustado por riesgo
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border2)' }} />

            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                Trades Analizados
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
                {stats.total}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                datos para simular
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

/**
 * ScenariosBlock — Estructura preparada para futuras simulaciones
 */
function ScenariosBlock() {
  const scenarios = [
    {
      title: 'Cambios en Win Rate',
      description: 'Simula cómo afectaría cambiar tu porcentaje de operaciones ganadoras',
      icon: TrendingUp,
      status: 'proximamente',
    },
    {
      title: 'Cambios en R:R',
      description: 'Experimenta con diferentes ratios de riesgo-recompensa',
      icon: Target,
      status: 'proximamente',
    },
    {
      title: 'Cambios en Riesgo',
      description: 'Ajusta el porcentaje de riesgo por trade y observa el impacto',
      icon: AlertCircle,
      status: 'proximamente',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
      {scenarios.map(scenario => {
        const Icon = scenario.icon
        return (
          <Card key={scenario.title} title={scenario.title} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <IconCircle icon={<Icon size={16} />} color="primary" size={30} />
                  <Badge variant="grey">Próximamente</Badge>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
                  {scenario.description}
                </p>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button
                  disabled
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 6,
                    background: 'var(--bg3)', color: 'var(--text3)', fontSize: 12, fontWeight: 600,
                    border: '1px solid var(--border2)', cursor: 'not-allowed', fontFamily: 'var(--font)',
                    opacity: 0.5,
                  }}
                >
                  En desarrollo...
                </button>
              </div>
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

export default function MetrixLab() {
  const navigate = useNavigate()
  const trades = useStore(s => s.trades)
  const accounts = useStore(s => s.accounts)
  // Ciclo de compra y estrategia (como en Portafolio): recortan cuentas
  // y trades antes del resto de filtros.
  const group = useAccountGroupFilter(trades, accounts)

  const [accountType, setAccountType] = useState('all')
  const [accountMarket, setAccountMarket] = useState('all')
  const [selectedAccountId, setSelectedAccountId] = useState('all')
  const [selectedPeriod, setPeriod] = useState('ALL')

  // Filtrar trades según selección (Sprint 31: mismo sistema de
  // filtros que Dashboard). Cuenta concreta tiene prioridad sobre
  // tipo de cuenta — nunca se mezclan datos de otras cuentas.
  const filteredTrades = useMemo(
    () => filterTradesByAccountScope(group.groupTrades, group.groupAccounts, { accountType, accountMarket, accountId: selectedAccountId }),
    [group.groupTrades, group.groupAccounts, accountType, accountMarket, selectedAccountId]
  )

  const periodFilteredTrades = useMemo(
    () => filterTradesByPeriod(filteredTrades, selectedPeriod),
    [filteredTrades, selectedPeriod]
  )

  const initialCapital = 10000

  // Props compartidas del botón "Filtros" y sus etiquetas activas
  const filterProps = {
    accountType, setAccountType, market: accountMarket, setMarket: setAccountMarket,
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
    <PremiumGate feature="metrixLab">
    <div className="page-inner">
      {/* Header */}
      <PageHeader 
        title="Pro" 
        subtitle={`Laboratorio de simulación y análisis de riesgo${stats ? ` · ${stats.total} trades` : ''}`} 
      />

      {/* Filtros — mismo diseño de desplegables que Dashboard (Sprint 31) */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32, alignItems: 'flex-end' }}>
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
              BLOQUE 1: RISK
          ══════════════════════════════════════ */}
          <div className="section-gap">
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h2 style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: '1.2px',
                  textTransform: 'uppercase', color: 'var(--section-accent)', whiteSpace: 'nowrap',
                }}>
                  1. Análisis de Riesgo
                </h2>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Kelly Criterion, Risk of Ruin y Dimensionamiento de Posición
              </p>
            </div>
            <RiskBlock stats={stats} />
          </div>

          {/* ══════════════════════════════════════
              BLOQUE 2: SIMULACIÓN
          ══════════════════════════════════════ */}
          <div className="section-gap">
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h2 style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: '1.2px',
                  textTransform: 'uppercase', color: 'var(--section-accent)', whiteSpace: 'nowrap',
                }}>
                  2. Simulación
                </h2>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Simula múltiples escenarios futuros basados en tu historial
              </p>
            </div>
            <SimulationBlock navigate={navigate} stats={stats} />
          </div>

          {/* ══════════════════════════════════════
              BLOQUE 3: ESCENARIOS (PROXIMAMENTE)
          ══════════════════════════════════════ */}
          <div className="section-gap">
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h2 style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: '1.2px',
                  textTransform: 'uppercase', color: 'var(--section-accent)', whiteSpace: 'nowrap',
                }}>
                  3. Escenarios (Próximamente)
                </h2>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Experimenta con cambios hipotéticos en tus métricas clave
              </p>
            </div>
            <ScenariosBlock />
          </div>
        </>
      )}
    </div>
    </PremiumGate>
  )
}