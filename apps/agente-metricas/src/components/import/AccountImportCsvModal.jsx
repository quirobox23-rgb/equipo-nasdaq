import { useState, useRef } from 'react'
import { X, Check, Upload } from 'lucide-react'
import { useStore, useTier, useCanImportCsvNow, useIncrementCsvImport } from '@/store/useStore'
import { parseCSV, parseCSVWithMapping, analyzeCSV, DEFAULT_RISK_CONSTANT } from '@/data/csvParser'
import { csvTradesLimitFor } from '@/config/features'
import { headerSignatureHash } from '@/importers/mappingEngine'
import { useImportFormatsStore } from '@/store/useImportFormatsStore'
import ColumnMappingWizard from './ColumnMappingWizard'
import { sumTradeDollars, totalWithdrawn } from '@/lib/tradeDollar'
import { impliedCommission } from '@/lib/commissionCalc'
import { decodeFileBuffer } from '@/lib/decodeText'
import { isPdfBuffer } from '@/importers/statementPdf'
import { readPdfStatement } from '@/lib/readPdfStatement'

// ─────────────────────────────────────────────
//  IMPORTAR CSV — scoped a una cuenta fija
//
//  Motor de importación v2 (Sprint "motor de importación"):
//    Seleccionar archivo → reconocimiento automático (legacy +
//    firma de columnas) → si no se reconoce: asistente de mapeo
//    manual (y se recuerda) → vista previa → Importar.
//
//  Reutiliza exactamente el mismo parseCSV/parseCSVWithMapping de
//  siempre (detección, normalización, deduplicación) — cero cambios
//  en el modelo de datos, cero cambios en Dashboard/Mentor IA/
//  Portfolio/Estadísticas. La cuenta viene fija por prop: no hay
//  selector de cuenta ni se vuelve a preguntar.
// ─────────────────────────────────────────────

const DEFAULT_IMPORT_RISK_INIT = { 200000: 1100, 100000: 550, 50000: 300, 25000: 150 }

function initialRiskConstant(account) {
  if (!account) return DEFAULT_RISK_CONSTANT
  if (account.riskPerTrade) return account.riskPerTrade
  const sizes = Object.keys(DEFAULT_IMPORT_RISK_INIT).map(Number).sort((a, b) => b - a)
  const match = sizes.find(s => account.size >= s)
  return match ? DEFAULT_IMPORT_RISK_INIT[match] : DEFAULT_RISK_CONSTANT
}

// Resultado de la importación (o error) con el Callout del StyleGuide:
// .callout + .callout-green|red, ícono con los tokens del callout,
// label en mayúscula (.callout-label) y el detalle debajo. Más compacto
// que el de página porque va dentro de un modal (como en Training).
function ImportMessage({ msg }) {
  const ok = msg.type === 'success'
  const Icon = ok ? Check : X  // check o cruz solos (sin círculo)
  return (
    <div role={ok ? 'status' : 'alert'} className={`callout ${ok ? 'callout-green' : 'callout-red'}`}
      style={{ padding: '14px 18px', gap: 14, marginBottom: 14, flexWrap: 'nowrap' }}>
      <div className="icon-circle" style={{ width: 40, height: 40, flexShrink: 0, background: 'var(--callout-bg1)', color: 'var(--callout-accent)' }}>
        <Icon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="callout-label">{msg.title ?? (ok ? 'Importación completa' : 'No se pudo importar')}</div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
          {ok ? (msg.count > 0 ? `${msg.count} trades importados con éxito` : 'Cuenta actualizada con éxito') : msg.text}
        </div>
        {ok && msg.text && (
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginTop: 2, overflowWrap: 'anywhere' }}>{msg.text}</div>
        )}
      </div>
    </div>
  )
}

