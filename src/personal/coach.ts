// Asesora personal: pregunta cómo estás y traduce tu estado en una nota de
// "aptitud para operar". Los campos del reloj (VFC, pulso en reposo, estrés)
// ya están en la ficha; hoy se rellenan a mano y mañana desde el wearable.
import { promises as fs } from 'node:fs'
import { config } from '../config.ts'
import type { Hallazgo } from '../tipos.ts'

export interface CheckIn {
  fecha: string                 // YYYY-MM-DD
  fuente: 'whatsapp' | 'reloj'
  horasSueno?: number
  entrenado?: boolean
  /** 1 = fatal … 5 = genial */
  animo?: number
  emociones?: string[]
  texto?: string
  comido?: boolean
  /** Tus hábitos de cada día (meditar, boxeo...): hecho o no. */
  habitos?: Record<string, boolean>
  /** Lo que tú misma dices: ¿te ves en condiciones de operar? */
  enCondiciones?: boolean
  sesgo?: 'alcista' | 'bajista' | 'neutral'
  // Del reloj (futuro)
  vfc?: number                  // variabilidad de la frecuencia cardiaca, ms
  vfcMedia?: number             // tu media de referencia
  pulsoReposo?: number
  pulsoReposoMedio?: number
  estres?: number               // 0-100
}

export const PREGUNTA_CHECKIN =
  '¿Cómo estás hoy? Cuéntame en una línea: cuántas horas has dormido, si has entrenado y cómo te sientes (por ejemplo: "7h, sí, tranquila").'

export interface AjustesCoach { habitos: string[] }

/** config/coach.json: { "habitos": ["meditar", "boxeo"] }. Cada persona pone lo que quiere que le recuerde. */
export async function cargarAjustesCoach(archivo = config.coachArchivo): Promise<AjustesCoach> {
  try {
    const j = JSON.parse(await fs.readFile(archivo, 'utf-8')) as Partial<AjustesCoach>
    return { habitos: (j.habitos ?? []).map(h => String(h).trim()).filter(Boolean) }
  } catch {
    return { habitos: [] }
  }
}

/** La pregunta de la mañana, con tus hábitos y tu sesgo del día. */
export function preguntaCheckin(habitos: string[] = []): string {
  const extra = habitos.length ? `, si has comido bien, si has hecho ${unirY(habitos)}` : ', si has comido bien'
  return `¿Cómo estás hoy? Cuéntame en una línea: horas de sueño, si has entrenado${extra}, cómo te sientes, si te ves en condiciones de operar y qué sesgo tienes hoy (alcista, bajista o neutral). Por ejemplo: "7h, sí, comido bien, medité, tranquila, me veo bien, bajista".`
}

export function unirY(xs: string[]): string {
  return xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] ?? ''
}

/** Raíz de un hábito para reconocerlo conjugado: "meditar" → "medit", "boxeo" → "boxe". */
function raiz(h: string): string {
  const t = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return t.length > 5 ? t.slice(0, 5) : t.replace(/[aeiou]$/, '')
}

const EMOCIONES: [RegExp, string, number][] = [
  [/\b(genial|muy bien|estupend[ao]|con energ[ií]a|motivad[ao])\b/i, 'con energía', 5],
  [/\b(tranquil[ao]|bien|centrad[ao]|serena?|en calma)\b/i, 'tranquila', 4],
  [/\b(normal|regular|así así|asi asi)\b/i, 'normal', 3],
  [/\b(cansad[ao]|agotad[ao]|sin energ[ií]a|dormid[ao])\b/i, 'cansada', 2],
  [/\b(nervios[ao]|ansios[ao]|estresad[ao]|agobiad[ao]|irritad[ao]|enfadad[ao]|triste|mal)\b/i, 'nerviosa', 2],
  [/\b(fatal|horrible|fatal|hecha polvo|destrozad[ao])\b/i, 'fatal', 1],
  [/\b(revancha|recuperar lo perdido|tengo que ganar)\b/i, 'ganas de revancha', 1],
]

export function interpretarRespuesta(texto: string, fecha: string, habitos: string[] = []): CheckIn {
  const c: CheckIn = { fecha, fuente: 'whatsapp', texto }
  const t = texto.toLowerCase()

  const sueno = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h\b|horas?|hrs?)/) ?? t.match(/dorm[ií]\w*\s+(\d+(?:[.,]\d+)?)/)
  if (sueno) c.horasSueno = Number(sueno[1].replace(',', '.'))

  if (/\b(no he entrenado|no entren\w*|sin entrenar|hoy no|no,)/.test(t)) c.entrenado = false
  else if (/\b(he entrenado|entren\w*|gym|gimnasio|corr[ií]|yoga|s[ií],|s[ií]\b)/.test(t)) c.entrenado = true

  const numAnimo = t.match(/\b([1-5])\s*\/\s*5\b/)
  if (numAnimo) c.animo = Number(numAnimo[1])

  const emociones: string[] = []
  let peor: number | undefined
  for (const [re, nombre, valor] of EMOCIONES) {
    if (re.test(t)) {
      emociones.push(nombre)
      peor = peor === undefined ? valor : Math.min(peor, valor)
    }
  }
  if (emociones.length) c.emociones = emociones
  if (c.animo === undefined && peor !== undefined) c.animo = peor

  if (/\b(no he comido|sin comer|no he desayunado|mal comido|he comido mal)\b/.test(t)) c.comido = false
  else if (/\b(comido|desayunad[oa]|com[ií] bien)\b/.test(t)) c.comido = true

  const plano = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const h of habitos) {
    const r = raiz(h)
    if (new RegExp(`\\b(no|sin)\\s+(he\\s+)?(hecho\\s+)?${r}`).test(plano)) (c.habitos ??= {})[h] = false
    else if (new RegExp(`\\b${r}`).test(plano)) (c.habitos ??= {})[h] = true
  }

  if (/\b(no me veo|no estoy en condiciones|no estoy para operar|mejor no opero|hoy no opero)\b/.test(t)) c.enCondiciones = false
  else if (/\b(me veo bien|en condiciones|me veo lista|me veo listo|con ganas de operar)\b/.test(t)) c.enCondiciones = true

  const sesgo = t.match(/\b(alcista|bajista|neutral|neutro|lateral|sin sesgo)\b/)
  if (sesgo) c.sesgo = sesgo[1] === 'alcista' ? 'alcista' : sesgo[1] === 'bajista' ? 'bajista' : 'neutral'
  return c
}

