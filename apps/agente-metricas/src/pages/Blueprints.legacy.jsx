import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowRight, X, Save, ListChecks, CheckCircle2, Lock,
} from 'lucide-react'
import { Card, PageHeader, Badge, ProgressBar, BlueprintMatchResults, IconCircle } from '@/components/ui'
import { BLUEPRINT_LEVELS, BLUEPRINT_SESSIONS, BLUEPRINT_TRADER_TYPES } from '@/data/blueprintsData'
import { TRAINING_BLOCKS } from '@/data/trainingBlocks'
import { TRAINING_ITEMS } from '@/data/trainingItems'
import { getTrainingIdsForBlueprint } from '@/config/blueprintTrainingLinks'
import { useBlueprintsStore, useBlueprintsList, useBlueprintTrainingLinks } from '@/store/useBlueprintsStore'
import { useAccounts, useTrades, useTier } from '@/store/useStore'
import { isBlueprintUnlocked, TIER_LABELS, TIERS } from '@/config/features'
import PricingModal from '@/components/upgrade/PricingModal'
import { useAccountBlueprintAssignments } from '@/store/useAccountBlueprintStore'
import { computeAccountMetrics, matchBlueprintToAccount } from '@/config/blueprintMatchEngine'

// ─────────────────────────────────────────────
//  BLUEPRINTS — Sprint 13: Editor · Sprint 18.1: Persistencia
//  Biblioteca editable de perfiles profesionales de trader.
//
//  No implementa: IA, certificados ni autenticación. No usa backend
//  ni base de datos: los datos se guardan con useBlueprintsStore
//  (zustand + persist → localStorage), la misma estrategia que usa
//  el resto de Atlas, lista para una futura integración con API.
// ─────────────────────────────────────────────

const OBJECTIVE_FIELDS = [
  { key: 'winRate', label: 'Win Rate objetivo', suffix: '%' },
  { key: 'profitFactor', label: 'Profit Factor objetivo', suffix: '' },
  { key: 'expectancy', label: 'Expectancy (R)', suffix: 'R' },
  { key: 'riskPerTrade', label: 'Riesgo por operación', suffix: '%' },
  { key: 'maxDrawdown', label: 'Drawdown máximo', suffix: '%' },
  { key: 'tradesPerDay', label: 'Operaciones por día', suffix: '' },
  { key: 'avgRR', label: 'RR medio', suffix: 'R' },
]

/**
 * LockedBlueprintCard — misma silueta que BlueprintCard, pero para
 * Blueprints fuera del límite del tier actual: nombre visible
 * (para saber qué te falta), resto oculto tras un overlay.
 */
function LockedBlueprintCard({ blueprint, requiredTierLabel, onUpgradeClick }) {
  return (
    <div
      style={{
        padding: 24, borderRadius: 12,
        background: 'var(--bg2)',
        border: '1px dashed var(--border2)',
        display: 'flex', flexDirection: 'column', gap: 16,
        position: 'relative', overflow: 'hidden', minHeight: 180,
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      }}
    >
      <IconCircle icon={<Lock size={18} />} color="info" size={40} />
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, marginBottom: 4, color: 'var(--text2)' }}>
          {blueprint.name}
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
          Disponible en {requiredTierLabel}
        </p>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={onUpgradeClick}>Actualizar</button>
    </div>
  )
}

/**
 * BlueprintCard — Tarjeta en el grid principal (sin cambios funcionales,
 * solo adaptada a los nuevos nombres de campo: level y traderType)
 */
function BlueprintCard({ blueprint, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 24, borderRadius: 12,
        background: 'linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)',
        border: '1px solid var(--border2)', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 16,
        transition: 'all 0.2s',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.borderColor = 'var(--green)'
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(59,130,246,0.15)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--border2)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        background: 'var(--accent-gradient)',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div className="icon-circle icon-circle-primary" style={{ width: 48, height: 48, flexShrink: 0 }}>
          <blueprint.icon size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 2, color: 'var(--text)' }}>
            {blueprint.name}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
            {blueprint.trader}
          </p>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        padding: '12px 0', borderTop: '1px solid var(--border2)', borderBottom: '1px solid var(--border2)',
        fontSize: 12,
      }}>
        <div>
          <div style={{ color: 'var(--text3)', marginBottom: 3 }}>Mercado</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{blueprint.market}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text3)', marginBottom: 3 }}>Temporalidad</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{blueprint.timeframe}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text3)', marginBottom: 3 }}>Nivel</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{blueprint.level}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text3)', marginBottom: 3 }}>Tipo de trader</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{blueprint.traderType}</div>
        </div>
      </div>

      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 4, alignSelf: 'flex-start' }}>
        Editar perfil <ArrowRight size={14} />
      </button>
    </div>
  )
}

/**
 * SectionTitle — encabezado de sección reutilizado en todo el panel
 */
