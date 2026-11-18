'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type SVGProps } from 'react'
import { Lock } from 'lucide-react'
import { useAlumno, canSee, routeLevel } from '@/lib/alumno'
import { loadContenido } from '@/lib/contenido'
import { onVistoChange, pendientes, vistoPublicadoEn } from '@/lib/weekly/novedades'
import type { WeeklyAnalysis } from '@/lib/weekly/types'

// Iconos de línea fina, propios (sin librería, sin emoji) — trazo 1.4, monocromo,
// heredan color del texto vía currentColor para integrarse con el estado activo/hover.
function IconRadar(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="10" cy="10" r="6.5" />
      <circle cx="10" cy="10" r="3.2" />
      <circle cx="10" cy="10" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}
function IconCalendar(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3.5" y="4.5" width="13" height="11.5" rx="1.5" />
      <path d="M3.5 8h13M7 3v3M13 3v3" />
    </svg>
  )
}
function IconGrid(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 15V9M10 15V5M15 15v-7" />
      <path d="M3.5 16h13" />
    </svg>
  )
}
function IconGlobe(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M3.5 10h13M10 3.5c2.2 1.8 2.2 11.2 0 13M10 3.5c-2.2 1.8-2.2 11.2 0 13" />
    </svg>
  )
}
function IconPulse(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2.5 10.5h3.2l1.6-4.5 3 8 1.6-4.5h5.6" />
    </svg>
  )
}
function IconDoc(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5.5 3h6.5l3 3v11h-9.5z" />
      <path d="M12 3v3h3M8 10h5M8 13h5" />
    </svg>
  )
}
function IconSpark(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10 3v3M10 14v3M3 10h3M14 10h3M5.5 5.5l2 2M12.5 12.5l2 2M14.5 5.5l-2 2M7.5 12.5l-2 2" />
      <circle cx="10" cy="10" r="2" />
    </svg>
  )
}

const ANALISIS = '/analisis-semanal'

/**
 * Cuántas novedades del Análisis Semanal no vio el alumno (src/lib/weekly/novedades.ts).
 * Lee el análisis publicado una vez y recalcula cuando el alumno va abriendo apartados.
 */
function useNovedadesAnalisis(enabled: boolean): number {
  const [a, setA] = useState<WeeklyAnalysis | null>(null)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    let current: string | undefined
    const load = () => loadContenido<WeeklyAnalysis>('analisis-publicado')
      .then(x => { if (alive) { current = x?.publicadoEn; setA(x) } })
      .catch(() => {})
    load()
    // Cada vez que el alumno abre algo se recalcula. Si abrió un análisis más
    // nuevo que el que tiene el menú (se publicó mientras navegaba), se vuelve a leer.
    const off = onVistoChange(() => {
      const visto = vistoPublicadoEn()
      if (visto && visto !== current) load()
      setTick(t => t + 1)
    })
    return () => { alive = false; off() }
  }, [enabled])
  return enabled && a ? pendientes(a).total : 0
}

interface NavItem { Icon: (p: SVGProps<SVGSVGElement>) => React.ReactElement; label: string; href: string }

// Tres niveles, como en Entropia Analytics (ver src/lib/alumno.ts): Básico con
// el código gratis, Intermedio con el VIP y Equipo (solo nivel admin).
// Las pestañas que el nivel del usuario no abre llevan candado.
const GROUPS: { title: string; adminOnly?: boolean; items: NavItem[] }[] = [
  {
    title: 'Básico',
    items: [
      { Icon: IconRadar,    label: 'El Mercado Hoy',     href: '/home' },
      { Icon: IconCalendar, label: 'Eventos Económicos', href: '/eventos-economicos' },
    ],
  },
  {
    title: 'Intermedio',
    items: [
      { Icon: IconPulse, label: 'Volatilidad',      href: '/mercado' },
      { Icon: IconGlobe, label: 'Geopolítica',      href: '/geopolitica' },
      { Icon: IconDoc,   label: 'Análisis Semanal', href: '/analisis-semanal' },
    ],
  },
  {
    // Contexto Técnico está en desarrollo; Mentor IA además pide la clave de admin.
    title: 'Equipo',
    adminOnly: true,
    items: [
      { Icon: IconGrid,  label: 'Contexto Técnico', href: '/contexto-tecnico' },
      { Icon: IconSpark, label: 'Mentor IA',        href: '/mentor-ia' },
    ],
  },
]

function NavLink({ item, n, active, locked = false, count = 0 }: { item: NavItem; n: number; active: boolean; locked?: boolean; count?: number }) {
  const { Icon, label, href } = item
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`pill-link ${active ? 'pill-link-active' : ''}`}
    >
      <span className="pill-num">{String(n).padStart(2, '0')}</span>
      <Icon className="w-[14px] h-[14px] shrink-0 opacity-80" />
      <span>{label}</span>
      {locked && <Lock size={11} className="opacity-60" aria-label="Necesita código VIP" />}
      {!locked && count > 0 && (
        <span
          className="min-w-[18px] h-[18px] px-[5px] rounded-full bg-accent text-base-bg font-mono text-[10.5px] font-bold leading-[18px] text-center"
          aria-label={count === 1 ? '1 novedad sin ver' : `${count} novedades sin ver`}
        >
          {count}
        </span>
      )}
    </Link>
  )
}

// Mismo estilo que el sidebar de Entropia Analytics (AppShell.module.css):
// el estado activo es un box gris con contorno interno sutil — sin ícono
// ni barra en verde de marca, la marca queda reservada para CTAs/logo.
export function Sidebar() {
  const pathname = usePathname()
  const { nivel } = useAlumno()
  const isActive = (href: string) => !!pathname?.startsWith(href)
  // Mientras se comprueba el nivel no se pintan candados (evita parpadeo).
  const isLocked = (href: string) => nivel !== undefined && !canSee(nivel, routeLevel(href))
  const novedades = useNovedadesAnalisis(nivel !== undefined && !isLocked(ANALISIS))

  // Entropia Markets: navegación en una cápsula flotante, numerada (01, 02…)
  // y agrupada por nivel. Siempre en el mismo orden y el mismo sitio.
  let n = 0
  return (
    <nav className="sticky top-[84px] z-40 mx-4 mt-3 flex justify-center" aria-label="Secciones">
      <div className="floating-panel pill-bar">
        {GROUPS.filter(g => !g.adminOnly || nivel === 'admin').map((g, gi) => (
          <div key={g.title} className={`flex items-center gap-1 ${gi > 0 ? 'pl-2 ml-1 border-l border-base-line/70' : ''}`}>
            <span className="pill-group">{g.title}</span>
            {g.items.map(item => (
              <NavLink key={item.href} item={item} n={++n} active={isActive(item.href)} locked={isLocked(item.href)}
                count={item.href === ANALISIS ? novedades : 0} />
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}
