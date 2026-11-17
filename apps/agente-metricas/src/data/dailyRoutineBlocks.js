import {
  Brain, Shield, LineChart, Globe2, Sun,
  Crosshair, ClipboardCheck, GraduationCap,
} from 'lucide-react'

// ─────────────────────────────────────────────
//  DAILY ROUTINE — bloques (Sprint 20)
//
//  Fuente única de verdad de la estructura del ritual diario.
//  Cada bloque tiene un `id` estable: es lo que usarán en el futuro
//  Blueprints, Training, Trader Score y Mentor IA para leer el
//  cumplimiento de la rutina (p.ej. "¿ha completado Risk Management
//  antes de operar?"), sin necesidad de tocar este archivo ni la
//  pantalla de Daily Routine.
// ─────────────────────────────────────────────

export const PRE_SESSION_BLOCKS = [
  { id: 'pre-emotional', title: 'Emotional Management', icon: Brain,   color: 'lime' },
  { id: 'pre-risk',      title: 'Risk Management',      icon: Shield,  color: 'red' },
  { id: 'pre-market',    title: 'Market Context',       icon: LineChart, color: 'blue' },
  { id: 'pre-macro',     title: 'Macro Context',        icon: Globe2,  color: 'amber' },
  { id: 'pre-habits',    title: 'Personal Habits',      icon: Sun,     color: 'green' },
]

export const POST_SESSION_BLOCKS = [
  { id: 'post-execution',  title: 'Execution',  icon: Crosshair,      color: 'blue' },
  { id: 'post-psychology', title: 'Psychology', icon: Brain,          color: 'lime' },
  { id: 'post-review',     title: 'Review',     icon: ClipboardCheck, color: 'green' },
  { id: 'post-learning',   title: 'Learning',   icon: GraduationCap,  color: 'amber' },
]

export const ALL_ROUTINE_BLOCKS = [...PRE_SESSION_BLOCKS, ...POST_SESSION_BLOCKS]

// Elementos de ejemplo (mock) con los que arranca cada bloque la
// primera vez. El usuario puede añadir, editar y eliminar libremente.
export const DEFAULT_ROUTINE_ITEMS = {
  'pre-emotional': [
    { id: 'de-1', text: 'Evalúo mi estado emocional antes de abrir el gráfico', checked: false },
    { id: 'de-2', text: 'No opero si vengo de una pérdida sin procesar', checked: false },
  ],
  'pre-risk': [
    { id: 'dr-1', text: 'Defino el riesgo máximo por operación', checked: false },
    { id: 'dr-2', text: 'Defino la pérdida máxima del día', checked: false },
  ],
  'pre-market': [
    { id: 'dm-1', text: 'Reviso niveles clave y estructura', checked: false },
  ],
  'pre-macro': [
    { id: 'dg-1', text: 'Reviso el calendario económico del día', checked: false },
  ],
  'pre-habits': [
    { id: 'dh-1', text: 'He dormido y comido bien antes de operar', checked: false },
  ],
  'post-execution': [
    { id: 'pe-1', text: 'He seguido mi plan de entrada y salida', checked: false },
  ],
  'post-psychology': [
    { id: 'pp-1', text: 'Identifico si alguna emoción afectó mis decisiones', checked: false },
  ],
  'post-review': [
    { id: 'pr-1', text: 'Reviso cada operación del día', checked: false },
  ],
  'post-learning': [
    { id: 'pl-1', text: 'Anoto una lección aprendida hoy', checked: false },
  ],
}
