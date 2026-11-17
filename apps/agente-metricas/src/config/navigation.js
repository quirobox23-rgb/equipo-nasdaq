// ─────────────────────────────────────────────
//  Navigation Configuration
//  Centralised menu structure for Atlas
// ─────────────────────────────────────────────

import {
  LineChart, Briefcase, Brain, BarChart, PieChart, Beaker, BookOpen, Map,
  Award, PiggyBank, Sun, CalendarDays, ShieldCheck,
} from 'lucide-react'

/**
 * Navigation structure for the application
 * Format:
 * {
 *   id: unique identifier for the group
 *   label: displayed group name
 *   items: array of navigation items
 *     - to: route path
 *     - icon: lucide icon component
 *     - label: displayed label
 *     - disabled: optional, hide from menu (prepared for future features)
 * }
 *
 * NOTA (Sprint 10): Weekly Summary, Approach, Historial, Calendar y Setups
 * ya no aparecen en el menú lateral. Sus páginas y rutas siguen existiendo
 * sin cambios; se accede a ellas desde las tarjetas de Acciones Rápidas
 * del Dashboard. Monte Carlo tampoco aparece porque ya forma parte de
 * Metrix Lab.
 *
 * NOTA (Sprint "unificación de planes"): las 3 pestañas de Métricas
 * usan ahora EXACTAMENTE los mismos nombres que los 3 planes de pago
 * (Básico/Intermedio/Pro) — antes decían "Básico/Analítica/Laboratorio",
 * lo que no coincidía con Free/Intermedio/Pro y generaba confusión.
 */
export const NAVIGATION = [
  {
    id: 'performance',
    label: 'Resumen',
    items: [
      {
        to: '/inicio',
        icon: LineChart,
        label: 'Inicio',
      },
      {
        to: '/portafolio',
        icon: Briefcase,
        label: 'Portafolio',
      },
    ],
  },
  {
    id: 'metrix',
    label: 'Métricas',
    items: [
      {
        to: '/metricas-basico',
        icon: BarChart,
        label: 'Básico',
      },
      {
        to: '/metricas-intermedio',
        icon: PieChart,
        label: 'Intermedio',
      },
      {
        to: '/metricas-pro',
        icon: Beaker,
        label: 'Pro',
      },
    ],
  },
  {
    id: 'elite-performance',
    label: 'Rendimiento Elite',
    items: [
      {
        to: '/mapas',
        icon: Map,
        label: 'Mapas',
      },
      {
        to: '/mentor-ia',
        icon: Brain,
        label: 'Mentor IA',
      },
      {
        to: '/entrenamiento',
        icon: BookOpen,
        label: 'Entrenamiento',
      },
    ],
  },
  {
    id: 'journal',
    label: 'Journal',
    items: [
      {
        to: '/rutina-diaria',
        icon: Sun,
        label: 'Rutina Diaria',
      },
      {
        to: '/calendar',
        icon: CalendarDays,
        label: 'Calendario',
        // Oculto del menú lateral: ya está disponible como botón
        // secundario dentro de Metrix Básico (ver MetrixBasic.jsx),
        // duplicarlo acá era ruido en el grupo Journal.
        disabled: true,
      },
      {
        to: '/consistencia',
        icon: ShieldCheck,
        label: 'Consistencia',
      },
      {
        to: '/puntaje-trader',
        icon: Award,
        label: 'Puntaje del Trader',
      },
    ],
  },
  {
    id: 'business',
    label: 'Mi negocio',
    items: [
      {
        to: '/roi',
        icon: PiggyBank,
        label: 'Inversión y retiros',
      },
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