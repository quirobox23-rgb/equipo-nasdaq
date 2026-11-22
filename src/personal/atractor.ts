// Atractor, el mentor: junta los tres bloques (Control: lo que haces en tus
// cuentas; Contexto: cómo está el mercado; Backtesting: lo que tu setup da en
// el histórico y lo que haces en el replay) y te dice qué va bien y qué no.
// Guía es quien te lo hace llegar por Telegram. Nunca dice qué operar.
import type { Estadisticas, Ajustes, ResultadoCuentas } from '../backtesting/motor.ts'
import type { Operacion } from './plan.ts'
import type { Veredicto } from '../readiness.ts'

export interface Backtest { ajustes: Ajustes; stats: Estadisticas; fecha: string }
export interface Ciclos { a: { slUsd: number; tpUsd: number; stats: Estadisticas; cuentas: ResultadoCuentas }; b: { slUsd: number; tpUsd: number; stats: Estadisticas; cuentas: ResultadoCuentas } }
export interface Replay { operaciones: number; ganadas: number; usd: number; coinciden: number; sesiones: number }

export interface EntradaAtractor {
  backtest?: Backtest | null
  ciclos?: Ciclos | null
  replay?: Replay | null
  /** Operaciones reales (Factor Métricas o Telegram) de los últimos días. */
  real?: Operacion[]
  /** Lo que dice hoy Contexto. */
  contexto?: { veredicto?: Veredicto; volatilidadAlta?: boolean } | null
}

export interface Evaluacion { bien: string[]; mal: string[]; atento: string[] }

const usd = (x: number) => `${x < 0 ? '-' : ''}${Math.abs(Math.round(x)).toLocaleString('es-ES')} $`
const pct = (x: number) => `${x.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`

