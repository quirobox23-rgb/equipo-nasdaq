import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowRight, X, Save, Copy, Eye, Lock,
} from 'lucide-react'
import { PageHeader, BlueprintMatchResults, RRDistributionPanel, IconCircle } from '@/components/ui'
import { ENVIRONMENTS, DRAWDOWN_TYPES } from '@/data/blueprintsData'
import { TRAINING_BLOCKS } from '@/data/trainingBlocks'
import { TRAINING_ITEMS } from '@/data/trainingItems'
import { getTrainingIdsForBlueprint } from '@/config/blueprintTrainingLinks'
import { useBlueprintsStore, useBlueprintsList, useBlueprintTrainingLinks } from '@/store/useBlueprintsStore'
import { useAccounts, useTrades, useTier } from '@/store/useStore'
import { useProfile } from '@/store/useAuthStore'
import { isAdmin } from '@/config/admin'
import { isBlueprintUnlocked, TIER_LABELS, TIERS } from '@/config/features'
import PricingModal from '@/components/upgrade/PricingModal'
import { useAccountBlueprintAssignments } from '@/store/useAccountBlueprintStore'
import { computeAccountMetrics, matchBlueprintToAccount } from '@/config/blueprintMatchEngine'
import { matchHibridoExpansionToAccount } from '@/config/hibridoExpansionEngine'

// ─────────────────────────────────────────────
//  BLUEPRINTS — Plantilla v2 (Entropia Analytics)
//
//  Editor simplificado: solo los 4 bloques de configuración con
//  utilidad estadística real (Identificación, Parámetros del Modelo,
//  Reglas de Cuenta, Diagnóstico) + Vista previa/Acciones. Se quitaron
//  Nivel, Temporalidad, Sesión, Tipo de trader, Activo/instrumento y
//  los checklists de entrada/salida — no modifican la matemática del
//  Mapa. La versión anterior (más completa) sigue en el repo, en
//  Blueprints.legacy.jsx, sin usarse — nada la importa ni la enlaza.
//
//  No implementa: IA, certificados ni autenticación. Los datos se
//  guardan con useBlueprintsStore (zustand + persist → localStorage).
// ─────────────────────────────────────────────

const EMPTY_BLUEPRINT = {
  templateType: 'rr-fijo', // por defecto — el más común; el Híbrido de Expansión se elige explícitamente al pasar los datos, no desde "+ Nuevo Mapa" todavía
  name: '',
  color: 'var(--brand)',
  identification: { description: '', environment: 'Prop Futures' },
  parameters: {
    maxRisk: '', tpTarget: '',
    winRateMin: '', winRateTarget: '', winRateOptimal: '',
    avgLossMax: '', avgLossTarget: '',
    rrRealizedMin: '', rrRealizedTarget: '', rrRealizedOptimal: '',
    pfMin: '', pfTarget: '', pfOptimal: '',
  },
  accountRules: { drawdownAvailable: '', drawdownType: 'EOD', dailyTargetMin: '', minDaysRequired: '' },
  diagnosis: { whatToDo: '', whatToAvoid: '' },
}

/**
 * LockedBlueprintCard — misma silueta que BlueprintCard, pero para
 * Mapas fuera del límite del tier actual.
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
 * BlueprintCard — tarjeta en el grid principal. Muestra solo lo que
 * ya tiene utilidad estadística: entorno, riesgo máximo y RR nominal
 * (auto = TP objetivo / Riesgo máximo) — no Nivel/Mercado/Sesión,
 * que ya no forman parte del Mapa.
 */
function BlueprintCard({ blueprint, onClick }) {
  const p = blueprint.parameters || {}
  const isHibrido = blueprint.templateType === 'hibrido-expansion'
  const rrNominal = !isHibrido && p.maxRisk > 0 && p.tpTarget ? (p.tpTarget / p.maxRisk).toFixed(2) : null
  const riesgoLabel = isHibrido ? '1R nominal' : 'Riesgo máx.'
  const riesgoValue = isHibrido ? (p.rNominal ? `$${p.rNominal}` : '—') : (p.maxRisk ? `$${p.maxRisk}` : '—')
  const thirdLabel = isHibrido ? 'Hard Risk' : 'RR nominal'
  const thirdValue = isHibrido ? (p.hardRiskExcepcional ? `$${p.hardRiskExcepcional}` : '—') : (rrNominal ?? '—')

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
        e.currentTarget.style.borderColor = 'var(--brand)'
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 2, color: 'var(--text)' }}>
            {blueprint.name || 'Mapa sin nombre'}
          </h3>
          <p style={{
            fontSize: 13, color: 'var(--text2)', margin: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {blueprint.identification?.description || 'Sin descripción todavía.'}
          </p>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        padding: '12px 0', borderTop: '1px solid var(--border2)', borderBottom: '1px solid var(--border2)',
        fontSize: 12,
      }}>
        <div>
          <div style={{ color: 'var(--text3)', marginBottom: 3 }}>Entorno</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{blueprint.identification?.environment || '—'}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text3)', marginBottom: 3 }}>{riesgoLabel}</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{riesgoValue}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text3)', marginBottom: 3 }}>{thirdLabel}</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{thirdValue}</div>
        </div>
      </div>

      <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 4, alignSelf: 'flex-end' }}>
        Editar Mapa <ArrowRight size={14} />
      </button>
    </div>
  )
}

