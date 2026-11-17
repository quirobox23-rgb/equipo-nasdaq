// npm run test:fredcalendar
import test from 'node:test'
import assert from 'node:assert/strict'
import { computeActual, seriesRuleFor, buildScheduledWeek } from '../fredCalendar.ts'
import { mergeWithSnapshot } from '../weekSnapshot.ts'

const obs = (vals, lastPublished) => vals.map((v, i) => ({
  date: `2026-${String(i + 1).padStart(2, '0')}-01`, value: v,
  realtimeStart: i === vals.length - 1 ? lastPublished : '2026-01-01',
}))

test('CPI m/m: variación del índice, solo si se publicó ese día', () => {
  const rule = seriesRuleFor('CPI m/m')
  assert.equal(computeActual(rule, obs([320.0, 320.96], '2026-11-12'), '2026-11-12'), '0.3%')
  // El último dato es de otro día (todavía no salió el nuevo): nada.
  assert.equal(computeActual(rule, obs([320.0, 320.96], '2026-10-15'), '2026-11-12'), null)
})

test('NFP en miles, paro y peticiones', () => {
  assert.equal(computeActual(seriesRuleFor('Non-Farm Employment Change'), obs([159000, 159143], 'D'), 'D'), '143K')
  assert.equal(computeActual(seriesRuleFor('Non-Farm Employment Change'), obs([159000, 158988], 'D'), 'D'), '-12K')
  assert.equal(computeActual(seriesRuleFor('Unemployment Rate'), obs([4.1, 4.2], 'D'), 'D'), '4.2%')
  assert.equal(computeActual(seriesRuleFor('Unemployment Claims'), obs([219000], 'D'), 'D'), '219K')
  assert.equal(computeActual(seriesRuleFor('JOLTS Job Openings'), obs([7440], 'D'), 'D'), '7.44M')
  assert.equal(computeActual(seriesRuleFor('Retail Sales m/m'), obs([100, 100], 'D'), 'D'), '0.0%')
})

test('CPI y/y usa el dato de 12 meses antes', () => {
  const vals = [300, ...Array(11).fill(305), 309]
  assert.equal(computeActual(seriesRuleFor('CPI y/y'), obs(vals, 'D'), 'D'), '3.0%')
  assert.equal(computeActual(seriesRuleFor('CPI y/y'), obs([300, 309], 'D'), 'D'), null)
})

test('calendario de FRED → eventos de la semana, con la Fed', () => {
  const ev = buildScheduledWeek([
    { release_name: 'Consumer Price Index', date: '2026-12-10' },
    { release_name: 'Unemployment Insurance Weekly Claims Report', date: '2026-12-10' },
    { release_name: 'Gross Domestic Product by State', date: '2026-12-08' },
    { release_name: 'Employment Situation', date: '2026-12-18' }, // otra semana
  ], '2026-12-07')
  assert.deepEqual(ev.map(e => `${e.date} ${e.time} ${e.name}`), [
    '2026-12-09 14:00 Federal Funds Rate',
    '2026-12-09 14:00 FOMC Statement',
    '2026-12-09 14:30 FOMC Press Conference',
    '2026-12-10 08:30 CPI m/m',
    '2026-12-10 08:30 Core CPI m/m',
    '2026-12-10 08:30 CPI y/y',
    '2026-12-10 08:30 Unemployment Claims',
  ])
})

test('FF manda, pero se conserva el dato real guardado', () => {
  const ff = [{ date: '2026-11-05', name: 'Unemployment Claims', forecast: '225K', actual: null }]
  const saved = [{ date: '2026-11-05', name: 'Unemployment Claims', forecast: '220K', actual: '219K' }]
  assert.deepEqual(mergeWithSnapshot(ff, saved), [{ date: '2026-11-05', name: 'Unemployment Claims', forecast: '225K', actual: '219K' }])
  assert.deepEqual(mergeWithSnapshot(ff, null), ff)
})
