'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'

// studentSession.ts — sustituye al candado de código compartido. Cada
// alumno tiene ahora su propia cuenta real (email + contraseña) en Firebase
// Authentication. La sesión la gestiona Firebase
// solo (persiste en el navegador automáticamente) — ya no hace falta
// guardar nada a mano en localStorage.

/**
 * Hook reactivo con el estado de sesión del alumno.
 * - undefined → todavía no se sabe (Firebase está comprobando)
 * - null      → no hay sesión iniciada
 * - User      → alumno con sesión iniciada
 */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), setUser)
    return () => unsubscribe()
  }, [])

  return user
}

export async function logoutStudent() {
  await getFirebaseAuth().signOut()
}

/** Mensaje en pantalla para cada código de error de Firebase Auth al entrar o registrarse. */
export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Email o contraseña incorrectos. Probá de nuevo.'
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.'
    case 'auth/user-disabled':
      return 'Esta cuenta está desactivada.'
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisá tu internet y probá de nuevo.'
    case 'auth/email-already-in-use':
      return 'Ese email ya tiene cuenta. Entrá con tu contraseña o usá "¿Olvidaste tu contraseña?".'
    case 'auth/weak-password':
      return 'La contraseña tiene que tener al menos 6 caracteres.'
    case 'auth/operation-not-allowed':
      return 'El registro no está activado. Avisanos por Discord.'
    default:
      return 'No se pudo entrar. Probá de nuevo.'
  }
}
