'use client'
import { useEffect, useState } from 'react'
import { useClock } from '@/hooks/useClock'

// Fecha + hora UTC / ET + sesión de NY en una línea, para el topbar.
// Antes vivía apilado en el pie del Sidebar (Clock.tsx, que queda en el repo)
// y el topbar mostraba una cinta de titulares simulados (NewsTicker).
export function TopbarClock() {
  const [mounted, setMounted] = useState(false)
  const { dateString, utcString, etString, sessionLabel, sessionColor } = useClock()
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <span className="font-mono text-xs text-base-muted/50">——</span>

  return (
    <div className="flex items-center gap-3 whitespace-nowrap text-xs">
      <span className="font-display text-[13px] font-semibold text-base-text">{dateString}</span>
      <span className="h-3.5 w-px bg-base-line" />
      <span className="font-mono text-base-text/80">{etString}</span>
      <span className="font-mono text-base-muted max-md:hidden">{utcString}</span>
      <span className={`rounded-full border border-base-line px-2 py-0.5 text-[10px] font-medium ${sessionColor}`}>{sessionLabel}</span>
    </div>
  )
}
