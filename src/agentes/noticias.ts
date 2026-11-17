// Seguidor de noticias: filtra titulares que pueden mover el Nasdaq.
// Primero un filtro barato por palabras clave; si hay clave de Claude, un
// modelo rápido confirma el impacto y lo resume en español.
import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.ts'
import type { Titular } from '../sources/rss.ts'
import type { Hallazgo, Nivel } from '../tipos.ts'

const REGLAS: [RegExp, number][] = [
  [/\b(Warsh|Powell|Fed Chair|FOMC|Federal Reserve|the Fed)\b/i, 3],
  [/\b(rate (cut|hike)|interest rates?|emergency|inter-meeting)\b/i, 2],
  [/\b(tariffs?|export (controls|ban)|sanctions?|trade war)\b/i, 3],
  [/\b(Nvidia|NVDA|Apple|Microsoft|Amazon|Alphabet|Google|Meta|Tesla|Broadcom|TSMC|semiconductors?|chips?)\b/i, 2],
  [/\b(China|Taiwan|Iran|Russia|war|missile|attack|invasion)\b/i, 2],
  [/\b(shutdown|default|debt ceiling|downgrade|bank (run|failure)|crash|plunge|sell-?off|halt(ed)?)\b/i, 3],
  [/\b(CPI|inflation|jobs report|payrolls|unemployment|GDP|recession)\b/i, 2],
  [/\b(Trump|White House|Treasury|Bessent)\b/i, 1],
  [/\b(Nasdaq|tech stocks|S&P 500|Wall Street|futures)\b/i, 1],
]

export function puntuar(t: Titular): number {
  const txt = `${t.titulo} ${t.resumen ?? ''}`
  return REGLAS.reduce((s, [re, p]) => s + (re.test(txt) ? p : 0), 0)
}

export function candidatos(titulares: Titular[], ahora: Date, vistos: Set<string>, ventanaMin = 60, umbral = 3): Titular[] {
  const desde = ahora.getTime() - ventanaMin * 60_000
  const unicos = new Map<string, Titular>()
  for (const t of titulares) {
    const id = t.enlace || t.titulo
    if (vistos.has(id) || t.fecha.getTime() < desde || t.fecha > ahora) continue
    if (puntuar(t) >= umbral) unicos.set(id, t)
  }
  return [...unicos.values()].sort((a, b) => puntuar(b) - puntuar(a)).slice(0, 8)
}

interface Valoracion { indice: number; impacto: 'alto' | 'medio' | 'bajo'; resumen: string }

async function valorarConClaude(lista: Titular[]): Promise<Valoracion[] | null> {
  if (!config.anthropicKey) return null
  const client = new Anthropic({ apiKey: config.anthropicKey })
  const prompt = lista.map((t, i) => `${i}. [${t.fuente}] ${t.titulo}${t.resumen ? ` — ${t.resumen}` : ''}`).join('\n')
  try {
    const r = await client.messages.create({
      model: config.modeloFiltro,
      max_tokens: 800,
      system: 'Valoras titulares para una trader de futuros del Nasdaq 100. Para cada titular di si puede mover el Nasdaq en las próximas horas (alto, medio o bajo) y resúmelo en una frase en español de España. No des recomendaciones de compra o venta. Responde solo con JSON: [{"indice":0,"impacto":"alto","resumen":"..."}].',
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

export async function analizarNoticias(titulares: Titular[], ahora: Date, vistos: Set<string>, ventanaMin = 60): Promise<{ hallazgos: Hallazgo[]; revisados: string[] }> {
  const lista = candidatos(titulares, ahora, vistos, ventanaMin)
  const revisados = lista.map(t => t.enlace || t.titulo)
  if (lista.length === 0) return { hallazgos: [], revisados }

  const valoraciones = await valorarConClaude(lista)
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
      const p = puntuar(t)
      nivel = p >= 6 ? 'alerta' : 'atencion'
      titulo = t.titulo
    }
    hallazgos.push({ agente: 'noticias', nivel, titulo, detalle: `${t.fuente}${t.enlace ? ` · ${t.enlace}` : ''}`, clave: `noticia:${t.enlace || t.titulo}` })
  })
  return { hallazgos, revisados }
}
