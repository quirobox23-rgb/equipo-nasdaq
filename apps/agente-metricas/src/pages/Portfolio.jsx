import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Map as MapIcon, Target, CheckCircle2, Check, Clock, Trophy, AlertTriangle, XCircle, CircleCheck, Briefcase, Brain, Ban, Zap, X, Pencil, Trash2, Upload, ShieldAlert, Star, LifeBuoy, Lock, ChevronDown, ChevronUp, Info, SlidersHorizontal } from 'lucide-react'
import { PageHeader, ProgressBar, Badge, Tag, BlueprintMatchResults, RRDistributionPanel } from '@/components/ui'
import { useAccounts, useStore, useTier, usePortfolioCardStyle, useSetPortfolioCardStyle, useHasFeature } from '@/store/useStore'
import { accountLimitFor, TIER_LABELS, TIERS } from '@/config/features'
import PricingModal from '@/components/upgrade/PricingModal'
import { ACCOUNT_TYPES } from '@/data/mockData'
import { PROP_FIRM_PRESETS, getPreset } from '@/data/propFirmPresets'
import AccountImportCsvModal from '@/components/import/AccountImportCsvModal'
import AccountWizard from '@/components/accounts/AccountWizard'
import AccountEditPanel from '@/components/accounts/AccountEditPanel'
import CyclesManager from '@/components/accounts/CyclesManager'
import { CycleFilterButton, CycleDialog, CyclesManageDialog, Toast } from '@/components/accounts/CyclesUI'
import { useAllCycleNames } from '@/store/useCyclesStore'
import { NO_CYCLE } from '@/lib/accountGroups'
import { Chips, fmtMoney } from '@/components/accounts/accountFormShared'
import { accountInGroup, cycleOptions, mapOptions } from '@/lib/accountGroups'
import { useBlueprintsList } from '@/store/useBlueprintsStore'
import { useAccountBlueprintStore, useAccountBlueprintAssignments } from '@/store/useAccountBlueprintStore'
import { rankBlueprintsByCompatibility } from '@/config/trainingRecommendations'
import { computeAccountMetrics, matchBlueprintToAccount } from '@/config/blueprintMatchEngine'
import { matchHibridoExpansionToAccount } from '@/config/hibridoExpansionEngine'
import { computeEOT } from '@/config/eotEngine'
import { sumTradeDollars, tradeDollar, totalWithdrawn } from '@/lib/tradeDollar'
import { groupIntoOperations } from '@/lib/operations'

// Alta y edición nuevas (wireframe 08/10/2026): modal por pasos +
// panel lateral. En false vuelve el formulario de siempre (AccountForm,
// que queda intacto como respaldo mientras se prueba).
const ACCOUNT_FORM_V2 = true

// Filtros "Avanzado" (Ciclo + Mapa + Gestionar ciclos) de la primera
// versión. Rediseño 01/11/2026: un solo botón "Ciclo" (CyclesUI), sin
// filtro de Mapa en Portafolio. En true vuelve la barra anterior.
const PORTFOLIO_ADVANCED_V1 = false

// ── Color tokens por tipo ──────────────────────
const TYPE_COLOR = {
  Challenge: { accent: 'var(--text2)', bg: 'var(--bg3)',  border: 'var(--border2)' },
  Funded:    { accent: 'var(--text2)', bg: 'var(--bg2)',  border: 'var(--border)' },
  Personal:  { accent: 'var(--text2)', bg: 'var(--bg2)', border: 'var(--border)' },
}

// ── Color tokens por estado ────────────────────
const TYPE_GROUPS   = ['Challenge', 'Funded', 'Personal']
const STATUS_COLOR = {
  active:   { dot: 'var(--brand)', label: 'Activa'     },
  approved: { dot: 'var(--amber)', label: 'Completada' },
  lost:     { dot: 'var(--neg)',   label: 'Perdida'    },
}

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Activa'     },
  { value: 'approved', label: 'Completada' },
  { value: 'lost',     label: 'Perdida'    },
]

const STATUS_FILTERS = [
  { value: 'all',      cardLabel: 'TOTAL',        label: 'Todas',       color: 'var(--text)',  icon: Briefcase,   iconColor: 'green' },
  { value: 'active',   cardLabel: 'ACTIVAS',      label: 'Activas',     color: 'var(--brand)', icon: CircleCheck, iconColor: 'green' },
  { value: 'approved', cardLabel: 'COMPLETADAS',  label: 'Completadas', color: 'var(--amber)', icon: Trophy,      iconColor: 'green' },
  { value: 'lost',     cardLabel: 'PERDIDAS',     label: 'Perdidas',    color: '#E37272',      icon: XCircle,     iconColor: 'green' },
]

const TYPE_FILTERS = [
  { value: 'all',       label: 'Todas' },
  { value: 'Challenge', label: 'Challenge' },
  { value: 'Funded',    label: 'Funded' },
  { value: 'Personal',  label: 'Capital real' },
  { value: 'other',     label: 'Otros' },
]

const EMPTY_FORM = {
  firm: '', type: 'Challenge', phase: 'Phase 1', size: '',
  currency: 'USD', profitTarget: '', maxDrawdown: 10,
  maxDailyDD: 5, drawdownType: 'trailing_eod', currentProfit: 0, currentDD: 0,
  status: 'active', startDate: new Date().toISOString().split('T')[0],
  riskPerTrade: 550,
  commissionPerContract: '',
  isFavorite: false,
  inRecovery: false,
  consistencyRules: {
    enabled: false,
    maxDailyPercent: 40,
    maxTradePercent: 20,
    maxDailyProfit: '',
    maxProfitPerTrade: '',
  },
  accountCost: '',
  activationCost: '',
  purchaseDate: '',
  activationDate: '',
  withdrawals: [],
}

