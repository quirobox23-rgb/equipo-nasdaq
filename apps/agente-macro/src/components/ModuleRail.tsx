'use client'
import { conBase } from '@/lib/base'
import { useEffect, useState } from 'react'
import type { SVGProps } from 'react'
import { ThemeToggle } from './ThemeToggle'

// Barra de módulos del ecosistema Entropia: siempre en el mismo sitio, con
// los mismos tres destinos, para que orientarse no cueste esfuerzo.
type Icono = (p: SVGProps<SVGSVGElement>) => React.ReactElement
const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const IconIntelligence: Icono = p => (
  <svg viewBox="0 0 24 24" {...trazo} {...p}><circle cx="12" cy="12" r="2.4" /><circle cx="5" cy="6" r="1.6" /><circle cx="19" cy="6" r="1.6" /><circle cx="6" cy="18.5" r="1.6" /><circle cx="18" cy="18.5" r="1.6" /><path d="M6.3 7l3.9 3.4M17.7 7l-3.9 3.4M7.3 17.4l3-3.6M16.7 17.4l-3-3.6" /></svg>
)
const IconMarkets: Icono = p => (
  <svg viewBox="0 0 24 24" {...trazo} {...p}><circle cx="12" cy="12" r="8.5" /><ellipse cx="12" cy="12" rx="8.5" ry="3.4" transform="rotate(-25 12 12)" /><circle cx="12" cy="12" r="1.6" /></svg>
)
const IconAnalytics: Icono = p => (
  <svg viewBox="0 0 24 24" {...trazo} {...p}><path d="M4 19.5h16" /><path d="M6.5 16V11M11 16V6.5M15.5 16v-3.5M20 16V9" /></svg>
)
const IconFoco: Icono = p => (
  <svg viewBox="0 0 24 24" {...trazo} {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /></svg>
)

const MODULOS: { id: string; nombre: string; Icon: Icono; href?: string; activo?: boolean }[] = [
  { id: 'intelligence', nombre: 'Intelligence', Icon: IconIntelligence, href: process.env.NEXT_PUBLIC_URL_INTELLIGENCE || '/oficina' },
  { id: 'markets', nombre: 'Markets', Icon: IconMarkets, href: conBase('/home'), activo: true },
  { id: 'analytics', nombre: 'Analytics', Icon: IconAnalytics, href: process.env.NEXT_PUBLIC_URL_ANALYTICS || '/analytics/inicio' },
]

const CLAVE_FOCO = 'entropia_foco'

/** Modo foco: sin animaciones ni adornos, solo la información. Se recuerda en este navegador. */
function FocusToggle() {
  const [foco, setFoco] = useState(false)
  useEffect(() => {
    try { setFoco(localStorage.getItem(CLAVE_FOCO) === '1') } catch {}
  }, [])
  useEffect(() => {
    document.documentElement.toggleAttribute('data-focus', foco)
    try { localStorage.setItem(CLAVE_FOCO, foco ? '1' : '0') } catch {}
  }, [foco])
  return (
    <button onClick={() => setFoco(f => !f)} className={`rail-btn ${foco ? 'rail-btn-on' : ''}`} aria-pressed={foco} title="Modo foco: sin animaciones ni adornos">
      <IconFoco className="w-[18px] h-[18px]" />
      <span>Foco</span>
    </button>
  )
}

export function ModuleRail() {
  return (
    <aside className="module-rail" aria-label="Módulos de Entropia">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={conBase("/icon.png")} alt="" className="w-9 h-9 rounded-xl mb-4" />
      <nav className="flex flex-col gap-1.5">
        {MODULOS.map(({ id, nombre, Icon, href, activo }) => (
          <a
            key={id}
            href={href ?? '#'}
            aria-current={activo ? 'page' : undefined}
            aria-disabled={!href}
            className={`rail-btn ${activo ? 'rail-btn-active' : ''} ${!href ? 'opacity-40 pointer-events-none' : ''}`}
            title={href ? nombre : `${nombre} (configura su dirección)`}
          >
            <Icon className="w-[20px] h-[20px]" />
            <span>{nombre}</span>
          </a>
        ))}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-2">
        <FocusToggle />
        <ThemeToggle rail />
      </div>
    </aside>
  )
}
