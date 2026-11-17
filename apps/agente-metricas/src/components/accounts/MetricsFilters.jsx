// ─────────────────────────────────────────────
//  Filtros de Métricas (rediseño 01/11/2026, opción B)
//
//  A la vista quedan Cuenta y Período (los pone cada página). El resto
//  va en el botón "Filtros · N": Tipo de cuenta, Mercado, Estado (si la
//  página lo usa: status/setStatus) y, con plan
//  Intermedio+ (features.js → cycles), Ciclo y Mapa.
//  ActiveFilterTags muestra lo activo como etiquetas con ✕ en la misma
//  fila, a la derecha del botón, para que siempre se vea qué está filtrado.
//
//  Ciclo y Mapa salen de useAccountGroupFilter (GroupFilters.jsx).
// ─────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Chips } from '@/components/accounts/accountFormShared'
import { ACCOUNT_TYPE_FILTER_OPTIONS, ACCOUNT_STATUS_FILTER_OPTIONS, MARKET_FILTER_OPTIONS } from '@/components/accounts/metricsFilterOptions'
import { cycleOptions, mapOptions } from '@/lib/accountGroups'
import { useAccountBlueprintStore } from '@/store/useAccountBlueprintStore'
import { useBlueprintsList } from '@/store/useBlueprintsStore'
import { useHasFeature } from '@/store/useStore'

// Etiquetas largas para las etiquetas activas (los chips usan "Eval")
const TYPE_TAG = { Challenge: 'Challenge / Eval', Funded: 'Fondeada', Personal: 'Capital real' }

function useMapOptions(accounts) {
  const assignments = useAccountBlueprintStore(s => s.assignments)
  const blueprints = useBlueprintsList()
  return useMemo(() => mapOptions(accounts || [], assignments, blueprints), [accounts, assignments, blueprints])
}

/** Lista de filtros activos: [{ key, label, clear }] */
function useActiveFilters({ accountType, setAccountType, market, setMarket, status, setStatus, group, accounts, onScopeChange }) {
  const groupsEnabled = useHasFeature('cycles')
  const maps = useMapOptions(accounts)
  const list = []
  const wrap = (fn) => () => { fn(); onScopeChange?.() }
  if (accountType !== 'all') list.push({ key: 'type', label: TYPE_TAG[accountType] || accountType, clear: wrap(() => setAccountType('all')) })
  if (market !== 'all') list.push({ key: 'market', label: MARKET_FILTER_OPTIONS.find(o => o.value === market)?.label || market, clear: wrap(() => setMarket('all')) })
  if (setStatus && status !== 'all') list.push({ key: 'status', label: ACCOUNT_STATUS_FILTER_OPTIONS.find(o => o.value === status)?.label || status, clear: wrap(() => setStatus('all')) })
  if (groupsEnabled && group.cycle !== 'all') list.push({ key: 'cycle', label: group.cycle, clear: wrap(() => group.setCycle('all')) })
  if (groupsEnabled && group.map !== 'all') list.push({ key: 'map', label: maps.find(m => m.value === group.map)?.label || 'Mapa', clear: wrap(() => group.setMap('all')) })
  return list
}

export function MetricsFiltersButton(props) {
  const { accountType, setAccountType, market, setMarket, status, setStatus, group, accounts, onScopeChange } = props
  const groupsEnabled = useHasFeature('cycles')
  const active = useActiveFilters(props)
  const cycles = useMemo(() => cycleOptions(accounts || []), [accounts])
  const maps = useMapOptions(accounts)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const change = (fn) => (v) => { fn(v); onScopeChange?.() }
  const n = active.length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`btn btn-sm ${n ? '' : 'btn-ghost'}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 34,
          // Activo: gris sobrio (como el resto de filtros), sin verde
          ...(n && { background: 'var(--bg3)', border: '1px solid var(--border3)', color: 'var(--text)' }),
        }}
      >
        <SlidersHorizontal size={13} /> Filtros{n ? ` · ${n}` : ''}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, width: 340, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 14,
          background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-lg)',
        }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Tipo de cuenta</label>
            <Chips size="xs" label="Tipo de cuenta" value={accountType} options={ACCOUNT_TYPE_FILTER_OPTIONS} onChange={change(setAccountType)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Mercado</label>
            <Chips size="xs" label="Mercado" value={market} options={MARKET_FILTER_OPTIONS} onChange={change(setMarket)} />
          </div>
          {setStatus && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Estado</label>
              <Chips size="xs" label="Estado" value={status} options={ACCOUNT_STATUS_FILTER_OPTIONS} onChange={change(setStatus)} />
            </div>
          )}
          {groupsEnabled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 14, borderTop: '1px solid var(--border2)' }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 0 }}>
                <label>Ciclo</label>
                <select value={group.cycle} onChange={e => change(group.setCycle)(e.target.value)}>
                  <option value="all">Todos</option>
                  {cycles.map(c => <option key={c.label} value={c.label}>{c.label} ({c.count})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 0 }}>
                <label>Mapa</label>
                <select value={group.map} onChange={e => change(group.setMap)(e.target.value)}>
                  <option value="all">Todos</option>
                  {maps.map(m => <option key={m.value} value={m.value}>{m.label} ({m.count})</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ActiveFilterTags(props) {
  const active = useActiveFilters(props)
  if (!active.length) return null
  const clearAll = () => active.forEach(f => f.clear())
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 34 }}>
      {active.map(f => (
        // Tag terciario ghost del styleguide (.tag-ghost) + ✕ para quitar
        <span key={f.key} className="tag tag-ghost" style={{ gap: 4, paddingRight: 4 }}>
          {f.label}
          <button type="button" onClick={f.clear} aria-label={`Quitar ${f.label}`} title="Quitar"
            style={{ display: 'inline-flex', background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'inherit' }}>
            <X size={12} />
          </button>
        </span>
      ))}
      {active.length > 1 && (
        <button type="button" onClick={clearAll}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, textDecoration: 'underline', padding: '0 4px' }}>
          Limpiar
        </button>
      )}
    </div>
  )
}
