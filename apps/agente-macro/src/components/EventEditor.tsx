'use client'
import { useState, useEffect }  from 'react'
import { X, Brain } from 'lucide-react'
import type { MacroEvent, EventImpact } from '@/types/macro'
import { EVENT_CATALOG, EVENT_CATEGORIES } from '@/lib/engines/mentorEngine'
import { knowledgeStore, type KnowledgeEntry } from '@/lib/dataProvider/KnowledgeBase'

// EventEditor — componente único para crear y editar eventos semanales.
//
// ARQUITECTURA DEFINITIVA (Knowledge Base): el evento semanal (fecha, hora,
// forecast, previous, actual, impacto…) y el CONOCIMIENTO PERMANENTE sobre
// ese tipo de evento (cómo se interpreta un CPI, un FOMC…) son dos cosas
// distintas que se editan aquí juntas por comodidad, pero se guardan en dos
// sitios distintos: el evento va a EventProvider (vive en la semana), el
// conocimiento va a KnowledgeBase (vive para siempre, independiente de la
// semana — por eso ya NO desaparece al cerrar el evento).

export interface CustomEvent extends MacroEvent {
  customId:   string
  dayIndex:   number   // 0=Lunes … 4=Viernes
  weekOffset: number   // 0=esta semana, 1=próxima, etc.
  notes?:     string
  country?:   string
}

interface Props {
  dayIndex:   number
  weekOffset: number
  initial?:   Partial<CustomEvent>   // si viene, el formulario edita ese evento en vez de crear uno nuevo
  onSubmit:   (event: CustomEvent) => void
  onClose:    () => void
}

const COUNTRIES = ['Estados Unidos', 'Eurozona', 'Reino Unido', 'Japón', 'China', 'Otro']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY']
const IMPACTS: { value: EventImpact; label: string; dot: string; desc: string }[] = [
  { value: 'high', label: 'Alto',  dot: 'bg-neg',     desc: 'Mueve mercados. 3 estrellas.' },
  { value: 'med',  label: 'Medio', dot: 'bg-neutral', desc: 'Relevante. 2 estrellas.'      },
  { value: 'low',  label: 'Bajo',  dot: 'bg-base-muted', desc: 'Menor impacto. 1 estrella.'   },
]
const CATEGORIES: { value: NonNullable<MacroEvent['type']>; label: string }[] = [
  { value: 'macro',        label: 'Macro' },
  { value: 'earnings',     label: 'Earnings' },
  { value: 'central-bank', label: 'Banco Central' },
  { value: 'speech',       label: 'Discurso' },
  { value: 'other',        label: 'Otros' },
]
const ASSETS = ['USD', 'NQ', 'GOLD', 'VIX']
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

const EMPTY_KB: KnowledgeEntry = {
  slug: '', name: '', description: '', narrative: '',
  scenarioPositive: '', scenarioNegative: '', scenarioNeutral: '',
  affectedAssets: [], importance: 'med', dependencies: '', comments: '',
  specialRules: [], notes: '',
}

