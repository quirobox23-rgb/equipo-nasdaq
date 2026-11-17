import { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, ResponsiveContainer, Tooltip,
  ReferenceLine, CartesianGrid, Cell,
} from 'recharts'
import { Banknote, PiggyBank, TrendingUp, TrendingDown, Calculator, DollarSign, Target, Trophy } from 'lucide-react'
import { Card, PageHeader, MetricCard, Badge, ProgressBar } from '@/components/ui'
import PremiumGate from '@/components/premium/PremiumGate'
import { useCashflow, useStore, useAccounts } from '@/store/useStore'
import { tradeDollar } from '@/lib/tradeDollar'

const TT = {
  background: 'rgba(16,20,30,0.92)', border: '1px solid var(--border2)',
  borderRadius: 10, fontSize: 11, color: 'var(--text)', boxShadow: 'var(--shadow)', padding: '9px 13px', backdropFilter: 'blur(8px)',
}

const TYPE_CONFIG = {
  payout:     { label: 'PAYOUT',    variant: 'green', sign: '+' },
  investment: { label: 'INVERSIÓN', variant: 'red',   sign: '-' },
  expense:    { label: 'GASTO',     variant: 'amber', sign: '-' },
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function fmtCcy(v, symbol = '$') {
  return `${v >= 0 ? '+' : ''}${symbol}${Math.abs(v).toLocaleString()}`
}

function calcEquityCurve(trades, account) {
  const riskPerTrade = account?.riskPerTrade ?? 550
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  let equity = 0
  return sorted.map(t => {
    const dollar = tradeDollar(t, riskPerTrade)
    equity += dollar
    return { date: t.date, equity: parseFloat(equity.toFixed(2)), rPnl: t.rPnl, result: t.result }
  })
}

function calcConsistency(trades, account) {
  if (!trades.length) return null
  const riskPerTrade = account?.riskPerTrade ?? 550

  // Agrupar por día
  const byDay = {}
  trades.forEach(t => {
    if (!byDay[t.date]) byDay[t.date] = []
    byDay[t.date].push(t)
  })

  const days = Object.entries(byDay).map(([date, ts]) => {
    const dayR      = ts.reduce((s, t) => s + t.rPnl, 0)
    const dayDollar = ts.reduce((s, t) => s + tradeDollar(t, riskPerTrade), 0)
    return { date, trades: ts.length, dayR, dayDollar, profit: dayDollar > 0, loss: dayDollar < 0 }
  }).sort((a, b) => a.date.localeCompare(b.date))

  const profitDays = days.filter(d => d.profit).length
  const lossDays   = days.filter(d => d.loss).length
  const totalDays  = days.length

  // Racha máxima ganadora y perdedora
  let maxWinStreak = 0, maxLossStreak = 0
  let curWin = 0, curLoss = 0
  days.forEach(d => {
    if (d.profit) { curWin++; curLoss = 0; maxWinStreak  = Math.max(maxWinStreak,  curWin)  }
    else           { curLoss++; curWin = 0; maxLossStreak = Math.max(maxLossStreak, curLoss) }
  })

  // Peor día en $
  const worstDay = days.reduce((w, d) => d.dayDollar < w.dayDollar ? d : w, days[0])

  // Consistencia: % de días donde el profit del mejor día no supera el X% del total
  const totalProfit = trades.filter(t => t.rPnl > 0).reduce((s, t) => s + tradeDollar(t, riskPerTrade), 0)
  const bestDay     = days.reduce((b, d) => d.dayDollar > b.dayDollar ? d : b, days[0])
  const consistencyPct = totalProfit > 0 ? Math.round((1 - bestDay.dayDollar / totalProfit) * 100) : 0

  // Max daily loss
  const maxDailyLoss = Math.abs(Math.min(0, worstDay?.dayDollar ?? 0))

  // Daily pnl chart
  const dailyChart = days.map(d => ({ date: d.date.slice(5), pnl: parseFloat(d.dayDollar.toFixed(0)) }))

  return {
    profitDays, lossDays, totalDays,
    maxWinStreak, maxLossStreak,
    worstDay, bestDay,
    consistencyPct,
    maxDailyLoss,
    dailyChart,
    winDayRate: totalDays ? Math.round((profitDays / totalDays) * 100) : 0,
  }
}

// ─────────────────────────────────────────────
//  TAB 1 — CASHFLOW (original intacto)
// ─────────────────────────────────────────────
function TabCashflow({ cashflow, addEntry }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '', type: 'payout', label: '', amount: '' })

  const totalInvested  = cashflow.filter(c => c.type === 'investment' || c.type === 'expense').reduce((s, c) => s + Math.abs(c.amount), 0)
  const totalWithdrawn = cashflow.filter(c => c.type === 'payout').reduce((s, c) => s + c.amount, 0)
  const net            = totalWithdrawn - totalInvested
  const roi            = totalInvested > 0 ? ((net / totalInvested) * 100).toFixed(1) : 0
  const payouts        = cashflow.filter(c => c.type === 'payout').length

  const chartData = cashflow.map(c => ({ label: c.date, accumulated: c.accumulated }))

  const handleAdd = () => {
    if (!form.label || !form.amount || !form.date) return
    const amount = form.type === 'payout'
      ? parseFloat(form.amount)
      : -Math.abs(parseFloat(form.amount))
    const lastAcc = cashflow.length ? cashflow[cashflow.length - 1].accumulated : 0
    addEntry({ date: form.date, type: form.type, label: form.label, amount, accumulated: lastAcc + amount })
    setForm({ date: '', type: 'payout', label: '', amount: '' })
    setShowForm(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
          {showForm ? <><X size={13} /> Cancelar</> : '+ Registrar movimiento'}
        </button>
      </div>

      {showForm && (
        <Card className="section-gap" title="Nuevo movimiento">
          <div className="grid-2">
            <div className="form-group"><label>Fecha</label>
              <input type="month" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="form-group"><label>Tipo</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="payout">Payout / Ingreso</option>
                <option value="investment">Inversión (challenge)</option>
                <option value="expense">Gasto (suscripción, etc.)</option>
              </select></div>
            <div className="form-group"><label>Descripción</label>
              <input type="text" placeholder="Profit Split…" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} /></div>
            <div className="form-group"><label>Importe ($)</label>
              <input type="number" placeholder="1200" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
          </div>
          <button className="btn btn-primary" onClick={handleAdd}>Guardar movimiento</button>
        </Card>
      )}

      <div className="grid-4 section-gap">
        <MetricCard size="hero" icon={<Banknote size={15} />} label="Total invertido"  value={`-$${totalInvested.toLocaleString()}`}  delta="challenges + gastos"     deltaUp={false} />
        <MetricCard size="hero" icon={<PiggyBank size={15} />} label="Total retirado"   value={`+$${totalWithdrawn.toLocaleString()}`} delta={`${payouts} payouts`}     deltaUp={true}  />
        <MetricCard size="hero" icon={<TrendingUp size={15} />} label="ROI real"         value={`${roi >= 0 ? '+' : ''}${roi}%`}        delta="sobre capital arriesgado" deltaUp={roi >= 0} />
        <MetricCard size="hero" icon={<Calculator size={15} />} label="Neto"             value={fmtCcy(net)}                            deltaUp={net >= 0} iconColor="lime" />
      </div>

      <Card title="Evolución del cashflow acumulado" className="section-gap">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cf-pos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--pos)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--pos)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cf-neg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--red)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--red)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={TT} formatter={v => [`$${v?.toLocaleString()}`]} />
            <ReferenceLine y={0} stroke="var(--border2)" strokeDasharray="4 2" />
            <Area type="monotone" dataKey="accumulated"
              stroke={net >= 0 ? 'var(--pos)' : 'var(--red)'} strokeWidth={2}
              fill={net >= 0 ? 'url(#cf-pos)' : 'url(#cf-neg)'}
              dot={{ r: 4, fill: net >= 0 ? 'var(--pos)' : 'var(--red)', strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Movimientos">
        <table>
          <thead><tr>
            <th>Fecha</th><th>Tipo</th><th>Descripción</th>
            <th style={{ textAlign: 'right' }}>Importe</th>
            <th style={{ textAlign: 'right' }}>Acumulado</th>
          </tr></thead>
          <tbody>
            {[...cashflow].reverse().map(c => {
              const cfg = TYPE_CONFIG[c.type] ?? TYPE_CONFIG.expense
              return (
                <tr key={c.id}>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>{c.date}</td>
                  <td><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                  <td style={{ fontSize: 12 }}>{c.label}</td>
                  <td className="mono" style={{ textAlign: 'right', color: c.amount >= 0 ? 'var(--pos)' : 'var(--red)', fontWeight: 600 }}>
                    {c.amount >= 0 ? '+' : ''}${c.amount.toLocaleString()}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: c.accumulated >= 0 ? 'var(--pos)' : 'var(--red)' }}>
                    {c.accumulated >= 0 ? '+' : ''}${c.accumulated.toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '12px 14px', marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Balance final</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, color: net >= 0 ? 'var(--pos)' : 'var(--red)' }}>
            {fmtCcy(net)}
          </span>
        </div>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────
//  TAB 2 — EQUITY POR CUENTA
// ─────────────────────────────────────────────
function TabEquity({ trades, accounts }) {
  const [selectedId, setSelectedId] = useState('all')

  const accountOptions = [{ id: 'all', firm: 'Todas las cuentas', riskPerTrade: 550 }, ...accounts]

  const selectedAccount = accounts.find(a => a.id === selectedId)
  const filteredTrades  = selectedId === 'all' ? trades : trades.filter(t => t.accountId === selectedId)

  const equityCurve = useMemo(() => {
    if (selectedId === 'all') {
      const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
      let equity = 0
      return sorted.map(t => {
        const rpt = accounts.find(a => a.id === t.accountId)?.riskPerTrade ?? 550
        equity += tradeDollar(t, rpt)
        return { date: t.date, equity: parseFloat(equity.toFixed(2)) }
      })
    }
    return calcEquityCurve(filteredTrades, selectedAccount)
  }, [selectedId, trades, accounts])

  const totalR      = filteredTrades.reduce((s, t) => s + t.rPnl, 0)
  const wins        = filteredTrades.filter(t => t.result === 'win').length
  const winRate     = filteredTrades.length ? Math.round(wins / filteredTrades.length * 100) : 0
  const finalEquity = equityCurve.length ? equityCurve[equityCurve.length - 1].equity : 0
  const maxEquity   = equityCurve.length ? Math.max(...equityCurve.map(e => e.equity)) : 0
  const minEquity   = equityCurve.length ? Math.min(...equityCurve.map(e => e.equity)) : 0
  const maxDD       = maxEquity > 0 ? parseFloat(((maxEquity - minEquity) / Math.max(1, maxEquity + Math.abs(Math.min(0, minEquity))) * 100).toFixed(1)) : 0

  const isPositive = finalEquity >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Selector de cuenta */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {accountOptions.map(a => (
          <button key={a.id} onClick={() => setSelectedId(a.id)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.15s',
            border: `1px solid ${selectedId === a.id ? 'var(--brand)' : 'var(--border2)'}`,
            background: selectedId === a.id ? 'var(--brand2)' : 'transparent',
            color: selectedId === a.id ? 'var(--brand)' : 'var(--text2)',
          }}>{a.firm}</button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid-4">
        <MetricCard size="hero" icon={<DollarSign size={15} />} label="P&L total ($)"
          value={`${finalEquity >= 0 ? '+$' : '-$'}${Math.abs(finalEquity).toLocaleString()}`}
          deltaUp={finalEquity >= 0} />
        <MetricCard size="hero" icon={<Target size={15} />} label="Total R"
          value={`${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R`}
          deltaUp={totalR >= 0} />
        <MetricCard size="hero" icon={<Trophy size={15} />} label="Win Rate"
          value={`${winRate}%`}
          delta={`${wins}W / ${filteredTrades.length - wins}L`}
          deltaUp={winRate >= 50} />
        <MetricCard size="hero" icon={<TrendingDown size={15} />} label="Max Drawdown"
          value={`${maxDD}%`}
          delta="sobre equity máx"
          deltaUp={false} />
      </div>

      {/* Curva de equity */}
      <Card title="Curva de Equity">
        {equityCurve.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 12 }}>
            No hay trades registrados para esta cuenta.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={equityCurve} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="eq-pos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--pos)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--pos)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="eq-neg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--red)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--red)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
                interval={Math.floor(equityCurve.length / 8)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${v >= 0 ? '' : ''}${(v/1000).toFixed(1)}k`} />
              <Tooltip contentStyle={TT}
                formatter={(v) => [`$${v?.toLocaleString()}`, 'Equity']}
                labelFormatter={l => `Fecha: ${l}`} />
              <ReferenceLine y={0} stroke="var(--border3)" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="equity"
                stroke={isPositive ? 'var(--pos)' : 'var(--red)'} strokeWidth={2}
                fill={isPositive ? 'url(#eq-pos)' : 'url(#eq-neg)'}
                dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Desglose por cuenta */}
      {selectedId === 'all' && (
        <Card title="Desglose por cuenta">
          <table>
            <thead><tr>
              <th>Cuenta</th><th>Tipo</th><th>Trades</th>
              <th style={{ textAlign: 'right' }}>Total R</th>
              <th style={{ textAlign: 'right' }}>Win %</th>
              <th style={{ textAlign: 'right' }}>P&L ($)</th>
              <th>Estado</th>
            </tr></thead>
            <tbody>
              {accounts.map(a => {
                const aTrades  = trades.filter(t => t.accountId === a.id)
                const aWins    = aTrades.filter(t => t.result === 'win').length
                const aR       = aTrades.reduce((s, t) => s + t.rPnl, 0)
                const aDollar  = aTrades.reduce((s, t) => s + tradeDollar(t, a.riskPerTrade ?? 550), 0)
                const aWR      = aTrades.length ? Math.round(aWins / aTrades.length * 100) : 0
                const stColors = { active: 'var(--brand)', approved: 'var(--pos)', lost: 'var(--red)' }
                const stLabels = { active: 'ACTIVO', approved: 'APROBADA', lost: 'PERDIDA' }
                return (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.firm}<br/>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{a.phase} · ${Number(a.size).toLocaleString()}</span>
                    </td>
                    <td><Badge variant={a.type === 'Funded' ? 'blue' : a.type === 'Personal' ? 'lime' : 'amber'}>
                      {a.type.toUpperCase()}</Badge></td>
                    <td className="mono" style={{ color: 'var(--text2)' }}>{aTrades.length}</td>
                    <td className="mono" style={{ textAlign: 'right', color: aR >= 0 ? 'var(--pos)' : 'var(--red)', fontWeight: 600 }}>
                      {aR >= 0 ? '+' : ''}{aR.toFixed(2)}R</td>
                    <td className="mono" style={{ textAlign: 'right', color: aWR >= 60 ? 'var(--pos)' : aWR >= 50 ? 'var(--amber)' : 'var(--red)' }}>
                      {aWR}%</td>
                    <td className="mono" style={{ textAlign: 'right', color: aDollar >= 0 ? 'var(--pos)' : 'var(--red)', fontWeight: 600 }}>
                      {aDollar >= 0 ? '+$' : '-$'}{Math.abs(aDollar).toLocaleString()}</td>
                    <td>
                      <span style={{ fontSize: 10, fontWeight: 700, color: stColors[a.status] ?? 'var(--text3)',
                        background: `${stColors[a.status] ?? '#888'}18`, padding: '2px 8px', borderRadius: 10,
                        border: `1px solid ${stColors[a.status] ?? '#888'}30` }}>
                        {stLabels[a.status] ?? a.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  TAB 3 — CONSISTENCIA
// ─────────────────────────────────────────────
function TabConsistency({ trades, accounts }) {
  const [selectedId, setSelectedId] = useState('all')

  const accountOptions = [{ id: 'all', firm: 'Todas las cuentas', riskPerTrade: 550 }, ...accounts]
  const selectedAccount = accounts.find(a => a.id === selectedId)
  const filteredTrades  = selectedId === 'all' ? trades : trades.filter(t => t.accountId === selectedId)

  const stats = useMemo(() => calcConsistency(filteredTrades, selectedAccount), [filteredTrades, selectedAccount])

  if (!stats) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 12 }}>
      No hay trades registrados. Empieza a añadir trades para ver métricas de consistencia.
    </div>
  )

  const metrics = [
    {
      label: 'Días con profit',
      value: `${stats.profitDays} / ${stats.totalDays}`,
      sub: `${stats.winDayRate}% de los días`,
      color: stats.winDayRate >= 60 ? 'var(--pos)' : stats.winDayRate >= 50 ? 'var(--amber)' : 'var(--red)',
      pct: stats.winDayRate,
    },
    {
      label: 'Racha ganadora máx',
      value: `${stats.maxWinStreak} días`,
      sub: 'días consecutivos en profit',
      color: 'var(--pos)',
      pct: null,
    },
    {
      label: 'Racha perdedora máx',
      value: `${stats.maxLossStreak} días`,
      sub: 'días consecutivos en loss',
      color: 'var(--red)',
      pct: null,
    },
    {
      label: 'Peor día',
      value: `-$${Math.abs(stats.worstDay?.dayDollar ?? 0).toLocaleString()}`,
      sub: stats.worstDay?.date ?? '—',
      color: 'var(--red)',
      pct: null,
    },
    {
      label: 'Mejor día',
      value: `+$${(stats.bestDay?.dayDollar ?? 0).toLocaleString()}`,
      sub: stats.bestDay?.date ?? '—',
      color: 'var(--pos)',
      pct: null,
    },
    {
      label: 'Score de consistencia',
      value: `${stats.consistencyPct}%`,
      sub: '% profit sin el mejor día',
      color: stats.consistencyPct >= 70 ? 'var(--pos)' : stats.consistencyPct >= 50 ? 'var(--amber)' : 'var(--red)',
      pct: stats.consistencyPct,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Selector cuenta */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {accountOptions.map(a => (
          <button key={a.id} onClick={() => setSelectedId(a.id)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.15s',
            border: `1px solid ${selectedId === a.id ? 'var(--brand)' : 'var(--border2)'}`,
            background: selectedId === a.id ? 'var(--brand2)' : 'transparent',
            color: selectedId === a.id ? 'var(--brand)' : 'var(--text2)',
          }}>{a.firm}</button>
        ))}
      </div>

      {/* Métricas */}
      <div className="grid-3">
        {metrics.map(m => (
          <div key={m.label} style={{
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            borderRadius: 'var(--r2)', padding: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
              {m.label}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: m.color, marginBottom: 4 }}>
              {m.value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{m.sub}</div>
            {m.pct !== null && (
              <div style={{ marginTop: 8 }}>
                <ProgressBar value={m.pct} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Gráfico PnL diario */}
      <Card title="PnL por día">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stats.dailyChart} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
              tickFormatter={v => `$${v}`} />
            <Tooltip contentStyle={TT} formatter={v => [`$${v?.toLocaleString()}`, 'PnL']} />
            <ReferenceLine y={0} stroke="var(--border3)" />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
              {stats.dailyChart.map((entry, i) => (
                <Cell key={i} fill={entry.pnl >= 0 ? 'var(--pos)' : 'var(--red)'} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Reglas de consistencia genéricas */}
      <Card title="Reglas de consistencia">
        {[
          {
            label: 'Días con profit',
            ok: stats.winDayRate >= 50,
            value: `${stats.winDayRate}%`,
            rule: 'Objetivo: ≥50% de días en positivo',
          },
          {
            label: 'Racha perdedora',
            ok: stats.maxLossStreak <= 3,
            value: `${stats.maxLossStreak} días`,
            rule: 'Objetivo: máximo 3 días consecutivos en pérdida',
          },
          {
            label: 'Score de consistencia',
            ok: stats.consistencyPct >= 60,
            value: `${stats.consistencyPct}%`,
            rule: 'Objetivo: ≥60% — no depender de un solo día',
          },
          {
            label: 'Max daily loss',
            ok: stats.maxDailyLoss <= (selectedAccount?.size ? selectedAccount.size * 0.05 : Infinity),
            value: `-$${stats.maxDailyLoss.toLocaleString()}`,
            rule: selectedAccount?.size
              ? `Objetivo: no superar $${(selectedAccount.size * 0.05).toLocaleString()} (5% del capital)`
              : 'Objetivo: no superar el 5% del capital en un día',
          },
        ].map(r => (
          <div key={r.label} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px', borderRadius: 'var(--r)',
            background: r.ok ? 'var(--brand2)' : 'var(--red2)',
            border: `1px solid ${r.ok ? 'rgba(0,208,132,0.2)' : 'rgba(255,90,106,0.2)'}`,
            marginBottom: 8,
          }}>
            <span style={{ flexShrink: 0, color: r.ok ? 'var(--pos)' : 'var(--red)' }}>{r.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{r.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>{r.rule}</div>
            </div>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
              color: r.ok ? 'var(--pos)' : 'var(--red)',
            }}>{r.value}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────
//  MAIN EXPORT
// ─────────────────────────────────────────────
export default function Rentabilidad() {
  const [tab, setTab] = useState('cashflow')

  const cashflow  = useCashflow()
  const addEntry  = useStore(s => s.addCashflowEntry)
  const trades    = useStore(s => s.trades)
  const accounts  = useAccounts()

  return (
    <PremiumGate feature="rentabilidad">
    <div className="page-inner">
      <PageHeader title="Rentabilidad" subtitle="Cashflow real · Curva de equity · Consistencia" />

      <div className="tabs" style={{ marginBottom: 24 }}>
        {[
          { key: 'cashflow',    icon: PiggyBank,  label: 'Cashflow'    },
          { key: 'equity',      icon: TrendingUp, label: 'Equity'      },
          { key: 'consistency', icon: Target,     label: 'Consistencia' },
        ].map(({ key, icon: TabIcon, label }) => (
          <div key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TabIcon size={13} /> {label}
          </div>
        ))}
      </div>

      {tab === 'cashflow'    && <TabCashflow   cashflow={cashflow} addEntry={addEntry} />}
      {tab === 'equity'      && <TabEquity     trades={trades} accounts={accounts} />}
      {tab === 'consistency' && <TabConsistency trades={trades} accounts={accounts} />}
    </div>
    </PremiumGate>
  )
}
