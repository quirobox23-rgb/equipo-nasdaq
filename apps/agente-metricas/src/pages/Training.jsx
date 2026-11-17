import { useState, useMemo } from 'react'
import {
  Target, CheckCircle2, Play, RotateCcw, X, ChevronRight, ArrowRight, AlertTriangle, HelpCircle, History,
} from 'lucide-react'
import { Card, PageHeader, Badge, ProgressBar } from '@/components/ui'
import PremiumGate from '@/components/premium/PremiumGate'
import { TRAINING_BLOCKS } from '@/data/trainingBlocks'
import { TRAINING_ITEMS } from '@/data/trainingItems'
import { useBlueprintsList } from '@/store/useBlueprintsStore'
import { useTrainingStore, useTrainingStatusMap } from '@/store/useTrainingStore'
import { useAccounts, useTrades } from '@/store/useStore'
import { useAccountBlueprintAssignments } from '@/store/useAccountBlueprintStore'
import { computeAccountMetrics, matchBlueprintToAccount } from '@/config/blueprintMatchEngine'

// ─────────────────────────────────────────────
//  TRAINING — Sprint 24: Intelligent Training Engine
//
//  Toda la inteligencia vive en el Blueprint Match Engine (Sprint 23).
//  Training solo REPRESENTA el plan: cuenta → Blueprint asignado →
//  prioridades detectadas → entrenamientos relacionados.
//
//  No hay IA. No hay selección manual de Blueprint aquí (eso vive en
//  Portfolio desde el Sprint 22.5): Training siempre usa el Blueprint
//  ya asignado a la cuenta activa.
// ─────────────────────────────────────────────

const BLOCK_BY_ID = Object.fromEntries(TRAINING_BLOCKS.map(b => [b.id, b]))
const STATUS_META = {
  pending:     { label: 'Pendiente',   variant: 'blue',  progress: 0 },
  in_progress: { label: 'En progreso', variant: 'amber', progress: 50 },
  completed:   { label: 'Completado',  variant: 'green', progress: 100 },
}

// El Match Engine (Sprint 23) y los TRAINING_ITEMS (Sprint 19) nacieron
// en momentos distintos y una sola clave no coincide de nombre: el
// riesgo medio de la cuenta se llama `avgRisk` en el motor y
// `riskPerTrade` en las etiquetas de los entrenamientos. Se mapea aquí,
// sin duplicar ni modificar ninguno de los dos.
const METRIC_KEY_TO_TAG = {
  winRate: 'winRate',
  profitFactor: 'profitFactor',
  avgRR: 'avgRR',
  avgRisk: 'riskPerTrade',
  maxDrawdown: 'maxDrawdown',
  tradesPerDay: 'tradesPerDay',
}

const PRIORITY_LEVELS = [
  { key: 'priority_1', label: 'Prioridad Alta' },
  { key: 'priority_2', label: 'Prioridad Media' },
  { key: 'priority_3', label: 'Prioridad Baja' },
]

function accountLabel(account) {
  const size = account.size >= 1000 ? `${Math.round(account.size / 1000)}K` : account.size
  return `${account.firm} ${size}`
}

/**
 * buildPlanFromPriorities — Sprint 24
 * Convierte las 3 prioridades del Match Engine en, como máximo, 3
 * entrenamientos concretos (uno por prioridad). No se muestra ningún
 * entrenamiento que no esté relacionado con una prioridad detectada.
 */
function buildPlanFromPriorities(priorities, trainingStatus) {
  const usedIds = new Set()
  const plan = []

  PRIORITY_LEVELS.forEach(({ key, label }) => {
    const metric = priorities[key]
    if (!metric) return
    const tag = METRIC_KEY_TO_TAG[metric.key]
    if (!tag) return

    const candidate = TRAINING_ITEMS.find(t => t.metricTags.includes(tag) && !usedIds.has(t.id))
    if (!candidate) return

    usedIds.add(candidate.id)
    plan.push({
      ...candidate,
      status: trainingStatus[candidate.id] || 'pending',
      priorityLevel: label,
      matchMetric: metric,
    })
  })

  return plan
}

function buildWhyReason(metric) {
  if (!metric) return null
  const verb = metric.higherIsBetter ? 'un mínimo de' : 'un máximo de'
  return `Porque tu ${metric.label.toLowerCase()} actual es ${metric.current}${metric.unit} y el Mapa exige ${verb} ${metric.target}${metric.unit}.`
}

// Objetivo intermedio (Sprint 30): a medio camino entre el valor
// actual y el objetivo del Blueprint. Solo cálculo de presentación
// para la ficha — no altera priorities ni el plan (Sprint 24).
function computeIntermediateGoal(metric) {
  if (!metric) return null
  const current = parseFloat(metric.current)
  const target = parseFloat(metric.target)
  if (isNaN(current) || isNaN(target)) return null
  const intermediate = Math.round((current + (target - current) * 0.5) * 100) / 100
  return { ...metric, intermediate }
}

