import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import {
  Banknote, Receipt, Settings, Landmark, Building2, Activity, CheckCircle2, XCircle,
  PiggyBank, Repeat, BarChart3, Trophy, Calculator, TrendingUp, Plus,
} from 'lucide-react'
import { Card, PageHeader, MetricCard, ProgressBar } from '@/components/ui'
import PremiumGate from '@/components/premium/PremiumGate'
import { useAccounts, useTrades } from '@/store/useStore'
import { Chips, fmtMoney } from '@/components/accounts/accountFormShared'
import CyclesManager from '@/components/accounts/CyclesManager'
import { groupMoneySummary, cycleMoneySummaries } from '@/lib/accountGroups'
import { BUSINESS_PERIODS, computeBusinessStats } from './businessroi/businessRoiData'

// ─────────────────────────────────────────────
//  BUSINESS ROI — Sprint 17
//
//  Filosofía: Metrix responde "¿Cómo opero?". Business ROI responde
//  "¿Mi negocio de trading está siendo rentable?". No analiza
//  operaciones ni métricas de trading — solo inversión, estado de
//  cuentas y retornos. Módulo independiente, no reutiliza lógica de
//  Metrix/Dashboard/Portfolio, solo componentes visuales comunes.
// ─────────────────────────────────────────────

const TT = {
  background: 'rgba(16,20,30,0.92)', border: '1px solid var(--border2)',
  borderRadius: 10, fontSize: 11, color: 'var(--text)', boxShadow: 'var(--shadow)', padding: '9px 13px', backdropFilter: 'blur(8px)',
}

function fmt(v) {
  return `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString()}`
}

/**
 * SectionTitle — encabezado de bloque, consistente con el resto de Atlas
 */
function SectionTitle({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <h3 style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '1.2px',
        textTransform: 'uppercase', color: 'var(--section-accent)', whiteSpace: 'nowrap',
      }}>
        {children}
      </h3>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

/**
 * BusinessSummaryCard — Resumen automático (texto generado a partir de
 * los datos calculados, sin IA)
 */
function BusinessSummaryCard({ stats, periodLabel }) {
  const { investment, returns, business } = stats
  return (
    <Card className="section-gap" style={{
      background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(30,64,175,0.08) 100%)',
      border: '1px solid var(--border2)',
    }}>
      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
        Durante <b>{periodLabel.toLowerCase()}</b> invertiste <b>${investment.totalInvested.toLocaleString()}</b> en
        cuentas y activaciones. Recuperaste <b>${returns.totalWithdrawn.toLocaleString()}</b> mediante{' '}
        <b>{returns.payoutsCount}</b> {returns.payoutsCount === 1 ? 'payout' : 'payouts'}.
        El beneficio neto fue de <b style={{ color: returns.netProfit >= 0 ? 'var(--pos)' : 'var(--red)' }}>{fmt(returns.netProfit)}</b> con
        un ROI del <b style={{ color: returns.roi >= 0 ? 'var(--pos)' : 'var(--red)' }}>{returns.roi >= 0 ? '+' : ''}{returns.roi}%</b>.
        Aprobaste <b>{business.challengesApproved}</b> {business.challengesApproved === 1 ? 'cuenta' : 'cuentas'} y
        perdiste <b>{business.challengesLost + business.fundedLost}</b>.
      </p>
    </Card>
  )
}

const fmtSigned = (n) => (n < 0 ? '-' : '') + fmtMoney(Math.abs(n))
const signColor = (n) => (n > 0 ? 'var(--pos)' : n < 0 ? 'var(--neg)' : 'var(--text)')

/**
 * Pestaña "Por ciclos": inversión y retorno del total de cuentas y de
 * cada ciclo (el nombre que el alumno le pone a la cuenta). Todo el
 * histórico, sin filtro de periodo.
 */
