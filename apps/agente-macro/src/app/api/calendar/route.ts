import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getThisWeekMonFri } from '@/lib/earnings'
import { loadAutoWeek } from '@/lib/weekSource'

// /api/calendar — sirve el calendario semanal en JSON plano, para que Nova
// Intelligence (Python) lo consuma vía HTTP.
//
// ARREGLO (11 ago 2026): antes esta ruta SOLO encontraba una semana si
// estaba registrada a mano en WEEK_FILE_NAMES — pero /api/calendar/save
// puede crear un archivo `week_<monday>.json` para una semana nueva sin
// tocar ese registro, así que esta ruta se quedaba sin saber que existía.
// Ahora, si `monday` no está en el registro, se prueba directamente el
// nombre `week_<monday>.json` en disco antes de rendirse — así cualquier
// semana que guardes desde /terminal aparece aquí automáticamente, sin
// tener que editar ningún registro. WEEK_FILE_NAMES sigue existiendo solo
// para los archivos con un nombre "bonito" distinto (como week_2026_31.json).
//
// GET /api/calendar                    → semana actual (lunes de hoy)
// GET /api/calendar?week=YYYY-MM-DD     → semana concreta (el lunes de esa semana)

interface RawWeekEvent {
  date: string
  time?: string
  name: string
  impact?: 'high' | 'med' | 'low'
  type?: string
}

// Solo para archivos con nombre distinto al patrón por defecto — añadir una
// línea aquí es opcional, no obligatorio (ver arreglo arriba).
const WEEK_FILE_NAMES: Record<string, string> = {
  '2026-07-27': 'week_2026_31.json',
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const IMPORTANCE: Record<string, number> = { high: 5, med: 3, low: 1 }

function earningsLabel(name: string): string {
  return name.replace(/\s*Earnings\s*$/i, '')
}

async function readWeekFile(monday: string): Promise<RawWeekEvent[] | null> {
  const candidates = [
    WEEK_FILE_NAMES[monday],
    `week_${monday}.json`, // el mismo patrón que usa /api/calendar/save por defecto
  ].filter(Boolean) as string[]

  for (const filename of candidates) {
    try {
      const filePath = path.join(process.cwd(), 'src', 'data', 'weeks', filename)
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      continue // prueba el siguiente candidato
    }
  }
  return null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const weekParam = searchParams.get('week')
  const monday = weekParam ?? getThisWeekMonFri().from

  // Sin archivo de semana: Forex Factory, copia guardada o calendario de FRED.
  const fromFile = await readWeekFile(monday)
  const raw: RawWeekEvent[] = fromFile && fromFile.length > 0 ? fromFile : (await loadAutoWeek(monday)).events

  if (raw.length === 0) {
    return NextResponse.json({
      available: false,
      week_dates: null,
      events: [],
      message: `No hay calendario cargado para la semana del ${monday}. Prepáralo en src/data/weeks/ o desde /terminal.`,
    })
  }

  const mondayDate = new Date(`${monday}T00:00:00`)
  const fridayDate = new Date(mondayDate)
  fridayDate.setDate(mondayDate.getDate() + 4)
  const week_dates = `${mondayDate.getDate()}-${fridayDate.getDate()} ${fridayDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`

  const earningsByDate = new Map<string, string[]>()
  raw.filter(e => e.type === 'earnings').forEach(e => {
    const list = earningsByDate.get(e.date) ?? []
    list.push(earningsLabel(e.name))
    earningsByDate.set(e.date, list)
  })

  const macroEvents = raw.filter(e => e.type !== 'earnings')
  const eventsToShow = macroEvents.length > 0 ? macroEvents : raw

  const events = eventsToShow.map(e => {
    const d = new Date(`${e.date}T00:00:00`)
    return {
      day: DAY_NAMES[d.getDay()],
      event_name: e.name,
      importance: IMPORTANCE[e.impact ?? 'med'],
      earnings: (earningsByDate.get(e.date) ?? []).join(', ') || null,
    }
  })

  return NextResponse.json({ available: true, week_dates, events })
}
