// Pruebas de groupIntoOperations (src/lib/operations.js): casos del
// pedido "Corrección de la distribución de resultados en R". Correr con:
//
//     npm run test:operations
import { groupIntoOperations } from '../src/lib/operations.js'

// Fila importada mínima. at/to: "HH:MM:SS" del mismo día (o fecha completa)
let n = 0
function row({ pair = 'NQ', dir = 'Long', at, to, pnl, acc = 'acc-1', qty = 1, risk = 500, source = 'csv', legacy = false }) {
  const full = (v) => (v.includes('T') ? v : `2026-10-05T${v}`)
  const t = {
    id: `t${++n}`, source, accountId: acc, pair, direction: dir,
    date: full(at).slice(0, 10), time: full(at).slice(11, 16), exitTime: full(to).slice(11, 16),
    dollarPnl: pnl, rPnl: Math.round(pnl / risk * 100) / 100, qty,
    result: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
  }
  if (!legacy) { t.entryAt = full(at); t.exitAt = full(to) }
  return t
}

const cases = [
  {
    name: 'Una operación de un contrato',
    trades: [row({ at: '10:00:00', to: '10:05:00', pnl: 100 })],
    ops: 1,
  },
  {
    name: 'Una operación con varios contratos en una fila',
    trades: [row({ at: '10:00:00', to: '10:05:00', pnl: 300, qty: 3 })],
    ops: 1,
  },
  {
    name: 'Cierres parciales: +100, +80, +70 = +250 (+0,50R con 1R = $500)',
    trades: [
      row({ at: '10:00:00', to: '10:05:00', pnl: 100 }),
      row({ at: '10:00:00', to: '10:10:00', pnl: 80 }),
      row({ at: '10:00:00', to: '10:20:00', pnl: 70 }),
    ],
    ops: 1, pnl: [250], r: [0.5], results: ['win'],
  },
  {
    name: 'Dos operaciones independientes separadas por un segundo',
    trades: [
      row({ at: '10:00:00', to: '10:00:30', pnl: 50 }),
      row({ at: '10:00:31', to: '10:01:00', pnl: -40 }),
    ],
    ops: 2,
  },
  {
    name: 'Reentrada justo en el segundo en que cerró la anterior = operación nueva',
    trades: [
      row({ at: '10:00:00', to: '10:05:00', pnl: 50 }),
      row({ at: '10:05:00', to: '10:09:00', pnl: 20 }),
    ],
    ops: 2,
  },
  {
    name: 'Posición que aumenta (MT5 hedging: cada aumento es otra posición)',
    trades: [
      row({ at: '10:00:00', to: '10:30:00', pnl: -120 }),
      row({ at: '10:10:00', to: '10:30:00', pnl: 60 }),
    ],
    ops: 1, pnl: [-60], results: ['loss'], qty: [2],
  },
  {
    name: 'Posición que se revierte (largo y luego corto)',
    trades: [
      row({ at: '10:00:00', to: '10:05:00', pnl: 50 }),
      row({ dir: 'Short', at: '10:05:00', to: '10:10:00', pnl: 30 }),
    ],
    ops: 2,
  },
  {
    name: 'Cobertura: largo y corto abiertos a la vez no se mezclan',
    trades: [
      row({ at: '10:00:00', to: '10:30:00', pnl: 50 }),
      row({ dir: 'Short', at: '10:10:00', to: '10:20:00', pnl: -30 }),
    ],
    ops: 2,
  },
  {
    name: 'Operaciones simultáneas de diferentes instrumentos',
    trades: [
      row({ pair: 'NQ', at: '10:00:00', to: '10:30:00', pnl: 50 }),
      row({ pair: 'ES', at: '10:10:00', to: '10:20:00', pnl: -30 }),
    ],
    ops: 2,
  },
  {
    name: 'Misma hora en dos cuentas distintas',
    trades: [
      row({ acc: 'acc-1', at: '10:00:00', to: '10:30:00', pnl: 50 }),
      row({ acc: 'acc-2', at: '10:10:00', to: '10:20:00', pnl: 50 }),
    ],
    ops: 2,
  },
  {
    name: 'Resultado neto: un parcial en verde y el cierre en rojo = una perdedora',
    trades: [
      row({ at: '10:00:00', to: '10:02:00', pnl: 40 }),
      row({ at: '10:00:00', to: '10:15:00', pnl: -95.5 }),
    ],
    ops: 1, pnl: [-55.5], results: ['loss'],
  },
  {
    name: 'Parciales que suman exactamente 0 = BE',
    trades: [
      row({ at: '10:00:00', to: '10:02:00', pnl: 40 }),
      row({ at: '10:00:00', to: '10:15:00', pnl: -40 }),
    ],
    ops: 1, results: ['breakeven'],
  },
  {
    name: 'Posición que pasa la noche',
    trades: [
      row({ at: '2026-10-05T22:00:00', to: '2026-10-06T09:00:00', pnl: 100 }),
      row({ at: '2026-10-06T08:00:00', to: '2026-10-06T09:00:00', pnl: 50 }),
    ],
    ops: 1,
  },
  {
    name: 'Trades importados antes (solo HH:MM): los parciales se juntan igual',
    trades: [
      row({ at: '10:00:00', to: '10:05:00', pnl: 100, legacy: true }),
      row({ at: '10:00:00', to: '10:10:00', pnl: 80, legacy: true }),
      row({ at: '11:00:00', to: '11:10:00', pnl: -50, legacy: true }),
    ],
    ops: 2,
  },
  {
    name: 'Trade cargado a mano: no se agrupa',
    trades: [
      row({ at: '10:00:00', to: '10:30:00', pnl: 50, source: null }),
      row({ at: '10:10:00', to: '10:20:00', pnl: 50, source: null }),
    ],
    ops: 2,
  },
  {
    name: 'Fila sin hora de salida: se deja tal cual',
    trades: [
      { ...row({ at: '10:00:00', to: '10:30:00', pnl: 50, legacy: true }), exitTime: undefined },
      row({ at: '10:10:00', to: '10:20:00', pnl: 50 }),
    ],
    ops: 2,
  },
]

let failed = 0
for (const c of cases) {
  const ops = groupIntoOperations(c.trades)
  const errors = []
  if (ops.length !== c.ops) errors.push(`${ops.length} operaciones, esperadas ${c.ops}`)
  const total = (a) => Math.round(a.reduce((s, t) => s + t.dollarPnl, 0) * 100) / 100
  if (total(ops) !== total(c.trades)) errors.push(`PnL ${total(ops)} ≠ ${total(c.trades)}`)
  const check = (key, field) => {
    if (!c[key]) return
    const got = ops.map(t => t[field])
    if (JSON.stringify(got) !== JSON.stringify(c[key])) errors.push(`${field} ${JSON.stringify(got)}, esperado ${JSON.stringify(c[key])}`)
  }
  check('pnl', 'dollarPnl'); check('r', 'rPnl'); check('results', 'result'); check('qty', 'qty')
  if (errors.length) { failed++; console.log(`✗ ${c.name}\n    ${errors.join('\n    ')}`) }
  else console.log(`✓ ${c.name}`)
}

console.log(`\n${cases.length - failed}/${cases.length} casos OK`)
process.exit(failed ? 1 : 0)
