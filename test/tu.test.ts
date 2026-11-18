import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumenTu } from '../src/tu.ts'
import type { CheckIn } from '../src/personal/coach.ts'

const ci = (fecha: string, x: Partial<CheckIn>): CheckIn => ({ fecha, fuente: 'whatsapp', ...x })

test('zona Tú: hoy, hábitos, sesgo y consejos personales', () => {
  const checkins: Record<string, CheckIn> = {
    '2026-11-16': ci('2026-11-16', { horasSueno: 5.5, habitos: { meditar: false, boxeo: true }, enCondiciones: false, sesgo: 'alcista' }),
    '2026-11-17': ci('2026-11-17', { horasSueno: 6, habitos: { meditar: false, boxeo: true }, enCondiciones: false, sesgo: 'bajista' }),
    '2026-11-18': ci('2026-11-18', { horasSueno: 6, habitos: { meditar: true, boxeo: true }, sesgo: 'alcista' }),
    '2026-11-25': ci('2026-11-25', { horasSueno: 8 }), // futuro: no cuenta
  }
  const sesgos = Object.fromEntries(['10', '11', '12', '13', '14', '17'].map((d, i) => [`2026-11-${d}`, { sesgo: 'alcista' as const, movimiento: 0, coincide: i === 0 }]))
  const r = resumenTu(checkins, sesgos, { dia: '2026-11-18', mercado: { nota: 90, motivos: [] } }, '2026-11-18')
  assert.equal(r.dias.length, 3)
  assert.equal(r.hoy.checkin, true)
  assert.ok(r.hoy.readiness)
  assert.deepEqual(r.habitos.find(h => h.nombre === 'meditar'), { nombre: 'meditar', hechos: 1, de: 3 })
  assert.deepEqual(r.sesgo, { aciertos: 1, total: 6 })
  assert.ok(r.consejos.some(c => c.startsWith('Duermes de media 5.8 h')))
  assert.ok(r.consejos.some(c => c.includes('"meditar"')))
  assert.ok(r.consejos.some(c => c.includes('acertó 1 de 6')))
  assert.ok(r.consejos.some(c => c.startsWith('2 de los últimos 3')))
})

test('zona Tú sin check-in hoy: sin readiness ni nota', () => {
  const r = resumenTu({}, {}, null, '2026-11-18')
  assert.equal(r.hoy.checkin, false)
  assert.equal(r.hoy.readiness, null)
  assert.deepEqual(r.consejos, [])
})
