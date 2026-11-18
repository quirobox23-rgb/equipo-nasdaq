'use client'
import { Logo } from './Logo'
// NewsTicker (./home/NewsTicker) queda en el repo: mostraba titulares
// simulados con la etiqueta "LIVE". Se puede volver a montar acá cuando
// tenga una fuente real (acepta `items`).
import { TopbarClock } from './TopbarClock'
import { AccountMenu } from './AccountMenu'

export function Navigation() {
  return (
    <header className="app-topbar floating-panel sticky top-3 z-50 mx-4 mt-3">
      <div className="h-14 flex items-center gap-4 px-5">
        <Logo size="sm" />
        <div className="flex-1 min-w-0" />
        <TopbarClock />
        <AccountMenu />
      </div>
    </header>
  )
}