function WithdrawalModal({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ?? { date: new Date().toISOString().split('T')[0], amount: '', note: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div
      style={{
        position: 'fixed', whiteSpace: 'normal', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)', padding: 20,
      }}
      onClick={onCancel}
    >
      <div className="card" style={{ width: '100%', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="card-title">{initial?.id ? 'Editar retiro' : 'Registrar retiro'}</div>
        <div className="form-group"><label>Fecha</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
        <div className="form-group"><label>Importe ($)</label>
          <input type="number" placeholder="1200" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
        <div className="form-group"><label>Nota <span style={{ fontWeight: 400, color: 'var(--text3)' }}>opcional</span></label>
          <input type="text" placeholder="Profit Split…" value={form.note} onChange={e => set('note', e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (!form.date || !form.amount) return
              onSave({ ...form, id: initial?.id ?? `w-${Date.now()}`, amount: parseFloat(form.amount) })
            }}
          >Guardar</button>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function WithdrawalsSection({ withdrawals, onChange }) {
  const [modalState, setModalState] = useState(null)

  const list = withdrawals ?? []

  const handleSave = (w) => {
    const exists = list.some(x => x.id === w.id)
    onChange(exists ? list.map(x => (x.id === w.id ? w : x)) : [...list, w])
    setModalState(null)
  }
  const handleDelete = (id) => onChange(list.filter(x => x.id !== id))

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Retiros</div>
        <button className="btn btn-secondary btn-sm" onClick={() => setModalState('new')}>+ Registrar retiro</button>
      </div>

      {list.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Todavía no hay retiros registrados para esta cuenta.</div>
      ) : (
        <table>
          <thead><tr>
            <th>Fecha</th><th>Importe</th><th>Nota</th><th style={{ textAlign: 'right' }}>Acciones</th>
          </tr></thead>
          <tbody>
            {[...list].sort((a, b) => b.date.localeCompare(a.date)).map(w => (
              <tr key={w.id}>
                <td>{w.date}</td>
                <td style={{ color: 'var(--pos)', fontWeight: 600 }}>+${Number(w.amount).toLocaleString()}</td>
                <td style={{ color: 'var(--text3)' }}>{w.note || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-sm" style={{ marginRight: 6 }} onClick={() => setModalState(w)}>Editar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(w.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalState && (
        <WithdrawalModal
          initial={modalState === 'new' ? null : modalState}
          onSave={handleSave}
          onCancel={() => setModalState(null)}
        />
      )}
    </div>
  )
}

function DeleteAccountConfirm({ account, tradeCount, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: 'fixed', whiteSpace: 'normal', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)', padding: 20,
      }}
      onClick={onCancel}
    >
      <div className="card" style={{ width: '100%', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <AlertTriangle size={16} style={{ color: 'var(--neg)', flexShrink: 0 }} />
          <div className="card-title" style={{ marginBottom: 0 }}>Eliminar cuenta</div>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6, margin: '10px 0 4px' }}>
          Vas a eliminar <strong style={{ color: 'var(--text)' }}>{account.firm}</strong>
          {tradeCount > 0 && <> junto con <strong style={{ color: 'var(--text)' }}>{tradeCount} trade{tradeCount === 1 ? '' : 's'}</strong> registrados en ella</>}.
        </p>
        <p style={{ fontSize: 12, color: 'var(--neg)', lineHeight: 1.6, marginBottom: 16 }}>
          Esta acción no se puede deshacer.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--red2)', color: 'var(--neg)', border: '1px solid rgba(227,114,114,0.3)' }}
            onClick={onConfirm}
          >
            <Trash2 size={13} /> Eliminar cuenta
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function AccountForm({ title, form, setForm, onSave, onCancel, error }) {
  const set    = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setCR  = (k, v) => setForm(f => ({
    ...f,
    consistencyRules: { ...(f.consistencyRules ?? {}), [k]: v },
  }))
  const cr = form.consistencyRules ?? {}

  const [presetId, setPresetId] = useState('')
  const applyPreset = (id) => {
    setPresetId(id)
    const preset = getPreset(id)
    if (!preset) return
    setForm(f => ({
      ...f,
      firm: preset.firm,
      phase: preset.phase,
      ...(preset.size ? { size: preset.size } : {}),
      profitTarget: preset.profitTarget,
      maxDrawdown: preset.maxDrawdown,
      maxDailyDD: preset.maxDailyDD,
      drawdownType: preset.drawdownType,
    }))
  }
  const selectedPreset = getPreset(presetId)

  return (
    <div className="card section-gap">
      <div className="card-title">{title}</div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Preset de prop firm <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(opcional, autocompleta los campos)</span></label>
        <select value={presetId} onChange={e => applyPreset(e.target.value)}>
          <option value="">— Configurar manualmente —</option>
          {PROP_FIRM_PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {selectedPreset && (
          <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
            {selectedPreset.note} · Verificado {selectedPreset.verifiedAt} — revisá las reglas actuales en la web de la firma antes de operar dinero real, pueden haber cambiado.
          </div>
        )}
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        <div className="form-group"><label>Firma / Broker *</label><input type="text" placeholder="FTMO, MyFundedFX…" value={form.firm} onChange={e => set('firm', e.target.value)} /></div>
        <div className="form-group"><label>Tipo de cuenta</label><select value={form.type} onChange={e => set('type', e.target.value)}>{ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div className="form-group"><label>Capital ($) *</label><input type="number" placeholder="100000" value={form.size} onChange={e => set('size', e.target.value)} /></div>
        <div className="form-group"><label>Fase</label><select value={form.phase} onChange={e => set('phase', e.target.value)}><option>Phase 1</option><option>Phase 2</option><option>Phase 3</option><option>Aprobada</option><option>Personal</option></select></div>
        <div className="form-group"><label>Objetivo de profit (%)</label><input type="number" placeholder="10" value={form.profitTarget} onChange={e => set('profitTarget', e.target.value)} /></div>
        <div className="form-group"><label>Max Drawdown (%)</label><input type="number" placeholder="10" value={form.maxDrawdown} onChange={e => set('maxDrawdown', e.target.value)} /></div>
        <div className="form-group"><label>Max Daily DD (%)</label><input type="number" placeholder="5" value={form.maxDailyDD} onChange={e => set('maxDailyDD', e.target.value)} /></div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Tipo de Drawdown
            <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>cómo se mide el límite</span>
          </label>
          <select value={form.drawdownType} onChange={e => set('drawdownType', e.target.value)}>
            <option value="static">Estático (límite fijo sobre el capital inicial)</option>
            <option value="trailing_eod">Trailing EOD (el límite sigue el mejor cierre de día)</option>
            <option value="trailing_live">Trailing Live (tiempo real — por ahora aproximado con EOD)</option>
          </select>
          {form.drawdownType === 'trailing_live' && (
            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
              Todavía no hay feed de precio en tiempo real conectado — el cálculo usa el mismo motor que Trailing EOD (más conservador que no calcular nada), pero la cuenta queda marcada como "Trailing Live" para diferenciarla el día que se implemente el cálculo real.
            </div>
          )}
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Riesgo por trade ($)
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>usado para calcular R</span>
          </label>
          <input type="number" placeholder="550" value={form.riskPerTrade} onChange={e => set('riskPerTrade', e.target.value)} />
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Comisión por contrato ($)
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>ida y vuelta, se resta al importar CSV</span>
          </label>
          <input type="number" step="0.01" placeholder="0" value={form.commissionPerContract ?? ''} onChange={e => set('commissionPerContract', e.target.value)} />
        </div>
        <div className="form-group"><label>Profit actual (%)</label><input type="number" placeholder="0" value={form.currentProfit} onChange={e => set('currentProfit', e.target.value)} /></div>
        <div className="form-group"><label>Drawdown actual (%)</label><input type="number" placeholder="0" value={form.currentDD} onChange={e => set('currentDD', e.target.value)} /></div>
        <div className="form-group"><label>Estado</label><select value={form.status} onChange={e => set('status', e.target.value)}>{STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="form-group"><label>Fecha de inicio</label><input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></div>
      </div>

      <div style={{ marginTop: 20, padding: '16px', borderRadius: 'var(--r2)', background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: cr.enabled ? 16 : 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}><Target size={13} /> Reglas de Consistencia</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              Control de profit máximo por día y por trade (prop firms, payouts)
            </div>
          </div>
          <div
            onClick={() => setCR('enabled', !cr.enabled)}
            style={{
              width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
              background: cr.enabled ? 'var(--brand)' : 'var(--bg5)',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              border: `1px solid ${cr.enabled ? 'var(--brand)' : 'var(--border2)'}`,
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: cr.enabled ? 20 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>

        {cr.enabled && (
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Máx. % del profit total por día</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)', fontWeight: 700 }}>
                  {cr.maxDailyPercent ?? 40}%
                </span>
              </label>
              <input
                type="range" min="10" max="80" step="5"
                value={cr.maxDailyPercent ?? 40}
                onChange={e => setCR('maxDailyPercent', parseInt(e.target.value))}
                style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
              />
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                FTMO: 40% · The5ers: 50% · TopStep: sin límite
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Máx. % del profit total por trade</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)', fontWeight: 700 }}>
                  {cr.maxTradePercent ?? 20}%
                </span>
              </label>
              <input
                type="range" min="5" max="60" step="5"
                value={cr.maxTradePercent ?? 20}
                onChange={e => setCR('maxTradePercent', parseInt(e.target.value))}
                style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
              />
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Recomendado: 20% para no depender de un solo trade
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Límite de profit diario ($) <span style={{ fontWeight: 400, color: 'var(--text3)' }}>opcional</span></label>
              <input
                type="number" placeholder="ej: 500"
                value={cr.maxDailyProfit ?? ''}
                onChange={e => setCR('maxDailyProfit', e.target.value)}
              />
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                Sugiere parar cuando se alcanza este límite en el día
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Límite de profit por trade ($) <span style={{ fontWeight: 400, color: 'var(--text3)' }}>opcional</span></label>
              <input
                type="number" placeholder="ej: 250"
                value={cr.maxProfitPerTrade ?? ''}
                onChange={e => setCR('maxProfitPerTrade', e.target.value)}
              />
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                Alerta si un trade supera este importe
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, padding: '16px', borderRadius: 'var(--r2)', background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}><Briefcase size={13} /> Información financiera</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
          Usada en Inversión y retiros para calcular inversión, retornos y ROI de esta cuenta.
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Costo de la cuenta ($)</label>
            <input type="number" placeholder="0" value={form.accountCost} onChange={e => set('accountCost', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Costo de activación ($) <span style={{ fontWeight: 400, color: 'var(--text3)' }}>0 si aún no se ha pagado</span></label>
            <input type="number" placeholder="0" value={form.activationCost} onChange={e => set('activationCost', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Fecha de compra</label>
            <input type="date" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Fecha de activación <span style={{ fontWeight: 400, color: 'var(--text3)' }}>opcional</span></label>
            <input type="date" value={form.activationDate} onChange={e => set('activationDate', e.target.value)} />
          </div>
        </div>

        <WithdrawalsSection withdrawals={form.withdrawals} onChange={ws => set('withdrawals', ws)} />
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)', fontSize: 12, padding: '8px 12px', background: 'var(--red2)', borderRadius: 'var(--r)', marginBottom: 8, marginTop: 12 }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={onSave}>Guardar</button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

// startInPicker / onDone (opcionales): la vista Tabla abre este bloque
// directo en modo "cambiar mapa" y cierra su modal al elegir o cancelar.
// La card no los pasa y el comportamiento queda igual que antes.
function BlueprintAssignmentBlock({ account, accountTrades, flat, startInPicker = false, onDone }) {
  const blueprints = useBlueprintsList()
  const assignments = useAccountBlueprintAssignments()
  const assignBlueprint = useAccountBlueprintStore(s => s.assignBlueprint)
  const clearBlueprint = useAccountBlueprintStore(s => s.clearBlueprint)

  const [showRanking, setShowRanking] = useState(false)
  const [showManualPicker, setShowManualPicker] = useState(startInPicker)
  const [showMatchPanel, setShowMatchPanel] = useState(false)

  const assignedId = assignments[account.id] || null
  const assignedBlueprint = blueprints.find(b => b.id === assignedId) || null

  const accountMetrics = useMemo(() => computeAccountMetrics(accountTrades, account), [accountTrades, account])
  const ranking = useMemo(() => rankBlueprintsByCompatibility(blueprints, accountMetrics, account, accountTrades), [blueprints, accountMetrics, account, accountTrades])

  const match = useMemo(
    () => assignedBlueprint?.templateType === 'hibrido-expansion'
      ? matchHibridoExpansionToAccount(assignedBlueprint, account, accountTrades)
      : matchBlueprintToAccount(assignedBlueprint, accountMetrics),
    [assignedBlueprint, accountMetrics, account, accountTrades]
  )

  const handleAssign = (blueprintId) => {
    if (blueprintId) assignBlueprint(account.id, blueprintId)
    else clearBlueprint(account.id)
    setShowRanking(false)
    setShowManualPicker(false)
    onDone?.()
  }

  return (
    <div style={flat
      ? { marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)' }
      : { marginBottom: 14, padding: 12, borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)' }
    }>
      {assignedBlueprint && !showManualPicker && !showRanking ? (
        // ── Cuenta → Blueprint asignado → Compatibilidad → Cambiar Blueprint ──
        // Dos filas (no todo en una sola fila flex): el nombre del Mapa
        // puede ser largo ("Santos RR negativo modelo 2") y con badge +
        // 2 botones en la misma fila se apretaba/desencajaba en cards
        // angostas. Fila 1: nombre + compatibilidad. Fila 2: acciones.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={flat
              ? { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }
              : { fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase' }
            }>
              Mapa asignado
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginTop: 4, lineHeight: 1.4 }}>{assignedBlueprint.name}</div>
            {accountMetrics && (
              <div style={{ marginTop: 6 }}>
                <Badge variant={match.compatibility >= 70 ? 'pos' : match.compatibility >= 40 ? 'amber' : 'red'}>
                  Compatibilidad {match.compatibility}%
                </Badge>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setShowMatchPanel(true)} disabled={!accountMetrics}>
              Ver comparación
            </button>
            <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setShowManualPicker(true)}>
              Cambiar Mapa
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: showRanking || showManualPicker ? 10 : 0 }}>
            <span style={flat
              ? { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }
              : { fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase' }
            }>
              Mapa asignado
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
              {(() => {
                const manualBtn = (
                  <button key="manual" className="btn btn-outline btn-sm" style={{ flex: 1, minWidth: 0 }} onClick={() => { setShowManualPicker(m => !m); setShowRanking(false) }}>
                    Elegir manualmente
                  </button>
                )
                const recommendBtn = (
                  <button key="recommend" className="btn btn-outline btn-sm" style={{ flex: 1, minWidth: 0 }} onClick={() => { setShowRanking(r => !r); setShowManualPicker(false) }}>
                    Recomendar Mapa
                  </button>
                )
                return flat ? [recommendBtn, manualBtn] : [manualBtn, recommendBtn]
              })()}
              {(showManualPicker || showRanking) && assignedBlueprint && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowManualPicker(false); setShowRanking(false); onDone?.() }}>
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {showManualPicker && (
            <select value={assignedId ?? ''} onChange={e => handleAssign(e.target.value || null)}>
              <option value="">Ninguno</option>
              {blueprints.map(bp => (
                <option key={bp.id} value={bp.id}>{bp.name}</option>
              ))}
            </select>
          )}

          {showRanking && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ranking.map(({ blueprint, compatibility }, i) => (
                <div key={blueprint.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 9px', borderRadius: 6, background: 'var(--bg2)',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)', width: 14 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{blueprint.name}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{compatibility}%</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleAssign(blueprint.id)}>
                    Usar
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showMatchPanel && assignedBlueprint && accountMetrics && (
        <BlueprintMatchPanel
          account={account}
          blueprint={assignedBlueprint}
          match={match}
          onClose={() => setShowMatchPanel(false)}
        />
      )}
    </div>
  )
}

// onChangeMap (opcional): la vista Tabla lo pasa para ofrecer "Cambiar mapa"
// desde acá; la card no lo pasa y el panel queda igual que antes.
function BlueprintMatchPanel({ account, blueprint, match, onClose, onChangeMap }) {
  return (
    <div
      style={{
        position: 'fixed', whiteSpace: 'normal', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)', padding: 20, overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div className="card" style={{ width: '100%', maxWidth: 620, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        {/* Título + botones en una fila; la línea cuenta → mapa va debajo a
            todo el ancho, para que no quede pegada a los botones. */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div style={{
              fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 900, color: 'var(--text)',
              textTransform: 'uppercase', letterSpacing: '0.6px', minWidth: 0,
            }}>
              Comparación con el Mapa
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {onChangeMap && <button className="btn btn-outline btn-sm" onClick={onChangeMap}>Cambiar mapa</button>}
              <button className="btn btn-outline btn-sm" onClick={onClose}>Cerrar</button>
            </div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 12 }}>{accountLabelInline(account)} → {blueprint.name}</div>
        </div>

        <BlueprintMatchResults {...match} />
        {blueprint.templateType === 'hibrido-expansion' && match.rrDistribution && (
          <RRDistributionPanel distribution={match.rrDistribution} speed={match.speedToTarget} />
        )}
      </div>
    </div>
  )
}

function accountLabelInline(account) {
  const size = account.size >= 1000 ? `${Math.round(account.size / 1000)}K` : account.size
  return `${account.firm} ${size}`
}

function AccountRangeGauge({ account, accountMetrics, totalDollar }) {
  if (!account.profitTarget || !account.maxDrawdown) return null

  const ddUsed      = accountMetrics ? accountMetrics.maxDrawdown : 0
  const ddMax       = parseFloat(account.maxDrawdown)
  const ddRemaining = Math.max(0, ddMax - ddUsed)
  const currentUSD  = account.size + totalDollar - totalWithdrawn(account)
  const floorUSD    = currentUSD - (ddRemaining / 100) * account.size
  const targetUSD   = account.size * (1 + parseFloat(account.profitTarget) / 100)
  const span        = targetUSD - floorUSD
  const posPct      = span > 0 ? Math.min(100, Math.max(0, ((currentUSD - floorUSD) / span) * 100)) : 50

  const fmt = (n) => `$${Math.round(n).toLocaleString()}`

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
        Posición actual
      </div>
      <div style={{ position: 'relative', height: 6, borderRadius: 3, marginBottom: 8, marginTop: 4 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 3,
          background: 'linear-gradient(90deg, var(--neg) 0%, var(--bg4) 45%, var(--bg4) 55%, var(--pos) 100%)',
        }} />
        <div
          title={`Balance actual: ${fmt(currentUSD)}`}
          style={{
            position: 'absolute', top: '50%', left: `${posPct}%`, transform: 'translate(-50%, -50%)',
            width: 13, height: 13, borderRadius: '50%', background: '#fff', cursor: 'default',
            border: '2px solid var(--bg2)', boxShadow: '0 0 0 1px var(--border2), 0 2px 6px rgba(0,0,0,0.35)',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--neg)' }}>{fmt(floorUSD)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: '0.4px' }}>MLL</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--pos)' }}>{fmt(targetUSD)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: '0.4px' }}>TARGET</div>
        </div>
      </div>
    </div>
  )
}

function AccountRangeGaugeSimple({ account, totalDollar, cardStyle }) {
  if (!account.profitTarget || !account.maxDrawdown) return null

  const ddMax       = parseFloat(account.maxDrawdown)
  const currentUSD  = account.size + totalDollar - totalWithdrawn(account)
  const floorUSD     = account.size * (1 - ddMax / 100)
  const targetUSD    = account.size * (1 + parseFloat(account.profitTarget) / 100)
  const span         = targetUSD - floorUSD
  const posPct       = span > 0 ? Math.min(100, Math.max(0, ((currentUSD - floorUSD) / span) * 100)) : 50
  const zeroPct      = span > 0 ? Math.min(100, Math.max(0, ((account.size - floorUSD) / span) * 100)) : 50
  const isPositive   = posPct >= zeroPct
  const fillLeftPct  = Math.min(zeroPct, posPct)
  const fillWidthPct = Math.abs(posPct - zeroPct)

  const fmt = (n) => `$${Math.round(n).toLocaleString()}`

  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: cardStyle === 'simple' ? 'var(--text3)' : 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        Posición actual
      </div>
      <div style={{ position: 'relative', height: 10, marginBottom: 8, marginTop: 32 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 5,
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--border3)', filter: 'brightness(1.25)' }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: `${fillLeftPct}%`, width: `${fillWidthPct}%`,
            background: isPositive ? 'linear-gradient(90deg, #1E40AF, #3B82F6)' : 'linear-gradient(90deg, #c94a4a, #ed553b)',
          }} />
        </div>
        <div
          title={`Capital inicial: ${fmt(account.size)}`}
          style={{
            position: 'absolute', top: '50%', left: `${zeroPct}%`, transform: 'translate(-50%, -50%)',
            width: 2, height: 14, borderRadius: 1, background: 'var(--text2)', cursor: 'default',
          }}
        />
        <div style={{
          position: 'absolute', bottom: '100%',
          left: `${zeroPct}%`,
          transform: zeroPct < 15 ? 'translate(0%, 0)' : zeroPct > 85 ? 'translate(-100%, 0)' : 'translate(-50%, 0)',
          marginBottom: 3, textAlign: zeroPct < 15 ? 'left' : zeroPct > 85 ? 'right' : 'center', whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.4px' }}>INICIO</div>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text2)' }}>{fmt(account.size)}</div>
        </div>
        <div
          title={`Balance actual: ${fmt(currentUSD)}`}
          style={{
            position: 'absolute', top: '50%', left: `${posPct}%`, transform: 'translate(-50%, -50%)',
            width: 3, height: 18, borderRadius: 2, background: '#fff', cursor: 'default',
            border: '1px solid var(--bg2)', boxShadow: '0 0 0 1px var(--border2), 0 2px 6px rgba(0,0,0,0.35)',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--neg)' }}>{fmt(floorUSD)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: '0.4px' }}>MLL</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--pos)' }}>{fmt(targetUSD)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: '0.4px' }}>TARGET</div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  EOT PANEL — Estado Operativo del Trader (config/eotEngine.js)
//  "¿Cuánto puedo arriesgar HOY?" — motor nuevo, independiente del
//  corredor MLL↔TARGET y del panel de Consistency Control (esos
//  responden preguntas distintas). Visible siempre que la cuenta
//  tenga trades.
// ─────────────────────────────────────────────
// bg/border en rgba reales (no var()+sufijo, eso es CSS inválido y el
// borde se perdía) — mismo criterio 0.06 fondo / 0.25 borde que "Card
// de recomendación" (ver StyleGuide → Cards), para que este panel no
// pese más que el resto del contenido de la card.
const EOT_STYLE = {
  NEUTRAL:     { color: 'var(--pos)',   bg: 'rgba(90,164,105,0.06)', border: 'rgba(90,164,105,0.25)', icon: CheckCircle2 },
  CONSERVADOR: { color: 'var(--amber)', bg: 'rgba(246,213,92,0.06)', border: 'rgba(246,213,92,0.25)', icon: AlertTriangle },
  DEFENSIVO:   { color: 'var(--amber)', bg: 'rgba(246,213,92,0.06)', border: 'rgba(246,213,92,0.25)', icon: ShieldAlert },
  BLOQUEADO:   { color: 'var(--neg)',   bg: 'rgba(237,85,59,0.06)',  border: 'rgba(237,85,59,0.25)',  icon: Lock },
}

function EotPanel({ account, accountTrades }) {
  const eot = useMemo(() => computeEOT(account, accountTrades), [account, accountTrades])
  const [expanded, setExpanded] = useState(false)
  if (!eot) return null

  const style = EOT_STYLE[eot.estado] || EOT_STYLE.NEUTRAL
  const Icon = style.icon

  return (
    <div style={{
      marginBottom: 14, padding: '10px 12px', borderRadius: 8,
      background: style.bg, border: `1px solid ${style.border}`,
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <Icon size={15} style={{ color: style.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: style.color, letterSpacing: '0.3px' }}>
            {eot.estado} · Riesgo hoy: ${eot.maxRisk.toLocaleString()} ({eot.pctRisk}%)
          </div>
        </div>
        {expanded ? <ChevronUp size={14} color="var(--text3)" /> : <ChevronDown size={14} color="var(--text3)" />}
      </div>
      {expanded && eot.reasons?.length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {eot.reasons.map((r, i) => (
            <li key={i} style={{ fontSize: 12, color: 'var(--text)' }}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AccountCardStatsDetailed({ a, accountMetrics, totalDollar }) {
  return (<>
    {a.profitTarget && (() => {
      // Profit desde los trades (P&L acumulado / capital), igual que el
      // balance. a.currentProfit se carga a mano y nunca se actualiza,
      // por eso la barra quedaba siempre en 0%.
      // const profitDone      = parseFloat(a.currentProfit) || 0
      // Descuenta los retiros (igual que el balance y la barra): el objetivo
      // es lo que falta para el próximo retiro, no la ganancia histórica.
      // const profitDone      = parseFloat((((totalDollar || 0) / a.size) * 100).toFixed(2))
      const profitDone      = parseFloat(((((totalDollar || 0) - totalWithdrawn(a)) / a.size) * 100).toFixed(2))
      const profitTarget    = parseFloat(a.profitTarget)
      const profitRemaining = Math.max(0, profitTarget - profitDone)
      const profitDone$     = ((profitDone      / 100) * a.size).toLocaleString('en', { maximumFractionDigits: 0 })
      const profitTarget$   = ((profitTarget    / 100) * a.size).toLocaleString('en', { maximumFractionDigits: 0 })
      const profitLeft$     = ((profitRemaining / 100) * a.size).toLocaleString('en', { maximumFractionDigits: 0 })
      const completed       = profitDone >= profitTarget
      return (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Profit</div>
          <ProgressBar value={profitDone} max={profitTarget} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 6 }}>
            <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 12, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>
                Objetivo
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{profitTarget}%</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>${profitTarget$}</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 12, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>
                Hecho
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: profitDone < 0 ? 'var(--neg)' : 'var(--pos)' }}>{profitDone}%</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>{profitDone < 0 ? '-' : ''}${profitDone$.replace('-', '')}</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 12, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>
                {completed ? 'Logrado' : 'Falta'}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: completed ? 'var(--pos)' : 'var(--neutral)' }}>
                {completed ? <Check size={13} /> : `${profitRemaining.toFixed(1)}%`}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>{completed ? '—' : `$${profitLeft$}`}</div>
            </div>
          </div>
        </div>
      )
    })()}

    {a.maxDrawdown && (() => {
      const ddUsed      = accountMetrics ? accountMetrics.maxDrawdown : 0
      const ddMax       = parseFloat(a.maxDrawdown)
      const ddRemaining = Math.max(0, ddMax - ddUsed)
      const ddUsed$     = ((ddUsed      / 100) * a.size).toLocaleString('en', { maximumFractionDigits: 0 })
      const ddMax$      = ((ddMax       / 100) * a.size).toLocaleString('en', { maximumFractionDigits: 0 })
      const ddLeft$     = ((ddRemaining / 100) * a.size).toLocaleString('en', { maximumFractionDigits: 0 })
      return (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Drawdown</div>
          <ProgressBar value={ddUsed} max={ddMax} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 6 }}>
            <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 12, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>
                Máximo
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{ddMax}%</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>${ddMax$}</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 12, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>
                Usado
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--neg)' }}>{ddUsed}%</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>${ddUsed$}</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 12, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>
                Restante
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--pos)' }}>{ddRemaining.toFixed(1)}%</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>${ddLeft$}</div>
            </div>
          </div>
        </div>
      )
    })()}
  </>)
}

const DRAWDOWN_TYPE_LABEL = {
  static:        'Drawdown estático',
  trailing_eod:  'Drawdown EOD',
  trailing_live: 'Drawdown live',
}

function AccountCardStatsSimple({ a, totalDollar }) {
  const balanceCurrent = a.size + totalDollar - totalWithdrawn(a)
  // Profit desde los trades — ver comentario en AccountCardStatsDetailed.
  // const profitDone      = parseFloat(a.currentProfit) || 0
  // Descuenta los retiros — ver comentario en AccountCardStatsDetailed.
  // const profitDone      = ((totalDollar || 0) / a.size) * 100
  const profitDone      = (((totalDollar || 0) - totalWithdrawn(a)) / a.size) * 100
  const profitTarget    = a.profitTarget ? parseFloat(a.profitTarget) : null
  const profitDone$     = (profitDone / 100) * a.size
  const profitTarget$   = profitTarget !== null ? (profitTarget / 100) * a.size : null
  const completed       = profitTarget !== null && profitDone >= profitTarget

  const fmt = (n) => `$${Math.round(n).toLocaleString()}`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
      <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>
          Balance
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: totalDollar >= 0 ? 'var(--pos)' : 'var(--neg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fmt(balanceCurrent)} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>/ {fmt(a.size)}</span>
        </div>
      </div>
      {profitTarget !== null && (
        <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>
            Profit Target
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: completed ? 'var(--pos)' : profitDone$ < 0 ? 'var(--neg)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profitDone$ < 0 ? '-' : ''}{fmt(Math.abs(profitDone$))} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>/ {fmt(profitTarget$)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Media ganadora de ESTA cuenta: por trade (trades ganadores) y por día
// (días que cerraron en verde). Mismo estilo de caja que Balance.
function AccountWinAverages({ accountTrades, riskPerTrade }) {
  // Por operación completa: los cierres parciales de una posición son
  // un solo ganador
  const wins = groupIntoOperations(accountTrades, riskPerTrade).filter(t => t.result === 'win')
  const avgWinTrade = wins.length ? wins.reduce((s, t) => s + tradeDollar(t, riskPerTrade), 0) / wins.length : null
  const byDay = {}
  accountTrades.forEach(t => { if (t.date) byDay[t.date] = (byDay[t.date] || 0) + tradeDollar(t, riskPerTrade) })
  const greenDays = Object.values(byDay).filter(v => v > 0)
  const avgWinDay = greenDays.length ? greenDays.reduce((s, v) => s + v, 0) / greenDays.length : null

  const box = (label, value, sub) => (
    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: value === null ? 'var(--text3)' : 'var(--pos)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value === null ? '—' : `+$${Math.round(value).toLocaleString()}`} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{sub}</span>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
      {box('Avg win / trade', avgWinTrade, `${wins.length} ganadores`)}
      {box('Avg win / día', avgWinDay, `${greenDays.length} días verdes`)}
    </div>
  )
}

function AccountCard({ a, trades, onEditStart, onDelete, isEditing = false }) {
  const navigate = useNavigate()
  const cardStyle = usePortfolioCardStyle()
  const updateAccount = useStore(s => s.updateAccount)
  const tc = TYPE_COLOR[a.type]     ?? TYPE_COLOR.Challenge
  const sc = STATUS_COLOR[a.status] ?? STATUS_COLOR.active
  const [showImport, setShowImport] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const toggleFavorite = (e) => { e.stopPropagation(); updateAccount(a.id, { isFavorite: !a.isFavorite }) }
  const toggleRecovery = (e) => { e.stopPropagation(); updateAccount(a.id, { inRecovery: !a.inRecovery }) }

  const accountTrades = trades.filter(t => t.accountId === a.id)
  const totalDollar = sumTradeDollars(accountTrades, a.riskPerTrade)

  const accountMetrics = computeAccountMetrics(accountTrades, a)

  // Todas las cards de una fila del grid quedan a la misma altura
  // visual (el grid ya las estira, esto hace que la card VISIBLE
  // también llene esa altura).
  return (
    <div style={{ height: '100%' }}>
      <div style={{
        background: 'var(--bg2)',
        border: `1px solid ${isEditing ? 'var(--brand)' : tc.border}`,
        borderRadius: 'var(--r)',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        height: '100%', display: 'flex', flexDirection: 'column',
      }}>

        {/* ── CARD HEADER (siempre visible) ── */}
        <div style={{ padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 18, fontWeight: 900, color: 'var(--text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {a.firm}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                {accountTrades.length} trades registrados · desde {a.startDate}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                onClick={toggleFavorite}
                title={a.isFavorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  display: 'flex', alignItems: 'center', lineHeight: 0,
                }}
              >
                <Star size={16} style={{ color: a.isFavorite ? 'var(--amber)' : 'var(--text3)' }} fill={a.isFavorite ? 'var(--amber)' : 'none'} />
              </button>
              <button
                onClick={toggleRecovery}
                title={a.inRecovery ? 'Quitar de en recuperación' : 'Marcar como en recuperación'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  display: 'flex', alignItems: 'center', lineHeight: 0,
                }}
              >
                <LifeBuoy size={16} style={{ color: a.inRecovery ? 'var(--neg)' : 'var(--text3)' }} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Tag variant="ghost">{a.type}</Tag>
            <Tag variant="ghost">{STATUS_OPTIONS.find(s => s.value === a.status)?.label ?? a.status}</Tag>
            {DRAWDOWN_TYPE_LABEL[a.drawdownType] && <Tag variant="ghost">{DRAWDOWN_TYPE_LABEL[a.drawdownType]}</Tag>}
          </div>

          {/* ── Balance, corredor MLL↔TARGET, EOT y Mapa asignado —
              siempre visibles. Antes se ocultaban cuando la tarjeta
              estaba expandida (ya que la vista embebida los duplicaba);
              ahora "Ver dashboard" navega a Metrix Básico en vez de
              expandir aquí, así que ya no hay nada que duplicar. */}
          {cardStyle === 'simple'
            ? <AccountCardStatsSimple a={a} totalDollar={totalDollar} />
            : <AccountCardStatsDetailed a={a} accountMetrics={accountMetrics} totalDollar={totalDollar} />
          }

          <AccountWinAverages accountTrades={accountTrades} riskPerTrade={a.riskPerTrade} />

          {<AccountRangeGaugeSimple account={a} totalDollar={totalDollar} cardStyle={cardStyle} />
          }

          {/* ── EOT: ¿CUÁNTO PUEDO ARRIESGAR HOY? (config/eotEngine.js) ──
              Nuevo, independiente del corredor de arriba y del panel de
              Consistency Control de más abajo. Mismo sitio en ambos
              diseños de tarjeta. */}
          <EotPanel account={a} accountTrades={accountTrades} />

          <BlueprintAssignmentBlock account={a} accountTrades={accountTrades} flat={cardStyle === 'simple'} />

          {/* ── BOTONES ──
              marginTop: 'auto' — ancla este bloque al fondo de la card
              (ver flexDirection:'column' del contenedor arriba), así
              todas las cards de la fila terminan con los botones a la
              misma altura sin importar cuánto contenido tengan encima. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>

            {cardStyle === 'simple' && <div style={{ height: 1, background: 'var(--border)', marginBottom: 6 }} />}

            <button
              className="btn btn-primary btn-sm" onClick={() => navigate('/metricas-basico', { state: { accountId: a.id } })}
              style={{ width: '100%', padding: '8px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              Ver Métricas →
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost btn-sm" onClick={() => onEditStart(a)} data-account-panel-keep
                style={{ flex: 1, padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                <Pencil size={12} /> Editar
              </button>
              <button
                className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}
                style={{ flex: 1, padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                <Upload size={12} /> Importar
              </button>
              <button
                className="btn btn-ghost btn-sm" onClick={() => setShowDeleteConfirm(true)}
                style={{ flex: 1, padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                <Trash2 size={12} /> Eliminar
              </button>
            </div>
          </div>
        </div>

        {showImport && (
          <AccountImportCsvModal account={a} onClose={() => setShowImport(false)} />
        )}

        {showDeleteConfirm && (
          <DeleteAccountConfirm
            account={a}
            tradeCount={accountTrades.length}
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={() => { setShowDeleteConfirm(false); onDelete(a.id) }}
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  VISTA TABLA — tercera opción del switch Simple / Detallado / Tabla.
//  Una fila por cuenta, mismas columnas que la card Simple. Los datos
//  de cada fila se calculan una sola vez en computeAccountRow, así el
//  ordenamiento usa exactamente los mismos números que se muestran.
//  Las cards (AccountCard) no se tocan.
// ─────────────────────────────────────────────
const EOT_SEVERITY = { NEUTRAL: 0, CONSERVADOR: 1, DEFENSIVO: 2, BLOQUEADO: 3 }

// "Ver comparación" en la Tabla abre una fila expandible debajo de la
// cuenta (una sola abierta a la vez) en vez del modal. Solo aplica a la
// Tabla: las tarjetas siguen con el modal. false → la Tabla vuelve a usar
// el modal (BlueprintMatchPanel), que queda intacto.
const COMPARE_INLINE = true

function computeAccountRow(a, trades, blueprints, assignments) {
  const accountTrades = trades.filter(t => t.accountId === a.id)
  const totalDollar   = sumTradeDollars(accountTrades, a.riskPerTrade)
  const balance       = a.size + totalDollar - totalWithdrawn(a)

  // Profit — calculado desde los trades (P&L acumulado), igual que el
  // balance. No usa a.currentProfit: ese campo se carga a mano en el
  // formulario y nunca se actualiza, por eso quedaba siempre en $0.
  const profitTarget  = a.profitTarget ? parseFloat(a.profitTarget) : null
  // Descuenta los retiros (= balance − tamaño), igual que la barra
  // const profitDone$   = totalDollar
  const profitDone$   = balance - a.size
  const profitTarget$ = profitTarget !== null ? (profitTarget / 100) * a.size : null
  const profitPct     = profitTarget$ ? (profitDone$ / profitTarget$) * 100 : null

  // Corredor MLL ↔ TARGET — mismo criterio que AccountRangeGaugeSimple
  let range = null
  if (a.profitTarget && a.maxDrawdown) {
    const floorUSD  = a.size * (1 - parseFloat(a.maxDrawdown) / 100)
    const targetUSD = a.size * (1 + parseFloat(a.profitTarget) / 100)
    const span      = targetUSD - floorUSD
    const posPct    = span > 0 ? Math.min(100, Math.max(0, ((balance - floorUSD) / span) * 100)) : 50
    const zeroPct   = span > 0 ? Math.min(100, Math.max(0, ((a.size - floorUSD) / span) * 100)) : 50
    range = { floorUSD, targetUSD, posPct, zeroPct }
  }

  const eot = computeEOT(a, accountTrades)

  // Mapa asignado + compatibilidad — mismo criterio que BlueprintAssignmentBlock
  const blueprint      = blueprints.find(b => b.id === assignments[a.id]) || null
  const accountMetrics = computeAccountMetrics(accountTrades, a)
  let match = null
  if (blueprint && accountMetrics) {
    match = blueprint.templateType === 'hibrido-expansion'
      ? matchHibridoExpansionToAccount(blueprint, a, accountTrades)
      : matchBlueprintToAccount(blueprint, accountMetrics)
  }
  const compatibility = match?.compatibility ?? null

  return {
    a, accountTrades, totalDollar, balance,
    profitDone$, profitTarget$, profitPct, completed: profitTarget$ !== null && profitDone$ >= profitTarget$,
    range, eot, blueprint, match, compatibility,
  }
}

const TABLE_COLUMNS = [
  { key: 'name',     label: 'Cuenta',          sort: r => r.a.firm?.toLowerCase() ?? '' },
  { key: 'balance',  label: 'Balance',         sort: r => r.balance },
  { key: 'profit',   label: 'Profit Target',   sort: r => r.profitPct },
  { key: 'position', label: 'Posición actual', sort: r => r.range?.posPct ?? null },
  // Riesgo hoy: oculta en la tabla (01/11/2026), queda solo en la vista Tarjeta.
  // Para volver a mostrarla, sacar "hidden: true".
  { key: 'eot',      label: 'Riesgo hoy',      sort: r => r.eot ? EOT_SEVERITY[r.eot.estado] ?? 0 : null, hidden: true },
  { key: 'map',      label: 'Mapa',            sort: r => r.compatibility },
  { key: 'actions',  label: '' },
]

const EOT_COLUMN_HIDDEN = TABLE_COLUMNS.find(c => c.key === 'eot')?.hidden

const fmtUSD = (n) => `$${Math.round(n).toLocaleString()}`

const cellLabel = { fontSize: 10, color: 'var(--text3)', letterSpacing: '0.4px' }
const iconBtn = {
  background: 'none', border: '1px solid var(--border2)', borderRadius: 6, cursor: 'pointer',
  padding: 6, display: 'inline-flex', alignItems: 'center', lineHeight: 0, color: 'var(--text2)',
}

/** Corredor MLL ↔ Inicio ↔ Target en versión fila — misma lógica de
 *  relleno que AccountRangeGaugeSimple, sin etiquetas flotantes. */
function MiniRangeGauge({ account, balance, range }) {
  if (!range) return <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
  const { floorUSD, targetUSD, posPct, zeroPct } = range
  const isPositive = posPct >= zeroPct
  return (
    <div style={{ minWidth: 150 }}>
      <div style={{ position: 'relative', height: 8, margin: '4px 0 6px' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 4, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--border3)', filter: 'brightness(1.25)' }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: `${Math.min(zeroPct, posPct)}%`, width: `${Math.abs(posPct - zeroPct)}%`,
            background: isPositive ? 'linear-gradient(90deg, #1E40AF, #3B82F6)' : 'linear-gradient(90deg, #c94a4a, #ed553b)',
          }} />
        </div>
        <div title={`Capital inicial: ${fmtUSD(account.size)}`} style={{
          position: 'absolute', top: '50%', left: `${zeroPct}%`, transform: 'translate(-50%, -50%)',
          width: 2, height: 12, borderRadius: 1, background: 'var(--text2)',
        }} />
        <div title={`Balance actual: ${fmtUSD(balance)}`} style={{
          position: 'absolute', top: '50%', left: `${posPct}%`, transform: 'translate(-50%, -50%)',
          width: 3, height: 14, borderRadius: 2, background: '#fff',
          border: '1px solid var(--bg2)', boxShadow: '0 0 0 1px var(--border2)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700 }}>
        <span style={{ color: 'var(--neg)' }} title="MLL">{fmtUSD(floorUSD)}</span>
        <span style={{ color: 'var(--pos)' }} title="Target">{fmtUSD(targetUSD)}</span>
      </div>
    </div>
  )
}

// icon + subtitle (opcionales): encabezado con ícono y la cuenta en una
// franja aparte, igual que "Importar CSV" y "Cargá tu cuenta". Sin icon
// queda el encabezado de siempre.
function ModalShell({ title, onClose, children, icon: Icon, subtitle }) {
  return (
    <div
      style={{
        position: 'fixed', whiteSpace: 'normal', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 999, padding: 20, overflowY: 'auto',
      }}
      onClick={onClose}
    >
      {/* whiteSpace normal: el modal vive dentro de una celda de la tabla (nowrap) */}
      <div className="card" style={{ width: '100%', maxWidth: 440, whiteSpace: 'normal' }} onClick={e => e.stopPropagation()}>
        {Icon ? (<>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: subtitle ? 18 : 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <span aria-hidden="true" style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--brand2)', color: 'var(--brand)',
              }}><Icon size={18} /></span>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{title}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={onClose}>Cerrar</button>
          </div>
          {subtitle && (
            <div style={{
              margin: '0 -26px 18px', padding: '11px 26px',
              background: 'var(--bg-panel2, var(--bg3))',
              borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
              fontSize: 14, fontWeight: 500, color: 'var(--text)',
            }}>{subtitle}</div>
          )}
        </>) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
            <button className="btn btn-outline btn-sm" onClick={onClose}>Cerrar</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

function AccountRow({ row, onEditStart, onDelete, isComparing, onToggleCompare, isEditing = false, colCount = TABLE_COLUMNS.length }) {
  const navigate = useNavigate()
  const updateAccount = useStore(s => s.updateAccount)
  const { a, accountTrades, balance, profitDone$, profitTarget$, completed, range, eot, blueprint, match, compatibility } = row
  const [showImport, setShowImport] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMap, setShowMap] = useState(false)          // asignar / cambiar mapa
  const [showCompare, setShowCompare] = useState(false)  // comparación con el mapa
  const [showEot, setShowEot] = useState(false)          // detalle de Riesgo hoy

  const eotStyle = eot ? (EOT_STYLE[eot.estado] || EOT_STYLE.NEUTRAL) : null
  const EotIcon  = eotStyle?.icon

  const td = { padding: '12px 12px', borderBottom: '1px solid var(--border3)', verticalAlign: 'middle' }

  return (<>
    {/* Fila marcada mientras se edita en el panel lateral (ACCOUNT_FORM_V2) */}
    <tr style={isEditing ? { background: 'var(--brand2)', boxShadow: 'inset 3px 0 0 var(--brand)' } : undefined}>
      {/* width% + maxWidth:0 → la celda cede ancho y el nombre se corta con
          "…" en vez de empujar la tabla a scroll horizontal. */}
      <td style={{ ...td, width: '27%', maxWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => updateAccount(a.id, { isFavorite: !a.isFavorite })}
            title={a.isFavorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}
          >
            <Star size={14} style={{ color: a.isFavorite ? 'var(--amber)' : 'var(--text3)' }} fill={a.isFavorite ? 'var(--amber)' : 'none'} />
          </button>
          <button
            onClick={() => updateAccount(a.id, { inRecovery: !a.inRecovery })}
            title={a.inRecovery ? 'Quitar de en recuperación' : 'Marcar como en recuperación'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}
          >
            <LifeBuoy size={14} style={{ color: a.inRecovery ? 'var(--neg)' : 'var(--text3)' }} />
          </button>
          <div style={{ minWidth: 0, flex: 1, marginLeft: 2 }}>
            <div title={a.firm} style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {a.firm}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[a.type, STATUS_OPTIONS.find(s => s.value === a.status)?.label ?? a.status, DRAWDOWN_TYPE_LABEL[a.drawdownType]].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      </td>

      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        {/* Actual grande arriba, referencia chica abajo — en 2 líneas para
            ganar ancho en la tabla. */}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: row.totalDollar >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
          {fmtUSD(balance)}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginTop: 1 }}>/ {fmtUSD(a.size)}</div>
      </td>

      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        {profitTarget$ !== null ? (
          <>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: completed ? 'var(--pos)' : profitDone$ < 0 ? 'var(--neg)' : 'var(--text)' }}>
              {profitDone$ < 0 ? '-' : ''}{fmtUSD(Math.abs(profitDone$))}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginTop: 1 }}>/ {fmtUSD(profitTarget$)}</div>
          </>
        ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
      </td>

      <td style={{ ...td, width: '20%' }}>
        <MiniRangeGauge account={a} balance={balance} range={range} />
      </td>

      {!EOT_COLUMN_HIDDEN && <td style={{ ...td, whiteSpace: 'nowrap' }}>
        {eot ? (
          <button
            onClick={() => setShowEot(true)}
            title="Ver detalle"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6,
              background: eotStyle.bg, border: `1px solid ${eotStyle.border}`,
              fontSize: 11, fontWeight: 700, color: eotStyle.color, cursor: 'pointer',
            }}
          >
            <EotIcon size={12} /> {eot.estado} · ${eot.maxRisk.toLocaleString()}
          </button>
        ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
      </td>}

      <td style={{ ...td, width: '20%', maxWidth: 0 }}>
        {blueprint ? (<>
          <div title={blueprint.name} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {blueprint.name}
          </div>
          {/* alignItems stretch: el badge del % toma la misma altura que el botón */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: '4px 8px', marginTop: 4 }}>
            {compatibility !== null && (
              <Badge variant={compatibility >= 70 ? 'pos' : compatibility >= 40 ? 'amber' : 'red'}>{compatibility}%</Badge>
            )}
            {/* Comparación a un clic (antes: modal → "Ver comparación") */}
            {match && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => COMPARE_INLINE ? onToggleCompare() : setShowCompare(true)}
                style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6, whiteSpace: 'nowrap' }}
              >
                {/* Texto corto: entra al lado del % en laptops chicas */}
                {COMPARE_INLINE && isComparing ? 'Ocultar' : 'Comparar'}
              </button>
            )}
            {/* "Cambiar mapa" vive dentro del panel de comparación. Solo si no
                hay comparación posible (cuenta sin métricas) queda acá. */}
            {!match && (
              <button
                onClick={() => setShowMap(true)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, color: 'var(--text3)', textDecoration: 'underline', whiteSpace: 'nowrap' }}
              >
                Cambiar
              </button>
            )}
          </div>
        </>) : (
          // Ghost (borde gris): menos peso que "Ver comparación" (outline)
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowMap(true)}
            style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6, whiteSpace: 'nowrap' }}
          >
            + Asignar mapa
          </button>
        )}
      </td>

      <td style={{ ...td, whiteSpace: 'nowrap', width: '1%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          <button
            className="btn btn-primary btn-sm" onClick={() => navigate('/metricas-basico', { state: { accountId: a.id } })}
            style={{ padding: '6px 10px', fontSize: 12 }}
          >
            Ver Métricas →
          </button>
          <button style={iconBtn} title="Editar" onClick={() => onEditStart(a)} data-account-panel-keep><Pencil size={13} /></button>
          <button style={iconBtn} title="Importar" onClick={() => setShowImport(true)}><Upload size={13} /></button>
          <button style={iconBtn} title="Eliminar" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={13} /></button>
        </div>

        {showImport && <AccountImportCsvModal account={a} onClose={() => setShowImport(false)} />}
        {showDeleteConfirm && (
          <DeleteAccountConfirm
            account={a}
            tradeCount={accountTrades.length}
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={() => { setShowDeleteConfirm(false); onDelete(a.id) }}
          />
        )}
        {showMap && (
          <ModalShell icon={MapIcon} title={blueprint ? 'Cambiar mapa' : 'Asignar mapa'} subtitle={accountLabelInline(a)} onClose={() => setShowMap(false)}>
            <BlueprintAssignmentBlock
              account={a} accountTrades={accountTrades} flat
              startInPicker={!!blueprint}
              onDone={() => setShowMap(false)}
            />
          </ModalShell>
        )}
        {showCompare && blueprint && match && (
          <BlueprintMatchPanel
            account={a} blueprint={blueprint} match={match}
            onClose={() => setShowCompare(false)}
            onChangeMap={() => { setShowCompare(false); setShowMap(true) }}
          />
        )}
        {showEot && eot && (
          <ModalShell icon={ShieldAlert} title="Riesgo hoy" subtitle={accountLabelInline(a)} onClose={() => setShowEot(false)}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8,
              background: eotStyle.bg, border: `1px solid ${eotStyle.border}`, marginBottom: 14,
            }}>
              <EotIcon size={20} style={{ color: eotStyle.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: eotStyle.color, letterSpacing: '0.3px' }}>{eot.estado}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                  ${eot.maxRisk.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>({eot.pctRisk}% de la cuenta)</span>
                </div>
              </div>
            </div>
            {eot.reasons?.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Por qué
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {eot.reasons.map((r, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{r}</li>
                ))}
              </ul>
            </>)}
          </ModalShell>
        )}
      </td>
    </tr>

    {COMPARE_INLINE && isComparing && blueprint && match && (
      <tr>
        <td colSpan={colCount} style={{ padding: '18px 20px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border3)' }}>
          {/* Sin encabezado propio: "Ocultar" (en la fila) cierra; la
              compatibilidad reemplaza el título de la tabla de métricas y
              "Cambiar mapa" va al pie de la columna izquierda. */}
          <BlueprintMatchResults
            {...match}
            layout="wide"
            metricsTitle={<>
              Comparación con el Mapa
              <span style={{ color: 'var(--text3)', fontWeight: 400 }}> · </span>
              <span style={{ color: compatibility >= 70 ? 'var(--pos)' : compatibility >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                {compatibility}% compatibilidad
              </span>
              <span title="Solo indica cercanía con este Mapa, no el nivel del trader" style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6, color: 'var(--text3)', cursor: 'help' }}>
                <Info size={13} />
              </span>
            </>}
            metricsAction={
              <button
                className="btn btn-ghost btn-sm" title="Cerrar" onClick={onToggleCompare}
                style={{ padding: 4, borderRadius: 6, lineHeight: 0 }}
              >
                <X size={13} />
              </button>
            }
            leftFooter={
              <button className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6 }} onClick={() => setShowMap(true)}>
                Cambiar mapa
              </button>
            }
          />
          {blueprint.templateType === 'hibrido-expansion' && match.rrDistribution && (
            <RRDistributionPanel distribution={match.rrDistribution} speed={match.speedToTarget} />
          )}
        </td>
      </tr>
    )}
  </>)
}

