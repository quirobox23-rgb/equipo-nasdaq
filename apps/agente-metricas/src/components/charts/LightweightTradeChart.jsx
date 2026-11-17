import { useEffect, useRef } from 'react'
import {
  createChart, CandlestickSeries, LineStyle, createSeriesMarkers,
} from 'lightweight-charts'

// ─────────────────────────────────────────────
//  LIGHTWEIGHT TRADE CHART — TradingView Lightweight Charts
//
//  Reemplaza el canvas simulado de Historial.jsx por la librería
//  oficial (gratuita) de TradingView. Sigue sin haber datos de
//  mercado reales (eso es fase 2) — lo que cambia es el MOTOR de
//  renderizado: velas reales de la librería, ejes, crosshair,
//  zoom/pan nativos, en vez de dibujar a mano en un <canvas> 2D.
//
//  Nota técnica importante: lightweight-charts pinta sobre un
//  <canvas>, que NO puede resolver `var(--tal)` — el motor de canvas
//  solo entiende colores ya resueltos (hex/rgb). Por eso aquí los
//  colores están como hex literal, tomados directamente de los
//  valores actuales de esas mismas variables en index.css (no son
//  colores inventados, son el mismo tema oscuro de siempre).
//
//  API usada: lightweight-charts v5 (chart.addSeries(CandlestickSeries,
//  opts) + createSeriesMarkers) — la librería cambió su API respecto
//  a v3/v4 (addCandlestickSeries()/series.setMarkers() ya no existen).
// ─────────────────────────────────────────────

const THEME = {
  bg:      '#16181C', // var(--bg)
  bg2:     '#10141E', // var(--bg2)
  grid:    'rgba(255,255,255,0.04)',
  border:  'rgba(255,255,255,0.08)',
  text3:   '#5A6478', // var(--text3)
  entry:   '#60a5fa',
  exit:    '#f8fafc',
  sl:      '#FF5A6A',
  tp:      '#00D084',
  mfe:     '#f59e0b',
}

const TF_SECONDS = { '1': 60, '5': 300, '15': 900, '60': 3600 }

/**
 * Genera velas OHLC sintéticas realistas (no aleatorias puras):
 *   · parten del precio de ENTRY y se mueven gradualmente hacia EXIT
 *   · volatilidad calibrada por la distancia al SL
 *   · si el trade es ganador, alguna vela toca/supera el TP y
 *     ninguna rompe el SL
 *   · si el trade es perdedor, alguna vela rompe el SL
 *   · determinista por trade.id (mismo trade → mismo gráfico siempre)
 */
export function generateRealisticCandles(trade, numCandles = 60, timeframeSeconds = 300) {
  const entry  = parseFloat(trade.entryPrice) || 1000
  const exit   = parseFloat(trade.exitPrice)  || entry
  const sl     = parseFloat(trade.stopLoss)   || 0
  const tp     = parseFloat(trade.takeProfit) || 0
  const isLong = trade.direction !== 'Short'
  const isWin  = (trade.rPnl ?? (isLong ? exit - entry : entry - exit)) >= 0

  const slDist = sl > 0 ? Math.abs(entry - sl) : (Math.abs(exit - entry) || entry * 0.001)
  const tickSz = slDist / 10

  // Semilla determinista por trade.id — mismo trade, mismo gráfico siempre.
  let seed = 0
  for (const c of String(trade.id || 'x')) seed = (seed * 31 + c.charCodeAt(0)) & 0xffffffff
  const rnd = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff }

  const entryIdx = Math.max(2, Math.round(numCandles * 0.15))
  const exitIdx  = Math.min(numCandles - 3, Math.round(numCandles * 0.8))

  // Ancla temporal: la fecha/hora real del trade cae en la vela de entrada.
  let anchorMs = Date.parse(`${trade.date || ''}T${(trade.time || '09:30')}:00`)
  if (Number.isNaN(anchorMs)) anchorMs = Date.now()
  const startTime = Math.floor(anchorMs / 1000) - entryIdx * timeframeSeconds

  const candles = []
  // Extrapola hacia atrás para que la vela `entryIdx` empiece ya cerca de `entry`.
  let price = entry - ((exit - entry) / Math.max(1, exitIdx - entryIdx)) * entryIdx

  for (let i = 0; i < numCandles; i++) {
    const time = startTime + i * timeframeSeconds
    let drift, noise
    if (i < exitIdx) {
      const remaining = Math.max(1, exitIdx - i)
      drift = ((exit - price) / remaining) * (0.35 + rnd() * 0.3)
      noise = (rnd() - 0.5) * tickSz * 3
    } else {
      // Después de la salida: contexto visual, deriva plana con ruido suave.
      drift = (rnd() - 0.5) * tickSz * 0.6
      noise = (rnd() - 0.5) * tickSz * 2
    }
    const open  = price
    const close = price + drift + noise
    const high  = Math.max(open, close) + Math.abs(rnd() * tickSz * 2.2)
    const low   = Math.min(open, close) - Math.abs(rnd() * tickSz * 2.2)

    candles.push({ time, open, high, low, close })
    price = close
  }

  // La vela de entrada contiene el precio de entrada.
  const eC = candles[entryIdx]
  eC.open = entry
  eC.high = Math.max(eC.high, entry)
  eC.low  = Math.min(eC.low, entry)

  // La vela de salida contiene el precio de salida.
  const xC = candles[exitIdx]
  xC.close = exit
  xC.high  = Math.max(xC.high, exit)
  xC.low   = Math.min(xC.low, exit)

  // Garantía: en un win, alguna vela toca/supera el TP.
  if (isWin && tp > 0) {
    const touched = candles.some(c => (isLong ? c.high >= tp : c.low <= tp))
    if (!touched) {
      const c = candles[Math.max(entryIdx + 1, exitIdx - 1)]
      if (isLong) c.high = Math.max(c.high, tp + tickSz * 0.3)
      else        c.low  = Math.min(c.low,  tp - tickSz * 0.3)
    }
  }

  // Garantía: el SL nunca se rompe en un win / SÍ se rompe en un loss.
  if (sl > 0) {
    if (isWin) {
      candles.forEach(c => {
        if (isLong) { if (c.low <= sl)  c.low  = sl + tickSz * 0.5 }
        else        { if (c.high >= sl) c.high = sl - tickSz * 0.5 }
      })
    } else {
      const broken = candles.some(c => (isLong ? c.low <= sl : c.high >= sl))
      if (!broken) {
        const c = candles[exitIdx]
        if (isLong) c.low  = Math.min(c.low,  sl - tickSz * 0.3)
        else        c.high = Math.max(c.high, sl + tickSz * 0.3)
      }
    }
  }

  // Saneo final — el cuerpo siempre dentro de la mecha.
  candles.forEach(c => {
    c.high = Math.max(c.high, c.open, c.close)
    c.low  = Math.min(c.low, c.open, c.close)
  })

  return { candles, entryIdx, exitIdx }
}