// "7 retiros ($474.91)"
function withdrawalsLabel(list) {
  const total = Math.round(list.reduce((s, w) => s + w.amount, 0) * 100) / 100
  return `${list.length} retiro${list.length !== 1 ? 's' : ''} ($${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
}

// Recuadro informativo neutro (riesgo usado, formato detectado)
const INFO_BOX = {
  padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12,
  background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text2)',
}

// Comisión: muestra la que se está restando y, con el balance real
// de la plataforma, calcula la correcta para esta firma/cuenta
function CommissionCheck({ trades, commission, defaultBefore, onApply }) {
  const [open, setOpen]     = useState(false)
  const [before, setBefore] = useState(() => String(Math.round(defaultBefore * 100) / 100))
  const [after, setAfter]   = useState('')
  const calc = impliedCommission(trades, before, after)
  const brokerFees = trades.some(t => t.fees > 0 && t.grossPnl === undefined)
  return (
    <div style={INFO_BOX}>
      {brokerFees ? (
        <>Las comisiones ya vienen en el archivo (no se resta nada extra).</>
      ) : (
        <>
          Comisión restada: <strong style={{ color: 'var(--text)' }}>${commission || 0}/contrato</strong>
          {' · '}
          <button type="button" onClick={() => setOpen(o => !o)} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font)',
            fontSize: 12, color: 'var(--brand)', textDecoration: 'underline',
          }}>{open ? 'Cerrar' : '¿No cuadra con tu plataforma? Calcularla'}</button>
          {open && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Balance antes de este archivo ($)</label>
                  <input type="number" value={before} onChange={e => setBefore(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Balance después, en la plataforma ($)</label>
                  <input type="number" placeholder="49574" value={after} onChange={e => setAfter(e.target.value)} />
                </div>
              </div>
              {after !== '' && (calc ? (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span>
                    Comisión real: <strong style={{ color: 'var(--text)' }}>${calc.perContract}/contrato</strong>
                    {' '}(${calc.totalFees} en {calc.contracts} contratos)
                  </span>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={calc.perContract === commission}
                    onClick={() => onApply(calc.perContract)}>
                    {calc.perContract === commission ? 'Ya aplicada' : 'Usar en esta cuenta'}
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 8, color: 'var(--red)' }}>
                  No sale una comisión razonable: revisá el balance de antes (tiene que ser el de la plataforma justo antes de estos trades).
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function AccountImportCsvModal({ account, onClose }) {
  const trades   = useStore(s => s.trades)
  const addTrade = useStore(s => s.addTrade)
  const updateAccount = useStore(s => s.updateAccount)
  const updateTrade = useStore(s => s.updateTrade)
  const tier              = useTier()
  const canImportCsvNow   = useCanImportCsvNow()
  const incrementCsvImport = useIncrementCsvImport()
  const learnFormat      = useImportFormatsStore(s => s.learnFormat)
  const getLearnedFormat = useImportFormatsStore(s => s.getLearnedFormat)

  // ── Config de riesgo (idéntico a siempre) ──
  const [rMode,         setRMode]         = useState('simple')
  const [rRiskConstant, setRRiskConstant] = useState(() => initialRiskConstant(account))
  const [rBalance,      setRBalance]      = useState('')
  const [rRiskPct,      setRRiskPct]      = useState(0.55)
  const [defaultSymbol, setDefaultSymbol] = useState('')
  const [msg,           setMsg]           = useState(null)
  const fileInputRef = useRef(null)
  // Comisión por contrato en uso (la de la cuenta, o la calculada con
  // el balance real de la plataforma — ver CommissionCheck)
  const [commission, setCommission] = useState(() => parseFloat(account?.commissionPerContract) || 0)
  const lastParse = useRef(null)   // { text, formatInfo } | { text, mapping } — para recalcular

  // ── Máquina de pasos del motor de importación ──
  // 'config' → 'wizard' (si no se reconoce el formato) → 'preview' → (importado)
  const [step,          setStep]          = useState('config')
  const [pendingHeaders, setPendingHeaders] = useState([])
  const [pendingText,    setPendingText]    = useState('')
  const [result,         setResult]         = useState(null) // { trades, format, label, count, duplicates, openIgnored }

  const buildROptions = () => {
    const accountRisk   = account?.riskPerTrade
    const effectiveRisk = accountRisk
      ? accountRisk
      : (parseFloat(rRiskConstant) || DEFAULT_RISK_CONSTANT)
    return {
      accountId:      account.id,
      mode:           rMode,
      riskConstant:   effectiveRisk,
      balance:        parseFloat(rBalance) || 0,
      riskPct:         parseFloat(rRiskPct) || 0.55,
      commissionPerContract: commission, // se resta al PnL de cada trade
      existingTrades: trades,   // ← para deduplicación (misma lógica de siempre)
      existingWithdrawals: account.withdrawals || [], // retiros del reporte MT5 que ya están en la cuenta
      defaultSymbol:  defaultSymbol.trim() || undefined, // solo lo usan formatos sin columna de símbolo (ej. TradingView)
    }
  }

  const handleImportClick = () => { setMsg(null); fileInputRef.current?.click() }

  const runParse = (text, formatInfo, override) => {
    lastParse.current = { text, formatInfo }
    const options = { ...buildROptions(), ...override }
    const parsed = parseCSV(text, { ...options, __knownFormat: formatInfo?.format })
    setResult(parsed)
    setStep('preview')
  }

  const runParseWithMapping = (text, mapping, override) => {
    lastParse.current = { text, mapping }
    const options = { ...buildROptions(), ...override }
    const parsed = parseCSVWithMapping(text, mapping, options)
    setResult(parsed)
    setStep('preview')
  }

  // Paso 1: seleccionar archivo → reconocimiento automático
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/\.(csv|html?|pdf)$/i.test(file.name)) { setMsg({ type: 'error', text: 'El archivo debe ser un .csv, el reporte .html de MetaTrader o el account statement .pdf' }); e.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        let text
        if (isPdfBuffer(ev.target.result)) {
          // Account statement en PDF (TradeLocker): se convierte a CSV
          text = await readPdfStatement(ev.target.result)
          if (!text) {
            setMsg({ type: 'error', title: 'PDF no reconocido',
              text: 'No encontramos la tabla de operaciones (Transactions) en este PDF. Por ahora se lee el "Account statement" de TradeLocker.' })
            return
          }
        } else {
          text = decodeFileBuffer(ev.target.result)
        }
        // Export sin operaciones (Tradovate exporta el archivo vacío si
        // en ese periodo no hubo trades): avisar en vez de abrir el
        // asistente de mapeo como si fuera un formato desconocido.
        const dataLines = String(text || '').split(/\r?\n/).filter(l => l.trim())
        if (dataLines.length < 2) {
          setMsg({ type: 'error', title: 'Archivo sin operaciones',
            text: 'Este CSV está vacío: no hay operaciones en ese periodo, así que no hay nada que importar.' })
          return
        }
        const analysis = analyzeCSV(text)

        if (analysis.confident) {
          runParse(text, analysis)
          return
        }

        // No reconocido por detección automática → ¿lo aprendimos antes?
        const signature = headerSignatureHash(analysis.headers)
        const learned    = getLearnedFormat(signature)
        if (learned) {
          runParseWithMapping(text, learned.mapping)
          return
        }

        // Nunca visto: mostrar el asistente de mapeo manual
        setPendingText(text)
        setPendingHeaders(analysis.headers)
        setStep('wizard')
      } catch (err) {
        setMsg({ type: 'error', text: `Error: ${err.message}` })
      }
    }
    reader.onerror = () => setMsg({ type: 'error', text: 'No se pudo leer el archivo' })
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  // Paso 2 (solo si hizo falta): el usuario confirma el mapeo manual
  const handleWizardConfirm = (mapping) => {
    const signature = headerSignatureHash(pendingHeaders)
    learnFormat(signature, mapping, 'Formato personalizado')
    runParseWithMapping(pendingText, mapping)
  }

  const handleWizardCancel = () => {
    setStep('config')
    setPendingText('')
    setPendingHeaders([])
  }

  // Paso 3: confirmar la vista previa → esto es lo único que escribe
  // trades en el store (nada se importa antes de este clic)
  const handleConfirmImport = async () => {
    if (!result) return
    if (result.count > 0 && !canImportCsvNow(result.count)) {
      setMsg({
        type: 'error',
        text: `Tu plan permite importar ${csvTradesLimitFor(tier)} trades por CSV en total y este archivo tiene ${result.count}. Actualiza a Intermedio para importar sin límites.`,
      })
      return
    }
    result.trades.forEach(t => addTrade(t))
    if (result.count > 0) await incrementCsvImport(result.count)
    // Retiros del reporte (MT5): se suman a los de la pestaña "Retiros"
    // de la cuenta, que es lo que descuenta el balance
    const newWithdrawals = result.withdrawals || []
    if (newWithdrawals.length > 0) {
      updateAccount(account.id, { withdrawals: [...(account.withdrawals || []), ...newWithdrawals] })
    }
    const dupMsg  = result.duplicates  > 0 ? ` · ${result.duplicates} duplicados ignorados` : ''
    const openMsg = result.openIgnored > 0 ? ` · ${result.openIgnored} operaciones abiertas ignoradas` : ''
    const errMsg  = result.rowErrors?.length > 0 ? ` · ${result.rowErrors.length} filas descartadas por error` : ''
    // Trades ya importados sin fecha y hora completas: se completan
    const backfill = result.backfill || []
    backfill.forEach(b => updateTrade(b.id, b.patch))
    const wdMsg   = newWithdrawals.length > 0 ? ` · ${withdrawalsLabel(newWithdrawals)} guardados en Retiros` : ''
    const bfMsg   = backfill.length > 0 ? ` · ${backfill.length} trades ya importados completados con la hora de cierre` : ''
    setMsg({ type: 'success', count: result.count, text: `Formato ${result.label}${dupMsg}${openMsg}${errMsg}${wdMsg}${bfMsg}` })
    setResult(null)
    setStep('config')
  }

  // Aplica la comisión calculada: se guarda en la cuenta (vale para
  // los próximos CSV) y se rehace la vista previa con ella
  const applyCommission = (perContract) => {
    setCommission(perContract)
    updateAccount(account.id, { commissionPerContract: perContract })
    const lp = lastParse.current
    if (!lp) return
    const override = { commissionPerContract: perContract }
    if (lp.mapping) runParseWithMapping(lp.text, lp.mapping, override)
    else runParse(lp.text, lp.formatInfo, override)
  }

  // Balance de la cuenta en la app antes de este archivo
  const appBalance = (Number(account.size) || 0) +
    sumTradeDollars(trades.filter(t => t.accountId === account.id), account.riskPerTrade) -
    totalWithdrawn(account)

  const handleBackToConfig = () => { setResult(null); setStep('config') }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)', padding: 20,
      }}
      onClick={onClose}
    >
      {/* whiteSpace normal: desde la vista Tabla el modal vive dentro de una
          celda con nowrap y lo heredaba (el texto se salía del bloque) */}
      <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', whiteSpace: 'normal' }} onClick={e => e.stopPropagation()}>

        {/* Título con ícono — mismo encabezado que "Cargá tu cuenta" */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <span aria-hidden="true" style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--brand2)', color: 'var(--brand)',
          }}><Upload size={18} /></span>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
            Importar CSV
          </div>
        </div>

        {/* Cuenta fija en su propia franja, separada del título — mismo
            criterio que la franja de pasos de "Cargá tu cuenta" (borde a
            borde del modal: el margen negativo compensa el padding de .card) */}
        <div style={{
          margin: '0 -26px 18px', padding: '11px 26px',
          background: 'var(--bg-panel2, var(--bg3))',
          borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
          fontSize: 14, fontWeight: 500, color: 'var(--text)',
        }}>
          {account.firm}
          <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--text2)' }}> · {account.type} · ${Number(account.size).toLocaleString()}</span>
        </div>

        {/* Cuenta fija — no hay selector, viene determinada por la tarjeta, en todos los pasos.
            Ahora va como subtítulo del encabezado; la caja vieja queda comentada:
            <div style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 14,
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            fontSize: 12, color: 'var(--text2)',
            }}>
            Cuenta: <strong style={{ color: 'var(--text)' }}>{account.firm} · {account.type} · ${Number(account.size).toLocaleString()}</strong>
            </div>
        */}

        {/* ── PASO 1: config de riesgo + selector de archivo ── */}
        {step === 'config' && (
          <>
            {/* Reemplazado por el título con ícono de arriba */}
            {/* <div className="card-title">Importar CSV</div> */}
            <input ref={fileInputRef} type="file" accept=".csv,.html,.htm,.pdf" style={{ display: 'none' }} onChange={handleFileChange} />

            {account?.riskPerTrade ? (
              // Texto suelto con ícono, sin caja: es un dato fijo, no un campo
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12, color: 'var(--text2)' }}>
                <Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} />
                <span>Riesgo de la cuenta: <strong style={{ color: 'var(--text)' }}>${account.riskPerTrade}/trade</strong> · R = PnL ÷ ${account.riskPerTrade}</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontWeight: 500 }}>Cálculo de R · R = PnL$ ÷ riesgo por trade</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[['simple', '$ Fijo por trade'], ['account', '% del balance']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setRMode(v)} style={{
                      padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)',
                      border: `1px solid ${rMode === v ? 'var(--brand)' : 'var(--border2)'}`,
                      background: rMode === v ? 'var(--bg2)' : 'transparent',
                      color: rMode === v ? 'var(--text)' : 'var(--text2)',
                    }}>{l}</button>
                  ))}
                </div>
                {rMode === 'simple' && (
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label>Riesgo fijo por trade ($)</label>
                    <input type="number" placeholder={DEFAULT_RISK_CONSTANT} value={rRiskConstant} onChange={e => setRRiskConstant(e.target.value)} />
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                      R = PnL$ ÷ ${rRiskConstant}
                    </div>
                  </div>
                )}
                {rMode === 'account' && (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label>Balance ($)</label>
                      <input type="number" placeholder="100000" value={rBalance} onChange={e => setRBalance(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ width: 110, marginBottom: 0 }}>
                      <label>Riesgo (%)</label>
                      <input type="number" placeholder="0.55" step="0.05" value={rRiskPct} onChange={e => setRRiskPct(e.target.value)} />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Símbolo (opcional)</label>
              <input type="text" placeholder="ej. BTCUSD, MNQ, EURUSD…" value={defaultSymbol} onChange={e => setDefaultSymbol(e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                Solo hace falta si tu CSV no incluye el instrumento (ej. exports de TradingView).
              </div>
            </div>

            {msg && <ImportMessage msg={msg} />}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleImportClick}>Seleccionar archivo .csv →</button>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>{msg?.type === 'success' ? 'Cerrar' : 'Cancelar'}</button>
            </div>
          </>
        )}

        {/* ── PASO 2 (solo si el formato no se reconoció): asistente de mapeo ── */}
        {step === 'wizard' && (
          <ColumnMappingWizard
            headers={pendingHeaders}
            onConfirm={handleWizardConfirm}
            onCancel={handleWizardCancel}
          />
        )}

        {/* ── PASO 3: vista previa antes de confirmar ── */}
        {step === 'preview' && result && (
          <>
            <div className="card-title">Vista previa</div>

            <div style={INFO_BOX}>
              Formato detectado: <strong style={{ color: 'var(--text)' }}>{result.label}</strong>
              {' · '}
              <strong style={{
                color: result.confidence > 80 ? 'var(--brand)' : result.confidence >= 60 ? 'var(--amber)' : 'var(--red)',
              }}>
                {result.confidence}% confianza
              </strong>
            </div>

            {result.confidence < 60 && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 11, color: 'var(--red)',
                background: 'var(--red2)', border: '1px solid rgba(255,90,106,0.2)',
              }}>
                Confianza baja — revisa que las columnas se hayan interpretado bien antes de importar. Si no es correcto, usa "Atrás" y vuelve a intentarlo: el asistente de mapeo manual se activa automáticamente si el formato no se reconoce con seguridad.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase' }}>Trades a importar</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700 }}>{result.count}</div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase' }}>Duplicados ignorados</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700 }}>{result.duplicates}</div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase' }}>Operaciones abiertas ignoradas</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700 }}>{result.openIgnored}</div>
              </div>
            </div>

            {result.withdrawals?.length > 0 && (
              <div style={INFO_BOX}>
                Se encontraron <strong style={{ color: 'var(--text)' }}>{withdrawalsLabel(result.withdrawals)}</strong> en
                el reporte. Se guardan en Retiros de la cuenta y se descuentan del balance.
              </div>
            )}

            {result.backfill?.length > 0 && (
              <div style={INFO_BOX}>
                <strong style={{ color: 'var(--text)' }}>{result.backfill.length} trades ya importados</strong> se
                completan con la fecha y hora exactas de cierre, para juntar sus cierres parciales en operaciones completas.
              </div>
            )}

            {result.count === 0 && (result.withdrawals?.length > 0 || result.backfill?.length > 0) ? null : result.count === 0 ? (
              <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12,
                background: 'var(--red2)', border: '1px solid rgba(227,114,114,0.2)', color: 'var(--red)' }}>
                {result.duplicates > 0
                  ? 'Todos los trades de este archivo ya estaban importados en esta cuenta.'
                  : 'No se ha reconocido ningún trade nuevo en este archivo.'}
              </div>
            ) : (
              <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 14, border: '1px solid var(--border2)', borderRadius: 8 }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)', position: 'sticky', top: 0 }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Fecha</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Par</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Dir.</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>PnL $</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0, 50).map(t => (
                      <tr key={t.id} style={{ borderTop: '1px solid var(--border2)' }}>
                        <td style={{ padding: '5px 8px', fontFamily: 'var(--mono)' }}>{t.date}</td>
                        <td style={{ padding: '5px 8px' }}>{t.pair}</td>
                        <td style={{ padding: '5px 8px' }}>{t.direction}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: t.dollarPnl >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                          {t.dollarPnl >= 0 ? '+' : ''}{t.dollarPnl}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: t.rPnl >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                          {t.rPnl >= 0 ? '+' : ''}{t.rPnl}R
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.trades.length > 50 && (
                  <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                    …y {result.trades.length - 50} más
                  </div>
                )}
              </div>
            )}

            {result.count > 0 && (
              <CommissionCheck trades={result.trades} commission={commission}
                defaultBefore={appBalance} onApply={applyCommission} />
            )}

            {/* Mismo aviso que en el paso inicial: antes un error al
                confirmar (p. ej. límite del plan) se guardaba pero no se
                pintaba aquí, y el botón parecía no hacer nada. */}
            {msg && <ImportMessage msg={msg} />}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={result.count === 0 && !(result.withdrawals?.length > 0) && !(result.backfill?.length > 0)} onClick={handleConfirmImport}>
                {result.count > 0
                  ? `Importar ${result.count} trade${result.count !== 1 ? 's' : ''} →`
                  : result.withdrawals?.length > 0 && !(result.backfill?.length > 0)
                    ? `Guardar ${result.withdrawals.length} retiro${result.withdrawals.length !== 1 ? 's' : ''} →`
                    : 'Actualizar la cuenta →'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleBackToConfig}>Atrás</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
