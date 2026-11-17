// Asesora personal: pregunta cómo estás y traduce tu estado en una nota de
// "aptitud para operar". Los campos del reloj (VFC, pulso en reposo, estrés)
// ya están en la ficha; hoy se rellenan a mano y mañana desde el wearable.
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
  // Del reloj (futuro)
  vfc?: number                  // variabilidad de la frecuencia cardiaca, ms
  vfcMedia?: number             // tu media de referencia
  pulsoReposo?: number
  pulsoReposoMedio?: number
  estres?: number               // 0-100
}

export const PREGUNTA_CHECKIN =
  '¿Cómo estás hoy? Cuéntame en una línea: cuántas horas has dormido, si has entrenado y cómo te sientes (por ejemplo: "7h, sí, tranquila").'

const EMOCIONES: [RegExp, string, number][] = [
  [/\b(genial|muy bien|estupend[ao]|con energ[ií]a|motivad[ao])\b/i, 'con energía', 5],
  [/\b(tranquil[ao]|bien|centrad[ao]|serena?|en calma)\b/i, 'tranquila', 4],
  [/\b(normal|regular|así así|asi asi)\b/i, 'normal', 3],
  [/\b(cansad[ao]|agotad[ao]|sin energ[ií]a|dormid[ao])\b/i, 'cansada', 2],
  [/\b(nervios[ao]|ansios[ao]|estresad[ao]|agobiad[ao]|irritad[ao]|enfadad[ao]|triste|mal)\b/i, 'nerviosa', 2],
  [/\b(fatal|horrible|fatal|hecha polvo|destrozad[ao])\b/i, 'fatal', 1],
  [/\b(revancha|recuperar lo perdido|tengo que ganar)\b/i, 'ganas de revancha', 1],
]

export function interpretarRespuesta(texto: string, fecha: string): CheckIn {
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
