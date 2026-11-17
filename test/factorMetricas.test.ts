import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcular, leerCuenta, dolares } from '../src/personal/factorMetricas.ts'
import { evaluarCuentas, revisarCuenta } from '../src/personal/gestor.ts'

test('Factor Métricas: reglas y estado de una cuenta Apex 50K trailing EOD', () => {
  const cuenta = leerCuenta({ id: 'acc-1', name: 'Apex 1', data: { name: 'Apex 1', size: 50000, maxDrawdown: 4, maxDailyDD: 2, profitTarget: 6, drawdownType: 'trailing_eod', status: 'active' } })
  const perdida = leerCuenta({ id: 'acc-2', name: 'Vieja', data: { size: 50000, maxDrawdown: 4, status: 'lost' } })
  const trades = [
    { account_id: 'acc-1', date: '2026-11-13', dollar_pnl: 1500, r_pnl: null },
    { account_id: 'acc-1', date: '2026-11-16', dollar_pnl: null, r_pnl: -2 },        // −2R × 100 $
    { account_id: 'acc-1', date: '2026-11-17', dollar_pnl: -900, r_pnl: null },
    { account_id: 'acc-2', date: '2026-11-17', dollar_pnl: -5000, r_pnl: null },
  ]
  assert.equal(dolares(trades[1], 100), -200)
  const { reglas, estados } = calcular([cuenta, perdida], trades, new Date('2026-11-17T15:00:00Z'))
  assert.equal(reglas.length, 1)                       // solo cuentas activas
  assert.deepEqual(
    { diaria: reglas[0].perdidaDiariaMax, dd: reglas[0].drawdownMax, tipo: reglas[0].tipoDrawdown, obj: reglas[0].objetivo },
    { diaria: 1000, dd: 2000, tipo: 'trailing', obj: 3000 },
  )
  assert.equal(estados[0].saldo, 50400)
  assert.equal(estados[0].pnlHoy, -900)
  assert.equal(estados[0].saldoMaximo, 51500)          // mayor cierre de día
  const rev = revisarCuenta(reglas[0], estados[0])
  assert.equal(rev.limite, 49500)                      // 51.500 − 2.000, como el motor de Factor Métricas
  assert.equal(rev.margenDrawdown, 900)
  const h = evaluarCuentas(reglas, estados)
  assert.ok(h.some(x => x.titulo.startsWith('Ojo con Apex 1: solo te quedan 900')))
  assert.ok(h.some(x => x.titulo.includes('90% de la pérdida diaria')))
})
