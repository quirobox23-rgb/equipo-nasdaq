import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsearFF } from '../src/sources/calendario.ts'
import { agendaDelDia, vigilarMacro } from '../src/agentes/macro.ts'
import { analizarGrafico, calcularNiveles, volumenRelativo } from '../src/agentes/grafico.ts'
import { interpretarRespuesta, aptitud, evaluarBienestar } from '../src/agentes/bienestar.ts'
import { evaluarCuentas, interpretarComandoPnl, revisarCuenta, type ReglasCuenta } from '../src/agentes/cuentas.ts'
import { candidatos, puntuar } from '../src/agentes/noticias.ts'
import { semaforo, pareceSenal, plantilla } from '../src/agentes/jefe.ts'
import type { Vela } from '../src/sources/yahoo.ts'

const ff = [
  { title: 'CPI m/m', country: 'USD', date: '2026-11-18T08:30:00-05:00', impact: 'High', forecast: '0.3%', previous: '0.2%' },
  { title: 'Fed Chair Warsh Speaks', country: 'USD', date: '2026-11-18T10:00:00-05:00', impact: 'High' },
  { title: 'German ZEW', country: 'EUR', date: '2026-11-18T05:00:00-05:00', impact: 'High' },
  { title: 'Crude Oil Inventories', country: 'USD', date: '2026-11-18T10:30:00-05:00', impact: 'Low' },
]

test('calendario: solo USD de impacto alto/medio, con hora exacta', () => {
  const ev = parsearFF(ff)
  assert.equal(ev.length, 2)
  assert.equal(ev[0].titulo, 'CPI m/m')
  assert.equal(ev[0].fecha.toISOString(), '2026-11-18T13:30:00.000Z')
})

test('macro: agenda en hora de España y "no operes ahora" durante Warsh', () => {
  const ev = parsearFF(ff)
  const manana = new Date('2026-11-18T12:00:00Z')
  const agenda = agendaDelDia(ev, manana)
  assert.ok(agenda[0].titulo.startsWith('14:30 CPI'))
  assert.equal(agenda[1].nivel, 'alerta')

  const durante = vigilarMacro(ev, new Date('2026-11-18T15:20:00Z'))   // 10:20 ET, Warsh a las 10:00
  assert.ok(durante.some(h => h.nivel === 'alerta' && h.titulo.includes('No operes ahora')))

  const antes = vigilarMacro(ev, new Date('2026-11-18T14:35:00Z'))     // 25 min antes de Warsh, margen 15
  assert.ok(antes.some(h => h.nivel === 'atencion' && h.titulo.startsWith('En unos minutos')))

  const tranquilo = vigilarMacro(ev, new Date('2026-11-18T17:30:00Z'))
  assert.equal(tranquilo.length, 0)
})

/** Velas de 5 min de sesión regular para varios días (ET = UTC-5 en noviembre). */
function sesiones(dias: string[], precio: (d: number, i: number) => number, volumen: (d: number, i: number) => number, hastaHoy?: number): Vela[] {
  const out: Vela[] = []
  dias.forEach((dia, d) => {
    const n = d === dias.length - 1 && hastaHoy !== undefined ? hastaHoy : 78
    for (let i = 0; i < n; i++) {
      const t = new Date(Date.parse(`${dia}T14:30:00Z`) + i * 5 * 60_000)
      const p = precio(d, i)
      out.push({ t, o: p, h: p + 5, l: p - 5, c: p, v: volumen(d, i) })
    }
  })
  return out
}

test('gráfico: niveles de ayer y volumen relativo', () => {
  const dias = ['2026-11-13', '2026-11-16', '2026-11-17']
  const nq = sesiones(dias, (d, i) => 21000 + d * 50 + i, (d) => (d === 2 ? 3000 : 1000), 12)
  const ahora = new Date('2026-11-17T15:30:00Z')   // 10:30 ET
  const n = calcularNiveles(nq, ahora)!
  assert.equal(n.maxAyer, 21050 + 77 + 5)
  assert.equal(n.minAyer, 21050 - 5)
  const vr = volumenRelativo(nq, ahora)!
  assert.ok(vr > 2.9 && vr < 3.1, `vr=${vr}`)
  const { hallazgos } = analizarGrafico(nq, [], ahora)
  assert.ok(hallazgos.some(h => h.titulo.includes('volumen') && h.nivel === 'alerta'))
})