function CyclesView({ accounts, trades }) {
  const total = useMemo(() => groupMoneySummary(accounts, trades), [accounts, trades])
  const cycles = useMemo(() => cycleMoneySummaries(accounts, trades), [accounts, trades])
  const [showManager, setShowManager] = useState(false)
  const th = { textAlign: 'right', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  const td = { textAlign: 'right', padding: '10px', fontFamily: 'var(--mono)', fontSize: 13, whiteSpace: 'nowrap' }
  const row = (r, key, bold) => (
    <tr key={key} style={{ borderTop: '1px solid var(--border)', ...(bold && { background: 'var(--bg3)' }) }}>
      <td style={{ ...td, textAlign: 'left', fontFamily: 'var(--font)', fontWeight: bold ? 700 : 600 }}>{key}</td>
      <td style={td}>
        {r.count}
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font)' }}>
          {r.byStatus.active} act. · {r.byStatus.approved} compl. · {r.byStatus.lost} perd.
        </div>
      </td>
      <td style={td}>{fmtMoney(r.invested)}</td>
      <td style={{ ...td, color: signColor(r.pnl) }}>{fmtSigned(r.pnl)}</td>
      <td style={td}>{fmtMoney(r.withdrawn)}</td>
      <td style={{ ...td, color: signColor(r.net), fontWeight: 700 }}>{fmtSigned(r.net)}</td>
      <td style={{ ...td, color: r.roi === null ? 'var(--text3)' : signColor(r.roi) }}>{r.roi === null ? '—' : `${r.roi > 0 ? '+' : ''}${r.roi}%`}</td>
    </tr>
  )
  return (<>
    <div className="section-gap">
      <SectionTitle>Total</SectionTitle>
      <div className="grid-4" style={{ marginBottom: 12 }}>
        <MetricCard size="hero" icon={<Banknote size={15} />} iconColor="green"
          label="Invertido" value={fmtMoney(total.invested)} delta={`${total.count} cuentas`} />
        <MetricCard size="hero" icon={<Activity size={15} />} iconColor="green"
          label="PnL de las cuentas" value={fmtSigned(total.pnl)} deltaUp={total.pnl >= 0}
          delta={`${total.inProfit} en profit · ${total.inLoss} en pérdidas`} />
        <MetricCard size="hero" icon={<PiggyBank size={15} />} iconColor="green"
          label="Retirado" value={fmtMoney(total.withdrawn)} />
        <MetricCard size="hero" icon={<Calculator size={15} />} iconColor="green"
          label="Resultado (retirado − invertido)" value={fmtSigned(total.net)} deltaUp={total.net >= 0}
          delta={total.roi === null ? undefined : `ROI ${total.roi > 0 ? '+' : ''}${total.roi}%`} />
      </div>
    </div>
    <div className="section-gap">
      <SectionTitle>Por ciclo</SectionTitle>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 10 }}>
        <button className="btn btn-sm" onClick={() => setShowManager(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={13} /> Crear y gestionar ciclos
        </button>
      </div>
      {showManager && <CyclesManager onClose={() => setShowManager(false)} />}
      <Card>
        {cycles.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Todavía no hay cuentas.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>Ciclo</th>
                  <th style={th}>Cuentas</th>
                  <th style={th}>Invertido</th>
                  <th style={th}>PnL</th>
                  <th style={th}>Retirado</th>
                  <th style={th}>Resultado</th>
                  <th style={th}>ROI</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map(c => row(c, c.cycle))}
                {cycles.length > 1 && row(total, 'Total', true)}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--text3)', margin: '12px 0 0', lineHeight: 1.5 }}>
          Invertido = costo de la cuenta + activación. Resultado = lo retirado menos lo invertido. Los ciclos se crean
          con "Crear y gestionar ciclos" o desde cada cuenta (Editar → Ciclo).
        </p>
      </Card>
    </div>
  </>)
}

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────
export default function BusinessROI() {
  const accounts = useAccounts()
  const trades = useTrades()

  const [view, setView] = useState('total')   // 'total' | 'ciclos'
  const [period, setPeriod] = useState('ALL')

  const stats = useMemo(
    () => computeBusinessStats(accounts, period),
    [accounts, period]
  )

  const periodLabel = BUSINESS_PERIODS.find(p => p.value === period)?.label ?? 'Todo'
  const { investment, business, returns, evolution } = stats

  return (
    <PremiumGate feature="businessRoi">
    <div className="page-inner">
      <PageHeader title="Inversión y retiros" subtitle="Lo que invertiste en cuentas vs. lo que retiraste." />

      <div className="section-gap">
        <Chips size="sm" label="Vista" value={view} onChange={setView}
          options={[{ value: 'total', label: 'General' }, { value: 'ciclos', label: 'Por ciclos' }]} />
      </div>

      {view === 'ciclos' ? <CyclesView accounts={accounts} trades={trades} /> : (<>

      {/* ══════════════════════════════════════
          BLOQUE 4 (parte 1) — Filtro de periodo
      ══════════════════════════════════════ */}
      <div className="form-group section-gap" style={{ maxWidth: 220 }}>
        <label>Periodo</label>
        <select value={period} onChange={e => setPeriod(e.target.value)}>
          {BUSINESS_PERIODS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* ══════════════════════════════════════
          RESUMEN AUTOMÁTICO
      ══════════════════════════════════════ */}
      <BusinessSummaryCard stats={stats} periodLabel={periodLabel} />

      {/* ══════════════════════════════════════
          BLOQUE 1 — INVERSIÓN
      ══════════════════════════════════════ */}
      <div className="section-gap">
        <SectionTitle>Inversión</SectionTitle>
        <div className="grid-4" style={{ marginBottom: 12 }}>
          <MetricCard size="hero" icon={<Banknote size={15} />} iconColor="green"
            label="Capital invertido" value={`$${investment.totalInvested.toLocaleString()}`}
            delta={`en ${periodLabel.toLowerCase()}`} deltaUp={false} />
          <MetricCard size="hero" icon={<Receipt size={15} />} iconColor="green"
            label="Cuentas compradas" value={investment.accountsBought}
            delta="histórico" />
          <MetricCard size="hero" icon={<Settings size={15} />} iconColor="green"
            label="Tarifas de activación" value={`$${investment.activationFees.toLocaleString()}`}
            delta="desde Portfolio · incluido en lo invertido" />
          <MetricCard size="hero" icon={<Landmark size={15} />} iconColor="green"
            label="Bankroll disponible" value={`$${investment.bankrollTotal.toLocaleString()}`}
            delta="valor de ejemplo" />
        </div>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>% de bankroll comprometido</span>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)' }}>{investment.bankrollCommittedPct}%</span>
          </div>
          <ProgressBar value={investment.bankrollCommittedPct} />
        </Card>
      </div>

      {/* ══════════════════════════════════════
          BLOQUE 2 — ESTADO DEL NEGOCIO
      ══════════════════════════════════════ */}
      <div className="section-gap">
        <SectionTitle>Estado del negocio</SectionTitle>
        <div className="grid-6" style={{ gap: 10 }}>
          <MetricCard size="hero" icon={<Activity size={15} />} iconColor="green" label="Challenges activas" value={business.challengesActive} />
          <MetricCard size="hero" icon={<CheckCircle2 size={15} />} iconColor="green" label="Challenges aprobadas" value={business.challengesApproved} />
          <MetricCard size="hero" icon={<XCircle size={15} />} iconColor="green" label="Challenges perdidas" value={business.challengesLost} />
          <MetricCard size="hero" icon={<CheckCircle2 size={15} />} iconColor="green" label="Funded activas" value={business.fundedActive} />
          <MetricCard size="hero" icon={<XCircle size={15} />} iconColor="green" label="Funded perdidas" value={business.fundedLost} />
          <MetricCard size="hero" icon={<Building2 size={15} />} iconColor="green" label="Fondeadas · histórico" value={business.fundedHistoric} />
        </div>
      </div>

      {/* ══════════════════════════════════════
          BLOQUE 3 — RETORNOS
      ══════════════════════════════════════ */}
      <div className="section-gap">
        <SectionTitle>Retornos</SectionTitle>
        <div className="grid-4" style={{ marginBottom: 12 }}>
          <MetricCard size="hero" icon={<PiggyBank size={15} />} iconColor="green"
            label="Capital retirado" value={`$${returns.totalWithdrawn.toLocaleString()}`} deltaUp={true} />
          <MetricCard size="hero" icon={<Repeat size={15} />} iconColor="green"
            label="Nº de payouts" value={returns.payoutsCount} />
          <MetricCard size="hero" icon={<BarChart3 size={15} />} iconColor="green"
            label="Retiro medio" value={`$${returns.avgPayout.toLocaleString()}`} />
          <MetricCard size="hero" icon={<Trophy size={15} />} iconColor="green"
            label="Mejor retiro" value={`$${returns.bestPayout.toLocaleString()}`} />
          <MetricCard size="hero" icon={<Calculator size={15} />} iconColor="green"
            label="Beneficio neto" value={fmt(returns.netProfit)} deltaUp={returns.netProfit >= 0} />
          <MetricCard size="hero" icon={<TrendingUp size={15} />} iconColor="green"
            label="ROI" value={`${returns.roi >= 0 ? '+' : ''}${returns.roi}%`} deltaUp={returns.roi >= 0} />
        </div>

        {/* Retiros por cuenta/firma */}
        <Card title="Retiros por cuenta">
          {returns.byFirm.length === 0 ? (
            <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>
              No hay retiros registrados en este periodo.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {returns.byFirm.map(f => (
                <div key={f.firm} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{f.firm}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{f.count} {f.count === 1 ? 'payout' : 'payouts'}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pos)', fontFamily: 'var(--mono)' }}>
                    +${f.total.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ══════════════════════════════════════
          GRÁFICAS — solo negocio, sin operaciones
      ══════════════════════════════════════ */}
      <div className="section-gap">
        <SectionTitle>Evolución</SectionTitle>
        <Card title="Capital invertido vs. recuperado">
          {evolution.length === 0 ? (
            <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>
              No hay movimientos registrados en este periodo.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={evolution} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={TT} formatter={v => [`$${v?.toLocaleString()}`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="invested" name="Invertido" fill="var(--red)" radius={[3, 3, 0, 0]} fillOpacity={0.85} />
                <Bar dataKey="recovered" name="Recuperado" fill="var(--pos)" radius={[3, 3, 0, 0]} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
      </>)}
    </div>
    </PremiumGate>
  )
}