function SectionTitle({ number, color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: color, color: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, flexShrink: 0,
      }}>
        {number}
      </div>
      <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        {children}
      </h3>
    </div>
  )
}

function accountLabel(account) {
  const size = account.size >= 1000 ? `${Math.round(account.size / 1000)}K` : account.size
  return `${account.firm} ${size}`
}

/**
 * BlueprintAccountsSection — qué cuentas de Portfolio tienen ESTE
 * Mapa asignado, con la comparativa real del Match Engine.
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
  const isHibrido = blueprint.templateType === 'hibrido-expansion'
  const accountMetrics = useMemo(
    () => (isHibrido ? null : computeAccountMetrics(accountTrades, selectedAccount)),
    [accountTrades, selectedAccount, isHibrido]
  )
  const match = useMemo(
    () => isHibrido
      ? matchHibridoExpansionToAccount(blueprint, selectedAccount, accountTrades)
      : matchBlueprintToAccount(blueprint, accountMetrics),
    [blueprint, accountMetrics, isHibrido, selectedAccount, accountTrades]
  )
  // Para el mensaje de "sin operaciones" — rr-fijo usa accountMetrics,
  // hibrido-expansion no lo calcula (usa match.metrics directamente).
  const hasData = isHibrido ? accountTrades.length > 0 : !!accountMetrics

  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
        Cuentas con este Mapa
      </div>

      {assignedAccounts.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text)', margin: 0 }}>
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

          {!hasData ? (
            <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: 0 }}>
              Esta cuenta todavía no tiene operaciones registradas.
            </p>
          ) : (
            <>
              <BlueprintMatchResults {...match} />
              {isHibrido && match.rrDistribution && <RRDistributionPanel distribution={match.rrDistribution} speed={match.speedToTarget} />}
              <TrainingRecommendation priorities={match.priorities} navigate={navigate} />
            </>
          )}
        </>
      )}
    </div>
  )
}

/**
 * TrainingRecommendation — cruza las prioridades REALES que calcula
 * matchBlueprintToAccount() con los metricTags de TRAINING_ITEMS.
 */
