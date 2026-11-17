import type { ReactNode } from 'react'

// Badge genérico — fondo tenue + texto de color, radius 4px (no pill).
// Variantes con los tokens reales del proyecto (brand/secondary/pos/neg/
// neutral/grey) — homologado con Agente Métricas (verde primario/
// secundario, semáforo, gris). El lima (accent) queda afuera del
// set por estar sin uso activo — igual que en Métricas.
export type BadgeVariant = 'brand' | 'secondary' | 'pos' | 'neg' | 'neutral' | 'grey'

// Record literal, no `badge-${variant}` — ver nota en ui/Button.tsx sobre
// por qué Tailwind necesita el nombre completo como texto literal.
const VARIANT_CLASS: Record<BadgeVariant, string> = {
  brand: 'badge-brand',
  secondary: 'badge-secondary',
  pos: 'badge-pos',
  neg: 'badge-neg',
  neutral: 'badge-neutral',
  grey: 'badge-grey',
}

export function Badge({ children, variant = 'brand' }: { children: ReactNode; variant?: BadgeVariant }) {
  return <span className={`badge ${VARIANT_CLASS[variant]}`}>{children}</span>
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>
}

// ResultBadge — resultado de trade/escenario, fondo SÓLIDO + texto oscuro
// (a diferencia del Badge genérico, que es fondo tenue). Ver sección 5.
export type Result = 'win' | 'loss' | 'breakeven'

const RESULT_LABEL: Record<Result, string> = { win: 'WIN', loss: 'LOSS', breakeven: 'BE' }
const RESULT_CLASS: Record<Result, string> = { win: 'badge-win-solid', loss: 'badge-loss-solid', breakeven: 'badge-be-solid' }

export function ResultBadge({ result }: { result: Result }) {
  return <span className={`badge ${RESULT_CLASS[result]}`}>{RESULT_LABEL[result]}</span>
}

// DirectionBadge — Long/Short. Sigue el mismo criterio que Factor
// Métricas: Long en marca (brand), Short en semáforo (neg) — es una
// etiqueta direccional/informativa, no un resultado de P&L en sí.
export function DirectionBadge({ direction }: { direction: 'Long' | 'Short' }) {
  return <Badge variant={direction === 'Long' ? 'brand' : 'neg'}>{direction}</Badge>
}

// RValue — formatea un valor en R con signo, verde/rojo según signo
// (usa las utilidades .mono/.up/.down ya existentes en globals.css).
export function RValue({ value }: { value: number }) {
  const fmt = (v: number) => (Math.round(v * 10) === v * 10 ? v.toFixed(1) : v.toFixed(2))
  const formatted = value >= 0 ? `+${fmt(value)}R` : `${fmt(value)}R`
  return <span className={`mono ${value >= 0 ? 'up' : 'down'}`}>{formatted}</span>
}
