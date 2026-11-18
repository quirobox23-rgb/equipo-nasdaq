import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describirReadiness, marketReadiness, traderReadiness, veredicto } from '../src/readiness.ts'
import { pareceSenal } from '../src/coordinador.ts'
import type { Hallazgo } from '../src/tipos.ts'

const h: Hallazgo[] = [
  { agente: 'macro', nivel: 'alerta', titulo: '14:30 CPI m/m (previsión 0.3%)' },
  { agente: 'fed', nivel: 'alerta', titulo: 'A las 16:00 habla Kevin Warsh. Cualquier pista...' },
  { agente: 'volatilidad', nivel: 'atencion', titulo: 'Nasdaq se mueve de media unos 300 puntos al día' },
  { agente: 'estructura', nivel: 'alerta', titulo: 'Barrido de Asia', estrategia: true },
  { agente: 'cuentas', nivel: 'info', titulo: 'Tienes 5 cuentas activas.' },
]

test('readiness: el mercado resta por avisos de riesgo, no por tu estrategia', () => {
  const m = marketReadiness(h)
  assert.equal(m.nota, 100 - 15 - 15 - 6)
  assert.equal(m.motivos.length, 3)
  assert.equal(veredicto(m, null), 'caution')
})

test('readiness: tu nota sale del check-in y de tus cuentas', () => {
  const bien = traderReadiness({ fecha: '2026-11-20', fuente: 'whatsapp', horasSueno: 8, animo: 4 }, [])
  assert.equal(bien!.nota, 100)
  const mal = traderReadiness({ fecha: '2026-11-20', fuente: 'whatsapp', horasSueno: 4 }, [{ agente: 'cuentas', nivel: 'alerta', titulo: 'Ojo con cuenta1: llevas el 85% de la pérdida diaria. Para por hoy.' }])
  assert.equal(mal!.nota, 100 - 35 - 25)
  assert.equal(veredicto({ nota: 90, motivos: [] }, mal), 'not-ready')
  assert.equal(traderReadiness(undefined, []), null)
})

test('readiness: bloque de texto sin check-in y sin señales', () => {
  const t = describirReadiness(marketReadiness(h), null).join('\n')
  assert.match(t, /Daily Trading Readiness: 🟠 Caution/)
  assert.match(t, /pendiente de tu check-in/)
  assert.ok(!pareceSenal(t))
})
