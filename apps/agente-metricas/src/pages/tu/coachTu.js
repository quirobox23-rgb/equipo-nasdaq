// Coach de la zona "Tú": cruza tus métricas (últimos 30 días) con cómo has
// llegado cada día (check-ins de la oficina) y dice qué mejorar. Solo
// gestión y hábitos: nunca qué operar.
import { computeStats, computeDailyResults } from '../dashboard/dashboardHelpers'

const usd = (x) => `${x < 0 ? '-' : ''}$${Math.abs(Math.round(x)).toLocaleString('es-ES')}`
const mediaDe = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function ultimos30(trades, hoy = new Date()) {
  const desde = new Date(hoy.getTime() - 30 * 864e5).toISOString().slice(0, 10)
  return (trades || []).filter((t) => t.date && t.date >= desde)
}

export function consejosMetricas(rows) {
  const s = computeStats(rows)
  if (!s || s.total < 5) return { stats: s, consejos: [] }
  const out = []
  if (s.avgLoss && s.avgWin < Math.abs(s.avgLoss)) {
    out.push(`Ganas ${s.avgWin}R de media y pierdes ${Math.abs(s.avgLoss)}R. Respeta el stop y deja correr las buenas: es lo que más mueve tu curva.`)
  }
  if (s.total >= 10 && s.profitFactor > 0 && s.profitFactor < 1.2) {
    out.push(`Profit factor de ${s.profitFactor}: lo que ganas apenas cubre lo que pierdes. Revisa qué tipo de operación te resta y quítala una semana.`)
  }
  if (s.winRateReal && s.winRateReal < 40) {
    out.push(`Aciertas el ${s.winRateReal}% de las operaciones con resultado. Menos entradas y con más confirmación suele subirlo.`)
  }
  const peor = (s.bySetup || []).filter((x) => x.count >= 5 && x.setup).sort((a, b) => a.avgR - b.avgR)[0]
  if (peor && peor.avgR < 0) out.push(`"${peor.setup}" te deja ${peor.avgR}R de media en ${peor.count} operaciones. Es el primero que revisaría.`)

  const { days } = computeDailyResults(rows)
  const conteos = days.map((d) => d.count).sort((a, b) => a - b)
  const mediana = conteos[Math.floor(conteos.length / 2)] || 0
  const muchos = days.filter((d) => mediana && d.count > mediana * 2)
  const muchosRojo = muchos.filter((d) => d.dollarPnl < 0)
  if (muchos.length >= 2 && muchosRojo.length / muchos.length >= 0.5) {
    out.push(`Los días con más de ${mediana * 2} operaciones cierras en rojo ${muchosRojo.length} de ${muchos.length}. Ponte un máximo de operaciones al día.`)
  }
  if (!out.length) out.push('Tus números de los últimos 30 días están sanos. Mantén el mismo tamaño y el mismo plan.')
  return { stats: s, consejos: out }
}

/** Cómo te va según cómo llegas: PnL medio de los días con nota buena frente a los flojos. */
export function cruceTuMetricas(rows, dias) {
  if (!dias?.length) return null
  const { days } = computeDailyResults(rows)
  const pnl = Object.fromEntries(days.map((d) => [d.date, d.dollarPnl]))
  const buenos = dias.filter((d) => d.nota >= 75 && d.dia in pnl).map((d) => pnl[d.dia])
  const flojos = dias.filter((d) => d.nota < 75 && d.dia in pnl).map((d) => pnl[d.dia])
  if (buenos.length < 2 || flojos.length < 2) return null
  const b = mediaDe(buenos)
  const f = mediaDe(flojos)
  const texto = f < b
    ? `Los días que llegas bien haces ${usd(b)} de media; los días que llegas flojo, ${usd(f)}. Tu estado pesa en tu resultado: esos días, menos tamaño o no operar las funded.`
    : `Incluso los días que llegas flojo mantienes el resultado (${usd(f)} frente a ${usd(b)}). Buena disciplina; vigila que no se convierta en costumbre.`
  return { buenos: b, flojos: f, texto }
}
