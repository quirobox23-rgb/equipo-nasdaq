/**
 * useClock.ts — Reloj UTC + detección de sesión de trading.
 * Migrado desde macro-intelligence/src/hooks/index.js → useClock
 */
'use client'
import { useState, useEffect } from 'react'

export type TradingSession = 'pre-market' | 'ny-open' | 'ny-regular' | 'after-hours' | 'closed'

export interface ClockState {
  /** "Sáb 3 oct" — fecha local del usuario. */
  dateString: string
  utcString: string
  etString: string
  nyHour: number
  session: TradingSession
  sessionLabel: string
  sessionColor: string
}

function getSession(nyHour: number, nyMin: number): TradingSession {
  const mins = nyHour * 60 + nyMin
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return 'pre-market'
  if (mins >= 9 * 60 + 30 && mins < 10 * 60) return 'ny-open'
  if (mins >= 10 * 60 && mins < 16 * 60)     return 'ny-regular'
  if (mins >= 16 * 60 && mins < 20 * 60)     return 'after-hours'
  return 'closed'
}

const SESSION_LABELS: Record<TradingSession, string> = {
  'pre-market':  'Pre-market',
  'ny-open':     'NY Open ⚡',
  'ny-regular':  'NY Regular',
  'after-hours': 'After-hours',
  'closed':      'Cerrado',
}

const SESSION_COLORS: Record<TradingSession, string> = {
  'pre-market':  'text-neutral',
  'ny-open':     'text-neg',
  'ny-regular':  'text-pos',
  'after-hours': 'text-base-muted',
  'closed':      'text-base-muted/70',
}

export function useClock(): ClockState {
  const [state, setState] = useState<ClockState>(() => buildState())

  useEffect(() => {
    const id = setInterval(() => setState(buildState()), 1000)
    return () => clearInterval(id)
  }, [])

  return state
}

function buildState(): ClockState {
  const now = new Date()

  const utcString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC'

  const etString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  }) + ' ET'

  const nyHour = parseInt(
    now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }),
  )
  const nyMin = now.getMinutes()

  const session = getSession(nyHour, nyMin)

  // Fecha local del usuario, la misma que usa el resto de la app ("HOY" del
  // calendario, título de El Mercado Hoy).
  const dateParts = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    .formatToParts(now)
  const part = (t: string) => dateParts.find(p => p.type === t)?.value.replace('.', '') ?? ''
  const wd = part('weekday')
  const dateString = `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${part('day')} ${part('month')}`

  return {
    dateString,
    utcString,
    etString,
    nyHour,
    session,
    sessionLabel: SESSION_LABELS[session],
    sessionColor: SESSION_COLORS[session],
  }
}
