'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { logoutStudent, useAuthUser } from '@/lib/studentSession'

// Menú de cuenta del topbar — mismo diseño que el de Agente Métricas
// (AppShell: avatar con la inicial + email + chevron, dropdown con
// "Cerrar sesión"). Acá no hay planes: cada alumno entra con su cuenta de
// Firebase (email + contraseña, ver studentSession.ts). Cerrar sesión cierra
// la sesión de Firebase y vuelve a la entrada.
export function AccountMenu() {
  const router = useRouter()
  const email = useAuthUser()?.email ?? null
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const signOut = async () => {
    await logoutStudent()
    router.replace('/')
  }

  const initial = email?.[0]?.toUpperCase() ?? 'A'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-base-line py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-base-muted/40 hover:bg-base-panel2"
      >
        <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-base-line text-xs font-bold text-base-text">{initial}</span>
        <span className="max-w-[200px] truncate text-[12.5px] text-base-muted max-sm:hidden">{email || 'Alumno'}</span>
        <ChevronDown size={14} className={`text-base-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[200] min-w-[160px] rounded-lg border border-base-line bg-base-panel2 p-1.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.4)]">
          <button
            onClick={signOut}
            className="block w-full rounded-md px-2.5 py-2 text-left text-[12.5px] font-medium text-base-muted transition-colors hover:bg-base-line hover:text-base-text"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
