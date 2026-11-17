// npm run test:forexfactory
// Filas de ejemplo con el formato del feed ff_calendar_thisweek.json.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mapForexFactory, toNewYork } from '../forexFactory.ts'

const feed = [
  { title: 'FOMC Member Bowman Speaks', country: 'USD', date: '2026-10-05T08:15:00-04:00', impact: 'Medium', forecast: '', previous: '' },
  { title: 'CPI m/m', country: 'USD', date: '2026-10-06T08:30:00-04:00', impact: 'High', forecast: '0.3%', previous: '0.4%' },
  { title: 'Crude Oil Inventories', country: 'USD', date: '2026-10-07T10:30:00-04:00', impact: 'Low', forecast: '', previous: '-1.2M' },
  { title: 'German Factory Orders m/m', country: 'EUR', date: '2026-10-06T02:00:00-04:00', impact: 'High', forecast: '', previous: '' },
  { title: 'Unemployment Claims', country: 'USD', date: '2026-10-08T08:30:00-04:00', impact: 'High', forecast: '225K', previous: '218K' },
  { title: 'Bank Holiday', country: 'USD', date: '2026-10-12T00:00:00-04:00', impact: 'Holiday', forecast: '', previous: '' },
  { title: 'Non-Farm Employment Change', country: 'USD', date: '2026-10-16T08:30:00-04:00', impact: 'High', forecast: '', previous: '' },
]

test('toNewYork deja la hora en Nueva York (ET), con y sin horario de verano', () => {
  assert.deepEqual(toNewYork('2026-10-06T08:30:00-04:00'), { date: '2026-10-06', time: '08:30' })
  assert.deepEqual(toNewYork('2026-11-06T08:30:00-05:00'), { date: '2026-11-06', time: '08:30' })
  assert.deepEqual(toNewYork('2026-10-06T12:30:00Z'), { date: '2026-10-06', time: '08:30' })
})

test('solo impacto alto y medio, solo USD y solo lunes-viernes de esa semana', () => {
  const ev = mapForexFactory(feed, '2026-10-05')
  assert.deepEqual(ev.map(e => e.name), ['FOMC Member Bowman Speaks', 'CPI m/m', 'Unemployment Claims'])
  assert.deepEqual(ev.map(e => e.impact), ['med', 'high', 'high'])
})

test('mismo formato que los week_<lunes>.json', () => {
  const cpi = mapForexFactory(feed, '2026-10-05')[1]
  assert.deepEqual(cpi, {
    date: '2026-10-06', time: '08:30', country: 'USA', currency: 'USD', name: 'CPI m/m',
    impact: 'high', prev: '0.4%', forecast: '0.3%', actual: null, type: 'macro',
    affects: ['USD', 'NQ', 'GOLD', 'VIX'],
  })
  const speech = mapForexFactory(feed, '2026-10-05')[0]
  assert.equal(speech.forecast, null)
  assert.deepEqual(speech.affects, ['USD', 'TLT'])
})
