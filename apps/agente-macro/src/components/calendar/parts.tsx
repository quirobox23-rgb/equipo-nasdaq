import { Star, Zap } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui'
import { OUTCOME_LABEL, type Outcome } from '@/lib/eventOutcome'

// Piezas chicas compartidas por WeekCalendar y EventTable.

const WEEKDAY_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** "2026-09-28" → "Lunes 28" (o "Lun 28" con short). */
export function dayName(date: string, short = false): string {
  const d = new Date(`${date}T00:00:00Z`)
  return `${(short ? WEEKDAY_SHORT : WEEKDAY_LONG)[d.getUTCDay()]} ${d.getUTCDate()}`
}

/** Estrellas del día (5, llenas y vacías). `bright` = blancas (día clave). */
export function DayStars({ n, bright = false, size = 13 }: { n: number; bright?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          strokeWidth={0}
          fill="currentColor"
          className={i <= n ? (bright ? 'text-base-text' : 'text-[#9aa3af]') : 'text-base-line'}
        />
      ))}
    </span>
  )
}

/** Marca compacta por evento: "★4" / "★5". `dim` para la tabla (≤3). */
export function StarMark({ n, dim = false }: { n: number; dim?: boolean }) {
  return (
    <span
      title={`${n} de 5 estrellas`}
      className={`inline-flex items-center gap-[3px] rounded border px-1.5 font-mono text-[11px] leading-4 ${
        dim ? 'border-transparent text-base-faint font-medium' : 'border-base-line bg-base-bg text-base-text font-bold'
      }`}
    >
      <Star size={9} strokeWidth={0} fill="currentColor" />{n}
    </span>
  )
}

/** Badge sólido del día clave (variante sólida del .badge del style guide). */
// subtle: gris con borde, para resúmenes donde el verde resalta de más (Home).
export function KeyDayBadge({ className = '', subtle = false }: { className?: string; subtle?: boolean }) {
  const tone = subtle ? 'border border-base-line bg-base-bg text-base-muted' : 'text-base-bg bg-brand'
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${tone} ${className}`}>
      <Zap size={11} strokeWidth={2} fill="currentColor" />Día clave
    </span>
  )
}

export function TodayTag({ className = '' }: { className?: string }) {
  return (
    <span className={`rounded bg-base-text px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-base-bg ${className}`}>Hoy</span>
  )
}

const OUTCOME_BADGE: Record<Outcome, BadgeVariant> = { better: 'pos', inline: 'neutral', worse: 'neg' }

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return <Badge variant={OUTCOME_BADGE[outcome]}>{OUTCOME_LABEL[outcome]}</Badge>
}

/** "Rango NQ 622 pts · 1.4×" — solo días ya cerrados. */
export function NqRange({ pts, avg }: { pts: number; avg: number | null }) {
  return (
    <span className="font-mono text-[11px] text-base-faint" title="Rango del NQ ese día (máximo − mínimo) y comparación con la media diaria">
      NQ <span className="font-semibold text-base-muted">{Math.round(pts)} pts</span>
      {avg ? ` · ${(pts / avg).toFixed(1)}×` : ''}
    </span>
  )
}
