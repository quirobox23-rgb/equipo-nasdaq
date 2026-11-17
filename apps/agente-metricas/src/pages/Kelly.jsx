import { useState, useMemo } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, CartesianGrid } from 'recharts'
import {
  Pencil, AlertTriangle, Calculator, Ruler, Dices, BarChart3, CheckCircle2, XCircle,
} from 'lucide-react'
import { Card, PageHeader, MetricCard, ProgressBar } from '@/components/ui'
import PremiumGate from '@/components/premium/PremiumGate'
import { useTrades, useAccounts } from '@/store/useStore'
import { groupIntoOperations } from '@/lib/operations'

// ── Instrument catalogue ──────────────────────
// pipValue = $ per pip/tick per 1 contract/lot
// unit     = label shown in output
export const INSTRUMENTS = [
  // Micro futures
  { symbol: 'MNQ',    label: 'MNQ  (Micro Nasdaq)',       pipValue: 0.50,  unit: 'contratos', tickSize: 0.25 },
  { symbol: 'MES',    label: 'MES  (Micro S&P 500)',       pipValue: 1.25,  unit: 'contratos', tickSize: 0.25 },
  { symbol: 'MGC',    label: 'MGC  (Micro Gold)',          pipValue: 1.00,  unit: 'contratos', tickSize: 0.10 },
  { symbol: 'MCL',    label: 'MCL  (Micro Crude Oil)',     pipValue: 1.00,  unit: 'contratos', tickSize: 0.01 },
  { symbol: 'M2K',    label: 'M2K  (Micro Russell)',       pipValue: 0.50,  unit: 'contratos', tickSize: 0.10 },
  { symbol: 'MYM',    label: 'MYM  (Micro Dow)',           pipValue: 0.50,  unit: 'contratos', tickSize: 1.00 },
  // Mini futures
  { symbol: 'NQ',     label: 'NQ   (Nasdaq E-mini)',       pipValue: 5.00,  unit: 'contratos', tickSize: 0.25 },
  { symbol: 'ES',     label: 'ES   (S&P 500 E-mini)',      pipValue: 12.50, unit: 'contratos', tickSize: 0.25 },
  { symbol: 'GC',     label: 'GC   (Gold full)',           pipValue: 10.00, unit: 'contratos', tickSize: 0.10 },
  { symbol: 'CL',     label: 'CL   (Crude Oil)',           pipValue: 10.00, unit: 'contratos', tickSize: 0.01 },
  { symbol: 'RTY',    label: 'RTY  (Russell E-mini)',      pipValue: 5.00,  unit: 'contratos', tickSize: 0.10 },
  { symbol: 'YM',     label: 'YM   (Dow E-mini)',          pipValue: 5.00,  unit: 'contratos', tickSize: 1.00 },
  // Forex standard (1 lot = 100k)
  { symbol: 'EURUSD', label: 'EURUSD (Forex)',             pipValue: 10.00, unit: 'lots',      tickSize: 0.0001 },
  { symbol: 'GBPUSD', label: 'GBPUSD (Forex)',             pipValue: 10.00, unit: 'lots',      tickSize: 0.0001 },
  { symbol: 'USDJPY', label: 'USDJPY (Forex)',             pipValue: 9.10,  unit: 'lots',      tickSize: 0.01   },
  { symbol: 'XAUUSD', label: 'XAUUSD (Gold/Forex)',        pipValue: 10.00, unit: 'lots',      tickSize: 0.01   },
  // Crypto
  { symbol: 'BTC',    label: 'BTC  (Bitcoin)',             pipValue: 1.00,  unit: 'BTC',       tickSize: 1.00   },
  { symbol: 'ETH',    label: 'ETH  (Ethereum)',            pipValue: 1.00,  unit: 'ETH',       tickSize: 0.01   },
  { symbol: 'CUSTOM', label: 'Símbolo personalizado…',  pipValue: 1.00,  unit: 'contratos', tickSize: 1.00   },
]

const RISK_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3]
const CAPITALS    = [10_000, 25_000, 50_000, 100_000, 200_000]

