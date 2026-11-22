import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leerCsv, agrupar, enNY, deSerie, type Vela } from '../src/backtesting/velas.ts'
import { simular, detectarSetups, completarAjustes, estadisticas, simularCuentas, puntos, type Operacion } from '../src/backtesting/motor.ts'

/** Velas de 1 minuto que dibujan cada vela M15 (o→mín→máx→c si sube, o→máx→mín→c si baja). */
function minutos(inicioUtc: number, m15: [number, number, number, number][]): Vela[] {
  const out: Vela[] = []
  m15.forEach(([o, h, l, c], i) => {
    const camino = c >= o ? [o, l, h, c] : [o, h, l, c]
    for (let k = 0; k < 15; k++) {
      const pos = (x: number) => { const f = x / 15 * 3; const a = Math.floor(f); const b = Math.min(3, a + 1); return camino[a] + (camino[b] - camino[a]) * (f - a) }
      const p0 = pos(k), p1 = pos(k + 1)
      // Que los extremos exactos aparezcan en el minuto que los cruza.
      const hi = Math.max(p0, p1, ...[5, 10].filter(m => m > k && m <= k + 1).map(m => camino[m / 5]))
      const lo = Math.min(p0, p1, ...[5, 10].filter(m => m > k && m <= k + 1).map(m => camino[m / 5]))
      out.push({ t: inicioUtc + (i * 15 + k) * 60_000, o: p0, h: hi, l: lo, c: p1, v: 10 })
    }
  })
  return out
}

const APERTURA = Date.UTC(2024, 2, 5, 14, 30) // 9:30 en Nueva York (EST)

const LARGO: [number, number, number, number][] = [
  [100, 105, 95, 102], [102, 110, 100, 108], [108, 120, 106, 112], // giro en 120
  [112, 115, 104, 106], [106, 108, 98, 100], [100, 112, 99, 111],
  [111, 119, 110, 118], // un toque al 120
  [118, 135, 117, 134], // lo cruza pero no queda entera encima
  [134, 145, 125, 144], // entera por encima: disparo
  [144, 146, 130, 132], [132, 133, 112, 115], [115, 116, 109, 112], // retrocede a la zona
  [112, 140, 111, 138], [138, 170, 137, 168], // TP
]

test('backtesting: detecta el disparo con la vela entera por encima del máximo y zona fresca', () => {
  const m15 = agrupar(minutos(APERTURA, LARGO), 900)
  const s = detectarSetups(m15, completarAjustes({ direccion: 'largos' }))
  assert.equal(s.length, 1)
  assert.equal(s[0].i, 8)
  assert.equal(s[0].nivel, 120)
  assert.equal(s[0].toques, 1)
  assert.equal(s[0].origen, 98)
  // Con dos toques la zona ya no es fresca.
  assert.equal(detectarSetups(m15, completarAjustes({ direccion: 'largos', maxToques: 0 })).length, 0)
})

test('backtesting: entra en el 0,75 del impulso y sale en el TP fijo', () => {
  const sim = simular(minutos(APERTURA, LARGO), { direccion: 'largos' })
  assert.deepEqual(sim.puntos, { sl: 30, tp: 55 }) // MNQ × 4: 240 $ y 440 $
  assert.equal(sim.operaciones.length, 1)
  const op = sim.operaciones[0]
  assert.equal(op.entrada, 110) // 146 - 0,75 × (146 - 98)
  assert.equal(op.motivo, 'tp')
  assert.equal(op.usd, 440)
  assert.equal(op.dia, '2024-03-05')
})

test('backtesting: con SL la primera del día cierra el día', () => {
  const PIERDE = [...LARGO.slice(0, 12), [112, 113, 70, 75] as [number, number, number, number]]
  // Mismo patrón otra vez más tarde ese día: no debe operarse.
  const tarde = minutos(APERTURA + 13 * 900_000, LARGO.map(([o, h, l, c]) => [o - 50, h - 50, l - 50, c - 50]))
  const sim = simular([...minutos(APERTURA, PIERDE), ...tarde], { direccion: 'largos' })
  assert.equal(sim.operaciones.length, 1)
  assert.equal(sim.operaciones[0].motivo, 'sl')
  assert.equal(sim.operaciones[0].usd, -240)
  assert.ok(sim.saltadosDia >= 1)
  const sinRegla = simular([...minutos(APERTURA, PIERDE), ...tarde], { direccion: 'largos', primeraPerdidaCierra: false })
  assert.equal(sinRegla.operaciones.length, 2)
})

