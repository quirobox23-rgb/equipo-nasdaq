'use client'

// theme.ts — persistencia del tema claro/oscuro en localStorage, mismo
// patrón que studentSession.ts. Dark es el default (color-scheme: dark en
// :root, ver globals.css); 'light' setea [data-theme="light"] en <html>.

const KEY = 'agente_macro_theme'

export type Theme = 'dark' | 'light'

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    return window.localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  try {
    window.localStorage.setItem(KEY, theme)
  } catch {
    /* no es crítico — en el peor caso vuelve a dark en la próxima visita */
  }
}
