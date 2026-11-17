import { useState, useEffect, useCallback, useMemo } from 'react'

// ─────────────────────────────────────────────
//  ECONOMIC CALENDAR — hook de datos
//
//  Fase 1 (este Sprint): datos mock realistas, generados para la
//  semana actual, con la MISMA estructura que tendría una respuesta
//  real de ForexFactory (ver forma del evento más abajo) — así el
//  día que se conecte una fuente real (ff_calendar_thisweek.json u
//  otra), solo hay que sustituir `fetchMockWeek()` por el fetch
//  real; nada más de la app cambia.
//
//  Cache: localStorage, 1h de TTL, para no recalcular/repetir la
//  llamada en cada navegación a /economic-calendar.
// ─────────────────────────────────────────────

const CACHE_KEY = 'nova-economic-calendar-cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hora

// Plantilla de eventos recurrentes típicos — se posicionan sobre los
// días reales de la semana actual (misma lógica de calendario que
// usan NFP/FOMC/CPI en la vida real: NFP = primer viernes de mes,
// CPI a mitad de mes, etc. — aquí, simplificado para fase 1, se
// reparten de forma realista dentro de la semana visible).
function buildEventTemplates() {
  return [
    { key: 'nfp',  title: 'Non-Farm Payrolls',          country: 'USD', currency: 'USD', impact: 'high',   time: '08:30', dayOffset: 4, forecast: '185K',  previous: '179K',  relatedPairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'] },
    { key: 'fomc', title: 'FOMC — Decisión de tipos',   country: 'USD', currency: 'USD', impact: 'high',   time: '14:00', dayOffset: 2, forecast: '5.25%', previous: '5.25%', relatedPairs: ['EURUSD', 'GBPUSD', 'XAUUSD', 'US30'] },
    { key: 'cpi',  title: 'CPI m/m',                     country: 'USD', currency: 'USD', impact: 'high',   time: '08:30', dayOffset: 1, forecast: '0.3%',  previous: '0.2%',  relatedPairs: ['EURUSD', 'USDJPY', 'XAUUSD'] },
    { key: 'claims', title: 'Solicitudes de desempleo', country: 'USD', currency: 'USD', impact: 'medium', time: '08:30', dayOffset: 3, forecast: '230K',  previous: '227K',  relatedPairs: ['EURUSD', 'US30'] },
    { key: 'ecb',  title: 'BCE — Discurso de Lagarde',  country: 'EUR', currency: 'EUR', impact: 'medium', time: '09:00', dayOffset: 0, forecast: null,    previous: null,    relatedPairs: ['EURUSD', 'EURGBP'] },
    { key: 'pmi',  title: 'PMI Manufacturero',           country: 'USD', currency: 'USD', impact: 'medium', time: '09:45', dayOffset: 0, forecast: '49.8',  previous: '49.2',  relatedPairs: ['EURUSD', 'US30'] },
    { key: 'retail', title: 'Ventas Minoristas m/m',    country: 'USD', currency: 'USD', impact: 'medium', time: '08:30', dayOffset: 3, forecast: '0.4%',  previous: '0.1%',  relatedPairs: ['EURUSD', 'US30'] },
    { key: 'boe',  title: 'BoE — Decisión de tipos',    country: 'GBP', currency: 'GBP', impact: 'high',   time: '07:00', dayOffset: 1, forecast: '5.00%', previous: '5.00%', relatedPairs: ['GBPUSD', 'EURGBP'] },
    { key: 'boj',  title: 'BoJ — Decisión de tipos',    country: 'JPY', currency: 'JPY', impact: 'medium', time: '03:00', dayOffset: 2, forecast: '0.10%', previous: '0.10%', relatedPairs: ['USDJPY'] },
    { key: 'confidence', title: 'Confianza del consumidor', country: 'USD', currency: 'USD', impact: 'low', time: '10:00', dayOffset: 4, forecast: '102.5', previous: '100.9', relatedPairs: ['US30'] },
    { key: 'housing', title: 'Ventas de vivienda',      country: 'USD', currency: 'USD', impact: 'low',    time: '10:00', dayOffset: 1, forecast: '4.1M',  previous: '4.0M',  relatedPairs: ['US30'] },
    { key: 'crude', title: 'Inventarios de crudo',       country: 'USD', currency: 'USD', impact: 'low',    time: '10:30', dayOffset: 2, forecast: '-1.2M', previous: '0.8M',  relatedPairs: ['XAUUSD'] },
  ]
}

function mondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISODate(d) {
  return d.toISOString().split('T')[0]
}

/** Simula la fuente de datos (fase 1). Misma forma que tendría una API real. */
function fetchMockWeek() {
  const monday = mondayOf(new Date())
  return buildEventTemplates().map((tpl) => {
    const eventDate = new Date(monday)
    eventDate.setDate(monday.getDate() + tpl.dayOffset)
    const date = toISODate(eventDate)
    return {
      id: `${tpl.key}-${date}`,
      title: tpl.title,
      date,
      time: tpl.time,
      timezone: 'ET',
      country: tpl.country,
      currency: tpl.currency,
      impact: tpl.impact,
      forecast: tpl.forecast,
      previous: tpl.previous,
      actual: null,
      relatedPairs: tpl.relatedPairs,
    }
  }).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
}

function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { events, cachedAt } = JSON.parse(raw)
    if (Date.now() - cachedAt > CACHE_TTL_MS) return null
    return events
  } catch {
    return null
  }
}

function saveToCache(events) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ events, cachedAt: Date.now() }))
  } catch {
    // localStorage lleno o no disponible — no es crítico, se recalcula en el próximo load
  }
}

/**
 * useEconomicCalendar({ impactLevels, currency })
 *   impactLevels: array de 'low'|'medium'|'high' a incluir (default: medium+high)
 *   currency:     'ALL' o código de moneda (ej. 'USD') para filtrar
 */
export function useEconomicCalendar({ impactLevels = ['medium', 'high'], currency = 'ALL' } = {}) {
  const [rawEvents, setRawEvents] = useState(() => loadFromCache() || [])
  const [loading,   setLoading]   = useState(rawEvents.length === 0)
  const [error,     setError]     = useState(null)

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = loadFromCache()
      if (cached) { setRawEvents(cached); setLoading(false); return }
    }
    setLoading(true)
    setError(null)
    try {
      // Fase 1: mock síncrono. Fase 2: sustituir por fetch real, ej.
      //   const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json')
      //   const data = await res.json()
      const events = fetchMockWeek()
      setRawEvents(events)
      saveToCache(events)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los eventos económicos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (rawEvents.length === 0) load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo(() => {
    return rawEvents
      .filter((e) => impactLevels.includes(e.impact))
      .filter((e) => currency === 'ALL' || e.currency === currency)
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
  }, [rawEvents, impactLevels, currency])

  return { events, allEvents: rawEvents, loading, error, refetch: () => load(true) }
}
