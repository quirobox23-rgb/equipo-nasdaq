'use client'
import { useState, useEffect } from 'react'
import { useClock } from '@/hooks/useClock'

// Layout apilado — pensado para el pie del Sidebar (columna angosta),
// no para una barra horizontal como antes en el topbar.
export function Clock() {
  const [mounted, setMounted] = useState(false)
  const { utcString, etString, sessionLabel, sessionColor } = useClock()

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-xs text-base-muted/50">——:——:—— UTC</span>
      <span className="font-mono text-xs text-base-muted/50">——:—— ET</span>
      <span className="inline-flex w-fit text-[10px] px-2 py-0.5 rounded-full border border-base-line text-base-muted/50">
        —
      </span>
    </div>
  )

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-xs text-base-muted">{utcString}</span>
      <span className="font-mono text-xs text-base-text/80">{etString}</span>
      <span className={`inline-flex w-fit text-[10px] font-medium px-2 py-0.5 rounded-full border border-base-line ${sessionColor}`}>
        {sessionLabel}
      </span>
    </div>
  )
}
