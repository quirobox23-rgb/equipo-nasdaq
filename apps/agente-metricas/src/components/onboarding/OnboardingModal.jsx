import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, PenLine } from 'lucide-react'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { useStore, useTrades, useAccounts } from '@/store/useStore'
import { useAccountBlueprintStore } from '@/store/useAccountBlueprintStore'
import { ACCOUNT_TYPES } from '@/data/mockData'
import { BLUEPRINTS_DATA } from '@/data/blueprintsData'
import AccountImportCsvModal from '@/components/import/AccountImportCsvModal'
import OnboardingStep from './OnboardingStep'

// ─────────────────────────────────────────────
//  ONBOARDING MODAL — 3 pasos
//
//  Reutiliza tal cual lo que ya existe — nada de esto es lógica
//  nueva de negocio, solo un flujo guiado por encima:
//    Paso 1 → addAccount()            (useStore, igual que Portfolio)
//    Paso 2 → AccountImportCsvModal   (el mismo de Portfolio) o
//             navegar a /historial y esperar reactivamente a que
//             trades.length > 0
//    Paso 3 → assignBlueprint()       (useAccountBlueprintStore)
//
//  El modal vive montado a nivel de App (junto a SessionReviewModal)
//  y reacciona a los datos reales del store — no bloquea nunca la
//  navegación: se puede minimizar/cerrar y seguir explorando la app.
// ─────────────────────────────────────────────

const TOTAL_STEPS = 3

const FEATURED_BLUEPRINT_IDS = ['consistent-futures', 'ict-intraday', 'swing-momentum']

function useStepEnterAnimation(step) {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    setEntered(false)
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [step])
  return entered
}

