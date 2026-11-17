import { useState } from 'react'
import { useTier } from '@/store/useStore'
import { TIER_LABELS, TIERS } from '@/config/features'
import TesterActivation from './TesterActivation'

// ─────────────────────────────────────────────
//  TIER BADGE
//
//  Pill pequeño con el tier actual del usuario (useStore: tier).
//  Siempre gris neutro, sin importar el tier — el nivel de cuenta
//  no es un resultado ni una acción de marca.
//
//  Clicable: abre el modal de activación de código de tester.
// ─────────────────────────────────────────────

const STYLE_BY_BASE_TIER = {
  [TIERS.FREE]:       { color: 'var(--text2)', background: 'var(--bg4)', border: '1px solid var(--border)' },
  [TIERS.INTERMEDIO]: { color: 'var(--text2)', background: 'var(--bg4)', border: '1px solid var(--border)' },
  [TIERS.PRO]:        { color: 'var(--text2)', background: 'var(--bg4)', border: '1px solid var(--border)' },
}

function baseTierOf(tier) {
  if (tier === 'tester-free') return TIERS.FREE
  if (tier === 'tester-intermedio') return TIERS.INTERMEDIO
  if (tier === 'tester-pro') return TIERS.PRO
  return tier
}

export default function TierBadge({ style }) {
  const tier = useTier()
  const [showActivation, setShowActivation] = useState(false)
  const s = STYLE_BY_BASE_TIER[baseTierOf(tier)] || STYLE_BY_BASE_TIER[TIERS.FREE]

  return (
    <>
      <span
        onClick={() => setShowActivation(true)}
        title="Activar acceso de tester"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
          fontSize: 12, fontFamily: 'var(--mono)', letterSpacing: '0.5px', textTransform: 'uppercase',
          padding: '2px 8px', borderRadius: 4,
          ...s,
          ...style,
        }}
      >
        {TIER_LABELS[tier] || tier}
      </span>
      {showActivation && <TesterActivation onClose={() => setShowActivation(false)} />}
    </>
  )
}
