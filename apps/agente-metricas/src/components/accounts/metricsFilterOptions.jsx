// ─────────────────────────────────────────────
//  FILTROS DE MÉTRICAS — opciones compartidas
//
//  Básico, Analytics, Lab y Mentor IA usan los mismos filtros. Tipo,
//  Estado y Período van como selectores segmentados (Chips size="sm",
//  igual que el Portafolio); Cuenta sigue como select porque la lista
//  es larga, ordenada con las activas primero.
//
//  Los valores son los de siempre (Challenge/Funded/Personal,
//  active/approved/lost, 1W/1M/3M/6M/ALL): solo cambian los nombres
//  que se muestran. '6M' ya lo entiende filterTradesByPeriod().
// ─────────────────────────────────────────────

import { accountLabel } from '@/pages/dashboard/dashboardHelpers'

export const ACCOUNT_TYPE_FILTER_OPTIONS = [
  { value: 'all',       label: 'Todas' },
  // Corto para que la fila de filtros entre en una línea
  { value: 'Challenge', label: 'Eval' },
  { value: 'Funded',    label: 'Fondeada' },
  { value: 'Personal',  label: 'Capital real' },
]

// Mercado: las cuentas sin mercado cargado solo aparecen en 'Todos'
export const MARKET_FILTER_OPTIONS = [
  { value: 'all',     label: 'Todos' },
  { value: 'futures', label: 'Futuros' },
  { value: 'cfd',     label: 'CFDs' },
]

export const ACCOUNT_STATUS_FILTER_OPTIONS = [
  { value: 'all',      label: 'Todas' },
  { value: 'active',   label: 'Activas' },
  { value: 'approved', label: 'Completadas' },
  { value: 'lost',     label: 'Perdidas' },
]

// Versión compacta al estilo de las plataformas de trading. El filtro
// cuenta meses de calendario (no 30/90 días exactos), por eso M y no D.
export const PERIOD_FILTER_OPTIONS = [
  { value: '1W',  label: '7D' },
  { value: '1M',  label: '1M' },
  { value: '3M',  label: '3M' },
  { value: '6M',  label: '6M' },
  { value: 'ALL', label: 'Todo' },
]

const STATUS_ORDER = { active: 0, approved: 1, lost: 2 }
const STATUS_SUFFIX = { approved: 'Completada', lost: 'Perdida' }

// Activas primero, después completadas y perdidas (estable dentro de cada grupo)
export const byAccountStatus = (a, b) =>
  (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0)

// Nombre en el select de Cuenta, con el estado si no está activa
export const accountOptionLabel = (a) =>
  STATUS_SUFFIX[a.status] ? `${accountLabel(a)} · ${STATUS_SUFFIX[a.status]}` : accountLabel(a)
