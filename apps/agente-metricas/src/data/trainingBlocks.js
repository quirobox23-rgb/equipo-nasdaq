import { Target, Zap, Brain, Repeat2 } from 'lucide-react'

// ─────────────────────────────────────────────
//  TRAINING_BLOCKS — fuente única de verdad
//  Usado por Training.jsx (listado) y por el editor de
//  Blueprints (Sprint 13) para seleccionar qué entrenamientos
//  pertenecen a un Blueprint. Evita duplicar esta lista.
// ─────────────────────────────────────────────
export const TRAINING_BLOCKS = [
  {
    id: 'risk-management',
    title: 'Risk Management',
    description: 'Domina la gestión del riesgo: por operación, diario y del capital',
    icon: Target,
    color: 'var(--red)',
    count: 5,
    to: '/entrenamiento/risk-management',
  },
  {
    id: 'execution',
    title: 'Execution',
    description: 'Perfecciona tus entradas, salidas y gestión del trade en vivo',
    icon: Zap,
    color: 'var(--brand-deep)',
    count: 6,
    to: '/entrenamiento/execution',
  },
  {
    id: 'psychology',
    title: 'Psychology',
    description: 'Entrena tu mente: paciencia, disciplina, FOMO, revenge trading',
    icon: Brain,
    color: 'var(--brand)',
    count: 7,
    to: '/entrenamiento/psychology',
  },
  {
    id: 'consistency',
    title: 'Consistency',
    description: 'Construye rutinas, journal, revisiones y cumple tu plan',
    icon: Repeat2,
    color: 'var(--brand)',
    count: 4,
    to: '/entrenamiento/consistency',
  },
]