// ── Shared position size formula ──────────────
// riskAmount = balance * riskPct/100
// contracts  = riskAmount / (stopLoss * pipValue)
function calcPosition(balance, riskPct, stopLoss, pipValue) {
  if (!balance || !riskPct || !stopLoss || !pipValue) return null
  const riskAmount = balance * (riskPct / 100)
  const contracts  = riskAmount / (stopLoss * pipValue)
  return { riskAmount, contracts: parseFloat(contracts.toFixed(2)) }
}

// ── SECTION 1: Quick Position Calculator ──────
function PositionCalculator({ accounts }) {
  const [balance,    setBalance]    = useState('')
  const [riskPct,    setRiskPct]    = useState(1)
  const [stopLoss,   setStopLoss]   = useState('')
  const [instIdx,    setInstIdx]    = useState(0)
  const [customPip,  setCustomPip]  = useState('')
  const [customSym,  setCustomSym]  = useState('')
  const [customUnit, setCustomUnit] = useState('contratos')
  const [fromAccount,setFromAccount]= useState('manual')

  const inst      = INSTRUMENTS[instIdx]
  const isCustom  = inst.symbol === 'CUSTOM'
  const pipValue  = isCustom ? (parseFloat(customPip) || 0) : inst.pipValue
  const unit      = isCustom ? customUnit : inst.unit

  // If "from account" selected, prefill balance
  const effectiveBalance = fromAccount !== 'manual'
    ? (accounts.find(a => a.id === fromAccount)?.size ?? (parseFloat(balance) || 0))
    : (parseFloat(balance) || 0)

  const result = calcPosition(effectiveBalance, riskPct, parseFloat(stopLoss) || 0, pipValue)

  const isValid  = result !== null && result.contracts > 0
  const errEmpty = !effectiveBalance || !stopLoss || !pipValue

  return (
    <Card title="Calculadora de posición">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Account selector */}
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>Balance de la cuenta</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={fromAccount} onChange={e => setFromAccount(e.target.value)} style={{ flex: 1 }}>
              <option value="manual">Introducir manualmente</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.firm} · {a.type} · ${Number(a.size).toLocaleString()}
                </option>
              ))}
            </select>
            {fromAccount === 'manual' && (
              <input
                type="number" placeholder="100000"
                value={balance} onChange={e => setBalance(e.target.value)}
                style={{ flex: 1 }}
              />
            )}
          </div>
          {fromAccount !== 'manual' && (
            <div style={{ fontSize: 11, color: 'var(--brand)', marginTop: 4, fontFamily: 'var(--mono)' }}>
              Balance: ${effectiveBalance.toLocaleString()}
            </div>
          )}
        </div>

        {/* Risk % */}
        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Riesgo por trade (%)</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)', fontWeight: 600 }}>{riskPct}%</span>
          </label>
          <input type="range" min="0.1" max="5" step="0.1"
            value={riskPct} onChange={e => setRiskPct(parseFloat(e.target.value))}
            style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
          />
          <div className="flex-between" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
            <span>0.1%</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
              ${effectiveBalance ? (effectiveBalance * riskPct / 100).toFixed(0) : '—'} en riesgo
            </span>
            <span>5%</span>
          </div>
        </div>

        {/* Stop Loss */}
        <div className="form-group">
          <label>Stop Loss (ticks / pips / puntos)</label>
          <input type="number" placeholder="20" min="0"
            value={stopLoss} onChange={e => setStopLoss(e.target.value)} />
          {inst.tickSize && stopLoss && (
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
              = {(parseFloat(stopLoss) * inst.tickSize).toFixed(4)} pts · tick size: {inst.tickSize}
            </div>
          )}
        </div>

        {/* Instrument */}
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>Símbolo / Instrumento</label>
          <select value={instIdx} onChange={e => setInstIdx(parseInt(e.target.value))}>
            {INSTRUMENTS.map((inst, i) => (
              <option key={i} value={i}>{inst.label}</option>
            ))}
          </select>
        </div>

        {/* Custom symbol fields */}
        {isCustom && (
          <>
            <div className="form-group">
              <label>Nombre del símbolo</label>
              <input type="text" placeholder="Ej: MNQH25" value={customSym}
                onChange={e => setCustomSym(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Valor por pip/tick ($)</label>
              <input type="number" placeholder="0.50" step="0.01" value={customPip}
                onChange={e => setCustomPip(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Unidad</label>
              <select value={customUnit} onChange={e => setCustomUnit(e.target.value)}>
                <option>contratos</option><option>lots</option><option>acciones</option><option>BTC</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* Result */}
      <div style={{
        marginTop: 8,
        borderRadius: 'var(--r)',
        padding: 20,
        background: isValid ? 'var(--brand2)' : 'var(--bg3)',
        border: `1px solid ${isValid ? 'rgba(59,130,246,0.25)' : 'var(--border)'}`,
        transition: 'all 0.2s',
      }}>
        {errEmpty && (
          <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
            Rellena todos los campos para ver el resultado
          </div>
        )}
        {!errEmpty && isValid && result && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
                {isCustom ? customSym || 'Símbolo' : inst.symbol} · {unit}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 36, fontWeight: 800, color: 'var(--brand)', letterSpacing: -1 }}>
                {result.contracts}
              </div>
              <div style={{ fontSize: 11, color: 'var(--brand)', opacity: 0.7 }}>{unit}</div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(59,130,246,0.2)', borderRight: '1px solid rgba(59,130,246,0.2)', padding: '0 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>CAPITAL EN RIESGO</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--amber)' }}>
                ${result.riskAmount.toFixed(0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{riskPct}% del balance</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>VALOR POR PIP/TICK</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700 }}>
                ${(result.contracts * pipValue).toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>por pip · ${pipValue}/pip</div>
            </div>
          </div>
        )}
        {!errEmpty && !isValid && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>
            <AlertTriangle size={13} /> Revisa los valores — verifica que pip value y stop loss sean correctos
          </div>
        )}
      </div>

      {/* Formula note */}
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10, fontFamily: 'var(--mono)', lineHeight: 1.6 }}>
        Fórmula: contratos = (balance × riesgo%) ÷ (stop_loss × pip_value)
        {isValid && result && (
          <span style={{ color: 'var(--text2)' }}>
            {' '}→ ({effectiveBalance.toLocaleString()} × {riskPct}%) ÷ ({stopLoss} × ${pipValue}) = <strong style={{ color: 'var(--brand)' }}>{result.contracts}</strong>
          </span>
        )}
      </div>
    </Card>
  )
}

