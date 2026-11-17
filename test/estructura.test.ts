import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analizarEstructura, estadoNivel, nivelesClave, ESTRATEGIA_POR_DEFECTO } from '../src/equipo/estructura.ts'
import { EQUIPOS } from '../src/equipo/definiciones.ts'
import { instante } from '../src/tiempo.ts'
import { semaforo, plantilla } from '../src/coordinador.ts'
import type { Vela } from '../src/sources/yahoo.ts'

const ET = (dia: string, h: string) => instante(dia, h, 'America/New_York')

test('instante: hora de Nueva York con y sin horario de verano', () => {
  assert.equal(ET('2026-11-17', '09:30').toISOString(), '2026-11-17T14:30:00.000Z')
  assert.equal(ET('2026-07-15', '09:30').toISOString(), '2026-07-15T13:30:00.000Z')
})

/** Velas de 5 min desde `desde` con cierres dados; máx/mín a ±3 del cierre salvo que se indique. */
function serie(desde: Date, cierres: number[], minimos?: (number | undefined)[]): Vela[] {
  return cierres.map((c, i) => ({ t: new Date(desde.getTime() + i * 300_000), o: c, h: c + 3, l: minimos?.[i] ?? c - 3, c, v: 100 }))
}

// Asia del 16 (20:00) al 17 (00:00): rango 21000-21040.
const asia = serie(ET('2026-11-16', '20:00'), Array.from({ length: 48 }, (_, i) => 21003 + (i % 10) * 3.4))
const minAsia = Math.min(...asia.map(v => v.l))

test('niveles de Asia del día de trading', () => {
  const n = nivelesClave(asia, ET('2026-11-17', '03:00'), { ...ESTRATEGIA_POR_DEFECTO, niveles: ['asia'] })
  const min = n.find(x => x.id === 'asia-min')!
  assert.equal(min.valor, minAsia)
  assert.equal(min.desde.toISOString(), ET('2026-11-17', '00:00').toISOString())
})

test('estructura: se acerca, barre, recupera y "ruptura en contra"', () => {
  const e = { ...ESTRATEGIA_POR_DEFECTO, niveles: ['asia'] as const, distanciaAproximacion: 20 }
  const est = { ...e, niveles: [...e.niveles] }
  const eq = EQUIPOS.nasdaq
  const nivel = nivelesClave(asia, ET('2026-11-17', '03:00'), est).find(x => x.id === 'asia-min')!

  // 1) Cerca, sin barrer
  const cerca = [...asia, ...serie(ET('2026-11-17', '02:00'), [21030, 21020, 21012])]
  let h = analizarEstructura(cerca, ET('2026-11-17', '02:10'), est, eq)
  assert.ok(h.some(x => x.titulo.includes('se acerca al mínimo de Asia') && x.estrategia))

  // 2) Barrido: una mecha por debajo y cierre aún por debajo
  const barrido = [...cerca, ...serie(ET('2026-11-17', '02:15'), [minAsia - 2], [minAsia - 8])]
  assert.equal(estadoNivel(nivel, barrido, ET('2026-11-17', '02:15'), 20).estado, 'barrido')
  h = analizarEstructura(barrido, ET('2026-11-17', '02:15'), est, eq)
  assert.ok(h.some(x => x.titulo.startsWith('Ha barrido el mínimo de Asia') && x.detalle?.includes('La decisión es tuya')))

  // 3) Recupera: cierra de nuevo por encima
  const recupera = [...barrido, ...serie(ET('2026-11-17', '02:20'), [minAsia + 6])]
  assert.equal(estadoNivel(nivel, recupera, ET('2026-11-17', '02:20'), 20).estado, 'recuperado')

  // 4) Se queda abajo 20 min: ya es ruptura, no barrido
  const acepta = [...barrido, ...serie(ET('2026-11-17', '02:20'), [minAsia - 5, minAsia - 7, minAsia - 9])]
  assert.equal(estadoNivel(nivel, acepta, ET('2026-11-17', '02:30'), 20).estado, 'aceptado')

  // Mecha que barre y cierra dentro en la misma vela
  const mecha = [...cerca, ...serie(ET('2026-11-17', '02:15'), [minAsia + 4], [minAsia - 10])]
  assert.equal(estadoNivel(nivel, mecha, ET('2026-11-17', '02:15'), 20).estado, 'recuperado')

  // Fuera de la ventana de la estrategia no se avisa
  assert.deepEqual(analizarEstructura(barrido, ET('2026-11-17', '13:00'), est, eq), [])
})

test('los avisos de estrategia no ponen el semáforo en rojo', () => {
  const h = [{ agente: 'estructura' as const, nivel: 'alerta' as const, titulo: 'Ha barrido el mínimo de Asia', estrategia: true }]
  assert.equal(semaforo(h), 'verde')
  assert.ok(plantilla('aviso', h, [], 'Nasdaq').includes('📍 _Tu estrategia_'))
})
