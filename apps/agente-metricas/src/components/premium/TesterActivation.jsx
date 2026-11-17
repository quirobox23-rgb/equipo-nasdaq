import { useState } from 'react'
import { useTier, useActivateTester } from '@/store/useStore'
import { TIER_LABELS, isTesterRole } from '@/config/features'

// NOTA: activateTester() ahora es async — el código se valida
// server-side (ver supabase/schema.sql → activate_tester_code()),
// ya no contra una lista hardcodeada en el bundle.

// ─────────────────────────────────────────────
//  TESTER ACTIVATION
//
//  Modal para introducir un código de tester. Cada código activa un
//  rol tester-X concreto (tester-free/tester-intermedio/tester-pro)
//  que simula EXACTAMENTE la experiencia de ese tier — no un "ver
//  todo desbloqueado" universal.
//
//  Antes: si ya eras tester de algo, el input para escribir un
//  código desaparecía por completo — no había forma de cambiar a
//  otro rol de tester sin ir a la base de datos a mano. Ahora el
//  input SIEMPRE está disponible (con el estado actual mostrado
//  encima, si lo hay), así se puede reactivar con un código
//  distinto en cualquier momento.
//
//  Se abre haciendo clic en el TierBadge de la barra lateral (no hay
//  página de Settings en la app todavía).
// ─────────────────────────────────────────────
export default function TesterActivation({ onClose }) {
  const tier = useTier()
  const activateTester = useActivateTester()
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null) // 'ok' | 'error' | null
  const [activating, setActivating] = useState(false)

  const isTester = isTesterRole(tier)

  const handleActivate = async () => {
    setActivating(true)
    const ok = await activateTester(code.trim())
    setActivating(false)
    setResult(ok ? 'ok' : 'error')
    if (ok) setCode('')
  }

  return (
    <div
      style={{
        position: 'fixed', whiteSpace: 'normal', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)', padding: 20,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="card-title">Acceso Tester</div>

        {isTester && (
          <div style={{
            fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 16,
            padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)',
          }}>
            <div>Rol actual: <strong style={{ color: 'var(--text)' }}>{TIER_LABELS[tier]}</strong></div>
            <div style={{ marginTop: 4, color: 'var(--text3)', fontSize: 11.5 }}>
              Simula exactamente la experiencia del plan {TIER_LABELS[tier].split('· ')[1]} — mismos límites, mismas features.
            </div>
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>
          {isTester
            ? '¿Quieres probar otro plan? Introduce un código distinto para cambiar de rol.'
            : 'Introduce tu código de acceso de prueba. Cada código simula un plan concreto (Free, Intermedio o Pro), sin pagar.'}
        </p>
        <div className="form-group">
          <label>Código de tester</label>
          <input
            type="text" value={code} onChange={e => { setCode(e.target.value); setResult(null) }}
            style={{ fontFamily: 'var(--mono)', textTransform: 'uppercase' }}
          />
        </div>
        {result === 'ok' && (
          <div style={{ fontSize: 12, color: 'var(--brand)', background: 'var(--brand2)', border: '1px solid var(--brand)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            Acceso Tester activado. Tienes acceso completo a todas las funcionalidades.
          </div>
        )}
        {result === 'error' && (
          <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red2)', border: '1px solid var(--red)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            Código no válido. Contacta al administrador.
          </div>
        )}
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleActivate} disabled={activating || !code.trim()}>
          {activating ? 'Activando…' : isTester ? 'Cambiar código' : 'Activar acceso de prueba'}
        </button>

        <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 10 }} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}