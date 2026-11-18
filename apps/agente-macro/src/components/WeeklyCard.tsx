'use client'
import type { SVGProps } from 'react'

// Ícono propio (sin librería, sin emoji) — mismo trazo fino que Sidebar.tsx.
function IconNarrative(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M12.8 7.2l-2 4.6-4.6 2 2-4.6z" strokeLinejoin="round" />
    </svg>
  )
}
function IconCalendar(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3.5" y="4.5" width="13" height="11.5" rx="1.5" />
      <path d="M3.5 8h13M7 3v3M13 3v3" />
    </svg>
  )
}
function IconScenarios(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="4.5" cy="10" r="1.8" />
      <circle cx="15.5" cy="4.5" r="1.8" />
      <circle cx="15.5" cy="15.5" r="1.8" />
      <path d="M6.3 9.2 13.7 5.3M6.3 10.8l7.4 3.9" />
    </svg>
  )
}
function IconInflation(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 16.5h14" />
      <path d="M5 16.5V11M9 16.5V7M13 16.5V9M17 16.5V4" />
    </svg>
  )
}
function IconFed(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2.5 8h15L10 3z" strokeLinejoin="round" />
      <path d="M4 8v7M8 8v7M12 8v7M16 8v7" />
      <path d="M2.5 16.5h15" />
    </svg>
  )
}
function IconEarnings(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="7" width="14" height="9.5" rx="1.5" />
      <path d="M7.5 7V5.3A1.3 1.3 0 0 1 8.8 4h2.4a1.3 1.3 0 0 1 1.3 1.3V7" />
      <path d="M3 11.5h14" />
    </svg>
  )
}
function IconTopicDefault(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="10" cy="10" r="2" />
      <path d="M10 3v3M10 14v3M3 10h3M14 10h3" />
    </svg>
  )
}
function TopicIcon({ tema, ...p }: { tema: string } & SVGProps<SVGSVGElement>) {
  if (tema === 'Inflación') return <IconInflation {...p} />
  if (tema === 'Fed') return <IconFed {...p} />
  if (tema === 'Earnings') return <IconEarnings {...p} />
  return <IconTopicDefault {...p} />
}

// WeeklyCard — pinta el campo `weekly_card` que ya devuelve /analyze (Python).
// Forma de los datos verificada contra weekly_card.py real (build_weekly_card),
// no contra una plantilla genérica — por eso los nombres de campo son
// `narrativa`/`riesgo_semanal`/`dias` en minúsculas planas, no `dias.eventos[].nombre`
// ni escenarios S1/S2/S3 con porcentajes de relleno (esos no existen: los
// escenarios que sí hay son escenario_base + escenarios_alternativos, tal
// cual los generó el LLM — si no hay briefing, escenario_base es null y no
// se muestra nada en su lugar, nunca un dato inventado).

interface DiaData {
  eventos: string[]
  estrellas: number
  earnings: string[]
  nota: string
  color: string
}

interface Escenario {
  nombre: string
  probabilidad: number
  justificacion?: string | null
  trigger?: string | null
}

interface AgenteActivo {
  nombre: string
  fuente: string
  status: 'real' | 'mock'
}

export interface WeeklyCardData {
  semana: string | null
  narrativa: string
  riesgo_semanal: string
  riesgo_justificacion: string
  evento_dominante: string | null
  dias: Record<string, DiaData>
  enfoque: Array<{ tema: string; icono: string; sub: string }>
  escenario_base: Escenario | null
  escenarios_alternativos: Escenario[]
  activos_favorecidos: string[]
  agentes_activos: AgenteActivo[]
  confidence: number
}

const RISK_TONE: Record<string, string> = {
  'Bajo': 'text-pos border-pos/40 bg-pos-dim/20',
  'Medio': 'text-neutral border-neutral/40 bg-neutral-dim/20',
  'Medio-Alto': 'text-neg border-neg/40 bg-neg-dim/20',
  'Alto': 'text-neg border-neg/40 bg-neg-dim/20',
}

const DAY_ORDER = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes']
const DAY_LABELS: Record<string, string> = {
  lunes: 'LUNES', martes: 'MARTES', miércoles: 'MIÉRCOLES', jueves: 'JUEVES', viernes: 'VIERNES',
}