export default function OnboardingModal() {
  const navigate = useNavigate()
  const { open, active, step, minimize, close, reopenAt, setStep } = useOnboardingStore()

  const trades       = useTrades()
  const accounts     = useAccounts()
  const addAccount   = useStore(s => s.addAccount)
  const assignBlueprint = useAccountBlueprintStore(s => s.assignBlueprint)

  const [accountForm, setAccountForm]       = useState({ firm: '', type: 'Challenge', size: '' })
  const [accountFormError, setAccountFormError] = useState('')
  const [createdAccountId, setCreatedAccountId] = useState(null)
  const [showImportModal, setShowImportModal]   = useState(false)
  const [selectedBlueprintId, setSelectedBlueprintId] = useState(null)

  const entered = useStepEnterAnimation(step)

  // Si el usuario minimizó el onboarding para añadir un trade a mano
  // desde /historial, reabrir automáticamente en el paso 3 en cuanto
  // haya al menos un trade — sin que tenga que volver manualmente.
  useEffect(() => {
    if (active && !open && step === 2 && trades.length > 0) {
      reopenAt(3)
    }
  }, [trades.length, active, open, step])

  if (!open) return null

  const createdAccount = accounts.find(a => a.id === createdAccountId)

  const handleCreateAccount = () => {
    if (!accountForm.firm.trim()) { setAccountFormError('Ponle un nombre a la cuenta (firma, broker o "Personal")'); return }
    if (!accountForm.size || parseFloat(accountForm.size) <= 0) { setAccountFormError('Introduce un capital válido'); return }
    setAccountFormError('')

    addAccount({
      firm: accountForm.firm,
      type: accountForm.type,
      phase: 'Phase 1',
      size: parseFloat(accountForm.size),
      currency: 'USD',
      profitTarget: null,
      maxDrawdown: 10,
      maxDailyDD: 5,
      currentProfit: 0,
      currentDD: 0,
      status: 'active',
      startDate: new Date().toISOString().split('T')[0],
      riskPerTrade: 550,
      consistencyRules: { enabled: false, maxDailyPercent: 40, maxTradePercent: 20, maxDailyProfit: '', maxProfitPerTrade: '' },
      accountCost: 0, activationCost: 0, purchaseDate: '', activationDate: '', withdrawals: [],
    })

    // addAccount no devuelve el id creado — se lee del store justo
    // después (se acaba de añadir al final del array).
    const updated = useStore.getState().accounts
    const newAccount = updated[updated.length - 1]
    setCreatedAccountId(newAccount.id)
    setStep(2)
  }

  const handleSkipAccount = () => setStep(2)

  const handleGoManual = () => {
    minimize()
    navigate('/historial')
  }

  const handleSelectBlueprint = (blueprintId) => {
    setSelectedBlueprintId(blueprintId)
    if (createdAccountId) assignBlueprint(createdAccountId, blueprintId)
  }

  const handleFinish = () => {
    localStorage.setItem('nova-onboarding-completed', 'true')
    close()
    navigate('/mentor-ia')
  }

  const handleSkipAll = () => {
    localStorage.setItem('nova-onboarding-skipped-at', new Date().toISOString())
    close()
  }

  const featured = FEATURED_BLUEPRINT_IDS
    .map(id => BLUEPRINTS_DATA.find(b => b.id === id))
    .filter(Boolean)

  return (
    <div
      style={{
        position: 'fixed', whiteSpace: 'normal', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, backdropFilter: 'blur(4px)', padding: 20,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto',
          background: 'linear-gradient(180deg, rgba(59,130,246,0.04), rgba(255,255,255,0)), var(--bg2)',
          position: 'relative',
        }}
      >
        {/* Progreso — 3 pasos */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 22, marginRight: 28 }}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i < step ? 'var(--brand)' : 'var(--border2)',
              transition: 'background 250ms ease',
            }} />
          ))}
        </div>

        <button
          onClick={handleSkipAll}
          style={{
            position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none',
            color: 'var(--text3)', fontSize: 13, cursor: 'pointer', padding: 4,
          }}
          title="Cerrar y no volver a mostrar por 7 días"
        >✕</button>

        <div style={{
          transform: entered ? 'translateX(0)' : 'translateX(24px)',
          opacity: entered ? 1 : 0,
          transition: 'transform 300ms ease, opacity 300ms ease',
        }}>
          {/* ── PASO 1 ── */}
          {step === 1 && (
            <OnboardingStep
              stepNumber={1} totalSteps={TOTAL_STEPS}
              title="Configura tu cuenta"
              description="Añade tu primera cuenta de trading (prop firm, personal o broker) para empezar a registrar tu operativa."
            >
              <div className="form-group">
                <label>Firma / Nombre de la cuenta</label>
                <input type="text" placeholder="ej. FTMO, Apex, Cuenta Personal..." value={accountForm.firm}
                  onChange={e => setAccountForm(f => ({ ...f, firm: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <select value={accountForm.type} onChange={e => setAccountForm(f => ({ ...f, type: e.target.value }))}>
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Capital ($)</label>
                  <input type="number" placeholder="100000" value={accountForm.size}
                    onChange={e => setAccountForm(f => ({ ...f, size: e.target.value }))} />
                </div>
              </div>
              {accountFormError && <div style={{ fontSize: 11.5, color: 'var(--red)', marginBottom: 10 }}>{accountFormError}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                <button className="btn btn-primary" style={{ padding: '12px 20px', fontSize: 14, fontWeight: 700 }} onClick={handleCreateAccount}>Crear cuenta y continuar →</button>
                <button className="btn btn-ghost btn-sm" onClick={handleSkipAccount}>Ya tengo datos, importaré después</button>
              </div>
            </OnboardingStep>
          )}

          {/* ── PASO 2 ── */}
          {step === 2 && (
            <OnboardingStep
              stepNumber={2} totalSteps={TOTAL_STEPS}
              title="Importa tu historial"
              description="Sube un CSV de tu broker o añade trades manualmente — en cuanto tengas al menos una operación, seguimos."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '14px 18px', fontSize: 14, fontWeight: 600 }}
                  onClick={() => createdAccountId ? setShowImportModal(true) : navigate('/portafolio')}
                >
                  <UploadCloud size={16} /> {createdAccountId ? 'Importar CSV' : 'Crea primero una cuenta en Portfolio'}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '14px 18px', fontSize: 14, fontWeight: 600 }}
                  onClick={handleGoManual}
                >
                  <PenLine size={16} /> Añadir manualmente
                </button>
              </div>
              {trades.length > 0 && (
                <button className="btn btn-primary" style={{ marginTop: 16, width: '100%', padding: '12px 20px', fontSize: 14, fontWeight: 700 }} onClick={() => setStep(3)}>
                  Ya tengo trades — continuar →
                </button>
              )}
            </OnboardingStep>
          )}

          {/* ── PASO 3 ── */}
          {step === 3 && (
            <OnboardingStep
              stepNumber={3} totalSteps={TOTAL_STEPS}
              title="Encuentra tu mapa ideal"
              description="Elige un perfil de trader profesional y compara tus métricas frente a él."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                {featured.map(bp => (
                  <div
                    key={bp.id}
                    onClick={() => handleSelectBlueprint(bp.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      borderRadius: 'var(--r)', cursor: 'pointer',
                      background: selectedBlueprintId === bp.id ? 'rgba(59,130,246,0.08)' : 'var(--bg3)',
                      border: `1px solid ${selectedBlueprintId === bp.id ? 'var(--brand)' : 'var(--border)'}`,
                      transition: 'border-color 150ms, background 150ms',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: 'var(--bg4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <bp.icon size={18} style={{ color: 'var(--brand)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{bp.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{bp.trader}</div>
                    </div>
                    {selectedBlueprintId === bp.id && <span style={{ color: 'var(--brand)', fontSize: 14 }}>✓</span>}
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', padding: '12px 20px', fontSize: 14, fontWeight: 700 }} onClick={handleFinish}>
                Ver mi análisis →
              </button>
            </OnboardingStep>
          )}
        </div>
      </div>

      {showImportModal && createdAccount && (
        <AccountImportCsvModal account={createdAccount} onClose={() => setShowImportModal(false)} />
      )}
    </div>
  )
}
