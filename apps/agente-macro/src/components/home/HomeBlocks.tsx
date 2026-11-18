'use client'

import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Reading, Regime } from '@/lib/marketReading'
import { Badge, IconDisplay, PanelHeader, type BadgeVariant } from '@/components/ui'
import { KeyDayBadge, OutcomeBadge, StarMark } from '@/components/calendar/parts'

// Bloques de El Mercado Hoy (diseño: mockup-home-v2). Mismo esquema que el
// Inicio de Entropia Analytics: franja con lo importante + dos tarjetas de
// acción hacia lo principal de la app (Calendario y Volatilidad).

const ARROW: Record<string, string> = { up: '↑', down: '↓' }
const ARROW_CLS: Record<string, string> = { up: 'text-pos', down: 'text-neg' }

function Arrows({ items }: { items: { label: string; dir?: string }[] }) {
  const shown = items.filter(a => a.dir === 'up' || a.dir === 'down')
  return (
    <>
      {shown.map((a, i) => (
        <span key={a.label}>{i > 0 && ' · '}{a.label} <b className={ARROW_CLS[a.dir!]}>{ARROW[a.dir!]}</b></span>
      ))}
    </>
  )
}

// En el resumen de inicio solo mostramos el NASDAQ; USD y oro quedan para el calendario.
const nq = (items: { label: string; dir?: string }[]) => items.filter(a => a.label === 'NASDAQ')

const BLOCK = 'rounded-xl border border-base-line bg-base-panel p-[18px]'

// ── Lo último / Lo que viene ──────────────────────────────────────────────
export function ReadingBlock({ title, when, reading, isKeyDay, empty }: {
  title: string; when?: string; reading: Reading; isKeyDay: boolean; empty: string
}) {
  // Card con la cabecera de bloque (PanelHeader), como el resto del rediseño.
  if (reading.kind === 'empty') {
    return (
      <section className="card">
        <PanelHeader title={title} />
        <p className="p-4 text-[13px] text-base-muted">{empty}</p>
      </section>
    )
  }
  const e = reading.main
  return (
    <section className="card">
      <PanelHeader title={title} subtitle={when} aside={isKeyDay ? <KeyDayBadge subtle /> : undefined} />
      <div className="p-4">
      <p className="text-sm text-base-muted">{e.event.name}</p>
      {reading.kind === 'post' ? (
        <>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-2.5">
            <b className="font-mono text-[32px] font-bold leading-tight text-base-text">{e.event.actual}</b>
            {e.event.forecast != null && <span className="font-mono text-[13px] text-base-faint">pron. {e.event.forecast}</span>}
            <OutcomeBadge outcome={reading.outcome} />
          </div>
          {nq(reading.arrows).some(a => a.dir) && (
            <p className="mt-2 text-[13px] text-base-muted"><Arrows items={nq(reading.arrows)} /></p>
          )}
        </>
      ) : (
        <>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-2.5">
            <b className="font-mono text-[32px] font-bold leading-tight text-base-text">
              {e.event.forecast != null ? `pron. ${e.event.forecast}` : 'Sin pronóstico'}
            </b>
            {e.event.prev != null && <span className="font-mono text-[13px] text-base-faint">ant. {e.event.prev}</span>}
          </div>
          <p className="mt-2 text-[13px] text-base-muted">
            Si sale <b className="font-semibold text-base-text">mejor</b>: <Arrows items={nq(reading.better)} />
            {' '}&nbsp;·&nbsp; Si sale <b className="font-semibold text-base-text">peor</b>: <Arrows items={nq(reading.worse)} />
          </p>
        </>
      )}
      </div>
    </section>
  )
}

// ── Cuatro números ────────────────────────────────────────────────────────
export interface HeroMetric { label: string; value: ReactNode; unit?: string; sub?: ReactNode }

