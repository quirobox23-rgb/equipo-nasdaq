import { conBase } from '@/lib/base'
interface Props {
  /** 'lg' = tamaño Landing (hero). 'sm' = tamaño topbar/footer, igual proporción que el logo de Entropia Analytics en su sidebar. */
  size?: 'sm' | 'lg'
}

// Logo de Entropia (public/entropia-logo*.png): blanco en oscuro, grafito en claro.
export function Logo({ size = 'sm' }: Props) {
  const alto = size === 'lg' ? 'h-12' : 'h-[22px]'
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={conBase("/entropia-logo.png")} alt="entropia" className={`${alto} w-auto logo-oscuro`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={conBase("/entropia-logo-oscuro.png")} alt="entropia" className={`${alto} w-auto logo-claro`} />
      <span className={`${size === 'lg' ? 'text-[15px]' : 'text-[10.5px]'} font-display font-semibold uppercase tracking-[0.18em] text-accent border-l border-base-line pl-3`}>Contexto</span>
    </div>
  )
}
