'use client'
import type { WeeklyAnalysis } from './types'

// Novedades del Análisis Semanal (mockup: docs/mockups/analisis-semanal-novedades.html).
//
// El analista marca qué cambió: publicar el análisis de la semana cuenta como uno
// nuevo (`publicadoEn`) y guardar un apartado con "Avisar a los alumnos" anota
// la hora en `novedades[apartado]`. Lo que ya vio cada alumno queda en SU
// navegador (localStorage): si lo vio en el celular, en la compu le sigue
// apareciendo hasta que entre ahí también. Las marcas duran 7 días.

const KEY = 'fm-analisis-visto'
const EVENT = 'fm-novedades'
const VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000

/** El apartado que siempre está arriba (no está en el índice). */
export const IDEA_CENTRAL = 'Idea central'

interface Visto {
  publicadoEn?: string               // el análisis que ya abrió
  bloques?: Record<string, string>   // apartado → cuándo lo abrió (ISO)
}

function read(): Visto {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Visto) : {}
  } catch {
    return {}
  }
}

function write(v: Visto) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch { /* navegador sin almacenamiento: las marcas siguen apareciendo, no se rompe nada */ }
  window.dispatchEvent(new Event(EVENT))
}

const vigente = (iso: string | undefined, now: number) => !!iso && now - Date.parse(iso) < VIGENCIA_MS

export interface Pendientes {
  /** Es un análisis nuevo que todavía no abrió (cuenta como 1). */
  nuevo: boolean
  /** Apartados que cambiaron y todavía no abrió (vacío si `nuevo`). */
  bloques: string[]
  total: number
}

export function pendientes(a: WeeklyAnalysis, now = Date.now()): Pendientes {
  const v = read()
  const nuevo = vigente(a.publicadoEn, now) && v.publicadoEn !== a.publicadoEn
  const bloques = nuevo ? [] : Object.entries(a.novedades ?? {})
    .filter(([b, t]) => vigente(t, now) && (!v.bloques?.[b] || v.bloques[b] < t))
    .map(([b]) => b)
  return { nuevo, bloques, total: (nuevo ? 1 : 0) + bloques.length }
}

/** Al entrar a Análisis Semanal: el análisis y la idea central quedan vistos. */
export function marcarAnalisisVisto(a: WeeklyAnalysis) {
  const v = read()
  const now = new Date().toISOString()
  // Si es otro análisis, lo visto del anterior ya no sirve.
  const bloques = v.publicadoEn === a.publicadoEn ? { ...v.bloques } : {}
  // Un análisis nuevo cuenta como visto entero; los cambios que el analista haga después se marcan aparte.
  if (v.publicadoEn !== a.publicadoEn) for (const b of Object.keys(a.novedades ?? {})) bloques[b] = now
  bloques[IDEA_CENTRAL] = now
  write({ publicadoEn: a.publicadoEn, bloques })
}

export function marcarBloqueVisto(a: WeeklyAnalysis, bloques: string[]) {
  if (bloques.length === 0) return
  const v = read()
  const now = new Date().toISOString()
  write({ publicadoEn: a.publicadoEn, bloques: { ...v.bloques, ...Object.fromEntries(bloques.map(b => [b, now])) } })
}

/** El análisis que el alumno abrió por última vez en este navegador. */
export function vistoPublicadoEn(): string | undefined {
  return read().publicadoEn
}

/** Avisa cuando cambia lo visto (para que el menú actualice el número). */
export function onVistoChange(fn: () => void): () => void {
  const handler = () => fn()
  window.addEventListener(EVENT, handler)
  window.addEventListener('storage', handler) // otra pestaña
  return () => {
    window.removeEventListener(EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

/** "martes 14:30" */
export function cuando(iso: string): string {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('es-AR', { weekday: 'long' })
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${dia} ${hora}`
}
