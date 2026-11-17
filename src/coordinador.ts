// Jefe de oficina: junta lo que dicen los agentes, pone el semáforo y
// escribe el mensaje de WhatsApp. Nunca da señales de entrada.
import Anthropic from '@anthropic-ai/sdk'
import { config } from './config.ts'
import type { Hallazgo, Semaforo } from './tipos.ts'

export type TipoMensaje = 'guia' | 'apertura' | 'aviso' | 'cierre' | 'semanal'

/** El semáforo mide RIESGO: los avisos de tu estrategia no lo cambian. */
export function semaforo(h: Hallazgo[]): Semaforo {
  const riesgo = h.filter(x => !x.estrategia)
  if (riesgo.some(x => x.nivel === 'alerta')) return 'rojo'
  if (riesgo.some(x => x.nivel === 'atencion')) return 'ambar'
  return 'verde'
}

const EMOJI: Record<Semaforo, string> = { verde: '🟢', ambar: '🟠', rojo: '🔴' }
const NOMBRE_AGENTE: Record<Hallazgo['agente'], string> = {
  macro: 'Macro', fed: 'Fed', earnings: 'Resultados', noticias: 'Noticias', grafico: 'Rango', estructura: 'Estructura', volumen: 'Volumen',
  volatilidad: 'Volatilidad y rango', bienestar: 'Coach', cuentas: 'Gestor de cuentas',
}
const TITULO: Record<TipoMensaje, string> = {
  guia: 'Guía del día', apertura: 'Antes de la apertura', aviso: 'Aviso', cierre: 'Cierre del día', semanal: 'Resumen semanal',
}

/** Frases que serían una señal de trading. Si el texto de la IA las trae, se usa la plantilla. */
const SENALES = /\b(compra|vende|ponte (largo|corto)|entra(r)? en (largo|corto)|abre (un )?(largo|corto)|stop loss en|take profit en|objetivo de precio)\b/i

export function pareceSenal(texto: string): boolean {
  return SENALES.test(texto)
}

export function plantilla(tipo: TipoMensaje, h: Hallazgo[], extra: string[] = [], equipo?: string): string {
  const s = semaforo(h)
  const lineas = [`${EMOJI[s]} *ENTROPIA · ${equipo ? `${equipo.toUpperCase()} · ` : ''}${TITULO[tipo]}*`]
  const orden = { alerta: 0, atencion: 1, info: 2 } as const
  const estrategia = h.filter(x => x.estrategia)
  for (const x of estrategia) {
    lineas.push(`📍 _Tu estrategia_: ${x.titulo}${x.detalle ? ` ${x.detalle}` : ''}`)
  }
  for (const x of h.filter(x => !x.estrategia).sort((a, b) => orden[a.nivel] - orden[b.nivel])) {
    const marca = x.nivel === 'alerta' ? '⚠️' : x.nivel === 'atencion' ? '👀' : '•'
    lineas.push(`${marca} _${NOMBRE_AGENTE[x.agente]}_: ${x.titulo}${x.detalle && x.agente !== 'noticias' ? ` ${x.detalle}` : ''}`)
  }
  lineas.push(...extra)
  return lineas.join('\n')
}

const SISTEMA = `Eres la coordinadora de Entropia, un equipo de agentes de IA que acompaña a lola, trader de futuros con cuentas de fondeo.
Tu trabajo es darle contexto y avisos de riesgo por WhatsApp, nunca señales.
Reglas:
- Escribe en español de España, cercano y tranquilo, como una compañera de mesa. Trata a lola de tú.
- NUNCA digas que compre, venda, entre en largo o corto, ni des precios de entrada, stop u objetivo.
- Sí puedes decir "no operes ahora", "espera a que pase el dato", "reduce tamaño" o "hoy mejor no operar".
- Los hallazgos marcados ESTRATEGIA describen en qué fase está el escenario que lola espera (por ejemplo, barrido del mínimo de Asia). Ponlos primero con 📍, describe la situación y lo que falta por confirmar, y termina con "La decisión es tuya". No los conviertas en una orden.
- El semáforo mide riesgo de mercado y de lola, no oportunidades.
- Usa solo los datos que te paso. No inventes cifras, horas ni noticias.
- Formato WhatsApp: *negrita* y saltos de línea, sin títulos de Markdown. Empieza con el emoji del semáforo que te paso y la cabecera "ENTROPIA".
- Los bloques que empiezan por 🧭 (Daily Trading Readiness) cópialos tal cual: son cálculos, no los cambies.
- Breve: un aviso cabe en 2-4 líneas; la guía y los resúmenes en 12-18 líneas.`

/** `contexto` va en el mensaje tal cual si no hay IA; `paraIA` solo lo ve Claude (instrucciones o datos largos). */
export async function redactar(tipo: TipoMensaje, h: Hallazgo[], contexto: string[] = [], paraIA: string[] = [], equipo?: string): Promise<string> {
  const base = plantilla(tipo, h, contexto, equipo)
  if (!config.anthropicKey) return base
  const s = semaforo(h)
  const datos = [
    `Tipo de mensaje: ${TITULO[tipo]}${equipo ? ` del equipo ${equipo}` : ''}`,
    `Semáforo: ${EMOJI[s]} ${s}`,
    'Hallazgos de los agentes:',
    ...h.map(x => `- [${x.estrategia ? 'ESTRATEGIA ' : ''}${x.agente}/${x.nivel}] ${x.titulo}${x.detalle ? ` (${x.detalle})` : ''}`),
    ...(contexto.length ? ['Contexto adicional:', ...contexto] : []),
    ...(paraIA.length ? ['Indicaciones:', ...paraIA] : []),
  ].join('\n')
  try {
    const client = new Anthropic({ apiKey: config.anthropicKey })
    const r = await client.messages.create({
      model: config.modeloRedactor,
      max_tokens: 1200,
      system: SISTEMA,
      messages: [{ role: 'user', content: datos }],
    })
    const texto = r.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!texto || pareceSenal(texto)) return base
    return texto
  } catch (e) {
    console.error('[jefe] No se pudo redactar con Claude, uso la plantilla:', e)
    return base
  }
}
