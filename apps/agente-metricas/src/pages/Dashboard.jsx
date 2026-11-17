import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from 'recharts'
import {
  Calendar as CalendarIcon, Sun, Plus, Wallet, Trophy, XCircle, Layers,
  AlertTriangle, Rocket, ThumbsDown, ThumbsUp, BarChart, ArrowRight, ListChecks, Briefcase, Map, Lightbulb, PieChart, Compass, BrainCircuit,
} from 'lucide-react'
import {
  Card, PageHeader, MetricCard, IconCircle, IconDisplay, ActionCard,
} from '@/components/ui'
import MetricDisplay from '@/components/ui/MetricDisplay'
import MetricPreferenceToggle from '@/components/ui/MetricPreferenceToggle'
import { useStore } from '@/store/useStore'
import {
  filterTradesByPeriod, filterTradesByPreviousPeriod,
  pctDelta, computeStats, EquityTooltip,
} from './dashboard/dashboardHelpers'
import { computeAccountMetrics } from '@/config/blueprintMatchEngine'
import { SessionBars, InstrumentBars, WeekdayChart, HourHeatmap, RRBuckets } from './dashboard/DashboardBreakdown'
import { tradeDollar, sumTradeDollars } from '@/lib/tradeDollar'
import { hourClockLabel } from './dashboard/dashboardHelpers'

// ─────────────────────────────────────────────
//  DASHBOARD — dos vistas distintas según el contexto:
//
//  1. Standalone (ruta "/inicio", sin accountId): la "portada" —
//     estado de cuentas, capital bajo gestión, PnL del mes, cuentas
//     destacadas, accesos rápidos. Resumen de 10 segundos.
//
//  2. Embebido (Portfolio → "Ver dashboard" en una cuenta, con
//     accountId): la vista de métricas COMPLETA de siempre (Equity,
//     franja de 6 métricas, sesión/día/instrumento, Mentor IA, Score),
//     escopada a esa única cuenta — tal cual funcionaba antes de la
//     "portada". No se tocó nada de esta parte.
// ─────────────────────────────────────────────

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const DIAS = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
]

// Saludo por franja horaria — no hay nombre de usuario disponible
// (profiles solo tiene id/email/tier, sin display name), así que no
// se puede personalizar más que esto.
function greeting(hour) {
  if (hour < 12) return '¡Buenos días!'
  if (hour < 19) return '¡Buenas tardes!'
  return '¡Buenas noches!'
}

// ═══════════════════════════════════════════════
//  PORTADA (sin accountId)
// ═══════════════════════════════════════════════

function StatusCard({ icon: Icon, label, value, color }) {
  return (
    <Card style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <IconCircle icon={<Icon size={14} />} size={26} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--mono)', color: color ?? 'var(--text)' }}>
        {value}
      </div>
    </Card>
  )
}

