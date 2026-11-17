// ─────────────────────────────────────────────
//  EDICIÓN DE CUENTA — panel lateral derecho (400px)
//
//  La tabla / tarjetas quedan visibles y la cuenta editada marcada.
//  Pestañas: Cuenta (= Parte 1 del alta) · Detalles (= Parte 2) ·
//  Retiros. Estado como chips arriba (es lo que más se edita) y
//  Eliminar en el pie, lejos de Guardar.
//
//  Firma y tamaño quedan en el encabezado; el tamaño solo se cambia
//  desde "Editar" en la tarjeta de reglas (cambiarlo cambia todas las
//  reglas en $).
//
//  Reemplaza al AccountForm de edición cuando ACCOUNT_FORM_V2 está
//  activo. Ver accountFormShared.jsx.
// ─────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef } from 'react'
import { X, AlertTriangle, Trash2, Pencil } from 'lucide-react'
import { getPreset, commissionForFirm } from '@/data/propFirmPresets'
import {
  TYPE_LABEL, STATUS_CHIPS, MARKET_OPTIONS, fmtMoney, sizeShort, pctToUsd, usdToPct,
  Field, MoneyInput, TypeCards, Chips, RulesCard, ConsistencyField,
  formToAccountPatch, validatePart1, today, DEFAULT_COMMISSION, riskFromSize, CycleField,
} from './accountFormShared'
import styles from './accountForms.module.css'


function accountToForm(a) {
  return {
    name:     a.firm ?? '',
    propFirm: a.propFirm ?? '',
    presetId: a.presetId ?? '',
    type:     a.type ?? 'Challenge',
    market:   a.market ?? '',
    status:   a.status ?? 'active',
    size:     a.size != null ? String(a.size) : '',
    // Sin dato guardado: 1% del tamaño y la comisión por defecto (salvo CFDs)
    riskPerTrade:          a.riskPerTrade || riskFromSize(a.size),
    commissionPerContract: a.commissionPerContract || (a.market === 'cfd' ? ''
      : String(commissionForFirm(a.propFirm || a.firm)?.perContract ?? DEFAULT_COMMISSION)),
    rules: {
      profitTargetUsd: pctToUsd(a.profitTarget, a.size),
      maxDrawdownUsd:  pctToUsd(a.maxDrawdown, a.size),
      maxDailyDDUsd:   pctToUsd(a.maxDailyDD, a.size),
      drawdownType:    a.drawdownType ?? 'trailing_eod',
    },
    phase:          a.phase ?? 'Phase 1',
    startDate:      a.startDate ?? '',
    accountCost:    a.accountCost || '',
    activationCost: a.activationCost || '',
    purchaseDate:   a.purchaseDate ?? '',
    activationDate: a.activationDate ?? '',
    cycle:          a.cycle ?? '',
    strategy:       a.strategy ?? '',
    // Se conservan los 4 campos viejos aunque solo se muestre uno
    consistencyRules: a.consistencyRules ?? {
      enabled: false, maxDailyPercent: 40, maxTradePercent: 20, maxDailyProfit: '', maxProfitPerTrade: '',
    },
    withdrawals: a.withdrawals ?? [],
  }
}

