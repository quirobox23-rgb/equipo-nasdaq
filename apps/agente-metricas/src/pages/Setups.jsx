import { useState, useMemo } from 'react'
import { Card, PageHeader, Badge, IconCircle } from '@/components/ui'
import { useSetups, useTrades, useStore } from '@/store/useStore'

export default function Setups() {
  const setups      = useSetups()
  const trades      = useTrades()
  const addSetup    = useStore(s => s.addSetup)
  const updateSetup = useStore(s => s.updateSetup)
  const deleteSetup = useStore(s => s.deleteSetup)

  const [showAdd,  setShowAdd]  = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [form,     setForm]     = useState({ name: '', description: '' })
  const [error,    setError]    = useState('')

  // Stats per setup from real trades
  const statsMap = useMemo(() => {
    const map = {}
    trades.forEach(t => {
      const k = t.setup || ''
      if (!map[k]) map[k] = { wins: 0, losses: 0, totalR: 0, total: 0 }
      map[k].total++
      map[k].totalR = parseFloat((map[k].totalR + t.rPnl).toFixed(2))
      if (t.result === 'win')  map[k].wins++
      if (t.result === 'loss') map[k].losses++
    })
    return map
  }, [trades])

  const getStats = (name) => {
    const s = statsMap[name] ?? { wins: 0, losses: 0, totalR: 0, total: 0 }
    return { ...s, wr: s.total ? Math.round(s.wins / s.total * 100) : 0 }
  }

  const startAdd = () => {
    setEditId(null)
    setForm({ name: '', description: '' })
    setError('')
    setShowAdd(true)
  }

  const startEdit = (setup) => {
    setShowAdd(false)
    setEditId(setup.id)
    setForm({ name: setup.name, description: setup.description })
    setError('')
  }

  const handleSave = () => {
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    if (setups.some(s => s.name.toLowerCase() === form.name.trim().toLowerCase() && s.id !== editId)) {
      setError('Ya existe un setup con ese nombre'); return
    }
    setError('')
    if (editId) {
      updateSetup(editId, { name: form.name.trim(), description: form.description })
      setEditId(null)
    } else {
      addSetup({ name: form.name.trim(), description: form.description })
      setShowAdd(false)
    }
    setForm({ name: '', description: '' })
  }

  const handleDelete = (id, name) => {
    const count = trades.filter(t => t.setup === name).length
    if (count > 0 && !confirm(`Este setup tiene ${count} trades asociados. ¿Eliminar igualmente?`)) return
    deleteSetup(id)
    if (editId === id) setEditId(null)
  }

  return (
    <div className="page-inner">
      <PageHeader title="Setups" subtitle="Gestión de setups · Estadísticas por estrategia">
        <button className="btn btn-primary btn-sm" onClick={startAdd}>+ Nuevo setup</button>
      </PageHeader>

      {/* Add form */}
      {showAdd && (
        <Card className="section-gap" title="Nuevo setup">
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label>Nombre *</label>
              <input type="text" placeholder="London Breakout, OTE, FVG Fill…"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
            </div>
            <div className="form-group">
              <label>Descripción (opcional)</label>
              <input type="text" placeholder="Breve descripción del setup…"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px', background: 'var(--red2)', borderRadius: 'var(--r)', marginBottom: 10 }}>⚠ {error}</div>}
          <div className="flex-center">
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancelar</button>
          </div>
        </Card>
      )}

      {/* Setup list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {setups.map(setup => {
          const st      = getStats(setup.name)
          const isEditing = editId === setup.id
          return (
            <div key={setup.id} className="card">
              {isEditing ? (
                <>
                  <div className="card-title">Editando setup</div>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label>Nombre *</label>
                      <input type="text" value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
                    </div>
                    <div className="form-group">
                      <label>Descripción</label>
                      <input type="text" value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                  {error && <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px', background: 'var(--red2)', borderRadius: 'var(--r)', marginBottom: 10 }}>⚠ {error}</div>}
                  <div className="flex-center">
                    <button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar cambios</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>Cancelar</button>
                  </div>
                </>
              ) : (
                <div className="flex-between">
                  <div className="flex-center" style={{ gap: 12 }}>
                    <IconCircle
                      icon={
                        <span style={{
                          width: 12, height: 12, borderRadius: '50%', display: 'block',
                          background: !st.total ? 'var(--text3)' : st.wr >= 60 ? 'var(--pos)' : st.wr >= 45 ? 'var(--neutral)' : 'var(--red)',
                        }} />
                      }
                      size={32}
                      color="info"
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{setup.name}</div>
                      {setup.description && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{setup.description}</div>}
                    </div>
                    {st.total > 0 && (
                      <div className="flex-center" style={{ gap: 8, marginLeft: 8 }}>
                        <span className="tag">{st.total} trades</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: st.wr >= 60 ? 'var(--pos)' : st.wr >= 45 ? 'var(--amber)' : 'var(--red)' }}>{st.wr}% WR</span>
                        <span className={`mono`} style={{ fontSize: 11, color: st.totalR >= 0 ? 'var(--pos)' : 'var(--red)' }}>{st.totalR >= 0 ? '+' : ''}{st.totalR}R</span>
                      </div>
                    )}
                    {st.total === 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Sin trades</span>}
                  </div>
                  <div className="flex-center">
                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(setup)}>✎ Editar</button>
                    <button className="btn btn-sm" onClick={() => handleDelete(setup.id, setup.name)}
                      style={{ background: 'var(--red2)', color: 'var(--red)', border: '1px solid rgba(255,90,106,0.2)' }}>
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {setups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 12 }}>
            No hay setups. Pulsa "+ Nuevo setup" para empezar.
          </div>
        )}
      </div>
    </div>
  )
}
