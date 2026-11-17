import { XMLParser } from 'fast-xml-parser'
import { getTexto } from './http.ts'

export interface Titular { titulo: string; enlace: string; fecha: Date; fuente: string; resumen?: string }

const parser = new XMLParser({ ignoreAttributes: false })

function texto(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)['#text'])
  return ''
}

export function parsearRss(xml: string, fuente: string): Titular[] {
  const doc = parser.parse(xml)
  const items: unknown[] = [].concat(doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.['rdf:RDF']?.item ?? [])
  const out: Titular[] = []
  for (const raw of items) {
    const it = raw as Record<string, unknown>
    const titulo = texto(it.title).trim()
    const link = it.link
    const enlace = typeof link === 'object' && link && '@_href' in link ? String((link as Record<string, unknown>)['@_href']) : texto(link)
    const fechaTxt = texto(it.pubDate ?? it.published ?? it.updated ?? it['dc:date'])
    const fecha = fechaTxt ? new Date(fechaTxt) : new Date(NaN)
    if (!titulo || Number.isNaN(fecha.getTime())) continue
    const resumen = texto(it.description ?? it.summary).replace(/<[^>]+>/g, '').trim().slice(0, 300) || undefined
    out.push({ titulo, enlace, fecha, fuente, resumen })
  }
  return out
}

export async function cargarTitulares(feeds: string[]): Promise<Titular[]> {
  const res = await Promise.allSettled(feeds.map(async url => parsearRss(await getTexto(url), new URL(url).hostname)))
  return res.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
}