function AccountTable({ accounts, trades, onEditStart, onDelete, editingId = null }) {
  const columns = TABLE_COLUMNS.filter(c => !c.hidden)
  const blueprints  = useBlueprintsList()
  const assignments = useAccountBlueprintAssignments()
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [compareId, setCompareId] = useState(null) // fila con la comparación abierta (una sola)

  const rows = useMemo(
    () => accounts.map(a => computeAccountRow(a, trades, blueprints, assignments)),
    [accounts, trades, blueprints, assignments]
  )

  // Favoritas siempre arriba; dentro de cada grupo, el orden elegido.
  // Valores vacíos (sin target, sin mapa…) siempre al final.
  const sortedRows = useMemo(() => {
    const col = columns.find(c => c.key === sort.key)
    if (!col?.sort) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((x, y) => {
      const fav = (y.a.isFavorite ? 1 : 0) - (x.a.isFavorite ? 1 : 0)
      if (fav) return fav
      const vx = col.sort(x), vy = col.sort(y)
      if (vx === null || vx === undefined) return (vy === null || vy === undefined) ? 0 : 1
      if (vy === null || vy === undefined) return -1
      return (vx < vy ? -1 : vx > vy ? 1 : 0) * dir
    })
  }, [rows, sort, columns])

  const toggleSort = (key) => setSort(s => s.key === key
    ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: key === 'name' ? 'asc' : 'desc' })

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--bg2)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            {columns.map(c => {
              const active = sort.key === c.key
              const Arrow = sort.dir === 'asc' ? ChevronUp : ChevronDown
              return (
                <th
                  key={c.key}
                  onClick={c.sort ? () => toggleSort(c.key) : undefined}
                  style={{
                    padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap',
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                    color: active ? 'var(--text)' : 'var(--text3)',
                    borderBottom: '1px solid var(--border2)', background: 'var(--bg3)',
                    cursor: c.sort ? 'pointer' : 'default', userSelect: 'none',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {c.label}
                    {active && <Arrow size={12} />}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(row => (
            <AccountRow
              key={row.a.id} row={row} onEditStart={onEditStart} onDelete={onDelete}
              isComparing={compareId === row.a.id}
              isEditing={editingId === row.a.id}
              onToggleCompare={() => setCompareId(id => id === row.a.id ? null : row.a.id)}
              colCount={columns.length}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Portfolio() {
  const accounts      = useAccounts()
  const trades        = useStore(s => s.trades)
  const addAccount    = useStore(s => s.addAccount)
  const updateAccount = useStore(s => s.updateAccount)
  const deleteAccount = useStore(s => s.deleteAccount)
  const deleteTradesByAccount = useStore(s => s.deleteTradesByAccount)
  const tier          = useTier()
  const cardStyle     = usePortfolioCardStyle()
  const setCardStyle  = useSetPortfolioCardStyle()
  const accountLimit  = accountLimitFor(tier)
  const atAccountLimit = accounts.length >= accountLimit
  const [showPricing, setShowPricing] = useState(false)
  const baseTier = tier.startsWith('tester-') ? tier.replace('tester-', '') : tier
  const nextTier = baseTier === TIERS.FREE ? TIERS.INTERMEDIO : TIERS.PRO

  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [recoveryOnly,  setRecoveryOnly]  = useState(false)
  const [cycleFilter,    setCycleFilter]    = useState('all')
  const [mapFilter,      setMapFilter]      = useState('all')
  // Ciclo y Mapa van plegados bajo "Avanzado" (menos ruido en la barra)
  const [showAdvanced,   setShowAdvanced]   = useState(false)
  const [showCycles,     setShowCycles]     = useState(false)
  // Ciclos v2: Intermedio+ (features.js → cycles)
  const cyclesEnabled = useHasFeature('cycles')
  const cycleNamesAll = useAllCycleNames()
  const [cycleDialog,   setCycleDialog]   = useState(null) // null | { cycle } (null = nuevo)
  const [showManage,    setShowManage]    = useState(false)
  const [toast,         setToast]         = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  const assignments = useAccountBlueprintAssignments()
  const blueprintList = useBlueprintsList()

  const [showAdd,    setShowAdd]    = useState(false)
  const [addForm,    setAddForm]    = useState(EMPTY_FORM)
  const [addError,   setAddError]   = useState('')
  const [editId,     setEditId]     = useState(null)

  // Abre el formulario de alta cuando se llega desde el acceso rápido
  // "Nueva cuenta" del Dashboard — mismo patrón que openForm en
  // Historial.jsx, solo activa el mismo estado que el botón real.
  const location = useLocation()
  useEffect(() => {
    if (location.state?.openAddForm) setShowAdd(true)
  }, [location.state])
  const [editForm,   setEditForm]   = useState(EMPTY_FORM)
  const [editError,  setEditError]  = useState('')

  const handleAdd = () => {
    if (!addForm.firm.trim()) { setAddError('El nombre de la firma es obligatorio'); return }
    if (!addForm.size || parseFloat(addForm.size) <= 0) { setAddError('Introduce un capital válido'); return }
    setAddError('')
    addAccount({
      ...addForm,
      size:         parseFloat(addForm.size),
      profitTarget:  addForm.profitTarget ? parseFloat(addForm.profitTarget) : null,
      maxDrawdown:   parseFloat(addForm.maxDrawdown),
      maxDailyDD:    parseFloat(addForm.maxDailyDD),
      riskPerTrade:  parseFloat(addForm.riskPerTrade) || 550,
      commissionPerContract: parseFloat(addForm.commissionPerContract) || 0,
      accountCost:    parseFloat(addForm.accountCost)    || 0,
      activationCost: parseFloat(addForm.activationCost) || 0,
      purchaseDate:   addForm.purchaseDate || '',
      activationDate: addForm.activationDate || '',
      withdrawals:    addForm.withdrawals || [],
    })
    setAddForm(EMPTY_FORM); setShowAdd(false)
  }

  const handleEditStart = (account) => {
    setEditId(account.id)
    setEditForm({
      ...account,
      size:         String(account.size),
      profitTarget: account.profitTarget  ?? '',
      maxDrawdown:  account.maxDrawdown   ?? 10,
      maxDailyDD:   account.maxDailyDD    ?? 5,
      riskPerTrade: account.riskPerTrade  ?? 550,
      commissionPerContract: account.commissionPerContract || '',
      consistencyRules: account.consistencyRules ?? {
        enabled: false, maxDailyPercent: 40, maxTradePercent: 20,
        maxDailyProfit: '', maxProfitPerTrade: '',
      },
      accountCost:    account.accountCost    ?? '',
      activationCost: account.activationCost ?? '',
      purchaseDate:   account.purchaseDate   ?? '',
      activationDate: account.activationDate ?? '',
      withdrawals:    account.withdrawals    ?? [],
    })
    setEditError(''); setShowAdd(false)
  }
  // Panel lateral (ACCOUNT_FORM_V2): si hay cambios sin guardar y se
  // elige otra cuenta, pregunta antes de cambiar.
  const panelDirty = useRef(false)
  const [panelAnimate, setPanelAnimate] = useState(true)
  const setPanelDirty = useCallback((v) => { panelDirty.current = v }, [])
  const handleEditStartV2 = (account) => {
    if (account.id === editId) return
    if (editId && panelDirty.current && !window.confirm('Tenés cambios sin guardar en la cuenta abierta. ¿Descartarlos?')) return
    // Al pasar de una cuenta a otra con el panel abierto no se repite la entrada
    setPanelAnimate(!editId)
    setEditId(account.id); setShowAdd(false)
  }
  const handlePanelSave = (id, patch) => {
    updateAccount(id, patch)
    setEditId(null)
  }
  const editAccount = ACCOUNT_FORM_V2 && editId ? accounts.find(a => a.id === editId) : null

  const handleEditSave = () => {
    if (!editForm.firm.trim()) { setEditError('El nombre de la firma es obligatorio'); return }
    if (!editForm.size || parseFloat(editForm.size) <= 0) { setEditError('Introduce un capital válido'); return }
    setEditError('')
    updateAccount(editId, {
      ...editForm,
      size:          parseFloat(editForm.size),
      profitTarget:  editForm.profitTarget ? parseFloat(editForm.profitTarget) : null,
      maxDrawdown:   parseFloat(editForm.maxDrawdown),
      maxDailyDD:    parseFloat(editForm.maxDailyDD),
      currentProfit: parseFloat(editForm.currentProfit) || 0,
      currentDD:     parseFloat(editForm.currentDD)     || 0,
      riskPerTrade:  parseFloat(editForm.riskPerTrade)  || 550,
      commissionPerContract: parseFloat(editForm.commissionPerContract) || 0,
      accountCost:    parseFloat(editForm.accountCost)    || 0,
      activationCost: parseFloat(editForm.activationCost) || 0,
      purchaseDate:   editForm.purchaseDate || '',
      activationDate: editForm.activationDate || '',
      withdrawals:    editForm.withdrawals || [],
    })
    setEditId(null)
  }

  const handleDeleteAccount = (id) => {
    deleteTradesByAccount(id)
    deleteAccount(id)
    if (editId === id) setEditId(null)
  }

  const filteredAccounts = useMemo(() => accounts.filter(a => {
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter
    const matchesType = typeFilter === 'all'
      ? true
      : typeFilter === 'other'
        ? !TYPE_GROUPS.includes(a.type)
        : a.type === typeFilter
    const matchesFavorite = !favoritesOnly || a.isFavorite
    const matchesRecovery = !recoveryOnly || a.inRecovery
    const matchesGroup = accountInGroup(a, { cycle: cycleFilter, map: mapFilter, assignments, blueprints: blueprintList })
    return matchesStatus && matchesType && matchesFavorite && matchesRecovery && matchesGroup
  }).sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)), [accounts, statusFilter, typeFilter, favoritesOnly, recoveryOnly, cycleFilter, mapFilter, assignments, blueprintList])

  const cycles = useMemo(() => cycleOptions(accounts), [accounts])
  const maps = useMemo(() => mapOptions(accounts, assignments, blueprintList), [accounts, assignments, blueprintList])
  const advancedCount = (cycleFilter !== 'all' ? 1 : 0) + (mapFilter !== 'all' ? 1 : 0)

  // Si el ciclo filtrado se borró o renombró, vuelve a "Todos los ciclos"
  useEffect(() => {
    if (cycleFilter === 'all' || cycleFilter === NO_CYCLE) return
    if (!cycleNamesAll.some(n => n.toLowerCase() === cycleFilter.toLowerCase())) setCycleFilter('all')
  }, [cycleFilter, cycleNamesAll])


  return (
    <div className="page-inner">
      <PageHeader title="Portafolio de Cuentas" subtitle="Gestión de tus cuentas de fondeo y personales">
        <div style={{
          display: 'inline-flex', borderRadius: 8, padding: 2,
          background: 'var(--bg3)', border: '1px solid var(--border2)',
        }}>
          {[{ key: 'simple', label: 'Tarjeta' }, { key: 'table', label: 'Tabla' }].map(opt => {
            const active = cardStyle === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => setCardStyle(opt.key)}
                title={`Vista ${opt.label.toLowerCase()}`}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                  background: active ? 'var(--bg)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text3)',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  transition: 'background 120ms, color 120ms',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        {accountLimit !== Infinity && (
          <span style={{
            fontSize: 12, fontFamily: 'var(--mono)', alignSelf: 'center',
            color: 'var(--text3)',
          }}>
            {accounts.length}/{accountLimit} cuentas usadas
          </span>
        )}
        <button className="btn btn-primary btn-sm"
          style={{
            fontWeight: 700,
            ...(!showAdd && atAccountLimit ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
          }}
          disabled={!showAdd && atAccountLimit}
          data-account-panel-keep  // su onClick ya pregunta si hay cambios sin guardar
          title={!showAdd && atAccountLimit ? `Límite de ${accountLimit} cuenta${accountLimit === 1 ? '' : 's'} en plan ${TIER_LABELS[tier]}` : undefined}
          onClick={() => {
            if (!showAdd && atAccountLimit) return
            // Panel de edición abierto con cambios: preguntar antes de cerrarlo
            if (ACCOUNT_FORM_V2 && editId && panelDirty.current && !window.confirm('Tenés cambios sin guardar en la cuenta abierta. ¿Descartarlos?')) return
            setShowAdd(s => !s); setAddError(''); setEditId(null)
          }}>
          {showAdd ? <><X size={13} /> Cancelar</> : '+ Nueva cuenta'}
        </button>
        {!showAdd && atAccountLimit && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPricing(true)}>
            Actualizar a {TIER_LABELS[nextTier]}
          </button>
        )}
        {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
      </PageHeader>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24, alignItems: 'flex-end' }}>
        {/* Estado y Tipo como selectores segmentados (a la vista, un clic),
            mismo estilo que el alta de cuentas. Los select de antes quedan
            comentados debajo. */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Estado</label>
          <Chips size="sm" label="Filtrar por estado" value={statusFilter} onChange={setStatusFilter}
            options={STATUS_FILTERS.map(f => ({
              value: f.value,
              label: <>{f.label} <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                {f.value === 'all' ? accounts.length : accounts.filter(a => a.status === f.value).length}
              </span></>,
            }))} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Tipo de cuenta</label>
          <Chips size="sm" label="Filtrar por tipo de cuenta" value={typeFilter} onChange={setTypeFilter}
            options={TYPE_FILTERS
              // "Otros" solo si hay alguna cuenta de otro tipo (o ya está elegido)
              .filter(f => f.value !== 'other' || typeFilter === 'other' || accounts.some(a => !TYPE_GROUPS.includes(a.type)))
              .map(f => ({ value: f.value, label: f.value === 'Challenge' ? 'Challenge / Eval' : f.value === 'Funded' ? 'Fondeada' : f.label }))} />
        </div>
        {/*
        <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>Estado</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>Tipo de cuenta</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            {TYPE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        */}
        <button
          onClick={() => setFavoritesOnly(v => !v)}
          className={`btn btn-sm ${favoritesOnly ? '' : 'btn-ghost'}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            ...(favoritesOnly && {
              background: 'var(--amber2)', border: '1px solid var(--amber)', color: 'var(--amber)',
            }),
          }}
        >
          <Star size={13} fill={favoritesOnly ? 'var(--amber)' : 'none'} /> Favoritas
        </button>
        <button
          onClick={() => setRecoveryOnly(v => !v)}
          className={`btn btn-sm ${recoveryOnly ? '' : 'btn-ghost'}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            ...(recoveryOnly && {
              background: 'var(--neg2)', border: '1px solid var(--neg)', color: 'var(--neg)',
            }),
          }}
        >
          <LifeBuoy size={13} /> En recuperación
        </button>
        {cyclesEnabled && !PORTFOLIO_ADVANCED_V1 && (
          <CycleFilterButton
            value={cycleFilter}
            onChange={setCycleFilter}
            onNew={() => setCycleDialog({ cycle: null })}
            onManage={() => setShowManage(true)}
          />
        )}
        {PORTFOLIO_ADVANCED_V1 && (<>
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className={`btn btn-sm ${advancedCount ? '' : 'btn-ghost'}`}
          aria-expanded={showAdvanced}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            ...(advancedCount && { background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }),
          }}
        >
          <SlidersHorizontal size={13} /> Avanzado{advancedCount ? ` · ${advancedCount}` : ''}
          <ChevronDown size={13} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} />
        </button>
        {showAdvanced && (<>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 190 }}>
            <label>Ciclo</label>
            <select value={cycleFilter} onChange={e => setCycleFilter(e.target.value)}>
              <option value="all">Todos los ciclos</option>
              {cycles.map(c => <option key={c.label} value={c.label}>{c.label} ({c.count})</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 190 }}>
            <label>Mapa</label>
            <select value={mapFilter} onChange={e => setMapFilter(e.target.value)}>
              <option value="all">Todos los mapas</option>
              {maps.map(m => <option key={m.value} value={m.value}>{m.label} ({m.count})</option>)}
            </select>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowCycles(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
            <Pencil size={13} /> Gestionar ciclos
          </button>
        </>)}
        </>)}
      </div>
      {showCycles && <CyclesManager onClose={() => setShowCycles(false)} />}

      {cycleDialog && (
        <CycleDialog
          key={cycleDialog.cycle ?? 'new'}
          cycle={cycleDialog.cycle}
          onClose={() => setCycleDialog(null)}
          onSaved={setToast}
        />
      )}
      {showManage && !cycleDialog && (
        <CyclesManageDialog
          onClose={() => setShowManage(false)}
          onEdit={(name) => setCycleDialog({ cycle: name })}
          onNew={() => setCycleDialog({ cycle: null })}
          onToast={setToast}
        />
      )}
      <Toast message={toast} onDone={clearToast} />


      {ACCOUNT_FORM_V2 && showAdd && (
        <AccountWizard onClose={() => setShowAdd(false)} />
      )}
      {!ACCOUNT_FORM_V2 && showAdd && (
        <AccountForm title="Nueva cuenta" form={addForm} setForm={setAddForm}
          onSave={handleAdd} onCancel={() => setShowAdd(false)} error={addError} />
      )}
      {editAccount && (
        <AccountEditPanel
          key={editAccount.id}
          account={editAccount}
          tradeCount={trades.filter(t => t.accountId === editAccount.id).length}
          onSave={handlePanelSave}
          onDelete={handleDeleteAccount}
          onClose={() => setEditId(null)}
          onDirtyChange={setPanelDirty}
          animateIn={panelAnimate}
        />
      )}
      {!ACCOUNT_FORM_V2 && editId && (
        <AccountForm title={`Editando: ${editForm.firm}`} form={editForm} setForm={setEditForm}
          onSave={handleEditSave} onCancel={() => setEditId(null)} error={editError} />
      )}

      {cardStyle === 'table' ? (
        filteredAccounts.length > 0 && (
          <AccountTable
            accounts={filteredAccounts}
            trades={trades}
            onEditStart={ACCOUNT_FORM_V2 ? handleEditStartV2 : handleEditStart}
            onDelete={handleDeleteAccount}
            editingId={ACCOUNT_FORM_V2 ? editId : null}
          />
        )
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 16,
        }}>
          {filteredAccounts.map(a => (
            <AccountCard
              key={a.id}
              a={a}
              trades={trades}
              onEditStart={ACCOUNT_FORM_V2 ? handleEditStartV2 : handleEditStart}
              onDelete={handleDeleteAccount}
              isEditing={ACCOUNT_FORM_V2 && editId === a.id}
            />
          ))}
        </div>
      )}

      {accounts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 12 }}>
          No hay cuentas. Pulsa "+ Nueva cuenta" para empezar.
        </div>
      )}
      {accounts.length > 0 && filteredAccounts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 12 }}>
          No hay cuentas que coincidan con los filtros seleccionados.
        </div>
      )}
    </div>
  )
}
