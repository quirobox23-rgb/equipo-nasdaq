import { NextResponse } from 'next/server'
import { isValidAdminPassword, getAdminPasswordFromRequest } from '@/lib/adminAuth'
import { redisGet } from '@/lib/redis'

// /api/nova/latest — lee el último briefing generado, sin llamar a Python
// ni gastar créditos. También protegida con la clave compartida: los
// alumnos no pueden ni generar NI ver el contenido de Mentor IA todavía
// (es valor exclusivo de la academia, según se decidió) — solo saben que
// la sección existe.

const STORAGE_KEY = 'nova:weekly-briefing:latest'

export async function GET(req: Request) {
  const password = getAdminPasswordFromRequest(req)
  if (!isValidAdminPassword(password)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const data = await redisGet<Record<string, unknown>>(STORAGE_KEY)
  if (!data) {
    return NextResponse.json({ available: false })
  }

  return NextResponse.json({ available: true, ...data })
}
