// weekSnapshot.ts — A. Copia guardada de cada semana de noticias.
//
// Forex Factory solo publica la semana en curso: cuando cambia de semana, la
// anterior desaparece. Para no perderla, el servidor guarda una copia en
// Firestore (`contenido/noticias-semana-<lunes>`) cada vez que la carga, con
// los datos reales que se vayan rellenando. El servidor de Hostinger no deja
// guardar archivos, por eso va a Firestore, como el Análisis Semanal.
//
// Para escribir, el servidor entra con una cuenta "robot" del equipo
// (alumnos/{uid}.nivel == "admin"), así valen las reglas que ya existen para
// `contenido`. Variables de entorno (en Hostinger, develop y main):
//   NOTICIAS_ROBOT_EMAIL
//   NOTICIAS_ROBOT_PASSWORD
// Sin ellas, todo sigue funcionando como antes, solo que sin guardar copias.

import type { WeekEvent } from './forexFactory'

const DOC_PREFIX = 'noticias-semana-'

let cachedToken: { token: string; expires: number } | null = null

async function robotToken(): Promise<string | null> {
  const email = process.env.NOTICIAS_ROBOT_EMAIL
  const password = process.env.NOTICIAS_ROBOT_PASSWORD
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!email || !password || !apiKey) return null
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[noticias] El robot no pudo iniciar sesión en Firebase:', res.status)
      return null
    }
    const data = await res.json()
    cachedToken = { token: data.idToken, expires: Date.now() + Number(data.expiresIn ?? 3600) * 1000 }
    return cachedToken.token
  } catch {
    return null
  }
}

function docUrl(monday: string): string | null {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!projectId) return null
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/contenido/${DOC_PREFIX}${monday}`
}

// Memoria del proceso: evita leer Firestore en cada visita y reescribir lo mismo.
const memory = new Map<string, { json: string; at: number }>()
const MEMORY_MS = 5 * 60 * 1000

export function snapshotsEnabled(): boolean {
  return !!(process.env.NOTICIAS_ROBOT_EMAIL && process.env.NOTICIAS_ROBOT_PASSWORD)
}

/** Semana guardada, o null si no hay copia (o no hay robot configurado). */
export async function readWeekSnapshot(monday: string): Promise<WeekEvent[] | null> {
  const hit = memory.get(monday)
  if (hit && Date.now() - hit.at < MEMORY_MS) return JSON.parse(hit.json)
  const url = docUrl(monday)
  const token = await robotToken()
  if (!url || !token) return null
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (res.status === 404) { memory.set(monday, { json: '[]', at: Date.now() }); return [] }
    if (!res.ok) return null
    const json: string | undefined = (await res.json()).fields?.eventos?.stringValue
    if (!json) return []
    memory.set(monday, { json, at: Date.now() })
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** Guarda la semana si cambió respecto a la última copia conocida. */
export async function writeWeekSnapshot(monday: string, events: WeekEvent[]): Promise<boolean> {
  if (events.length === 0) return false
  const json = JSON.stringify(events)
  if (memory.get(monday)?.json === json) return true
  const url = docUrl(monday)
  const token = await robotToken()
  if (!url || !token) return false
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          eventos: { stringValue: json },
          lunes: { stringValue: monday },
          actualizado: { timestampValue: new Date().toISOString() },
        },
      }),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[noticias] No se pudo guardar la semana', monday, res.status)
      return false
    }
    memory.set(monday, { json, at: Date.now() })
    return true
  } catch {
    return false
  }
}

const keyOf = (e: WeekEvent) => `${e.date}|${e.name}`

/** Forex Factory + copia guardada: FF manda, pero se conserva el `actual` ya guardado. */
export function mergeWithSnapshot(ff: WeekEvent[], saved: WeekEvent[] | null): WeekEvent[] {
  if (!saved?.length) return ff
  const savedByKey = new Map(saved.map(e => [keyOf(e), e]))
  return ff.map(e => {
    const s = savedByKey.get(keyOf(e))
    return s && (e.actual == null || e.actual === '') && s.actual != null && s.actual !== ''
      ? { ...e, actual: s.actual }
      : e
  })
}
