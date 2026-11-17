import { NextResponse } from 'next/server'

// /api/geopolitics — titulares reales por región (GNews) + interpretación
// de riesgo real vía Claude (misma ANTHROPIC_API_KEY que ya usa
// /api/analysis para el Mentor IA por evento — llamada independiente,
// no pasa por Python).
//
// Si no hay ANTHROPIC_API_KEY, o la llamada falla, o no hay créditos:
// `ai_summary.available = false` y el frontend cae a la frase compuesta
// de siempre ("hay actividad en X de 3 regiones...") — nunca se rompe la
// página por esto, igual que el resto del proyecto.

interface RegionQuery { region: string; flag: string; query: string }

const REGIONS: RegionQuery[] = [
  { region: 'Estados Unidos', flag: '🇺🇸', query: 'Federal Reserve OR US economy' },
  { region: 'Europa',         flag: '🇪🇺', query: 'European Central Bank OR Eurozone economy' },
  { region: 'Asia',           flag: '🌏', query: 'China economy OR Bank of Japan OR Asia markets' },
]

const GNEWS_URL = 'https://gnews.io/api/v4/search'
const DELAY_BETWEEN_REQUESTS_MS = 1200
const MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 1500

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'

interface Headline { title: string; description: string; url: string; publishedAt: string; source: string }

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchRegionHeadlines(query: string): Promise<{ available: boolean; headlines: Headline[]; error?: string }> {
  const apiKey = process.env.GNEWS_API_KEY
  if (!apiKey) return { available: false, headlines: [], error: 'GNEWS_API_KEY no configurada' }

  const url = `${GNEWS_URL}?q=${encodeURIComponent(query)}&lang=en&max=3&apikey=${apiKey}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.status === 429) {
        if (attempt < MAX_RETRIES) { await sleep(RETRY_BASE_DELAY_MS * (attempt + 1)); continue }
        return { available: false, headlines: [], error: 'HTTP 429 tras reintentos' }
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return { available: false, headlines: [], error: `HTTP ${res.status}: ${body.slice(0, 200)}` }
      }
      const data = await res.json()
      const articles: Array<{ title: string; description: string; url: string; publishedAt: string; source?: { name?: string } }> = data.articles ?? []
      return {
        available: articles.length > 0,
        headlines: articles.map(a => ({ title: a.title, description: a.description, url: a.url, publishedAt: a.publishedAt, source: a.source?.name ?? '' })),
      }
    } catch (e) {
      if (attempt < MAX_RETRIES) { await sleep(RETRY_BASE_DELAY_MS * (attempt + 1)); continue }
      return { available: false, headlines: [], error: e instanceof Error ? e.message : String(e) }
    }
  }
  return { available: false, headlines: [], error: 'Agotados los reintentos' }
}

interface AiSummary {
  available: boolean
  nivel_riesgo_global?: 'Alto' | 'Medio' | 'Bajo'
  resumen?: string
  region_mas_relevante?: string
  activos_afectados?: string[]
  error?: string
}

function buildPrompt(regions: Array<{ region: string; headlines: Headline[] }>): string {
  const blocks = regions
    .filter(r => r.headlines.length > 0)
    .map(r => `TITULARES ${r.region.toUpperCase()}:\n${r.headlines.map(h => `- ${h.title} (${h.source})`).join('\n')}`)
    .join('\n\n')

  return `Eres un analista de riesgo geopolítico institucional. Analiza estos titulares reales de las últimas horas y evalúa su impacto en mercados financieros (Nasdaq, USD, oro, petróleo).

${blocks}

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{
  "nivel_riesgo_global": "Alto" | "Medio" | "Bajo",
  "resumen": "2-3 frases explicando el porqué, basadas SOLO en los titulares de arriba",
  "region_mas_relevante": "el nombre de la región con más impacto potencial",
  "activos_afectados": ["lista corta de activos, ej: USD, Oro, Petróleo, Nasdaq"]
}`
}

function extractJson(raw: string): Record<string, unknown> {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim()
  }
  return JSON.parse(text)
}

async function generateAiSummary(regions: Array<{ region: string; headlines: Headline[] }>): Promise<AiSummary> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { available: false, error: 'ANTHROPIC_API_KEY no configurada' }

  const totalHeadlines = regions.reduce((n, r) => n + r.headlines.length, 0)
  if (totalHeadlines === 0) return { available: false, error: 'Sin titulares para analizar' }

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 500,
        messages: [{ role: 'user', content: buildPrompt(regions) }],
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { available: false, error: `Anthropic HTTP ${res.status}: ${body.slice(0, 200)}` }
    }

    const data = await res.json()
    const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text')
    if (!textBlock?.text) return { available: false, error: 'Respuesta de Claude sin texto' }

    const parsed = extractJson(textBlock.text) as {
      nivel_riesgo_global?: 'Alto' | 'Medio' | 'Bajo'
      resumen?: string
      region_mas_relevante?: string
      activos_afectados?: string[]
    }

    return { available: true, ...parsed }
  } catch (e) {
    return { available: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET() {
  const results: Array<{ region: string; flag: string; available: boolean; headlines: Headline[]; error?: string }> = []

  for (const r of REGIONS) {
    const data = await fetchRegionHeadlines(r.query)
    results.push({ region: r.region, flag: r.flag, ...data })
    await sleep(DELAY_BETWEEN_REQUESTS_MS)
  }

  const aiSummary = await generateAiSummary(results.map(r => ({ region: r.region, headlines: r.headlines })))

  return NextResponse.json({
    available: results.some(r => r.available),
    regions: results,
    ai_summary: aiSummary,
  })
}
