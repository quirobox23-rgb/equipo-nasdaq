// Zona "Tú": cómo vas tú, el que ejecuta. Junta tus check-ins, tus hábitos y
// tu sesgo frente a lo que hizo el mercado, para que Entropia Analytics lo
// muestre al lado de tus métricas y el coach pueda cruzarlo todo.
import { aptitud, type CheckIn } from './personal/coach.ts'
import { traderReadiness, veredicto, type Nota, type Veredicto } from './readiness.ts'

export interface RegistroSesgoTu { sesgo: NonNullable<CheckIn['sesgo']>; movimiento: number; coincide: boolean }

export interface DiaTu {
  dia: string
  nota: number
  horasSueno?: number
  animo?: number
  enCondiciones?: boolean
  sesgo?: CheckIn['sesgo']
  coincide?: boolean
}

export interface ResumenTu {
  hoy: {
    dia: string
    checkin: boolean
    nota: number | null
    motivos: string[]
    readiness: { veredicto: Veredicto; mercado: Nota; tu: Nota | null } | null
  }
  dias: DiaTu[]
  habitos: { nombre: string; hechos: number; de: number }[]
  sesgo: { aciertos: number; total: number }
  consejos: string[]
}

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Resumen de los últimos días (por defecto 14) para la zona "Tú". */
export function resumenTu(
  checkins: Record<string, CheckIn>,
  sesgos: Record<string, RegistroSesgoTu>,
  readiness: { dia: string; mercado: Nota } | null,
  hoy: string,
  nDias = 14,
): ResumenTu {
  const claves = Object.keys(checkins).filter(d => d <= hoy).sort().slice(-nDias)
  const dias: DiaTu[] = claves.map(dia => {
    const c = checkins[dia]
    return {
      dia, nota: aptitud(c).nota, horasSueno: c.horasSueno, animo: c.animo,
      enCondiciones: c.enCondiciones, sesgo: c.sesgo, coincide: sesgos[dia]?.coincide,
    }
  })

  const conteo = new Map<string, { hechos: number; de: number }>()
  for (const dia of claves) {
    for (const [nombre, hecho] of Object.entries(checkins[dia].habitos ?? {})) {
      const h = conteo.get(nombre) ?? { hechos: 0, de: 0 }
      h.de++
      if (hecho) h.hechos++
      conteo.set(nombre, h)
    }
  }
  const habitos = [...conteo].map(([nombre, h]) => ({ nombre, ...h }))

  const regSesgos = Object.entries(sesgos).filter(([d]) => d <= hoy).sort(([a], [b]) => a.localeCompare(b)).slice(-nDias * 2)
  const sesgo = { aciertos: regSesgos.filter(([, r]) => r.coincide).length, total: regSesgos.length }

  const c = checkins[hoy]
  const a = c ? aptitud(c) : null
  const tu = c ? traderReadiness(c, []) : null
  const r = readiness && readiness.dia === hoy
    ? { veredicto: veredicto(readiness.mercado, tu), mercado: readiness.mercado, tu }
    : null

  return {
    hoy: { dia: hoy, checkin: Boolean(c), nota: a?.nota ?? null, motivos: a?.motivos ?? [], readiness: r },
    dias, habitos, sesgo,
    consejos: consejosPersonales(dias, habitos, sesgo),
  }
}

/** Lo que el coach te diría de ti (no de tus métricas): sueño, cómo llegas, hábitos y sesgo. */
export function consejosPersonales(dias: DiaTu[], habitos: ResumenTu['habitos'], sesgo: ResumenTu['sesgo']): string[] {
  const out: string[] = []
  const sueno = dias.map(d => d.horasSueno).filter((x): x is number => x !== undefined)
  if (sueno.length >= 3 && media(sueno) < 6.5) {
    out.push(`Duermes de media ${media(sueno).toFixed(1)} h. Por debajo de 6,5 h cuesta más esperar confirmaciones: intenta acostarte antes los días de operar.`)
  }
  const noApta = dias.filter(d => d.enCondiciones === false).length
  if (noApta >= 2) out.push(`${noApta} de los últimos ${dias.length} días dijiste que no te veías en condiciones. Esos días, plan B: solo observar o tamaño mínimo.`)
  const flojo = habitos.filter(h => h.de >= 3).sort((x, y) => x.hechos / x.de - y.hechos / y.de)[0]
  if (flojo && flojo.hechos / flojo.de < 0.5) out.push(`"${flojo.nombre}" solo lo has hecho ${flojo.hechos} de ${flojo.de} días. Es el hábito que más te cuesta: ponle hora fija.`)
  if (sesgo.total >= 5) {
    const p = sesgo.aciertos / sesgo.total
    if (p < 0.5) out.push(`Tu sesgo de la mañana acertó ${sesgo.aciertos} de ${sesgo.total} días. No te cases con él: deja que el mercado lo confirme.`)
    else if (p >= 0.65) out.push(`Tu sesgo acertó ${sesgo.aciertos} de ${sesgo.total} días: buena lectura. Aun así, entra solo con confirmación.`)
  }
  return out
}
