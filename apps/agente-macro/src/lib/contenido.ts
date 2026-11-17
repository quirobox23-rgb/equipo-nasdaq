'use client'

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getDb } from '@/lib/firebase/client'
import type { WeeklyAnalysis } from '@/lib/weekly/types'

// contenido.ts — lo que el equipo publica para los alumnos (Análisis Semanal
// y niveles de Contexto Técnico) se guarda en Firestore, colección
// `contenido`. El servidor de Hostinger no deja guardar archivos, así que
// no se guarda allí.
//
// Lo protege Firestore: cualquiera con sesión lee lo publicado; solo el
// equipo (alumnos/{uid}.nivel == "admin") escribe y lee el borrador:
//
//   function esEquipo() {
//     return request.auth != null
//       && get(/databases/$(database)/documents/alumnos/$(request.auth.uid)).data.get('nivel', '') == 'admin';
//   }
//   match /contenido/{id} {
//     allow read: if request.auth != null && (id != 'analisis-borrador' || esEquipo());
//     allow write: if esEquipo();
//   }
//
// Historial: cada publicación guarda además una copia por semana
// (`analisis-semana-AAAA-MM-DD`, el lunes) y la anota en `analisis-historial`.
// Las reglas de arriba ya las cubren.

export type ContenidoId =
  | 'analisis-publicado' | 'analisis-borrador' | 'niveles-tecnicos' | 'analisis-historial'
  | `analisis-semana-${string}`

/** Una semana del historial del Análisis Semanal. */
export interface SemanaHistorial { monday: string; semana: string; publicadoEn: string }

export async function loadContenido<T>(id: ContenidoId): Promise<T | null> {
  const snap = await getDoc(doc(getDb(), 'contenido', id))
  return snap.exists() ? (snap.data().valor as T) : null
}

/** Lanza un error con un mensaje legible si Firestore lo rechaza. */
export async function saveContenido(id: ContenidoId, valor: unknown): Promise<void> {
  try {
    // Firestore no acepta `undefined`: el viaje por JSON lo quita.
    await setDoc(doc(getDb(), 'contenido', id), { valor: JSON.parse(JSON.stringify(valor)) })
  } catch (err) {
    const code = (err as { code?: string }).code
    throw new Error(code === 'permission-denied'
      ? 'No se pudo guardar: tu cuenta no tiene nivel de equipo o faltan las reglas de Firestore.'
      : 'No se pudo guardar. Probá de nuevo.')
  }
}

/**
 * Publica el análisis para los alumnos y guarda su copia en el historial de
 * esa semana (si se vuelve a publicar la misma semana, la copia se actualiza).
 * Lo del historial no frena la publicación si falla.
 */
export async function publishAnalysis(a: WeeklyAnalysis): Promise<void> {
  await saveContenido('analisis-publicado', a)
  try {
    await saveContenido(`analisis-semana-${a.monday}`, a)
    const lista = (await loadContenido<SemanaHistorial[]>('analisis-historial')) ?? []
    const item = { monday: a.monday, semana: a.semana, publicadoEn: a.publicadoEn ?? new Date().toISOString() }
    const nueva = [item, ...lista.filter(s => s.monday !== a.monday)].sort((x, y) => y.monday.localeCompare(x.monday))
    await saveContenido('analisis-historial', nueva)
  } catch (err) {
    console.error('[contenido] No se pudo guardar el historial del análisis:', err)
  }
}