// Desglose fijo de "Capital bajo gestión" (Challenge · Funded) debajo del
// total — sin filtro clickeable: el dato se lee directo. Montos en k/M
// para que entre en una línea en la columna angosta.
const fmtCompactUsd = (v) => {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1).replace(/\.0$/, '')}k`
  return `$${Math.round(v)}`
}
function CapitalBreakdown({ challenge, funded }) {
  return (
    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
      Challenge <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text2)' }}>{fmtCompactUsd(challenge)}</span>
      <span style={{ margin: '0 6px' }}>·</span>
      Funded <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text2)' }}>{fmtCompactUsd(funded)}</span>
    </div>
  )
}

// Mismo patrón "Encabezado de sección con divisor" que Metrix Básico/
// Analítica (ver /styleguide), variante gris — el verde ya está en
// uso como elemento dominante en la portada (Ver mis métricas),
// repetirlo acá sería un segundo foco de color (regla 6-3-1).
function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <span style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '1.2px',
        textTransform: 'uppercase', color: 'var(--text2)', whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

// Mismo tratamiento que la "Card interactiva" de Mapas (ver
// /styleguide → "Cards" → Card interactiva): gradiente diagonal
// bg2→bg3, barra superior var(--accent-gradient), hover eleva 4px +
// borde/sombra verde. Ahí se usa para cards grandes clickeables; acá
// el mismo lenguaje visual pero en un botón chico de acceso rápido.
function QuickAccessButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '16px', borderRadius: 12,
        background: 'linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)',
        border: '1px solid var(--border2)', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.borderColor = 'var(--brand)'
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(59,130,246,0.15)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--border2)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--accent-gradient)' }} />
      <IconCircle icon={icon} size={32} />
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
    </button>
  )
}

function AccountAlertRow({ account, pct, tone, onClick }) {
  const color = tone === 'danger' ? 'var(--neg)' : 'var(--pos)'
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
        background: 'var(--bg3)', marginBottom: 6,
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{account.firm}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--mono)', color }}>{pct}%</span>
    </div>
  )
}

function DashboardPortada({ navigate, accounts, trades }) {
  const now = new Date()
  const fullDateLabel = `${DIAS[now.getDay()].charAt(0).toUpperCase()}${DIAS[now.getDay()].slice(1)}, ${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`
  const monthPrefix = now.toISOString().slice(0, 7)

  const accountCounts = useMemo(() => ({
    total:    accounts.length,
    approved: accounts.filter(a => a.status === 'approved').length,
    lost:     accounts.filter(a => a.status === 'lost').length,
    funded:   accounts.filter(a => a.type === 'Funded').length,
  }), [accounts])

  // Solo cuentas ACTIVAS cuentan para "Capital bajo gestión" — las
  // Aprobadas y Perdidas ya no representan capital bajo gestión activa.
  // Desglose Challenge/Funded calculado aparte para el selector de abajo.
  const activeAccounts = useMemo(() => accounts.filter(a => a.status === 'active'), [accounts])
  const sumSize = (list) => list.reduce((sum, a) => sum + (parseFloat(a.size) || 0), 0)
  const capitalByScope = useMemo(() => ({
    all:       sumSize(activeAccounts),
    Challenge: sumSize(activeAccounts.filter(a => a.type === 'Challenge')),
    Funded:    sumSize(activeAccounts.filter(a => a.type === 'Funded')),
  }), [activeAccounts])
  const [capitalScope, setCapitalScope] = useState('all')
  const capitalUnderManagement = capitalByScope[capitalScope]

  const monthTrades = useMemo(
    () => trades.filter(t => t.date?.startsWith(monthPrefix)),
    [trades, monthPrefix]
  )
  const monthPnl = useMemo(
    () => sumTradeDollars(monthTrades),
    [monthTrades]
  )

  const { attention, thriving } = useMemo(() => {
    const att = []
    const good = []
    accounts.forEach(a => {
      if (a.status !== 'active') return
      const accountTrades = trades.filter(t => t.accountId === a.id)
      const metrics = computeAccountMetrics(accountTrades, a)

      if (a.maxDrawdown) {
        const ddUsed = metrics ? metrics.maxDrawdown : 0
        const ddMax  = parseFloat(a.maxDrawdown)
        const ddPct  = ddMax > 0 ? Math.round((ddUsed / ddMax) * 100) : 0
        if (ddPct >= 70) att.push({ account: a, pct: ddPct })
      }
      if (a.profitTarget) {
        // Profit desde los trades (P&L acumulado / capital), igual que en
        // Portafolio. a.currentProfit se carga a mano y nunca se actualiza,
        // por eso este panel quedaba siempre vacío.
        // const profitDone   = parseFloat(a.currentProfit) || 0
        const pnlDollar    = sumTradeDollars(accountTrades, a.riskPerTrade)
        const profitDone   = a.size > 0 ? (pnlDollar / a.size) * 100 : 0
        const profitTarget = parseFloat(a.profitTarget)
        const targetPct    = profitTarget > 0 ? Math.round((profitDone / profitTarget) * 100) : 0
        if (targetPct >= 70 && targetPct < 100) good.push({ account: a, pct: targetPct })
      }
    })
    att.sort((x, y) => y.pct - x.pct)
    good.sort((x, y) => y.pct - x.pct)
    return { attention: att.slice(0, 4), thriving: good.slice(0, 4) }
  }, [accounts, trades])

  const goToAccount = () => navigate('/portafolio')

  return (
    <div className="page-inner">
      <PageHeader title={greeting(now.getHours())}>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{fullDateLabel}</span>
      </PageHeader>

      {/* Franja hero, en 2 bloques separados — mismo lenguaje visual
          que la franja de 6 métricas de la vista embebida por cuenta
          (fondo --bg2 + borde, label chico arriba, número grande en
          mono, sin íconos circulares), pero Capital/PnL (más aire,
          llevan subtítulo) quedan visualmente separados de los 4
          conteos de cuentas (solo label + número). */}
      <div className="section-gap" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 12 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Capital bajo gestión</div>
                {/* Mismo patrón visual que el selector Simple/Detallado
                    de Portfolio.jsx — pastilla con fondo --bg3, nada
                    nuevo a nivel de diseño.
                    Desactivada (2026-10-03): en la columna angosta partía
                    el label en 3 líneas y desalineaba la franja. Reemplazada
                    por el desglose fijo debajo del total (CapitalBreakdown) —
                    capitalScope queda en 'all', así el número grande es el Total. */}
                {false && <div style={{
                  display: 'inline-flex', borderRadius: 7, padding: 2,
                  background: 'var(--bg3)', border: '1px solid var(--border2)', flexShrink: 0,
                }}>
                  {[{ key: 'all', label: 'Total' }, { key: 'Challenge', label: 'Challenge' }, { key: 'Funded', label: 'Funded' }].map(opt => {
                    const active = capitalScope === opt.key
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setCapitalScope(opt.key)}
                        style={{
                          padding: '3px 8px', borderRadius: 5, border: 'none', cursor: 'pointer',
                          fontSize: 10.5, fontWeight: 700,
                          background: active ? 'var(--bg)' : 'transparent',
                          color: active ? 'var(--text)' : 'var(--text3)',
                          boxShadow: active ? 'var(--shadow-sm)' : 'none',
                          transition: 'background 120ms, color 120ms',
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                ${capitalUnderManagement.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <CapitalBreakdown challenge={capitalByScope.Challenge} funded={capitalByScope.Funded} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>PnL del mes</div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--mono)', color: monthPnl >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {monthPnl >= 0 ? '+' : '-'}${Math.abs(monthPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{monthTrades.length} trades este mes</div>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Total cuentas</div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{accountCounts.total}</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Aprobadas</div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{accountCounts.approved}</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Funded</div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{accountCounts.funded}</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Perdidas</div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--mono)', color: accountCounts.lost > 0 ? 'var(--neg)' : 'var(--text)' }}>{accountCounts.lost}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones — separadas de la franja de datos de arriba: acá
          solo viven las 2 acciones de la portada, en su jerarquía
          (Ver mis métricas #1, Mapas #2 — ver docs/buenas-practicas-ui-design.md,
          regla 6-3-1). ActionCard (ver StyleGuide → Cards → "Tarjetas
          de acción", traída de Entropia Markets). El botón mantiene la
          jerarquía: primary en Mis Métricas, outline en Mapas. */}
      <div className="section-gap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ActionCard
          primary
          icon={PieChart}
          title="Mis Métricas"
          description="Equity, win rate, profit factor y todo tu rendimiento."
          cta="Ir a Métricas"
          onClick={() => navigate('/metricas-basico')}
        />
        <ActionCard
          icon={Compass}
          title="Mis Mapas"
          description="Las rutas de trading que te acercan a la consistencia."
          cta="Ir a Mapas"
          onClick={() => navigate('/mapas')}
        />
      </div>

      <SectionLabel>Consejos</SectionLabel>
      {/* 2fr 1fr — "Estado de cuentas" (Necesitan atención + Van muy
          bien fusionadas en una sola card neutra, ver abajo) / Mi
          mentor IA. Antes eran 2 cards separadas con fondo rojo/verde
          a pleno — mucho color compitiendo con el resto de la
          pantalla, ya más neutra. El color queda solo en el ícono y
          el % de cada fila (AccountAlertRow), no en toda la card. */}
      <div className="section-gap" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--neg)', flexShrink: 0 }} />
                <span className="metric-label">Necesitan atención</span>
              </div>
              {attention.length === 0 ? (
                <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.5 }}>Ninguna cuenta activa cerca de su límite de drawdown.</div>
              ) : (
                attention.map(({ account, pct }) => (
                  <AccountAlertRow key={account.id} account={account} pct={pct} tone="danger" onClick={goToAccount} />
                ))
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--pos)', flexShrink: 0 }} />
                <span className="metric-label">Van muy bien</span>
              </div>
              {thriving.length === 0 ? (
                <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.5 }}>Ninguna cuenta activa cerca de su objetivo todavía.</div>
              ) : (
                thriving.map(({ account, pct }) => (
                  <AccountAlertRow key={account.id} account={account} pct={pct} tone="pos" onClick={goToAccount} />
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Jerarquía #3 — misma ActionCard que Mis Métricas / Mis Mapas,
            variante compact (columna 1fr vs 2fr). Ver StyleGuide →
            Cards → "Tarjetas de acción". */}
        <ActionCard
          compact
          icon={BrainCircuit}
          title="Mi mentor IA"
          cta="Consultar"
          onClick={() => navigate('/mentor-ia')}
        />
      </div>

      <div className="section-gap">
        <SectionLabel>Accesos rápidos</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {/* Calendario de Trades, Historial de Trades, Rutina Diaria
              y Mapas se sacaron de acá (2026-09-19): Calendario e
              Historial ya son botones secundarios dentro de Metrix
              Básico, Rutina Diaria ya está en el sidebar (Journal), y
              Mapas subió de jerarquía al bloque de Consejos de arriba.
              "Menos es más" en la portada — quedan solo las 2 acciones
              reales que no viven en ningún otro lado. No se borra el
              código, solo se comenta, por si hace falta revertir:
          <QuickAccessButton icon={<CalendarIcon size={16} />} label="Calendario de Trades" onClick={() => navigate('/calendar')} />
          <QuickAccessButton icon={<ListChecks size={16} />} label="Historial de Trades" onClick={() => navigate('/historial')} />
          <QuickAccessButton icon={<Sun size={16} />} label="Rutina Diaria" onClick={() => navigate('/rutina-diaria')} />
          <QuickAccessButton icon={<Map size={16} />} label="Mapas" onClick={() => navigate('/mapas')} />
          */}
          <QuickAccessButton icon={<Briefcase size={16} />} label="Nueva Cuenta" onClick={() => navigate('/portafolio', { state: { openAddForm: true } })} />
          <QuickAccessButton icon={<Plus size={16} />} label="Nueva Operación" onClick={() => navigate('/historial', { state: { openForm: true } })} />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
//  VISTA RICA EMBEBIDA (con accountId) — misma lógica y layout que
//  existía antes de la portada, solo movida a su propio componente.
// ═══════════════════════════════════════════════

/** Frase dinámica — misma lógica que Metrix Básico */
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
        <div className="callout-label">Insight de la Semana</div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
          {insight || 'Registra al menos 10 trades en esta cuenta para que el Insight semanal empiece a mostrar patrones reales.'}
        </div>
      </div>
      <button className="btn btn-primary btn-sm" onClick={() => navigate('/mentor-ia')} style={{ flexShrink: 0 }}>
        Ver análisis completo <ArrowRight size={13} />
      </button>
    </div>
  )
}

/** 8 barras — últimos N trades ganadores o perdedores, en R real. Misma lógica que Metrix Básico. */
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
              background: gradient, borderRadius: 5,
            }} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Últimos {recent.length} trades</div>
    </div>
  )
}

function BestWorstTrades({ stats, onOpenChart, initialCapital }) {
  const bestTrade  = stats.trades.length ? [...stats.trades].sort((a, b) => b.rPnl - a.rPnl)[0] : null
  const worstTrade = stats.trades.length ? [...stats.trades].sort((a, b) => a.rPnl - b.rPnl)[0] : null
  const wins   = stats.trades.filter(t => t.result === 'win').sort((a, b) => a.date.localeCompare(b.date))
  const losses = stats.trades.filter(t => t.result === 'loss').sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="grid-4 section-gap" style={{ gap: 12 }}>
      <div className="card" onClick={() => bestTrade && onOpenChart(bestTrade)} style={{ cursor: bestTrade ? 'pointer' : 'default' }}>
        <div className="card-title">Mejor Trade</div>
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
        <div className="card-title">Peor Trade</div>
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

      <Card title="Average Win">
        <MetricDisplay
          dollar={stats.avgWinDollar}
          percent={initialCapital > 0 ? (stats.avgWinDollar / initialCapital) * 100 : null}
          r={stats.avgWin}
          style={{ marginTop: 8 }}
        />
        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 4 }}>En promedio · {stats.wins} operaciones</div>
        <MiniSparkline trades={wins} />
      </Card>
      <Card title="Average Loss">
        <MetricDisplay
          dollar={stats.avgLossDollar}
          percent={initialCapital > 0 ? (stats.avgLossDollar / initialCapital) * 100 : null}
          r={stats.avgLoss}
          style={{ marginTop: 8 }}
        />
        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 4 }}>En promedio · {stats.losses} operaciones</div>
        <MiniSparkline trades={losses} tone="neg" />
      </Card>
    </div>
  )
}

function DashboardAccountView({ navigate, isMobile, trades, accounts, accountId }) {
  const [selectedPeriod, setPeriod] = useState('ALL')

  const filteredTrades = useMemo(
    () => trades.filter(t => t.accountId === accountId),
    [trades, accountId]
  )

  const periodFilteredTrades = useMemo(() => {
    if (selectedPeriod === 'TODAY') {
      const today = new Date().toISOString().split('T')[0]
      return filteredTrades.filter(t => t.date === today)
    }
    return filterTradesByPeriod(filteredTrades, selectedPeriod)
  }, [filteredTrades, selectedPeriod])

  const activeAccount = accounts.find(a => a.id === accountId)
  const initialCapital = activeAccount?.size ?? 10000

  const stats = useMemo(() => {
    const base = computeStats(periodFilteredTrades, initialCapital)
    return base ? { ...base, rowTrades: periodFilteredTrades } : null
  }, [periodFilteredTrades, initialCapital])

  const goToHistorial = (patch) => navigate('/historial', { state: { filterAccountId: accountId, ...patch } })
  const openTradeChart = (trade) => navigate('/historial', { state: { filterAccountId: accountId, openChartTradeId: trade.id } })

  const prevStats = useMemo(() => {
    if (selectedPeriod === 'TODAY') return null
    const prevTrades = filterTradesByPreviousPeriod(filteredTrades, selectedPeriod)
    return prevTrades.length ? computeStats(prevTrades, initialCapital) : null
  }, [filteredTrades, selectedPeriod, initialCapital])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {stats ? `${stats.total} trades en esta cuenta` : ''}
        </div>
        {/* Preferencia $/%/R — la misma de toda la app (Dashboard,
            Portfolio, Metrix...); esta vista emula Metrix Básico, así
            que necesita el mismo control visible. */}
        <MetricPreferenceToggle />
      </div>

      {!stats && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text3)', fontSize: 12 }}>
          No hay trades registrados para esta cuenta
        </div>
      )}

      {stats && (<>
        <InsightHero stats={stats} navigate={navigate} />

        <div className="section-gap" style={{
          background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 20, marginBottom: 24,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Capital Actual</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                  ${stats.equityCurve[stats.equityCurve.length - 1]?.value.toLocaleString() ?? '—'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                vs. ${initialCapital.toLocaleString()} inicial
              </div>
            </div>
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
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Max Drawdown</div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--neg)' }}>{stats.maxDD}%</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>desde peak</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>R:R Medio</div>
              <div style={{
                fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)',
                color: stats.avgLossDollar === 0 ? 'var(--text)'
                  : Math.abs(stats.avgWinDollar / stats.avgLossDollar) >= 1.5 ? 'var(--pos)'
                  : Math.abs(stats.avgWinDollar / stats.avgLossDollar) >= 1 ? 'var(--neutral)' : 'var(--neg)',
              }}>
                {stats.avgLossDollar !== 0 ? Math.abs(stats.avgWinDollar / stats.avgLossDollar).toFixed(2) : '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>avg win / avg loss</div>
            </div>
          </div>
        </div>

        <div className="section-gap" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Card title="Curva de Equity">
            <ResponsiveContainer width="100%" height={isMobile ? 200 : 280}>
              <AreaChart data={stats.equityCurve} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="eqStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1E40AF" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="i" hide />
                <YAxis hide domain={['auto','auto']} />
                <ReferenceLine y={stats.equityCurve[0]?.value ?? initialCapital} stroke="var(--border2)" strokeDasharray="3 3" strokeWidth={1} />
                <Tooltip content={<EquityTooltip />} />
                <Area type="monotone" dataKey="value" stroke="url(#eqStroke)" strokeWidth={4} fill="url(#eqGrad)"
                  dot={false} activeDot={{ r: 4, fill: '#3B82F6', stroke: 'var(--bg)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MetricCard
                size="hero"
                label="Operaciones" value={stats.total}
                delta={(() => { const d = pctDelta(stats.total, prevStats?.total); return d === null ? null : `${d >= 0 ? '+' : ''}${d}% vs. anterior` })()}
                deltaUp={prevStats ? stats.total >= prevStats.total : undefined}
              />
              <MetricCard
                size="hero"
                label="Expectativa"
                value={`${stats.total ? (stats.totalDollar / stats.total >= 0 ? '+' : '-') : ''}$${stats.total ? Math.abs(stats.totalDollar / stats.total).toFixed(0) : '0'}/trade`}
                delta={`${stats.expectancy >= 0 ? '+' : ''}${stats.expectancy}R`}
              />
            </div>
            <Card title="Rendimiento por sesión">
              <SessionBars sessions={stats.bySessions} />
            </Card>
          </div>
        </div>

        <BestWorstTrades stats={stats} onOpenChart={openTradeChart} initialCapital={initialCapital} />

        <div className="section-gap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Card title="Rendimiento por día">
            <WeekdayChart byWeekday={stats.byWeekday} />
          </Card>
          <Card title="Resultados por hora">
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: -8, marginBottom: 12 }}>{hourClockLabel(stats.trades)}</div>
            <HourHeatmap byHour={stats.byHour} onClick={(hour) => goToHistorial({ filterHour: hour })} />
          </Card>
        </div>

        <div className="section-gap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Card title="Rendimiento por instrumento">
            <InstrumentBars byInstrument={stats.byInstrument} />
          </Card>
          <Card title="Distribución R:R">
            <RRBuckets buckets={stats.rrBuckets} />
          </Card>
        </div>
      </>)}
    </div>
  )
}

// ═══════════════════════════════════════════════
//  ENTRY POINT
// ═══════════════════════════════════════════════

export default function Dashboard({ accountId } = {}) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const trades   = useStore(s => s.trades)
  const accounts = useStore(s => s.accounts)

  if (accountId) {
    return (
      <DashboardAccountView
        navigate={navigate} isMobile={isMobile}
        trades={trades} accounts={accounts} accountId={accountId}
      />
    )
  }

  return <DashboardPortada navigate={navigate} accounts={accounts} trades={trades} />
}