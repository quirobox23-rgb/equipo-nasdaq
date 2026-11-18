import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Almacén en una carpeta temporal y sin enviar nada.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'entropia-vivo-'))
process.env.DRY_RUN = '1'
process.env.TZ_USUARIA = 'Europe/Madrid'

const { interpretarOperacion, tecladoCuentas, guardarCuentasVivo, apuntarOperacion, unirOperaciones } = await import('../src/personal/enVivo.ts')
const { PLAN_POR_DEFECTO: plan } = await import('../src/personal/plan.ts')
const { procesarMensaje } = await import('../src/servidor.ts')

test('botones y texto se entienden igual', () => {
  assert.deepEqual(interpretarOperacion('op|F1|sl'), { cuenta: 'F1', que: 'sl' })
  assert.deepEqual(interpretarOperacion('op F1 -300'), { cuenta: 'F1', que: '-300' })
  assert.deepEqual(interpretarOperacion('OP C1 TP800'), { cuenta: 'C1', que: 'tp800' })
  assert.equal(interpretarOperacion('dormí 7 horas'), null)
})

test('teclado: funded TP/SL/BE y challenge con sus dos TP', () => {
  const t = tecladoCuentas([{ nombre: 'F1', fase: 'fondeada' }, { nombre: 'C1', fase: 'challenge' }], plan)
  assert.deepEqual(t[0].map(b => b.dato), ['op|F1|tp', 'op|F1|sl', 'op|F1|be', 'op|F1|deshacer'])
  assert.deepEqual(t[1].map(b => b.dato), ['op|C1|tp400', 'op|C1|tp800', 'op|C1|sl', 'op|C1|deshacer'])
})

test('pulsar SL en una funded apunta -240 y Atractor cierra el día al momento', async () => {
  const ahora = new Date('2026-11-19T14:40:00Z')
  await guardarCuentasVivo([{ nombre: 'F1', fase: 'fondeada' }], ahora)
  const r = await procesarMensaje('op|F1|sl', ahora)
  assert.match(r, /Apuntado: F1 -240 \$ a las 15:40/)
  assert.match(r, /primera perdedora \(-240 \$\)\. Día cerrado/)
  // El mismo aviso no se repite
  const r2 = await procesarMensaje('op|F1|deshacer', new Date('2026-11-19T14:41:00Z'))
  assert.match(r2, /quitada la operación de -240 \$/)
  assert.doesNotMatch(r2, /Día cerrado/)
})

test('unir: en una cuenta con botones mandan los botones, sin duplicar el CSV', async () => {
  const vivo = [{ cuenta: 'F1', fecha: '2026-11-19', dolares: -240 }]
  const fm = [{ cuenta: 'F1', fecha: '2026-11-19', dolares: -240 }, { cuenta: 'F2', fecha: '2026-11-19', dolares: 440 }]
  assert.deepEqual(unirOperaciones(vivo, fm).map(o => o.cuenta), ['F1', 'F2'])
  assert.equal(await apuntarOperacion('F9', 'xx', plan), 'No lo he entendido. Usa los botones o escribe, por ejemplo: op F1 -240')
})
