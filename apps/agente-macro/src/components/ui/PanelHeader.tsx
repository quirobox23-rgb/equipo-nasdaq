import type { ReactNode } from 'react'

// Cabecera de bloque (rediseño Volatilidad / Eventos): título sobrio a la
// izquierda y aclaración (fuente, unidad o un badge) a la derecha, sobre el
// gris claro — mismo tono que el encabezado de los días del calendario.
// Va como primer hijo de una .card.
export function PanelHeader({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-t-lg border-b border-base-line bg-base-panel2 px-4 py-3">
      <h2 className="font-display text-sm font-semibold text-base-text">
        {title}
        {subtitle && <span className="ml-1.5 font-body text-[12.5px] font-normal text-base-faint">· {subtitle}</span>}
      </h2>
      {aside && <span className="shrink-0 text-[11.5px] text-base-faint">{aside}</span>}
    </div>
  )
}
