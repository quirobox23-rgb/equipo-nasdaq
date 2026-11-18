'use client'
import { conBase } from '@/lib/base'
import { useState, useEffect, useCallback } from 'react'
import type { MacroEvent }                  from '@/types/macro'
import type { MentorAnalysis, AssetImpact, ScenarioAnalysis } from '@/lib/engines/mentorEngine'
import { knowledgeStore } from '@/lib/dataProvider/KnowledgeBase'

// ── Visual helpers ────────────────────────────────────────────

const BIAS_ARROW: Record<string, string>   = { alcista: '▲', bajista: '▼', neutral: '➡' }
const BIAS_COLOR: Record<string, string>   = { alcista: 'text-pos', bajista: 'text-neg', neutral: 'text-base-muted' }
const BIAS_BG: Record<string, string>      = { alcista: 'bg-pos-dim/50 border-pos/40', bajista: 'bg-neg-dim/50 border-neg/40', neutral: 'bg-base-panel2/50 border-base-line/40' }
const INT_BAR: Record<string, string>      = { alta: 'w-full bg-neg', moderada: 'w-2/3 bg-neutral', baja: 'w-1/3 bg-base-muted' }
const INT_LABEL: Record<string, string>    = { alta: 'ALTA', moderada: 'MED', baja: 'BAJA' }
const CONF_COLOR: Record<string, string>   = { alta: 'text-pos', moderada: 'text-neutral', baja: 'text-base-muted' }

// ── Asset mini card (visual, compact) ─────────────────────────

