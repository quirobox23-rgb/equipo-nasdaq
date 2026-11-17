'use client'
import { useSyncExternalStore } from 'react'
import type { MacroEvent } from '@/types/macro'
import week_2026_31 from '@/data/weeks/week_2026_31.json'
import { getStoredAdminPassword } from '@/lib/adminSession'
import { getFredEventsForWeek } from '@/lib/useFredEvents'

export interface StoredEvent extends MacroEvent {
  id: string  // Override: StoredEvent siempre tiene id como string
  order: number
  notes?: string
}


interface RawWeekEvent {
  date: string
  time?: string
  country?: string
  currency?: string
  name: string
  impact?: 'high' | 'med' | 'low'
  prev?: string | number | null
  forecast?: string | number | null
  actual?: string | number | null
  direction?: MacroEvent['direction']
  type?: MacroEvent['type']
  affects?: string[]
}

const WEEK_FILES: Record<string, RawWeekEvent[]> = {
  '2026-07-27': week_2026_31 as RawWeekEvent[],
}

const STORAGE_KEY = 'nova_macro_events_v1'

function fromRaw(e: RawWeekEvent, order: number): StoredEvent {
  return {
    id: `evt-${e.date}-${order}`,
    name: e.name,
    time: e.time,
    impact: e.impact ?? 'med',
    affects: e.affects ?? ['USD', 'NQ'],
    forecast: e.forecast ?? null,
    actual: e.actual ?? null,
    prev: e.prev ?? null,
    direction: e.direction ?? 'pending',
    currency: e.currency,
    date: e.date,
    country: e.country,
    type: e.type ?? 'macro',
    order,
  }
}

type Listener = () => void

class EventStoreImpl {
  private weeks = new Map<string, StoredEvent[]>()
  private listeners = new Set<Listener>()
  private seq = 1
  private persistedLoaded = false
  private fredLoaded = new Set<string>()
  private serverLoaded = new Set<string>()

