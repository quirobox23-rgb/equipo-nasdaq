// ─────────────────────────────────────────────
//  Ciclos en Portafolio (rediseño 01/11/2026)
//
//  · CycleFilterButton: botón "Ciclo" con menú (filtrar, Nuevo ciclo,
//    Gestionar ciclos). Reemplaza al "Avanzado" de Portafolio.
//  · CycleDialog: crear o editar un ciclo (nombre + cuentas) con botón
//    Guardar explícito.
//  · CyclesManageDialog: lista de ciclos para editar o borrar.
//  · Toast: aviso corto de confirmación ("Ciclo X guardado").
//
//  El ciclo se sigue guardando en cada cuenta (account.cycle) y los
//  ciclos vacíos en useCyclesStore, igual que el CyclesManager de Bego
//  (que queda en uso en Inversión y retiros).
// ─────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import { Layers, ChevronDown, Check, X, Plus, Settings2, Pencil, Trash2, CircleCheck } from 'lucide-react'
import { useAccounts, useStore } from '@/store/useStore'
import { useCyclesStore, useAllCycleNames } from '@/store/useCyclesStore'
import { cycleName, NO_CYCLE } from '@/lib/accountGroups'

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const accountTitle = (a) => {
  if (a.name?.trim()) return a.name.trim()
  const size = a.size >= 1000 ? `${Math.round(a.size / 1000)}K` : a.size
  return [a.firm, size, a.type].filter(Boolean).join(' ')
}

/** Ciclos (también los vacíos) con cuántas cuentas tiene cada uno. */
function useCyclesWithCounts() {
  const accounts = useAccounts()
  const names = useAllCycleNames()
  return useMemo(() => names.map(name => ({
    name, count: accounts.filter(a => same(cycleName(a), name)).length,
  })), [accounts, names])
}

/** Cierra al hacer clic afuera o con Escape. */
function useDismiss(open, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, onClose])
  return ref
}

const menuBox = {
  position: 'absolute', zIndex: 60, minWidth: 240, padding: 6,
  background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-lg)',
}
const menuItem = (on) => ({
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', borderRadius: 6,
  background: on ? 'var(--bg3)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  color: on ? 'var(--text)' : 'var(--text2)', fontSize: 13, fontFamily: 'var(--font)',
})
const countTag = { marginLeft: 'auto', paddingLeft: 12, fontSize: 11, color: 'var(--text3)' }
const sep = { borderTop: '1px solid var(--border2)', margin: '6px 0' }

function MenuItem({ on, icon, children, count, onClick }) {
  return (
    <button type="button" style={menuItem(on)} onClick={onClick}
      onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg3)' }}
      onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'none' }}>
      <span style={{ width: 14, display: 'inline-flex', color: 'var(--brand)' }}>{icon}</span>
      {children}
      {count !== undefined && <span style={countTag}>{count} cuenta{count === 1 ? '' : 's'}</span>}
    </button>
  )
}

