import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { isValidAdminPassword, getAdminPasswordFromRequest } from '@/lib/adminAuth'

// /api/calendar/save — EventProvider.ts llama aquí cada vez que
// añades/editas/borras/duplicas/mueves un evento en /terminal.
//
// PROTEGIDA con la clave compartida: /terminal es público (cualquiera
// puede verlo y "editar" en su propio navegador), pero solo esta ruta
// escribe al archivo real que ven TODOS — sin esta protección, cualquier
// visitante podría sobrescribir el calendario compartido. Sin la clave,
// el cambio se queda únicamente en el localStorage de esa persona (no
// afecta a nadie más) y se pierde al recargar la página.

const WEEK_FILE_NAMES: Record<string, string> = {
  '2026-07-27': 'week_2026_31.json',
}

interface IncomingEvent {
  date?: string
  time?: string
  name: string
  impact?: 'high' | 'med' | 'low'
  affects?: string[]
  forecast?: string | number | null
  actual?: string | number | null
  prev?: string | number | null
  direction?: string
  currency?: string
  country?: string
  type?: string
}

export async function POST(req: Request) {
  const password = getAdminPasswordFromRequest(req)
  if (!isValidAdminPassword(password)) {
    // Fallo silencioso a propósito, igual que ya hacía EventProvider.ts al
    // llamar aquí: el usuario sin clave no ve ningún error molesto, su
    // cambio simplemente no se guarda en el servidor (sigue en su
    // localStorage local, sin afectar a los demás).
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  let body: { monday?: string; events?: IncomingEvent[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { monday, events } = body
  if (!monday || !Array.isArray(events)) {
    return NextResponse.json({ ok: false, error: 'Se requieren monday (YYYY-MM-DD) y events[]' }, { status: 400 })
  }

  const filename = WEEK_FILE_NAMES[monday] ?? `week_${monday}.json`

  const raw = events.map(e => ({
    date: e.date ?? monday,
    time: e.time,
    country: e.country,
    currency: e.currency,
    name: e.name,
    impact: e.impact ?? 'med',
    prev: e.prev ?? null,
    forecast: e.forecast ?? null,
    actual: e.actual ?? null,
    type: e.type ?? 'macro',
    affects: e.affects,
  }))

  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'weeks', filename)
    await fs.writeFile(filePath, JSON.stringify(raw, null, 2), 'utf-8')
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, filename })
}
