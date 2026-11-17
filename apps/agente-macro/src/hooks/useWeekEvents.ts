import { useState, useEffect, useCallback } from 'react'
import type { MacroEvent } from '@/types/macro'

export function useWeekEvents(weekOffset: number) {
  const [events, setEvents] = useState<MacroEvent[]>([])
  const [loading, setLoading] = useState(false)

  const getWeekDate = useCallback(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + daysToMonday + weekOffset * 7)

    const year = monday.getFullYear()
    const month = String(monday.getMonth() + 1).padStart(2, '0')
    const day = String(monday.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [weekOffset])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const dateStr = getWeekDate()
      const response = await fetch(`/api/weeks/${dateStr}`)
      if (!response.ok) {
        setEvents([])
        setLoading(false)
        return
      }
      const data = await response.json()
      setEvents(data.events || [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [getWeekDate])

  const saveEvent = useCallback(
    async (eventId: number, updates: Partial<MacroEvent>) => {
      try {
        const dateStr = getWeekDate()
        const response = await fetch(`/api/weeks/${dateStr}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, updates }),
        })
        if (!response.ok) return false
        const data = await response.json()
        setEvents(data.events || [])
        return true
      } catch {
        return false
      }
    },
    [getWeekDate]
  )

  useEffect(() => {
    loadEvents()
  }, [weekOffset, loadEvents])

  return { events, loading, saveEvent, reload: loadEvents }
}