import { useState } from 'react'
import { Pencil, Trash2, Check, Plus } from 'lucide-react'
import { Card, PageHeader, ProgressBar } from '@/components/ui'
import { PRE_SESSION_BLOCKS, POST_SESSION_BLOCKS } from '@/data/dailyRoutineBlocks'
import { useDailyRoutineStore, useDailyRoutineItems } from '@/store/useDailyRoutineStore'

// ─────────────────────────────────────────────
//  DAILY ROUTINE — Sprint 20
//  Centro de Alto Rendimiento: el ritual diario del trader.
//
//  No mide resultados: construye disciplina. Sustituye
//  definitivamente al antiguo "Approach".
//
//  Arquitectura preparada: Blueprints, Training, Trader Score y
//  Mentor IA podrán leer useDailyRoutineItems() en el futuro para
//  conocer el cumplimiento de la rutina, sin cambios en este archivo.
// ─────────────────────────────────────────────

/**
 * ChecklistRow — un elemento del checklist: marcar, editar, eliminar.
 */
function ChecklistRow({ item, onToggle, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.text)

  const commit = () => {
    const trimmed = text.trim()
    if (trimmed) onEdit(trimmed)
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="checkbox"
        checked={item.checked}
        onChange={onToggle}
        style={{ width: 'auto', flexShrink: 0 }}
      />
      {editing ? (
        <input
          autoFocus
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          onBlur={commit}
          style={{ flex: 1 }}
        />
      ) : (
        <span
          style={{
            flex: 1, fontSize: 11.5,
            color: item.checked ? 'var(--text3)' : 'var(--text2)',
            textDecoration: item.checked ? 'line-through' : 'none',
          }}
        >
          {item.text}
        </span>
      )}
      <button
        className="btn btn-ghost btn-sm"
        style={{ padding: '4px 7px' }}
        onClick={() => setEditing(true)}
        aria-label="Editar elemento"
      >
        <Pencil size={11} />
      </button>
      <button
        className="btn btn-ghost btn-sm"
        style={{ padding: '4px 7px' }}
        onClick={onDelete}
        aria-label="Eliminar elemento"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

/**
 * ChecklistBlock — un bloque completo (Emotional Management, Execution, etc.)
 * Checklist siempre abierto: sin acordeones ni contenido colapsado.
 */
function ChecklistBlock({ block, items, onAdd, onEdit, onDelete, onToggle }) {
  const [newText, setNewText] = useState('')

  const completed = items.filter(i => i.checked).length
  const pct = items.length ? Math.round((completed / items.length) * 100) : 0

  const handleAdd = () => {
    const trimmed = newText.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setNewText('')
  }

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <block.icon size={24} style={{ color: 'var(--brand)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{block.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{completed}/{items.length} completado</div>
        </div>
        <div style={{ width: 60 }}>
          <ProgressBar value={pct} max={100} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {items.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sin elementos todavía. Añade el primero abajo.</span>
        )}
        {items.map(item => (
          <ChecklistRow
            key={item.id}
            item={item}
            onToggle={() => onToggle(item.id)}
            onEdit={(text) => onEdit(item.id, text)}
            onDelete={() => onDelete(item.id)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          placeholder="Añadir elemento…"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          style={{ flex: 1 }}
        />
        <button className="btn btn-secondary btn-sm" onClick={handleAdd}>
          <Plus size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
          Añadir
        </button>
      </div>
    </Card>
  )
}

/**
 * SessionColumn — columna PRE SESSION o POST SESSION
 */
function SessionColumn({ title, subtitle, blocks, routineItems, addItem, editItem, deleteItem, toggleItem }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '1px', color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{subtitle}</div>
      </div>
      {blocks.map(block => (
        <ChecklistBlock
          key={block.id}
          block={block}
          items={routineItems[block.id] || []}
          onAdd={(text) => addItem(block.id, text)}
          onEdit={(itemId, text) => editItem(block.id, itemId, text)}
          onDelete={(itemId) => deleteItem(block.id, itemId)}
          onToggle={(itemId) => toggleItem(block.id, itemId)}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────
export default function DailyRoutine() {
  const routineItems = useDailyRoutineItems()
  const addItem = useDailyRoutineStore(s => s.addItem)
  const editItem = useDailyRoutineStore(s => s.editItem)
  const deleteItem = useDailyRoutineStore(s => s.deleteItem)
  const toggleItem = useDailyRoutineStore(s => s.toggleItem)

  const allItems = Object.values(routineItems).flat()
  const overallPct = allItems.length
    ? Math.round((allItems.filter(i => i.checked).length / allItems.length) * 100)
    : 0

  return (
    <div className="page-inner">
      <PageHeader
        title="Rutina Diaria"
        subtitle="Tu ritual diario de alto rendimiento. No mide resultados: construye disciplina."
      />

      <div style={{ marginBottom: 28 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ minWidth: 90 }}>
              <div style={{ fontSize: 9.5, color: 'var(--text3)' }}>Rutina de hoy</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{overallPct}%</div>
            </div>
            <div style={{ flex: 1 }}>
              <ProgressBar value={overallPct} max={100} />
            </div>
            <Check size={18} style={{ color: overallPct === 100 ? 'var(--pos)' : 'var(--text3)' }} />
          </div>
        </Card>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28,
      }}>
        <SessionColumn
          title="PRE SESSION"
          subtitle="Antes de operar"
          blocks={PRE_SESSION_BLOCKS}
          routineItems={routineItems}
          addItem={addItem} editItem={editItem} deleteItem={deleteItem} toggleItem={toggleItem}
        />
        <SessionColumn
          title="POST SESSION"
          subtitle="Después de operar"
          blocks={POST_SESSION_BLOCKS}
          routineItems={routineItems}
          addItem={addItem} editItem={editItem} deleteItem={deleteItem} toggleItem={toggleItem}
        />
      </div>
    </div>
  )
}
