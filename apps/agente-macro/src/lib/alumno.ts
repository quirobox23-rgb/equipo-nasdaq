'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { getDb } from '@/lib/firebase/client'

// alumno.ts — niveles de acceso, como los códigos de Agente Métricas.
// Cualquiera puede crearse una cuenta con su email y contraseña; después
// pone un código que desbloquea un nivel:
//
//   · gratis → nivel Básico: El Mercado Hoy y Eventos Económicos (calendario
//              semanal).
//   · vip    → además el nivel Intermedio: Volatilidad, Geopolítica y
//              Análisis Semanal (en beta).
//   · admin  → además el grupo Equipo: Contexto Técnico (en desarrollo) y
//              Mentor IA. Este nivel NO se consigue con un código:
//              se pone a mano en Firestore (alumnos/{uid}, campo nivel = "admin").
//
// Una vez puesto queda guardado en su cuenta (en cualquier dispositivo) en el
// documento `alumnos/{uid}` de Firestore: { codigo, nivel, email, activadoEn }.
// Los documentos antiguos sin `nivel` son de alumnos de pago → vip.
//
// Los códigos NO están en la web: están en el documento `config/acceso` de
// Firestore (campo `codigo` = VIP, campo `codigoGratis` = gratis), que nadie
// puede leer desde el navegador. Los comprueban las reglas de Firestore:
//
//   match /alumnos/{uid} {
//     allow get: if request.auth != null && request.auth.uid == uid;
//     allow create, update: if request.auth != null && request.auth.uid == uid && (
//       (request.resource.data.nivel == 'vip'
//         && request.resource.data.codigo == get(/databases/$(database)/documents/config/acceso).data.codigo
//         && (resource == null || resource.data.get('nivel', 'vip') != 'admin'))
//       || (request.resource.data.nivel == 'gratis'
//         && request.resource.data.codigo == get(/databases/$(database)/documents/config/acceso).data.codigoGratis
//         && resource == null)
//     );
//   }
//
// (un gratis puede pasar a vip con el código VIP; nadie puede bajar de nivel
// ni hacerse admin a sí mismo). Cambiar un código en config/acceso no quita
// el acceso a quien ya lo activó; para quitárselo a alguien, borrar su
// documento en `alumnos`.

export type Nivel = 'gratis' | 'vip' | 'admin'

const RANK: Record<Nivel, number> = { gratis: 1, vip: 2, admin: 3 }

/** Nivel mínimo de cada sección. Lo que no está aquí pide vip. */
const ROUTE_LEVEL: { prefix: string; nivel: Nivel }[] = [
  { prefix: '/home', nivel: 'gratis' },
  { prefix: '/analisis-semanal', nivel: 'vip' },
  { prefix: '/eventos-economicos', nivel: 'gratis' },
  { prefix: '/contexto-tecnico', nivel: 'admin' },
  { prefix: '/mentor-ia', nivel: 'admin' },
]

export function routeLevel(pathname: string | null): Nivel {
  const hit = ROUTE_LEVEL.find(r => pathname === r.prefix || pathname?.startsWith(`${r.prefix}/`))
  return hit?.nivel ?? 'vip'
}

/** ¿Puede este nivel (null = sin código) ver una sección que pide `required`? */
export function canSee(nivel: Nivel | null | undefined, required: Nivel): boolean {
  return !!nivel && RANK[nivel] >= RANK[required]
}

/** Primera pantalla al entrar: El Mercado Hoy, que ven todos los niveles. */
export function homeFor(): string {
  return '/home'
}

interface AlumnoState {
  /** undefined → comprobando · null → sin código · si no, su nivel */
  nivel: Nivel | null | undefined
  /** Activa la cuenta con un código (VIP o gratis). Devuelve false si no es válido. */
  activate: (code: string) => Promise<boolean>
}

export const AlumnoContext = createContext<AlumnoState>({ nivel: undefined, activate: async () => false })

export function useAlumno(): AlumnoState {
  return useContext(AlumnoContext)
}

/** Estado de alumno para el usuario con sesión; lo usa (app)/layout.tsx para el AlumnoContext. */
export function useAlumnoState(user: User | null | undefined): AlumnoState {
  const [nivel, setNivel] = useState<Nivel | null | undefined>(undefined)

  useEffect(() => {
    if (!user) { setNivel(user === null ? null : undefined); return }
    let cancelled = false
    setNivel(undefined)
    getDoc(doc(getDb(), 'alumnos', user.uid))
      .then(snap => {
        if (cancelled) return
        if (!snap.exists()) return setNivel(null)
        const n = snap.data().nivel
        setNivel(n === 'gratis' || n === 'admin' ? n : 'vip')
      })
      .catch(() => { if (!cancelled) setNivel(null) })
    return () => { cancelled = true }
  }, [user])

  const activate = useCallback(async (code: string) => {
    if (!user || !code.trim()) return false
    // Primero como código VIP; si las reglas lo rechazan, como código gratis.
    for (const n of ['vip', 'gratis'] as const) {
      try {
        await setDoc(doc(getDb(), 'alumnos', user.uid), {
          codigo: code.trim(),
          nivel: n,
          email: user.email ?? null,
          activadoEn: serverTimestamp(),
        })
        setNivel(n)
        return true
      } catch {
        // permission-denied = no es un código de este nivel
      }
    }
    return false
  }, [user])

  return { nivel, activate }
}