/** 0-100. Parte de 100 y resta por cada señal de que hoy no es tu mejor día. */
export function aptitud(c: CheckIn): { nota: number; motivos: string[] } {
  let nota = 100
  const motivos: string[] = []
  if (c.horasSueno !== undefined) {
    if (c.horasSueno < 5) { nota -= 35; motivos.push(`has dormido ${c.horasSueno} h`) }
    else if (c.horasSueno < 6.5) { nota -= 15; motivos.push(`has dormido poco (${c.horasSueno} h)`) }
  }
  if (c.entrenado === false) { nota -= 5; motivos.push('hoy no has entrenado') }
  if (c.comido === false) { nota -= 10; motivos.push('no has comido bien') }
  if (c.enCondiciones === false) { nota -= 30; motivos.push('tú misma no te ves en condiciones') }
  if (c.animo !== undefined) {
    if (c.animo <= 1) { nota -= 45; motivos.push('no estás bien hoy') }
    else if (c.animo === 2) { nota -= 25; motivos.push(`te notas ${c.emociones?.find(e => e !== 'tranquila') ?? 'baja'}`) }
  }
  if (c.emociones?.includes('ganas de revancha')) { nota -= 20; motivos.push('hay ganas de revancha') }
  if (c.vfc !== undefined && c.vfcMedia) {
    if (c.vfc < c.vfcMedia * 0.8) { nota -= 15; motivos.push('tu VFC está bastante por debajo de lo normal') }
  }
  if (c.pulsoReposo !== undefined && c.pulsoReposoMedio && c.pulsoReposo > c.pulsoReposoMedio + 5) {
    nota -= 10; motivos.push('tu pulso en reposo está alto')
  }
  if (c.estres !== undefined && c.estres >= 70) { nota -= 15; motivos.push('el reloj marca estrés alto') }
  return { nota: Math.max(0, nota), motivos }
}

export function evaluarBienestar(c: CheckIn | undefined): Hallazgo[] {
  if (!c) {
    return [{ agente: 'bienestar', nivel: 'info', titulo: 'Aún no me has contado cómo estás hoy.', detalle: PREGUNTA_CHECKIN }]
  }
  const { nota, motivos } = aptitud(c)
  const porque = motivos.length ? ` (${motivos.join(', ')})` : ''
  if (nota < 50) return [{ agente: 'bienestar', nivel: 'alerta', titulo: `Aptitud para operar: ${nota}/100${porque}. Hoy mejor no operar, o solo con tamaño mínimo.`, clave: `bienestar:${c.fecha}` }]
  if (nota < 75) return [{ agente: 'bienestar', nivel: 'atencion', titulo: `Aptitud para operar: ${nota}/100${porque}. Reduce tamaño y número de operaciones.`, clave: `bienestar:${c.fecha}` }]
  return [{ agente: 'bienestar', nivel: 'info', titulo: `Aptitud para operar: ${nota}/100. Buen estado para trabajar.`, clave: `bienestar:${c.fecha}` }]
}

export interface EventoDelDia { titulo: string; hora: string }

/**
 * Lo que el coach te contesta al check-in: tu aptitud, lo que te queda de tus
 * hábitos y, si tienes sesgo, con qué noticias de hoy tener cuidado. Nunca
 * dice si tu sesgo es bueno o malo.
 */
export function respuestaCheckin(c: CheckIn, habitos: string[] = [], eventos: EventoDelDia[] = []): string {
  const lineas = [evaluarBienestar(c)[0].titulo]
  const pendientes = habitos.filter(h => c.habitos?.[h] === false)
  if (pendientes.length) lineas.push(`Aún te queda ${unirY(pendientes)}. Si te da tiempo antes de la sesión, te ayudará.`)
  if (c.sesgo) {
    if (eventos.length) {
      const lista = unirY(eventos.map(e => `${e.titulo} a las ${e.hora}`))
      lineas.push(`Tu sesgo hoy es ${c.sesgo}. Hay ${lista}: anda con ojo, porque con las noticias el precio suele barrer liquidez en los dos sentidos antes de dar el movimiento real. Espera a que el mercado confirme tu idea; la decisión es tuya.`)
    } else {
      lineas.push(`Apuntado tu sesgo ${c.sesgo}. Hoy no hay datos fuertes; al cierre te cuento qué hizo el mercado.`)
    }
  }
  const faltan = [
    c.horasSueno === undefined && 'horas de sueño',
    c.entrenado === undefined && 'si has entrenado',
    c.animo === undefined && 'cómo te sientes',
    c.sesgo === undefined && 'tu sesgo de hoy',
    ...habitos.filter(h => c.habitos?.[h] === undefined).map(h => `si has hecho ${h}`),
  ].filter(Boolean)
  if (faltan.length) lineas.push(`Si quieres, dime también: ${faltan.join(', ')}.`)
  return lineas.join('\n')
}