export default function WeeklyCard({ data }: { data: WeeklyCardData }) {
  const riskClass = RISK_TONE[data.riesgo_semanal] ?? 'text-base-muted border-base-line bg-base-panel/40'

  return (
    <div className="relative overflow-hidden rounded-xl border border-brand/30 bg-gradient-to-br from-base-bg via-base-panel to-brand/10 p-6 mb-6">
      <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <p className="text-[10px] text-brand uppercase tracking-[0.3em] mb-1">Entropia Markets — Ficha Semanal</p>
            <h2 className="text-xl font-semibold text-base-text">{data.semana ?? 'Semana sin calendario cargado'}</h2>
          </div>
          <div className="text-right">
            <span className={`inline-block text-sm font-semibold px-3 py-1.5 rounded-lg border ${riskClass}`}>
              Riesgo semanal · {data.riesgo_semanal}
            </span>
            <p className="text-[10px] text-base-muted mt-1.5 max-w-xs">{data.riesgo_justificacion}</p>
          </div>
        </div>

        {/* Narrativa */}
        <div className="mb-5">
          <p className="card-title flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-md bg-base-panel2 flex items-center justify-center shrink-0">
              <IconNarrative className="w-5 h-5 text-brand" />
            </span>
            Narrativa dominante
          </p>
          <div className="card p-4">
            <p className="text-sm text-base-text/85 leading-relaxed">{data.narrativa}</p>
          </div>
        </div>

        {/* 5 días */}
        <div className="mb-5">
          <p className="card-title flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-md bg-base-panel2 flex items-center justify-center shrink-0">
              <IconCalendar className="w-5 h-5 text-brand" />
            </span>
            Calendario macro &amp; earnings
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {DAY_ORDER.map(key => {
              const d = data.dias[key] ?? { eventos: [], estrellas: 0, earnings: [], nota: '', color: '#1a1a1a' }
              return (
                <div key={key} className="rounded-lg border border-base-line bg-base-panel/40 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] px-3 py-2">
                    <p className="text-sm font-bold text-base-bg uppercase tracking-wide">{DAY_LABELS[key]}</p>
                  </div>
                  <div className="p-3.5">
                    {d.estrellas > 0 && (
                      <p className="text-base leading-none mb-2 tracking-tight text-brand">
                        {'★'.repeat(d.estrellas)}<span className="text-base-line">{'★'.repeat(5 - d.estrellas)}</span>
                      </p>
                    )}
                    {d.eventos.length === 0 ? (
                      <p className="text-xs text-base-line">Sin eventos</p>
                    ) : (
                      d.eventos.map((e, i) => <p key={i} className="text-[13px] font-medium text-base-text/90 leading-snug mb-1.5">{e}</p>)
                    )}
                    {d.earnings.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-base-line">
                        <p className="text-[10px] text-brand font-semibold mb-1">EARNINGS</p>
                        {d.earnings.map((e, i) => <p key={i} className="text-xs text-base-muted">{e}</p>)}
                      </div>
                    )}
                    <p className="text-[11px] text-base-muted mt-2 leading-snug">{d.nota}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Escenarios — solo si hay briefing real, nunca porcentajes de relleno */}
        {data.escenario_base && (
          <div className="mb-5">
            <p className="card-title flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-md bg-base-panel2 flex items-center justify-center shrink-0">
                <IconScenarios className="w-5 h-5 text-brand" />
              </span>
              Escenarios
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-lg border border-brand/50 bg-brand/10 p-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div>
                    <span className="text-[10px] text-brand font-semibold uppercase tracking-widest">Base</span>
                    <p className="text-sm font-bold text-base-text mt-1">{data.escenario_base.nombre}</p>
                  </div>
                  <span className="metric-value text-xl text-brand shrink-0">{data.escenario_base.probabilidad}%</span>
                </div>
                {data.escenario_base.justificacion && (
                  <p className="text-[11px] text-base-muted mt-1">{data.escenario_base.justificacion}</p>
                )}
              </div>
              {data.escenarios_alternativos.map((e, i) => (
                <div key={i} className="rounded-lg border border-base-line bg-base-panel/40 p-4">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div>
                      <span className="text-[10px] text-base-muted font-semibold uppercase tracking-widest">Alternativo</span>
                      <p className="text-sm font-bold text-base-text mt-1">{e.nombre}</p>
                    </div>
                    <span className="metric-value text-xl shrink-0">{e.probabilidad}%</span>
                  </div>
                  {e.trigger && <p className="text-[11px] text-base-muted mt-1">Trigger: {e.trigger}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enfoque de la semana */}
        {data.enfoque.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap pt-4 border-t border-base-line/60 mb-5">
            <span className="text-xs font-bold text-base-text flex items-center gap-1.5 shrink-0">ENFOQUE DE LA SEMANA</span>
            {data.enfoque.map((e, i) => (
              <span key={i} className="chain-token flex items-center gap-1.5">
                <TopicIcon tema={e.tema} className="w-3.5 h-3.5 text-brand shrink-0" />
                {e.tema}
              </span>
            ))}
          </div>
        )}

        {/* Agentes activos — cuáles tienen datos reales vs mock */}
        <div className="pt-4 border-t border-base-line/60">
          <p className="text-xs font-bold text-base-text uppercase tracking-wide mb-2">Agentes especialistas</p>
          <div className="flex flex-wrap gap-1.5">
            {data.agentes_activos.map((a, i) => (
              <span key={i}
                className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border ${
                  a.status === 'real' ? 'border-pos/50 bg-pos-dim/20 text-pos' : 'border-base-line bg-base-panel/40 text-base-muted'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'real' ? 'bg-pos' : 'bg-base-muted'}`} />
                {a.nombre.replace('Macro ', '')}
                <span className="opacity-60">{a.fuente}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