function buildSuccessCriteria(goal) {
  if (!goal) return null
  const verb = goal.higherIsBetter ? 'superior a' : 'inferior a'
  return `Mantener un ${goal.label.toLowerCase()} ${verb} ${goal.intermediate}${goal.unit} durante las próximas 30 operaciones.`
}

/**
 * TrainingItemCard — nombre, prioridad, motivo, estado, progreso.
 */
function TrainingItemCard({ item, onOpen }) {
  const block = BLOCK_BY_ID[item.blockId]
  const meta = STATUS_META[item.status]

  return (
    <Card style={{ cursor: 'pointer' }}>
      <div onClick={() => onOpen(item)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
            color: block?.color ?? 'var(--brand-deep)',
          }}>
            {item.priorityLevel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: `${block?.color ?? 'var(--brand-deep)'}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Target size={17} style={{ color: block?.color ?? 'var(--brand-deep)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.name}</div>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Badge variant={meta.variant}>{meta.label}</Badge>
          <div style={{ flex: 1 }}>
            <ProgressBar value={meta.progress} max={100} />
          </div>
        </div>
      </div>
    </Card>
  )
}

/**
 * TrainingDetailModal — ficha del entrenamiento (estructura del
 * Sprint 22, sin funcionalidades nuevas). Se añade únicamente el
 * bloque "¿Por qué estoy haciendo este entrenamiento?" (Sprint 24).
 */
function TrainingDetailModal({ item, onClose, onStart, onComplete, onReset }) {
  const meta = STATUS_META[item.status]
  const why = buildWhyReason(item.matchMetric)
  const goal = computeIntermediateGoal(item.matchMetric)
  const successCriteria = buildSuccessCriteria(goal)

  return (
    <div
      style={{
        position: 'fixed', whiteSpace: 'normal', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)', padding: 20, overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>{item.name}</div>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>

        {/* 1. ¿Por qué estás haciendo este entrenamiento? */}
        {why && (
          <div className="callout callout-amber" style={{ padding: '12px 14px', marginBottom: 18, gap: 8, alignItems: 'flex-start' }}>
            <HelpCircle size={14} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div className="callout-label" style={{ marginBottom: 3 }}>
                ¿Por qué estoy haciendo este entrenamiento?
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{why}</div>
            </div>
          </div>
        )}

        {/* 2. ¿Qué significa este problema? */}
        {item.impact?.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>
              ¿Qué significa este problema?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {item.impact.map((line, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--text2)', margin: 0, lineHeight: 1.55 }}>{line}</p>
              ))}
            </div>
          </div>
        )}

        {/* 3. Plan de entrenamiento */}
        {item.actionPlan?.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-deep)', textTransform: 'uppercase', marginBottom: 8 }}>
              Plan de entrenamiento
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {item.actionPlan.map((action, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12,
                  color: 'var(--text2)', lineHeight: 1.5,
                }}>
                  <span style={{ color: 'var(--brand-deep)', flexShrink: 0 }}>☐</span> {action}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Objetivo del entrenamiento */}
        {goal && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>
              Objetivo del entrenamiento
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '12px 14px', borderRadius: 8, background: 'var(--bg2)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 2 }}>Actual</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{goal.current}{goal.unit}</div>
              </div>
              <ArrowRight size={13} style={{ color: 'var(--text3)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--brand-deep)', marginBottom: 2 }}>Objetivo del entrenamiento</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-deep)' }}>{goal.intermediate}{goal.unit}</div>
              </div>
              <ArrowRight size={13} style={{ color: 'var(--text3)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 2 }}>Objetivo Mapa</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{goal.target}{goal.unit}</div>
              </div>
            </div>
          </div>
        )}

        {/* 5. ¿Cómo sabrás que has mejorado? */}
        {successCriteria && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', marginBottom: 6 }}>
              ¿Cómo sabrás que has mejorado?
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>{successCriteria}</p>
            </div>
          </div>
        )}

        {/* 6. Errores frecuentes */}
        {item.commonMistakes?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 8 }}>
              Errores frecuentes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {item.commonMistakes.map((mistake, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--red)' }}>✗</span> {mistake}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Finalización — sin cambios en el sistema actual */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border2)' }}>
          {item.status === 'pending' && (
            <button className="btn btn-primary btn-sm" onClick={() => onStart(item.id)}>
              <Play size={12} style={{ verticalAlign: -2, marginRight: 6 }} />Iniciar entrenamiento
            </button>
          )}
          {item.status === 'in_progress' && (
            <button className="btn btn-primary btn-sm" onClick={() => onComplete(item.id)}>
              <CheckCircle2 size={12} style={{ verticalAlign: -2, marginRight: 6 }} />Marcar entrenamiento como completado
            </button>
          )}
          {item.status === 'completed' && (
            <button className="btn btn-secondary btn-sm" onClick={() => onReset(item.id)}>
              <RotateCcw size={12} style={{ verticalAlign: -2, marginRight: 6 }} />Volver a realizar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────
export default function Training() {
  const accounts = useAccounts()
  const trades = useTrades()
  const blueprints = useBlueprintsList()
  const assignments = useAccountBlueprintAssignments()

  const trainingStatus = useTrainingStatusMap()
  const startTraining = useTrainingStore(s => s.startTraining)
  const completeTraining = useTrainingStore(s => s.completeTraining)
  const resetTraining = useTrainingStore(s => s.resetTraining)

  const [selectedAccountId, setSelectedAccountId] = useState(null)
  const [openItem, setOpenItem] = useState(null)

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0] || null
  const assignedBlueprintId = selectedAccount ? assignments[selectedAccount.id] : null
  const assignedBlueprint = blueprints.find(b => b.id === assignedBlueprintId) || null

  const accountTrades = useMemo(
    () => (selectedAccount ? trades.filter(t => t.accountId === selectedAccount.id) : []),
    [trades, selectedAccount]
  )
  const accountMetrics = useMemo(() => computeAccountMetrics(accountTrades, selectedAccount), [accountTrades, selectedAccount])

  // Actualización automática (Sprint 24): al cambiar la cuenta, el
  // Blueprint asignado o las métricas (nuevos trades), este useMemo se
  // recalcula solo — no hace falta regenerar nada manualmente.
  const match = useMemo(
    () => matchBlueprintToAccount(assignedBlueprint, accountMetrics),
    [assignedBlueprint, accountMetrics]
  )

  const plan = useMemo(
    () => buildPlanFromPriorities(match.priorities, trainingStatus),
    [match.priorities, trainingStatus]
  )

  // Historial: entrenamientos ya completados que ya NO están en el
  // plan activo (porque esa prioridad ya no se detecta). Se
  // mantienen visibles, pero no vuelven a "recomendarse".
  const planIds = new Set(plan.map(p => p.id))
  const completedHistory = TRAINING_ITEMS.filter(
    t => trainingStatus[t.id] === 'completed' && !planIds.has(t.id)
  )

  const openItemLive = openItem ? plan.find(p => p.id === openItem.id) || openItem : null

  return (
    <PremiumGate feature="training">
    <div className="page-inner">
      <PageHeader
        title="Training"
        subtitle="El plan de entrenamiento de esta cuenta, generado a partir de sus diferencias con el Mapa."
      />

      {/* ══════════════════════════════════════
          CUENTA ACTIVA
      ══════════════════════════════════════ */}
      <div className="form-group section-gap" style={{ maxWidth: 260 }}>
        <label>Cuenta activa</label>
        <select value={selectedAccount?.id ?? ''} onChange={e => setSelectedAccountId(e.target.value)}>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>{accountLabel(acc)}</option>
          ))}
        </select>
      </div>

      {!selectedAccount ? (
        <Card><p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>No hay cuentas en Portfolio todavía.</p></Card>
      ) : !assignedBlueprint ? (
        <div className="callout callout-amber">
          <AlertTriangle size={18} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>
            Esta cuenta todavía no tiene Mapa asignado. Asígnalo desde Portfolio para generar su plan de entrenamiento.
          </span>
        </div>
      ) : !accountMetrics ? (
        <Card>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
            Esta cuenta todavía no tiene operaciones registradas: sin trades no se pueden detectar prioridades.
          </p>
        </Card>
      ) : (
        <>
          {/* ══════════════════════════════════════
              PLAN DE ENTRENAMIENTO
          ══════════════════════════════════════ */}
          <Card style={{
            marginBottom: 20,
            background: `linear-gradient(135deg, ${assignedBlueprint.color}12 0%, transparent 100%)`,
            border: `1px solid ${assignedBlueprint.color}30`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 9.5, color: 'var(--text3)' }}>Cuenta</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{accountLabel(selectedAccount)}</div>
              </div>
              <div>
                <div style={{ fontSize: 9.5, color: 'var(--text3)' }}>Mapa</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: assignedBlueprint.color }}>
                  {assignedBlueprint.name.toUpperCase()}
                </div>
              </div>
            </div>
          </Card>

          {plan.length === 0 ? (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={18} style={{ color: 'var(--brand)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                  No se ha detectado ninguna diferencia relevante entre esta cuenta y el Mapa asignado ahora mismo.
                </span>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
              {plan.map(item => (
                <TrainingItemCard key={item.id} item={item} onOpen={setOpenItem} />
              ))}
            </div>
          )}

          {/* ══════════════════════════════════════
              HISTORIAL DE COMPLETADOS
          ══════════════════════════════════════ */}
          {completedHistory.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <History size={14} style={{ color: 'var(--text3)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Historial de entrenamientos completados
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {completedHistory.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8, background: 'var(--bg2)',
                  }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{item.name}</span>
                    <Badge variant="green">Completado</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {openItemLive && (
        <TrainingDetailModal
          item={openItemLive}
          onClose={() => setOpenItem(null)}
          onStart={startTraining}
          onComplete={completeTraining}
          onReset={resetTraining}
        />
      )}
    </div>
    </PremiumGate>
  )
}
