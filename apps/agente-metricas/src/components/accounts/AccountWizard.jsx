// ─────────────────────────────────────────────
//  ALTA DE CUENTA — modal por pasos
//
//  Parte 1 (obligatoria): tipo, firma, tamaño, riesgo por trade,
//    comisión, reglas en $ (precargadas de la firma) y nombre.
//  Parte 2 (opcional, se puede saltar): costos, fase / fecha de
//    inicio y regla de consistencia.
//  Paso final: la cuenta ya está guardada; subir CSV o "Lo subo
//    después" (reusa AccountImportCsvModal tal cual).
//
//  Reemplaza al AccountForm de Portfolio.jsx cuando ACCOUNT_FORM_V2
//  está activo. Ver accountFormShared.jsx.
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { X, AlertTriangle, Upload, Wallet, CheckCircle2 } from 'lucide-react'
import { useStore, useAccounts, useTier } from '@/store/useStore'
import { accountLimitFor, TIER_LABELS } from '@/config/features'
import { getPreset, commissionForFirm } from '@/data/propFirmPresets'
import AccountImportCsvModal from '@/components/import/AccountImportCsvModal'
import {
  TYPE_LABEL, SIZE_CHIPS, DEFAULT_COMMISSION, riskFromSize, FIRM_OPTIONS, OTHER_FIRM, today, fmtMoney, sizeShort, pctToUsd,
  rulesFromPreset, suggestName, Field, MoneyInput, TypeCards, Chips, MARKET_OPTIONS, RulesCard, Group,
  ConsistencyField, formToAccountPatch, validatePart1, CycleField,
} from './accountFormShared'
import styles from './accountForms.module.css'

const EMPTY_RULES = { profitTargetUsd: '', maxDrawdownUsd: '', maxDailyDDUsd: '', drawdownType: 'trailing_eod' }

const INITIAL = {
  type: 'Challenge',
  market: 'futures',
  presetId: '',
  firmChoice: '',          // id de preset | OTHER_FIRM | ''
  propFirm: '',
  size: '',
  riskPerTrade: '',
  commissionPerContract: DEFAULT_COMMISSION,
  name: '',
  rules: EMPTY_RULES,
  phase: 'Phase 1',
  startDate: today(),
  accountCost: '',
  activationCost: '',
  purchaseDate: '',
  activationDate: '',
  cycle: '',
  strategy: '',
  consistencyRules: { enabled: false, maxDailyPercent: 40, maxTradePercent: 20, maxDailyProfit: '', maxProfitPerTrade: '' },
}

// Reglas por defecto cuando no hay preset (Otra firma / Personal):
// las mismas del formulario viejo (DD 10%, diario 5%), ya en $.
const manualDefaults = (size) => ({
  profitTargetUsd: '',
  maxDrawdownUsd:  pctToUsd(10, size),
  maxDailyDDUsd:   pctToUsd(5, size),
  drawdownType:    'trailing_eod',
})

// Dos bloques: título (ícono + "Cargá tu cuenta" + cerrar) y, abajo,
// la franja de progreso (parte actual + barritas)
function StepHeader({ heading = 'Cargá tu cuenta', icon: Icon = Wallet, title, step, total, onClose }) {
  return (<>
    <div className={styles.mh}>
      <div className={styles.mhMain}>
        <span className={styles.mhIcon} aria-hidden="true"><Icon size={18} /></span>
        <div className={styles.heading}>{heading}</div>
      </div>
      <button type="button" className={styles.x} onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
    </div>
    <div className={styles.progress}>
      <div className={styles.step}>{title}</div>
      <div className={styles.bars} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < step ? styles.barOn : ''} />
        ))}
      </div>
    </div>
  </>)
}

