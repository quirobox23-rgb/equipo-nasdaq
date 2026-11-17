// Seguidor de noticias: filtra titulares que pueden mover el Nasdaq.
// Primero un filtro barato por palabras clave; si hay clave de Claude, un
// modelo rápido confirma el impacto y lo resume en español.
import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.ts'
import type { Titular } from '../sources/rss.ts'
import type { Hallazgo, Nivel } from '../tipos.ts'

import { EQUIPOS, type DefinicionEquipo } from './definiciones.ts'

export function puntuar(t: Titular, reglas: [RegExp, number][] = EQUIPOS.nasdaq.reglasNoticias): number {
  const txt = `${t.titulo} ${t.resumen ?? ''}`
  return reglas.reduce((s, [re, p]) => s + (re.test(txt) ? p : 0), 0)
}

export function candidatos(titulares: Titular[], ahora: Date, vistos: Set<string>, ventanaMin = 60, umbral = 3, reglas = EQUIPOS.nasdaq.reglasNoticias): Titular[] {
  const desde = ahora.getTime() - ventanaMin * 60_000
  const unicos = new Map<string, Titular>()
  for (const t of titulares) {
    const id = t.enlace || t.titulo
    if (vistos.has(id) || t.fecha.getTime() < desde || t.fecha > ahora) continue
    if (puntuar(t, reglas) >= umbral) unicos.set(id, t)
  }
  return [...unicos.values()].sort((a, b) => puntuar(b, reglas) - puntuar(a, reglas)).slice(0, 8)
}

interface Valoracion { indice: number; impacto: 'alto' | 'medio' | 'bajo'; resumen: string }

async function valorarConClaude(lista: Titular[], activo: string): Promise<Valoracion[] | null> {
  if (!config.anthropicKey) return null
  const client = new Anthropic({ apiKey: config.anthropicKey })
  const prompt = lista.map((t, i) => `${i}. [${t.fuente}] ${t.titulo}${t.resumen ? ` — ${t.resumen}` : ''}`).join('\n')
  try {
    const r = await client.messages.create({
      model: config.modeloFiltro,
      max_tokens: 800,
      system: `Valoras titulares para una trader de futuros de ${activo}. Para cada titular di si puede mover ${activo} en las próximas horas (alto, medio o bajo) y resúmelo en una frase en español de España. No des recomendaciones de compra o venta. Responde solo con JSON: [{"indice":0,"impacto":"alto","resumen":"..."}].`,
      messages: [{ role: 'user', content: prompt }],
    })
    const txt = r.content.map(b => (b.type === 'text' ? b.text : '')).join('')
    const json = txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1)
    return JSON.parse(json) as Valoracion[]
  } catch (e) {
    console.error('[noticias] Claude no pudo valorar los titulares:', e)
    return null
  }
}

export async function analizarNoticias(titulares: Titular[], ahora: Date, vistos: Set<string>, ventanaMin = 60, eq: DefinicionEquipo = EQUIPOS.nasdaq): Promise<{ hallazgos: Hallazgo[]; revisados: string[] }> {
  const lista = candidatos(titulares, ahora, vistos, ventanaMin, 3, eq.reglasNoticias)
  const revisados = lista.map(t => t.enlace || t.titulo)
  if (lista.length === 0) return { hallazgos: [], revisados }

  const valoraciones = await valorarConClaude(lista, eq.nombre)
  const hallazgos: Hallazgo[] = []
  lista.forEach((t, i) => {
    const v = valoraciones?.find(x => x.indice === i)
    let nivel: Nivel
    let titulo: string
    if (v) {
      if (v.impacto === 'bajo') return
      nivel = v.impacto === 'alto' ? 'alerta' : 'atencion'
      titulo = v.resumen
    } else {
      const p = puntuar(t, eq.reglasNoticias)
      nivel = p >= 6 ? 'alerta' : 'atencion'
      titulo = t.titulo
    }
    hallazgos.push({ agente: 'noticias', nivel, titulo, detalle: `${t.fuente}${t.enlace ? ` · ${t.enlace}` : ''}`, clave: `${eq.id}:noticia:${t.enlace || t.titulo}` })
  })
  return { hallazgos, revisados }
}
