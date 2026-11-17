// ─────────────────────────────────────────────
//  Gestionar ciclos: crear, renombrar y borrar ciclos, y elegir qué
//  cuentas van en cada uno. El ciclo se guarda en cada cuenta
//  (account.cycle), así que viaja a la nube con la cuenta.
// ─────────────────────────────────────────────
import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, X, Check } from 'lucide-react'
import { useAccounts, useStore } from '@/store/useStore'
import { useCyclesStore, useAllCycleNames } from '@/store/useCyclesStore'
import { cycleName } from '@/lib/accountGroups'

const accountTitle = (a) => {
  if (a.name?.trim()) return a.name.trim()
  const size = a.size >= 1000 ? `${Math.round(a.size / 1000)}K` : a.size
  return [a.firm, size, a.type].filter(Boolean).join(' ')
}
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

export default function CyclesManager({ onClose }) {
  const accounts = useAccounts()
  const updateAccount = useStore(s => s.updateAccount)
  const { addCycle, removeCycle, renameCycle } = useCyclesStore.getState()
  const names = useAllCycleNames()
  const [newName, setNewName] = useState('')
  const [open, setOpen] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editValue, setEditValue] = useState('')

  const inCycle = (name) => accounts.filter(a => same(cycleName(a), name))
  const exists = (name) => names.some(n => same(n, name))

  const create = () => {
    const n = newName.trim()
    if (!n || exists(n)) return
    addCycle(n); setNewName(''); setOpen(n)
  }
  const rename = (from) => {
    const to = editValue.trim()
    setEditing(null)
    if (!to || same(to, from)) return
    inCycle(from).forEach(a => updateAccount(a.id, { cycle: to }))
    renameCycle(from, to)
    if (!exists(to)) addCycle(to)
    if (open && same(open, from)) setOpen(to)
  }
  const remove = (name) => {
    const n = inCycle(name).length
    if (n && !window.confirm(`¿Borrar el ciclo "${name}"? Sus ${n} cuenta${n === 1 ? '' : 's'} quedan sin ciclo (no se borra ninguna cuenta).`)) return
    inCycle(name).forEach(a => updateAccount(a.id, { cycle: '' }))
    removeCycle(name)
  }
  const toggle = (account, name) => {
    const inside = same(cycleName(account), name)
    if (!inside) addCycle(name) // que el ciclo siga existiendo si luego se vacía
    updateAccount(account.id, { cycle: inside ? '' : name })
  }

  return (
    <div
      style={{ position: 'fixed', whiteSpace: 'normal', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)', padding: 20 }}
      onClick={onClose}
    >
      <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Ciclos</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar"><X size={14} /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>
          Agrupá tus cuentas por ciclo de compra con el nombre que quieras. Abrí un ciclo para elegir sus cuentas.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input type="text" placeholder="Nombre del ciclo nuevo (Black Friday, Ciclo 1…)" value={newName}
            onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={create} disabled={!newName.trim() || exists(newName)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={13} /> Crear
          </button>
        </div>
        {newName.trim() && exists(newName) && (
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: -10, marginBottom: 12 }}>Ese ciclo ya existe.</div>
        )}

        {names.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '12px 0' }}>Todavía no tenés ciclos.</div>
        )}

        {names.map(name => {
          const list = inCycle(name)
          const isOpen = open && same(open, name)
          return (
            <div key={name} style={{ border: '1px solid var(--border2)', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                {editing && same(editing, name) ? (
                  <>
                    <input type="text" autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') rename(name); if (e.key === 'Escape') setEditing(null) }}
                      style={{ flex: 1 }} />
                    <button className="btn btn-ghost btn-sm" onClick={() => rename(name)} aria-label="Guardar nombre"><Check size={13} /></button>
                  </>
                ) : (
                  <button onClick={() => setOpen(isOpen ? null : name)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
                      color: 'var(--text)', cursor: 'pointer', textAlign: 'left', padding: 0, fontSize: 13.5, fontWeight: 600 }}>
                    <ChevronDown size={13} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms', color: 'var(--text3)' }} />
                    {name}
                    <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text3)' }}>· {list.length} cuenta{list.length === 1 ? '' : 's'}</span>
                  </button>
                )}
                {!(editing && same(editing, name)) && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(name); setEditValue(name) }} aria-label="Renombrar"><Pencil size={13} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(name)} aria-label="Borrar ciclo"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border2)', padding: '6px 10px 10px' }}>
                  {accounts.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', padding: '6px 0' }}>No tenés cuentas todavía.</div>}
                  {accounts.map(a => {
                    const other = cycleName(a) && !same(cycleName(a), name) ? cycleName(a) : null
                    return (
                      <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5, cursor: 'pointer' }}>
                        <input type="checkbox" checked={same(cycleName(a), name)} onChange={() => toggle(a, name)} style={{ width: 'auto' }} />
                        <span style={{ color: 'var(--text)' }}>{accountTitle(a)}</span>
                        {other && <span style={{ color: 'var(--text3)', fontSize: 11.5 }}>(ahora en {other})</span>}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
