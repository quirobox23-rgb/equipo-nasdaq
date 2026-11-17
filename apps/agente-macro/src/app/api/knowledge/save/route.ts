import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// /api/knowledge/save — KnowledgeBase.ts llama aquí (sin bloquear la UI)
// cada vez que guardas una ficha en el editor. Se escriben todas las
// fichas editadas por el usuario en UN solo archivo (overrides.json),
// separado de los 10 archivos semilla (cpi.json, fomc.json...) para no
// tener que decidir a qué archivo semilla pertenece cada slug nuevo — el
// archivo de overrides puede contener fichas que no existían en la
// semilla (eventos nuevos que hayas creado tú).

const OVERRIDES_PATH = path.join(process.cwd(), 'src', 'data', 'knowledge', '_overrides.json')

interface KnowledgeEntry {
  slug: string
  name: string
  [key: string]: unknown
}

export async function POST(req: Request) {
  let entry: KnowledgeEntry
  try {
    entry = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  if (!entry.slug || !entry.name) {
    return NextResponse.json({ ok: false, error: 'Se requieren slug y name' }, { status: 400 })
  }

  let overrides: Record<string, KnowledgeEntry> = {}
  try {
    const content = await fs.readFile(OVERRIDES_PATH, 'utf-8')
    overrides = JSON.parse(content)
  } catch {
    // El archivo no existe todavía — se crea con el primer guardado.
  }

  overrides[entry.slug] = entry

  try {
    await fs.writeFile(OVERRIDES_PATH, JSON.stringify(overrides, null, 2), 'utf-8')
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, slug: entry.slug })
}