function SectionTitle({ children }) {
  return (
    <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
      {children}
    </h3>
  )
}

/**
 * BlueprintEditorPanel — panel de detalle/edición (Sprint 13)
 * Reutiliza el layout de modal existente y las clases globales
 * .form-group / .btn ya usadas en el resto de la app (p.ej. Historial.jsx).
 */
function accountLabel(account) {
  const size = account.size >= 1000 ? `${Math.round(account.size / 1000)}K` : account.size
  return `${account.firm} ${size}`
}

/**
 * BlueprintAccountsSection
 * Muestra qué cuentas de Portfolio tienen ESTE Blueprint asignado
 * (useAccountBlueprintStore, Sprint 22.5) y permite ver, para la
 * cuenta seleccionada, la misma comparativa del Match Engine que ya
 * se ve desde Portfolio — reutilizando BlueprintMatchResults, sin
 * duplicar la vista ni el cálculo.
 */
function BlueprintAccountsSection({ blueprint }) {
  const accounts = useAccounts()
  const trades = useTrades()
  const assignments = useAccountBlueprintAssignments()
  const navigate = useNavigate()

  const assignedAccounts = accounts.filter(a => assignments[a.id] === blueprint.id)
  const [selectedAccountId, setSelectedAccountId] = useState(assignedAccounts[0]?.id ?? null)

  const selectedAccount = assignedAccounts.find(a => a.id === selectedAccountId) || assignedAccounts[0] || null
  const accountTrades = useMemo(
    () => (selectedAccount ? trades.filter(t => t.accountId === selectedAccount.id) : []),
    [trades, selectedAccount]
  )
  const accountMetrics = useMemo(() => computeAccountMetrics(accountTrades, selectedAccount), [accountTrades, selectedAccount])
  const match = useMemo(
    () => matchBlueprintToAccount(blueprint, accountMetrics),
    [blueprint, accountMetrics]
  )

  return (
    <div style={{ marginBottom: 36 }}>
      <SectionTitle>Cuentas con este Mapa</SectionTitle>

      {assignedAccounts.length === 0 ? (
        <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: 0 }}>
          Ninguna cuenta de Portfolio tiene este Mapa asignado todavía.
        </p>
      ) : (
        <>
          <div className="form-group" style={{ maxWidth: 260 }}>
            <label>Cuenta</label>
            <select value={selectedAccount?.id ?? ''} onChange={e => setSelectedAccountId(e.target.value)}>
              {assignedAccounts.map(a => (
                <option key={a.id} value={a.id}>{accountLabel(a)}</option>
              ))}
            </select>
          </div>

          {!accountMetrics ? (
            <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: 0 }}>
              Esta cuenta todavía no tiene operaciones registradas.
            </p>
          ) : (
            <>
              <BlueprintMatchResults {...match} />
              <TrainingRecommendation priorities={match.priorities} navigate={navigate} />
            </>
          )}
        </>
      )}
    </div>
  )
}

/**
 * TrainingRecommendation — Sprint 24 (cerrado)
 *
 * Cierra el ciclo BLUEPRINT → TRAINING → MEJORA: toma las prioridades
 * REALES que ya calcula matchBlueprintToAccount() (blueprintMatchEngine.js,
 * cuenta vs. Blueprint) y las cruza con los `metricTags` de
 * TRAINING_ITEMS para sugerir el entrenamiento concreto que ataca esa
 * brecha. No inventa recomendaciones ni usa datos mock: si no hay
 * prioridades (cuenta ya cumple el Blueprint) o ninguna tiene un
 * Training asociado, no muestra nada.
 */
