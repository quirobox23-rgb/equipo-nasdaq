'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoginScreen } from '@/components/LoginScreen'
import { useAuthUser } from '@/lib/studentSession'

// Puerta de entrada — solo el login, pantalla completa, sin Navigation ni
// Sidebar (a diferencia de /home, ver (app)/layout.tsx). La landing pública
// de Entropia Markets pasa a santostrader.com/factor-macro; la Landing de antes
// (components/Landing + AccessGateCta + DataSphere) queda en el repo sin uso.
//
// Mientras Firebase comprueba la sesión (user === undefined) se muestra solo
// el fondo, igual en server y cliente (sin mismatch de hidratación): así un
// alumno con sesión no ve el formulario un instante antes de ir a /home.
export default function EntryPage() {
  const router = useRouter()
  const user = useAuthUser()

  useEffect(() => {
    if (user) router.replace('/home')
  }, [user, router])

  if (user !== null) return <div className="min-h-screen bg-base-bg" />

  return <LoginScreen />
}
