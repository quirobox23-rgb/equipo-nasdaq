import { useState } from 'react'
import { useTier } from '@/store/useStore'
import { TIERS, TIER_LABELS, TIER_PRICES, hasFeature } from '@/config/features'
import TesterActivation from '@/components/premium/TesterActivation'

// ─────────────────────────────────────────────
//  PRICING MODAL
//
//  Compara los 3 planes reales (Free/Intermedio/Pro) usando
//  hasFeature() tal cual — la misma función que gatea el resto de
//  la app, así la tabla de comparación nunca puede desincronizarse
//  de lo que realmente está desbloqueado en cada tier.
//
//  Pendiente de integración de pagos (Stripe): "Elegir" ya NO cambia
//  el tier directamente desde el cliente (eso era la brecha de
//  seguridad — cualquiera podía auto-subirse de plan). Mientras no
//  haya checkout real, el único camino para probar un plan de pago
//  es un código de tester válido, verificado server-side.
// ─────────────────────────────────────────────

const PLAN_FEATURES = [
  { key: 'iaMentorInsights',      label: 'Mentor IA — resumen ejecutivo' },
  { key: 'iaMentorDiagnostico',   label: 'Mentor IA — diagnóstico completo' },
  { key: 'consistency',           label: 'Consistency Control' },
  { key: 'traderScore',           label: 'Puntaje del Trader' },
  { key: 'businessRoi',           label: 'Inversión y retiros' },
  { key: 'metrixAnalytics',       label: 'Métricas Intermedio' },
  { key: 'monteCarlo',            label: 'Monte Carlo · Kelly' },
  { key: 'exportData',            label: 'Exportar CSV / Backup' },
  { key: 'metrixLab',             label: 'Métricas Avanzado' },
  { key: 'iaMentorPersonalizado', label: 'Mentor IA Elite Performance' },
]

const TIER_TAGLINES = {
  [TIERS.FREE]:       'Prueba NOVA.',
  [TIERS.INTERMEDIO]: 'Entiende y mejora tu trading.',
  [TIERS.PRO]:        'Lleva tu análisis a un nivel avanzado.',
}

const PLAN_LIMITS = {
  [TIERS.FREE]:       ['5 cuentas', 'Mapa 1 y Mapa 3 + comparación', 'CSV ilimitado', 'Trades ilimitados'],
  [TIERS.INTERMEDIO]: ['Cuentas ilimitadas', '5 Mapas', 'CSV ilimitado', 'Trades ilimitados', '4 Entrenamientos'],
  [TIERS.PRO]:        ['Cuentas ilimitadas', 'Mapas ilimitados', 'CSV ilimitado', 'Trades ilimitados', 'Entrenamientos ilimitados'],
}

const PLAN_ORDER = [TIERS.FREE, TIERS.INTERMEDIO, TIERS.PRO]

export default function PricingModal({ onClose }) {
  const tier = useTier()
  const currentBase = tier.startsWith('tester-') ? tier.replace('tester-', '') : tier
  const [showTesterActivation, setShowTesterActivation] = useState(false)

  return (
    <div
      style={{
        position: 'fixed', whiteSpace: 'normal', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)', padding: 20,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ width: '100%', maxWidth: 820, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="card-title">Planes</div>

        <div className="grid-3" style={{ gap: 16 }}>
          {PLAN_ORDER.map(planTier => {
            const isCurrent = planTier === currentBase
            return (
              <div
                key={planTier}
                className="card-sm"
                style={{
                  display: 'flex', flexDirection: 'column', gap: 14, padding: 20,
                  border: isCurrent ? '2px solid var(--brand)' : '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{TIER_LABELS[planTier]}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{TIER_TAGLINES[planTier]}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>
                    ${TIER_PRICES[planTier]}
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)' }}>/mes</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {PLAN_LIMITS[planTier].map(l => (
                    <div key={l} style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 6 }}>
                      <span style={{ color: 'var(--brand)' }}>✓</span>{l}
                    </div>
                  ))}
                </div>

                {/* Solo se muestra lo que el plan SÍ incluye — nada de
                    listas con ✗ marcando lo que falta (eso es lo que
                    hacía sentir al Free "capado"). Lo que un plan no
                    trae, simplemente no aparece en su tarjeta. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {PLAN_FEATURES.filter(f => hasFeature(planTier, f.key)).map(f => {
                    return (
                      <div key={f.key} style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--brand)' }}>✓</span>
                        {f.label}
                      </div>
                    )
                  })}
                </div>

                <button
                  className={isCurrent ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                  disabled={isCurrent}
                  style={{ marginTop: 'auto' }}
                  onClick={() => setShowTesterActivation(true)}
                >
                  {isCurrent ? 'Actual' : 'Próximamente'}
                </button>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 14, textAlign: 'center' }}>
          Los pagos con tarjeta están en camino. Mientras tanto, si tenés un código de acceso de prueba podés activarlo.
        </div>

        <button className="btn btn-secondary btn-sm" style={{ marginTop: 18 }} onClick={onClose}>Cerrar</button>
      </div>
      {showTesterActivation && <TesterActivation onClose={() => setShowTesterActivation(false)} />}
    </div>
  )
}