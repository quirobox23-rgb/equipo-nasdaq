'use client'
import { useId } from 'react'

// ScoreGauge — gauge circular de progreso (arco). gradient=true usa
// siempre el degradé de marca fijo (uso: scores generales); color=
// usa semáforo por tier (uso: métricas de riesgo). Ver sección "Gráficas"
// del design system.
interface Props {
  value: number
  max?: number
  label?: string
  size?: number
  color?: string
  gradient?: boolean
  strokeWidth?: number
}

export function ScoreGauge({ value, max = 100, label = 'Puntuación', size = 96, color = '#1E40AF', gradient = false, strokeWidth = 8 }: Props) {
  const gradientId = useId()
  const pct = Math.max(0, Math.min(1, value / max))
  const r = (size - strokeWidth - 4) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - pct)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {gradient && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
        )}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(var(--base-line))" strokeWidth={strokeWidth} />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={gradient ? `url(#${gradientId})` : color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-[22px] font-bold text-base-text">{Math.round(value)}</div>
        <div className="text-xs text-base-faint uppercase tracking-wide mt-0.5">{label}</div>
      </div>
    </div>
  )
}
