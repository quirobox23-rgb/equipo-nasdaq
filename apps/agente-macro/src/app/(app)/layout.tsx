'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { Sidebar } from '@/components/Sidebar'
import { useAuthUser } from '@/lib/studentSession'
import { AlumnoContext, useAlumnoState, routeLevel, canSee, homeFor } from '@/lib/alumno'
import { LockedTab } from '@/components/LockedTab'

// Layout de las páginas "de dentro" del terminal (Home, Eventos, Contexto
// Técnico, Geopolítica, Volatilidad, Mentor IA). Protegido por sesión
// real de Firebase: si alguien entra directo a una URL de acá sin haber
// iniciado sesión, se lo manda de vuelta a /. La Landing (/) queda FUERA
// de este grupo a propósito — sin Navigation ni Sidebar, es un splash a
// pantalla completa (ver src/app/page.tsx).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  // undefined = Firebase todavía está comprobando la sesión, null = no
  // hay sesión, User = alumno con sesión iniciada.
  const user = useAuthUser()

  useEffect(() => {
    if (user === null) router.replace('/')
  }, [user, router])

  // Cada sección pide un nivel (gratis, vip o admin — ver src/lib/alumno.ts).
  const alumno = useAlumnoState(user)
  const required = routeLevel(pathname)
  const allowed = alumno.nivel !== undefined && canSee(alumno.nivel, required)

  // Mentor IA solo lo abre el equipo: a los demás los llevamos al inicio.
  useEffect(() => {
    if (alumno.nivel === undefined || allowed) return
    if (required === 'admin') router.replace(homeFor())
  }, [alumno.nivel, allowed, required, router])

  if (!user) return null // todavía comprobando, o sin sesión (redirigiendo a /)

  return (
    <AlumnoContext.Provider value={alumno}>
      <Navigation />
      <Sidebar />
      <main className="app-content max-w-[1440px] mx-auto px-6 py-6 min-w-0">
        {alumno.nivel === undefined ? null : allowed ? children : required === 'admin' ? null : <LockedTab nivel={alumno.nivel} />}
      </main>
    </AlumnoContext.Provider>
  )
}