export default function LightweightTradeChart({ trade, timeframe = '5', height = 440 }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const tfSeconds = TF_SECONDS[timeframe] || 300
    const { candles, entryIdx, exitIdx } = generateRealisticCandles(trade, 60, tfSeconds)

    const entry  = parseFloat(trade.entryPrice) || 0
    const exitP  = parseFloat(trade.exitPrice)  || 0
    const sl     = parseFloat(trade.stopLoss)   || 0
    const tp     = parseFloat(trade.takeProfit) || 0
    const isLong = trade.direction !== 'Short'

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: { background: { color: THEME.bg }, textColor: THEME.text3, fontFamily: 'var(--mono)', fontSize: 10 },
      grid: { vertLines: { color: THEME.grid }, horzLines: { color: THEME.grid } },
      timeScale: { borderColor: THEME.border, timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: THEME.border },
      crosshair: { mode: 0 },
      handleScroll: true,
      handleScale: true,
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: THEME.tp, downColor: THEME.sl,
      borderUpColor: THEME.tp, borderDownColor: THEME.sl,
      wickUpColor: THEME.tp, wickDownColor: THEME.sl,
    })
    candleSeries.setData(candles)

    // ── Niveles horizontales ──
    if (entry) candleSeries.createPriceLine({ price: entry, color: THEME.entry, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: 'ENTRY' })
    if (exitP) candleSeries.createPriceLine({ price: exitP, color: THEME.exit, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: 'EXIT' })
    if (sl > 0) candleSeries.createPriceLine({ price: sl, color: THEME.sl, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SL' })
    if (tp > 0) candleSeries.createPriceLine({ price: tp, color: THEME.tp, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'TP' })
    if (trade.mfeR && trade.mfeR > 0 && sl > 0) {
      const slDist = Math.abs(entry - sl)
      const mfePrice = isLong ? entry + trade.mfeR * slDist : entry - trade.mfeR * slDist
      candleSeries.createPriceLine({ price: mfePrice, color: THEME.mfe, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `MFE +${trade.mfeR}R` })
    }

    // ── Markers de entrada/salida ──
    createSeriesMarkers(candleSeries, [
      {
        time: candles[entryIdx].time,
        position: isLong ? 'belowBar' : 'aboveBar',
        color: THEME.entry,
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: 'Entry',
      },
      {
        time: candles[exitIdx].time,
        position: 'inBar',
        color: THEME.exit,
        shape: 'circle',
        text: 'Exit',
      },
    ])

    chart.timeScale().fitContent()

    const handleResize = () => chart.applyOptions({ width: container.clientWidth })
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [trade, timeframe, height])

  return <div ref={containerRef} style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden' }} />
}
