'use client'

import { useState, useMemo } from 'react'
import { X, RefreshCw, Trash2, Pencil, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react'
import type { StoredEvent } from '@/lib/dataProvider/EventProvider'
import { eventStore, useWeekEvents } from '@/lib/dataProvider/EventProvider'
import { EventEditor } from '@/components/EventEditor'
import { Button } from '@/components/ui'

interface WeekCalendarEditorProps {
  initialMondayKey: string
  isOpen: boolean
  onClose: () => void
  onWeekChange?: (newMondayKey: string) => void
}

export function WeekCalendarEditor({ initialMondayKey, isOpen, onClose, onWeekChange }: WeekCalendarEditorProps) {
  const [mondayKey, setMondayKey] = useState(initialMondayKey)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<StoredEvent | null>(null)
  const [isEditingEvent, setIsEditingEvent] = useState(false)
  const [sortBy, setSortBy] = useState<'date' | 'impact'>('date')

  const events = useWeekEvents(mondayKey)

  const sorted = useMemo(() => {
    const copy = [...events]
    if (sortBy === 'date') {
      return copy.sort((a, b) => {
        const dateCompare = (a.date || '').localeCompare(b.date || '')
        if (dateCompare !== 0) return dateCompare
        return (a.time || '').localeCompare(b.time || '')
      })
    } else {
      const impactOrder = { high: 0, med: 1, low: 2 }
      return copy.sort((a, b) => {
        const impactA = impactOrder[a.impact || 'med']
        const impactB = impactOrder[b.impact || 'med']
        return impactA - impactB
      })
    }
  }, [events, sortBy])

  const handlePreviousWeek = () => {
    const current = new Date(`${mondayKey}T00:00:00`)
    current.setDate(current.getDate() - 7)
    const newKey = current.toISOString().split('T')[0]
    setMondayKey(newKey)
    onWeekChange?.(newKey)
  }

  const handleNextWeek = () => {
    const current = new Date(`${mondayKey}T00:00:00`)
    current.setDate(current.getDate() + 7)
    const newKey = current.toISOString().split('T')[0]
    setMondayKey(newKey)
    onWeekChange?.(newKey)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // Resetear la semana para que recargue desde FRED
      eventStore.resetWeek(mondayKey)
      // Esperar un bit para que se cargue
      await new Promise(resolve => setTimeout(resolve, 1500))
    } catch (error) {
      console.error('Error refreshing:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleClearAll = () => {
    if (confirm(`¿Eliminar TODOS los eventos de la semana ${mondayKey}? Esta acción no se puede deshacer.`)) {
      const copy = [...events]
      copy.forEach(event => {
        eventStore.deleteEvent(mondayKey, event.id)
      })
    }
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value
    setMondayKey(newKey)
    onWeekChange?.(newKey)
  }

  const handleEdit = (event: StoredEvent) => {
    setSelectedEvent(event)
    setIsEditingEvent(true)
  }
const handleAddEvent = (event: any) => {
  eventStore.addEvent(mondayKey, {
    id: event.id || event.customId,
    name: event.name,
    date: event.date,
    time: event.time,
    impact: event.impact,
    type: event.type,
    affects: event.affects,
    forecast: event.forecast,
    prev: event.prev,
    actual: event.actual,
    direction: event.direction,
    currency: event.currency,
    country: event.country,
    notes: event.notes,
  })
  setIsEditingEvent(false)
  setSelectedEvent(null)
}
  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar evento?')) {
      eventStore.deleteEvent(mondayKey, id)
    }
  }

  const handleMoveUp = (id: string) => {
    eventStore.moveEvent(mondayKey, id, 'up')
  }

  const handleMoveDown = (id: string) => {
    eventStore.moveEvent(mondayKey, id, 'down')
  }

  const handleAddNew = () => {
    setSelectedEvent(null)
    setIsEditingEvent(true)
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-neg-dim text-neg border-neg/40'
      case 'med':
        return 'bg-neutral-dim text-neutral border-neutral/40'
      case 'low':
        return 'bg-base-panel2 text-base-muted border-base-line'
      default:
        return 'bg-base-panel2 text-base-muted border-base-line'
    }
  }

  const getMondayDate = (key: string) => {
    const date = new Date(`${key}T00:00:00`)
    const sunday = new Date(date)
    sunday.setDate(sunday.getDate() + 6)
    return `${key} al ${sunday.toISOString().split('T')[0]}`
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-base-panel border border-base-line rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
          
          {/* Header */}
          <div className="bg-base-bg/50 border-b border-base-line p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-black text-base-text">Editar Calendario</h2>
                <p className="text-sm text-base-muted mt-1">Semana: {getMondayDate(mondayKey)}</p>
              </div>
              <button
                onClick={onClose}
                className="text-base-muted hover:text-base-text"
                aria-label="Cerrar"
              >
                <X size={26} />
              </button>
            </div>

            {/* Controles de navegación de semanas */}
            <div className="flex gap-4 items-center flex-wrap">
              <Button variant="secondary" size="sm" onClick={handlePreviousWeek}>
                <ArrowLeft size={14} /> Semana Anterior
              </Button>

              <input
                type="date"
                value={mondayKey}
                onChange={handleDateChange}
                className="px-3 py-2 bg-base-bg border border-base-line rounded-lg text-sm text-base-text"
              />

              <Button variant="secondary" size="sm" onClick={handleNextWeek}>
                Semana Siguiente <ArrowRight size={14} />
              </Button>

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing ? 'Sincronizando FRED...' : 'Actualizar FRED'}
              </button>

              <button
                onClick={handleClearAll}
                disabled={events.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-neg-dim hover:bg-neg/20 text-neg border border-neg/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 size={14} /> Limpiar Calendario
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-base-bg border-b border-base-line p-4 flex justify-between items-center gap-4">
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={handleAddNew}>
                + Agregar Evento
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-base-muted">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'impact')}
                className="px-3 py-1 bg-base-panel border border-base-line rounded text-sm text-base-text"
              >
                <option value="date">Fecha</option>
                <option value="impact">Impacto</option>
              </select>
            </div>
          </div>

          {/* Content - Table */}
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="p-8 text-center text-base-muted">
                No hay eventos. Haz clic en "+ Agregar Evento" o en "Actualizar FRED" para sincronizar.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-base-bg border-b border-base-line">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-base-text">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold text-base-text">Hora</th>
                    <th className="px-4 py-3 text-left font-semibold text-base-text">Evento</th>
                    <th className="px-4 py-3 text-left font-semibold text-base-text">País</th>
                    <th className="px-4 py-3 text-center font-semibold text-base-text">Impacto</th>
                    <th className="px-4 py-3 text-center font-semibold text-base-text">Forecast</th>
                    <th className="px-4 py-3 text-center font-semibold text-base-text">Anterior</th>
                    <th className="px-4 py-3 text-center font-semibold text-base-text">Actual</th>
                    <th className="px-4 py-3 text-right font-semibold text-base-text">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((event, idx) => (
                    <tr key={event.id} className="border-b border-base-line/50 hover:bg-base-bg/50 transition-colors">
                      <td className="px-4 py-3 text-base-text font-mono">{event.date}</td>
                      <td className="px-4 py-3 text-base-text">{event.time || '—'}</td>
                      <td className="px-4 py-3 text-base-text font-medium">{event.name}</td>
                      <td className="px-4 py-3 text-base-muted">{event.country || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold border ${getImpactColor(event.impact || 'med')}`}>
                          {event.impact === 'high' ? 'Alto' : event.impact === 'med' ? 'Medio' : 'Bajo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-base-muted">{event.forecast ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-base-muted">{event.prev ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-base-muted">{event.actual ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {idx > 0 && (
                            <button
                              onClick={() => handleMoveUp(event.id)}
                              className="p-1.5 bg-base-line/50 hover:bg-base-line text-base-text rounded transition-colors"
                              title="Mover arriba"
                            >
                              <ArrowUp size={13} />
                            </button>
                          )}
                          {idx < sorted.length - 1 && (
                            <button
                              onClick={() => handleMoveDown(event.id)}
                              className="p-1.5 bg-base-line/50 hover:bg-base-line text-base-text rounded transition-colors"
                              title="Mover abajo"
                            >
                              <ArrowDown size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(event)}
                            className="p-1.5 bg-base-line/50 hover:bg-base-line text-base-text rounded transition-colors"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="p-1.5 bg-neg-dim hover:bg-neg/20 text-neg rounded transition-colors"
                            title="Eliminar"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="bg-base-bg border-t border-base-line p-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>

      {/* EventEditor */}
  
<EventEditor
  dayIndex={0}
  weekOffset={0}
  initial={selectedEvent || undefined}
  onSubmit={handleAddEvent}
  onClose={() => setIsEditingEvent(false)}
/>
    </>
  )
}