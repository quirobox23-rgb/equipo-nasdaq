// ─────────────────────────────────────────────
//  PIEZAS COMPARTIDAS — alta (AccountWizard) y edición
//  (AccountEditPanel) de cuentas
//
//  Wireframe "Nueva carga de cuentas" (08/10/2026). El formulario
//  viejo (AccountForm en Portfolio.jsx) queda intacto como respaldo,
//  detrás de ACCOUNT_FORM_V2.
//
//  Modelo de datos: el mismo de siempre. Las reglas se guardan en %
//  (profitTarget, maxDrawdown, maxDailyDD) porque así las leen los
//  motores; acá solo se muestran y editan en $, como las publican las
//  firmas. El "Nombre" se sigue guardando en `firm` (es lo que
//  muestran todas las pantallas); la firma elegida va aparte en
//  `propFirm` / `presetId`, solo para saber de dónde salen las reglas.
// ─────────────────────────────────────────────

import { useState } from 'react'
import { Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import { PROP_FIRM_PRESETS, getPreset } from '@/data/propFirmPresets'
import styles from './accountForms.module.css'
import { useAllCycleNames } from '@/store/useCyclesStore'

export const TYPE_CARDS = [
  { value: 'Challenge', label: 'Challenge / Eval', hint: 'Pasando la evaluación' },
  { value: 'Funded',    label: 'Fondeada',  hint: 'Ya aprobaste' },
  { value: 'Personal',  label: 'Capital real', hint: 'Capital propio' },
]
export const TYPE_LABEL = { Challenge: 'Challenge', Funded: 'Fondeada', Personal: 'Capital real' }

export const STATUS_CHIPS = [
  { value: 'active',   label: 'Activa' },
  { value: 'approved', label: 'Completada' },
  { value: 'lost',     label: 'Perdida' },
]

export const SIZE_CHIPS = [5000, 10000, 25000, 50000, 100000, 150000, 200000]

// Tipo de mercado: por ahora solo se guarda en `market` (cosmético)
export const MARKET_OPTIONS = [
  { value: 'cfd',     label: 'CFDs' },
  { value: 'futures', label: 'Futuros' },
]

export const DRAWDOWN_TYPE_OPTIONS = [
  { value: 'static',        label: 'Estático' },
  { value: 'trailing_eod',  label: 'Trailing EOD' },
  { value: 'trailing_live', label: 'Trailing Live' },
]
const DD_LABEL = Object.fromEntries(DRAWDOWN_TYPE_OPTIONS.map(o => [o.value, o.label]))

export const OTHER_FIRM = 'other'

// Valores por defecto (se pueden cambiar a mano en el formulario):
// comisión de $1.04 por contrato ida y vuelta (la de Apex en Tradovate;
// otras firmas o cuentas propias pueden cobrar otra, se cambia a mano), y riesgo
// por trade del 1% del tamaño (10K → $100, 50K → $500, 100K → $1000).
export const DEFAULT_COMMISSION = '1.04'
export const DEFAULT_RISK_PCT = 1
export const riskFromSize = (size) => {
  const s = parseFloat(size)
  return Number.isFinite(s) && s > 0 ? String(Math.round(s * DEFAULT_RISK_PCT / 100)) : ''
}

export const today = () => new Date().toISOString().split('T')[0]

export const fmtMoney = (n) =>
  Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : '—'

export const sizeShort = (size) => {
  const n = Number(size) || 0
  return n >= 1000 ? `${Math.round(n / 1000)}K` : String(n)
}

// % del tamaño → $ (para mostrar) y $ → % (para guardar)
export const pctToUsd = (pct, size) => {
  const p = parseFloat(pct), s = parseFloat(size)
  return Number.isFinite(p) && Number.isFinite(s) && s > 0 ? Math.round(s * p / 100) : ''
}
export const usdToPct = (usd, size) => {
  const u = parseFloat(usd), s = parseFloat(size)
  return Number.isFinite(u) && Number.isFinite(s) && s > 0 ? Math.round((u / s) * 100 * 1000) / 1000 : null
}

// Firmas para el select: una entrada por preset (hoy son por programa:
// "FTMO — Challenge 2 pasos"…) + "Otra". La lista completa de firmas
// y tamaños es la etapa 3 (la tienen que pasar Santos / Bego).
export const FIRM_OPTIONS = [
  ...PROP_FIRM_PRESETS.map(p => ({ value: p.id, label: p.label })),
  { value: OTHER_FIRM, label: 'Otra firma (cargo las reglas a mano)' },
]

// Reglas en $ a partir de un preset y un tamaño
export function rulesFromPreset(presetId, size) {
  const p = getPreset(presetId)
  if (!p) return null
  return {
    profitTargetUsd: pctToUsd(p.profitTarget, size),
    maxDrawdownUsd:  pctToUsd(p.maxDrawdown, size),
    maxDailyDDUsd:   pctToUsd(p.maxDailyDD, size),
    drawdownType:    p.drawdownType,
  }
}

// Nombre sugerido: "Topstep 50K", y "#2", "#3"… si ya hay otra igual
export function suggestName(firmName, size, accounts, excludeId) {
  if (!firmName) return ''
  const base = size ? `${firmName} ${sizeShort(size)}` : firmName
  const taken = new Set(accounts.filter(a => a.id !== excludeId).map(a => (a.firm || '').trim().toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  for (let i = 2; i < 100; i++) {
    const candidate = `${base} #${i}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return base
}

// ── UI ─────────────────────────────────────────

export function Field({ label, hint, required, optional, children, className }) {
  return (
    <div className={`${styles.field} ${className || ''}`}>
      <div className={styles.label}>
        {label}
        {required && <span className={styles.req}>*</span>}
        {optional && <small>opcional</small>}
      </div>
      {children}
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  )
}

export function MoneyInput({ value, onChange, placeholder = '0', step, autoFocus }) {
  return (
    <div className={styles.money}>
      <span>$</span>
      <input type="number" min="0" step={step} placeholder={placeholder} value={value ?? ''}
        autoFocus={autoFocus} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

export function TypeCards({ value, onChange }) {
  return (
    <div className={styles.typeCards} role="radiogroup" aria-label="Tipo de cuenta">
      {TYPE_CARDS.map(t => (
        <button key={t.value} type="button" role="radio" aria-checked={value === t.value}
          className={`${styles.typeCard} ${value === t.value ? styles.on : ''}`}
          onClick={() => onChange(t.value)}>
          <b>{t.label}</b>
          <small>{t.hint}</small>
        </button>
      ))}
    </div>
  )
}

// size="sm": misma altura que los .btn-sm de al lado (filtros del Portafolio)
export function Chips({ options, value, onChange, dots, label, size }) {
  return (
    <div className={`${styles.chips} ${size === 'sm' || size === 'xs' ? styles.chipsSm : ''} ${size === 'xs' ? styles.chipsXs : ''}`} role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={`${styles.chip} ${value === o.value ? styles.on : ''}`}
          onClick={() => onChange(o.value)}>
          {dots?.[o.value] && <span className={styles.dot} style={{ background: dots[o.value] }} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Tarjeta de reglas: en modo lectura muestra los $; "Editar" las vuelve
// inputs. `rules` = { profitTargetUsd, maxDrawdownUsd, maxDailyDDUsd, drawdownType }
export function RulesCard({ title, rules, onChange, editing, onToggleEdit, source, canToggle = true }) {
  const set = (k, v) => onChange({ ...rules, [k]: v })
  const show = (v) => (v === '' || v == null || Number(v) === 0 ? '—' : fmtMoney(Number(v)))
  return (
    <div className={styles.rules}>
      <div className={styles.rulesTop}>
        <b>{title}</b>
        {canToggle && (
          <button type="button" className={styles.ghostBtn} onClick={onToggleEdit}>
            {editing ? 'Listo' : <><Pencil size={11} /> Editar</>}
          </button>
        )}
      </div>
      {editing ? (
        <div className={styles.row2}>
          <Field label="Objetivo"><MoneyInput value={rules.profitTargetUsd} onChange={v => set('profitTargetUsd', v)} /></Field>
          <Field label="DD máximo"><MoneyInput value={rules.maxDrawdownUsd} onChange={v => set('maxDrawdownUsd', v)} /></Field>
          <Field label="DD diario"><MoneyInput value={rules.maxDailyDDUsd} onChange={v => set('maxDailyDDUsd', v)} /></Field>
          <Field label="Tipo de DD">
            <select value={rules.drawdownType} onChange={e => set('drawdownType', e.target.value)}>
              {DRAWDOWN_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
      ) : (
        <div className={styles.kv}>
          <div><span>Objetivo</span><b>{show(rules.profitTargetUsd)}</b></div>
          <div><span>DD máximo</span><b>{show(rules.maxDrawdownUsd)}</b></div>
          <div><span>DD diario</span><b>{show(rules.maxDailyDDUsd)}</b></div>
          <div><span>Tipo de DD</span><b>{DD_LABEL[rules.drawdownType] || '—'}</b></div>
        </div>
      )}
      {source && <div className={styles.src}>{source}</div>}
    </div>
  )
}

// Grupo plegable de la Parte 2, con resumen a la derecha
export function Group({ title, subtitle, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.group}>
      <button type="button" className={styles.groupHead} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>
          {title}
          {subtitle && <small>{subtitle}</small>}
        </span>
        <span className={styles.groupSummary}>
          {!open && summary}
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open && <div className={styles.groupBody}>{children}</div>}
    </div>
  )
}

export function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label}
      className={`${styles.toggle} ${on ? styles.on : ''}`} onClick={() => onChange(!on)} />
  )
}

// Regla de consistencia: un solo dato, el % máximo del mejor día sobre
// el profit total (consistencyRules.maxDailyPercent, lo lee Riesgo hoy).
// Los otros 3 campos viejos no se muestran pero se conservan tal cual.
export function ConsistencyField({ rules, onChange }) {
  const cr = rules ?? {}
  const pct = cr.maxDailyPercent ?? 40
  return (
    <div className={styles.consistency}>
      <div className={styles.consistencyTop}>
        <span>Aplicar regla de consistencia</span>
        <Toggle on={!!cr.enabled} label="Aplicar regla de consistencia"
          onChange={v => onChange({ ...cr, enabled: v, maxDailyPercent: pct })} />
      </div>
      {cr.enabled && (
        <Field label="Máximo del mejor día sobre el profit total"
          hint="FTMO usa 40% y The5ers 50%. Revisá la regla de tu firma.">
          <div className={styles.range}>
            <input type="range" min="10" max="80" step="5" value={pct}
              onChange={e => onChange({ ...cr, maxDailyPercent: parseInt(e.target.value, 10) })} />
            <b>{pct}%</b>
          </div>
        </Field>
      )}
    </div>
  )
}

// Convierte el estado del formulario nuevo al objeto Account de siempre
export function formToAccountPatch(f) {
  const size = parseFloat(f.size)
  return {
    firm:         f.name.trim(),
    propFirm:     f.propFirm || '',
    presetId:     f.presetId || '',
    type:         f.type,
    market:       f.market || '',
    phase:        f.phase,
    size,
    profitTarget: usdToPct(f.rules.profitTargetUsd, size),
    maxDrawdown:  usdToPct(f.rules.maxDrawdownUsd, size) ?? 0,
    maxDailyDD:   usdToPct(f.rules.maxDailyDDUsd, size) ?? 0,
    drawdownType: f.rules.drawdownType,
    riskPerTrade: parseFloat(f.riskPerTrade),
    commissionPerContract: parseFloat(f.commissionPerContract) || 0,
    startDate:      f.startDate || today(),
    accountCost:    parseFloat(f.accountCost)    || 0,
    activationCost: parseFloat(f.activationCost) || 0,
    purchaseDate:   f.purchaseDate   || '',
    activationDate: f.activationDate || '',
    cycle:          (f.cycle    || '').trim(),
    strategy:       (f.strategy || '').trim(),
    consistencyRules: f.consistencyRules,
  }
}

// Validación de la Parte 1 (alta y pestaña Cuenta de la edición)
export function validatePart1(f, { requireFirm = true } = {}) {
  if (requireFirm && !f.presetId && !f.propFirm.trim()) return 'Elegí la firma o escribí su nombre'
  if (!f.size || parseFloat(f.size) <= 0) return 'Indicá el tamaño de la cuenta'
  if (!f.riskPerTrade || parseFloat(f.riskPerTrade) <= 0) return 'Indicá el riesgo por trade: sin él no se puede calcular R'
  if (!f.name.trim()) return 'Poné un nombre a la cuenta'
  return ''
}

// Ciclo de compra: nombre libre para agrupar y filtrar cuentas
// (Portafolio, Métricas…). Se elige uno de los ya creados o se escribe
// uno nuevo; no depende de fechas.
export function CycleField({ f, set }) {
  const cycles = useAllCycleNames()
  return (
    <Field label="Ciclo" optional hint={cycles.length ? 'Elegí uno de tus ciclos o escribí un nombre nuevo para crearlo.' : 'Escribí un nombre para crear tu primer ciclo.'}>
      <input type="text" list="fm-cycle-names" placeholder="Black Friday, Ciclo 1…" value={f.cycle ?? ''}
        onChange={e => set({ cycle: e.target.value })} />
      <datalist id="fm-cycle-names">{cycles.map(c => <option key={c} value={c} />)}</datalist>
    </Field>
  )
}
