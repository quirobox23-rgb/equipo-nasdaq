'use client'
import { conBase } from '@/lib/base'
import { useSyncExternalStore } from 'react'
import cpi from '@/data/knowledge/cpi.json'
import ppi from '@/data/knowledge/ppi.json'
import nfp from '@/data/knowledge/nfp.json'
import retailSales from '@/data/knowledge/retail-sales.json'
import earnings from '@/data/knowledge/earnings.json'
import durableGoods from '@/data/knowledge/durable-goods.json'
import fomc from '@/data/knowledge/fomc.json'
import gdp from '@/data/knowledge/gdp.json'
import corePce from '@/data/knowledge/core-pce.json'
import consumerConfidence from '@/data/knowledge/consumer-confidence.json'

// Knowledge Base de NOVA — el conocimiento permanente sobre CADA TIPO de evento
// (cómo se interpreta un CPI, un NFP, un FOMC…). A diferencia de EventProvider
// (que es semanal y vive solo en memoria de sesión a propósito), esto NO
// pertenece a ninguna semana: se persiste en localStorage y sobrevive a
// cerrar el evento, cambiar de pantalla, cambiar de semana o recargar la
// página. Es la base para que NOVA Macro, NOVA Metrics y NOVA Lab compartan
// el mismo conocimiento en el futuro.
//
// NUEVO: además de localStorage, cada guardado se envía también a
// /api/knowledge/save (igual que EventProvider.ts hace con el calendario),
// para que Nova Macro (Python) pueda consultar esta misma Knowledge Base
// vía /api/knowledge — antes solo la veía el Mentor IA por evento (que
// corre en el navegador), la síntesis semanal de Python no tenía acceso.

export interface KnowledgeEntry {
  slug?: string
  name: string
  aliases?: string[]
  description?: string
  narrative?: string
  scenarioPositive?: string
  scenarioNegative?: string
  scenarioNeutral?: string
  affectedAssets?: string[]
  importance?: 'high' | 'med' | 'low'
  dependencies?: string
  comments?: string
  specialRules?: string[]
  notes?: string
}

const STORAGE_KEY = 'nova_knowledge_base_v1'

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Semilla — el conocimiento con el que arranca la biblioteca. Cada archivo
// nuevo en src/data/knowledge/ se añade aquí con una línea.
const SEED: KnowledgeEntry[] = [
  cpi, ppi, nfp, retailSales, earnings, durableGoods, fomc, gdp, corePce, consumerConfidence,
] as unknown as KnowledgeEntry[]

type Listener = () => void

class KnowledgeStoreImpl {
  private entries = new Map<string, KnowledgeEntry>()   // slug -> entrada
  private aliasMap = new Map<string, string>()           // slug de alias -> slug canónico
  private listeners = new Set<Listener>()
  private loaded = false

  private ensureLoaded() {
    if (this.loaded) return
    this.loaded = true

    for (const entry of SEED) {
      const slug = slugify(entry.name)
      this.entries.set(slug, { ...entry, slug })
      ;(entry.aliases ?? []).forEach(alias => this.aliasMap.set(slugify(alias), slug))
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const saved: Record<string, KnowledgeEntry> = JSON.parse(raw)
          Object.values(saved).forEach(entry => {
            const slug = entry.slug ?? slugify(entry.name)
            this.entries.set(slug, { ...entry, slug })
            ;(entry.aliases ?? []).forEach(alias => this.aliasMap.set(slugify(alias), slug))
          })
        }
      } catch { /* localStorage no disponible o corrupto — seguimos solo con la semilla */ }
    }
  }

  private persist() {
    if (typeof window === 'undefined') return
    try {
      const obj: Record<string, KnowledgeEntry> = {}
      this.entries.forEach((v, k) => { obj[k] = v })
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
    } catch { /* cuota excedida u otro error — no rompemos la sesión por esto */ }
  }

  /**
   * Envía la ficha guardada al servidor (para que Python la vea vía
   * /api/knowledge). No bloquea la UI: si falla (servidor no arrancado,
   * sin red...) se ignora — la copia en localStorage ya se guardó y el
   * Mentor IA por evento (que lee localStorage directamente) sigue
   * funcionando igual; solo Python se quedaría con la versión anterior
   * hasta el siguiente guardado que sí llegue.
   */
  private syncToServer(entry: KnowledgeEntry) {
    if (typeof window === 'undefined') return
    fetch(conBase('/api/knowledge/save'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => { /* ver docstring — fallo silencioso a propósito */ })
  }

  /** Resuelve el slug canónico de un nombre de evento (directo o vía alias). */
  resolveSlug(eventName: string): string {
    this.ensureLoaded()
    const direct = slugify(eventName)
    if (this.entries.has(direct)) return direct
    return this.aliasMap.get(direct) ?? direct
  }

  get(eventName: string): KnowledgeEntry | null {
    this.ensureLoaded()
    const slug = this.resolveSlug(eventName)
    return this.entries.get(slug) ?? null
  }

  save(entry: KnowledgeEntry) {
    this.ensureLoaded()
    const slug = slugify(entry.name)
    const full = { ...entry, slug }
    this.entries.set(slug, full)
    ;(entry.aliases ?? []).forEach(alias => this.aliasMap.set(slugify(alias), slug))
    this.persist()
    this.syncToServer(full)
    this.listeners.forEach(fn => fn())
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const knowledgeStore = new KnowledgeStoreImpl()

/** Hook reactivo — la ficha de conocimiento de un evento, por su nombre exacto. */
export function useKnowledgeEntry(eventName: string): KnowledgeEntry | null {
  return useSyncExternalStore(
    (cb) => knowledgeStore.subscribe(cb),
    () => knowledgeStore.get(eventName),
    () => knowledgeStore.get(eventName),
  )
}