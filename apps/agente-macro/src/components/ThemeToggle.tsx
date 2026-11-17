'use client'
import { useEffect, useState } from 'react'
import type { SVGProps } from 'react'
import { applyTheme, getStoredTheme } from '@/lib/theme'

function IconSun(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2.5v2M10 15.5v2M3.6 3.6l1.4 1.4M15 15l1.4 1.4M2.5 10h2M15.5 10h2M3.6 16.4l1.4-1.4M15 5l1.4-1.4" />
    </svg>
  )
}
function IconMoon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M16.5 12.3A6.8 6.8 0 0 1 7.7 3.5a6.8 6.8 0 1 0 8.8 8.8Z" />
    </svg>
  )
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => getStoredTheme())

  // El script inline de layout.tsx evita el flash inicial, pero no cubre
  // navegaciones client-side entre rutas — sincronizamos acá también,
  // así el atributo data-theme nunca queda desalineado con lo guardado.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      className="flex items-center justify-center w-8 h-8 rounded-lg text-base-muted hover:bg-base-line/40 hover:text-base-text transition-colors duration-200"
    >
      {theme === 'light' ? <IconMoon className="w-[15px] h-[15px]" /> : <IconSun className="w-[15px] h-[15px]" />}
    </button>
  )
}