  private loadPersisted() {
    if (this.persistedLoaded) return
    this.persistedLoaded = true
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved: Record<string, StoredEvent[]> = JSON.parse(raw)
      Object.entries(saved).forEach(([monday, events]) => this.weeks.set(monday, events))
    } catch {
      /* localStorage no disponible o corrupto */
    }
  }

  private persist() {
    if (typeof window === 'undefined') return
    try {
      const obj: Record<string, StoredEvent[]> = {}
      this.weeks.forEach((events, monday) => { obj[monday] = events })
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
    } catch {
      /* cuota excedida u otro error */
    }
  }

  private seed(monday: string): StoredEvent[] {
    const raw = WEEK_FILES[monday]
    const base = raw ? raw.map((e, i) => fromRaw(e, i)) : []
    this.weeks.set(monday, base)
    return base
  }

  private async loadFredEvents(monday: string) {
    if (this.fredLoaded.has(monday)) return
    this.fredLoaded.add(monday)

    try {
      const fredEvents = await getFredEventsForWeek(monday)
      if (fredEvents.length > 0) {
        const current = this.weeks.get(monday) || []
        const merged = [...current, ...fredEvents]
        this.commit(monday, merged)
      }
    } catch (err) {
      console.warn('FRED sync failed:', err)
    }
  }

  // Antes de completar una semana con eventos simulados/FRED, primero hay
  // que preguntarle al servidor si esa semana ya tiene un archivo real en
  // src/data/weeks/ (la misma fuente que usa Eventos Económicos) — WEEK_FILES
  // solo conoce una semana hardcodeada, así que sin este chequeo cualquier
  // otra semana se trataba como "vacía" y terminaba pisada con datos
  // simulados al guardar (ver incidente 2026-09-10).
  private async loadServerData(monday: string) {
    if (this.serverLoaded.has(monday)) return
    this.serverLoaded.add(monday)

    try {
      const res = await fetch(`/api/weeks/${monday}`)
      if (res.ok) {
        const data = await res.json()
        const events: RawWeekEvent[] = data.events || []
        if (events.length > 0) {
          this.fredLoaded.add(monday) // ya hay datos reales, no completar con FRED/simulado
          this.weeks.set(monday, events.map((e, i) => fromRaw(e, i)))
          this.persist()
          this.listeners.forEach(fn => fn())
          return
        }
      }
    } catch (err) {
      console.warn('Server week fetch failed:', err)
    }

    // Esta semana realmente no tiene archivo todavía: recién acá completar con FRED/simulado.
    this.loadFredEvents(monday)
  }

  private ensure(monday: string): StoredEvent[] {
    this.loadPersisted()

    if (this.weeks.has(monday)) {
      return this.weeks.get(monday)!
    }

    const base = this.seed(monday)
    this.loadServerData(monday)
    return base
  }

  private commit(monday: string, events: StoredEvent[]) {
    const sorted = [...events].sort((a, b) => a.order - b.order)
    this.weeks.set(monday, sorted)
    this.persist()
    this.syncToServer(monday, sorted)
    this.listeners.forEach(fn => fn())
  }

  private syncToServer(monday: string, events: StoredEvent[]) {
    if (typeof window === 'undefined') return
    const payload = {
      monday,
      events: events.map(e => ({
        date: e.date, time: e.time, country: e.country, currency: e.currency,
        name: e.name, impact: e.impact, prev: e.prev, forecast: e.forecast,
        actual: e.actual, type: e.type, affects: e.affects,
      })),
    }
    const adminPassword = getStoredAdminPassword()
    fetch('/api/calendar/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminPassword ? { 'x-admin-password': adminPassword } : {}),
      },
      body: JSON.stringify(payload),
    }).catch(() => { /* fallo silencioso */ })
  }

  getWeek(monday: string): StoredEvent[] {
    return this.ensure(monday)
  }

  hasProviderData(monday: string): boolean {
    return monday in WEEK_FILES
  }

  hasSavedChanges(monday: string): boolean {
    this.loadPersisted()
    if (typeof window === 'undefined') return false
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const saved: Record<string, StoredEvent[]> = JSON.parse(raw)
      return monday in saved
    } catch {
      return false
    }
  }

  resetWeek(monday: string) {
    this.seed(monday)
    this.fredLoaded.delete(monday)
    this.persist()
    this.listeners.forEach(fn => fn())
  }

  addEvent(monday: string, data: Partial<StoredEvent> & { name: string }): string {
    const events = this.ensure(monday)
    const id = String(data.id ?? `custom-${Date.now()}-${this.seq++}`)
    const maxOrder = events.reduce((m, e) => Math.max(m, e.order), -1)
    const event: StoredEvent = {
      id,
      name: data.name,
      time: data.time,
      impact: data.impact ?? 'med',
      affects: data.affects ?? ['USD', 'NQ'],
      forecast: data.forecast ?? null,
      actual: data.actual ?? null,
      prev: data.prev ?? null,
      direction: data.direction ?? 'pending',
      currency: data.currency,
      date: data.date ?? monday,
      country: data.country,
      type: data.type ?? 'other',
      order: maxOrder + 1,
      notes: data.notes,
    }
    this.commit(monday, [...events, event])
    return id
  }

  updateEvent(monday: string, id: string, patch: Partial<StoredEvent>) {
    const events = this.ensure(monday)
    this.commit(monday, events.map(e => (String(e.id) === id ? { ...e, ...patch, id: e.id } : e)))
  }

  deleteEvent(monday: string, id: string) {
    const events = this.ensure(monday)
    this.commit(monday, events.filter(e => String(e.id) !== id))
  }

  duplicateEvent(monday: string, id: string) {
    const events = this.ensure(monday)
    const src = events.find(e => String(e.id) === id)
    if (!src) return
    const maxOrder = events.reduce((m, e) => Math.max(m, e.order), -1)
    const copy: StoredEvent = { ...src, id: `custom-${Date.now()}-${this.seq++}`, name: `${src.name} (copia)`, order: maxOrder + 1 }
    this.commit(monday, [...events, copy])
  }

  moveEvent(monday: string, id: string, direction: 'up' | 'down') {
    const ordered = this.getWeek(monday)
    const idx = ordered.findIndex(e => String(e.id) === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return
    const a = ordered[idx], b = ordered[swapIdx]
    const swapped = ordered.map(e => {
      if (e.id === a.id) return { ...e, order: b.order }
      if (e.id === b.id) return { ...e, order: a.order }
      return e
    })
    this.commit(monday, swapped)
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const eventStore = new EventStoreImpl()

import { useState, useEffect } from 'react'

export function useWeekEvents(monday: string): StoredEvent[] {
  const [events, setEvents] = useState<StoredEvent[]>(() => eventStore.getWeek(monday))

  useEffect(() => {
    setEvents(eventStore.getWeek(monday))
    const unsub = eventStore.subscribe(() => setEvents(eventStore.getWeek(monday)))
    return unsub
  }, [monday])

  return events
}
  