export function MetricsBlock({ metrics, loading }: { metrics: HeroMetric[]; loading: boolean }) {
  return (
    <div className={BLOCK}>
      <div className="grid grid-cols-2 gap-5 text-center sm:grid-cols-4">
        {metrics.map(m => (
          <div key={m.label}>
            <p className="mb-1.5 text-[15px] font-bold text-base-text">{m.label}</p>
            <p className="font-mono text-[30px] font-bold leading-tight text-base-text">
              {loading ? <span className="text-base-faint">—</span> : m.value}
              {m.unit && !loading && <span className="ml-1 font-body text-[13px] font-medium text-base-muted">{m.unit}</span>}
            </p>
            {m.sub && !loading && <p className="mt-1 text-xs text-base-faint">{m.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

const REGIME_VARIANT: Record<Regime, BadgeVariant> = { 'Risk-on': 'pos', 'Risk-off': 'neg', Mixto: 'neutral' }

export function RegimeValue({ regime }: { regime: Regime | null }) {
  if (!regime) return <span className="text-base-faint">—</span>
  return (
    <span className="inline-block pt-1.5 text-sm" title="Según hacia dónde empujan NASDAQ y VIX los datos publicados de la semana">
      <Badge variant={REGIME_VARIANT[regime]}>{regime}</Badge>
    </span>
  )
}

// ── Tarjetas de acción (card--image del style guide, como Mis Métricas) ───
export function ActionCard({ href, title, description, cta, primary, icon }: {
  href: string; title: string; description: string; cta: string; primary?: boolean
  icon: ComponentType<{ size?: number; strokeWidth?: number; stroke?: string }>
}) {
  return (
    <Link href={href} className="card card--image !h-auto min-h-[200px] !bg-base-panel transition-colors hover:border-base-muted/40">
      <div className="card--image__content !gap-0">
        <h3 className="mb-1 font-display text-lg font-extrabold text-base-text">{title}</h3>
        <p className="mb-3.5 text-[13px] leading-relaxed text-base-faint">{description}</p>
        {/* Botones del style guide (.btn-primary / .btn-outline), un tamaño más: .btn-lg */}
        <span className={`${primary ? 'btn-primary' : 'btn-outline'} btn-lg self-start`}>{cta} <ArrowRight size={15} /></span>
      </div>
      <div className="card--image__photo !h-auto flex w-[200px] items-center justify-center border-l border-base-line bg-base-panel2 max-sm:hidden">
        <IconDisplay icon={icon} size={96} strokeWidth={1.4} />
      </div>
    </Link>
  )
}

// ── Earnings de la semana que viene (caja chica) ──────────────────────────
// Saber que NO hay earnings relevantes también es información para el trader.
export interface EarningsRow {
  label: string
  items: { ticker: string; day: string; hour: string; stars: number }[]
}
const HOUR_SHORT: Record<string, string> = { bmo: 'pre', amc: 'post', dmh: 'sesión' }

export function EarningsBlock({ rows, loading }: { rows: EarningsRow[]; loading: boolean }) {
  return (
    <section className="card">
      <PanelHeader title="Earnings" aside="7 magníficas + semis" />
      <div className="p-4">
      {loading ? <p className="text-xs italic text-base-faint">Cargando…</p> : rows.map(r => (
        <div key={r.label} className="mt-2.5 first:mt-0">
          {rows.length > 1 && <p className="mb-1.5 text-[11px] uppercase tracking-widest text-base-faint">{r.label}</p>}
          {r.items.length === 0 ? (
            <p className="text-[13px] text-base-muted">No hay earnings de las 7 magníficas ni semis.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {r.items.map(i => (
                <div key={`${i.ticker}-${i.day}`} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex items-center gap-2">
                    <span className="rounded border border-base-line bg-base-bg px-1 font-mono text-[11px] font-bold text-base-text">{i.ticker}</span>
                    <span className="text-base-muted">{i.day}{HOUR_SHORT[i.hour] ? ` · ${HOUR_SHORT[i.hour]}` : ''}</span>
                  </span>
                  <StarMark n={i.stars} dim={i.stars < 4} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      </div>
    </section>
  )
}
