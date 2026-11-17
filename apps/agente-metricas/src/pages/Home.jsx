import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, ListChecks, Brain, BarChart3, ArrowRight } from 'lucide-react'
import { Card, PageHeader, ProgressBar } from '@/components/ui'
import { useTrades } from '@/store/useStore'
import { computeAccountMetrics } from '@/config/blueprintMatchEngine'
import { generateExecutiveSummary } from '@/config/mentorInsights'
import { sumTradeDollars } from '@/lib/tradeDollar'

// ─────────────────────────────────────────────
//  HOME — vista rápida diaria (distinta del Hero de "/", que es la
//  pantalla de entrada de marketing, y distinta del Dashboard, que
//  es el análisis completo). Esta es la "página de inicio" dentro
//  de la app: un vistazo rápido a hoy + esta semana + accesos.
//
//  Reutiliza tal cual computeAccountMetrics()/generateExecutiveSummary()
//  (las mismas de IaMentor/SessionReviewModal) — nada de cálculos nuevos.
// ─────────────────────────────────────────────

// Objetivo semanal por defecto — no hay ninguna configuración de
// "objetivo R" guardada todavía en el store, así que se usa un
// valor de referencia razonable. Si en el futuro se añade un ajuste
// de objetivo por usuario, este es el único número a sustituir.
const DEFAULT_WEEKLY_GOAL_R = 5

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function mondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function greeting() {
  const h = new Date().getHours()
  if (h < 6)  return 'Buenas noches'
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

const QUICK_LINKS = [
  { icon: Wallet,     label: 'Portfolio',  to: '/portafolio',   color: 'var(--brand)' },
  { icon: ListChecks, label: 'Historial',  to: '/historial',   color: 'var(--brand)' },
  { icon: Brain,      label: 'Mentor IA',  to: '/mentor-ia',          color: 'var(--brand-deep)' },
  { icon: BarChart3,  label: 'Metrix',     to: '/metricas-basico', color: 'var(--amber)' },
]

export default function Home() {
  const navigate = useNavigate()
  const trades = useTrades()

  const todayTrades = useMemo(() => trades.filter(t => t.date === todayISO()), [trades])

  const todayMetrics = useMemo(
    () => (todayTrades.length ? computeAccountMetrics(todayTrades, null) : null),
    [todayTrades]
  )

  const todayPnl = useMemo(
    () => sumTradeDollars(todayTrades),
    [todayTrades]
  )
  const todayR = useMemo(
    () => todayTrades.reduce((sum, t) => sum + (t.rPnl || 0), 0),
    [todayTrades]
  )

  const weekTrades = useMemo(() => {
    const monday = mondayOf(new Date())
    const mondayStr = monday.toISOString().split('T')[0]
    return trades.filter(t => t.date >= mondayStr && t.date <= todayISO())
  }, [trades])
  const weeklyR = useMemo(() => weekTrades.reduce((sum, t) => sum + (t.rPnl || 0), 0), [weekTrades])

  const mentorInsight = todayMetrics ? generateExecutiveSummary({ accountMetrics: todayMetrics })[0] : null

  return (
    <div className="page-inner">
      <PageHeader title={`${greeting()}, Trader`} subtitle="Tu vistazo rápido de hoy" />

      {/* Resumen de hoy */}
      <div className="grid-3 section-gap">
        <Card>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trades hoy</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>{todayTrades.length}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PnL de hoy</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: todayPnl >= 0 ? 'var(--pos)' : 'var(--red)' }}>
            {todayPnl >= 0 ? '+' : ''}${Math.abs(todayPnl).toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--mono)' }}>
            {todayR >= 0 ? '+' : ''}{todayR.toFixed(2)}R
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Win Rate hoy</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--pos)' }}>
            {todayMetrics ? `${todayMetrics.winRate}%` : '—'}
          </div>
        </Card>
      </div>

      {/* Mentor IA */}
      <Card className="section-gap" title="🧠 Mentor IA">
        <p style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
          {mentorInsight || 'Sin operaciones hoy. En cuanto registres tu primer trade, verás aquí una lectura rápida de tu sesión.'}
        </p>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/mentor-ia')}>
          Ver Mentor IA completo <ArrowRight size={13} />
        </button>
      </Card>

      {/* Progreso semanal */}
      <Card className="section-gap" title="Progreso semanal">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--text2)' }}>
            {weeklyR >= 0 ? '+' : ''}{weeklyR.toFixed(2)}R de {DEFAULT_WEEKLY_GOAL_R}R
          </span>
          <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            {Math.min(100, Math.max(0, (weeklyR / DEFAULT_WEEKLY_GOAL_R) * 100)).toFixed(0)}%
          </span>
        </div>
        <ProgressBar value={Math.max(0, weeklyR)} max={DEFAULT_WEEKLY_GOAL_R} />
      </Card>

      {/* Quick links */}
      <div className="section-gap">
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>Accesos rápidos</h3>
        <div className="grid-4" style={{ gap: 10 }}>
          {QUICK_LINKS.map(link => {
            const Icon = link.icon
            return (
              <div
                key={link.label}
                onClick={() => navigate(link.to)}
                className="card-sm"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '18px 12px', cursor: 'pointer', textAlign: 'center',
                }}
              >
                <Icon size={20} style={{ color: link.color }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)' }}>{link.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