function TrainingRecommendation({ priorities, navigate }) {
  const priorityMetrics = priorities?.list || []
  if (priorityMetrics.length === 0) return null

  const recommended = priorityMetrics
    .map(metric => ({
      metric,
      item: TRAINING_ITEMS.find(ti => ti.metricTags?.includes(metric.key)),
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
                onClick={() => navigate(block?.to || '/entrenamiento')}
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

/**
 * NumField — input numérico compacto, reutilizado en el bloque de
 * Parámetros (muchos campos pequeños en fila).
 */
function NumField({ label, value, onChange, prefix, suffix, placeholder }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        {prefix && (
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: 'var(--text3)' }}>
            {prefix}
          </span>
        )}
        <input
          type="number" step="any" placeholder={placeholder}
          value={value} onChange={e => onChange(e.target.value)}
          style={prefix ? { paddingLeft: 22 } : undefined}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: 'var(--text3)' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function BlueprintEditorPanel({ blueprint, onClose, navigate, onDuplicated, canEdit }) {
  const [form, setForm] = useState(blueprint)
  const [previewMode, setPreviewMode] = useState(false)

  const storeTrainingLinks = useBlueprintTrainingLinks()
  const updateBlueprintInStore = useBlueprintsStore(s => s.updateBlueprint)
  const duplicateBlueprintInStore = useBlueprintsStore(s => s.duplicateBlueprint)
  const setTrainingIdsInStore = useBlueprintsStore(s => s.setTrainingIdsForBlueprint)

  const [trainingIds, setTrainingIds] = useState(() => getTrainingIdsForBlueprint(storeTrainingLinks, blueprint.id))
  const [justSaved, setJustSaved] = useState(false)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const setIdent = (key, value) => setForm(f => ({ ...f, identification: { ...f.identification, [key]: value } }))
  const setParam = (key, value) => setForm(f => ({ ...f, parameters: { ...f.parameters, [key]: value === '' ? '' : parseFloat(value) } }))
  const setRule = (key, value) => setForm(f => ({ ...f, accountRules: { ...f.accountRules, [key]: value } }))
  const setNumRule = (key, value) => setForm(f => ({ ...f, accountRules: { ...f.accountRules, [key]: value === '' ? '' : parseFloat(value) } }))
  const setDiag = (key, value) => setForm(f => ({ ...f, diagnosis: { ...f.diagnosis, [key]: value } }))

  const p = form.parameters || {}
  const rrNominal = p.maxRisk > 0 && p.tpTarget ? (p.tpTarget / p.maxRisk).toFixed(2) : '—'

  const handleSave = () => {
    updateBlueprintInStore(form)
    setTrainingIdsInStore(blueprint.id, trainingIds)
    setJustSaved(true)
    setTimeout(() => {
      setJustSaved(false)
      onClose()
    }, 900)
  }

  const handleDuplicate = () => {
    updateBlueprintInStore(form) // guarda cambios pendientes antes de duplicar, para no perderlos
    const newId = duplicateBlueprintInStore(blueprint.id)
    onClose()
    if (newId && onDuplicated) onDuplicated(newId)
  }

  return (
    <div style={{
      position: 'fixed', whiteSpace: 'normal', top: 0, left: 0, right: 0, bottom: 0,
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
              <h2 style={{
                fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text)',
                textTransform: 'uppercase', letterSpacing: '0.6px',
              }}>
                Configuración de Mapa
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, marginTop: 4 }}>
                {form.name || 'Nuevo Mapa'}
              </p>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cerrar</button>
        </div>

        {/* Content */}
        <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>

          <BlueprintAccountsSection blueprint={blueprint} />

          {!canEdit && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
              borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)',
              fontSize: 13, color: 'var(--text2)', marginBottom: 24,
            }}>
              <Lock size={13} /> Solo un administrador puede editar los parámetros de este Mapa. Puedes verlo y usarlo para comparar tus cuentas.
            </div>
          )}

          <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0 }}>

          {/* ══════════════════════════════════════
              1. INFORMACIÓN DEL MAPA
          ══════════════════════════════════════ */}
          <div style={{ marginBottom: 32, padding: 20, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border3)' }}>
            <SectionTitle number="1" color="var(--brand)">Información del Mapa</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Nombre del Mapa *</label>
                <input type="text" placeholder="Mapa 1 - RR 0.30 (Días mínimos)" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Descripción *</label>
                <textarea rows={3} placeholder="Explica brevemente para qué sirve este modelo." value={form.identification?.description || ''} onChange={e => setIdent('description', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Entorno *</label>
                <select value={form.identification?.environment || ''} onChange={e => setIdent('environment', e.target.value)}>
                  {ENVIRONMENTS.map(env => <option key={env} value={env}>{env}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
              2. PARÁMETROS DEL MODELO
          ══════════════════════════════════════ */}
          <div style={{ marginBottom: 32, padding: 20, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border3)' }}>
            <SectionTitle number="2" color="var(--brand)">Parámetros del Mapa (Estadísticos)</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <NumField label="Riesgo máximo por operación *" prefix="$" value={p.maxRisk} onChange={v => setParam('maxRisk', v)} />
              <NumField label="TP objetivo por operación *"   prefix="$" value={p.tpTarget} onChange={v => setParam('tpTarget', v)} />
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>RR nominal <span style={{ fontWeight: 400, color: 'var(--text3)' }}>auto</span></label>
                <div style={{
                  padding: '10px 12px', borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border2)',
                  fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text2)', fontSize: 13,
                }}>
                  {rrNominal}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <NumField label="Win Rate mínimo *"  suffix="%" value={p.winRateMin}     onChange={v => setParam('winRateMin', v)} />
              <NumField label="Win Rate objetivo *" suffix="%" value={p.winRateTarget}  onChange={v => setParam('winRateTarget', v)} />
              <NumField label="Win Rate óptimo *"   suffix="%" value={p.winRateOptimal} onChange={v => setParam('winRateOptimal', v)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <NumField label="Avg Loss máxima *"   prefix="$" value={p.avgLossMax}    onChange={v => setParam('avgLossMax', v)} />
              <NumField label="Avg Loss objetivo"   prefix="$" value={p.avgLossTarget} onChange={v => setParam('avgLossTarget', v)} />
              <div />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <NumField label="RR realizado mínimo *"  value={p.rrRealizedMin}     onChange={v => setParam('rrRealizedMin', v)} />
              <NumField label="RR realizado objetivo *" value={p.rrRealizedTarget}  onChange={v => setParam('rrRealizedTarget', v)} />
              <NumField label="RR realizado óptimo *"   value={p.rrRealizedOptimal} onChange={v => setParam('rrRealizedOptimal', v)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <NumField label="Profit Factor mínimo *"  value={p.pfMin}     onChange={v => setParam('pfMin', v)} />
              <NumField label="Profit Factor objetivo *" value={p.pfTarget}  onChange={v => setParam('pfTarget', v)} />
              <NumField label="Profit Factor óptimo *"   value={p.pfOptimal} onChange={v => setParam('pfOptimal', v)} />
            </div>
          </div>

          {/* ══════════════════════════════════════
              3. REGLAS DE CUENTA (PROP FIRM)
          ══════════════════════════════════════ */}
          <div style={{ marginBottom: 32, padding: 20, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border3)' }}>
            <SectionTitle number="3" color="var(--brand)">Reglas de Cuenta (Prop Firm)</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <NumField label="Drawdown disponible *" prefix="$" value={form.accountRules?.drawdownAvailable} onChange={v => setNumRule('drawdownAvailable', v)} />
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tipo de Drawdown *</label>
                <select value={form.accountRules?.drawdownType || ''} onChange={e => setRule('drawdownType', e.target.value)}>
                  {DRAWDOWN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <NumField label="Objetivo mínimo diario *" prefix="$" value={form.accountRules?.dailyTargetMin} onChange={v => setNumRule('dailyTargetMin', v)} />
              <NumField label="Días mínimos requeridos *" value={form.accountRules?.minDaysRequired} onChange={v => setNumRule('minDaysRequired', v)} />
            </div>
          </div>

          {/* ══════════════════════════════════════
              4. DIAGNÓSTICO DEL MODELO
          ══════════════════════════════════════ */}
          <div style={{ marginBottom: 32, padding: 20, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border3)' }}>
            <SectionTitle number="4" color="var(--brand)">Diagnóstico del Mapa</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Qué hacer <span style={{ fontWeight: 400, color: 'var(--text3)' }}>opcional</span></label>
                <textarea rows={4} placeholder="- Enfocarse en consistencia...&#10;- Mantener SL disciplinado..." value={form.diagnosis?.whatToDo || ''} onChange={e => setDiag('whatToDo', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Qué evitar <span style={{ fontWeight: 400, color: 'var(--text3)' }}>opcional</span></label>
                <textarea rows={4} placeholder="- Buscar grandes ganancias...&#10;- Aumentar riesgo en rachas..." value={form.diagnosis?.whatToAvoid || ''} onChange={e => setDiag('whatToAvoid', e.target.value)} />
              </div>
            </div>
          </div>

          </fieldset>

          {/* ══════════════════════════════════════
              5. VISTA PREVIA Y ACCIONES
          ══════════════════════════════════════ */}
          <div style={{ padding: 20, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border3)' }}>
            <SectionTitle number="5" color="var(--brand)">Vista previa y acciones</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{form.name || 'Sin nombre'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {form.identification?.environment || '—'} · Activo
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setPreviewMode(v => !v)}>
                  <Eye size={13} /> {previewMode ? 'Ocultar vista previa' : 'Vista previa'}
                </button>
                {canEdit && (
                  <>
                    <button className="btn btn-outline btn-sm" onClick={handleDuplicate}>
                      <Copy size={13} /> Duplicar Mapa
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave}>
                      <Save size={13} /> {justSaved ? 'Guardado ✓' : 'Guardar Mapa'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {previewMode && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border2)' }}>
                <BlueprintMatchResults {...matchBlueprintToAccount(form, { winRate: parseFloat(p.winRateTarget) || 0, profitFactor: parseFloat(p.pfTarget) || 0, rrRealized: parseFloat(p.rrRealizedTarget) || 0, avgLossDollar: parseFloat(p.avgLossTarget) || parseFloat(p.avgLossMax) || 0, maxDrawdownDollar: 0, expectancy: 0, recoveryTrades: 0, maxLossStreak: 0, daysTraded: 0 })} />
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                  Vista previa con los propios valores "objetivo" del Mapa como si fueran el resultado de una cuenta — sirve para comprobar que los umbrales tienen sentido entre sí, no como comparación real.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RangeField({ label, valueMin, valueMax, onChangeMin, onChangeMax }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="number" step="any" value={valueMin} onChange={e => onChangeMin(e.target.value)} placeholder="mín" />
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>–</span>
        <input type="number" step="any" value={valueMax} onChange={e => onChangeMax(e.target.value)} placeholder="máx" />
      </div>
    </div>
  )
}

/** Campo Aplica/No aplica — bloque 3 del Modelo 3 lo exige explícitamente
 * ("evita eliminar campos que otros modelos sí necesitan"). No aplica
 * guarda el valor como null, mismo criterio que ya usa el resto del
 * esquema para representar "no corresponde a este Mapa". */
function AplicaToggle({ label, applies, onToggleApplies, value, onChangeValue }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ marginBottom: 0 }}>{label}</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => onToggleApplies(true)}
            className={applies ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            style={{ padding: '3px 8px', fontSize: 10.5 }}>Aplica</button>
          <button type="button" onClick={() => onToggleApplies(false)}
            className={!applies ? 'btn btn-secondary btn-sm' : 'btn btn-ghost btn-sm'}
            style={{ padding: '3px 8px', fontSize: 10.5 }}>No aplica</button>
        </div>
      </div>
      {applies ? (
        <input type="number" step="any" value={value} onChange={e => onChangeValue(e.target.value)} />
      ) : (
        <div style={{ padding: '10px 12px', borderRadius: 6, background: 'var(--bg3)', border: '1px dashed var(--border2)', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          No aplica en este Mapa
        </div>
      )}
    </div>
  )
}

/**
 * HibridoExpansionEditorPanel — editor del Modelo 3 y futuros Mapas del
 * mismo tipo (ej. Modelo 4). Misma estructura general de bloques que
 * BlueprintEditorPanel (el PDF pide explícitamente "no crear una
 * pantalla distinta"), pero con los campos propios de esta plantilla:
 * riesgo en 3 niveles, tiers "objetivo" como RANGO (no un solo número),
 * Aplica/No aplica en Reglas de cuenta, y el bloque nuevo de
 * Distribución de RR.
 */
function HibridoExpansionEditorPanel({ blueprint, onClose, navigate, onDuplicated, canEdit }) {
  const [form, setForm] = useState(blueprint)
  const [previewMode, setPreviewMode] = useState(false)

  const storeTrainingLinks = useBlueprintTrainingLinks()
  const updateBlueprintInStore = useBlueprintsStore(s => s.updateBlueprint)
  const duplicateBlueprintInStore = useBlueprintsStore(s => s.duplicateBlueprint)
  const setTrainingIdsInStore = useBlueprintsStore(s => s.setTrainingIdsForBlueprint)

  const [trainingIds, setTrainingIds] = useState(() => getTrainingIdsForBlueprint(storeTrainingLinks, blueprint.id))
  const [justSaved, setJustSaved] = useState(false)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const setIdent = (key, value) => setForm(f => ({ ...f, identification: { ...f.identification, [key]: value } }))
  const setParam = (key, value) => setForm(f => ({ ...f, parameters: { ...f.parameters, [key]: value === '' ? '' : parseFloat(value) } }))
  const setParamRange = (key, which, value) => setForm(f => ({
    ...f, parameters: { ...f.parameters, [key]: { ...(f.parameters[key] || {}), [which]: value === '' ? '' : parseFloat(value) } },
  }))
  const setRule = (key, value) => setForm(f => ({ ...f, accountRules: { ...f.accountRules, [key]: value } }))
  const setNumRule = (key, value) => setForm(f => ({ ...f, accountRules: { ...f.accountRules, [key]: value === '' ? '' : parseFloat(value) } }))
  const setRuleApplies = (key, applies) => setForm(f => ({ ...f, accountRules: { ...f.accountRules, [key]: applies ? (f.accountRules[key] ?? 0) : null } }))
  const setDiag = (key, value) => setForm(f => ({ ...f, diagnosis: { ...f.diagnosis, [key]: value } }))
  const setBucket = (i, key, value) => setForm(f => ({
    ...f, rrDistribution: { ...f.rrDistribution, buckets: f.rrDistribution.buckets.map((b, idx) => idx === i ? { ...b, [key]: value === '' ? '' : parseFloat(value) } : b) },
  }))
  const setExpansion = (key, value) => setForm(f => ({
    ...f, rrDistribution: { ...f.rrDistribution, expansionAPlus: { ...f.rrDistribution.expansionAPlus, [key]: value === '' ? '' : parseFloat(value) } },
  }))

  const p = form.parameters || {}

  const handleSave = () => {
    updateBlueprintInStore(form)
    setTrainingIdsInStore(blueprint.id, trainingIds)
    setJustSaved(true)
    setTimeout(() => { setJustSaved(false); onClose() }, 900)
  }
  const handleDuplicate = () => {
    updateBlueprintInStore(form)
    const newId = duplicateBlueprintInStore(blueprint.id)
    onClose()
    if (newId && onDuplicated) onDuplicated(newId)
  }

  return (
    <div style={{
      position: 'fixed', whiteSpace: 'normal', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)', padding: 20, overflowY: 'auto',
    }}
    onClick={onClose}>
      <div
        style={{ background: 'var(--bg)', borderRadius: 12, width: '100%', maxWidth: 820, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
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
              <h2 style={{
                fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text)',
                textTransform: 'uppercase', letterSpacing: '0.6px',
              }}>
                Configuración de Mapa
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, marginTop: 4 }}>
                {form.name || 'Nuevo Mapa'} · Plantilla Híbrido de Expansión
              </p>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cerrar</button>
        </div>

        <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>

          <BlueprintAccountsSection blueprint={blueprint} />

          {!canEdit && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
              borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)',
              fontSize: 13, color: 'var(--text2)', marginBottom: 24,
            }}>
              <Lock size={13} /> Solo un administrador puede editar los parámetros de este Mapa. Puedes verlo y usarlo para comparar tus cuentas.
            </div>
          )}

          <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0 }}>

          {/* 1. INFORMACIÓN — igual que la plantilla rr-fijo */}
          <div style={{ marginBottom: 32, padding: 20, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border3)' }}>
            <SectionTitle number="1" color="var(--brand)">Información del Mapa</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Nombre del Mapa *</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Descripción *</label>
                <textarea rows={3} value={form.identification?.description || ''} onChange={e => setIdent('description', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Entorno *</label>
                <select value={form.identification?.environment || ''} onChange={e => setIdent('environment', e.target.value)}>
                  {ENVIRONMENTS.map(env => <option key={env} value={env}>{env}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 2. PARÁMETROS — riesgo en 3 niveles + tiers "objetivo" como rango */}
          <div style={{ marginBottom: 32, padding: 20, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border3)' }}>
            <SectionTitle number="2" color="var(--brand)">Parámetros del Mapa (Riesgo en 3 niveles)</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <RangeField label="Riesgo normal *" prefix="$" valueMin={p.riesgoNormalMin} valueMax={p.riesgoNormalMax}
                onChangeMin={v => setParam('riesgoNormalMin', v)} onChangeMax={v => setParam('riesgoNormalMax', v)} />
              <RangeField label="Riesgo A+ permitido *" prefix="$" valueMin={p.riesgoAPlusMin} valueMax={p.riesgoAPlusMax}
                onChangeMin={v => setParam('riesgoAPlusMin', v)} onChangeMax={v => setParam('riesgoAPlusMax', v)} />
              <NumField label="Hard Risk excepcional *" prefix="$" value={p.hardRiskExcepcional} onChange={v => setParam('hardRiskExcepcional', v)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <NumField label="1R nominal / riesgo referencia *" prefix="$" value={p.rNominal} onChange={v => setParam('rNominal', v)} />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                Unidad que usa ESTE Mapa para normalizar cada trade en R al calcular la Distribución de RR — no es el riesgo configurado en la cuenta.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <NumField label="Win Rate mínimo *" suffix="%" value={p.winRateMin} onChange={v => setParam('winRateMin', v)} />
              <RangeField label="Win Rate objetivo *" suffix="%" valueMin={p.winRateTarget?.min} valueMax={p.winRateTarget?.max}
                onChangeMin={v => setParamRange('winRateTarget', 'min', v)} onChangeMax={v => setParamRange('winRateTarget', 'max', v)} />
              <NumField label="Win Rate óptimo *" suffix="%" value={p.winRateOptimal} onChange={v => setParam('winRateOptimal', v)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <NumField label="Avg Loss máxima deseable *" prefix="$" value={p.avgLossMax} onChange={v => setParam('avgLossMax', v)} />
              <RangeField label="Avg Loss objetivo *" prefix="$" valueMin={p.avgLossTarget?.min} valueMax={p.avgLossTarget?.max}
                onChangeMin={v => setParamRange('avgLossTarget', 'min', v)} onChangeMax={v => setParamRange('avgLossTarget', 'max', v)} />
              <NumField label="Avg Loss óptima *" prefix="$" value={p.avgLossOptimal} onChange={v => setParam('avgLossOptimal', v)} />
            </div>
            {p.avgLossRTarget && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <NumField label="Avg Loss / 1R máxima" suffix="R" value={p.avgLossRMax} onChange={v => setParam('avgLossRMax', v)} />
                <RangeField label="Avg Loss / 1R objetivo" suffix="R" valueMin={p.avgLossRTarget?.min} valueMax={p.avgLossRTarget?.max}
                  onChangeMin={v => setParamRange('avgLossRTarget', 'min', v)} onChangeMax={v => setParamRange('avgLossRTarget', 'max', v)} />
                <NumField label="Avg Loss / 1R óptima" suffix="R" value={p.avgLossROptimal} onChange={v => setParam('avgLossROptimal', v)} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <NumField label="RR realizado mínimo *" value={p.rrRealizedMin} onChange={v => setParam('rrRealizedMin', v)} />
              <RangeField label="RR realizado objetivo *" valueMin={p.rrRealizedTarget?.min} valueMax={p.rrRealizedTarget?.max}
                onChangeMin={v => setParamRange('rrRealizedTarget', 'min', v)} onChangeMax={v => setParamRange('rrRealizedTarget', 'max', v)} />
              <NumField label="RR realizado óptimo *" value={p.rrRealizedOptimal} onChange={v => setParam('rrRealizedOptimal', v)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <NumField label="Profit Factor mínimo *" value={p.pfMin} onChange={v => setParam('pfMin', v)} />
              <RangeField label="Profit Factor objetivo *" valueMin={p.pfTarget?.min} valueMax={p.pfTarget?.max}
                onChangeMin={v => setParamRange('pfTarget', 'min', v)} onChangeMax={v => setParamRange('pfTarget', 'max', v)} />
              <NumField label="Profit Factor óptimo *" value={p.pfOptimal} onChange={v => setParam('pfOptimal', v)} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
              "RR realizado" = Avg Win / Avg Loss (la misma métrica, un solo campo — evita duplicarla con otro nombre).
            </div>
          </div>

          {/* 3. REGLAS DE CUENTA — con Aplica/No aplica */}
          <div style={{ marginBottom: 32, padding: 20, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border3)' }}>
            <SectionTitle number="3" color="var(--brand)">Reglas de Cuenta (Prop Firm)</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <NumField label="Drawdown disponible *" prefix="$" value={form.accountRules?.drawdownAvailable} onChange={v => setNumRule('drawdownAvailable', v)} />
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tipo de Drawdown *</label>
                <select value={form.accountRules?.drawdownType || ''} onChange={e => setRule('drawdownType', e.target.value)}>
                  {DRAWDOWN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <AplicaToggle label="Objetivo mínimo diario" applies={form.accountRules?.dailyTargetMin != null}
                onToggleApplies={applies => setRuleApplies('dailyTargetMin', applies)}
                value={form.accountRules?.dailyTargetMin} onChangeValue={v => setNumRule('dailyTargetMin', v)} />
              <AplicaToggle label="Días mínimos requeridos" applies={form.accountRules?.minDaysRequired != null}
                onToggleApplies={applies => setRuleApplies('minDaysRequired', applies)}
                value={form.accountRules?.minDaysRequired} onChangeValue={v => setNumRule('minDaysRequired', v)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <AplicaToggle label="Target mínimo de capitalización" applies={form.accountRules?.capitalizationMin != null}
                onToggleApplies={applies => setRuleApplies('capitalizationMin', applies)}
                value={form.accountRules?.capitalizationMin} onChangeValue={v => setNumRule('capitalizationMin', v)} />
              <AplicaToggle label="Target objetivo de capitalización" applies={form.accountRules?.capitalizationOptimal != null}
                onToggleApplies={applies => setRuleApplies('capitalizationOptimal', applies)}
                value={form.accountRules?.capitalizationOptimal} onChangeValue={v => setNumRule('capitalizationOptimal', v)} />
            </div>
          </div>

          {/* 4. DISTRIBUCIÓN DE RR — bloque exclusivo de esta plantilla */}
          <div style={{ marginBottom: 32, padding: 20, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border3)' }}>
            <SectionTitle number="4" color="var(--brand)">Distribución de RR (por frecuencia)</SectionTitle>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>
              Mide frecuencia (% de trades). La contribución al P&L de cada rango se calcula sola, no se rellena a mano.
            </div>
            {(form.rrDistribution?.buckets || []).map((b, i) => (
              <div key={b.key} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 10, marginBottom: 10, alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Rango</label>
                  <div style={{ padding: '10px 12px', borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 12.5, fontWeight: 600 }}>
                    {b.label}
                  </div>
                </div>
                <NumField label="Mín (R)" value={b.min} onChange={v => setBucket(i, 'min', v)} />
                <NumField label="Máx (R)" value={b.max ?? ''} onChange={v => setBucket(i, 'max', v)} placeholder="sin límite" />
                <NumField label="Benchmark" suffix="%" value={b.benchmarkPct} onChange={v => setBucket(i, 'benchmarkPct', v)} />
              </div>
            ))}
            {form.rrDistribution?.expansionAPlus && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 10, marginTop: 4 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Expansión A+ (subgrupo)</label>
                  <div style={{ padding: '10px 12px', borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 12.5, fontWeight: 600 }}>
                    Contenido dentro del último rango
                  </div>
                </div>
                <NumField label="Mín (R)" value={form.rrDistribution.expansionAPlus.min} onChange={v => setExpansion('min', v)} />
                <NumField label="Benchmark mín" suffix="%" value={form.rrDistribution.expansionAPlus.benchmarkPctMin} onChange={v => setExpansion('benchmarkPctMin', v)} />
                <NumField label="Benchmark máx" suffix="%" value={form.rrDistribution.expansionAPlus.benchmarkPctMax} onChange={v => setExpansion('benchmarkPctMax', v)} />
              </div>
            )}
          </div>

          {/* 5. DIAGNÓSTICO */}
          <div style={{ marginBottom: 32, padding: 20, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border3)' }}>
            <SectionTitle number="5" color="var(--brand)">Diagnóstico del Mapa</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Qué hacer <span style={{ fontWeight: 400, color: 'var(--text3)' }}>opcional</span></label>
                <textarea rows={4} value={form.diagnosis?.whatToDo || ''} onChange={e => setDiag('whatToDo', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Qué evitar <span style={{ fontWeight: 400, color: 'var(--text3)' }}>opcional</span></label>
                <textarea rows={4} value={form.diagnosis?.whatToAvoid || ''} onChange={e => setDiag('whatToAvoid', e.target.value)} />
              </div>
            </div>
          </div>

          </fieldset>

          {/* 6. VISTA PREVIA Y ACCIONES */}
          <div style={{ padding: 20, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border3)' }}>
            <SectionTitle number="6" color="var(--brand)">Vista previa y acciones</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{form.name || 'Sin nombre'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{form.identification?.environment || '—'} · Híbrido de Expansión</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canEdit && (
                  <>
                    <button className="btn btn-outline btn-sm" onClick={handleDuplicate}><Copy size={13} /> Duplicar Mapa</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave}><Save size={13} /> {justSaved ? 'Guardado ✓' : 'Guardar Mapa'}</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Blueprints() {
  const navigate = useNavigate()
  const location = useLocation()

  const blueprints = useBlueprintsList()
  const addBlueprintInStore = useBlueprintsStore(s => s.addBlueprint)
  const tier = useTier()
  const profile = useProfile()
  const canEdit = isAdmin(profile)
  const [selectedId, setSelectedId] = useState(null)
  const [showPricing, setShowPricing] = useState(false)

  useEffect(() => {
    if (location.state?.openBlueprintId) {
      setSelectedId(location.state.openBlueprintId)
    }
  }, [location.state])

  const selectedBlueprint = blueprints.find(b => b.id === selectedId) || null

  const handleAddNew = () => {
    const newId = addBlueprintInStore(EMPTY_BLUEPRINT)
    setSelectedId(newId)
  }

  return (
    <div className="page-inner">
      <div style={{ marginBottom: 40 }}>
        <PageHeader
          title="Mapas"
          subtitle="Mapas estadísticos editables"
        >
          {canEdit && (
            <button className="btn btn-primary" onClick={handleAddNew}>
              + Nuevo Mapa
            </button>
          )}
        </PageHeader>
      </div>

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

      {selectedBlueprint && (
        selectedBlueprint.templateType === 'hibrido-expansion' ? (
          <HibridoExpansionEditorPanel
            blueprint={selectedBlueprint}
            onClose={() => setSelectedId(null)}
            navigate={navigate}
            onDuplicated={(newId) => setSelectedId(newId)}
            canEdit={canEdit}
          />
        ) : (
          <BlueprintEditorPanel
            blueprint={selectedBlueprint}
            onClose={() => setSelectedId(null)}
            navigate={navigate}
            onDuplicated={(newId) => setSelectedId(newId)}
            canEdit={canEdit}
          />
        )
      )}

      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
    </div>
  )
}