export default function AccountWizard({ onClose }) {
  const accounts   = useAccounts()
  const addAccount = useStore(s => s.addAccount)
  const tier       = useTier()

  // Aviso de cuentas restantes: solo en planes con límite (Básico)
  const accountLimit = accountLimitFor(tier)
  const remaining    = accountLimit - accounts.length
  const limitNote = accountLimit === Infinity ? null
    : remaining <= 1 ? `Es la última cuenta de tu plan ${TIER_LABELS[tier]}`
    : `Te quedan ${remaining} de ${accountLimit} cuentas en tu plan ${TIER_LABELS[tier]}`

  const [step, setStep]   = useState(1)       // 1 | 2 | 3
  const [f, setF]         = useState(INITIAL)
  const [error, setError] = useState('')
  const [nameTouched, setNameTouched]   = useState(false)
  const [rulesTouched, setRulesTouched] = useState(false)
  const [riskTouched, setRiskTouched]   = useState(false)
  const [commissionTouched, setCommissionTouched] = useState(false)
  const [rulesEditing, setRulesEditing] = useState(false)
  const [saved, setSaved]               = useState(null)   // cuenta ya guardada (paso 3)
  const [showImport, setShowImport]     = useState(false)

  const set = (patch) => setF(prev => ({ ...prev, ...patch }))

  const isPersonal = f.type === 'Personal'
  const isManual   = isPersonal || f.firmChoice === OTHER_FIRM
  const preset     = getPreset(f.presetId)

  // Nombre automático mientras no lo toquen
  useEffect(() => {
    if (nameTouched) return
    setF(prev => ({ ...prev, name: suggestName(prev.propFirm.trim() || (prev.type === 'Personal' ? 'Personal' : ''), prev.size, accounts) }))
  }, [f.propFirm, f.size, f.type, nameTouched, accounts])

  // Escape cierra (salvo con el importador abierto, que tiene su propio cierre)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !showImport) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, showImport])

  const recomputeRules = (next) => {
    if (rulesTouched) return next.rules
    if (next.presetId) return rulesFromPreset(next.presetId, next.size) ?? next.rules
    return manualDefaults(next.size)
  }

  const handleType = (type) => {
    const next = { ...f, type }
    if (type === 'Personal') { next.presetId = ''; next.firmChoice = OTHER_FIRM; if (f.presetId) next.propFirm = '' }
    else if (f.type === 'Personal') { next.firmChoice = ''; next.propFirm = '' }
    next.rules = recomputeRules(next)
    setF(next)
  }

  const handleFirm = (choice) => {
    const p = getPreset(choice)
    const next = { ...f, firmChoice: choice, presetId: p ? p.id : '', propFirm: p ? p.firm : '' }
    if (p?.size) next.size = String(p.size)
    if (!riskTouched) next.riskPerTrade = riskFromSize(next.size)
    setRulesTouched(false)
    next.rules = p ? (rulesFromPreset(p.id, next.size) ?? EMPTY_RULES) : manualDefaults(next.size)
    setRulesEditing(!p && choice === OTHER_FIRM)
    next.commissionPerContract = autoCommission(next)
    setF(next)
  }

  // Comisión automática mientras nadie la toque a mano: la confirmada
  // de la firma (FIRM_COMMISSIONS) o la por defecto. CFDs (MT4/MT5) ya
  // traen la comisión en el archivo: ahí queda vacía.
  const autoCommission = (next) => {
    if (commissionTouched) return next.commissionPerContract
    if (next.market === 'cfd') return ''
    const known = commissionForFirm(next.propFirm)
    return known ? String(known.perContract) : DEFAULT_COMMISSION
  }

  const handleMarket = (market) => {
    const next = { ...f, market }
    next.commissionPerContract = autoCommission(next)
    setF(next)
  }

  const handleFirmName = (propFirm) => {
    const next = { ...f, propFirm }
    next.commissionPerContract = autoCommission(next)
    setF(next)
  }

  const handleSize = (size) => {
    const next = { ...f, size: String(size) }
    next.rules = recomputeRules(next)
    if (!riskTouched) next.riskPerTrade = riskFromSize(next.size)
    setF(next)
  }

  const goPart2 = () => {
    const err = validatePart1(f, { requireFirm: !isPersonal })
    if (err) { setError(err); return }
    setError(''); setStep(2)
  }

  const save = (withDetails) => {
    const err = validatePart1(f, { requireFirm: !isPersonal })
    if (err) { setError(err); setStep(1); return }
    const source = withDetails ? f : {
      ...f,
      startDate: INITIAL.startDate, accountCost: '', activationCost: '', purchaseDate: '', activationDate: '', cycle: '', strategy: '',
      consistencyRules: INITIAL.consistencyRules,
    }
    const phase = f.type === 'Challenge' ? (withDetails ? f.phase : 'Phase 1')
      : f.type === 'Funded' ? 'Aprobada' : 'Personal'
    addAccount({
      ...formToAccountPatch({ ...source, phase }),
      currency: 'USD',
      status: 'active',
      currentProfit: 0,
      currentDD: 0,
      isFavorite: false,
      inRecovery: false,
      withdrawals: [],
    })
    // addAccount no devuelve la cuenta: es la última agregada
    const created = useStore.getState().accounts.at(-1)
    setSaved(created); setError(''); setStep(3)
  }

  const rulesTitle = preset
    ? `Reglas de ${preset.firm}${f.size ? ` ${sizeShort(f.size)}` : ''}`
    : isPersonal ? 'Límites propios' : 'Reglas de la cuenta'
  const rulesSource = preset
    ? `${preset.note} Verificado ${preset.verifiedAt}: revisá la web de la firma antes de operar.`
    : isPersonal ? 'Opcional: tus propios límites de pérdida.' : 'Cargalas como las publica tu firma.'

  if (showImport && saved) {
    return <AccountImportCsvModal account={saved} onClose={onClose} />
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Nueva cuenta">
      <div className={styles.modal}>

        {/* ── PARTE 1 ── */}
        {step === 1 && (<>
          <StepHeader title="Parte 1 de 2 · Datos de la cuenta" step={1} total={2} onClose={onClose} />
          <div className={styles.mb}>
            <Field label="Nombre de la cuenta" optional hint="Para distinguirla en todas las pantallas. Se completa solo con la firma y el tamaño.">
              <input type="text" placeholder="Topstep 50K #2" value={f.name}
                onChange={e => { setNameTouched(true); set({ name: e.target.value }) }} />
            </Field>
            <CycleField f={f} set={set} />

            <Field label="Tipo de cuenta">
              <TypeCards value={f.type} onChange={handleType} />
            </Field>

            {/* Por ahora solo se guarda (cosmético); después se vuelve funcional */}
            <Field label="Tipo de mercado">
              <Chips options={MARKET_OPTIONS} value={f.market} onChange={handleMarket} />
            </Field>

            {isPersonal ? (
              <Field label="Broker" optional>
                <input type="text" placeholder="IC Markets, Interactive Brokers…" value={f.propFirm}
                  onChange={e => handleFirmName(e.target.value)} />
              </Field>
            ) : (
              <Field label="Firma" required>
                <select value={f.firmChoice} onChange={e => handleFirm(e.target.value)}>
                  <option value="" disabled>Elegí tu firma…</option>
                  {FIRM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {f.firmChoice === OTHER_FIRM && (
                  <input type="text" style={{ marginTop: 8 }} placeholder="Nombre de la firma" value={f.propFirm}
                    onChange={e => handleFirmName(e.target.value)} />
                )}
              </Field>
            )}

            <Field label="Tamaño" required>
              <MoneyInput value={f.size} placeholder="100000" onChange={handleSize} />
              <div className={styles.sizeChips}>
                {SIZE_CHIPS.map(s => (
                  <button key={s} type="button" className={`${styles.chip} ${Number(f.size) === s ? styles.on : ''}`}
                    onClick={() => handleSize(s)}>{sizeShort(s)}</button>
                ))}
              </div>
            </Field>

            <div className={styles.row2}>
              <Field label="Riesgo por trade" required hint="Sin este dato no se puede calcular R.">
                <MoneyInput value={f.riskPerTrade} placeholder="250" onChange={v => { setRiskTouched(true); set({ riskPerTrade: v }) }} />
              </Field>
              <Field label="Comisión por contrato" optional hint="Ida y vuelta. Se resta al importar el CSV.">
                <MoneyInput value={f.commissionPerContract} step="0.01" onChange={v => { setCommissionTouched(true); set({ commissionPerContract: v }) }} />
              </Field>
            </div>

            {(f.firmChoice || isPersonal) && (
              <RulesCard
                title={rulesTitle}
                rules={f.rules}
                editing={rulesEditing}
                onToggleEdit={() => setRulesEditing(e => !e)}
                onChange={r => { setRulesTouched(true); set({ rules: r }) }}
                source={rulesSource}
              />
            )}

            {error && <div className={styles.error}><AlertTriangle size={13} /> {error}</div>}
          </div>
          <div className={styles.mf}>
            {limitNote && <span className={styles.limitNote}>{limitNote}</span>}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={goPart2}>Continuar →</button>
          </div>
        </>)}

        {/* ── PARTE 2 ── */}
        {step === 2 && (<>
          <StepHeader title="Parte 2 de 2 · Más detalles (opcional)" step={2} total={2} onClose={onClose} />
          <div className={styles.mb}>
            <div className={styles.summary}>
              <div><span>Cuenta</span><b>{f.name}</b></div>
              <div><span>Tamaño</span><b>{fmtMoney(Number(f.size))}</b></div>
              <div><span>Tipo</span><b>{TYPE_LABEL[f.type]}</b></div>
            </div>

            <Group title="Costos" subtitle="Para Inversión y retiros (ROI)"
              summary={f.accountCost ? fmtMoney(Number(f.accountCost)) : 'Sin cargar'} defaultOpen>
              <div className={styles.row2}>
                <Field label="Costo de la cuenta"><MoneyInput value={f.accountCost} step="0.01" onChange={v => set({ accountCost: v })} /></Field>
                <Field label="Fecha de compra"><input type="date" value={f.purchaseDate} onChange={e => set({ purchaseDate: e.target.value })} /></Field>
                <Field label="Costo de activación" hint="0 si todavía no lo pagaste."><MoneyInput value={f.activationCost} step="0.01" onChange={v => set({ activationCost: v })} /></Field>
                <Field label="Fecha de activación"><input type="date" value={f.activationDate} onChange={e => set({ activationDate: e.target.value })} /></Field>
              </div>
              <div className={styles.hint}>Los retiros se registran después, desde la cuenta.</div>
            </Group>

            <Group title={f.type === 'Challenge' ? 'Fase y fecha de inicio' : 'Fecha de inicio'}
              summary={`${f.type === 'Challenge' ? `${f.phase.replace('Phase', 'Fase')} · ` : ''}${f.startDate === today() ? 'hoy' : f.startDate}`}>
              <div className={styles.row2}>
                {f.type === 'Challenge' && (
                  <Field label="Fase">
                    <select value={f.phase} onChange={e => set({ phase: e.target.value })}>
                      <option value="Phase 1">Fase 1</option>
                      <option value="Phase 2">Fase 2</option>
                      <option value="Phase 3">Fase 3</option>
                    </select>
                  </Field>
                )}
                <Field label="Fecha de inicio"><input type="date" value={f.startDate} onChange={e => set({ startDate: e.target.value })} /></Field>
              </div>
            </Group>

            <Group title="Regla de consistencia"
              summary={f.consistencyRules.enabled ? `${f.consistencyRules.maxDailyPercent}% del mejor día` : 'No aplica'}>
              <ConsistencyField rules={f.consistencyRules} onChange={cr => set({ consistencyRules: cr })} />
            </Group>

            {error && <div className={styles.error}><AlertTriangle size={13} /> {error}</div>}
          </div>
          <div className={styles.mf}>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginRight: 'auto' }} onClick={() => setStep(1)}>← Atrás</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => save(false)}>Saltar</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => save(true)}>Guardar y subir trades →</button>
          </div>
        </>)}

        {/* ── TRADES ── */}
        {step === 3 && saved && (<>
          <StepHeader heading="Cuenta guardada" icon={CheckCircle2} title="Último paso · Subir trades" step={2} total={2} onClose={onClose} />
          <div className={styles.mb}>
            <div className={styles.summary}>
              <div><span>Cuenta</span><b>{saved.firm}</b></div>
              <div><span>Tamaño</span><b>{fmtMoney(saved.size)}</b></div>
              <div><span>Tipo</span><b>{TYPE_LABEL[saved.type] || saved.type}</b></div>
            </div>
            <button type="button" className={styles.drop} onClick={() => setShowImport(true)}>
              <Upload size={22} />
              <b>Subí tu archivo de trades</b>
              <small>Tradovate · NinjaTrader · MT4 · MT5 · CSV genérico</small>
            </button>
          </div>
          <div className={styles.mf}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Lo subo después</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowImport(true)}>Subir CSV →</button>
          </div>
        </>)}

      </div>
    </div>
  )
}
