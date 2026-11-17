'use client'
import { useId, type ComponentType } from 'react'

// IconDisplay — ícono grande, sin fondo, trazo grueso con gradiente de
// marca. Nivel "4. Icon display" del design system de Entropia Analytics
// (homologado 2026-09-21). Uso: bloques de feature/marketing (landing,
// onboarding), nunca UI de producto — para eso están IconCircle / las
// clases de color de Tailwind (text-brand, text-pos, etc.).
interface Props {
  icon: ComponentType<{ size?: number; strokeWidth?: number; stroke?: string }>
  size?: number
  strokeWidth?: number
}

export function IconDisplay({ icon: Icon, size = 72, strokeWidth = 1.8 }: Props) {
  const gradientId = useId()
  return (
    <span className="inline-flex">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="#1E40AF" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
      <Icon size={size} strokeWidth={strokeWidth} stroke={`url(#${gradientId})`} />
    </span>
  )
}
