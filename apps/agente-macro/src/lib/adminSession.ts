'use client'

// adminSession.ts — guarda la clave compartida de admin en el navegador
// (localStorage), para no tener que volver a escribirla cada vez. La
// usan tanto EventProvider.ts (al guardar el calendario) como la pantalla
// de Mentor IA.

const KEY = 'nova_admin_password'

export function getStoredAdminPassword(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setStoredAdminPassword(password: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, password)
  } catch {
    /* localStorage no disponible — no es crítico, solo obliga a re-escribirla */
  }
}

export function clearStoredAdminPassword() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* nada que hacer */
  }
}
