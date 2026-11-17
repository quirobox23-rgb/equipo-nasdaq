import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumirEstado, envejecer } from '../src/estadoOficina.ts'

test('oficina: cada agente trabaja o descansa según sus hallazgos', () => {
  const ahora = new Date('2026-11-17T14:45:00Z')
  const e = resumirEstado([
    { agente: 'estructura', nivel: 'alerta', titulo: 'Ha barrido el mínimo de Asia', estrategia: true },
    { agente: 'volumen', nivel: 'atencion', titulo: 'Entra mucho volumen' },
    { agente: 'noticias', nivel: 'info', titulo: 'Nada relevante' },
  ], ['Nasdaq'], ahora, true)
  assert.equal(e.agentes.estructura?.estado, 'alerta')
  assert.equal(e.agentes.volumen?.estado, 'trabajando')
  assert.equal(e.agentes.noticias?.estado, 'descanso')
  assert.equal(e.agentes.coordinador?.estado, 'trabajando')
  assert.equal(e.semaforo, 'ambar')

  const tarde = envejecer(e, new Date('2026-11-17T15:30:00Z'))
  assert.equal(tarde.agentes.estructura?.estado, 'descanso')
  assert.equal(tarde.agentes.estructura?.mensaje, 'Ha barrido el mínimo de Asia')
})
