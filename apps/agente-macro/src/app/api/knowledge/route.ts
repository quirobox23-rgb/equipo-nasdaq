
import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// /api/knowledge — sirve la Knowledge Base completa (los 10 archivos
// semilla + las fichas que hayas editado/creado desde /terminal, que
// viven en _overrides.json) para que Nova Macro (Python) pueda usarla al
// generar el briefing semanal — antes solo la veía el Mentor IA por
// evento, que corre en el navegador y lee localStorage directamente.
//
// Se leen los archivos del disco EN CADA PETICIÓN (no import estático),
// mismo motivo que /api/calendar: que refleje siempre lo último guardado.

const KNOWLEDGE_DIR = path.join(process.cwd(), 'src', 'data', 'knowledge')
const SEED_FILES = [
  'cpi.json', 'ppi.json', 'nfp.json', 'retail-sales.json', 'earnings.json',
  'durable-goods.json', 'fomc.json', 'gdp.json', 'core-pce.json', 'consumer-confidence.json',
]
const OVERRIDES_FILE = '_overrides.json'

interface KnowledgeEntry {
  slug: string
  name: string
  [key: string]: unknown
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function readJsonSafe(filename: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await fs.readFile(path.join(KNOWLEDGE_DIR, filename), 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function GET() {
  const entries = new Map<string, KnowledgeEntry>()

  for (const filename of SEED_FILES) {
    const data = await readJsonSafe(filename)
    if (data && typeof data.name === 'string') {
      const slug = slugify(data.name)
      entries.set(slug, { ...data, slug, name: data.name } as KnowledgeEntry)
    }
  }

  const overrides = await readJsonSafe(OVERRIDES_FILE)
  if (overrides) {
    Object.values(overrides).forEach(raw => {
      const entry = raw as KnowledgeEntry
      if (entry?.slug && entry?.name) entries.set(entry.slug, entry)
    })
  }

  return NextResponse.json({ entries: [...entries.values()] })
}