// ── Botón "Ciclo" de la barra de filtros ──────
export function CycleFilterButton({ value, onChange, onNew, onManage }) {
  const accounts = useAccounts()
  const cycles = useCyclesWithCounts()
  const noCycle = accounts.filter(a => !cycleName(a)).length
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const active = value !== 'all'
  const pick = (v) => { onChange(v); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className={`btn btn-sm ${active ? '' : 'btn-ghost'}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          // Activo: gris sobrio, igual que "Filtros" de Métricas
          ...(active && { background: 'var(--bg3)', border: '1px solid var(--border3)', color: 'var(--text)' }),
        }}
      >
        <Layers size={13} />
        {active ? value : 'Ciclos'}
        {active ? (
          <span role="button" aria-label="Quitar filtro de ciclo" title="Quitar filtro"
            onClick={e => { e.stopPropagation(); onChange('all'); setOpen(false) }}
            style={{ display: 'inline-flex', marginLeft: 2 }}>
            <X size={13} />
          </span>
        ) : (
          <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} />
        )}
      </button>
      {open && (
        <div style={{ ...menuBox, top: 'calc(100% + 6px)', left: 0 }}>
          <MenuItem on={!active} icon={!active && <Check size={13} />} onClick={() => pick('all')}>Todos los ciclos</MenuItem>
          {cycles.map(c => (
            <MenuItem key={c.name} on={active && same(value, c.name)} icon={active && same(value, c.name) && <Check size={13} />}
              count={c.count} onClick={() => pick(c.name)}>{c.name}</MenuItem>
          ))}
          {cycles.length > 0 && noCycle > 0 && (
            <MenuItem on={same(value, NO_CYCLE)} icon={same(value, NO_CYCLE) && <Check size={13} />}
              count={noCycle} onClick={() => pick(NO_CYCLE)}>{NO_CYCLE}</MenuItem>
          )}
          {cycles.length === 0 && (
            <div style={{ padding: '6px 10px 8px 32px', fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
              Agrupá las cuentas que compraste juntas para seguirlas como un ciclo.
            </div>
          )}
          <div style={sep} />
          <MenuItem icon={<Plus size={13} style={{ color: 'var(--text2)' }} />} onClick={() => { setOpen(false); onNew() }}>Nuevo ciclo</MenuItem>
          {cycles.length > 0 && (
            <MenuItem icon={<Settings2 size={13} style={{ color: 'var(--text2)' }} />} onClick={() => { setOpen(false); onManage() }}>Gestionar ciclos</MenuItem>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal base ────────────────────────────────
function Modal({ title, onClose, children, footer, width = 460 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)', padding: 20, whiteSpace: 'normal' }}
      onMouseDown={onClose}
    >
      <div className="card" role="dialog" aria-label={title}
        style={{ width: '100%', maxWidth: width, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0 }}
        onMouseDown={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 12px' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>{title}</div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar"><X size={14} /></button>
        </div>
        <div style={{ padding: '0 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px 18px', borderTop: '1px solid var(--border)' , marginTop: 14 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

const fieldLabel = { display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }

// ── Crear / editar un ciclo ───────────────────
// cycle: null = ciclo nuevo; nombre = editar ese ciclo.
export function CycleDialog({ cycle = null, onClose, onSaved }) {
  const accounts = useAccounts()
  const updateAccount = useStore(s => s.updateAccount)
  const names = useAllCycleNames()
  const { addCycle, renameCycle } = useCyclesStore.getState()
  const isNew = !cycle
  const [name, setName] = useState(cycle || '')
  const [selected, setSelected] = useState(() => new Set(
    isNew ? [] : accounts.filter(a => same(cycleName(a), cycle)).map(a => a.id)
  ))
  const [error, setError] = useState('')

  const toggle = (id) => setSelected(s => {
    const next = new Set(s)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const save = () => {
    const n = name.trim()
    if (!n) return setError('Poné un nombre al ciclo')
    if (same(n, NO_CYCLE)) return setError(`"${NO_CYCLE}" está reservado. Elegí otro nombre`)
    if (names.some(x => same(x, n) && !(cycle && same(x, cycle)))) return setError('Ya tenés un ciclo con ese nombre')
    accounts.forEach(a => {
      const inside = cycle ? same(cycleName(a), cycle) : false
      const want = selected.has(a.id)
      if (want && cycleName(a) !== n) updateAccount(a.id, { cycle: n })
      else if (!want && inside) updateAccount(a.id, { cycle: '' })
    })
    if (cycle && !same(cycle, n)) renameCycle(cycle, n)
    addCycle(n) // que siga existiendo aunque quede sin cuentas
    onSaved?.(`Ciclo ${n} guardado · ${selected.size} cuenta${selected.size === 1 ? '' : 's'}`, n)
    onClose()
  }

  return (
    <Modal
      title={isNew ? 'Nuevo ciclo' : 'Editar ciclo'}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={save}>Guardar ciclo</button>
      </>}
    >
      <label style={fieldLabel}>Nombre</label>
      <input type="text" autoFocus placeholder="Ciclo Octubre, Black Friday…" value={name}
        onChange={e => { setName(e.target.value); setError('') }}
        onKeyDown={e => e.key === 'Enter' && save()} />
      {error && <div style={{ fontSize: 12, color: 'var(--neg)', marginTop: 6 }}>{error}</div>}

      <label style={{ ...fieldLabel, marginTop: 16 }}>Cuentas del ciclo · {selected.size}</label>
      <div style={{ border: '1px solid var(--border2)', borderRadius: 8, padding: '4px 12px' }}>
        {accounts.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Todavía no tenés cuentas.</div>}
        {accounts.map(a => {
          const other = cycleName(a) && !(cycle && same(cycleName(a), cycle)) ? cycleName(a) : null
          return (
            <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)}
                style={{ width: 'auto', accentColor: 'var(--brand)' }} />
              <span style={{ color: 'var(--text)' }}>{accountTitle(a)}</span>
              {other && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text3)' }}>en {other}</span>}
            </label>
          )
        })}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: '8px 0 0', lineHeight: 1.5 }}>
        Una cuenta va en un solo ciclo: si ya estaba en otro, pasa a este.
      </p>
    </Modal>
  )
}

// ── Lista de ciclos: editar o borrar ──────────
export function CyclesManageDialog({ onClose, onEdit, onNew, onToast }) {
  const accounts = useAccounts()
  const updateAccount = useStore(s => s.updateAccount)
  const { removeCycle } = useCyclesStore.getState()
  const cycles = useCyclesWithCounts()

  const remove = (name, count) => {
    if (count && !window.confirm(`¿Borrar el ciclo "${name}"? Sus ${count} cuenta${count === 1 ? '' : 's'} quedan sin ciclo (no se borra ninguna cuenta).`)) return
    accounts.filter(a => same(cycleName(a), name)).forEach(a => updateAccount(a.id, { cycle: '' }))
    removeCycle(name)
    onToast?.(`Ciclo ${name} borrado`)
  }

  return (
    <Modal
      title="Gestionar ciclos"
      onClose={onClose}
      footer={<button type="button" className="btn btn-sm" onClick={onNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={13} /> Nuevo ciclo</button>}
    >
      {cycles.length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>Todavía no tenés ciclos.</div>}
      {cycles.map(c => (
        <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <Layers size={14} style={{ color: 'var(--text3)' }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{c.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>· {c.count} cuenta{c.count === 1 ? '' : 's'}</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(c.name)} aria-label={`Editar ${c.name}`} title="Editar nombre y cuentas"><Pencil size={13} /></button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(c.name, c.count)} aria-label={`Borrar ${c.name}`} title="Borrar ciclo"><Trash2 size={13} /></button>
          </span>
        </div>
      ))}
    </Modal>
  )
}

// ── Aviso de confirmación ─────────────────────
export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [message, onDone])
  if (!message) return null
  return (
    <div role="status" style={{
      position: 'fixed', right: 24, bottom: 24, zIndex: 1200, display: 'flex', alignItems: 'center', gap: 8,
      padding: '11px 14px', background: 'var(--bg2)', border: '1px solid var(--brand)', borderRadius: 'var(--r)',
      boxShadow: 'var(--shadow-lg)', fontSize: 13, color: 'var(--text)',
    }}>
      <CircleCheck size={16} style={{ color: 'var(--brand)' }} /> {message}
    </div>
  )
}
