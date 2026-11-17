import type { ReactNode } from 'react'

// Callout — banner de una fila (ícono + label + texto + CTA opcional)
// sobre degradé tenue. No es card. Ver sección 5 del design system.
export type CalloutColor = 'green' | 'amber' | 'red'

// Record literal, no `callout-${color}` — ver nota en ui/Button.tsx sobre
// por qué Tailwind necesita el nombre completo como texto literal.
const COLOR_CLASS: Record<CalloutColor, string> = {
  green: 'callout-green',
  amber: 'callout-amber',
  red: 'callout-red',
}

// El círculo del ícono siempre toma el tono del propio Callout — no un
// color elegido aparte por quien lo usa. bg-x/[0.16] en vez del token
// -dim (que es un hex fijo, no theme-aware) para que el tinte se vea bien
// tanto en dark como en light.
const ICON_CLASS: Record<CalloutColor, string> = {
  green: 'bg-brand/[0.16] text-brand',
  amber: 'bg-neutral/[0.16] text-neutral',
  red: 'bg-neg/[0.16] text-neg',
}

interface Props {
  color: CalloutColor
  icon: ReactNode
  label: string
  children: ReactNode
  cta?: ReactNode
}

export function Callout({ color, icon, label, children, cta }: Props) {
  return (
    <div className={`callout ${COLOR_CLASS[color]}`}>
      <div className={`flex items-center justify-center rounded-full shrink-0 w-11 h-11 ${ICON_CLASS[color]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-[220px]">
        <div className="callout-label">{label}</div>
        <div className="text-[13px] text-base-text leading-relaxed">{children}</div>
      </div>
      {cta}
    </div>
  )
}