// ── SECTION 2: Kelly Criterion ─────────────────
function KellySection({ realWR, realRR }) {
  const [wr,      setWr]      = useState(realWR)
  const [rr,      setRr]      = useState(realRR)
  const [capital, setCapital] = useState(100_000)

  const kelly      = Math.max(0, wr/100 - (1 - wr/100) / rr)
  const kellyPct   = parseFloat((kelly * 100).toFixed(2))
  const halfKelly  = parseFloat((kellyPct / 2).toFixed(2))
  const quartKelly = parseFloat((kellyPct / 4).toFixed(2))
  const recommended= Math.min(quartKelly, 2)

  return (
    <Card title="Criterio de Kelly">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--brand2)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--r)', padding: 12, marginBottom: 16, fontSize: 11, color: 'var(--brand)' }}>
        <BarChart3 size={13} /> Calculado desde tu historial real: WR {realWR}% · R:R {realRR}
      </div>

      <div className="form-group">
        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Win Rate</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{wr}%</span>
        </label>
        <input type="range" min="30" max="80" step="0.5" value={wr}
          onChange={e => setWr(parseFloat(e.target.value))}
          style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
        <div className="flex-between" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
          <span>30%</span><span>80%</span>
        </div>
      </div>

      <div className="form-group">
        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>R:R Ratio</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{rr}</span>
        </label>
        <input type="range" min="0.5" max="5" step="0.1" value={rr}
          onChange={e => setRr(parseFloat(e.target.value))}
          style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
        <div className="flex-between" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
          <span>0.5</span><span>5.0</span>
        </div>
      </div>

      <div className="form-group">
        <label>Capital de referencia ($)</label>
        <input type="number" value={capital} onChange={e => setCapital(parseFloat(e.target.value) || 0)} />
      </div>

      <div className="divider" />

      <div className="grid-2" style={{ gap: 10 }}>
        {[
          { label: 'Kelly completo',       value: `${kellyPct}%`,   color: 'var(--amber)', note: 'Muy agresivo' },
          { label: 'Half Kelly',           value: `${halfKelly}%`,  color: 'var(--brand)',  note: 'Moderado' },
          { label: '¼ Kelly (recomendado)',value: `${quartKelly}%`, color: 'var(--pos)', note: 'Conservador', highlight: true },
          { label: 'Capital en riesgo',    value: `$${(capital * recommended / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: 'var(--text)', note: `${recommended}% del capital` },
        ].map(({ label, value, color, note, highlight }) => (
          <div key={label} style={{
            background: highlight ? 'var(--brand2)' : 'var(--bg3)',
            border: highlight ? '1px solid rgba(0,208,132,0.2)' : '1px solid var(--border)',
            borderRadius: 'var(--r)', padding: 14,
          }}>
            <div style={{ fontSize: 10, color: highlight ? 'var(--pos)' : 'var(--text3)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 10, color: highlight ? 'var(--pos)' : 'var(--text3)', marginTop: 4 }}>{note}</div>
          </div>
        ))}
      </div>

      <div className="divider" />
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>Calidad del edge</div>
      <ProgressBar value={Math.min(kellyPct, 20)} max={20} />
      <div className="flex-between mt-2" style={{ fontSize: 10, color: 'var(--text3)' }}>
        <span>Sin edge</span>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>Kelly: {kellyPct}%</span>
        <span>Edge fuerte</span>
      </div>
    </Card>
  )
}

// ── SECTION 3: Monte Carlo ─────────────────────
function runMonteCarlo(trades, runs = 500, drawdownLimit = 0.1) {
  if (!trades.length) return null
  const returns = trades.map(t => t.rPnl)
  const ruinCount   = { 10: 0, 20: 0, 50: 0 }
  const finalValues = []
  const paths       = []    // guardar algunas curvas para graficar

  for (let r = 0; r < runs; r++) {
    let equity = 0
    let peak   = 0
    let ruin   = false
    const path = []

    for (let i = 0; i < 50; i++) {
      const rPnl  = returns[Math.floor(Math.random() * returns.length)]
      equity += rPnl
      if (equity > peak) peak = equity
      const dd = peak > 0 ? (peak - equity) / peak : 0
      if (dd >= drawdownLimit) ruin = true
      if (i % 5 === 0) path.push(parseFloat(equity.toFixed(2)))
    }

    finalValues.push(equity)
    if (ruin) {
      ruinCount[10]++
      if (drawdownLimit >= 0.2) ruinCount[20]++
      if (drawdownLimit >= 0.5) ruinCount[50]++
    }
    if (r < 50) paths.push(path)  // solo guardar 50 paths para graficar
  }

  finalValues.sort((a, b) => a - b)
  const p10  = finalValues[Math.floor(runs * 0.10)]
  const p50  = finalValues[Math.floor(runs * 0.50)]
  const p90  = finalValues[Math.floor(runs * 0.90)]
  const mean = finalValues.reduce((s, v) => s + v, 0) / runs

  // Construir datos del gráfico: percentiles por paso
  const steps = 10
  const chartData = Array.from({ length: steps + 1 }, (_, i) => {
    const vals = paths.map(p => p[i] ?? p[p.length - 1]).filter(v => v !== undefined).sort((a, b) => a - b)
    return {
      step: i * 5,
      p10:  vals[Math.floor(vals.length * 0.1)] ?? 0,
      p50:  vals[Math.floor(vals.length * 0.5)] ?? 0,
      p90:  vals[Math.floor(vals.length * 0.9)] ?? 0,
    }
  })

  return {
    ruinPct: parseFloat((ruinCount[10] / runs * 100).toFixed(1)),
    p10: parseFloat(p10?.toFixed(2) ?? 0),
    p50: parseFloat(p50?.toFixed(2) ?? 0),
    p90: parseFloat(p90?.toFixed(2) ?? 0),
    mean: parseFloat(mean.toFixed(2)),
    chartData,
  }
}

const TT = { background: 'rgba(16,20,30,0.92)', border: '1px solid var(--border2)', borderRadius: 10, fontSize: 11, color: 'var(--text)', boxShadow: 'var(--shadow)', padding: '9px 13px', backdropFilter: 'blur(8px)' }

function MonteCarloSection({ trades }) {
  const [ddLimit, setDdLimit] = useState(10)

  const mc = useMemo(() => runMonteCarlo(trades, 500, ddLimit / 100), [trades, ddLimit])

  if (!mc) return (
    <Card title="Monte Carlo · Riesgo de ruina">
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 12 }}>
        Registra trades para ver la simulación Monte Carlo
      </div>
    </Card>
  )

  const ruinColor = mc.ruinPct > 30 ? 'var(--red)' : mc.ruinPct > 15 ? 'var(--amber)' : 'var(--pos)'

  return (
    <Card title="Monte Carlo · Riesgo de ruina">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--brand2)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--r)', padding: 12, marginBottom: 16, fontSize: 11, color: 'var(--brand)' }}>
        <Dices size={13} /> 500 simulaciones · 50 trades por simulación · basado en tu historial real
      </div>

      {/* DD limit toggle */}
      <div className="form-group">
        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Límite de drawdown que defines como "ruina"</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--amber)' }}>{ddLimit}%</span>
        </label>
        <input type="range" min="5" max="50" step="5" value={ddLimit}
          onChange={e => setDdLimit(parseInt(e.target.value))}
          style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
        <div className="flex-between" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
          <span>5% (muy estricto)</span><span>50% (muy permisivo)</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-4" style={{ gap: 10, marginBottom: 16 }}>
        {[
          { label: `Riesgo de ruina (DD>${ddLimit}%)`, value: `${mc.ruinPct}%`, color: ruinColor },
          { label: 'Peor escenario (P10)', value: `${mc.p10 >= 0 ? '+' : ''}${mc.p10}R`, color: mc.p10 >= 0 ? 'var(--pos)' : 'var(--red)' },
          { label: 'Mediana (P50)', value: `${mc.p50 >= 0 ? '+' : ''}${mc.p50}R`, color: mc.p50 >= 0 ? 'var(--pos)' : 'var(--red)' },
          { label: 'Mejor escenario (P90)', value: `+${mc.p90}R`, color: 'var(--pos)' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de distribución de paths */}
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Distribución de escenarios (50 trades)</div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={mc.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="step" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
            tickFormatter={v => `T${v}`} />
          <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
            tickFormatter={v => `${v >= 0 ? '+' : ''}${v}R`} />
          <Tooltip contentStyle={TT} formatter={(v, n) => [`${v >= 0 ? '+' : ''}${v}R`, n]} />
          <ReferenceLine y={0} stroke="var(--border3)" />
          <Line type="monotone" dataKey="p90" stroke="var(--pos)"  strokeWidth={1.5} dot={false} name="P90 (optimista)" />
          <Line type="monotone" dataKey="p50" stroke="var(--brand)"   strokeWidth={2}   dot={false} name="P50 (mediana)"   strokeDasharray="4 2" />
          <Line type="monotone" dataKey="p10" stroke="var(--red)"    strokeWidth={1.5} dot={false} name="P10 (pesimista)" />
        </LineChart>
      </ResponsiveContainer>

      {/* Interpretación */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '10px 14px', borderRadius: 'var(--r)',
        background: mc.ruinPct > 30 ? 'var(--red2)' : mc.ruinPct > 15 ? 'var(--amber2)' : 'var(--brand2)',
        border: `1px solid ${mc.ruinPct > 30 ? 'rgba(255,90,106,0.2)' : mc.ruinPct > 15 ? 'rgba(245,166,35,0.2)' : 'rgba(0,208,132,0.2)'}`,
        fontSize: 12, color: ruinColor }}>
        {mc.ruinPct <= 15 ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          : mc.ruinPct <= 30 ? <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          : <XCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
        <span>
          {mc.ruinPct <= 15
            ? `Riesgo controlado — solo ${mc.ruinPct}% de los escenarios alcanzan un DD del ${ddLimit}%`
            : mc.ruinPct <= 30
            ? `Riesgo moderado — ${mc.ruinPct}% de escenarios alcanzan DD>${ddLimit}%. Considera reducir el sizing.`
            : `Riesgo elevado — ${mc.ruinPct}% de escenarios alcanzan DD>${ddLimit}%. Reduce el riesgo por trade.`}
        </span>
      </div>
    </Card>
  )
}

// ── SECTION 4: Sizing por cuenta ──────────────
function SizingByAccount({ accounts, trades, realWR, realRR }) {
  const [stopLoss,  setStopLoss]  = useState(20)
  const [instIdx,   setInstIdx]   = useState(0)
  const [riskLevel, setRiskLevel] = useState(1)

  const inst = INSTRUMENTS[instIdx]

  // Kelly recomendado
  const kelly      = Math.max(0, realWR/100 - (1 - realWR/100) / realRR)
  const kellyPct   = Math.min(kelly * 100 / 4, 2)  // quarter Kelly, max 2%

  return (
    <Card title="Sizing recomendado por cuenta">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Instrumento</label>
          <select value={instIdx} onChange={e => setInstIdx(parseInt(e.target.value))}>
            {INSTRUMENTS.filter(i => i.symbol !== 'CUSTOM').map((inst, i) => (
              <option key={i} value={i}>{inst.symbol}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Stop Loss (ticks)</label>
          <input type="number" min="1" value={stopLoss} onChange={e => setStopLoss(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Riesgo %</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{riskLevel}%</span>
          </label>
          <input type="range" min="0.25" max="3" step="0.25" value={riskLevel}
            onChange={e => setRiskLevel(parseFloat(e.target.value))}
            style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', marginTop: 8 }} />
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Cuenta</th>
            <th>Capital</th>
            <th style={{ textAlign: 'right' }}>Riesgo $</th>
            <th style={{ textAlign: 'right' }}>Contratos</th>
            <th style={{ textAlign: 'right' }}>Kelly rec.</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => {
            const size       = Number(a.size)
            const riskAmt    = size * riskLevel / 100
            const contracts  = stopLoss > 0 && inst.pipValue > 0
              ? parseFloat((riskAmt / (stopLoss * inst.pipValue)).toFixed(2))
              : null
            const kellyAmt   = size * kellyPct / 100
            const kellyContr = stopLoss > 0 && inst.pipValue > 0
              ? parseFloat((kellyAmt / (stopLoss * inst.pipValue)).toFixed(2))
              : null
            const tooHigh    = riskLevel > kellyPct * 1.5
            const statusCol  = { active: 'var(--brand)', approved: 'var(--pos)', lost: 'var(--red)' }
            const statusLbl  = { active: 'ACTIVO', approved: 'FUNDED', lost: 'PERDIDA' }

            return (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>
                  {a.firm}
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{a.phase}</div>
                </td>
                <td className="mono" style={{ color: 'var(--text2)' }}>${size.toLocaleString()}</td>
                <td className="mono" style={{ textAlign: 'right', color: tooHigh ? 'var(--red)' : 'var(--amber)', fontWeight: 600 }}>
                  ${riskAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className="mono" style={{ textAlign: 'right', fontSize: 15, fontWeight: 700,
                  color: tooHigh ? 'var(--red)' : 'var(--pos)' }}>
                  {contracts ?? '—'}
                  <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>{inst.unit}</span>
                </td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--brand)', fontSize: 11 }}>
                  {kellyContr ?? '—'}
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>{kellyPct.toFixed(2)}%</div>
                </td>
                <td>
                  <span style={{ fontSize: 10, fontWeight: 700,
                    color: statusCol[a.status] ?? 'var(--text3)',
                    background: `${statusCol[a.status] ?? '#888'}18`,
                    padding: '2px 8px', borderRadius: 10,
                    border: `1px solid ${statusCol[a.status] ?? '#888'}30` }}>
                    {statusLbl[a.status] ?? a.status}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* RR óptimo */}
      <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 'var(--r)', background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
          R:R mínimo necesario con tu WR actual ({realWR}%)
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Para breakeven',  rr: parseFloat(((1 - realWR/100) / (realWR/100)).toFixed(2)) },
            { label: 'Para PF > 1.5',   rr: parseFloat((1.5 * (1 - realWR/100) / (realWR/100)).toFixed(2)) },
            { label: 'Para PF > 2.0',   rr: parseFloat((2.0 * (1 - realWR/100) / (realWR/100)).toFixed(2)) },
            { label: 'Tu R:R actual',   rr: realRR, actual: true },
          ].map(({ label, rr, actual }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700,
                color: actual ? 'var(--brand)' : rr <= realRR ? 'var(--pos)' : 'var(--red)' }}>
                {rr}:1
              </div>
              {!actual && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: rr <= realRR ? 'var(--pos)' : 'var(--red)' }}>
                  {rr <= realRR ? <><CheckCircle2 size={10} /> OK</> : <><XCircle size={10} /> No alcanza</>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ── Main page ─────────────────────────────────
export default function Kelly() {
  // Por operación completa (parciales de una posición = una operación)
  const rowTrades = useTrades()
  const trades   = useMemo(() => groupIntoOperations(rowTrades), [rowTrades])
  const accounts = useAccounts()

  const realWR = useMemo(() => {
    if (!trades.length) return 61
    return parseFloat((trades.filter(t => t.result === 'win').length / trades.length * 100).toFixed(1))
  }, [trades])

  const realRR = useMemo(() => {
    const wins = trades.filter(t => t.result === 'win')
    if (!wins.length) return 1.8
    return parseFloat((wins.reduce((s, t) => s + t.rrActual, 0) / wins.length).toFixed(2))
  }, [trades])

  const [tab, setTab] = useState('calculadora')

  return (
    <PremiumGate feature="kellySizing">
    <div className="page-inner">
      <PageHeader title="Kelly / Sizing" subtitle="Calculadora · Kelly · Monte Carlo · Sizing por cuenta" />

      <div className="tabs" style={{ marginBottom: 24 }}>
        {[
          { key: 'calculadora', icon: Calculator, label: 'Calculadora'   },
          { key: 'kelly',       icon: Ruler,       label: 'Kelly'          },
          { key: 'montecarlo',  icon: Dices,       label: 'Monte Carlo'    },
          { key: 'sizing',      icon: BarChart3,   label: 'Sizing cuentas' },
        ].map(({ key, icon: TabIcon, label }) => (
          <div key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TabIcon size={13} /> {label}
          </div>
        ))}
      </div>

      {tab === 'calculadora' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PositionCalculator accounts={accounts} />
          <Card title="Tabla rápida · Riesgo monetario">
            <table>
              <thead>
                <tr>
                  <th>Riesgo %</th>
                  {CAPITALS.map(c => <th key={c}>${(c/1000).toFixed(0)}K</th>)}
                </tr>
              </thead>
              <tbody>
                {RISK_LEVELS.map(r => (
                  <tr key={r}>
                    <td className="mono" style={{ color: 'var(--text2)' }}>{r}%</td>
                    {CAPITALS.map(c => (
                      <td key={c} className="mono" style={{ fontSize: 11 }}>${(c * r / 100).toLocaleString()}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Pip value por instrumento">
            <table>
              <thead>
                <tr><th>Símbolo</th><th>Descripción</th><th>$/pip · contrato</th><th>Tick size</th><th>Unidad</th></tr>
              </thead>
              <tbody>
                {INSTRUMENTS.filter(i => i.symbol !== 'CUSTOM').map(inst => (
                  <tr key={inst.symbol}>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--text)' }}>{inst.symbol}</td>
                    <td style={{ fontSize: 11, color: 'var(--text2)' }}>{inst.label.replace(inst.symbol, '').trim()}</td>
                    <td className="mono" style={{ color: 'var(--brand)' }}>${inst.pipValue}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{inst.tickSize}</td>
                    <td style={{ fontSize: 11, color: 'var(--text2)' }}>{inst.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'kelly' && <KellySection realWR={realWR} realRR={realRR} />}

      {tab === 'montecarlo' && <MonteCarloSection trades={trades} />}

      {tab === 'sizing' && <SizingByAccount accounts={accounts} trades={trades} realWR={realWR} realRR={realRR} />}
    </div>
    </PremiumGate>
  )
}