function WithdrawalsTab({ list, onChange }) {
  const [draft, setDraft] = useState(null)   // { id?, date, amount, note }
  const total = list.reduce((s, w) => s + (Number(w.amount) || 0), 0)
  const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const saveDraft = () => {
    if (!draft.date || !(parseFloat(draft.amount) > 0)) return
    const w = { ...draft, id: draft.id ?? `w-${Date.now()}`, amount: parseFloat(draft.amount) }
    onChange(list.some(x => x.id === w.id) ? list.map(x => (x.id === w.id ? w : x)) : [...list, w])
    setDraft(null)
  }

  return (<>
    {sorted.length === 0 && !draft && (
      <div className={styles.hint}>Todavía no hay retiros registrados para esta cuenta.</div>
    )}
    {sorted.length > 0 && (
      <div>
        {sorted.map(w => (
          <div key={w.id} className={styles.wd}>
            <span>{w.date}{w.note ? ` · ${w.note}` : ''}</span>
            <span className={styles.wdActions}>
              <b>{fmtMoney(Number(w.amount))}</b>
              <button type="button" className={styles.x} aria-label="Editar retiro" onClick={() => setDraft({ ...w })}><Pencil size={13} /></button>
              <button type="button" className={styles.x} aria-label="Eliminar retiro" onClick={() => onChange(list.filter(x => x.id !== w.id))}><Trash2 size={13} /></button>
            </span>
          </div>
        ))}
        <div className={styles.wdTotal}><span>Total retirado</span><b>{fmtMoney(total)}</b></div>
      </div>
    )}
    {draft ? (
      <div className={styles.confirm}>
        <div className={styles.row2}>
          <Field label="Fecha"><input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} /></Field>
          <Field label="Importe"><MoneyInput value={draft.amount} placeholder="1200" autoFocus onChange={v => setDraft(d => ({ ...d, amount: v }))} /></Field>
        </div>
        <Field label="Nota" optional>
          <input type="text" placeholder="Profit split…" value={draft.note ?? ''} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} />
        </Field>
        <div className={styles.confirmActions}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancelar</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={saveDraft}>{draft.id ? 'Guardar retiro' : 'Agregar retiro'}</button>
        </div>
      </div>
    ) : (
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
        onClick={() => setDraft({ date: today(), amount: '', note: '' })}>+ Registrar retiro</button>
    )}
    <div className={styles.hint}>Los retiros se guardan con el botón Guardar del panel.</div>
  </>)
}

// Entrada / salida: mismo criterio que el panel de eventos del
// calendario en Agente Macro (EventDrawer) — se desliza desde la
// derecha en 200ms y el resto de la pantalla se oscurece un poco sin
// bloquear clics (se puede pasar a otra cuenta con el panel abierto).
const ANIM_MS = 200

