'use client'
import { useSyncExternalStore } from 'react'
import { loadContenido, saveContenido } from '@/lib/contenido'

// TechnicalContext — niveles reales por activo, introducidos a mano hoy,
// listos para que mañana los rellene Databento sin cambiar ni un campo de
// esta interfaz. Los guarda el equipo (los domingos) en Firestore
// (contenido/niveles-tecnicos, ver src/lib/contenido.ts) y los leen todos.
//
// IMPORTANTE: aquí NUNCA se inventa un valor. Un campo sin introducir es
// `null`/`undefined`, y así se queda hasta que el usuario (o mañana Databento)
// lo rellene — la interfaz siempre muestra "No disponible" en ese caso.

export const TECHNICAL_ASSETS = [
  { asset: 'NQ',    display: 'NASDAQ (NQ)' },
  { asset: 'SP500', display: 'S&P 500' },
  { asset: 'GOLD',  display: 'Oro (XAU)' },
  { asset: 'DXY',   display: 'Dólar Index (DXY)' },
  { asset: 'VIX',   display: 'VIX' },
] as const

export interface DailyContext {
  currentPrice?:   number | null   // necesario para calcular distancias — no estaba en la lista pero es imprescindible, ver nota en el resumen
  pdh?:            number | null
  pdl?:            number | null
  openDaily?:      number | null
  asiaHigh?:       number | null
  asiaLow?:        number | null
  frankfurtHigh?:  number | null
  frankfurtLow?:   number | null
  londonHigh?:     number | null
  londonLow?:      number | null
  vwap?:           number | null
}

export interface WeeklyContext {
  pwh?: number | null
  pwl?: number | null
  pmh?: number | null
  pml?: number | null
}

export interface AssetTechnicalContext {
  asset:  string
  daily:  DailyContext
  weekly: WeeklyContext
  updatedAt?: string
}

function emptyContext(asset: string): AssetTechnicalContext {
  return { asset, daily: {}, weekly: {} }
}

type Listener = () => void

class TechnicalContextStoreImpl {
  private contexts = new Map<string, AssetTechnicalContext>()
  private listeners = new Set<Listener>()
  private loaded = false

  private notify() {
    this.listeners.forEach(fn => fn())
  }

  private ensureLoaded() {
    if (this.loaded || typeof window === 'undefined') return
    this.loaded = true
    loadContenido<Record<string, AssetTechnicalContext>>('niveles-tecnicos')
      .then(saved => {
        Object.values(saved ?? {}).forEach(ctx => this.contexts.set(ctx.asset, ctx))
        this.notify()
      })
      .catch(() => { /* sin conexión: se ve "No disponible" */ })
  }

  get(asset: string): AssetTechnicalContext {
    this.ensureLoaded()
    let ctx = this.contexts.get(asset)
    if (!ctx) {
      // Se guarda en el mapa la primera vez para que useSyncExternalStore
      // reciba siempre la misma referencia mientras no haya un save real —
      // devolver un objeto nuevo en cada llamada provoca un bucle infinito.
      ctx = emptyContext(asset)
      this.contexts.set(asset, ctx)
    }
    return ctx
  }

  /** Guarda en Firestore (solo el equipo puede). Lanza un error con el mensaje si falla. */
  async save(asset: string, daily: DailyContext, weekly: WeeklyContext) {
    // Se relee antes de guardar para no pisar lo que otro del equipo guardó en otro activo.
    const current = (await loadContenido<Record<string, AssetTechnicalContext>>('niveles-tecnicos')) ?? {}
    const ctx: AssetTechnicalContext = { asset, daily, weekly, updatedAt: new Date().toISOString() }
    await saveContenido('niveles-tecnicos', { ...current, [asset]: ctx })
    this.contexts.set(asset, ctx)
    this.notify()
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const technicalContextStore = new TechnicalContextStoreImpl()

export function useAssetTechnicalContext(asset: string): AssetTechnicalContext {
  return useSyncExternalStore(
    (cb) => technicalContextStore.subscribe(cb),
    () => technicalContextStore.get(asset),
    () => technicalContextStore.get(asset),
  )
}