test('backtesting: lee CSV de Databento, NinjaTrader y Sierra Chart', () => {
  const db = leerCsv([
    'ts_event,rtype,publisher_id,instrument_id,open,high,low,close,volume,symbol',
    '2024-03-05T14:30:00.000000000Z,33,1,1,18000.25,18010.5,17995,18005,1200,NQH4',
    '2024-03-05T14:31:00.000000000Z,33,1,1,18005,18012,18001,18011.75,900,NQH4',
    '2024-03-05T14:31:00.000000000Z,33,1,2,40,41,39,40,5,NQH4-NQM4',
  ].join('\n'))
  assert.equal(db.serie.t.length, 2)
  assert.equal(db.serie.resolucion, 60)
  assert.equal(db.serie.t[0], Date.UTC(2024, 2, 5, 14, 30))
  assert.equal(db.serie.c[1], 18011.75)
  assert.match(db.formato, /Databento/)

  // NinjaTrader exporta en hora local de la plataforma; aquí, Nueva York.
  const nt = leerCsv('20240305 093100;18000;18010;17990;18005;300\n20240305 093200;18005;18008;18001;18002;200', { tz: 'ny' })
  assert.equal(nt.serie.t[0], Date.UTC(2024, 2, 5, 14, 31))
  assert.equal(enNY(nt.serie.t[0]).min, 9 * 60 + 31)

  const sc = leerCsv('Date, Time, Open, High, Low, Last, Volume, # of Trades\n2024/3/5, 09:30:00, 18000, 18004, 17999, 18003, 50, 10\n2024/3/5, 09:31:00, 18003, 18006, 18001, 18002, 40, 8', { tz: 'ny' })
  assert.equal(sc.serie.t.length, 2)
  assert.equal(sc.serie.c[0], 18003)
  assert.match(sc.formato, /Sierra/)

  // Ticks → velas de 1 segundo.
  const tk = leerCsv('timestamp,price,size\n2024-03-05T14:30:00.100Z,18000,1\n2024-03-05T14:30:00.900Z,18002,2\n2024-03-05T14:30:01.200Z,17999,1')
  assert.equal(tk.serie.resolucion, 1)
  assert.deepEqual(deSerie(tk.serie)[0], { t: Date.UTC(2024, 2, 5, 14, 30), o: 18000, h: 18002, l: 18000, c: 18002, v: 3 })
})

test('backtesting: puntos de SL y TP según instrumento y contratos', () => {
  assert.deepEqual(puntos(completarAjustes({ instrumento: 'NQ', contratos: 1 })), { sl: 12, tp: 22 })
  assert.deepEqual(puntos(completarAjustes({ instrumento: 'MNQ', contratos: 3, slUsd: 1000, tpUsd: 500 })), { sl: 166.75, tp: 83.25 })
})

test('backtesting: estadísticas y cuentas sucesivas', () => {
  const op = (dia: string, usd: number): Operacion => ({ lado: 'largo', dia, setup: 0, nivel: 0, toques: 0, origen: 0, extremo: 0, entradaT: Date.parse(`${dia}T15:00:00Z`), entrada: 0, sl: 0, tp: 0, salidaT: Date.parse(`${dia}T16:00:00Z`), salida: 0, motivo: usd > 0 ? 'tp' : 'sl', ambigua: false, usd, puntos: 0 })
  const ops = [op('2024-03-01', 440), op('2024-03-04', -240), op('2024-03-05', -240), op('2024-03-06', 440), op('2024-03-07', 440)]
  const e = estadisticas(ops)
  assert.equal(e.acierto, 60)
  assert.equal(e.pnl, 840)
  assert.equal(e.rachaPerdidas, 2)
  assert.equal(e.maxDrawdown, 480)
  assert.equal(e.profitFactor, 2.75)
  const c = simularCuentas(ops, { objetivo: 800, drawdown: 2000, perdidaDiaria: 0, consistencia: 0.6, precio: 100 })
  assert.equal(c.aprobadas, 1)
  assert.equal(c.quemadas, 0)
})

test('atractor: cruza tus operaciones reales con el backtest', async () => {
  const { evaluar } = await import('../src/personal/atractor.ts')
  const bt = { ajustes: completarAjustes({}), fecha: '', stats: { ...estadisticas([]), operaciones: 120, acierto: 42, esperanza: 35, profitFactor: 1.3, diasOperados: 100, desde: '2024-01-02', hasta: '2024-06-28' } }
  const real = [200, 180, -240, 250, -240, 220, -240].map((d, i) => ({ cuenta: 'F1', fase: 'fondeada' as const, fecha: `2026-11-${10 + i}`, dolares: d }))
  const ev = evaluar({ backtest: bt, real })
  assert.ok(ev.bien.some(x => x.includes('ventaja en el histórico')))
  assert.ok(ev.mal.some(x => x.includes('Estás recortando')))
  assert.ok(ev.bien.some(x => x.includes('Respetas el SL')))
})