export default function AccountEditPanel({ account, tradeCount, onSave, onDelete, onClose, onDirtyChange, animateIn = true }) {
  const initial = useMemo(() => accountToForm(account), [account.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF]         = useState(initial)
  const [tab, setTab]     = useState('cuenta')
  const [error, setError] = useState('')
  const [rulesEditing, setRulesEditing]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [visible, setVisible] = useState(!animateIn)

  useEffect(() => {
    if (!animateIn) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [animateIn])

  // Cierra con la animación de salida y después avisa al padre
  const closeAnimated = (then) => {
    setVisible(false)
    setTimeout(then, ANIM_MS)
  }

  const set = (patch) => setF(prev => ({ ...prev, ...patch }))
  const dirty = JSON.stringify(f) !== JSON.stringify(initial)

  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const requestClose = () => {
    if (dirty && !window.confirm('Tenés cambios sin guardar en esta cuenta. ¿Descartarlos?')) return
    closeAnimated(onClose)
  }

  // Cierra con Escape o con un clic en cualquier lado fuera del panel
  // (como EventDrawer de Agente Macro). Los lápices de editar llevan
  // data-account-panel-keep: ahí no se cierra, se cambia de cuenta.
  const panelRef = useRef(null)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') requestClose() }
    const onDown = (e) => {
      if (!visible) return
      if (panelRef.current?.contains(e.target)) return
      if (e.target.closest?.('[data-account-panel-keep]')) return
      requestClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  })

  // Cambiar el tamaño mantiene las reglas como %, recalculando los $
  const handleSize = (size) => {
    setF(prev => {
      const s = parseFloat(size)
      if (!(s > 0)) return { ...prev, size }
      const old = parseFloat(prev.size)
      const rescale = (usd) => {
        const pct = usdToPct(usd, old)
        return pct == null ? usd : pctToUsd(pct, s)
      }
      // Riesgo en el 1% automático → se recalcula con el tamaño nuevo
      const riskPerTrade = String(prev.riskPerTrade) === riskFromSize(old) ? riskFromSize(s) : prev.riskPerTrade
      return {
        ...prev, size, riskPerTrade,
        rules: {
          ...prev.rules,
          profitTargetUsd: rescale(prev.rules.profitTargetUsd),
          maxDrawdownUsd:  rescale(prev.rules.maxDrawdownUsd),
          maxDailyDDUsd:   rescale(prev.rules.maxDailyDDUsd),
        },
      }
    })
  }

  const handleSave = () => {
    const err = validatePart1(f, { requireFirm: false })
    if (err) { setError(err); setTab('cuenta'); return }
    setError('')
    const patch = formToAccountPatch(f)
    // Regla sin tocar (mismo $ y mismo tamaño) → se guarda el % original
    // tal cual, sin redondeos de ida y vuelta por pasar a $.
    if (f.size === initial.size) {
      if (f.rules.profitTargetUsd === initial.rules.profitTargetUsd) patch.profitTarget = account.profitTarget ?? null
      if (f.rules.maxDrawdownUsd  === initial.rules.maxDrawdownUsd)  patch.maxDrawdown  = account.maxDrawdown
      if (f.rules.maxDailyDDUsd   === initial.rules.maxDailyDDUsd)   patch.maxDailyDD   = account.maxDailyDD
    }
    const finalPatch = {
      ...patch,
      startDate: f.startDate || '',
      status: f.status,
      withdrawals: f.withdrawals,
    }
    onDirtyChange?.(false)
    closeAnimated(() => onSave(account.id, finalPatch))
  }

  const preset = getPreset(f.presetId)
  const firmName = f.propFirm || preset?.firm || ''
  const rulesTitle = `Reglas${firmName ? ` de ${firmName}` : ' de la cuenta'} ${sizeShort(f.size)}`

  return (
    <>
    <div className={`${styles.drawerShade} ${visible ? styles.open : ''}`} aria-hidden="true" />
    <aside ref={panelRef} className={`${styles.drawer} ${visible ? styles.open : ''}`} aria-label={`Editar ${account.firm}`}>
      <div className={styles.dh}>
        <div className={styles.dhTop}>
          <div style={{ minWidth: 0 }}>
            <b>{f.name || account.firm}</b>
            <div className={styles.meta}>
              {[firmName, fmtMoney(Number(f.size)), TYPE_LABEL[f.type] || f.type].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button type="button" className={styles.x} onClick={requestClose} aria-label="Cerrar panel"><X size={16} /></button>
        </div>
        <div className={styles.tabs} role="tablist">
          {[['cuenta', 'Cuenta'], ['detalles', 'Detalles'], ['retiros', `Retiros · ${f.withdrawals.length}`]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k}
              className={`${styles.tab} ${tab === k ? styles.on : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className={styles.db}>
        {tab === 'cuenta' && (<>
          <Field label="Estado">
            <Chips options={STATUS_CHIPS} value={f.status} onChange={v => set({ status: v })} label="Estado" />
          </Field>
          <Field label="Nombre de la cuenta" required>
            <input type="text" value={f.name} onChange={e => set({ name: e.target.value })} />
          </Field>
          <CycleField f={f} set={set} />
          <Field label="Tipo de cuenta">
            <TypeCards value={f.type} onChange={v => set({ type: v })} />
          </Field>
          <Field label="Tipo de mercado">
            <Chips options={MARKET_OPTIONS} value={f.market} onChange={v => set({ market: v })} />
          </Field>
          {/* Uno debajo del otro: en 400px, lado a lado, el label largo de
              comisión se partía en 2 líneas y desalineaba los inputs */}
          <Field label="Riesgo por trade" required>
            <MoneyInput value={f.riskPerTrade} onChange={v => set({ riskPerTrade: v })} />
          </Field>
          <Field label="Comisión por contrato" optional hint="Ida y vuelta. Se resta al importar el CSV.">
            <MoneyInput value={f.commissionPerContract} step="0.01" onChange={v => set({ commissionPerContract: v })} />
          </Field>
          {rulesEditing && (
            <Field label="Tamaño" required hint="Cambiarlo recalcula las reglas en $ con los mismos %.">
              <MoneyInput value={f.size} onChange={handleSize} />
            </Field>
          )}
          <RulesCard
            title={rulesTitle}
            rules={f.rules}
            editing={rulesEditing}
            onToggleEdit={() => setRulesEditing(e => !e)}
            onChange={r => set({ rules: r })}
          />
          <div className={styles.fixedNote}>
            Firma y tamaño quedan fijos arriba: cambiarlos cambia todas las reglas. Si te equivocaste, usá "Editar" en las reglas.
          </div>
        </>)}

        {tab === 'detalles' && (<>
          <div className={styles.row2}>
            {f.type === 'Challenge' && (
              <Field label="Fase">
                <select value={f.phase} onChange={e => set({ phase: e.target.value })}>
                  <option value="Phase 1">Fase 1</option>
                  <option value="Phase 2">Fase 2</option>
                  <option value="Phase 3">Fase 3</option>
                  {!['Phase 1', 'Phase 2', 'Phase 3'].includes(f.phase) && <option value={f.phase}>{f.phase}</option>}
                </select>
              </Field>
            )}
            <Field label="Fecha de inicio"><input type="date" value={f.startDate} onChange={e => set({ startDate: e.target.value })} /></Field>
          </div>
          <div className={styles.row2}>
            <Field label="Costo de la cuenta"><MoneyInput value={f.accountCost} step="0.01" onChange={v => set({ accountCost: v })} /></Field>
            <Field label="Fecha de compra"><input type="date" value={f.purchaseDate} onChange={e => set({ purchaseDate: e.target.value })} /></Field>
            <Field label="Costo de activación"><MoneyInput value={f.activationCost} step="0.01" onChange={v => set({ activationCost: v })} /></Field>
            <Field label="Fecha de activación"><input type="date" value={f.activationDate} onChange={e => set({ activationDate: e.target.value })} /></Field>
          </div>
          <div className={styles.group} style={{ padding: '12px 14px' }}>
            <div className={styles.label} style={{ color: 'var(--text)' }}>Regla de consistencia</div>
            <ConsistencyField rules={f.consistencyRules} onChange={cr => set({ consistencyRules: cr })} />
          </div>
        </>)}

        {tab === 'retiros' && (
          <WithdrawalsTab list={f.withdrawals} onChange={ws => set({ withdrawals: ws })} />
        )}

        {confirmDelete && (
          <div className={styles.confirm}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={15} style={{ color: 'var(--neg)', flexShrink: 0, marginTop: 1 }} />
              <span>
                Vas a eliminar <b style={{ color: 'var(--text)' }}>{account.firm}</b>
                {tradeCount > 0 && <> junto con <b style={{ color: 'var(--text)' }}>{tradeCount} trade{tradeCount === 1 ? '' : 's'}</b></>}.
                {' '}No se puede deshacer.
              </span>
            </div>
            <div className={styles.confirmActions}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button type="button" className="btn btn-sm" onClick={() => onDelete(account.id)}
                style={{ background: 'var(--neg2)', color: 'var(--neg)', border: '1px solid var(--neg)' }}>
                <Trash2 size={13} /> Eliminar cuenta
              </button>
            </div>
          </div>
        )}

        {error && <div className={styles.error}><AlertTriangle size={13} /> {error}</div>}
      </div>

      <div className={styles.df}>
        <button type="button" className={styles.danger} onClick={() => setConfirmDelete(true)}
          title="Eliminar cuenta" aria-label="Eliminar cuenta"><Trash2 size={15} /></button>
        <div className={styles.dfRight}>
          {dirty && <span className={styles.dirty}>● Sin guardar</span>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={requestClose}>Cancelar</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={!dirty}
            style={!dirty ? { opacity: 0.5, cursor: 'default' } : undefined}>Guardar</button>
        </div>
      </div>
    </aside>
    </>
  )
}
