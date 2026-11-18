// ─────────────────────────────────────────────
//  Navigation Configuration
//  Centralised menu structure for Atlas
// ─────────────────────────────────────────────

import { HeartPulse, LineChart, CalendarDays, Sun, Briefcase, BookOpen } from 'lucide-react'

/**
 * Entropia Control: lo que depende de ti. Cinco secciones y la Academia.
 *  - Hoy: tu estado, tus métricas de 30 días y el coach.
 *  - Rendimiento: el panel y las métricas (Básico/Intermedio/Pro son los
 *    planes; cada pestaña lleva su candado) más la consistencia.
 *  - Diario: calendario, historial y setups.
 *  - Pulso: cómo llegas (rutina, check-in, hábitos). Solo estado.
 *  - Cuentas: portafolio e inversión y retiros.
 * Mentor IA y Puntaje del Trader salen del menú: el mentor es Atractor (la
 * oficina) y el puntaje usaba datos de ejemplo. Mapas, Monte Carlo, Kelly y
 * Rentabilidad siguen abiertos por enlace, fuera del día a día.
 */
export const NAVIGATION = [
  {
    id: 'control',
    label: 'Control',
    items: [
      { to: '/hoy', icon: HeartPulse, label: 'Hoy' },
      { to: '/rendimiento', icon: LineChart, label: 'Rendimiento' },
      { to: '/diario', icon: CalendarDays, label: 'Diario' },
      { to: '/pulso', icon: Sun, label: 'Pulso' },
      { to: '/cuentas', icon: Briefcase, label: 'Cuentas' },
    ],
  },
  {
    id: 'academia',
    label: 'Academia',
    items: [
      { to: '/entrenamiento', icon: BookOpen, label: 'Entrenamiento' },
    ],
  },
]

/**
 * Flatten navigation for easier route resolution
 * Returns all unique routes from the navigation structure
 */
export function getAllRoutes() {
  const routes = []

  function traverse(items) {
    items.forEach((item) => {
      if (item.to) {
        routes.push({ to: item.to, label: item.label })
      }
      if (item.items) {
        traverse(item.items)
      }
    })
  }

  traverse(NAVIGATION)
  return routes
}