// ─────────────────────────────────────────────
//  Filtros de ciclo y Mapa para Métricas, Calendario y Consistencia
//  (los mismos que en Portafolio).
//
//  useAccountGroupFilter recorta cuentas y trades al grupo elegido;
//  la página sigue usando sus propios filtros sobre ese resultado. Sin
//  filtro devuelve las mismas listas, así que nada cambia.
// ─────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { accountInGroup, cycleOptions, mapOptions } from '@/lib/accountGroups'
import { useAccountBlueprintStore } from '@/store/useAccountBlueprintStore'
import { useBlueprintsList } from '@/store/useBlueprintsStore'

export function useAccountGroupFilter(trades, accounts) {
  const [cycle, setCycle] = useState('all')
  const [map, setMap] = useState('all')
  const assignments = useAccountBlueprintStore(s => s.assignments)
  const blueprints = useBlueprintsList()
  const active = cycle !== 'all' || map !== 'all'
  const groupAccounts = useMemo(
    () => (active ? (accounts || []).filter(a => accountInGroup(a, { cycle, map, assignments, blueprints })) : accounts),
    [accounts, cycle, map, active, assignments, blueprints]
  )
  const groupTrades = useMemo(() => {
    if (!active) return trades
    const ids = new Set(groupAccounts.map(a => a.id))
    return (trades || []).filter(t => ids.has(t.accountId))
  }, [trades, groupAccounts, active])
  return { cycle, setCycle, map, setMap, active, groupAccounts, groupTrades }
}

// Dos selectores con el mismo aspecto que el de "Cuenta" de cada página.
// onChange avisa para que la página pueda volver "Cuenta" a Todas.
export function GroupFilterSelects({ accounts, group, onChange, compact }) {
  const cycles = useMemo(() => cycleOptions(accounts || []), [accounts])
  const assignments = useAccountBlueprintStore(s => s.assignments)
  const blueprints = useBlueprintsList()
  const maps = useMemo(() => mapOptions(accounts || [], assignments, blueprints), [accounts, assignments, blueprints])
  const wrap = compact ? { marginBottom: 0 } : { marginBottom: 0, width: 190, flex: '0 0 190px' }
  return (<>
    <div className="form-group" style={wrap}>
      <label>Ciclo</label>
      <select value={group.cycle} onChange={e => { group.setCycle(e.target.value); onChange?.() }}>
        <option value="all">Todos los ciclos</option>
        {cycles.map(c => <option key={c.label} value={c.label}>{c.label} ({c.count})</option>)}
      </select>
    </div>
    <div className="form-group" style={wrap}>
      <label>Mapa</label>
      <select value={group.map} onChange={e => { group.setMap(e.target.value); onChange?.() }}>
        <option value="all">Todos los mapas</option>
        {maps.map(m => <option key={m.value} value={m.value}>{m.label} ({m.count})</option>)}
      </select>
    </div>
  </>)
}
