import { test } from 'node:test'
import assert from 'node:assert/strict'
import { revisarDia, bloqueMentor, PLAN_POR_DEFECTO as plan, type Operacion } from '../src/personal/plan.ts'
import { ultimoDiaOperado } from '../src/tareas.ts'
import { pareceSenal } from '../src/coordinador.ts'

const op = (cuenta: string, fase: Operacion['fase'], dolares: number, hora = '15:40', fecha = '2026-11-17', objetivoCuenta?: number): Operacion =>
  ({ cuenta, fase, fecha, hora, dolares, objetivoCuenta })

test('funded: SL alargado, cierre antes del TP, BE, operar tras pérdida y tope', () => {
  const f = revisarDia([
    op('F1', 'fondeada', -240, '15:35'), op('F1', 'fondeada', -500, '16:10'),                   // operó tras pérdida y alargó el SL
    op('F2', 'fondeada', 180, '15:40'), op('F2', 'fondeada', 5, '16:00'),                        // cerró antes y BE
    op('F3', 'fondeada', 440, '15:40'), op('F3', 'fondeada', 440, '16:00'),                      // 880 > 440 de tope
  ], plan)
  assert.ok(f.some(x => x.startsWith('F1: perdiste 500 $') && x.includes('SL alargado')))
  assert.ok(f.some(x => x.startsWith('F1: seguiste operando después de una pérdida (1 más)')))
  assert.ok(f.some(x => x.startsWith('F2: cerraste una ganadora antes del TP')))
  assert.ok(f.some(x => x.startsWith('F2: una operación cerrada en break-even')))
  assert.ok(f.some(x => x.startsWith('F3: día de 880 $, por encima de tu tope de 440 $')))
})

test('funded que cumple el plan: nada que marcar', () => {
  assert.deepEqual(revisarDia([op('F1', 'fondeada', 440)], plan), [])
  assert.deepEqual(revisarDia([op('F1', 'fondeada', -238)], plan), [])
})

test('challenge: SL alargado, pérdida diaria, varias pérdidas y consistencia', () => {
  const f = revisarDia([op('C1', 'challenge', -800, '15:35'), op('C1', 'challenge', -400, '16:00'), op('C2', 'challenge', 2600, '15:40', '2026-11-17', 3000), op('C3', 'challenge', -1200)], plan)
  assert.ok(f.some(x => x.startsWith('C1: día de -1200 $')))
  assert.ok(f.some(x => x.startsWith('C1: 2 pérdidas en el mismo día')))
  assert.ok(f.some(x => x.startsWith('C2: día de 2600 $, por encima del 45 %')))
  assert.ok(f.some(x => x.startsWith('C3: perdiste 1200 $ con SL de 800 $')))
})

test('mentor: ayer, lo que vio el coach y el plan de hoy, sin señales', () => {
  const lineas = bloqueMentor([op('F1', 'fondeada', -240), op('C1', 'challenge', 400)], plan)
  assert.match(lineas[0], /Ayer:\* funded -240 \$ \(1 operación\), challenge \+400 \$ \(1 operación\)/)
  assert.match(lineas[1], /ayer cumpliste el plan/)
  assert.match(lineas[2], /Funded: SL 240 \$ y TP 440 \$, sin break-even.*No recuperes ni aprietes/)
  for (const l of lineas) assert.equal(pareceSenal(l), false)
  assert.match(bloqueMentor([], plan)[0], /sin operaciones/)
})

test('último día operado: el lunes mira el viernes', () => {
  const ops = [op('F1', 'fondeada', 440, '15:40', '2026-11-13'), op('F1', 'fondeada', -240, '15:40', '2026-11-10')]
  assert.equal(ultimoDiaOperado(ops, '2026-11-16')[0].fecha, '2026-11-13')
  assert.deepEqual(ultimoDiaOperado(ops, '2026-11-30'), [])
})

test('Atractor en vivo: primera perdedora en funded cierra el día y avisa si vuelves a entrar', async () => {
  const { avisosEnVivo } = await import('../src/personal/plan.ts')
  const a = avisosEnVivo([op('F1', 'fondeada', -240, '15:35')], plan)
  assert.equal(a.length, 1)
  assert.equal(a[0].clave, 'cerrado:F1')
  assert.match(a[0].texto, /primera perdedora \(-240 \$\)\. Día cerrado/)
  const b = avisosEnVivo([op('F1', 'fondeada', -240, '15:35'), op('F1', 'fondeada', -500, '15:50')], plan)
  assert.ok(b.some(x => x.clave === 'tras-cierre:F1:1'))
  assert.ok(b.some(x => x.clave.startsWith('sl-largo:F1:15:50') && x.texto.includes('500 $')))
  // Ganar la primera no cierra el día
  assert.deepEqual(avisosEnVivo([op('F2', 'fondeada', 440, '15:35')], plan), [])
})

test('Atractor en vivo: challenge con dos pérdidas y con la pérdida diaria máxima', async () => {
  const { avisosEnVivo } = await import('../src/personal/plan.ts')
  const dos = avisosEnVivo([op('C1', 'challenge', -300, '15:35'), op('C1', 'challenge', -300, '15:50')], plan)
  assert.deepEqual(dos.map(x => x.clave), ['dos-perdidas:C1'])
  const max = avisosEnVivo([op('C1', 'challenge', -800, '15:35'), op('C1', 'challenge', -300, '15:50')], plan)
  assert.deepEqual(max.map(x => x.clave), ['max-diario:C1'])
})
