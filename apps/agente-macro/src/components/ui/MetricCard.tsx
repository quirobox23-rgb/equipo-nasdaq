import type { ReactNode } from 'react'
import { IconCircle, type IconCircleColor } from './IconCircle'
import { Sparkline } from './Sparkline'

// MetricCard — "Card destacada" (sección 4): label+valor+delta+ícono
// opcional. El label es deliberadamente más chico que card-title — acá el
// protagonista es el valor, no el título. size="hero" escala el valor a
// 27px (usado para los 3-4 KPIs principales de un dashboard). spark es
// opcional: una mini-línea de tendencia (últimos N valores), pintada al
// lado del delta.
interface Props {
  label: string
  value: ReactNode
  delta?: ReactNode
  deltaUp?: boolean
  size?: 'hero'
  icon?: ReactNode
  iconColor?: IconCircleColor
  spark?: number[]
  className?: string
}

export function MetricCard({ label, value, delta, deltaUp, size, icon, iconColor, spark, className = '' }: Props) {
  const deltaClass = deltaUp === true ? 'up' : deltaUp === false ? 'down' : 'muted'
  return (
    <div className={`${size === 'hero' ? 'metric-hero' : 'metric'} ${className}`}>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <div className="metric-label">{label}</div>
          <div className={`metric-value ${deltaUp === true ? 'up' : deltaUp === false ? 'down' : ''}`}>{value}</div>
        </div>
        {icon && <IconCircle color={iconColor ?? (deltaUp === false ? 'neg' : 'pos')} size={30}>{icon}</IconCircle>}
      </div>
      {(delta || spark) && (
        <div className="flex items-end justify-between gap-2 mt-1.5 min-h-[26px]">
          {delta && <div className={`metric-delta !mt-0 ${deltaClass}`}>{delta}</div>}
          {spark && <Sparkline data={spark} color={deltaUp === false ? '#ed553b' : '#5aa469'} />}
        </div>
      )}
    </div>
  )
}
