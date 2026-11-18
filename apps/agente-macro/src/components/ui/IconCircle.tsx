import type { ReactNode } from 'react'

// IconCircle — círculo de fondo para íconos de feature/categoría, ver
// sección 5 de docs/design-system-factor-metricas.md. 'primary' es el
// default para navegación/feature genérico. El degradé de marca
// (--accent-gradient) queda reservado exclusivamente para el logo —
// nunca para esto.
//
// Nombres homologados con Entropia Analytics (2026-09-21): 'green' → 'primary',
// 'red' → 'neg', 'amber' → 'neutral', 'grey' → 'info'. 'pos' es nuevo —
// semáforo positivo (antes 'green-tint' usaba verde de marca por error,
// corregido a var(--pos) real). 'text' también nuevo — mismo tratamiento
// gris de fondo con ícono blanco, para casos sin color semántico.
// 'grey-dark' del spec original sigue sin uso (redundante con 'info').
export type IconCircleColor = 'primary' | 'text' | 'pos' | 'neg' | 'neutral' | 'info'

const COLOR_CLASSES: Record<IconCircleColor, string> = {
  primary: 'bg-base-line text-brand',
  text: 'bg-base-line text-base-text',
  pos: 'bg-pos-dim text-pos',
  neg: 'bg-neg-dim text-neg',
  neutral: 'bg-neutral-dim text-neutral',
  info: 'bg-base-line text-base-muted',
}

interface Props {
  color?: IconCircleColor
  /** Diámetro del círculo en px — el tamaño del ícono lo define quien lo pasa como children. */
  size?: number
  children: ReactNode
  className?: string
}

export function IconCircle({ color = 'primary', size = 36, children, className = '' }: Props) {
  return (
    <div
      className={`flex items-center justify-center rounded-full shrink-0 leading-none ${COLOR_CLASSES[color]} ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
    </div>
  )
}