function AssetMini({ label, impact }: { label: string; impact: AssetImpact }) {
  const arrow  = BIAS_ARROW[impact.bias]  ?? '➡'
  const color  = BIAS_COLOR[impact.bias]  ?? 'text-base-muted'
  const bg     = BIAS_BG[impact.bias]     ?? 'bg-base-panel2/50 border-base-line/40'
  const bar    = INT_BAR[impact.intensity]  ?? 'w-1/3 bg-base-muted'
  const intLbl = INT_LABEL[impact.intensity] ?? '?'
  const confCl = CONF_COLOR[impact.confidence] ?? 'text-base-muted'

  return (
    <div className={`border rounded-lg p-2.5 ${bg}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold font-mono text-base-text/85">{label}</span>
        <span className={`text-lg font-bold leading-none ${color}`}>{arrow}</span>
      </div>
      {/* Intensity bar */}
      <div className="progress-bar h-1.5 mb-1.5">
        <div className={`progress-fill ${bar}`} />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[9px] text-base-muted">{intLbl}</span>
        <span className={`text-[9px] font-medium ${confCl}`}>
          ●{impact.confidence.slice(0,3).toUpperCase()}
        </span>
      </div>
      <p className="text-[10px] text-base-muted mt-1.5 leading-relaxed line-clamp-2">{impact.reasoning}</p>
    </div>
  )
}

// ── Scenario card (visual) ────────────────────────────────────

const SC_STYLES = {
  beat:   { border: 'border-pos/40 bg-pos-dim/10', tag: 'bg-pos-dim/60 text-pos border-pos/40', num: 'S1', prob_color: 'bg-pos' },
  inline: { border: 'border-neutral/40 bg-neutral-dim/10',       tag: 'bg-neutral-dim/60 text-neutral border-neutral/40',         num: 'S2', prob_color: 'bg-neutral'    },
  miss:   { border: 'border-neg/40 bg-neg-dim/10',         tag: 'bg-neg-dim/60 text-neg border-neg/40',             num: 'S3', prob_color: 'bg-neg'     },
}

function ScenarioCard({ sc }: { sc: ScenarioAnalysis }) {
  const [expanded, setExpanded] = useState(sc.type === 'beat')
  const style = SC_STYLES[sc.type]
  const prob  = sc.probability_pct ?? (sc.type === 'beat' ? 30 : sc.type === 'inline' ? 45 : 25)

  return (
    <div className={`border rounded-lg overflow-hidden ${style.border}`}>
      {/* Header — always visible */}
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${style.tag}`}>
          {style.num}
        </span>
        <span className="text-xs font-medium text-base-text/90 flex-1">{sc.label}</span>
        {/* Probability pill */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="progress-bar w-16 h-1.5">
            <div className={`progress-fill ${style.prob_color}`} style={{ width: `${prob}%` }} />
          </div>
          <span className="text-[10px] text-base-muted tabular w-8 text-right font-medium">{prob}%</span>
        </div>
        <span className="text-base-muted text-xs ml-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-base-line/60">
          {/* Asset grid — visual */}
          <div className="grid grid-cols-2 gap-2 pt-3">
            <AssetMini label="NQ / Nasdaq" impact={sc.nq}   />
            <AssetMini label="USD / DXY"   impact={sc.usd}  />
            <AssetMini label="Oro (XAU)"   impact={sc.gold} />
            <AssetMini label="VIX"          impact={sc.vix}  />
          </div>

          {/* Economic chain — compact */}
          <div className="bg-base-panel/60 rounded-md p-2.5">
            <p className="text-[9px] text-base-muted uppercase tracking-widest mb-1">Cadena de transmisión</p>
            <p className="text-[11px] text-base-muted leading-relaxed">{sc.economic_chain}</p>
          </div>

          {/* When fails */}
          <div className="flex gap-2 items-start bg-neutral-dim/20 border border-neutral/30 rounded-md p-2.5">
            <span className="text-neutral text-xs shrink-0 mt-0.5">⚠</span>
            <p className="text-[10px] text-base-muted leading-relaxed">{sc.when_logic_fails}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Combined analysis block ───────────────────────────────────

function CombinedBlock({ combined }: { combined: MentorAnalysis['combined'] }) {
  if (!combined) return null
  const biasStyle = {
    HAWKISH: 'bg-neg-dim/50 border-neg/40 text-neg',
    DOVISH:  'bg-pos-dim/50 border-pos/40 text-pos',
    NEUTRAL: 'bg-base-panel2/60 border-base-line/40 text-base-muted',
  }[combined.macro_bias] ?? 'bg-base-panel2/60 border-base-line/40 text-base-muted'

  return (
    <div className="card p-3 space-y-3">
      <p className="card-title">Análisis combinado</p>
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-base-muted mb-0.5">Driver principal</p>
          <p className="text-xs font-semibold text-neg">★ {combined.main_driver}</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-base-muted mb-0.5">Mayor movedor intradía</p>
          <p className="text-xs font-semibold text-neutral">⚡ {combined.market_mover}</p>
        </div>
        <div>
          <p className="text-[9px] text-base-muted mb-0.5">Sesgo macro</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${biasStyle}`}>
            {combined.macro_bias}
          </span>
        </div>
      </div>
      <div>
        <p className="text-[9px] text-base-muted mb-1">Correlación entre eventos</p>
        <p className="text-[11px] text-base-muted leading-relaxed">{combined.correlation}</p>
      </div>
      {combined.contradictions && (
        <div className="bg-neutral-dim/20 border border-neutral/30 rounded-md p-2.5">
          <p className="text-[9px] text-neutral mb-1">Contradicción / resolución</p>
          <p className="text-[11px] text-base-muted leading-relaxed">{combined.contradictions}</p>
        </div>
      )}
    </div>
  )
}

// ── Market pricing block ──────────────────────────────────────

function MarketPricingBlock({ mp }: { mp: MentorAnalysis['market_pricing'] }) {
  const rskStyle = {
    ALTO:  { bg: 'bg-neg-dim/40 border-neg/40', color: 'text-neg', bar: 'bg-neg w-full' },
    MEDIO: { bg: 'bg-neutral-dim/40 border-neutral/40', color: 'text-neutral', bar: 'bg-neutral w-2/3' },
    BAJO:  { bg: 'bg-base-panel2 border-base-line', color: 'text-base-muted', bar: 'bg-base-muted w-1/3' },
  }[mp.surprise_risk] ?? { bg: 'bg-base-panel2 border-base-line', color: 'text-base-muted', bar: 'bg-base-muted w-1/3' }

  return (
    <div className="space-y-3">
      {/* Surprise risk */}
      <div className={`border rounded-lg p-3 ${rskStyle.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-base-muted uppercase tracking-widest">Riesgo de sorpresa</p>
          <span className={`text-sm font-bold ${rskStyle.color}`}>{mp.surprise_risk}</span>
        </div>
        <div className="progress-bar h-1.5 mb-2">
          <div className={`progress-fill ${rskStyle.bar}`} />
        </div>
        <p className="text-[11px] text-base-muted leading-relaxed">{mp.surprise_risk_reason}</p>
      </div>

      <div className="card p-3 space-y-3">
        {[
          { label: 'Qué descuenta el mercado', value: mp.current_consensus },
          { label: 'Escenario ya descontado', value: mp.priced_scenario },
          { label: 'Expectativas Fed Funds', value: mp.rate_expectations },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[9px] text-base-muted uppercase tracking-widest mb-1">{label}</p>
            <p className="text-[11px] text-base-text/85 leading-relaxed">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-neutral-dim/20 border border-neutral/30 rounded-lg p-3">
        <p className="text-[9px] text-neutral uppercase tracking-widest mb-1">Qué rompe la narrativa</p>
        <p className="text-[11px] text-base-text/85 leading-relaxed">{mp.what_breaks_narrative}</p>
      </div>
    </div>
  )
}

// ── Mentor section collapsible ────────────────────────────────

function MSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-base-line rounded-lg overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-base-panel2/30 text-left">
        <span className="text-xs font-medium text-base-text/85">{title}</span>
        <span className="text-base-muted text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-3 py-2.5"><p className="text-[11px] text-base-muted leading-relaxed">{children}</p></div>}
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────

function LoadingSkeleton({ isMulti }: { isMulti: boolean }) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 rounded-full border-2 border-base-muted border-t-zinc-300 animate-spin" />
        <span className="text-xs text-base-muted">
          {isMulti ? 'Analizando correlaciones entre eventos…' : 'Analizando con IA institucional…'}
        </span>
      </div>
      {[1,2,3].map(i => (
        <div key={i} className="space-y-2">
          <div className="h-3 bg-base-panel2 rounded w-1/3" />
          <div className="h-2 bg-base-panel2/60 rounded w-full" />
          <div className="h-2 bg-base-panel2/60 rounded w-4/5" />
        </div>
      ))}
    </div>
  )
}

// ── Main MentorPanel ──────────────────────────────────────────

type Tab = 'mentor' | 'mercado' | 'escenarios'

interface Props {
  event:   MacroEvent & { notes?: string }
  events?: Array<MacroEvent & { notes?: string }>  // multi-event
}

export function MentorPanel({ event, events }: Props) {
  const isMulti   = !!(events && events.length > 1)
  const [tab, setTab]           = useState<Tab>('mercado')
  const [analysis, setAnalysis] = useState<MentorAnalysis | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [rawDebug, setRawDebug] = useState<string | null>(null)

  // Key changes when event selection changes
  const cacheKey = isMulti
    ? (events ?? []).map(e => e.id).sort().join(',')
    : String(event.id)

  const fetchAnalysis = useCallback(async () => {
    setLoading(true); setError(null); setAnalysis(null); setRawDebug(null)
    try {
      const body = isMulti
        ? { events: (events ?? []).map(e => ({ name: e.name, prev: e.prev, forecast: e.forecast, actual: e.actual, impact: e.impact, notes: e.notes, knowledge: knowledgeStore.get(e.name) })) }
        : { name: event.name, prev: event.prev, forecast: event.forecast, actual: event.actual, notes: event.notes, impact: event.impact, knowledge: knowledgeStore.get(event.name) }

      const res  = await fetch(conBase('/api/analysis'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error ?? 'Error desconocido'); if (data.raw) setRawDebug(data.raw) }
      else setAnalysis(data.analysis)
    } catch (e) { setError(`Error de red: ${String(e)}`) }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  useEffect(() => { fetchAnalysis() }, [fetchAnalysis])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'mercado',    label: 'Mercado'    },
    { key: 'escenarios', label: 'Escenarios' },
    { key: 'mentor',     label: 'Mentor'     },
  ]

  return (
    <div className="space-y-3">
      {/* Multi-event context bar */}
      {isMulti && (
        <div className="bg-base-panel2/40 border border-base-line/40 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-base-muted">Análisis combinado:</span>
          {(events ?? []).map(e => (
            <span key={e.id} className="text-[10px] bg-base-panel2 border border-base-line rounded px-1.5 py-0.5 text-base-text/85">
              {e.name}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-base-line">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            disabled={!analysis && !loading && !error}
            className={`px-4 py-2 text-xs border-b-2 transition-colors ${
              tab === t.key
                ? 'border-base-text text-base-text'
                : 'border-transparent text-base-muted hover:text-base-text/85'
            } disabled:opacity-30 disabled:cursor-default`}>
            {t.label}
          </button>
        ))}
        {analysis && (
          <button onClick={fetchAnalysis} className="ml-auto px-3 text-[10px] text-base-muted hover:text-base-muted transition-colors" title="Regenerar">
            ↺
          </button>
        )}
      </div>

      {/* States */}
      {loading && <LoadingSkeleton isMulti={isMulti} />}

      {error && (
        <div className="bg-neg-dim/30 border border-neg/40 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-neg">Error al generar análisis</p>
          <p className="text-xs text-base-muted">{error}</p>
          {error.includes('ANTHROPIC_API_KEY') ? (
            <p className="text-xs text-base-muted">Añade <code className="bg-base-panel2 px-1 rounded text-base-muted">ANTHROPIC_API_KEY</code> a <code className="bg-base-panel2 px-1 rounded text-base-muted">.env.local</code> y reinicia.</p>
          ) : (
            <button onClick={fetchAnalysis} className="btn-ghost text-xs">Reintentar</button>
          )}
          {rawDebug && (
            <details className="mt-1">
              <summary className="text-[10px] text-base-muted cursor-pointer hover:text-base-muted">Ver respuesta cruda (debug)</summary>
              <pre className="text-[10px] text-base-muted bg-base-bg border border-base-line rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">{rawDebug}</pre>
            </details>
          )}
        </div>
      )}

      {analysis && !loading && (
        <>
          {/* MERCADO */}
          {tab === 'mercado' && (
            <div className="space-y-3">
              {isMulti && analysis.combined && <CombinedBlock combined={analysis.combined} />}
              <MarketPricingBlock mp={analysis.market_pricing} />
            </div>
          )}

          {/* ESCENARIOS — visual */}
          {tab === 'escenarios' && (
            <div className="space-y-2">
              {analysis.scenarios.map(sc => <ScenarioCard key={sc.type} sc={sc} />)}
            </div>
          )}

          {/* MENTOR */}
          {tab === 'mentor' && (
            <div className="space-y-2">
              <MSection title="¿Qué mide exactamente?">{analysis.mentor.what_it_measures}</MSection>
              <MSection title="¿Por qué importa?">{analysis.mentor.why_it_matters}</MSection>
              <MSection title="¿Qué observa la FED?">{analysis.mentor.what_fed_watches}</MSection>
              <MSection title="¿Por qué mueve el mercado?">{analysis.mentor.why_moves_markets}</MSection>
              <MSection title="Comportamiento institucional">{analysis.mentor.institutional_behavior}</MSection>
            </div>
          )}
        </>
      )}
    </div>
  )
}