export function EventEditor({ dayIndex, weekOffset, initial, onSubmit, onClose }: Props) {
  const isEdit = !!initial

  const [tab, setTab]             = useState<'catalog' | 'custom'>(isEdit ? 'custom' : 'catalog')
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [customName, setCustomName]   = useState(initial?.name ?? '')
  const [day, setDay]             = useState(dayIndex)
  const [time, setTime]           = useState(initial?.time ?? '08:30')
  const [country, setCountry]     = useState(initial?.country ?? 'Estados Unidos')
  const [currency, setCurrency]   = useState(initial?.currency ?? 'USD')
  const [category, setCategory]   = useState<NonNullable<MacroEvent['type']>>(initial?.type ?? 'macro')
  const [impact, setImpact]       = useState<EventImpact>(initial?.impact ?? 'high')
  const [prev, setPrev]           = useState(initial?.prev != null ? String(initial.prev) : '')
  const [forecast, setForecast]   = useState(initial?.forecast != null ? String(initial.forecast) : '')
  const [actual, setActual]       = useState(initial?.actual != null ? String(initial.actual) : '')
  const [affects, setAffects]     = useState<string[]>(initial?.affects ?? ['USD', 'NQ', 'GOLD'])
  const [notes, setNotes]         = useState(initial?.notes ?? '')
  const [error, setError]         = useState('')

  // ── Knowledge Base — conocimiento permanente sobre este TIPO de evento ──
  const [kb, setKb] = useState<KnowledgeEntry>(() => {
    const found = initial?.name ? knowledgeStore.get(initial.name) : null
    return found ?? { ...EMPTY_KB, name: initial?.name ?? '' }
  })
  const [newRule, setNewRule] = useState('')

  function loadKnowledgeFor(name: string) {
    if (!name) return
    const found = knowledgeStore.get(name)
    setKb(found ?? { ...EMPTY_KB, name })
  }

  // Al elegir un evento del catálogo, cargamos automáticamente su ficha de
  // conocimiento si ya existe (o dejamos una en blanco lista para crear).
  useEffect(() => {
    if (tab === 'catalog' && selectedName) loadKnowledgeFor(selectedName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName])

  const catalogFiltered = selectedCat
    ? EVENT_CATALOG.filter(e => e.category === selectedCat)
    : EVENT_CATALOG

  function toggleAsset(a: string) {
    setAffects(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a],
    )
  }

  function toggleKbAsset(a: string) {
    setKb(prev => {
      const cur = prev.affectedAssets ?? []
      return { ...prev, affectedAssets: cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a] }
    })
  }

  function handleSelectCatalogEvent(name: string) {
    setSelectedName(name)
    const ev = EVENT_CATALOG.find(e => e.name === name)
    if (ev) {
      setImpact(ev.defaultImpact)
      setAffects(ev.affects)
    }
  }

  function addSpecialRule() {
    const r = newRule.trim()
    if (!r) return
    setKb(prev => ({ ...prev, specialRules: [...(prev.specialRules ?? []), r] }))
    setNewRule('')
  }

  function removeSpecialRule(idx: number) {
    setKb(prev => ({ ...prev, specialRules: (prev.specialRules ?? []).filter((_, i) => i !== idx) }))
  }

  function moveSpecialRule(idx: number, direction: 'up' | 'down') {
    setKb(prev => {
      const list = [...(prev.specialRules ?? [])]
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= list.length) return prev
      ;[list[idx], list[swapIdx]] = [list[swapIdx], list[idx]]
      return { ...prev, specialRules: list }
    })
  }

  function handleSubmit() {
    const name = tab === 'catalog' ? selectedName : customName.trim()
    if (!name) { setError('Selecciona o introduce un nombre de evento.'); return }
    setError('')

    // 1. Conocimiento permanente → Knowledge Base (persiste siempre, independiente de la semana)
    knowledgeStore.save({ ...kb, name })

    // 2. Evento de esta semana → EventProvider (vía onSubmit, como antes)
    const customId = initial?.customId ?? initial?.id?.toString() ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`
    onSubmit({
      id:         customId,
      customId,
      name,
      time,
      impact,
      affects,
      forecast:   forecast || null,
      prev:       prev     || null,
      actual:     actual   || null,
      direction:  actual ? undefined : 'pending',
      currency,
      country,
      type:       category,
      notes:      notes    || undefined,
      dayIndex:   day,
      weekOffset,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-base-panel border border-base-line rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-line">
          <div>
            <h2 className="text-sm font-semibold text-base-text">{isEdit ? 'Editar evento' : 'Añadir evento'}</h2>
            <p className="text-xs text-base-muted mt-0.5">
              El motor de análisis interpretará automáticamente el evento
            </p>
          </div>
          <button onClick={onClose} className="text-base-muted hover:text-base-text/85" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* ── EVENTO SEMANAL ── */}
          <p className="card-title">Evento de esta semana</p>

          {/* Tipo: catálogo o personalizado */}
          <div className="flex rounded-lg border border-base-line overflow-hidden">
            <button
              onClick={() => setTab('catalog')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === 'catalog' ? 'bg-base-line text-base-text' : 'text-base-muted hover:text-base-text/85'
              }`}
            >
              Del catálogo
            </button>
            <button
              onClick={() => setTab('custom')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === 'custom' ? 'bg-base-line text-base-text' : 'text-base-muted hover:text-base-text/85'
              }`}
            >
              Evento personalizado
            </button>
          </div>

          {/* Selección de evento */}
          {tab === 'catalog' ? (
            <div className="space-y-2">
              <label className="text-xs text-base-muted">Categoría del catálogo</label>
              <select
                value={selectedCat}
                onChange={e => { setSelectedCat(e.target.value); setSelectedName('') }}
                className="mit-input w-full text-xs"
              >
                <option value="">Todas las categorías</option>
                {EVENT_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <label className="text-xs text-base-muted block mt-2">Evento *</label>
              <select
                value={selectedName}
                onChange={e => handleSelectCatalogEvent(e.target.value)}
                className="mit-input w-full text-xs"
              >
                <option value="">Selecciona un evento…</option>
                {catalogFiltered.map(e => (
                  <option key={e.name} value={e.name}>{e.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs text-base-muted block mb-1">Nombre del evento *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Ej: Trump tariff announcement, ECB meeting…"
                  className="mit-input w-full"
                />
                <button onClick={() => loadKnowledgeFor(customName.trim())} className="btn-ghost text-xs px-3 shrink-0" title="Cargar conocimiento guardado para este nombre exacto">
                  Cargar
                </button>
              </div>
            </div>
          )}

          {/* Día + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-base-muted block mb-1">Día de la semana (fecha)</label>
              <select
                value={day}
                onChange={e => setDay(Number(e.target.value))}
                className="mit-input w-full text-xs"
              >
                {DAY_LABELS.map((l, i) => (
                  <option key={i} value={i}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-base-muted block mb-1">Hora (ET)</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="mit-input w-full"
              />
            </div>
          </div>

          {/* País + Divisa + Categoría */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-base-muted block mb-1">País</label>
              <select value={country} onChange={e => setCountry(e.target.value)} className="mit-input w-full text-xs">
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-base-muted block mb-1">Divisa</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="mit-input w-full text-xs">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-base-muted block mb-1">Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value as NonNullable<MacroEvent['type']>)} className="mit-input w-full text-xs">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Impacto */}
          <div>
            <label className="text-xs text-base-muted block mb-2">Impacto (de esta semana)</label>
            <div className="flex gap-2">
              {IMPACTS.map(i => (
                <button
                  key={i.value}
                  onClick={() => setImpact(i.value)}
                  title={i.desc}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-md border transition-colors ${
                    impact === i.value ? 'bg-base-line border-base-muted text-base-text' : 'border-base-line text-base-muted hover:border-base-muted'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${i.dot}`} />
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          {/* Valores */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-base-muted block mb-1">Anterior (Previous)</label>
              <input type="text" value={prev} onChange={e => setPrev(e.target.value)} placeholder="3.1%" className="mit-input w-full text-xs" />
            </div>
            <div>
              <label className="text-xs text-base-muted block mb-1">Forecast</label>
              <input type="text" value={forecast} onChange={e => setForecast(e.target.value)} placeholder="3.2%" className="mit-input w-full text-xs" />
            </div>
            <div>
              <label className="text-xs text-base-muted block mb-1">Actual</label>
              <input type="text" value={actual} onChange={e => setActual(e.target.value)} placeholder="3.4%" className="mit-input w-full text-xs" />
            </div>
          </div>

          {/* Activos afectados (de esta semana) */}
          <div>
            <label className="text-xs text-base-muted block mb-2">Activos afectados esta semana</label>
            <div className="flex gap-2">
              {ASSETS.map(a => (
                <button key={a} onClick={() => toggleAsset(a)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors font-mono ${
                    affects.includes(a) ? 'bg-base-line border-base-muted text-base-text' : 'border-base-line text-base-muted hover:border-base-muted'
                  }`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Observaciones (de esta semana) */}
          <div>
            <label className="text-xs text-base-muted block mb-1">Observaciones de esta semana</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Contexto puntual: posicionamiento previo, narrativa dominante de esta semana concreta…"
              className="mit-input w-full text-xs resize-none"
            />
          </div>

          {/* ── KNOWLEDGE BASE — conocimiento permanente ── */}
          <div className="border-t-2 border-neutral/40 pt-4 space-y-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-neutral uppercase tracking-widest font-semibold"><Brain size={13} /> Knowledge Base — conocimiento permanente</p>
              <p className="text-xs text-base-muted mt-1">
                No pertenece a esta semana. Se guarda por nombre de evento y se reutiliza automáticamente
                la próxima vez que aparezca "{tab === 'catalog' ? selectedName || '…' : customName || '…'}".
              </p>
            </div>

            <div>
              <label className="text-xs text-base-muted block mb-1">Descripción</label>
              <textarea value={kb.description ?? ''} onChange={e => setKb(p => ({ ...p, description: e.target.value }))}
                rows={2} placeholder="Qué mide este evento, cómo se calcula…" className="mit-input w-full text-xs resize-none" />
            </div>

            <div>
              <label className="text-xs text-base-muted block mb-1">Narrativa</label>
              <textarea value={kb.narrative ?? ''} onChange={e => setKb(p => ({ ...p, narrative: e.target.value }))}
                rows={2} placeholder="Cómo interpreta el mercado este evento en general…" className="mit-input w-full text-xs resize-none" />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="text-xs text-pos block mb-1">Escenario positivo</label>
                <textarea value={kb.scenarioPositive ?? ''} onChange={e => setKb(p => ({ ...p, scenarioPositive: e.target.value }))}
                  rows={2} className="mit-input w-full text-xs resize-none" />
              </div>
              <div>
                <label className="text-xs text-neg block mb-1">Escenario negativo</label>
                <textarea value={kb.scenarioNegative ?? ''} onChange={e => setKb(p => ({ ...p, scenarioNegative: e.target.value }))}
                  rows={2} className="mit-input w-full text-xs resize-none" />
              </div>
              <div>
                <label className="text-xs text-base-muted block mb-1">Escenario neutral</label>
                <textarea value={kb.scenarioNeutral ?? ''} onChange={e => setKb(p => ({ ...p, scenarioNeutral: e.target.value }))}
                  rows={2} className="mit-input w-full text-xs resize-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-base-muted block mb-2">Activos afectados (permanente)</label>
                <div className="flex flex-wrap gap-2">
                  {ASSETS.map(a => (
                    <button key={a} onClick={() => toggleKbAsset(a)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors font-mono ${
                        (kb.affectedAssets ?? []).includes(a) ? 'bg-neutral-dim/40 border-neutral text-neutral' : 'border-base-line text-base-muted hover:border-base-muted'
                      }`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-base-muted block mb-1">Importancia</label>
                <select value={kb.importance ?? 'med'} onChange={e => setKb(p => ({ ...p, importance: e.target.value as EventImpact }))} className="mit-input w-full text-xs">
                  <option value="high">Alta</option>
                  <option value="med">Media</option>
                  <option value="low">Baja</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-base-muted block mb-1">Dependencias</label>
              <input type="text" value={kb.dependencies ?? ''} onChange={e => setKb(p => ({ ...p, dependencies: e.target.value }))}
                placeholder="Ej: se interpreta junto al Core PCE del mismo mes" className="mit-input w-full text-xs" />
            </div>

            <div>
              <label className="text-xs text-base-muted block mb-1">Comentarios</label>
              <textarea value={kb.comments ?? ''} onChange={e => setKb(p => ({ ...p, comments: e.target.value }))}
                rows={2} className="mit-input w-full text-xs resize-none" />
            </div>

            {/* Reglas especiales — instrucciones para el Mentor IA */}
            <div>
              <label className="text-xs text-base-text/85 font-medium block mb-1">Reglas especiales</label>
              <p className="text-xs text-base-muted mb-2">
                Instrucciones de interpretación que el Mentor IA aplicará siempre que analice este tipo de evento.
              </p>

              {(kb.specialRules ?? []).length > 0 && (
                <ul className="space-y-1.5 mb-2">
                  {(kb.specialRules ?? []).map((r, i) => (
                    <li key={i} className="flex items-start gap-2 bg-base-panel2/50 border border-base-line rounded px-2.5 py-1.5">
                      <span className="text-xs text-base-text/85 flex-1 leading-snug">{r}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => moveSpecialRule(i, 'up')} disabled={i===0} className="text-xs text-base-muted hover:text-base-text/85 disabled:opacity-20">▲</button>
                        <button onClick={() => moveSpecialRule(i, 'down')} disabled={i===(kb.specialRules?.length ?? 0)-1} className="text-xs text-base-muted hover:text-base-text/85 disabled:opacity-20">▼</button>
                        <button onClick={() => removeSpecialRule(i)} className="text-base-muted hover:text-neg" aria-label="Eliminar regla"><X size={12} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <input type="text" value={newRule} onChange={e => setNewRule(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpecialRule() } }}
                  placeholder='Ej: "Dar más peso al Core PCE que al GDP."' className="mit-input flex-1 text-xs" />
                <button onClick={addSpecialRule} className="btn-ghost text-xs px-3">+ Añadir</button>
              </div>
            </div>

            <div>
              <label className="text-xs text-base-muted block mb-1">Notas</label>
              <textarea value={kb.notes ?? ''} onChange={e => setKb(p => ({ ...p, notes: e.target.value }))}
                rows={2} className="mit-input w-full text-xs resize-none" />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-neg bg-neg-dim/30 border border-neg/40 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit} className="btn-primary flex-1">
              {isEdit ? 'Guardar cambios' : 'Añadir evento y analizar'}
            </button>
            <button onClick={onClose} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}