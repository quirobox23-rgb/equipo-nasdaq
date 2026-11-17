'use client'
import WeeklyCalendarStrip from '@/components/WeeklyCalendarStrip'
import { useState, useEffect, useCallback, type SVGProps } from 'react'
import { RefreshCw, ChevronRight } from 'lucide-react'
import { getStoredAdminPassword, setStoredAdminPassword, clearStoredAdminPassword } from '@/lib/adminSession'
import { Badge } from '@/components/ui'

// Encabezado de sección (con divisor) — mismo patrón que el resto de la app:
// 12px, bold, uppercase, tracking-widest + línea flex-1. Sin ícono.
function SectionLabel({ children, className = 'text-brand' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="mb-3">
      <span className={`text-xs font-bold uppercase tracking-widest whitespace-nowrap ${className}`}>{children}</span>
    </div>
  )
}

function IconLock(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="4.5" y="9" width="11" height="8" rx="1.8" />
      <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" />
    </svg>
  )
}

// MAPEO DE AGENTES A NOMBRES TEMÁTICOS
// Cada código NOVA-M10X corresponde a un agente temático fijo — mismo
// mapeo que usa el LLM al nombrar agentes en la narrativa del briefing
// (ej. "**NOVA-M101** (Macro Crecimiento)").
const AGENT_CODE_LABELS: Record<string, string> = {
  'NOVA-M101': 'Crecimiento',
  'NOVA-M102': 'Empleo',
  'NOVA-M103': 'Earnings',
  'NOVA-M104': 'Fed',
  'NOVA-M105': 'Geopolítica',
  'NOVA-M106': 'Inflación',
  'NOVA-M107': 'Liquidez',
  'NOVA-M108': 'Renta Fija',
}

// Tipos del briefing de Nova / Agente Macro
interface NovaAgent {
  agent: string
  status: string
  trend: string
  confidence: number
  summary: string
}

interface NovaTension {
  agentes: string
  tension: string
  resolucion: string
}

interface NovaEscenario {
  nombre: string
  probabilidad: number
  justificacion?: string
  trigger?: string
}

interface NovaRiesgo {
  descripcion: string
  fuente: string
  trigger: string
}

interface NovaImplicaciones {
  entorno: string
  activos_favorecidos: string[]
  eventos_clave: string[]
}

interface NovaBriefing {
  narrativa_principal: string
  tensiones_detectadas: NovaTension[]
  escenario_base: NovaEscenario
  escenarios_alternativos: NovaEscenario[]
  riesgos: {
    critico: NovaRiesgo[]
    moderado: NovaRiesgo[]
    vigilar: NovaRiesgo[]
  }
  implicaciones: NovaImplicaciones
  confidence: number
}

interface NovaResponse {
  agent_report: {
    agent: string
    status: string
    trend: string
    confidence: number
    summary: string
  }
  briefing: NovaBriefing | null
  agents: NovaAgent[]
  weekly_card: {
    semana: string | null
    riesgo_semanal: string
    riesgo_justificacion: string
    dias: Record<string, { eventos: string[]; estrellas: number; earnings: string[]; nota: string }>
    enfoque: Array<{ tema: string; icono: string; sub: string }>
  } | null
  generated_at?: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-base-line/60 last:border-0">
      <p className="text-xs text-base-muted uppercase tracking-widest font-medium mb-2">{title}</p>
      <div className="text-[13px] text-base-text/90 leading-relaxed">{children}</div>
    </div>
  )
}