function TrainingRecommendation({ priorities, navigate }) {
  const priorityMetrics = priorities?.list || []
  if (priorityMetrics.length === 0) return null

  const recommended = priorityMetrics
    .map(metric => ({
      metric,
      item: TRAINING_ITEMS.find(ti => ti.metricTags?.includes(metric.objectiveKey)),
    }))
    .filter(r => r.item)

  if (recommended.length === 0) return null

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 10 }}>
        Recomendado para ti esta semana
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recommended.slice(0, 3).map(({ metric, item }) => {
          const block = TRAINING_BLOCKS.find(b => b.id === item.blockId)
          return (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '12px 14px', borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border2)',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, marginBottom: 2 }}>
                  Prioridad: {metric.label}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.objective}</div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate(block?.to || '/training')}
              >
                Ir al Training
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BlueprintEditorPanel({ blueprint, onClose, navigate }) {
  const [form, setForm] = useState(blueprint)

  const storeTrainingLinks = useBlueprintTrainingLinks()
  const updateBlueprintInStore = useBlueprintsStore(s => s.updateBlueprint)
  const setTrainingIdsInStore = useBlueprintsStore(s => s.setTrainingIdsForBlueprint)

  const [trainingIds, setTrainingIds] = useState(() => getTrainingIdsForBlueprint(storeTrainingLinks, blueprint.id))
  const [justSaved, setJustSaved] = useState(false)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const setObjective = (key, value) => setForm(f => ({ ...f, objectives: { ...f.objectives, [key]: value } }))
  const setRule = (key, value) => setForm(f => ({ ...f, rules: { ...f.rules, [key]: value } }))

  const setChecklistText = (which, text) => {
    const items = text.split('\n')
    setForm(f => ({ ...f, checklist: { ...f.checklist, [which]: items } }))
  }

  const toggleTraining = (id) => {
    setTrainingIds(ids => (ids.includes(id) ? ids.filter(t => t !== id) : [...ids, id]))
  }

  const handleSave = () => {
    // Persiste en useBlueprintsStore (zustand + persist → localStorage).
    // Al recargar la página o volver a abrir este Blueprint, todo se
    // lee de aquí: nada se pierde al cambiar de pestaña o pantalla.
    updateBlueprintInStore(form)
    setTrainingIdsInStore(blueprint.id, trainingIds)

    setJustSaved(true)
    setTimeout(() => {
      setJustSaved(false)
      onClose()
    }, 900)
  }

  const linkedBlocks = TRAINING_BLOCKS.filter(block => trainingIds.includes(block.id))

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)', padding: 20,
      overflowY: 'auto',
    }}
    onClick={onClose}>
      <div
        style={{
          background: 'var(--bg)', borderRadius: 12, width: '100%', maxWidth: 820,
          maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px 28px', borderBottom: '1px solid var(--border2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08), transparent)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="icon-circle icon-circle-primary" style={{ width: 48, height: 48 }}>
              <blueprint.icon size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                Editar Mapa
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, marginTop: 2 }}>
                {blueprint.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={20} style={{ color: 'var(--text3)' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>

          {/* ══════════════════════════════════════
              CUENTAS CON ESTE BLUEPRINT — única comparación
              (Sprint 27.5: se elimina la comparación superior no
              ligada a cuenta; la comparación siempre corresponde a
              la cuenta seleccionada en el selector de abajo)
          ══════════════════════════════════════ */}
          <BlueprintAccountsSection blueprint={blueprint} />

          {/* ══════════════════════════════════════
              1. INFORMACIÓN GENERAL
          ══════════════════════════════════════ */}
          <div style={{ marginBottom: 36 }}>
            <SectionTitle>Información general</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Nombre</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Descripción</label>
                <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Nivel</label>
                <select value={form.level} onChange={e => set('level', e.target.value)}>
                  {BLUEPRINT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Mercado</label>
                <input type="text" value={form.market} onChange={e => set('market', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Temporalidad</label>
                <input type="text" value={form.timeframe} onChange={e => set('timeframe', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Sesión</label>
                <select value={form.session} onChange={e => set('session', e.target.value)}>
                  {BLUEPRINT_SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de trader</label>
                <select value={form.traderType} onChange={e => set('traderType', e.target.value)}>
                  {BLUEPRINT_TRADER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
              2. OBJETIVOS DEL BLUEPRINT
          ══════════════════════════════════════ */}
          <div style={{ marginBottom: 36 }}>
            <SectionTitle>Objetivos del Mapa</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {OBJECTIVE_FIELDS.map(field => (
                <div className="form-group" key={field.key} style={{ marginBottom: 0 }}>
                  <label>{field.label}{field.suffix ? ` (${field.suffix})` : ''}</label>
                  <input
                    type="text"
                    placeholder="—"
                    value={form.objectives[field.key]}
                    onChange={e => setObjective(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════
              3. REGLAS
          ══════════════════════════════════════ */}
          <div style={{ marginBottom: 36 }}>
            <SectionTitle>Reglas</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Qué hacer</label>
                <textarea
                  rows={6}
                  placeholder="Ej: Esperar confirmación de estructura antes de entrar…"
                  value={form.rules.doList}
                  onChange={e => setRule('doList', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Qué evitar</label>
                <textarea
                  rows={6}
                  placeholder="Ej: No operar tras dos pérdidas seguidas…"
                  value={form.rules.avoidList}
                  onChange={e => setRule('avoidList', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
              4. CHECKLIST
          ══════════════════════════════════════ */}
          <div style={{ marginBottom: 36 }}>
            <SectionTitle>Checklist</SectionTitle>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: -6, marginBottom: 12 }}>
              Un elemento por línea.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label><ListChecks size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Checklist de entrada</label>
                <textarea
                  rows={5}
                  placeholder={'Confirmar setup\nRevisar riesgo\nColocar stop'}
                  value={form.checklist.entry.join('\n')}
                  onChange={e => setChecklistText('entry', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label><ListChecks size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Checklist de salida</label>
                <textarea
                  rows={5}
                  placeholder={'Revisar objetivo alcanzado\nMover stop a breakeven\nRegistrar en journal'}
                  value={form.checklist.exit.join('\n')}
                  onChange={e => setChecklistText('exit', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
              5. ENTRENAMIENTOS ASOCIADOS (edición)
              Reutiliza los bloques ya definidos en Training.jsx
              (TRAINING_BLOCKS), sin crear entrenamientos nuevos.
              La relación se guarda en config/blueprintTrainingLinks.js.
          ══════════════════════════════════════ */}
          <div style={{ marginBottom: 36 }}>
            <SectionTitle>Entrenamientos asociados</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {TRAINING_BLOCKS.map(block => {
                const Icon = block.icon
                const checked = trainingIds.includes(block.id)
                return (
                  <label
                    key={block.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8,
                      background: checked ? 'rgba(59,130,246,0.07)' : 'var(--bg2)',
                      border: `1px solid ${checked ? 'var(--green)' : 'var(--border2)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTraining(block.id)}
                    />
                    <Icon size={16} style={{ color: 'var(--text2)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{block.title}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* ══════════════════════════════════════
              6. ENTRENAMIENTOS RECOMENDADOS (Sprint 15)
              Vista navegable de los entrenamientos ya asociados:
              cada tarjeta lleva directamente al módulo de Training.
          ══════════════════════════════════════ */}
          <div>
            <SectionTitle>Entrenamientos recomendados</SectionTitle>
            {linkedBlocks.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Todavía no hay entrenamientos asociados a este Mapa. Selecciónalos arriba.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {linkedBlocks.map(block => {
                  const Icon = block.icon
                  return (
                    <button
                      key={block.id}
                      onClick={() => navigate(block.to)}
                      className="btn"
                      style={{
                        padding: '11px 14px', borderRadius: 999, background: 'var(--bg)',
                        border: '1px solid var(--border2)',
                        display: 'flex', alignItems: 'center', gap: 10,
                        transition: 'border-color 0.14s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
                    >
                      <Icon size={16} style={{ color: 'var(--text2)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', flex: 1, textAlign: 'left' }}>{block.title}</span>
                      <ArrowRight size={14} style={{ color: 'var(--text3)' }} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer: acciones */}
        <div style={{
          padding: '16px 28px', borderTop: '1px solid var(--border2)',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
        }}>
          {justSaved && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
              color: 'var(--green)', marginRight: 'auto',
            }}>
              <CheckCircle2 size={15} /> Mapa guardado correctamente
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={justSaved}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={justSaved}>
            <Save size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────

export default function Blueprints() {
  const navigate = useNavigate()
  const location = useLocation()

  // Persistencia (Sprint 18.1): los Blueprints ya no viven en estado
  // local del componente, sino en useBlueprintsStore (zustand + persist
  // → localStorage), la misma estrategia que usa el resto de Atlas.
  const blueprints = useBlueprintsList()
  const tier = useTier()
  const [selectedId, setSelectedId] = useState(null)
  const [showPricing, setShowPricing] = useState(false)

  // Abre automáticamente un Blueprint cuando se llega desde el botón
  // "Ver Blueprint" de Training (Sprint 15). Reutiliza el mismo patrón
  // ya usado en el Dashboard para abrir el formulario de Historial.
  useEffect(() => {
    if (location.state?.openBlueprintId) {
      setSelectedId(location.state.openBlueprintId)
    }
  }, [location.state])

  const selectedBlueprint = blueprints.find(b => b.id === selectedId) || null

  return (
    <div className="page-inner">
      {/* ══════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════ */}
      <div style={{ marginBottom: 40 }}>
        <PageHeader
          title="Mapas"
          subtitle="Biblioteca editable de perfiles de trader profesionales — información general, objetivos, reglas, checklist de entrada/salida y entrenamientos asociados. Haz clic en una tarjeta para abrir el editor."
        />
      </div>

      {/* ══════════════════════════════════════
          GRID DE BLUEPRINTS
      ══════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 20,
      }}>
        {blueprints.map((bp, i) => (
          isBlueprintUnlocked(tier, bp.id, i) ? (
            <BlueprintCard
              key={bp.id}
              blueprint={bp}
              onClick={() => setSelectedId(bp.id)}
            />
          ) : (
            <LockedBlueprintCard
              key={bp.id}
              blueprint={bp}
              requiredTierLabel={TIER_LABELS[TIERS.INTERMEDIO]}
              onUpgradeClick={() => setShowPricing(true)}
            />
          )
        ))}
      </div>

      {/* Editor de detalle */}
      {selectedBlueprint && (
        <BlueprintEditorPanel
          blueprint={selectedBlueprint}
          onClose={() => setSelectedId(null)}
          navigate={navigate}
        />
      )}

      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
    </div>
  )
}
