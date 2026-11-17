// ─────────────────────────────────────────────
//  Operaciones completas a partir de los trades guardados
//
//  Un trade guardado no siempre es una operación entera: FTMO y
//  TradeLocker exportan cada cierre parcial como una fila, y en MT5
//  (cuentas hedging) cada vez que se suma a la posición se abre una
//  posición nueva con su propio número. Contar cada fila como una
//  operación infla el número de operaciones y llena de resultados
//  pequeños la distribución de R.
//
//  Regla (misma cuenta, mismo instrumento y misma dirección):
//    · mientras quede posición abierta, es la misma operación
//      (una fila que empieza antes de que cierre la anterior se une);
//    · una entrada que empieza justo cuando (o después de que) cerró
//      la anterior es una operación nueva;
//    · largos y cortos nunca se mezclan (giro o cobertura = otra
//      operación).
//  Solo se agrupan trades importados (con `source`); los cargados a
//  mano se quedan como están. Las métricas usan estas operaciones;
//  balance, PnL, Historial y Calendario siguen con cada fila.
//
//  Una operación agrupada lleva `legs` (ids de las filas) y
//  `estimated: true`: la agrupación se deduce de los horarios, no
//  viene en el archivo.
// ─────────────────────────────────────────────
import { tradeDollar } from './tradeDollar.js'

const round2 = (n) => Math.round(n * 100) / 100

function ms(dateTime) {
  const v = new Date(dateTime).getTime()
  return Number.isFinite(v) ? v : NaN
}

// Inicio de la fila: fecha y hora completas guardadas al importar o,
// en trades importados antes, fecha + HH:MM.
function startOf(t) {
  if (t.entryAt) return ms(t.entryAt)
  if (!t.date) return NaN
  return ms(`${t.date}T${t.time || '00:00'}`)
}

// Cierre de la fila. Sin exitAt (trades importados antes) solo se
// tiene HH:MM: si es anterior a la entrada se toma el día siguiente.
function endOf(t, start) {
  if (t.exitAt) return ms(t.exitAt)
  if (!t.date || !t.exitTime) return NaN
  let end = ms(`${t.date}T${t.exitTime}`)
  if (end < start) end += 24 * 60 * 60 * 1000
  return end
}

function mergeLegs(legs, riskPerTrade) {
  if (legs.length === 1) return legs[0]
  const sorted = [...legs].sort((a, b) => a._start - b._start)
  const first = sorted[0]
  const last = sorted.reduce((l, t) => (t._end > l._end ? t : l), sorted[0])
  const sum = (f) => sorted.reduce((s, t) => s + (Number(f(t)) || 0), 0)
  const dollarPnl = round2(sum(t => tradeDollar(t, riskPerTrade)))
  const rPnl = round2(sum(t => t.rPnl))
  const ref = dollarPnl !== 0 ? dollarPnl : rPnl
  const hasGross = sorted.some(t => t.grossPnl !== undefined)
  const op = {
    ...first,
    exitTime:  last.exitTime,
    exitAt:    last.exitAt,
    exitPrice: last.exitPrice,
    dollarPnl,
    rPnl,
    rrActual:  Math.abs(rPnl),
    result:    ref > 0 ? 'win' : ref < 0 ? 'loss' : 'breakeven',
    qty:       round2(sum(t => t.qty || 1)),
    fees:      sorted.some(t => t.fees != null) ? round2(sum(t => t.fees)) : undefined,
    fills:     sorted.reduce((s, t) => s + (t.fills || 1), 0),
    mfeR:      undefined,
    maeR:      undefined,
    legs:      sorted.map(t => t.id),
    estimated: true,
  }
  if (hasGross) op.grossPnl = round2(sum(t => t.grossPnl ?? t.dollarPnl))
  delete op._start
  delete op._end
  return op
}

/**
 * Agrupa los trades en operaciones completas (ver la regla arriba).
 * Devuelve un array nuevo; los trades que no se unen a nada se
 * devuelven tal cual (mismo objeto). Mantiene el orden original por
 * la primera fila de cada operación.
 */
export function groupIntoOperations(trades, riskPerTrade) {
  if (!trades?.length) return trades || []
  const groups = new Map()      // cuenta|par|dirección → filas con horario
  const out = []                // { order, op }
  trades.forEach((t, order) => {
    const start = startOf(t)
    const end = endOf(t, start)
    if (!t.source || !Number.isFinite(start) || !Number.isFinite(end)) { out.push({ order, op: t }); return }
    const key = `${t.accountId}|${t.pair}|${t.direction}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ ...t, _start: start, _end: end, _order: order })
  })

  for (const rows of groups.values()) {
    rows.sort((a, b) => a._start - b._start || a._order - b._order)
    let cur = null
    const flush = () => {
      if (!cur) return
      const op = mergeLegs(cur.legs, riskPerTrade)
      out.push({ order: cur.order, op: cur.legs.length === 1 ? trades[cur.order] : op })
    }
    for (const r of rows) {
      if (cur && r._start < cur.end) {
        cur.legs.push(r)
        cur.end = Math.max(cur.end, r._end)
        cur.order = Math.min(cur.order, r._order)
      } else {
        flush()
        cur = { legs: [r], end: r._end, order: r._order }
      }
    }
    flush()
  }

  return out.sort((a, b) => a.order - b.order).map(x => x.op)
}