// NUEVA TARJETA MEJORADA DE AGENTES
function AgentCard({ agent }: { agent: NovaAgent }) {
  const category = AGENT_CODE_LABELS[agent.agent]
  const trend = agent.trend.toLowerCase()
  const isBull = trend.includes('alcista') || trend.includes('bull')
  const isBear = trend.includes('bajista') || trend.includes('bear')
  const displayTrend = isBull ? 'ALCISTA' : isBear ? 'BAJISTA' : 'NEUTRA'
  const color = isBull ? 'text-pos' : isBear ? 'text-neg' : 'text-neutral'
  const dot = isBull ? 'bg-pos' : isBear ? 'bg-neg' : 'bg-neutral'
  const bgColor = isBull ? 'bg-pos/5 border-pos/30' : isBear ? 'bg-neg/5 border-neg/30' : 'bg-neutral/5 border-neutral/30'

  return (
    <div className={`${bgColor} border rounded-lg p-4 hover:border-base-muted/60 transition-all`}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs text-base-text uppercase tracking-wider font-semibold">
          {agent.agent}{category && <span className="text-base-muted"> ({category})</span>}
        </span>
        <span className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
      </div>

      <div className={`text-lg font-black uppercase ${color} mb-3`}>{displayTrend}</div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-base-muted">{agent.status}</div>
        <div className={`metric-value text-base ${color}`}>{agent.confidence}%</div>
      </div>
    </div>
  )
}

// El LLM a veces separa párrafos con '\n\n', otras con ' | ' (concatenación
// de puntos de vista por agente) — probamos el más específico primero y
// caemos al otro si no partió nada.
function splitParagraphs(text: string): string[] {
  const byDouble = text.split('\n\n').map(p => p.trim()).filter(Boolean)
  if (byDouble.length > 1) return byDouble
  const byPipe = text.split(' | ').map(p => p.trim()).filter(Boolean)
  return byPipe.length > 1 ? byPipe : [text]
}

// El LLM marca énfasis (ej. el nombre del agente, "**NOVA-M101**") con
// markdown bold — lo parseamos a <strong> en vez de mostrar los asteriscos.
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-bold text-base-text">{part.slice(2, -2)}</strong>
      : part
  )
}

// COMPONENTE PARA NARRATIVA ESTRUCTURADA (separar en párrafos)
function NarrativaSection({ text }: { text: string }) {
  const parrafos = splitParagraphs(text)

  return (
    <div className="space-y-3">
      {parrafos.map((parrafo, i) => (
        <p key={i} className="text-sm leading-relaxed text-base-text/90">
          {renderBold(parrafo)}
        </p>
      ))}
    </div>
  )
}

