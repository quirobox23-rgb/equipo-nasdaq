import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isAdminRequest } from '@/lib/adminAuth'
import { getWeeklyData } from '@/lib/weekly/data'
import { generateAnalysis } from '@/lib/weekly/generate'
import { targetMonday } from '@/lib/weekly/dates'
import type { Level } from '@/lib/weekly/types'

// /api/weekly — Análisis Semanal de NQ.
//
// POST { action: 'prepare', monday? }  → datos de la semana + niveles propuestos (equipo)
// POST { action: 'generate', monday, levels, notas } → genera el borrador con una llamada a Claude (equipo)
//
// El borrador y el análisis publicado se guardan en Firestore desde el
// navegador del equipo (src/lib/contenido.ts): Hostinger no deja guardar archivos.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isLevels(v: unknown): v is Level[] {
  return Array.isArray(v) && v.every(l => l && typeof l.zona === 'string' && typeof l.lectura === 'string')
}

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Solo el equipo puede preparar el análisis. Volvé a iniciar sesión.' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const monday = typeof body.monday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.monday) ? body.monday : targetMonday()

  if (body.action === 'prepare') {
    return NextResponse.json({ data: await getWeeklyData(monday) })
  }

  if (body.action === 'generate') {
    if (!isLevels(body.levels) || body.levels.length === 0) {
      return NextResponse.json({ error: 'Faltan los niveles de NQ.' }, { status: 400 })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Falta ANTHROPIC_API_KEY en el servidor.' }, { status: 503 })
    }
    try {
      const data = await getWeeklyData(monday)
      const draft = await generateAnalysis(data, body.levels, typeof body.notas === 'string' ? body.notas : '')
      return NextResponse.json({ draft })
    } catch (err) {
      console.error('[weekly] Error generando el análisis:', err)
      const message = err instanceof Anthropic.APIError
        ? `Error de la IA (${err.status ?? 'sin código'}): ${err.message}`
        : err instanceof Error ? err.message : 'No se pudo generar el análisis.'
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
