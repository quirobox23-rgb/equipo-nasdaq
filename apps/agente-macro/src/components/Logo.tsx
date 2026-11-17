import type { SVGProps } from 'react'

// Ícono propio (sin librería) — mismo trazo fino que los de Sidebar.tsx.
function IconGlobe(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 2.2 2.8 15.8 0 18M12 3c-2.8 2.2-2.8 15.8 0 18" />
    </svg>
  )
}

interface Props {
  /** 'lg' = tamaño Landing (hero). 'sm' = tamaño topbar/footer, igual proporción que el logo de Agente Métricas en su sidebar. */
  size?: 'sm' | 'lg'
}

const SIZES = {
  sm: { box: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4', name: 'text-[15.5px]', role: 'text-[9px]' },
  lg: { box: 'w-16 h-16 rounded-2xl', icon: 'w-8 h-8', name: 'text-[28px]', role: 'text-[13px]' },
}

// Logomark compartido — mismo lockup en Landing (tamaño lg) y en la
// Navigation/topbar (tamaño sm, misma proporción que el logo de Factor
// Métricas en el footer de su sidebar).
export function Logo({ size = 'sm' }: Props) {
  const s = SIZES[size]
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${s.box} shrink-0 bg-gradient-to-br from-[#1E40AF] to-[#22D3EE] flex items-center justify-center`}>
        <IconGlobe className={`${s.icon} text-white`} />
      </div>
      <div>
        <div className={`font-display ${s.name} leading-tight tracking-wide`}>
          <span className="text-base-text font-medium">AGENTE</span>{' '}
          <span className="bg-gradient-to-br from-[#1E40AF] to-[#22D3EE] bg-clip-text text-transparent font-black">MACRO</span>
        </div>
        <div className={`${s.role} font-body text-base-faint uppercase tracking-[0.5px] leading-tight`}>Equipo Nasdaq</div>
      </div>
    </div>
  )
}
