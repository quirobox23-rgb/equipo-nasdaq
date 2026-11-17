import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  X, Pencil, AlertTriangle, Check, ClipboardList, TrendingUp, Tag as TagIcon,
  Camera, CheckSquare, Save, FolderOpen, Image as ImageIcon, CheckCircle2, XCircle, Circle, Lock,
} from 'lucide-react'
import { Card, PageHeader, ResultBadge, DirectionBadge, RValue, Tag, Badge } from '@/components/ui'
import { useTrades, useStore, useTier, useCanAddTrade } from '@/store/useStore'
import { PAIRS } from '@/data/mockData'
import { normaliseSymbol, calcR, DEFAULT_RISK_CONSTANT } from '@/data/csvParser'
import { tradeLimitFor, canExportData, hasFeature } from '@/config/features'
import LightweightTradeChart from '@/components/charts/LightweightTradeChart'

const RESULTS  = ['all', 'win', 'loss', 'breakeven']
const SESSIONS = ['London', 'NY', 'Asian', 'London/NY Overlap']
const PER_PAGE = 25

const EMPTY_TRADE = {
  date: new Date().toISOString().split('T')[0],
  time: '09:00', pair: '', direction: 'Long',
  setup: '', session: 'London',
  entryPrice: '', stopLoss: '', takeProfit: '',
  rrObjective: '', rrActual: '', rPnl: '', dollarPnl: '',
  result: 'win', riskPercent: 1, accountId: '', notes: '', tradeRiskPct: '',
}

const EMPTY_EXIT = { price: '', qty: '', label: 'TP1' }
const EXIT_LABELS = ['TP1', 'TP2', 'TP3', 'Runner', 'SL Runner', 'BE Runner', 'Parcial']

// ── MultiExitForm — subcomponente formulario de exits ──
function MultiExitForm({ entryPrice, stopLoss, direction, exits, onChange }) {
  const addExit    = () => onChange([...exits, { ...EMPTY_EXIT }])
  const removeExit = (i) => onChange(exits.filter((_, idx) => idx !== i))
  const setExit    = (i, k, v) => onChange(exits.map((e, idx) => idx === i ? { ...e, [k]: v } : e))

  const entry   = parseFloat(entryPrice) || 0
  const sl      = parseFloat(stopLoss)   || 0
  const slDist  = sl > 0 ? Math.abs(entry - sl) : 0
  const isLong  = direction !== 'Short'
  const totalQty = exits.reduce((s, e) => s + (parseFloat(e.qty) || 0), 0)

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Salidas parciales</span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>· Total qty: <strong style={{ color: totalQty > 0 ? 'var(--brand)' : 'var(--text3)' }}>{totalQty || '—'}</strong></span>
        <button type="button" onClick={addExit} style={{
          marginLeft: 'auto', padding: '3px 10px', borderRadius: 6, fontSize: 12,
          background: 'var(--brand2)', border: '1px solid var(--brand)', color: 'var(--brand)',
          cursor: 'pointer', fontFamily: 'var(--font)',
        }}>+ Añadir salida</button>
      </div>

      {exits.length === 0 && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)',
          border: '1px dashed var(--border2)', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          Sin salidas parciales — usa el botón para añadir
        </div>
      )}

      {exits.map((ex, i) => {
        const exitPrice = parseFloat(ex.price) || 0
        const qty       = parseFloat(ex.qty)   || 0
        const priceDiff = isLong ? exitPrice - entry : entry - exitPrice
        const rEst      = slDist > 0 && totalQty > 0
          ? (priceDiff / slDist) * (qty / totalQty)
          : null
        const isWin = priceDiff > 0

        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '90px 80px 120px 1fr 28px',
            gap: 6, alignItems: 'center', marginBottom: 6,
            padding: '8px 10px', borderRadius: 8,
            background: 'var(--bg3)', border: '1px solid var(--border)',
          }}>
            {/* Label */}
            <select value={ex.label} onChange={e => setExit(i, 'label', e.target.value)}
              style={{ padding: '5px 6px', paddingRight: 28, fontSize: 12 }}>
              {EXIT_LABELS.map(l => <option key={l}>{l}</option>)}
            </select>

            {/* Qty */}
            <input type="number" min="0" step="1" placeholder="Qty"
              value={ex.qty} onChange={e => setExit(i, 'qty', e.target.value)}
              style={{ padding: '5px 8px', fontSize: 12 }} />

            {/* Price */}
            <input type="number" step="0.00001" placeholder="Precio salida"
              value={ex.price} onChange={e => setExit(i, 'price', e.target.value)}
              style={{ padding: '5px 8px', fontSize: 12 }} />

            {/* R estimada */}
            <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: rEst !== null ? (isWin ? 'var(--pos)' : 'var(--neg)') : 'var(--text3)' }}>
              {rEst !== null
                ? `${rEst >= 0 ? '+' : ''}${rEst.toFixed(2)}R · ${qty > 0 && totalQty > 0 ? Math.round(qty / totalQty * 100) : 0}% pos`
                : '— R'}
            </div>

            {/* Remove */}
            <button type="button" onClick={() => removeExit(i)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, padding: 2 }}><X size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}

