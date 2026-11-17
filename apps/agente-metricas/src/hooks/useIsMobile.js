import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────
//  useIsMobile — true si el viewport es <= breakpoint (480px por
//  defecto). Reactivo al resize. Usado donde un valor no puede
//  resolverse solo con CSS (ej. la altura numérica de un gráfico de
//  Recharts, o mostrar el prompt de "añadir a inicio" solo en móvil).
// ─────────────────────────────────────────────
export function useIsMobile(breakpoint = 480) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])

  return isMobile
}
