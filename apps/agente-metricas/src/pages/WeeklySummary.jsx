import { useState, useMemo } from 'react'
import { BarChart, Bar, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import { PiggyBank, Compass, AlertTriangle, Repeat, ClipboardList } from 'lucide-react'
import {
  MetricCard, Card, PageHeader, Badge, ResultBadge,
  DirectionBadge, RValue, Tag, ProgressBar, CheckItem,
} from '@/components/ui'
import { mockWeekly } from '@/data/mockData'
import { useTrades } from '@/store/useStore'

export default function WeeklySummary() {
  const allTrades = useTrades()

  // ── Calcular semana actual (lunes–domingo) ──
  const { weekTrades, weekLabel, dailyPnl } = useMemo(() => {
    const now    = new Date()
    const day    = now.getDay() // 0=Sun
    const mon    = new Date(now)
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    mon.setHours(0, 0, 0, 0)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    sun.setHours(23, 59, 59, 999)

    const monStr = mon.toISOString().split('T')[0]
    const sunStr = sun.toISOString().split('T')[0]

    const weekTrades = allTrades.filter(t => t.date >= monStr && t.date <= sunStr)

    const fmt = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    const weekLabel = `${fmt(mon)} – ${fmt(sun)}`

    // PnL por día (R)
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    const dailyMap = {}
    weekTrades.forEach(t => {
      const d = new Date(t.date + 'T00:00:00')
      const idx = (d.getDay() + 6) % 7 // 0=Mon
      const label = days[idx]
      dailyMap[label] = (dailyMap[label] || 0) + (t.rPnl || 0)
    })
    const dailyPnl = days
      .filter(d => dailyMap[d] !== undefined)
      .map(d => ({ day: d, r: parseFloat((dailyMap[d] || 0).toFixed(2)) }))

    return { weekTrades, weekLabel, dailyPnl }
  }, [allTrades])

  // ── Calcular métricas de la semana ──
  const weekStats = useMemo(() => {
    const wins   = weekTrades.filter(t => t.result === 'win')
    const losses = weekTrades.filter(t => t.result === 'loss')
    const bes    = weekTrades.filter(t => t.result === 'breakeven')
    const pnlR   = parseFloat(weekTrades.reduce((s, t) => s + (t.rPnl || 0), 0).toFixed(2))
    const consistency = weekTrades.length > 0
      ? Math.round((wins.length / weekTrades.length) * 100) : 0
    return { wins: wins.length, losses: losses.length, breakevens: bes.length, pnlR, consistency, trades: weekTrades.length }
  }, [weekTrades])

  // Usar mockWeekly solo para el checklist y campos que no calculamos
  const w = mockWeekly
  const [checks, setChecks] = useState(
    Object.fromEntries(w.checklistItems.map((c) => [c.id, c.done]))
  )

  const toggleCheck = (id) => setChecks((prev) => ({ ...prev, [id]: !prev[id] }))
  const doneCount   = Object.values(checks).filter(Boolean).length
  const score       = Math.round((doneCount / w.checklistItems.length) * 10)

  return (
    <div className="page-inner">
      <PageHeader title="Weekly Summary" subtitle={`Semana del ${weekLabel}`}>
        <button className="btn btn-secondary btn-sm">← Anterior</button>
        <button className="btn btn-secondary btn-sm">Siguiente →</button>
      </PageHeader>

      {/* KPIs — datos reales de la semana */}
      <div className="grid-5 section-gap">
        <MetricCard size="hero" icon={<PiggyBank size={15} />} label="PnL Total (R)"
          value={`${weekStats.pnlR >= 0 ? '+' : ''}${weekStats.pnlR}R`}
          deltaUp={weekStats.pnlR >= 0}/>
        <MetricCard size="hero" icon={<Compass size={15} />} label="Consistencia"  value={`${weekStats.consistency}%`}
          deltaUp={weekStats.consistency >= 60}/>
        <MetricCard size="hero" icon={<AlertTriangle size={15} />} label="Días fuera plan" value={w.daysOutOfPlan}
          delta={w.outOfPlanDays.join(', ')} deltaUp={false}/>
        <MetricCard size="hero" icon={<Repeat size={15} />} label="Sobreoperación" value={`${w.overtrading}x`}
          delta="Martes AM" deltaUp={false}/>
        <MetricCard size="hero" icon={<ClipboardList size={15} />} label="Trades" value={weekStats.trades}
          delta={`${weekStats.wins}W · ${weekStats.losses}L · ${weekStats.breakevens}BE`} iconColor="green"/>
      </div>

      {/* Charts + Checklist */}
      <div className="grid-2 section-gap">
        <Card title="PnL por día (R)">
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={dailyPnl.length > 0 ? dailyPnl : w.dailyPnl} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
              <Tooltip
                formatter={(v) => [`${v > 0 ? '+' : ''}${v}R`]}
                contentStyle={{ background: 'rgba(16,20,30,0.92)', border: '1px solid var(--border2)', borderRadius: 10, fontSize: 11, color: 'var(--text)', boxShadow: 'var(--shadow)', padding: '9px 13px', backdropFilter: 'blur(8px)' }}
              />
              <Bar dataKey="r" radius={[3, 3, 0, 0]}>
                {w.dailyPnl.map((entry) => (
                  <Cell key={entry.day} fill={entry.r >= 0 ? 'var(--pos)' : 'var(--red)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {(dailyPnl.length > 0 ? dailyPnl : w.dailyPnl).map((d) => (
              <span key={d.day} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--text3)' }}>
                {d.day}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Checklist semanal">
          {w.checklistItems.map((c) => (
            <CheckItem
              key={c.id}
              text={c.text}
              checked={checks[c.id]}
              onToggle={() => toggleCheck(c.id)}
            />
          ))}
          <div className="divider" />
          <div className="flex-between">
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Puntuación de disciplina</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--amber)' }}>
              {score} <span style={{ color: 'var(--text3)', fontSize: 12 }}>/10</span>
            </span>
          </div>
          <ProgressBar value={score} max={10} />
        </Card>
      </div>

      {/* Trade table */}
      <Card title="Trades de la semana">
        <div className="flex-between mb-4">
          <div />
          <Badge variant="blue">{weekStats.trades} operaciones</Badge>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Par</th><th>Dir.</th><th>Setup</th>
              <th>R:R Obj</th><th>Resultado</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {weekTrades.map((t) => (
              <tr key={t.id}>
                <td style={{ color: 'var(--text2)', fontSize: 12 }}>{t.date}</td>
                <td className="mono">{t.pair}</td>
                <td><DirectionBadge direction={t.direction} /></td>
                <td><Tag>{t.setup}</Tag></td>
                <td className="mono">1:{t.rrObjective}</td>
                <td><RValue value={t.rPnl} /></td>
                <td><ResultBadge result={t.result} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
