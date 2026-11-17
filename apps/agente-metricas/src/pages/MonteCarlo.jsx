import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'
import { BarChart3, Rocket, AlertTriangle, Ruler, Lightbulb } from 'lucide-react'
import { Card, PageHeader, MetricCard } from '@/components/ui'
import PremiumGate from '@/components/premium/PremiumGate'
import { useTrades } from '@/store/useStore'
import { groupIntoOperations } from '@/lib/operations'

const TT = { background: 'rgba(16,20,30,0.92)', border: '1px solid var(--border2)', borderRadius: 10, fontSize: 11, color: 'var(--text)', boxShadow: 'var(--shadow)', padding: '9px 13px', backdropFilter: 'blur(8px)' }

export default function MonteCarlo() {
  // Por operación completa (parciales de una posición = una operación)
  const rowTrades = useTrades()
  const trades = useMemo(() => groupIntoOperations(rowTrades), [rowTrades])

  // Derive defaults from actual trade history
  const wins    = trades.filter(t => t.result === 'win')
  const losses  = trades.filter(t => t.result === 'loss')
  const defWR   = trades.length ? Math.round(wins.length / trades.length * 100) : 61
  const defRR   = wins.length   ? parseFloat((wins.reduce((s,t) => s + t.rrActual, 0) / wins.length).toFixed(1)) : 1.8

  const [params, setParams] = useState({
    capital:    100000,
    target:     10,
    maxDD:      10,
    dailyDD:    5,
    winRate:    defWR,
    rr:         defRR,
    riskPct:    1,
    tradesPerDay: 2,
    tradingDays:  30,
    simulations: 1000,
  })
  const [results, setResults] = useState(null)
  const [running, setRunning] = useState(false)

  const set = (k, v) => setParams(p => ({ ...p, [k]: parseFloat(v) || 0 }))

  const runSim = () => {
    setRunning(true)
    setTimeout(() => {
      const { capital, target, maxDD, dailyDD, winRate, rr, riskPct, tradesPerDay, tradingDays, simulations } = params
      const wr      = winRate / 100
      const targetE = capital * (target / 100)
      const maxDDE  = capital * (maxDD / 100)
      const maxDailyDDE_pct = dailyDD / 100

      let passed = 0
      let allFinalEquities = []
      let samplePaths = []   // store a few paths for the chart

      for (let s = 0; s < simulations; s++) {
        let equity     = capital
        let peakEquity = capital
        let failed     = false

        const path = [capital]

        for (let d = 0; d < tradingDays && !failed; d++) {
          const dayStart = equity
          for (let t = 0; t < tradesPerDay && !failed; t++) {
            if (Math.random() < wr) {
              equity += equity * (riskPct / 100) * rr
            } else {
              equity -= equity * (riskPct / 100)
            }
            peakEquity = Math.max(peakEquity, equity)

            // Check drawdown limits
            const totalDD  = (peakEquity - equity) / peakEquity * 100
            const dailyDDv = (dayStart - equity)  / dayStart  * 100
            if (totalDD >= maxDD || dailyDDv >= dailyDD) {
              failed = true
            }
          }
          path.push(Math.round(equity))
        }

        const gain = ((equity - capital) / capital) * 100
        allFinalEquities.push(parseFloat(gain.toFixed(2)))
        if (!failed && gain >= target) passed++
        if (s < 80) samplePaths.push(path)
      }

      // Build distribution buckets
      const buckets = {}
      allFinalEquities.forEach(r => {
        const k = Math.round(r / 2) * 2
        buckets[k] = (buckets[k] || 0) + 1
      })

      // Build chart data from sample paths (align to max length)
      const maxLen  = Math.max(...samplePaths.map(p => p.length))
      const chartData = Array.from({ length: maxLen }, (_, i) => {
        const row = { day: i }
        samplePaths.forEach((p, j) => { if (p[i] !== undefined) row[`p${j}`] = p[i] })
        return row
      })

      const sorted = [...allFinalEquities].sort((a, b) => a - b)
      const avg    = allFinalEquities.reduce((s, v) => s + v, 0) / allFinalEquities.length
      const p10    = sorted[Math.floor(sorted.length * 0.1)]
      const p50    = sorted[Math.floor(sorted.length * 0.5)]
      const p90    = sorted[Math.floor(sorted.length * 0.9)]

      setResults({
        passRate:    parseFloat((passed / simulations * 100).toFixed(1)),
        passed,
        simulations,
        avg:         parseFloat(avg.toFixed(2)),
        best:        parseFloat(Math.max(...allFinalEquities).toFixed(2)),
        worst:       parseFloat(Math.min(...allFinalEquities).toFixed(2)),
        p10:         parseFloat(p10.toFixed(2)),
        p50:         parseFloat(p50.toFixed(2)),
        p90:         parseFloat(p90.toFixed(2)),
        buckets,
        chartData,
        samplePaths,
        targetLine:  capital * (1 + target / 100),
        drawdownLine: capital * (1 - maxDD / 100),
      })
      setRunning(false)
    }, 50)
  }

  const passColor = results
    ? results.passRate >= 70 ? 'var(--pos)'
    : results.passRate >= 40 ? 'var(--amber)'
    : 'var(--red)'
    : 'var(--text)'

  return (
    <PremiumGate feature="monteCarlo">
    <div className="page-inner">
      <PageHeader title="Monte Carlo Simulator" subtitle="Probabilidad de aprobar challenge basada en tu historial" />

      <div className="grid-2 section-gap">
        {/* Params */}
        <Card title="Parámetros del challenge">
          <div className="grid-2">
            {[
              { label: 'Capital ($)',         key: 'capital',      placeholder: '100000' },
              { label: 'Objetivo profit (%)', key: 'target',       placeholder: '10' },
              { label: 'Max Drawdown (%)',    key: 'maxDD',        placeholder: '10' },
              { label: 'Max Daily DD (%)',    key: 'dailyDD',      placeholder: '5' },
              { label: 'Win Rate (%)',        key: 'winRate',      placeholder: '61' },
              { label: 'Avg R:R',            key: 'rr',           placeholder: '1.8' },
              { label: 'Riesgo/trade (%)',    key: 'riskPct',      placeholder: '1' },
              { label: 'Trades por día',      key: 'tradesPerDay', placeholder: '2' },
              { label: 'Días de trading',     key: 'tradingDays',  placeholder: '30' },
              { label: 'Simulaciones',        key: 'simulations',  placeholder: '1000' },
            ].map(({ label, key, placeholder }) => (
              <div className="form-group" key={key}>
                <label>{label}</label>
                <input
                  type="number"
                  value={params[key]}
                  placeholder={placeholder}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--bg3)', borderRadius: 'var(--r)', padding: 12, marginBottom: 14, fontSize: 11, color: 'var(--text2)' }}>
            <Lightbulb size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Win Rate y R:R calculados automáticamente de tus <strong style={{ color: 'var(--text)' }}>{trades.length} trades</strong> registrados.</span>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={runSim}
            disabled={running}
          >
            {running ? 'Simulando...' : `Ejecutar ${params.simulations.toLocaleString()} simulaciones`}
          </button>
        </Card>

        {/* Results */}
        <Card title="Resultados">
          {!results && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 12 }}>
              Configura los parámetros y ejecuta la simulación
            </div>
          )}
          {results && (
            <>
              {/* Pass rate hero */}
              <div style={{ textAlign: 'center', padding: '20px 0 24px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Probabilidad de aprobar
                </div>
                <div style={{ fontSize: 52, fontWeight: 700, fontFamily: 'var(--mono)', color: passColor, letterSpacing: -2 }}>
                  {results.passRate}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {results.passed} de {results.simulations} simulaciones exitosas
                </div>
              </div>

              <div className="grid-2" style={{ gap: 10 }}>
                <MetricCard size="hero" icon={<BarChart3 size={15} />} label="Resultado promedio" value={`${results.avg >= 0 ? '+' : ''}${results.avg}%`} deltaUp={results.avg >= 0} iconColor="green" />
                <MetricCard size="hero" icon={<Rocket size={15} />} label="Mejor escenario"    value={`${results.best >= 0 ? '+' : ''}${results.best}%`} deltaUp={true} iconColor="green" />
                <MetricCard size="hero" icon={<AlertTriangle size={15} />} label="Peor escenario"     value={`${results.worst}%`} deltaUp={false} iconColor="green" />
                <MetricCard size="hero" icon={<Ruler size={15} />} label="Percentil 50"       value={`${results.p50 >= 0 ? '+' : ''}${results.p50}%`} iconColor="green" />
              </div>

              <div className="divider" />
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Percentiles
              </div>
              <div className="grid-3" style={{ gap: 8 }}>
                {[['P10 (pesimista)', results.p10, false], ['P50 (mediana)', results.p50, null], ['P90 (optimista)', results.p90, true]].map(([l, v, up]) => (
                  <div key={l} style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{l}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 15, color: up === true ? 'var(--pos)' : up === false ? 'var(--red)' : 'var(--text)' }}>
                      {v >= 0 ? '+' : ''}{v}%
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Equity paths chart */}
      {results && (
        <Card title="Trayectorias de equity (muestra de simulaciones)" className="section-gap">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={results.chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} label={{ value: 'días', position: 'insideRight', fontSize: 10, fill: 'var(--text3)' }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={TT} formatter={v => [`$${v?.toLocaleString()}`]} />
              <ReferenceLine y={results.targetLine}   stroke="var(--pos)" strokeDasharray="4 2" label={{ value: 'Target', position: 'insideBottomLeft', fill: 'var(--pos)', fontSize: 10 }} />
              <ReferenceLine y={results.drawdownLine} stroke="var(--neg)"   strokeDasharray="4 2" label={{ value: 'Max DD', position: 'insideTopLeft', fill: 'var(--neg)',   fontSize: 10 }} />
              {results.samplePaths.slice(0, 40).map((_, j) => (
                <Area key={j} type="monotone" dataKey={`p${j}`} stroke="rgba(59,130,246,0.15)" fill="none" dot={false} strokeWidth={1} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Distribution */}
      {results && (
        <Card title="Distribución de resultados finales">
          <div style={{ marginTop: 8 }}>
            {Object.entries(results.buckets)
              .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
              .map(([k, v]) => {
                const maxV   = Math.max(...Object.values(results.buckets))
                const pct    = Math.max(v > 0 ? 3 : 0, (v / maxV * 100)).toFixed(0)
                const val    = parseFloat(k)
                const isPass = val >= params.target
                const color  = isPass ? 'var(--pos)' : val >= 0 ? 'var(--neutral)' : 'var(--red)'
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)', width: 44, textAlign: 'right' }}>
                      {val >= 0 ? '+' : ''}{k}%
                    </span>
                    <div style={{
                      height: 26, width: `${pct}%`, borderRadius: 4,
                      background: isPass ? 'var(--brand2)' : val >= 0 ? 'var(--neutral2)' : 'var(--red2)',
                      border: `1px solid ${color}20`,
                      display: 'flex', alignItems: 'center', paddingLeft: 8,
                      transition: 'width 0.4s',
                    }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color, fontWeight: 600 }}>{v}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </Card>
      )}
    </div>
    </PremiumGate>
  )
}
