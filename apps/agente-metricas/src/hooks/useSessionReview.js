import { useEffect, useRef, useState } from 'react'
import { useTrades } from '@/store/useStore'
import { computeAccountMetrics } from '@/config/blueprintMatchEngine'

// ─────────────────────────────────────────────
//  SESSION REVIEW AGENT — hook
//
//  Detecta cuando el usuario lleva 30 minutos sin registrar ningún
//  trade nuevo tras haber operado hoy, y deja listos los datos para
//  que SessionReviewModal los muestre — sin que el usuario tenga que
//  entrar a /ia manualmente.
//
//  No toca el store de Zustand: solo lo LEE (useTrades, ya existente).
//  Usa localStorage exclusivamente para recordar qué día ya se
//  mostró el resumen, y así no repetirlo hasta el día siguiente.
// ─────────────────────────────────────────────

const STORAGE_KEY    = 'agente-metricas-session-review-last-shown'
const INACTIVITY_MS  = 30 * 60 * 1000 // 30 minutos sin trades nuevos

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function alreadyShownToday() {
  return localStorage.getItem(STORAGE_KEY) === todayISO()
}

export function useSessionReview() {
  const trades = useTrades()
  const [shouldShow, setShouldShow] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!trades.length) return
    if (alreadyShownToday()) return

    // ¿El trade más reciente registrado es de hoy?
    const latest = [...trades].sort((a, b) => {
      const da = `${a.date || ''} ${a.time || ''}`
      const db = `${b.date || ''} ${b.time || ''}`
      return db.localeCompare(da)
    })[0]
    if (!latest || latest.date !== todayISO()) return

    // Arranca (o reinicia, si llega un trade nuevo antes) el
    // temporizador de inactividad. A los 30 min sin más trades,
    // se considera la sesión del día cerrada.
    timerRef.current = setTimeout(() => {
      if (!alreadyShownToday()) setShouldShow(true)
    }, INACTIVITY_MS)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [trades.length])

  const todayTrades = trades.filter(t => t.date === todayISO())
  const metrics = todayTrades.length ? computeAccountMetrics(todayTrades, null) : null

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, todayISO())
    setShouldShow(false)
  }

  return { shouldShow, todayTrades, metrics, dismiss }
}