test('gráfico: salto de VIX', () => {
  const dias = ['2026-11-16', '2026-11-17']
  const vix = sesiones(dias, (d, i) => (d === 1 && i >= 8 ? 20 : 17), () => 0, 12)
  const nq = sesiones(dias, () => 21000, () => 1000, 12)
  const { hallazgos } = analizarGrafico(nq, vix, new Date('2026-11-17T15:30:00Z'))
  assert.ok(hallazgos.some(h => h.titulo.includes('VIX') && h.nivel === 'alerta'))
})

test('bienestar: entiende "5h, no, nerviosa" y baja la aptitud', () => {
  const c = interpretarRespuesta('dormí 5h, no he entrenado, estoy nerviosa', '2026-11-17')
  assert.equal(c.horasSueno, 5)
  assert.equal(c.entrenado, false)
  assert.equal(c.animo, 2)
  const a = aptitud(c)
  assert.ok(a.nota < 75)
  assert.equal(evaluarBienestar(c)[0].nivel, 'atencion')

  const bien = interpretarRespuesta('8 horas, sí, tranquila', '2026-11-17')
  assert.equal(bien.entrenado, true)
  assert.equal(aptitud(bien).nota, 100)

  const reloj = { ...bien, vfc: 30, vfcMedia: 50, estres: 80 }
  assert.ok(aptitud(reloj).nota <= 70)
})

test('cuentas: "ojo con esta" cerca de la pérdida diaria y del drawdown trailing', () => {
  const reglas: ReglasCuenta[] = [
    { nombre: 'cuenta1', tamano: 50000, perdidaDiariaMax: 1000, drawdownMax: 2000, tipoDrawdown: 'trailing', trailingSeFrenaEnInicial: true },
  ]
  const r = revisarCuenta(reglas[0], { nombre: 'cuenta1', saldo: 51000, pnlHoy: -850, saldoMaximo: 52500, actualizado: '2026-11-17T15:00:00Z' })
  assert.equal(r.limite, 50000)
  assert.equal(r.margenDrawdown, 1000)
  const h = evaluarCuentas(reglas, [{ nombre: 'cuenta1', saldo: 50600, pnlHoy: -850, saldoMaximo: 52500, actualizado: '2026-11-17T15:00:00Z' }])
  assert.ok(h.some(x => x.titulo.startsWith('Ojo con cuenta1: llevas el 85%')))
  assert.ok(h.some(x => x.titulo.includes('solo te quedan 600')))
  assert.deepEqual(interpretarComandoPnl('pnl cuenta1 -250 saldo 49750'), { nombre: 'cuenta1', pnlHoy: -250, saldo: 49750 })
  assert.equal(interpretarComandoPnl('hola'), null)
})

test('noticias: filtra por relevancia y recencia, sin repetir', () => {
  const ahora = new Date('2026-11-17T15:00:00Z')
  const t = [
    { titulo: 'Warsh signals no rush to cut interest rates', enlace: 'a', fecha: new Date('2026-11-17T14:50:00Z'), fuente: 'x' },
    { titulo: 'Local bakery wins award', enlace: 'b', fecha: new Date('2026-11-17T14:55:00Z'), fuente: 'x' },
    { titulo: 'US weighs new chip export controls on China', enlace: 'c', fecha: new Date('2026-11-17T12:00:00Z'), fuente: 'x' },
  ]
  assert.ok(puntuar(t[0]) >= 3)
  assert.deepEqual(candidatos(t, ahora, new Set()).map(x => x.enlace), ['a'])
  assert.deepEqual(candidatos(t, ahora, new Set(['a'])), [])
})

test('jefe: semáforo y nunca señales', () => {
  assert.equal(semaforo([{ agente: 'macro', nivel: 'info', titulo: 'x' }]), 'verde')
  assert.equal(semaforo([{ agente: 'macro', nivel: 'atencion', titulo: 'x' }]), 'ambar')
  assert.equal(semaforo([{ agente: 'grafico', nivel: 'alerta', titulo: 'x' }]), 'rojo')
  assert.ok(pareceSenal('Compra en el mínimo de ayer'))
  assert.ok(pareceSenal('ponte corto si pierde 21000'))
  assert.ok(!pareceSenal('No operes ahora, espera a que pase el dato'))
  const txt = plantilla('aviso', [{ agente: 'macro', nivel: 'alerta', titulo: 'No operes ahora: CPI.' }])
  assert.ok(txt.startsWith('🔴 *Aviso*'))
})