// ── Backup JSON — exporta TODOS los trades con todos los campos ──
function exportJSON(trades) {
  const blob = new Blob([JSON.stringify(trades, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href  = url
  link.download = `agente_metricas_backup_${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function exportCSV(trades) {
  const headers = ['id','date','time','pair','direction','setup','session','entryPrice','exitPrice','stopLoss','takeProfit','rrObjective','rrActual','result','rPnl','dollarPnl','qty','riskPercent','rManual','accountId','notes']
  const rows = trades.map(t =>
    headers.map(h => {
      const v = t[h] ?? ''
      return String(v).includes(',') ? `"${v}"` : v
    }).join(',')
  )
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href  = url
  link.download = `edgelog_trades_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Inline R editor (clic rápido en celda) ────
function InlineREditor({ trade, onSave, disabled }) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState('')

  const startEdit = (e) => { e.stopPropagation(); if (disabled) return; setVal(String(trade.rPnl ?? '')); setEditing(true) }
  const commit = () => {
    const parsed = parseFloat(val)
    if (!isNaN(parsed)) onSave({ rPnl: parsed, rrActual: Math.abs(parsed), rManual: true })
    setEditing(false)
  }
  const handleKey = (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }

  if (editing) {
    return (
      <input autoFocus type="number" step="0.1" value={val}
        onChange={e => setVal(e.target.value)} onKeyDown={handleKey} onBlur={commit}
        style={{ width: 64, padding: '2px 6px', fontSize: 12, fontFamily: 'var(--mono)',
          background: 'var(--bg3)', border: '1px solid var(--amber)',
          borderRadius: 4, color: 'var(--text)', outline: 'none' }}
      />
    )
  }
  return (
    <span title={disabled ? 'Editar trades — disponible en plan Pro' : trade.rManual ? 'R editada — clic para cambiar' : 'Clic para editar R'}
      onClick={startEdit} style={{ cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, opacity: disabled ? 0.7 : 1 }}>
      <RValue value={trade.rPnl ?? 0} />
      {!disabled && <span style={{ fontSize: 12, color: trade.rManual ? 'var(--amber)' : 'var(--border2)' }}><Pencil size={13} /></span>}
    </span>
  )
}

// ── Edit Modal ────────────────────────────────
function EditModal({ trade, accounts, setups, riskConstant, onSave, onClose }) {
  const [form, setForm] = useState({
    pair:        trade.pair        ?? '',
    direction:   trade.direction   ?? 'Long',
    date:        trade.date        ?? '',
    time:        trade.time        ?? '09:00',
    session:     trade.session     ?? 'London',
    setup:       trade.setup       ?? '',
    entryPrice:  trade.entryPrice  ?? '',
    exitPrice:   trade.exitPrice   ?? '',
    stopLoss:    trade.stopLoss    ?? '',
    takeProfit:  trade.takeProfit  ?? '',
    rrObjective: trade.rrObjective ?? '',
    dollarPnl:   trade.dollarPnl   ?? '',
    rPnl:        trade.rPnl        ?? '',
    result:      trade.result      ?? 'win',
    accountId:   trade.accountId   ?? '',
    notes:       trade.notes       ?? '',
    mfeR:        trade.mfeR != null ? String(trade.mfeR) : '',
    maeR:        trade.maeR != null ? String(trade.maeR) : '',
    qty:         trade.qty  != null ? String(trade.qty)  : '',
  })
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const autoR = useMemo(() => {
    const pnl = parseFloat(form.dollarPnl)
    if (isNaN(pnl) || pnl === 0 || form.rPnl !== '') return null
    return calcR(pnl, { mode: 'simple', riskConstant: DEFAULT_RISK_CONSTANT })
  }, [form.dollarPnl, form.rPnl])

  const handleSave = () => {
    if (!form.pair.trim()) { setError('El par es obligatorio'); return }
    setError('')
    const dollarPnl  = parseFloat(form.dollarPnl) || 0
    const hasManualR = form.rPnl !== '' && form.rPnl !== null
    const rPnl = hasManualR
      ? parseFloat(form.rPnl)
      : calcR(dollarPnl, { mode: 'simple', riskConstant: DEFAULT_RISK_CONSTANT })
    onSave({
      pair:        normaliseSymbol(form.pair),
      direction:   form.direction,
      date:        form.date,
      time:        form.time,
      datetime:    `${form.date}T${form.time}`,
      session:     form.session,
      setup:       form.setup,
      entryPrice:  parseFloat(form.entryPrice)  || 0,
      exitPrice:   parseFloat(form.exitPrice)   || 0,
      stopLoss:    parseFloat(form.stopLoss)    || 0,
      takeProfit:  parseFloat(form.takeProfit)  || 0,
      rrObjective: parseFloat(form.rrObjective) || 1,
      rrActual:    Math.abs(rPnl),
      dollarPnl, rPnl,
      rManual:     hasManualR,
      result:      form.result,
      accountId:   form.accountId,
      notes:       form.notes,
      mfeR:        form.mfeR !== '' ? parseFloat(form.mfeR) : null,
      maeR:        form.maeR !== '' ? parseFloat(form.maeR) : null,
      qty:         form.qty  !== '' ? parseFloat(form.qty)  : null,
    })
  }

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  return (
    <div onClick={handleBackdrop} style={{
      position: 'fixed', whiteSpace: 'normal', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r)', padding: 24, width: '100%', maxWidth: 640,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>Editar trade</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{trade.id}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}><X size={14} /></button>
        </div>

        {/* Form */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Par / Instrumento *</label>
            <input type="text" placeholder="MNQ, NQ, EURUSD…" value={form.pair} onChange={e => set('pair', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <select value={form.direction} onChange={e => set('direction', e.target.value)}>
              <option>Long</option><option>Short</option>
            </select>
          </div>
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Hora</label>
            <input type="time" value={form.time} onChange={e => set('time', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Sesión</label>
            <select value={form.session} onChange={e => set('session', e.target.value)}>
              {SESSIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Precio entrada</label>
            <input type="number" step="0.00001" placeholder="0" value={form.entryPrice} onChange={e => set('entryPrice', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Precio salida</label>
            <input type="number" step="0.00001" placeholder="0" value={form.exitPrice} onChange={e => set('exitPrice', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Stop Loss</label>
            <input type="number" step="0.00001" placeholder="0" value={form.stopLoss} onChange={e => set('stopLoss', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Take Profit</label>
            <input type="number" step="0.00001" placeholder="0" value={form.takeProfit} onChange={e => set('takeProfit', e.target.value)} />
          </div>
          <div className="form-group">
            <label>PnL ($)</label>
            <input type="number" placeholder="1480 o -550" value={form.dollarPnl} onChange={e => set('dollarPnl', e.target.value)} />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              PnL (R)
              {autoR !== null && (
                <span style={{ color: 'var(--text3)', fontSize: 12, fontWeight: 400 }}>
                  → auto: {autoR >= 0 ? '+' : ''}{autoR}R
                </span>
              )}
              {form.rPnl !== '' && (
                <span style={{ color: 'var(--amber)', fontSize: 12 }}>· manual</span>
              )}
            </label>
            <input type="number" step="0.1"
              placeholder={`auto (PnL ÷ $${riskConstant})`}
              value={form.rPnl} onChange={e => set('rPnl', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Resultado</label>
            <select value={form.result} onChange={e => set('result', e.target.value)}>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="breakeven">Breakeven</option>
            </select>
          </div>
          <div className="form-group">
            <label>Cuenta</label>
            <select value={form.accountId} onChange={e => set('accountId', e.target.value)}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.firm} · {a.type} · ${Number(a.size).toLocaleString()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Qty — contratos / lotes */}
        <div className="form-group" style={{ gridColumn: 'span 1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Contratos / Lotes
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>lotaje</span>
          </label>
          <input
            type="number" step="1" min="0"
            placeholder="ej: 14"
            value={form.qty}
            onChange={e => set('qty', e.target.value)}
          />
        </div>

        {/* MFE / MAE — campos opcionales, no afectan R ni resultado */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              MFE (R)
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>opcional · máximo favorable</span>
            </label>
            <input
              type="number" step="0.1" min="0"
              placeholder="ej: 2.5 (hasta dónde llegó en tu favor)"
              value={form.mfeR}
              onChange={e => set('mfeR', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              MAE (R)
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>opcional · máximo adverso</span>
            </label>
            <input
              type="number" step="0.1" min="0"
              placeholder="ej: 0.6 (hasta dónde llegó en tu contra)"
              value={form.maeR}
              onChange={e => set('maeR', e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 14 }}>
            {form.mfeR && form.rPnl !== '' && parseFloat(form.mfeR) > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Eficiencia: <span style={{ fontFamily: 'var(--mono)', color: parseFloat(form.rPnl) / parseFloat(form.mfeR) >= 0.6 ? 'var(--pos)' : 'var(--amber)', fontWeight: 700 }}>
                  {(parseFloat(form.rPnl) / parseFloat(form.mfeR) * 100).toFixed(0)}%
                </span>
                <span style={{ color: 'var(--text3)', marginLeft: 4 }}>del movimiento</span>
              </div>
            )}
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 4 }}>
          <label>Notas</label>
          <textarea rows={2} placeholder="Contexto, errores, observaciones…"
            value={form.notes} onChange={e => set('notes', e.target.value)}
            style={{ resize: 'vertical' }} />
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)', fontSize: 12, padding: '8px 12px',
            background: 'var(--red2)', borderRadius: 'var(--r)', marginBottom: 12 }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Guardar cambios</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  TRADE CHART MODAL
// ─────────────────────────────────────────────

// Genera velas simuladas alrededor del precio de entrada
// Genera velas realistas coherentes con el resultado real del trade
// (no aleatorias puras): 3 fases (acercamiento 20% / desarrollo 50% /
// resolución 30%), en un WIN el precio avanza hacia el TP (tocando
// MFE si existe) sin romper el SL; en un LOSS avanza hacia el SL y
// lo rompe. Determinista por trade.id — mismo trade, mismo gráfico.
function generateRealisticCandles(trade, numCandles = 80) {
  const entry  = parseFloat(trade.entryPrice) || 1000
  const exit   = parseFloat(trade.exitPrice)  || entry
  const sl     = parseFloat(trade.stopLoss)   || 0
  const tp     = parseFloat(trade.takeProfit) || 0
  const mfeR   = trade.mfeR || 0
  const isLong = trade.direction !== 'Short'
  const result = trade.result // 'win' | 'loss' | 'breakeven'

  const slDist = sl > 0 ? Math.abs(entry - sl) : entry * 0.005
  const tpDist = tp > 0 ? Math.abs(tp - entry) : slDist * 2

  const mfePrice = mfeR > 0 && sl > 0
    ? (isLong ? entry + mfeR * slDist : entry - mfeR * slDist)
    : null

  // Semilla determinista por trade.id
  let seed = 0
  for (const c of String(trade.id || 'x')) seed = (seed * 31 + c.charCodeAt(0)) & 0xffffffff
  const rnd = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff }

  const candles = []
  let price = entry

  for (let i = 0; i < numCandles; i++) {
    const progress = i / numCandles
    let targetPrice, volatility

    if (progress < 0.2) {
      // Fase 1: acercamiento / indecisión cerca del entry
      targetPrice = entry + (rnd() - 0.5) * slDist * 0.3
      volatility = slDist * 0.15
    } else if (progress < 0.7) {
      // Fase 2: desarrollo hacia el resultado
      if (result === 'win') {
        const towardTP = isLong ? entry + tpDist * 0.8 : entry - tpDist * 0.8
        targetPrice = entry + (towardTP - entry) * ((progress - 0.2) / 0.5)
        if (mfePrice && progress > 0.4 && progress < 0.6) {
          targetPrice = mfePrice + (rnd() - 0.5) * slDist * 0.1
        }
        volatility = slDist * 0.2
      } else if (result === 'loss') {
        const towardSL = isLong ? entry - slDist * 1.1 : entry + slDist * 1.1
        targetPrice = entry + (towardSL - entry) * ((progress - 0.2) / 0.5)
        volatility = slDist * 0.25
      } else {
        targetPrice = entry + (rnd() - 0.5) * slDist * 0.2
        volatility = slDist * 0.1
      }
    } else {
      // Fase 3: resolución — converge al exitPrice real
      targetPrice = exit + (rnd() - 0.5) * slDist * 0.1
      volatility = slDist * 0.08
    }

    const drift = (targetPrice - price) * 0.3
    const noise = (rnd() - 0.5) * volatility
    const open  = price
    const close = price + drift + noise
    const wick  = volatility * (0.5 + rnd() * 0.5)
    const high  = Math.max(open, close) + wick
    const low   = Math.min(open, close) - wick

    candles.push({ i, open, high, low, close, progress })
    price = close
  }

  // La última vela cierra en el exitPrice real
  const last = candles[candles.length - 1]
  last.close = exit
  last.high  = Math.max(last.high, last.open, exit)
  last.low   = Math.min(last.low, last.open, exit)

  // Garantía: en un WIN, alguna vela toca/supera el TP
  if (result === 'win' && tp > 0) {
    const touched = candles.some(c => (isLong ? c.high >= tp : c.low <= tp))
    if (!touched) {
      const c = candles[Math.min(Math.round(numCandles * 0.65), numCandles - 1)]
      if (isLong) c.high = Math.max(c.high, tp + slDist * 0.03)
      else        c.low  = Math.min(c.low,  tp - slDist * 0.03)
    }
  }
  // Garantía: en un WIN, el SL nunca se rompe
  if (result === 'win' && sl > 0) {
    candles.forEach(c => {
      if (isLong) { if (c.low <= sl)  c.low  = sl + slDist * 0.02 }
      else        { if (c.high >= sl) c.high = sl - slDist * 0.02 }
    })
  }
  // Garantía: en un LOSS, alguna vela rompe el SL
  if (result === 'loss' && sl > 0) {
    const broken = candles.some(c => (isLong ? c.low <= sl : c.high >= sl))
    if (!broken) {
      const c = candles[Math.min(Math.round(numCandles * 0.65), numCandles - 1)]
      if (isLong) c.low  = Math.min(c.low,  sl - slDist * 0.03)
      else        c.high = Math.max(c.high, sl + slDist * 0.03)
    }
  }

  // La vela de entrada (~índice 10) contiene el precio de entrada
  const entryIdx = Math.min(10, numCandles - 1)
  const eC = candles[entryIdx]
  eC.high = Math.max(eC.high, entry)
  eC.low  = Math.min(eC.low, entry)

  // Saneo final — el cuerpo siempre dentro de la mecha
  candles.forEach(c => {
    c.high = Math.max(c.high, c.open, c.close)
    c.low  = Math.min(c.low, c.open, c.close)
  })

  return candles
}

// Mapea precio → coordenada Y en el canvas
function priceToY(price, minP, maxP, h, pad = 40) {
  return pad + (1 - (price - minP) / (maxP - minP)) * (h - pad * 2)
}

function TradeChart({ trade, width, height }) {
  const canvasRef = React.useRef(null)
  const isMobileChart = width < 480

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = width
    const H = isMobileChart ? 280 : height
    canvas.height = H
    const PAD_X = 8, PAD_Y = 44
    const LBL = isMobileChart ? 9 : 10

    const entry  = parseFloat(trade.entryPrice) || 1000
    const exit_p = parseFloat(trade.exitPrice)  || entry
    const sl     = parseFloat(trade.stopLoss)   || 0
    const tp     = parseFloat(trade.takeProfit) || 0
    const isLong = trade.direction !== 'Short'
    const isWin  = trade.result === 'win'

    const NUM_CANDLES = 80
    const candles = generateRealisticCandles(trade, NUM_CANDLES)
    const prices  = candles.flatMap(c => [c.high, c.low])
    if (sl > 0) prices.push(sl)
    if (tp > 0) prices.push(tp)
    prices.push(entry, exit_p)
    const minP = Math.min(...prices) * 0.9995
    const maxP = Math.max(...prices) * 1.0005
    const toY  = p => priceToY(p, minP, maxP, H, PAD_Y)
    const candleW = (W - PAD_X * 2) / candles.length

    const entryIdx = Math.min(10, candles.length - 1)
    const exitIdx  = Math.min(70, candles.length - 1)

    // Marcadores de salidas parciales (multi-exit) repartidos en el
    // último tramo del recorrido (última fase de resolución)
    const exitMarkers = trade.multiExit && trade.exits?.length > 0
      ? trade.exits.map((ex, i) => ({
          idx: Math.min(candles.length - 1, Math.round(candles.length * (0.72 + i * 0.06))),
          price: parseFloat(ex.price) || exit_p,
        }))
      : [{ idx: exitIdx, price: exit_p }]

    // ── Estado de interacción (cierre en cleanup) ──
    const state = { drawnCount: 0, hoverIdx: null, selectedIdx: null, levelsOpacity: 0 }
    let rafId = null

    const drawLevel = (price, label, color, dash, lw, opacity) => {
      if (!price || price <= 0 || opacity <= 0) return
      const y = toY(price)
      ctx.save()
      ctx.globalAlpha = opacity
      ctx.strokeStyle = color; ctx.lineWidth = lw
      ctx.setLineDash(dash)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      ctx.setLineDash([])

      ctx.font = `bold ${LBL}px monospace`
      ctx.textAlign = 'right'
      const txt = `${label}: ${price.toFixed(price > 100 ? 1 : 5)}`
      const tw = ctx.measureText(txt).width
      ctx.fillStyle = 'rgba(11,15,25,0.9)'
      ctx.fillRect(W - tw - 12, y - 8, tw + 8, 14)
      ctx.fillStyle = color
      ctx.fillText(txt, W - 4, y + 3)
      ctx.restore()
    }

    function draw() {
      ctx.clearRect(0, 0, W, H)

      // ── Fondo ──
      ctx.fillStyle = '#0B0F19'
      ctx.fillRect(0, 0, W, H)

      // ── Grid horizontal (cada 20% del rango) ──
      ctx.strokeStyle = 'rgba(255,255,255,0.025)'
      ctx.lineWidth = 1
      for (let r = 0; r <= 5; r++) {
        const y = PAD_Y + (r / 5) * (H - PAD_Y * 2)
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }
      // ── Grid vertical (cada 10 velas) ──
      ctx.strokeStyle = 'rgba(255,255,255,0.015)'
      for (let i = 0; i <= candles.length; i += 10) {
        const x = PAD_X + i * candleW
        ctx.beginPath(); ctx.moveTo(x, PAD_Y); ctx.lineTo(x, H); ctx.stroke()
      }

      // ── Zonas SL / TP ──
      if (sl > 0) {
        ctx.fillStyle = trade.result === 'loss' ? 'rgba(227,114,114,0.08)' : 'rgba(227,114,114,0.04)'
        const slY = toY(sl), entY = toY(entry)
        ctx.fillRect(0, Math.min(slY, entY), W, Math.abs(slY - entY))
      }
      if (tp > 0) {
        ctx.fillStyle = 'rgba(59,130,246,0.04)'
        const tpY = toY(tp), entY = toY(entry)
        ctx.fillRect(0, Math.min(tpY, entY), W, Math.abs(tpY - entY))
      }

      // ── Velas (solo hasta drawnCount → animación) ──
      const visibleCandles = candles.slice(0, state.drawnCount)
      visibleCandles.forEach((c, i) => {
        const x     = PAD_X + i * candleW
        const cW    = Math.max(candleW * 0.65, 1)
        const bull  = c.close >= c.open
        const col   = bull ? '#3B82F6' : '#E37272'
        const xMid  = x + candleW / 2
        const isSel = state.selectedIdx === i || state.hoverIdx === i

        ctx.strokeStyle = col
        ctx.globalAlpha = 0.6
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(xMid, toY(c.high)); ctx.lineTo(xMid, toY(c.low)); ctx.stroke()
        ctx.globalAlpha = 1

        ctx.fillStyle = bull ? `rgba(59,130,246,${isSel ? 1 : 0.9})` : `rgba(227,114,114,${isSel ? 1 : 0.9})`
        const bodyTop = Math.min(toY(c.open), toY(c.close))
        const bodyH   = Math.max(Math.abs(toY(c.open) - toY(c.close)), 1)
        ctx.fillRect(x + candleW * 0.175, bodyTop, cW, bodyH)

        if (isSel) {
          ctx.strokeStyle = '#E2E8F0'
          ctx.lineWidth = 1
          ctx.strokeRect(x + candleW * 0.175, bodyTop, cW, bodyH)
        }
      })

      // Solo se dibuja el resto (niveles/marcadores/panel) cuando la
      // animación de velas ha terminado, con fade-in propio.
      if (state.drawnCount >= candles.length) {
        drawLevel(sl,     'SL',    '#E37272', [6, 4], 1.5, state.levelsOpacity)
        drawLevel(tp,     'TP',    '#3B82F6', [6, 4], 1.5, state.levelsOpacity)
        if (trade.mfeR && trade.mfeR > 0 && sl > 0) {
          const slDist = Math.abs(entry - sl)
          const mfePrice = isLong ? entry + trade.mfeR * slDist : entry - trade.mfeR * slDist
          drawLevel(mfePrice, `MFE +${trade.mfeR}R`, '#F59E0B', [10, 4, 2, 4], 1.5, state.levelsOpacity)
        }
        drawLevel(entry,  'ENTRY', '#60A5FA', [], 2,   state.levelsOpacity)
        drawLevel(exit_p, 'EXIT',  '#E2E8F0', [], 1.5, state.levelsOpacity)

        ctx.save()
        ctx.globalAlpha = state.levelsOpacity

        // ── Marcador de entrada: triángulo direccional ──
        const entX = PAD_X + entryIdx * candleW + candleW / 2
        const entY = toY(entry)
        ctx.fillStyle = '#60A5FA'
        ctx.beginPath()
        if (isLong) {
          // ▲ apuntando arriba
          ctx.moveTo(entX, entY + 24); ctx.lineTo(entX - 7, entY + 36); ctx.lineTo(entX + 7, entY + 36)
        } else {
          // ▼ apuntando abajo
          ctx.moveTo(entX, entY - 24); ctx.lineTo(entX - 7, entY - 36); ctx.lineTo(entX + 7, entY - 36)
        }
        ctx.closePath(); ctx.fill()

        // ── Marcador(es) de salida ──
        exitMarkers.forEach((m, i) => {
          const exX = PAD_X + m.idx * candleW + candleW / 2
          const exY = toY(m.price)
          const r = i === exitMarkers.length - 1 ? 6 : 4
          ctx.fillStyle = '#0B0F19'
          ctx.strokeStyle = '#E2E8F0'
          ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.arc(exX, exY, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        })
        ctx.restore()

        // ── Panel de info (esquina superior izquierda) ──
        const rTxt = trade.rPnl != null ? `${trade.rPnl >= 0 ? '+' : ''}${trade.rPnl}R` : ''
        const infoTxt = `${trade.pair || ''} ${trade.direction || ''} | Entry ${entry.toFixed(entry > 100 ? 1 : 5)} | Exit ${exit_p.toFixed(exit_p > 100 ? 1 : 5)} | ${rTxt}`
        ctx.save()
        ctx.globalAlpha = state.levelsOpacity
        ctx.font = `${LBL + 1}px monospace`
        const infoW = Math.min(ctx.measureText(infoTxt).width + 24, W - 16)
        ctx.fillStyle = 'rgba(11,15,25,0.9)'
        ctx.fillRect(8, 8, infoW, 24)
        ctx.fillStyle = 'var(--text2)'.startsWith('var') ? '#94A3B8' : 'var(--text2)'
        ctx.fillText(infoTxt, 20, 24)
        ctx.restore()

        // ── Etiqueta inferior derecha ──
        ctx.save()
        ctx.globalAlpha = state.levelsOpacity * 0.8
        ctx.font = `${LBL}px monospace`
        ctx.textAlign = 'right'
        ctx.fillStyle = '#5A6478'
        ctx.fillText('Simulado · Review', W - 8, H - 8)
        ctx.restore()

        // ── Tooltip de hover (OHLC) ──
        if (state.hoverIdx != null && candles[state.hoverIdx]) {
          const c = candles[state.hoverIdx]
          const hx = PAD_X + state.hoverIdx * candleW + candleW / 2
          const lines = [
            `O ${c.open.toFixed(c.open > 100 ? 1 : 5)}`,
            `H ${c.high.toFixed(c.high > 100 ? 1 : 5)}`,
            `L ${c.low.toFixed(c.low > 100 ? 1 : 5)}`,
            `C ${c.close.toFixed(c.close > 100 ? 1 : 5)}`,
          ]
          ctx.save()
          ctx.font = `${LBL}px monospace`
          const boxW = 78, boxH = lines.length * 13 + 8
          let boxX = hx + 8
          if (boxX + boxW > W) boxX = hx - boxW - 8
          const boxY = 36
          ctx.fillStyle = 'rgba(11,15,25,0.95)'
          ctx.strokeStyle = 'rgba(255,255,255,0.1)'
          ctx.fillRect(boxX, boxY, boxW, boxH)
          ctx.strokeRect(boxX, boxY, boxW, boxH)
          ctx.fillStyle = '#E2E8F0'
          lines.forEach((l, i) => ctx.fillText(l, boxX + 8, boxY + 14 + i * 13))
          ctx.restore()
        }
      }
    }

    // ── Animación de dibujo progresivo ──
    const startTime = performance.now()
    const DRAW_DURATION = 650
    function animateDraw(now) {
      const elapsed = now - startTime
      const target = Math.min(candles.length, Math.floor((elapsed / DRAW_DURATION) * candles.length))
      if (target !== state.drawnCount) { state.drawnCount = target; draw() }
      if (state.drawnCount < candles.length) {
        rafId = requestAnimationFrame(animateDraw)
      } else {
        animateLevelsFadeIn()
      }
    }
    function animateLevelsFadeIn() {
      const fadeStart = performance.now()
      function step(now) {
        state.levelsOpacity = Math.min(1, (now - fadeStart) / 300)
        draw()
        if (state.levelsOpacity < 1) rafId = requestAnimationFrame(step)
      }
      rafId = requestAnimationFrame(step)
    }
    rafId = requestAnimationFrame(animateDraw)

    // ── Interacción: hover (tooltip) y click (resaltar vela) ──
    const idxFromEvent = (e) => {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) * (W / rect.width) - PAD_X
      const idx = Math.floor(x / candleW)
      return idx >= 0 && idx < candles.length ? idx : null
    }
    const handleMove = (e) => {
      const idx = idxFromEvent(e)
      if (idx !== state.hoverIdx) { state.hoverIdx = idx; if (state.drawnCount >= candles.length) draw() }
    }
    const handleLeave = () => { state.hoverIdx = null; if (state.drawnCount >= candles.length) draw() }
    const handleClick = (e) => {
      const idx = idxFromEvent(e)
      if (idx == null) return
      state.selectedIdx = state.selectedIdx === idx ? null : idx
      if (state.drawnCount >= candles.length) draw()
    }
    canvas.addEventListener('mousemove', handleMove)
    canvas.addEventListener('mouseleave', handleLeave)
    canvas.addEventListener('click', handleClick)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      canvas.removeEventListener('mousemove', handleMove)
      canvas.removeEventListener('mouseleave', handleLeave)
      canvas.removeEventListener('click', handleClick)
    }
  }, [trade, width, height, isMobileChart])

  return <canvas ref={canvasRef} width={width} height={isMobileChart ? 280 : height} style={{ display: 'block', borderRadius: 8, cursor: 'pointer' }} />
}

// Symbol normalisation for TradingView
function toTVSymbol(pair) {
  const map = {
    MNQ: 'CME_MINI:MNQ1!', NQ: 'CME_MINI:NQ1!',
    MES: 'CME_MINI:MES1!', ES: 'CME_MINI:ES1!',
    YM: 'CBOT_MINI:YM1!',  MYM: 'CBOT_MINI:MYM1!',
    RTY: 'CME_MINI:RTY1!', M2K: 'CME_MINI:M2K1!',
    GC: 'COMEX:GC1!', MGC: 'COMEX:MGC1!',
    CL: 'NYMEX:CL1!', MCL: 'NYMEX:MCL1!',
    EURUSD: 'FX:EURUSD', GBPUSD: 'FX:GBPUSD',
    USDJPY: 'FX:USDJPY', AUDUSD: 'FX:AUDUSD',
    XAUUSD: 'TVC:GOLD', BTC: 'BINANCE:BTCUSDT',
  }
  return map[pair?.toUpperCase()] ?? pair ?? 'CME_MINI:MNQ1!'
}

function buildTVUrl(trade, tf = '5') {
  const symbol = toTVSymbol(trade.pair)
  // TradingView chart URL con símbolo y timeframe
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}&interval=${tf}`
}

// ── Tags predefinidos ─────────────────────────
// Variant en vez de hex suelto — nunca --blue (no existe como token) ni
// --brand de marca para un dato evaluativo. "Contexto" usa "grey" para
// las 6: son descriptivas del mercado, no buenas ni malas, así no
// compiten visualmente con las tags de Errores/Ejecución que sí lo son.
const TAG_GROUPS = {
  'Errores': [
    { id: 'early-entry',    label: 'Early entry',      variant: 'neutral' },
    { id: 'late-entry',     label: 'Late entry',        variant: 'neutral' },
    { id: 'moved-sl',       label: 'Moví el SL',        variant: 'neg' },
    { id: 'oversize',       label: 'Oversize',          variant: 'neg' },
    { id: 'fomo',           label: 'FOMO',              variant: 'neg' },
    { id: 'revenge',        label: 'Revenge trade',     variant: 'neg' },
    { id: 'no-plan',        label: 'Sin plan',          variant: 'neg' },
    { id: 'news',           label: 'Operé en noticia',  variant: 'neutral' },
  ],
  'Ejecución': [
    { id: 'perfect',        label: 'Ejecución perfecta', variant: 'pos' },
    { id: 'good-entry',     label: 'Buena entrada',      variant: 'pos' },
    { id: 'early-exit',     label: 'Salida prematura',   variant: 'neutral' },
    { id: 'missed-tp',      label: 'TP no alcanzado',    variant: 'neutral' },
    { id: 'partial',        label: 'Salida parcial',     variant: 'grey' },
    { id: 'runner',         label: 'Runner dejado',      variant: 'grey' },
    { id: 'breakeven',      label: 'Llevado a BE',       variant: 'grey' },
  ],
  'Contexto': [
    { id: 'high-volume',    label: 'Alto volumen',       variant: 'grey' },
    { id: 'low-volume',     label: 'Bajo volumen',       variant: 'grey' },
    { id: 'trend',          label: 'Con tendencia',      variant: 'grey' },
    { id: 'counter-trend',  label: 'Contra tendencia',   variant: 'grey' },
    { id: 'news-zone',      label: 'Zona de noticias',   variant: 'grey' },
    { id: 'open',           label: 'Apertura',           variant: 'grey' },
  ],
}
const ALL_TAGS = Object.values(TAG_GROUPS).flat()

// Mismos pares bg/fg que .badge-pos/.badge-red/.badge-amber/.badge-grey
// en index.css — para que estas tags (que necesitan estado activo/
// hover interactivo, no solo un <Badge> estático) usen los mismos
// tokens en vez de reinventar un tinte a partir de un hex + alpha.
const TAG_VARIANTS = {
  pos:     { bg: 'var(--pos2)',    fg: 'var(--pos)' },
  neg:     { bg: 'var(--red2)',    fg: 'var(--red)' },
  neutral: { bg: 'var(--amber2)',  fg: 'var(--amber)' },
  grey:    { bg: 'var(--bg4)',     fg: 'var(--text3)' },
}

// badge-grey (var(--bg4)) no se distingue sobre fondos que ya son
// grises (el header del modal es var(--bg3), casi el mismo tono) — para
// esos casos el styleguide documenta el Tag variant="ghost" (fondo
// var(--bg), el más oscuro de la app, borde var(--text2)) como el
// tratamiento para "tags sobre fondos ya grises".
function TagPill({ variant, children }) {
  return variant === 'grey'
    ? <Tag variant="ghost">{children}</Tag>
    : <Badge variant={variant}>{children}</Badge>
}

// ── Fallback de seguridad ──────────────────────
// Si LightweightTradeChart falla por cualquier motivo en tiempo de
// ejecución, se recupera mostrando el canvas simulado de siempre
// (TradeChart/generateCandles, que NO se ha eliminado — sigue tal
// cual, sirve exactamente de red de seguridad).
class ChartErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err) { console.warn('[AgenteMetricas] LightweightTradeChart falló, usando el canvas de reserva:', err) }
  render() { return this.state.hasError ? this.props.fallback : this.props.children }
}

function TradeChartModal({ trade, onClose, onUpdate }) {
  const [tab,        setTab]        = React.useState('review')
  const [tf,         setTf]         = React.useState('5')
  const [screenshot, setScreenshot] = React.useState(trade.screenshot ?? null)
  const [viewMode,   setViewMode]   = React.useState('chart') // 'chart' | 'screenshot'
  const [tags,       setTags]       = React.useState(trade.tags ?? [])
  const [notes,      setNotes]      = React.useState(trade.notes ?? '')
  const [tagGroup,   setTagGroup]   = React.useState('Errores')
  const [saved,      setSaved]      = React.useState(false)
  const screenshotRef = React.useRef(null)

  const W = Math.min(window.innerWidth - 48, 1100)

  const entry  = parseFloat(trade.entryPrice) || 0
  const exitP  = parseFloat(trade.exitPrice)  || 0
  const rPnl   = trade.rPnl ?? 0
  const mfeR   = trade.mfeR
  const efficiency = mfeR && mfeR > 0 && rPnl > 0
    ? Math.min(rPnl / mfeR * 100, 100).toFixed(0) : null
  const slDist = entry && trade.stopLoss
    ? Math.abs(entry - parseFloat(trade.stopLoss)) : 0
  const tpDist = entry && trade.takeProfit
    ? Math.abs(entry - parseFloat(trade.takeProfit)) : 0
  const rrObj  = slDist > 0 && tpDist > 0 ? (tpDist / slDist).toFixed(2) : trade.rrObjective ?? '—'

  const TVS = { '1': '1m', '5': '5m', '15': '15m', '60': '1h' }

  const toggleTag = (id) =>
    setTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  const handleScreenshot = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setScreenshot(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    onUpdate(trade.id, { tags, notes, screenshot })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const backdrop = e => { if (e.target === e.currentTarget) onClose() }

  // Semáforo de resultado — nunca var(--brand) (marca): un WIN/LOSS es
  // un dato de resultado, no un CTA. Antes usaba hex sueltos (#3B82F6,
  // que además es el verde de MARCA, y #E37272, que no correspondía a
  // ningún token de la paleta).
  const resultColor = rPnl >= 0 ? 'var(--pos)' : 'var(--neg)'
  const bg = 'var(--bg2)'

  return (
    <div onClick={backdrop} style={{
      position: 'fixed', whiteSpace: 'normal', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: bg, border: '1px solid var(--border2)',
        borderRadius: 14, overflow: 'hidden',
        width: W, maxWidth: '100%', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg3)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Par + dirección */}
            <div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                {trade.pair}
              </span>
              <span style={{ marginLeft: 8 }}>
                <DirectionBadge direction={trade.direction} />
              </span>
            </div>

            {/* KPIs rápidos */}
            {[
              { l: 'R',          v: `${rPnl >= 0 ? '+' : ''}${rPnl}R`,   c: resultColor },
              { l: 'PnL',        v: trade.dollarPnl != null ? `${trade.dollarPnl >= 0 ? '+$' : '-$'}${Math.abs(trade.dollarPnl).toLocaleString()}` : '—', c: resultColor },
              { l: 'Entry',      v: entry  || '—',  c: 'var(--text)' },
              { l: 'Exit',       v: exitP  || '—',  c: 'var(--text)' },
              { l: 'RR obj',     v: `${rrObj}:1`,   c: 'var(--text2)' },
              ...(efficiency ? [{ l: 'Efficiency', v: `${efficiency}%`, c: 'var(--text2)' }] : []),
            ].map(({ l, v, c }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>{l}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}

            {/* Tags activos en header */}
            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {tags.slice(0, 3).map(id => {
                  const t = ALL_TAGS.find(t => t.id === id)
                  return t ? <TagPill key={id} variant={t.variant}>{t.label}</TagPill> : null
                })}
                {tags.length > 3 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>+{tags.length - 3}</span>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href={buildTVUrl(trade, tf)} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
              </svg>
              TradingView
            </a>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--text3)',
              cursor: 'pointer', fontSize: 20, padding: '2px 6px',
            }}><X size={14} /></button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
          background: 'var(--bg3)', flexShrink: 0,
        }}>
          {[
            { key: 'review',  icon: ClipboardList, label: 'Review'     },
            { key: 'chart',   icon: TrendingUp,     label: 'Gráfico'    },
            { key: 'tags',    icon: TagIcon,        label: `Tags ${tags.length > 0 ? `(${tags.length})` : ''}` },
          ].map(({ key, icon: TabIcon, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === key ? 'var(--brand)' : 'transparent'}`,
              color: tab === key ? 'var(--text)' : 'var(--text3)',
              fontSize: 12, fontWeight: tab === key ? 600 : 400,
              cursor: 'pointer', fontFamily: 'var(--font)',
              transition: 'all 0.15s',
            }}><TabIcon size={13} /> {label}</button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflow: 'auto' }}>

          {/* ── TAB: REVIEW ── */}
          {tab === 'review' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100%' }}>

              {/* Screenshot area */}
              <div style={{
                background: 'var(--bg)', borderRight: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', minHeight: 420,
              }}>
                {screenshot ? (
                  <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <img src={screenshot} alt="Trade screenshot"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    <button
                      onClick={() => setScreenshot(null)}
                      style={{
                        position: 'absolute', top: 10, right: 10,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff', borderRadius: 8, padding: '4px 10px',
                        fontSize: 12, cursor: 'pointer',
                      }}><X size={12} /> Quitar</button>
                  </div>
                ) : (
                  <div
                    onClick={() => screenshotRef.current?.click()}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 12,
                      cursor: 'pointer', border: '2px dashed var(--border2)',
                      margin: 24, borderRadius: 12,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                  >
                    <Camera size={36} style={{ opacity: 0.3, color: 'var(--text3)' }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
                      Subir screenshot del trade
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      PNG, JPG · haz clic o arrastra aquí
                    </div>
                    <div style={{
                      padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: 'var(--brand2)', border: '1px solid var(--brand)', color: 'var(--brand)',
                    }}>Seleccionar archivo</div>
                  </div>
                )}
                <input ref={screenshotRef} type="file" accept="image/*"
                  style={{ display: 'none' }} onChange={handleScreenshot} />
              </div>

              {/* Panel derecho: métricas + notas */}
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>

                {/* Métricas del trade */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                    Métricas
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { l: 'Resultado',   v: rPnl >= 0 ? 'WIN' : rPnl === 0 ? 'BE' : 'LOSS',
                        c: rPnl > 0 ? 'var(--pos)' : rPnl < 0 ? 'var(--neg)' : 'var(--text2)' },
                      { l: 'R obtenida',  v: `${rPnl >= 0 ? '+' : ''}${rPnl}R`, c: resultColor },
                      { l: 'RR objetivo', v: `${rrObj}:1`, c: 'var(--text2)' },
                      { l: 'Eficiencia',  v: efficiency ? `${efficiency}%` : '—',
                        c: efficiency >= 70 ? 'var(--pos)' : efficiency >= 40 ? 'var(--amber)' : 'var(--text2)' },
                      { l: 'Sesión',      v: trade.session || '—', c: 'var(--text)' },
                      { l: 'Fecha',       v: trade.date || '—',    c: 'var(--text2)' },
                      { l: 'Hora',        v: trade.time || '—',    c: 'var(--text2)' },
                    ].map(({ l, v, c }) => (
                      <div key={l} style={{
                        background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>{l}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Multi-exit breakdown */}
                {trade.multiExit && trade.exits?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                      Salidas parciales
                    </div>
                    {trade.exits.map((ex, i) => {
                      const ep = parseFloat(ex.price) || 0
                      const priceDiff = trade.direction !== 'Short' ? ep - entry : entry - ep
                      const isWin = priceDiff > 0
                      const totalQty = trade.exits.reduce((s, e) => s + (parseFloat(e.qty) || 0), 0)
                      const pct = totalQty > 0 ? Math.round((parseFloat(ex.qty) || 0) / totalQty * 100) : 0
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 10px', borderRadius: 8, marginBottom: 4,
                          background: isWin ? 'rgba(59,130,246,0.06)' : 'rgba(227,114,114,0.06)',
                          border: `1px solid ${isWin ? 'rgba(59,130,246,0.15)' : 'rgba(227,114,114,0.15)'}`,
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)',
                            background: 'var(--brand2)', padding: '1px 7px', borderRadius: 8 }}>
                            {ex.label}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                            {ex.qty} · @{ep}
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'var(--mono)',
                            fontWeight: 700, color: isWin ? 'var(--pos)' : 'var(--neg)' }}>
                            {pct}% pos
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Tags activos */}
                {tags.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                      Tags
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {tags.map(id => {
                        const t = ALL_TAGS.find(t => t.id === id)
                        return t ? <TagPill key={id} variant={t.variant}>{t.label}</TagPill> : null
                      })}
                    </div>
                  </div>
                )}

                {/* Notas */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                    Notas del trade
                  </div>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="¿Qué salió bien? ¿Qué mejorarías? ¿Seguiste el plan?..."
                    rows={5}
                    style={{ resize: 'vertical', fontSize: 12, lineHeight: 1.6 }}
                  />
                </div>

                {/* Guardar — .btn-primary estándar (gradiente de marca +
                    texto blanco: ver "Botones" en /styleguide). El estado
                    "Guardado" no inventa un color nuevo, solo cambia el
                    label/ícono sobre el mismo botón. */}
                <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%' }}>
                  {saved ? <><Check size={13} /> Guardado</> : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}

          {/* ── TAB: GRÁFICO ── */}
          {tab === 'chart' && (
            <div style={{ background: 'var(--bg)' }}>
              {/* Timeframe selector + toggle screenshot/chart */}
              <div style={{ display: 'flex', gap: 4, padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                {Object.entries(TVS).map(([v, l]) => (
                  <button key={v} onClick={() => setTf(v)} style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--mono)',
                    border: `1px solid ${tf === v ? 'var(--brand)' : 'var(--border2)'}`,
                    background: tf === v ? 'var(--brand2)' : 'transparent',
                    color: tf === v ? 'var(--brand)' : 'var(--text3)',
                  }}>{l}</button>
                ))}
                {screenshot && (
                  <button
                    onClick={() => setViewMode(m => m === 'chart' ? 'screenshot' : 'chart')}
                    style={{
                      marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)',
                    }}
                  >
                    {viewMode === 'chart' ? <ImageIcon size={13} /> : <TrendingUp size={13} />}
                    {viewMode === 'chart' ? 'Ver screenshot' : 'Ver chart'}
                  </button>
                )}
              </div>
              {viewMode === 'screenshot' && screenshot ? (
                <div style={{ background: '#0B0F19', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 440 }}>
                  <img src={screenshot} alt="Screenshot del trade" style={{ maxWidth: '100%', maxHeight: 440, display: 'block' }} />
                </div>
              ) : (
                <ChartErrorBoundary fallback={<TradeChart trade={trade} width={W} height={440} />}>
                  <LightweightTradeChart trade={trade} timeframe={tf} height={440} />
                </ChartErrorBoundary>
              )}
              {/* Levels legend */}
              <div style={{
                display: 'flex', gap: 20, padding: '10px 18px',
                borderTop: '1px solid var(--border)', flexWrap: 'wrap',
              }}>
                {[
                  { col: 'var(--text)', label: 'Entry', val: entry  },
                  { col: 'var(--text)', label: 'Exit', val: exitP  },
                  { col: '#E37272', label: 'SL', val: trade.stopLoss   },
                  { col: '#3B82F6', label: 'TP', val: trade.takeProfit },
                  ...(trade.mfeR > 0 ? [{ col: 'var(--text2)', label: `MFE +${trade.mfeR}R`, val: null }] : []),
                ].filter(x => x.val || x.val === 0 || x.label.startsWith('MFE')).map(({ col, label, val }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 18, height: 2, background: col, borderRadius: 1 }} />
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{label}</span>
                    {val != null && <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: col }}>{parseFloat(val).toFixed(val > 100 ? 1 : 5)}</span>}
                  </div>
                ))}
                <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>
                  Velas sintéticas (TradingView Lightweight Charts) · usa "Abrir en TradingView" para el gráfico real
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: TAGS ── */}
          {tab === 'tags' && (
            <div style={{ padding: 20 }}>
              {/* Selector grupo */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                {Object.keys(TAG_GROUPS).map(g => (
                  <button key={g} onClick={() => setTagGroup(g)} style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font)',
                    border: `1px solid ${tagGroup === g ? 'var(--brand)' : 'var(--border2)'}`,
                    background: tagGroup === g ? 'var(--brand2)' : 'transparent',
                    color: tagGroup === g ? 'var(--brand)' : 'var(--text2)',
                  }}>{g}</button>
                ))}
              </div>

              {/* Tags del grupo */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                {TAG_GROUPS[tagGroup].map(t => {
                  const active = tags.includes(t.id)
                  const v = TAG_VARIANTS[t.variant]
                  return (
                    <button key={t.id} onClick={() => toggleTag(t.id)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.15s',
                      background: active ? v.bg : 'var(--bg3)',
                      border: `1px solid ${active ? v.fg : 'var(--border2)'}`,
                      color: active ? v.fg : 'var(--text2)',
                      transform: active ? 'scale(1.02)' : 'scale(1)',
                    }}>{active && <Check size={12} />}{t.label}</button>
                  )
                })}
              </div>

              {/* Tags seleccionados */}
              {tags.length > 0 && (
                <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                    Tags seleccionados ({tags.length})
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {tags.map(id => {
                      const t = ALL_TAGS.find(t => t.id === id)
                      const v = t && TAG_VARIANTS[t.variant]
                      return t ? (
                        <span key={id} onClick={() => toggleTag(id)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 12,
                          background: v.bg, color: v.fg,
                          cursor: 'pointer',
                        }}>{t.label} <X size={11} /></span>
                      ) : null
                    })}
                  </div>
                </div>
              )}

              <button className="btn btn-primary" onClick={handleSave} style={{ marginTop: 20 }}>
                {saved ? <><Check size={13} /> Guardado</> : 'Guardar tags'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  HISTORIAL
// ─────────────────────────────────────────────
export default function Historial() {
  const location               = useLocation()
  const trades                = useTrades()
  const tier                  = useTier()
  const canEditDelete         = hasFeature(tier, 'editDeleteTrades') // Sprint "candado Pro": editar/borrar un trade ya guardado — mantiene el histórico intacto en planes inferiores
  const canAddTrade            = useCanAddTrade()
  const tradeLimit             = tradeLimitFor(tier)
  const addTrade              = useStore(s => s.addTrade)
  const addMultiExitTrade     = useStore(s => s.addMultiExitTrade)
  const updateTrade           = useStore(s => s.updateTrade)
  const deleteTrade           = useStore(s => s.deleteTrade)
  const deleteAllTrades       = useStore(s => s.deleteAllTrades)
  const accounts              = useStore(s => s.accounts)
  const setupNames            = useStore(s => s.getSetupNames())
  const addSetup              = useStore(s => s.addSetup)
  const [newSetupInput, setNewSetupInput] = React.useState('')

  const [filter,          setFilter]          = useState({ result: 'all', setup: 'all', pair: 'all', session: 'all', hour: 'all', accountId: 'all' })
  const [page,            setPage]            = useState(0)
  const [msg,             setMsg]             = useState(null)
  const [showForm,        setShowForm]        = useState(false)
  const [form,            setForm]            = useState({ ...EMPTY_TRADE, accountId: accounts[0]?.id || '' })
  const [formError,       setFormError]       = useState('')
  const [multiExitMode,   setMultiExitMode]   = useState(false)
  const [exits,           setExits]           = useState([{ ...EMPTY_EXIT }])

  // Abre el formulario manual existente cuando se llega desde el acceso
  // rápido "Nueva operación" del Dashboard (Sprint 8A). No crea ningún
  // formulario nuevo: solo activa el mismo estado que el botón "+ Trade manual".
  useEffect(() => {
    if (location.state?.openForm) {
      setShowForm(true)
    }
    // Drill-down desde MetrixBasic (setup/sesión/hora) — mismo estado
    // `filter` de siempre, solo con el valor ya preseleccionado.
    const { filterSetup, filterSession, filterHour, filterAccountId, openChartTradeId } = location.state || {}
    if (filterSetup || filterSession || filterHour != null || filterAccountId) {
      setFilter(f => ({
        ...f,
        setup:     filterSetup     ?? f.setup,
        session:   filterSession   ?? f.session,
        hour:      filterHour      ?? f.hour,
        accountId: filterAccountId ?? f.accountId,
      }))
    }
    // Abre directamente el gráfico de un trade (ej. "Mejor Trade" en MetrixBasic)
    if (openChartTradeId) {
      const t = trades.find(x => x.id === openChartTradeId)
      if (t) setChartTrade(t)
    }
  }, [location.state])

  const [selected,        setSelected]        = useState(new Set())
  const [selectMode,      setSelectMode]      = useState(false)
  const [editingTrade,    setEditingTrade]    = useState(null)
  const [chartTrade,      setChartTrade]      = useState(null)   // trade que se visualiza en gráfico

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const accountName = (id) => {
    const a = accounts.find(a => a.id === id)
    return a ? `${a.firm} (${a.type})` : '—'
  }
  const accountSize = (id) => {
    const a = accounts.find(a => a.id === id)
    return a?.size ?? 0
  }

  const filtered = useMemo(() =>
    trades.filter(t => {
      if (filter.result !== 'all' && t.result !== filter.result) return false
      if (filter.setup  !== 'all' && t.setup  !== filter.setup)  return false
      if (filter.pair   !== 'all' && t.pair   !== filter.pair)   return false
      if (filter.session !== 'all' && t.session !== filter.session) return false
      if (filter.hour   !== 'all' && parseInt((t.time || '0:0').split(':')[0], 10) !== Number(filter.hour)) return false
      if (filter.accountId !== 'all' && t.accountId !== filter.accountId) return false
      return true
    }), [filter, trades]
  )
  const paginated  = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  const handleDeleteOne = (id) => {
    deleteTrade(id)
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    setMsg({ type: 'success', text: 'Trade eliminado' })
  }
  const handleDeleteSelected = () => {
    if (!selected.size) return
    if (!window.confirm(`¿Eliminar ${selected.size} trade(s)?`)) return
    selected.forEach(id => deleteTrade(id))
    setMsg({ type: 'success', text: `${selected.size} trades eliminados` })
    setSelected(new Set()); setSelectMode(false); setPage(0)
  }
  // Borra solo lo que se ve con los filtros actuales (p.ej. una cuenta):
  // antes borraba los trades de TODAS las cuentas aunque hubiera una
  // cuenta filtrada.
  const isFiltered = filtered.length !== trades.length
  const handleDeleteAll = () => {
    if (!isFiltered) {
      if (!window.confirm(`¿Eliminar TODOS los ${trades.length} trades?`)) return
      deleteAllTrades()
      setMsg({ type: 'success', text: 'Todos los trades eliminados' })
    } else {
      const label = filter.accountId !== 'all' ? ` de ${accountName(filter.accountId)}` : ' filtrados'
      if (!window.confirm(`¿Eliminar los ${filtered.length} trades${label}? Los demás no se tocan.`)) return
      filtered.forEach(t => deleteTrade(t.id))
      setMsg({ type: 'success', text: `${filtered.length} trades eliminados` })
    }
    setSelected(new Set()); setSelectMode(false); setPage(0)
  }
  const toggleSelect    = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSelectAll = () => setSelected(selected.size === paginated.length ? new Set() : new Set(paginated.map(t => t.id)))

  // Edit handlers
  const handleEditOpen  = (trade) => { setEditingTrade(trade); setShowForm(false) }
  const handleEditClose = () => setEditingTrade(null)
  const handleEditSave  = (patch) => {
    updateTrade(editingTrade.id, patch)
    setEditingTrade(null)
    setMsg({ type: 'success', text: `Trade actualizado · ${patch.pair}` })
  }
  const handleREdit = (tradeId, patch) => updateTrade(tradeId, patch)

  const jsonInputRef = useRef(null)

  const handleJSONImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        if (!Array.isArray(parsed)) { setMsg({ type: 'error', text: 'JSON inválido — debe ser un array de trades' }); return }
        // Deduplicar contra trades ya existentes por ID
        const existingIds = new Set(trades.map(t => t.id))
        const newTrades   = parsed.filter(t => t.id && !existingIds.has(t.id))
        const dupes       = parsed.length - newTrades.length
        newTrades.forEach(t => addTrade(t))
        setMsg({ type: 'success', text: `${newTrades.length} trades restaurados${dupes > 0 ? ` · ${dupes} ya existían` : ''}` })
        setPage(0)
      } catch {
        setMsg({ type: 'error', text: 'Error al leer el JSON — ¿es un backup válido?' })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }
  // ── Riesgo dinámico según tamaño de cuenta ────
  // Prioridad: riskPerTrade en cuenta > tabla por tamaño > DEFAULT
  const DEFAULT_RISK_BY_SIZE = { 200000: 1100, 100000: 550, 50000: 300, 25000: 150 }
  const manualRiskConstant = useMemo(() => {
    const acc = accounts.find(a => a.id === form.accountId)
    // $ directo tiene prioridad máxima (el usuario escribe cuánto arriesga en $)
    const riskDollar = parseFloat(form.tradeRiskPct)
    if (!isNaN(riskDollar) && riskDollar > 0) return riskDollar
    if (!acc) return DEFAULT_RISK_CONSTANT
    if (acc.riskPerTrade) return acc.riskPerTrade
    const sizes = Object.keys(DEFAULT_RISK_BY_SIZE).map(Number).sort((a, b) => b - a)
    const match = sizes.find(s => acc.size >= s)
    return match ? DEFAULT_RISK_BY_SIZE[match] : DEFAULT_RISK_CONSTANT
  }, [form.accountId, form.tradeRiskPct, accounts])

  // Manual trade
  const manualRPreview = useMemo(() => {
    const pnl = parseFloat(form.dollarPnl)
    if (isNaN(pnl) || pnl === 0 || form.rPnl !== '') return ''
    const risk = typeof manualRiskConstant === 'number' ? manualRiskConstant : DEFAULT_RISK_CONSTANT
    const r = calcR(pnl, { mode: 'simple', riskConstant: risk })
    return `→ ${r >= 0 ? '+' : ''}${r}R (÷$${risk.toFixed(0)})`
  }, [form.dollarPnl, form.rPnl, manualRiskConstant])

  const handleSaveTrade = () => {
    if (!form.pair.trim()) { setFormError('El par es obligatorio'); return }
    if (!form.entryPrice)  { setFormError('La entrada es obligatoria'); return }
    if (!canAddTrade) {
      setFormError(`Has alcanzado el límite de ${tradeLimit} trades del plan Free. Actualiza a Basic para registrar trades sin límite.`)
      return
    }

    if (multiExitMode) {
      const validExits = exits.filter(e => e.price && e.qty)
      if (validExits.length === 0) { setFormError('Añade al menos una salida con precio y cantidad'); return }
      setFormError('')
      addMultiExitTrade({
        ...form,
        pair:        normaliseSymbol(form.pair),
        entryPrice:  parseFloat(form.entryPrice) || 0,
        stopLoss:    parseFloat(form.stopLoss)   || 0,
        takeProfit:  parseFloat(form.takeProfit) || 0,
        rrObjective: parseFloat(form.rrObjective) || 1,
        riskPercent: parseFloat(form.riskPercent) || 1,
        datetime:    `${form.date}T${form.time}`,
        emotions:    '',
      }, validExits.map(e => ({ ...e, price: parseFloat(e.price), qty: parseFloat(e.qty) })))
      setMsg({ type: 'success', text: `Trade multi-exit añadido · ${validExits.length} salidas` })
    } else {
      setFormError('')
      const dollarPnl  = parseFloat(form.dollarPnl) || 0
      const hasManualR = form.rPnl !== ''
      const rPnl = hasManualR
        ? parseFloat(form.rPnl)
        : calcR(dollarPnl, { mode: 'simple', riskConstant: manualRiskConstant })
      addTrade({
        ...form,
        pair:        normaliseSymbol(form.pair),
        entryPrice:  parseFloat(form.entryPrice)  || 0,
        stopLoss:    parseFloat(form.stopLoss)    || 0,
        takeProfit:  parseFloat(form.takeProfit)  || 0,
        rrObjective: parseFloat(form.rrObjective) || 1,
        rrActual:    parseFloat(form.rrActual)    || Math.abs(rPnl),
        rPnl, dollarPnl, rManual: hasManualR,
        riskPercent:  parseFloat(form.riskPercent) || 1,
        tradeRiskPct: form.tradeRiskPct !== '' ? parseFloat(form.tradeRiskPct) : null,
        datetime:    `${form.date}T${form.time}`,
        emotions:    '',
      })
      setMsg({ type: 'success', text: 'Trade añadido' })
    }

    setForm({ ...EMPTY_TRADE, accountId: accounts[0]?.id || '' })
    setExits([{ ...EMPTY_EXIT }])
    setMultiExitMode(false)
    setNewSetupInput('')
    setShowForm(false); setPage(0)
  }

  return (
    <div className="page-inner">

      {/* Chart Modal */}
      {chartTrade && (
        <TradeChartModal trade={chartTrade} onClose={() => setChartTrade(null)}
          onUpdate={(id, patch) => {
            if (!canEditDelete) return // candado Pro — el modal del gráfico también permite editar (arrastrar niveles), se bloquea aquí a nivel de datos
            updateTrade(id, patch)
            setChartTrade(t => ({ ...t, ...patch }))
          }}
        />
      )}

      {/* Edit Modal — renderizado sobre todo */}
      {editingTrade && (
        <EditModal
          trade={editingTrade}
          accounts={accounts}
          setups={setupNames}
          riskConstant={manualRiskConstant}
          onSave={handleEditSave}
          onClose={handleEditClose}
        />
      )}

      <PageHeader title="Historial de Trades" subtitle={`${filtered.length} registros`}>
        <input ref={jsonInputRef}  type="file" accept=".json" style={{ display: 'none' }} onChange={handleJSONImport} />
        <button className="btn btn-ghost btn-sm" onClick={() => { setSelectMode(s => !s); setSelected(new Set()); setShowForm(false) }}>
          {selectMode ? <><X size={13} /> Cancelar</> : <><CheckSquare size={13} /> Seleccionar</>}
        </button>
        <button className="btn btn-secondary btn-sm" disabled={!canExportData(tier)}
          title={!canExportData(tier) ? 'Exportar disponible desde el plan Basic' : undefined}
          style={!canExportData(tier) ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          onClick={() => canExportData(tier) && exportCSV(filtered)}>↓ Exportar CSV</button>
        <button className="btn btn-secondary btn-sm" disabled={!canExportData(tier)}
          title={!canExportData(tier) ? 'Backup disponible desde el plan Basic' : 'Exporta TODOS los trades con todos los campos'}
          style={!canExportData(tier) ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          onClick={() => canExportData(tier) && exportJSON(trades)}><Save size={13} /> Backup JSON</button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setMsg(null); jsonInputRef.current?.click() }} title="Restaura desde un backup JSON"><FolderOpen size={13} /> Restaurar JSON</button>
        <button className={`btn btn-sm ${showForm ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => { setShowForm(s => !s); setFormError('') }}>
          {showForm ? <><X size={13} /> Cancelar</> : '+ Trade manual'}
        </button>
      </PageHeader>

      {selectMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 16px', borderRadius: 'var(--r)', marginBottom: 16, background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          <button className="btn btn-sm" onClick={handleDeleteSelected} disabled={!selected.size || !canEditDelete}
            title={canEditDelete ? undefined : 'Eliminar trades — disponible en plan Pro'}
            style={{ background: 'var(--red2)', color: 'var(--red)', border: '1px solid rgba(227,114,114,0.2)', opacity: canEditDelete ? 1 : 0.5 }}>
            {canEditDelete ? <X size={13} /> : <Lock size={12} />} Eliminar seleccionados
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setSelectMode(false); setSelected(new Set()) }}>Cancelar</button>
            <button className="btn btn-sm" onClick={handleDeleteAll} disabled={!canEditDelete}
              title={canEditDelete ? undefined : 'Eliminar trades — disponible en plan Pro'}
              style={{ background: 'var(--red2)', color: 'var(--red)', border: '1px solid rgba(227,114,114,0.2)', fontSize: 12, opacity: canEditDelete ? 1 : 0.5 }}>
              {canEditDelete ? <AlertTriangle size={13} /> : <Lock size={12} />} Borrar todos ({filtered.length})</button>
          </div>
        </div>
      )}

      {/* Aviso con el Callout del StyleGuide (.callout-green / -red),
          versión compacta de una fila. Antes: texto azul (#60a5fa). */}
      {msg && (
        <div role={msg.type === 'success' ? 'status' : 'alert'}
          className={`callout ${msg.type === 'success' ? 'callout-green' : 'callout-red'}`}
          style={{ padding: '10px 14px', gap: 12, marginBottom: 16, flexWrap: 'nowrap' }}>
          <div className="icon-circle" style={{ width: 28, height: 28, background: 'var(--callout-bg1)', color: 'var(--callout-accent)' }}>
            {msg.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span className="callout-label" style={{ marginBottom: 0 }}>{msg.type === 'success' ? 'Listo' : 'Error'}</span>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} aria-label="Cerrar aviso"
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', lineHeight: 0, padding: 2 }}><X size={14} /></button>
        </div>
      )}

      {showForm && (
        <Card className="section-gap">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Nuevo trade manual</div>
            {/* Toggle single / multi-exit */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
              {[['single', '⬤ Single exit'], ['multi', '⬤⬤⬤ Multi-exit']].map(([m, l]) => (
                <button key={m} type="button" onClick={() => setMultiExitMode(m === 'multi')} style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font)', border: 'none', transition: 'all 0.15s',
                  background: (m === 'multi') === multiExitMode ? 'var(--brand)' : 'transparent',
                  color: (m === 'multi') === multiExitMode ? '#fff' : 'var(--text2)',
                }}>{l}</button>
              ))}
            </div>
          </div>

          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group"><label>Par *</label><input type="text" placeholder="MNQ, NQ, EURUSD…" value={form.pair} onChange={e => setF('pair', e.target.value)} /></div>
            <div className="form-group"><label>Dirección</label><select value={form.direction} onChange={e => setF('direction', e.target.value)}><option>Long</option><option>Short</option></select></div>
            <div className="form-group"><label>Fecha</label><input type="date" value={form.date} onChange={e => setF('date', e.target.value)} /></div>
            <div className="form-group"><label>Hora</label><input type="time" value={form.time} onChange={e => setF('time', e.target.value)} /></div>
            <div className="form-group"><label>Sesión</label><select value={form.session} onChange={e => setF('session', e.target.value)}>{SESSIONS.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="form-group"><label>Precio entrada *</label><input type="number" step="0.00001" placeholder="0" value={form.entryPrice} onChange={e => setF('entryPrice', e.target.value)} /></div>
            <div className="form-group"><label>Stop Loss</label><input type="number" step="0.00001" placeholder="0" value={form.stopLoss} onChange={e => setF('stopLoss', e.target.value)} /></div>
            <div className="form-group"><label>Take Profit</label><input type="number" step="0.00001" placeholder="0" value={form.takeProfit} onChange={e => setF('takeProfit', e.target.value)} /></div>
            <div className="form-group"><label>RR esperado</label><input type="number" step="0.1" placeholder="1.5" value={form.rrObjective} onChange={e => setF('rrObjective', e.target.value)} /></div>
            <div className="form-group"><label>Cuenta</label><select value={form.accountId} onChange={e => setF('accountId', e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.firm} · {a.type} · ${Number(a.size).toLocaleString()}</option>)}</select></div>

            {/* Campos solo para single exit */}
            {!multiExitMode && <>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Riesgo por trade ($)
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>vacío = automático (${manualRiskConstant.toFixed(0)})</span>
                </label>
                <input type="number" step="1" min="1"
                  placeholder={`${manualRiskConstant.toFixed(0)} (auto)`}
                  value={form.tradeRiskPct || ''} onChange={e => setF('tradeRiskPct', e.target.value)} />
                {form.tradeRiskPct && (() => {
                  const risk = parseFloat(form.tradeRiskPct)
                  const acc  = accounts.find(a => a.id === form.accountId)
                  const pct  = acc?.size > 0 && risk > 0 ? (risk / acc.size * 100).toFixed(2) : null
                  return !isNaN(risk) && risk > 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--brand)', marginTop: 3, display: 'block' }}>
                      R = PnL ÷ ${risk.toFixed(0)}{pct ? ` · ${pct}% del balance` : ''}
                    </span>
                  ) : null
                })()}
              </div>
              <div className="form-group">
                <label>PnL ($)</label>
                <input type="number" placeholder="1480 o -550" value={form.dollarPnl} onChange={e => setF('dollarPnl', e.target.value)} />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  PnL (R)
                  {manualRPreview && <span style={{ color: 'var(--text3)', fontSize: 12, fontWeight: 400 }}>{manualRPreview}</span>}
                  {form.rPnl !== '' && <span style={{ color: 'var(--amber)', fontSize: 12 }}>· manual</span>}
                </label>
                <input type="number" step="0.1" placeholder={`auto (PnL ÷ $${manualRiskConstant})`} value={form.rPnl} onChange={e => setF('rPnl', e.target.value)} />
              </div>
              <div className="form-group"><label>Resultado</label><select value={form.result} onChange={e => setF('result', e.target.value)}><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven</option></select></div>
            </>}
          </div>

          {/* Multi-exit form */}
          {multiExitMode && (
            <div style={{ marginTop: 4, padding: '12px 14px', borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
              <MultiExitForm
                entryPrice={form.entryPrice}
                stopLoss={form.stopLoss}
                direction={form.direction}
                exits={exits}
                onChange={setExits}
              />
              {/* R preview total */}
              {exits.some(e => e.price && e.qty) && (() => {
                const entry  = parseFloat(form.entryPrice) || 0
                const sl     = parseFloat(form.stopLoss)   || 0
                const slDist = Math.abs(entry - sl)
                const isLong = form.direction !== 'Short'
                const totalQty = exits.reduce((s, e) => s + (parseFloat(e.qty) || 0), 0)
                let totalR = 0
                exits.forEach(ex => {
                  const p = parseFloat(ex.price) || 0
                  const q = parseFloat(ex.qty)   || 0
                  if (slDist > 0 && totalQty > 0)
                    totalR += ((isLong ? p - entry : entry - p) / slDist) * (q / totalQty)
                })
                return (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8,
                    background: totalR >= 0 ? 'var(--brand2)' : 'var(--red2)',
                    border: `1px solid ${totalR >= 0 ? 'rgba(59,130,246,0.2)' : 'rgba(227,114,114,0.2)'}`,
                    display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>R total estimada:</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15,
                      color: totalR >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                      {totalR >= 0 ? '+' : ''}{totalR.toFixed(2)}R
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>
                      Resultado:
                      {totalR > 0 ? <CheckCircle2 size={13} style={{ color: 'var(--pos)' }} />
                        : totalR < 0 ? <XCircle size={13} style={{ color: 'var(--neg)' }} />
                        : <Circle size={13} style={{ color: 'var(--neutral)' }} />}
                      {totalR > 0 ? 'WIN' : totalR < 0 ? 'LOSS' : 'BE'}
                    </span>
                  </div>
                )
              })()}
            </div>
          )}

          <div className="form-group" style={{ marginTop: 12 }}><label>Notas</label><textarea rows={2} placeholder="Contexto, errores…" value={form.notes} onChange={e => setF('notes', e.target.value)} style={{ resize: 'vertical' }} /></div>
          {formError && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)', fontSize: 12, padding: '8px 12px', background: 'var(--red2)', borderRadius: 'var(--r)', marginBottom: 10 }}><AlertTriangle size={13} /> {formError}</div>}
          <button className="btn btn-primary" onClick={handleSaveTrade}>Guardar trade</button>
        </Card>
      )}

      {/* Filters */}
      <Card className="section-gap">
        <div className="flex-center" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="flex-center gap-2">
            <span style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Resultado</span>
            {RESULTS.map(r => (
              <button key={r} onClick={() => { setFilter(f => ({ ...f, result: r })); setPage(0) }}
                className={`btn btn-sm ${filter.result === r ? 'btn-primary' : 'btn-ghost'}`}>
                {r === 'all' ? 'Todos' : r.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="divider" style={{ width: 1, height: 20, margin: '0 4px' }} />
          <select value={filter.pair} onChange={e => { setFilter(f => ({ ...f, pair: e.target.value })); setPage(0) }} style={{ width: 'auto', padding: '6px 10px', paddingRight: 32, fontSize: 12 }}>
            <option value="all">Par: Todos</option>
            {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filter.accountId} onChange={e => { setFilter(f => ({ ...f, accountId: e.target.value })); setPage(0) }} style={{ width: 'auto', padding: '6px 10px', paddingRight: 32, fontSize: 12 }}>
            <option value="all">Cuenta: Todas</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{accountName(a.id)}</option>)}
          </select>
        </div>

        {(filter.session !== 'all' || filter.hour !== 'all' || filter.accountId !== 'all') && (
          <div className="flex-center" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Filtro rápido:</span>
            {filter.accountId !== 'all' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--brand)',
                background: 'var(--brand2)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 999, padding: '3px 10px',
              }}>
                Cuenta: {accountName(filter.accountId)}
                <button onClick={() => setFilter(f => ({ ...f, accountId: 'all' }))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 11 }}><X size={14} /></button>
              </span>
            )}
            {filter.session !== 'all' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--brand)',
                background: 'var(--brand2)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 999, padding: '3px 10px',
              }}>
                Sesión: {filter.session}
                <button onClick={() => setFilter(f => ({ ...f, session: 'all' }))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 11 }}><X size={14} /></button>
              </span>
            )}
            {filter.hour !== 'all' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--brand)',
                background: 'var(--brand2)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 999, padding: '3px 10px',
              }}>
                Hora: {filter.hour}:00
                <button onClick={() => setFilter(f => ({ ...f, hour: 'all' }))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 11 }}><X size={14} /></button>
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Table */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, fontSize: 12, color: 'var(--text3)' }}>
          <span><span style={{ color: 'var(--border2)' }}><Pencil size={13} /></span> Clic en R para editar rápido</span>
          <span><span style={{ color: 'var(--amber)' }}><Pencil size={13} /></span> R editada manualmente</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Botón <Pencil size={12} /> en cada fila para edición completa</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <table className="mobile-table-cards">
          <thead>
            <tr>
              {selectMode && <th style={{ width: 32 }}><input type="checkbox" onChange={toggleSelectAll} checked={selected.size === paginated.length && paginated.length > 0} style={{ cursor: 'pointer' }} /></th>}
              <th>#</th>
              <th>Fecha / Hora</th>
              <th>Par</th>
              <th>Dir.</th>
              <th>Sesión</th>
              <th>Qty</th>
              <th>R</th>
              <th>PnL</th>
              <th>Estado</th>
              <th>Salidas</th>
              <th>Cuenta</th>
              <th style={{ width: 72, textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((t, idx) => (
              <tr key={t.id ?? `row-${idx}`} style={selected.has(t.id) ? { background: 'var(--red2)' } : {}}>
                {selectMode && (
                  <td data-label="Seleccionar"><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} style={{ cursor: 'pointer' }} /></td>
                )}
                <td className="mono" data-label="#" style={{ color: 'var(--text3)', fontSize: 12 }}>{page * PER_PAGE + idx + 1}</td>
                <td data-label="Fecha" style={{ fontSize: 12, color: 'var(--text2)' }}>{t.date} {t.time}</td>
                <td className="mono" data-label="Par">{t.pair}</td>
                <td data-label="Dirección"><DirectionBadge direction={t.direction} /></td>
                <td data-label="Sesión" style={{ fontSize: 12, color: 'var(--text2)' }}>{t.session}</td>
                <td data-label="Qty" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
                  {t.qty ?? '—'}
                </td>
                <td data-label="R">
                  <InlineREditor trade={t} onSave={(patch) => handleREdit(t.id, patch)} disabled={!canEditDelete} />
                </td>
                <td data-label="PnL">
                  {(() => {
                    const pnl  = t.dollarPnl || 0
                    const size = accountSize(t.accountId)
                    const pct  = size > 0 ? (pnl / size * 100) : null
                    const col  = pnl >= 0 ? 'var(--pos)' : 'var(--neg)'
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span className="mono" style={{ fontSize: 12, color: col }}>
                          {pnl >= 0 ? '+' : ''}${Number(pnl).toFixed(0)}
                        </span>
                        {pct !== null && (
                          <span className="mono" style={{ fontSize: 12, color: col, opacity: 0.75 }}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </td>
                <td data-label="Estado"><ResultBadge result={t.result} /></td>
                {/* Multi-exit indicator */}
                <td data-label="Salidas" style={{ fontSize: 12 }}>
                  {t.multiExit && t.exits?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)',
                        background: 'var(--brand2)', padding: '1px 6px', borderRadius: 10,
                        border: '1px solid rgba(59,130,246,0.2)', width: 'fit-content' }}>
                        SCALE OUT
                      </span>
                      {t.exits.map((ex, i) => (
                        <span key={i} style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                          {ex.label}: {ex.qty} @ {parseFloat(ex.price).toFixed(ex.price > 100 ? 1 : 5)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Single</span>
                  )}
                </td>
                <td data-label="Cuenta" style={{ fontSize: 12, color: 'var(--text3)' }}>{accountName(t.accountId)}</td>
                <td data-label="Acciones">
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    {/* ── BOTÓN GRÁFICO ── */}
                    <button
                      onClick={() => setChartTrade(t)}
                      title="Ver gráfico del trade"
                      style={{
                        background: 'none',
                        border: '1px solid var(--border2)',
                        color: 'var(--text2)',
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '2px 7px',
                        borderRadius: 4,
                        lineHeight: 1.6,
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--border3)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--border2)' }}
                    ><TrendingUp size={14} /></button>
                  {/* ── BOTÓN EDITAR — bloqueado fuera de Pro (Sprint "candado
                      Pro"): mantiene el histórico intacto para el análisis
                      en planes inferiores. Mismo criterio de gating que el
                      resto de la app (FEATURE_TIERS + hasFeature). ── */}
                    <button
                      onClick={() => canEditDelete && handleEditOpen(t)}
                      disabled={!canEditDelete}
                      title={canEditDelete ? 'Editar trade completo' : 'Editar trades — disponible en plan Pro'}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border2)',
                        color: canEditDelete ? 'var(--text2)' : 'var(--text3)',
                        cursor: canEditDelete ? 'pointer' : 'not-allowed',
                        opacity: canEditDelete ? 1 : 0.5,
                        fontSize: 12,
                        padding: '2px 7px',
                        borderRadius: 4,
                        lineHeight: 1.6,
                        transition: 'border-color 0.1s, color 0.1s',
                      }}
                      onMouseEnter={e => { if (canEditDelete) { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)' } }}
                      onMouseLeave={e => { if (canEditDelete) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' } }}
                    >
                      {canEditDelete ? <Pencil size={13} /> : <Lock size={12} />}
                    </button>
                    {/* Eliminar — mismo candado */}
                    <button
                      onClick={() => canEditDelete && handleDeleteOne(t.id)}
                      disabled={!canEditDelete}
                      title={canEditDelete ? 'Eliminar' : 'Eliminar trades — disponible en plan Pro'}
                      style={{
                        background: 'none', border: 'none', color: 'var(--text3)',
                        cursor: canEditDelete ? 'pointer' : 'not-allowed',
                        opacity: canEditDelete ? 1 : 0.5,
                        fontSize: 13, padding: '2px 6px', borderRadius: 4,
                      }}
                    >{canEditDelete ? <X size={14} /> : <Lock size={12} />}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {paginated.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 12 }}>
            No hay trades con los filtros actuales
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex-center" style={{ marginTop: 16, justifyContent: 'center', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</button>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Página {page + 1} de {totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}>→</button>
          </div>
        )}
      </Card>
    </div>
  )
}