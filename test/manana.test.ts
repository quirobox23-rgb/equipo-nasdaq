import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsearFF } from '../src/sources/calendario.ts'
import { agendaFed, esFed, type MiembroFed } from '../src/equipo/fed.ts'
import { parsearFinnhub } from '../src/sources/earnings.ts'
import { agendaResultados } from '../src/equipo/earnings.ts'
import { atr, rangoEsperado, movimientoDelDia } from '../src/equipo/grafico.ts'
import { interpretarRespuesta, preguntaCheckin, respuestaCheckin, aptitud } from '../src/personal/coach.ts'
import { resumenCuentas, type ReglasCuenta } from '../src/personal/gestor.ts'
import { compararSesgo, fechaLarga } from '../src/tareas.ts'
import { pareceSenal } from '../src/coordinador.ts'
import type { Vela } from '../src/sources/yahoo.ts'

const miembros: MiembroFed[] = [{ apellido: 'Warsh', nombre: 'Kevin', cargo: 'presidente de la Fed', vota: true }]
const cal = parsearFF([
  { title: 'CPI m/m', country: 'USD', date: '2026-11-20T08:30:00-05:00', impact: 'High' },
  { title: 'Fed Chair Warsh Speaks', country: 'USD', date: '2026-11-20T10:00:00-05:00', impact: 'High' },
  { title: 'FOMC Member Waller Speaks', country: 'USD', date: '2026-11-20T13:00:00-05:00', impact: 'Medium' },
])
const viernes = new Date('2026-11-20T07:30:00Z')

test('fed: separa la Fed del resto y presenta a quien habla', () => {
  assert.equal(cal.filter(e => esFed(e, miembros)).length, 2)
  const h = agendaFed(cal, viernes, miembros)
  assert.equal(h.length, 2)
  assert.equal(h[0].nivel, 'alerta')
  assert.match(h[0].titulo, /16:00 habla Kevin Warsh \(presidente de la Fed, vota este año\)/)
  assert.equal(h[1].nivel, 'atencion')
})

test('resultados: solo las grandes del NQ, sin adivinar el sentido', () => {
  const lista = parsearFinnhub({ earningsCalendar: [
    { symbol: 'NVDA', date: '2026-11-20', hour: 'amc', epsEstimate: 1.25 },
    { symbol: 'XYZ', date: '2026-11-20', hour: 'bmo', epsEstimate: 0.1 },
    { symbol: 'AAPL', date: '2026-11-19', hour: 'amc', epsEstimate: 1.5, epsActual: 1.62 },
  ] })
  const h = agendaResultados(lista, '2026-11-20')
  assert.equal(h.length, 2)
  assert.equal(h[0].nivel, 'alerta')
  assert.match(h[0].titulo, /Nvidia presenta resultados hoy después del cierre/)
  assert.match(h[0].titulo, /en cualquier sentido/)
  assert.match(h[1].titulo, /Apple presentó resultados ayer.*por encima de lo esperado/)
  assert.ok(h.every(x => !pareceSenal(x.titulo)))
})

const dia = (d: string, o: number, h: number, l: number, c: number): Vela => ({ t: new Date(`${d}T05:00:00Z`), o, h, l, c, v: 1 })

test('volatilidad y rango: ATR en puntos y aviso con VIX alto', () => {
  const diarias = [
    dia('2026-11-16', 100, 400, 100, 300), dia('2026-11-17', 300, 500, 200, 400),
    dia('2026-11-18', 400, 700, 400, 600), dia('2026-11-19', 600, 900, 600, 800),
    dia('2026-11-20', 800, 820, 790, 810), // hoy, sin cerrar: no cuenta
  ]
  assert.equal(atr(diarias, viernes), 300)
  const vix = [{ t: new Date('2026-11-19T20:00:00Z'), o: 20, h: 20, l: 20, c: 20, v: 0 }, { t: new Date('2026-11-20T07:00:00Z'), o: 23, h: 23, l: 23, c: 23, v: 0 }]
  const h = rangoEsperado(diarias, vix, viernes, { id: 'nasdaq', nombre: 'Nasdaq', nombreVolatilidad: 'VIX' })
  assert.equal(h[0].agente, 'volatilidad')
  assert.equal(h[0].nivel, 'atencion')
  assert.match(h[0].titulo, /unos 300 puntos al día/)
})

test('movimiento del día en % desde la apertura regular', () => {
  const v = (iso: string, o: number, c: number): Vela => ({ t: new Date(iso), o, h: Math.max(o, c), l: Math.min(o, c), c, v: 1 })
  const velas = [v('2026-11-20T13:00:00Z', 99, 100), v('2026-11-20T14:30:00Z', 100, 100), v('2026-11-20T20:55:00Z', 100, 99)]
  assert.equal(Math.round(movimientoDelDia(velas, new Date('2026-11-20T21:15:00Z'))! * 100) / 100, -1)
  assert.equal(compararSesgo('bajista', -1), true)
  assert.equal(compararSesgo('alcista', -1), false)
  assert.equal(compararSesgo('neutral', 0.3), true)
})

test('coach: hábitos propios, condiciones y sesgo', () => {
  const habitos = ['meditar', 'boxeo']
  assert.match(preguntaCheckin(habitos), /si has hecho meditar y boxeo/)
  const c = interpretarRespuesta('7h, sí, he comido bien, he meditado, no he hecho boxeo, tranquila, me veo bien, bajista', '2026-11-20', habitos)
  assert.equal(c.horasSueno, 7)
  assert.equal(c.comido, true)
  assert.deepEqual(c.habitos, { meditar: true, boxeo: false })
  assert.equal(c.enCondiciones, true)
  assert.equal(c.sesgo, 'bajista')

  const r = respuestaCheckin(c, habitos, [{ titulo: 'CPI m/m', hora: '14:30' }, { titulo: 'habla Kevin Warsh', hora: '16:00' }])
  assert.match(r, /Aún te queda boxeo/)
  assert.match(r, /Tu sesgo hoy es bajista. Hay CPI m\/m a las 14:30 y habla Kevin Warsh a las 16:00: anda con ojo/)
  assert.match(r, /la decisión es tuya/)
  assert.ok(!pareceSenal(r))

  const mal = interpretarRespuesta('5h, no me veo para operar hoy', '2026-11-20')
  assert.equal(mal.enCondiciones, false)
  assert.ok(aptitud(mal).nota < 75)
})

test('gestor: resumen de cuentas fondeadas y en challenge', () => {
  const r = (fase: ReglasCuenta['fase']): ReglasCuenta => ({ nombre: 'x', fase, tamano: 50000, drawdownMax: 2000, tipoDrawdown: 'trailing' })
  assert.equal(resumenCuentas([r('fondeada'), r('fondeada'), r('fondeada'), r('challenge'), r('challenge')]), 'Tienes 5 cuentas activas: 3 fondeadas y 2 en challenge.')
  assert.equal(resumenCuentas([r(undefined)]), 'Tienes 1 cuenta activa.')
})

test('guía: fecha larga en español', () => {
  assert.equal(fechaLarga(viernes), 'viernes, 20 de noviembre')
})
