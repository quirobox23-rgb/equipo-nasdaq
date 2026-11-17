import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useHasFeature } from '@/store/useStore'
import { requiredTierFor, TIER_LABELS, TIER_PRICES, FEATURE_LABELS, FEATURE_UPSELL } from '@/config/features'
import PricingModal from '@/components/upgrade/PricingModal'
import { IconCircle } from '@/components/ui'

// ─────────────────────────────────────────────
//  PREMIUM GATE
//
//  Envuelve cualquier bloque de UI y decide si se muestra o si se
//  muestra un CTA de upgrade en su lugar, según el tier actual del
//  usuario (useStore: tier / setTier — ya existentes).
//
//  Reutiliza el sistema de features YA EXISTENTE en
//  config/features.js (TIERS, FEATURE_TIERS, hasFeature,
//  requiredTierFor) — no crea un sistema de tiers paralelo.
//
//  Props:
//    feature   — clave de FEATURE_TIERS (ej. 'iaMentorPersonalizado')
//    children  — contenido a mostrar si el tier da acceso
//    fallback  — (opcional) UI custom si no hay acceso; si no se
//                pasa, se usa el CTA por defecto de aquí abajo
//
//  No implementa pagos reales: el botón "Actualizar" abre el
//  PricingModal (mismo componente que usan Portfolio/MetrixBasic),
//  donde el usuario compara los 3 planes antes de elegir — ya no
//  sube de tier directamente al hacer clic.
// ─────────────────────────────────────────────
export default function PremiumGate({ feature, children, fallback }) {
  const hasAccess = useHasFeature(feature)
  const [showPricing, setShowPricing] = useState(false)

  if (hasAccess) return children

  if (fallback) return fallback

  const requiredTier = requiredTierFor(feature)
  const title   = FEATURE_LABELS[feature] || feature
  const upsell  = FEATURE_UPSELL[feature] || { description: 'Función disponible en un plan superior.', bullets: [] }

  return (
    // page-inner — mismo padding que tendría la página real (ver
    // "Jerarquía de la información" en /styleguide): ese padding vive
    // dentro de los children que este return reemplaza, así que sin
    // esto el gate queda pegado al topbar en vez de respetar el
    // espaciado estándar de cualquier otra página.
    <div className="page-inner">
    <div style={{
      border: '1px solid var(--neg)',
      background: 'var(--bg2)',
      padding: 24,
      borderRadius: 'var(--r)',
      textAlign: 'center',
      maxWidth: 480,
      margin: '0 auto',
    }}>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
        <IconCircle icon={<Lock size={18} />} color="neg" size={40} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.5px', color: 'var(--text)', marginBottom: 6 }}>
        {title.toUpperCase()}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 420, margin: '0 auto 18px', lineHeight: 1.6 }}>
        {upsell.description}
      </p>
      {upsell.bullets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300, margin: '0 auto 20px' }}>
          {upsell.bullets.map(item => (
            <div key={item} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8,
              background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 12, color: 'var(--text3)',
            }}><Lock size={12} style={{ flexShrink: 0 }} /> {item}</div>
          ))}
        </div>
      )}
      <button className="btn btn-primary" onClick={() => setShowPricing(true)}>
        Actualizar a {TIER_LABELS[requiredTier]}
      </button>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
        ${TIER_PRICES[requiredTier]}/mes
      </div>

      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
    </div>
    </div>
  )
}
