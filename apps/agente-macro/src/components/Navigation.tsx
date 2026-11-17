'use client'
import { Logo } from './Logo'
// NewsTicker (./home/NewsTicker) queda en el repo: mostraba titulares
// simulados con la etiqueta "LIVE". Se puede volver a montar acá cuando
// tenga una fuente real (acepta `items`).
import { ThemeToggle } from './ThemeToggle'
import { TopbarClock } from './TopbarClock'
import { AccountMenu } from './AccountMenu'

export function Navigation() {
  return (
    <header className="app-topbar sticky top-0 z-50 backdrop-blur border-b border-base-line">
      <div className="h-16 flex items-center">
        <div className="shrink-0 flex items-center px-6">
          <Logo size="sm" />
        </div>
        <div className="flex-1 min-w-0" />
        <div className="shrink-0 flex items-center px-4">
          <TopbarClock />
        </div>
        <div className="shrink-0 flex items-center gap-2.5 px-3 border-l border-base-line">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