// COMPONENTE MEJORADO PARA IMPLICACIONES
function ImplicacionesSection({ implicaciones }: { implicaciones: NovaImplicaciones }) {
  return (
    <div className="space-y-4">
      {/* Entorno */}
      <div className="bg-base-panel2/30 border border-base-line/40 rounded-lg p-4">
        <SectionLabel>Entorno Macro</SectionLabel>
        <div className="space-y-3">
          {splitParagraphs(implicaciones.entorno).map((parrafo, i) => (
            <p key={i} className="text-sm text-base-text leading-relaxed">{parrafo}</p>
          ))}
        </div>
      </div>

      {/* Activos Favorecidos */}
      <div className="bg-base-panel2/30 border border-base-line/40 rounded-lg p-4">
        <SectionLabel>Activos Favorecidos</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {implicaciones.activos_favorecidos.map((activo, i) => (
            <span key={i} className="inline-block px-3 py-1.5 bg-brand/10 border border-brand/40 rounded text-xs font-semibold text-brand">
              {activo}
            </span>
          ))}
        </div>
      </div>

      {/* Eventos Clave */}
      <div className="bg-base-panel2/30 border border-base-line/40 rounded-lg p-4">
        <SectionLabel>Eventos Clave Esta Semana</SectionLabel>
        <div className="space-y-2">
          {implicaciones.eventos_clave.map((evento, i) => (
            <div key={i} className="flex items-start gap-2">
              <ChevronRight size={14} className="text-brand shrink-0 mt-0.5" />
              <span className="text-sm text-base-text">{evento}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Pantalla de acceso — sin clave válida, no se ve ni se genera nada ──

function LockedScreen({ onUnlock }: { onUnlock: (password: string) => void }) {
  const [input, setInput] = useState('')

  return (
    <div className="max-w-md mx-auto mt-16 text-center">
      <div className="w-12 h-12 rounded-full bg-base-panel2 border border-base-line flex items-center justify-center mx-auto mb-4 text-brand">
        <IconLock className="w-6 h-6" />
      </div>
      <h1 className="text-xl font-display font-semibold text-base-text mb-2">Mentor IA</h1>
      <p className="text-sm text-base-muted mb-6">
        Disponible próximamente para miembros de la academia. Si eres administrador, introduce la clave de acceso.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input) onUnlock(input) }}
          placeholder="Clave de acceso"
          className="mit-input flex-1 text-sm"
        />
        <button
          onClick={() => input && onUnlock(input)}
          className="btn-primary text-sm px-4"
        >
          Entrar
        </button>
      </div>
    </div>
  )
}

export default function MentorIAPage() {
  const [password, setPassword] = useState<string | null>(null)
  const [nova, setNova] = useState<NovaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    setPassword(getStoredAdminPassword())
  }, [])

  const fetchLatest = useCallback((pw: string) => {
    setLoading(true)
    setError(null)
    fetch('/api/nova/latest', { headers: { 'x-admin-password': pw } })
      .then(async res => {
        if (res.status === 401) {
          clearStoredAdminPassword()
          setPassword(null)
          setAuthError(true)
          return null
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Error ${res.status}`)
        }
        return res.json()
      })
      .then((data: NovaResponse & { available?: boolean } | null) => {
        if (data === null) return
        setAuthError(false)
        setNova(data.available === false ? null : data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'No se pudo conectar')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (password) fetchLatest(password)
    else setLoading(false)
  }, [password, fetchLatest])

  function handleUnlock(pw: string) {
    setStoredAdminPassword(pw)
    setPassword(pw)
  }

  function handleGenerate() {
    if (!password) return
    setGenerating(true)
    setError(null)
    fetch('/api/nova/generate', { method: 'POST', headers: { 'x-admin-password': password } })
      .then(async res => {
        if (res.status === 401) {
          clearStoredAdminPassword()
          setPassword(null)
          return null
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Error ${res.status}`)
        }
        return res.json()
      })
      .then((data: NovaResponse | null) => {
        if (data) setNova(data)
        setGenerating(false)
      })
      .catch(err => {
        setError(err.message || 'No se pudo generar el briefing')
        setGenerating(false)
      })
  }

  if (!password) {
    return (
      <div>
        <LockedScreen onUnlock={handleUnlock} />
        {authError && (
          <p className="text-center text-xs text-neg mt-4">Clave incorrecta.</p>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse mx-auto mb-3" />
          <p className="text-base-muted text-sm">Cargando el último briefing…</p>
        </div>
      </div>
    )
  }

  if (!nova) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <p className="text-base-text text-sm mb-2">Aún no se ha generado el briefing de esta semana.</p>
        <p className="text-base-muted text-xs mb-6">Esto consume créditos de Anthropic — solo generadlo cuando esté lista la semana.</p>
        <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm px-5 disabled:opacity-50">
          {generating ? 'Generando…' : <><RefreshCw size={14} /> Generar briefing semanal</>}
        </button>
        {error && <p className="text-xs text-neg mt-3">{error}</p>}
      </div>
    )
  }

  const briefing = nova.briefing
  const report = nova.agent_report
  const agents = nova.agents || []
  const systemConfidence = briefing?.confidence ?? report?.confidence ?? 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {nova.weekly_card && <WeeklyCalendarStrip data={nova.weekly_card} />}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-base-line pb-4">
        <div>
          <p className="section-label mb-1">Mentor IA</p>
          <h1 className="text-xl font-display font-semibold text-base-text">Briefing Ejecutivo</h1>
          {nova.generated_at && (
            <p className="text-xs text-base-muted mt-1">Generado: {new Date(nova.generated_at).toLocaleString('es-ES')}</p>
          )}
        </div>
        <button onClick={handleGenerate} disabled={generating} className="btn-ghost text-xs px-3 py-2 disabled:opacity-50 shrink-0">
          {generating ? 'Generando…' : <><RefreshCw size={12} /> Regenerar</>}
        </button>
      </div>
      {error && <p className="text-xs text-neg">{error}</p>}

      {/* Agent Grid - MEJORADO CON NOMBRES TEMÁTICOS */}
      <div>
        <SectionLabel>Panel de Agentes Macro</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {agents.map((a, i) => (
              <AgentCard key={i} agent={a} />
            ))}
          </div>
          <div className="bg-base-panel2/30 border border-base-line/40 rounded-lg p-4 flex flex-col items-center justify-center text-center">
            <div className="text-[15px] font-bold text-base-text mb-1">Confianza del sistema</div>
            <div className="font-mono text-[48px] font-bold text-brand leading-none">{systemConfidence}<span className="text-lg text-base-muted">%</span></div>
          </div>
        </div>
      </div>

      {/* Briefing */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: Briefing */}
        <div className="lg:col-span-3">
          <div className="card p-6">
            <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-base-line">
              <span className="font-display text-base font-black text-base-text uppercase tracking-wide">Briefing Ejecutivo — Agente Macro</span>
              {briefing ? (
                <span className="ml-auto"><Badge variant="pos">LLM Activo</Badge></span>
              ) : (
                <span className="ml-auto"><Badge variant="neutral">Fallback Mecánico</Badge></span>
              )}
            </div>

            {briefing ? (
              <div className="space-y-6">

                {/* NARRATIVA MEJORADA - PÁRRAFOS SEPARADOS */}
                <div className="pb-4 border-b border-base-line/60">
                  <SectionLabel>Narrativa Dominante</SectionLabel>
                  <NarrativaSection text={briefing.narrativa_principal} />
                </div>

                {briefing.tensiones_detectadas.length > 0 && (
                  <div className="pb-4 border-b border-base-line/60">
                    <SectionLabel>Tensiones Detectadas</SectionLabel>
                    <div className="space-y-3">
                      {briefing.tensiones_detectadas.map((t, i) => (
                        <div key={i} className="bg-base-panel2/30 border border-base-line/40 rounded-lg p-3">
                          <div className="text-sm font-semibold text-base-text mb-1">{t.agentes}</div>
                          <div className="text-xs text-base-text/80 mb-2">{t.tension}</div>
                          <div className="text-xs text-brand">→ {t.resolucion}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pb-4 border-b border-base-line/60">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-base-muted uppercase tracking-widest font-semibold">Escenario Base</p>
                    <span className="text-xs font-bold font-mono text-brand">{briefing.escenario_base.probabilidad}%</span>
                  </div>
                  <div className="bg-base-panel2/30 border border-base-line/40 rounded-lg p-4">
                    <p className="text-sm font-semibold text-base-text mb-2">{briefing.escenario_base.nombre}</p>
                    <p className="text-xs text-base-text/80 leading-relaxed">{briefing.escenario_base.justificacion}</p>
                  </div>
                </div>

                {briefing.escenarios_alternativos.length > 0 && (
                  <div className="pb-4 border-b border-base-line/60">
                    <SectionLabel>Escenarios Alternativos</SectionLabel>
                    <div className="space-y-2">
                      {briefing.escenarios_alternativos.map((e, i) => (
                        <div key={i} className="bg-base-panel2/30 border border-base-line/40 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-1">
                            <div className="text-sm font-semibold text-base-text">{e.nombre}</div>
                            <span className={`text-xs font-mono font-bold ${e.probabilidad > 25 ? 'text-neg' : 'text-neutral'}`}>
                              {e.probabilidad}%
                            </span>
                          </div>
                          <div className="text-xs text-base-muted">Trigger: {e.trigger}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pb-4 border-b border-base-line/60">
                  <SectionLabel>Riesgos Jerarquizados</SectionLabel>
                  <div className="space-y-2">
                    {briefing.riesgos.critico.map((r, i) => (
                      <div key={i} className="bg-neg/5 border border-neg/20 rounded-lg p-3">
                        <div className="flex gap-2">
                          <span className="text-neg text-sm font-bold mt-0.5">●</span>
                          <div>
                            <div className="text-xs font-semibold text-base-text">{r.descripcion}</div>
                            <div className="text-xs text-base-muted mt-1">{r.fuente} — Trigger: {r.trigger}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {briefing.riesgos.moderado.map((r, i) => (
                      <div key={i} className="bg-neutral/5 border border-neutral/20 rounded-lg p-3">
                        <div className="flex gap-2">
                          <span className="text-neutral text-sm font-bold mt-0.5">●</span>
                          <div>
                            <div className="text-xs font-semibold text-base-text">{r.descripcion}</div>
                            <div className="text-xs text-base-muted mt-1">{r.fuente} — Trigger: {r.trigger}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* IMPLICACIONES MEJORADA - TARJETAS SEPARADAS */}
                <div>
                  <SectionLabel>Implicaciones para la Toma de Decisiones</SectionLabel>
                  <ImplicacionesSection implicaciones={briefing.implicaciones} />
                </div>

              </div>
            ) : (
              <div className="text-base-muted text-sm">
                <p className="mb-2">Agente Macro está operativo pero el motor de razonamiento LLM no está disponible.</p>
                <p className="text-xs text-base-muted">Verifica que ANTHROPIC_API_KEY esté configurada y que tengas créditos disponibles en Anthropic.</p>
                <div className="mt-4 p-3 bg-base-panel2 rounded border border-base-line">
                  <div className="text-xs text-base-text">Tendencia mecánica: {report?.trend} | Confianza: {report?.confidence}%</div>
                  <div className="text-xs text-base-muted mt-1">{report?.summary}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Summary Card */}
        <div className="lg:col-span-2">
          <div className="card p-5 sticky top-20">
            <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-base-line">
              <span className="font-display text-base font-black text-base-text uppercase tracking-wide">Resumen del Sistema</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-base-muted">Agentes activos</span>
                <span className="text-base-text font-mono">{agents.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-muted">Tendencia global</span>
                <span className={`font-medium ${report?.trend.toLowerCase().includes('alcista') ? 'text-pos' : report?.trend.toLowerCase().includes('bajista') ? 'text-neg' : 'text-base-text'}`}>
                  {report?.trend || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-muted">Confianza</span>
                <span className="text-brand font-mono">{report?.confidence ?? 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-muted">Motor LLM</span>
                <span className={briefing ? 'text-pos' : 'text-base-muted'}>
                  {briefing ? 'Claude Sonnet 4.6' : 'No disponible'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-base-line">
              <SectionLabel>Distribución de Señales</SectionLabel>
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-base-line">
                {(() => {
                  const bull = agents.filter(a => a.trend.toLowerCase().includes('alcista')).length
                  const bear = agents.filter(a => a.trend.toLowerCase().includes('bajista')).length
                  const neu = agents.length - bull - bear
                  const total = agents.length || 1
                  return (
                    <>
                      <div className="bg-pos" style={{ width: `${(bull / total) * 100}%` }} />
                      <div className="bg-neg" style={{ width: `${(bear / total) * 100}%` }} />
                      <div className="bg-base-muted" style={{ width: `${(neu / total) * 100}%` }} />
                    </>
                  )
                })()}
              </div>
              <div className="flex justify-between text-xs text-base-muted mt-1">
                <span>{agents.filter(a => a.trend.toLowerCase().includes('alcista')).length} Alcistas</span>
                <span>{agents.filter(a => a.trend.toLowerCase().includes('bajista')).length} Bajistas</span>
                <span>{agents.filter(a => !a.trend.toLowerCase().includes('alcista') && !a.trend.toLowerCase().includes('bajista')).length} Neutrales</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-base-line">
              <SectionLabel>Estado</SectionLabel>
              <p className="text-xs text-base-muted leading-relaxed">
                {briefing
                  ? 'Agente Macro ha generado un briefing con razonamiento de IA sobre los 8 agentes especializados.'
                  : 'Agente Macro está funcionando en modo fallback mecánico sin motor de razonamiento LLM.'}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="text-center text-xs text-base-muted pt-4 border-t border-base-line">
        Agente Macro — Generado por 8 agentes especializados + Claude Sonnet 4.6 — No es consejo de inversión
      </div>
    </div>
  )
}