export function evaluar(e: EntradaAtractor): Evaluacion {
  const bien: string[] = [], mal: string[] = [], atento: string[] = []
  const bt = e.backtest

  // ── Backtesting: ¿el setup tiene ventaja? ──
  if (bt) {
    const s = bt.stats
    if (s.operaciones < 30) atento.push(`El backtest solo tiene ${s.operaciones} operaciones: amplía el periodo antes de sacar conclusiones.`)
    if (s.operaciones > 0) {
      const linea = `${s.operaciones} operaciones (${s.desde} → ${s.hasta}), acierto ${pct(s.acierto)}, ${usd(s.esperanza)} por operación${s.profitFactor ? `, profit factor ${s.profitFactor.toLocaleString('es-ES')}` : ''}.`
      if (s.esperanza > 0) bien.push(`Tu setup tiene ventaja en el histórico: ${linea}`)
      else mal.push(`En el histórico tu setup, tal como está, no gana: ${linea} Revisa los filtros antes de arriesgar.`)
    }
    if (s.rachaPerdidas >= 3) atento.push(`El histórico tuvo rachas de ${s.rachaPerdidas} SL seguidos. Si te toca una, es el setup y no tú: no cambies el plan por miedo.`)
    const conN = s.porHora.filter(h => h.n >= 5)
    if (conN.length >= 2) {
      const mejor = [...conN].sort((x, y) => y.usd - x.usd)[0]
      const peor = [...conN].sort((x, y) => x.usd - y.usd)[0]
      if (mejor.usd > 0) bien.push(`Tu mejor franja en el histórico: las ${mejor.hora} (hora de España), ${mejor.n} operaciones, ${usd(mejor.usd)}.`)
      if (peor.usd < 0) atento.push(`La franja de las ${peor.hora} (hora de España) resta: ${peor.n} operaciones, ${usd(peor.usd)}. Plantéate no operar a esa hora.`)
    }
    // Cruce con Contexto: volatilidad del día anterior.
    const alta = s.porVolatilidad.find(v => v.regimen === 'alta')
    const resto = s.porVolatilidad.filter(v => v.regimen !== 'alta')
    if (alta && alta.n >= 5 && resto.length) {
      const aciertoResto = resto.reduce((a, v) => a + v.acierto * v.n, 0) / resto.reduce((a, v) => a + v.n, 0)
      if (alta.acierto + 8 < aciertoResto) {
        atento.push(`Tras días de mucho rango tu setup acierta menos (${pct(alta.acierto)} frente a ${pct(Math.round(aciertoResto * 10) / 10)}).${e.contexto?.volatilidadAlta ? ' Y hoy Contexto marca volatilidad alta: menos tamaño o espera.' : ''}`)
      } else if (alta.acierto > aciertoResto + 8) {
        bien.push(`Tu setup funciona mejor tras días de mucho rango (${pct(alta.acierto)} de acierto).${e.contexto?.volatilidadAlta ? ' Hoy Contexto marca volatilidad alta: es su terreno, sin salirte del plan.' : ''}`)
      }
    }
  }

  // ── Control frente a Backtesting: ¿ejecutas lo que el setup pide? ──
  const real = (e.real ?? []).filter(o => o.fase !== 'personal')
  if (real.length >= 5) {
    const gan = real.filter(o => o.dolares > 25)
    const per = real.filter(o => o.dolares < -25)
    const acierto = Math.round(gan.length / real.length * 1000) / 10
    const dias = new Set(real.map(o => `${o.cuenta}|${o.fecha}`)).size
    const porDia = real.length / Math.max(1, dias)
    if (bt && bt.stats.operaciones >= 10) {
      const tp = bt.ajustes.tpUsd, sl = bt.ajustes.slUsd
      const mediaGan = gan.length ? gan.reduce((a, o) => a + o.dolares, 0) / gan.length : 0
      const mediaPer = per.length ? -per.reduce((a, o) => a + o.dolares, 0) / per.length : 0
      if (gan.length >= 3 && mediaGan < tp * 0.85) mal.push(`Tus ganadoras reales son de ${usd(mediaGan)} de media; con el TP fijo serían ${usd(tp)}. Estás recortando (BE o cierres antes de tiempo): es ejecución, no el setup.`)
      else if (gan.length >= 3) bien.push(`Dejas correr hasta el TP: tus ganadoras reales son de ${usd(mediaGan)} de media, como pide el plan.`)
      if (per.length >= 3 && mediaPer > sl * 1.15) mal.push(`Tus pérdidas reales son de ${usd(mediaPer)} de media con un SL de ${usd(sl)}: estás alargando el stop.`)
      else if (per.length >= 3) bien.push(`Respetas el SL: pierdes de media ${usd(mediaPer)}, lo que marca tu plan.`)
      if (acierto + 10 < bt.stats.acierto) mal.push(`En real aciertas ${pct(acierto)}; el setup en el histórico, ${pct(bt.stats.acierto)}. La diferencia suele ser entrar en cosas que no son tu setup.`)
      else if (acierto >= bt.stats.acierto - 5) bien.push(`Tu acierto real (${pct(acierto)}) está a la altura del histórico (${pct(bt.stats.acierto)}).`)
      const btPorDia = bt.stats.operaciones / Math.max(1, bt.stats.diasOperados)
      if (porDia > Math.max(1.5, btPorDia * 1.5)) mal.push(`Haces ${porDia.toLocaleString('es-ES', { maximumFractionDigits: 1 })} operaciones por día y cuenta; tu setup da ${btPorDia.toLocaleString('es-ES', { maximumFractionDigits: 1 })}. Lo que sobra no es tu setup.`)
    } else if (porDia > 2) {
      atento.push(`Haces ${porDia.toLocaleString('es-ES', { maximumFractionDigits: 1 })} operaciones por día y cuenta. Pasa un backtest para saber cuántas da tu setup de verdad.`)
    }
  }

  // ── Replay (sala de Entrenamiento) ──
  const r = e.replay
  if (r && r.operaciones >= 5) {
    const coincide = Math.round(r.coinciden / r.operaciones * 100)
    if (coincide < 50) mal.push(`En el replay solo ${coincide} % de tus entradas coinciden con el setup: estás entrando en sitios que no son el tuyo.`)
    else bien.push(`En el replay, ${coincide} % de tus entradas son tu setup (${r.operaciones} operaciones, ${usd(r.usd)}).`)
  }

  // ── Ciclos de challenge ──
  const c = e.ciclos
  if (c && (c.a.cuentas.aprobadas + c.a.cuentas.quemadas) && (c.b.cuentas.aprobadas + c.b.cuentas.quemadas)) {
    const [mejor, nombre, otro, otroNombre] = c.b.cuentas.tasa > c.a.cuentas.tasa ? [c.b, 'B', c.a, 'A'] as const : [c.a, 'A', c.b, 'B'] as const
    if (mejor.cuentas.tasa === 0) atento.push('Con estos datos ningún ciclo de challenge llega a aprobar cuentas: revisa el setup o las reglas antes de comprar más.')
    else if (mejor.cuentas.tasa === otro.cuentas.tasa) atento.push(`Los dos ciclos de challenge aprueban lo mismo (${pct(mejor.cuentas.tasa)}): mira el coste por cuenta aprobada.`)
    else bien.push(`En challenge, el ciclo ${nombre} (arriesgar ${usd(mejor.slUsd)} para ganar ${usd(mejor.tpUsd)}) aprueba ${pct(mejor.cuentas.tasa)} de las cuentas; el ${otroNombre}, ${pct(otro.cuentas.tasa)}.`)
  }

  // ── Contexto de hoy ──
  if (e.contexto?.veredicto === 'not-ready') atento.push('Hoy Contexto dice Not Ready: el mejor trade puede ser no operar.')

  if (!bt) atento.push('Sin backtest todavía: sube tus velas en Backtesting para saber qué ventaja tiene tu setup.')
  return { bien, mal, atento }
}

/** Dos o tres líneas para el mensaje de la mañana de Guía. */
export function lineasParaGuia(ev: Evaluacion): string[] {
  const out: string[] = []
  if (ev.mal[0]) out.push(`🧠 Atractor: ${ev.mal[0]}`)
  if (ev.bien[0]) out.push(`🧠 Atractor: ${ev.bien[0]}`)
  if (!out.length && ev.atento[0]) out.push(`🧠 Atractor: ${ev.atento[0]}`)
  return out
}
