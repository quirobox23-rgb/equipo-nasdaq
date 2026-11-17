'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Check, Copy, ExternalLink, Lightbulb, Maximize2, Pencil, X } from 'lucide-react'
import { Callout as IconCallout } from '@/components/ui'
import type { Chart, WeeklyAnalysis } from '@/lib/weekly/types'
import { chartMissing, chartTitle, parseTvLink } from '@/lib/weekly/tradingview'
import { cuando, IDEA_CENTRAL, marcarAnalisisVisto, marcarBloqueVisto, pendientes, type Pendientes } from '@/lib/weekly/novedades'
import { WeeklyBlockForm, type EditField } from './WeeklyBlockForm'

// Análisis Semanal de NQ con la misma estructura que el PDF semanal
// (01 Resumen … 10 Conclusión). Se muestra por bloques: la idea central
// siempre arriba, un índice a la derecha (desplegable si no entra) y un
// bloque a la vez, para no tener una página larguísima. Cada bloque tiene
// "Copiar para Discord" para el equipo (mockup: docs/mockups/analisis-semanal.html).

// Conceptos fijos de opciones (no dependen de la semana).
const GAMMA = [
  ['Gamma positiva', 'Las coberturas de algunos dealers pueden amortiguar oscilaciones y favorecer rangos.'],
  ['Gamma negativa', 'Las coberturas pueden amplificar movimientos y rupturas.'],
  ['Gamma flip', 'Nivel estimado donde cambia el signo de exposición gamma.'],
  ['Call wall / Put wall', 'Strikes con exposición importante; no son soportes/resistencias garantizados.'],
]

/** Etiqueta mientras el Análisis Semanal está en prueba (también la usa la página sin análisis). */
export function BetaBadge() {
  return <span className="badge badge-brand shrink-0">En beta</span>
}

const PROSE = 'text-[13.5px] leading-relaxed text-base-text/90'
const VALIDAR_NIVEL =
  'Una mecha aislada no confirma ruptura. Buscá cierres, aceptación, retesteos, reacción de compradores/vendedores y un punto ' +
  'claro de invalidación. Los precios son zonas de estudio, no órdenes automáticas.'

/** Tabla simple que en móvil pasa a tarjetas apiladas. */
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const cols = head.length === 2 ? 'md:grid-cols-[minmax(140px,1fr)_3fr]' : 'md:grid-cols-[minmax(90px,1fr)_2fr_2fr]'
  return (
    <div className="card overflow-hidden">
      <div className={`hidden md:grid ${cols} gap-4 px-4 py-2.5 bg-base-panel2 text-[11px] font-bold uppercase tracking-wide text-base-muted`}>
        {head.map(h => <span key={h}>{h}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} className={`grid grid-cols-1 ${cols} gap-1 md:gap-4 px-4 py-3 border-t border-base-line first:border-t-0 md:first:border-t text-[13px] leading-relaxed`}>
          {r.map((c, j) => (
            <div key={j} className={j === 0 ? 'font-semibold text-base-text' : 'text-base-text/85'}>
              <span className="md:hidden block text-[10.5px] uppercase tracking-wide text-base-muted">{j > 0 ? head[j] : ''}</span>
              {c}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Callout({ label, children, tone = 'green' }: { label: string; children: ReactNode; tone?: 'green' | 'amber' }) {
  return (
    <div className={`callout ${tone === 'green' ? 'callout-green' : 'callout-amber'} block px-4 py-3.5`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-base-muted mb-1">{label}</p>
      <p className="text-[13.5px] leading-relaxed text-base-text">{children}</p>
    </div>
  )
}

// ── Texto para Discord ───────────────────────────────────────────────────
// Discord no muestra tablas: cada fila pasa a una viñeta con la primera
// columna en negrita (o como código, para los niveles de precio).
const bold = (t: string) => `**${t}**`
const rowsToList = (rows: string[][], code = false) =>
  rows.map(([first, ...rest]) => `• ${code ? `\`${first}\`` : bold(first)} — ${rest.filter(Boolean).join(' · ')}`)
const quote = (label: string, text: string) => (text.trim() ? [`> ${bold(`${label}:`)} ${text}`] : [])

// Campos que se corrigen desde cada tarjeta ("Editar", solo equipo).
const EDIT: Record<string, EditField[]> = {
  'Idea central': [{ kind: 'text', key: 'idea_central', label: 'La idea central' }],
  Resumen: [{ kind: 'rows', key: 'catalizadores', label: 'Catalizadores', cols: [
    { k: 'catalizador', label: 'Catalizador' }, { k: 'significado', label: 'Qué significa para Nasdaq', long: true }] }],
  Calendario: [{ kind: 'rows', key: 'calendario', label: 'Días', cols: [
    { k: 'dia', label: 'Día' }, { k: 'eventos', label: 'Eventos a seguir', long: true }, { k: 'pregunta', label: 'Pregunta educativa', long: true }] }],
  Earnings: [
    { kind: 'rows', key: 'earnings', label: 'Empresas', cols: [
      { k: 'empresa', label: 'Empresa' }, { k: 'observar', label: 'Qué observar', long: true }, { k: 'importancia', label: 'Por qué importa', long: true }] },
    { kind: 'text', key: 'earnings_ejemplo', label: 'Ejemplo' },
  ],
  'OPEX y VIX': [{ kind: 'text', key: 'opex_vix', label: 'OPEX y VIX de la semana' }],
  Macro: [{ kind: 'text', key: 'macro', label: 'Macro' }],
  Niveles: [{ kind: 'rows', key: 'niveles', label: 'Niveles (de mayor a menor)', cols: [
    { k: 'zona', label: 'Zona', mono: true }, { k: 'lectura', label: 'Lectura y función', long: true }] }],
  'Gráficos': [{ kind: 'charts', key: 'graficos', label: 'Gráficos de TradingView' }],
  Ejemplos: [{ kind: 'rows', key: 'ejemplos', label: 'Ejemplos', cols: [
    { k: 'titulo', label: 'Título' }, { k: 'texto', label: 'Texto', long: true }] }],
  Escenarios: [
    { kind: 'rows', key: 'escenarios', label: 'Escenarios', cols: [
      { k: 'escenario', label: 'Escenario' }, { k: 'condicion', label: 'Qué tendría que pasar', long: true }, { k: 'referencias', label: 'Siguientes referencias', long: true }] },
    { kind: 'text', key: 'lectura_por_dia', label: 'Lectura por día' },
  ],
  Checklist: [{ kind: 'list', key: 'checklist', label: 'Checklist' }],
  'Conclusión': [{ kind: 'text', key: 'conclusion', label: 'Conclusión semanal' }],
}

interface Block {
  label: string
  title: string
  empty?: boolean
  content: ReactNode
  /** Líneas del bloque para pegar en Discord (sin el título). */
  discord: string[]
}

/**
 * `canCopy`: botón "Copiar para Discord". `onSave`: botón "Editar" en cada
 * bloque; guarda los campos cambiados en el análisis publicado (solo equipo).
 */
export function WeeklyAnalysisView({ a, canCopy = false, onSave, trackNovedades = false }: {
  a: WeeklyAnalysis
  canCopy?: boolean
  /** `aviso`: qué apartado se cambió y si hay que avisarles a los alumnos. */
  onSave?: (patch: Partial<WeeklyAnalysis>, aviso?: { bloque: string; avisar: boolean }) => Promise<void>
  /** Marcar novedades (puntos en el índice y aviso arriba) y anotar lo que el alumno va viendo. */
  trackNovedades?: boolean
}) {
  const [tab, setTab] = useState(0)
  const [copied, setCopied] = useState<number | null>(null)
  // Bloque que se está editando ('Idea central' o la etiqueta del bloque) y su copia de trabajo.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft]     = useState<WeeklyAnalysis>(a)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [zoom, setZoom]       = useState<string | null>(null)
  const [avisar, setAvisar]   = useState(true)
  // Novedades: lo que había sin ver al entrar (para el aviso de arriba) y lo que sigue sin ver.
  const [aviso, setAviso]     = useState<{ texto: string; cuando?: string } | null>(null)
  const [pend, setPend]       = useState<Pendientes | null>(null)
  // Solo los gráficos con un link de TradingView que tenga imagen.
  const charts = (a.graficos ?? []).filter(c => parseTvLink(c.link).ok)
  const all: Block[] = [
    {
      label: 'Resumen',
      title: '¿Qué puede mover el NQ?',
      empty: a.catalizadores.length === 0,
      content: <Table head={['Catalizador', 'Qué significa para Nasdaq']} rows={a.catalizadores.map(c => [c.catalizador, c.significado])} />,
      discord: rowsToList(a.catalizadores.map(c => [c.catalizador, c.significado])),
    },
    {
      label: 'Calendario',
      title: 'Calendario de la semana',
      empty: a.calendario.length === 0,
      content: (
        <>
          <Table head={['Día', 'Eventos a seguir', 'Pregunta educativa']} rows={a.calendario.map(c => [c.dia, c.eventos, c.pregunta])} />
          <p className="text-xs text-base-muted">Horas de Nueva York (ET). Los horarios deben contrastarse con calendarios oficiales antes de operar.</p>
        </>
      ),
      discord: [...rowsToList(a.calendario.map(c => [c.dia, c.eventos, c.pregunta])), '_Horas de Nueva York (ET)._'],
    },
    {
      label: 'Earnings',
      title: 'Earnings: cómo leerlos sin complicarse',
      empty: a.earnings.length === 0 && !a.earnings_ejemplo.trim(),
      content: (
        <>
          {a.earnings.length > 0 && (
            <Table head={['Empresa', 'Qué observar', 'Por qué importa']} rows={a.earnings.map(e => [e.empresa, e.observar, e.importancia])} />
          )}
          {a.earnings_ejemplo.trim() && <Callout label="Ejemplo" tone="amber">{a.earnings_ejemplo}</Callout>}
        </>
      ),
      discord: [...rowsToList(a.earnings.map(e => [e.empresa, e.observar, e.importancia])), ...quote('Ejemplo', a.earnings_ejemplo)],
    },
    {
      label: 'OPEX y VIX',
      title: 'OPEX, VIX y gamma explicados',
      content: (
        <>
          <p className={PROSE}>{a.opex_vix}</p>
          <Table head={['Concepto', 'Explicación sencilla']} rows={GAMMA.map(g => [g[0], g[1]])} />
          <p className="text-xs text-base-muted">Sin datos de opciones en vivo no se puede afirmar dónde están el gamma flip, el call wall o el put wall.</p>
        </>
      ),
      discord: [a.opex_vix, ...rowsToList(GAMMA)],
    },
    {
      label: 'Macro',
      title: '¿Por qué importan las tasas?',
      empty: !a.macro.trim(),
      content: <p className={PROSE}>{a.macro}</p>,
      discord: [a.macro],
    },
    {
      label: 'Niveles',
      title: 'Mapa de niveles NQ',
      empty: a.niveles.length === 0,
      content: (
        <>
          <Table head={['Zona', 'Lectura y función']} rows={a.niveles.map(l => [<span key="z" className="font-mono">{l.zona}</span>, l.lectura])} />
          <Callout label="Cómo validar un nivel">{VALIDAR_NIVEL}</Callout>
        </>
      ),
      discord: [...rowsToList(a.niveles.map(l => [l.zona, l.lectura]), true), ...quote('Cómo validar un nivel', VALIDAR_NIVEL)],
    },
    {
      label: 'Gráficos',
      title: 'Gráficos del analista',
      // Sin gráficos el apartado no se muestra a los alumnos; el equipo lo ve para poder cargarlos.
      empty: charts.length === 0 && !onSave,
      content: charts.length > 0 ? (
        <div className="flex flex-col gap-5">
          <p className={PROSE}>Usá los gráficos para ubicar los niveles del mapa en el precio, no como señales de entrada.</p>
          {charts.map((c, i) => (
            <div key={i} className={`flex flex-col gap-2.5 ${i > 0 ? 'border-t border-base-line pt-5' : ''}`}>
              <ChartCard c={c} onZoom={setZoom} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-base-muted">
          Todavía no hay gráficos (los alumnos no ven este apartado hasta que haya uno). Tocá <b className="text-base-text">Editar</b> y pegá el link de la captura de TradingView.
        </p>
      ),
      discord: [
        'Usá los gráficos para ubicar los niveles del mapa en el precio, no como señales de entrada.',
        // Discord muestra la imagen sola a partir del link.
        ...charts.flatMap(c => {
          const tv = parseTvLink(c.link)
          return ['', bold(chartTitle(c) || 'Gráfico'), ...(c.nota.trim() ? [c.nota] : []), tv.ok ? tv.url : c.link]
        }),
      ],
    },
    {
      label: 'Ejemplos',
      title: 'Ejemplos prácticos',
      empty: a.ejemplos.length === 0,
      content: (
        <div className="space-y-2.5">
          {a.ejemplos.map((e, i) => (
            <p key={i} className={PROSE}>
              <span className="font-bold text-base-text">{e.titulo}: </span>{e.texto}
            </p>
          ))}
        </div>
      ),
      discord: a.ejemplos.map(e => `${bold(`${e.titulo}:`)} ${e.texto}`),
    },
    {
      label: 'Escenarios',
      title: 'Escenarios y lectura por día',
      empty: a.escenarios.length === 0 && !a.lectura_por_dia.trim(),
      content: (
        <>
          {a.escenarios.length > 0 && (
            <Table head={['Escenario', 'Qué tendría que pasar', 'Siguientes referencias']} rows={a.escenarios.map(e => [e.escenario, e.condicion, e.referencias])} />
          )}
          {a.lectura_por_dia.trim() && <p className={PROSE}>{a.lectura_por_dia}</p>}
        </>
      ),
      discord: [...rowsToList(a.escenarios.map(e => [e.escenario, e.condicion, e.referencias])), a.lectura_por_dia],
    },
    {
      label: 'Checklist',
      title: 'Checklist para la comunidad',
      empty: a.checklist.length === 0,
      content: (
        <ul className="space-y-1.5">
          {a.checklist.map((c, i) => (
            <li key={i} className="flex gap-2 text-[13.5px] text-base-text/90"><span className="text-base-muted">☐</span>{c}</li>
          ))}
        </ul>
      ),
      discord: a.checklist.map(c => `☐ ${c}`),
    },
    {
      label: 'Conclusión',
      title: 'Conclusión semanal',
      empty: !a.conclusion.trim(),
      content: <p className={PROSE}>{a.conclusion}</p>,
      discord: [a.conclusion],
    },
  ]
  // Los apartados vacíos (p. ej. un análisis escrito a mano sin earnings) no se muestran.
  const blocks = all.map((b, i) => ({ ...b, n: String(i + 1).padStart(2, '0') })).filter(b => !b.empty)
  const cur = Math.max(0, Math.min(tab, blocks.length - 1))
  const block = blocks[cur]
  const prev = blocks[cur - 1]
  const next = blocks[cur + 1]
  const go = (i: number) => { setTab(Math.max(0, Math.min(blocks.length - 1, i))); setCopied(null); setEditing(null) }

  // Al entrar: armar el aviso con lo que había sin ver y marcar el análisis como visto.
  // Se arma una sola vez por análisis (si el efecto corre dos veces, la segunda ya lo encontraría visto).
  const avisoDe = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!trackNovedades || avisoDe.current === (a.publicadoEn ?? '')) return
    avisoDe.current = a.publicadoEn ?? ''
    const p = pendientes(a)
    if (p.nuevo) {
      setAviso({ texto: `Nuevo análisis de la semana ${a.semana}` })
    } else if (p.bloques.length > 0) {
      const ultimo = p.bloques.map(b => a.novedades?.[b] ?? '').sort().at(-1)
      setAviso({ texto: `El analista actualizó ${lista(p.bloques.map(b => (b === IDEA_CENTRAL ? 'la idea central' : b)))}`, cuando: ultimo })
    } else {
      setAviso(null)
    }
    marcarAnalisisVisto(a)
    // Apartados que cambiaron pero hoy no se muestran (quedaron vacíos): no se pueden abrir, cuentan como vistos.
    const visibles = new Set(blocks.map(b => b.label))
    marcarBloqueVisto(a, p.bloques.filter(b => b !== IDEA_CENTRAL && !visibles.has(b)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackNovedades, a.publicadoEn])

  // El apartado abierto queda visto; se recalculan los puntos del índice.
  const curLabel = block?.label
  useEffect(() => {
    if (!trackNovedades) return
    if (curLabel && pendientes(a).bloques.includes(curLabel)) marcarBloqueVisto(a, [curLabel])
    setPend(pendientes(a))
  }, [trackNovedades, a, curLabel])

  function startEdit(label: string) {
    setDraft(a); setEditing(label); setError(null); setAvisar(true)
  }

  async function saveEdit() {
    if (!editing || !onSave) return
    setSaving(true); setError(null)
    const patch = Object.fromEntries(EDIT[editing].map(f => [f.key, draft[f.key]])) as Partial<WeeklyAnalysis>
    // Cada gráfico tiene que decir qué activo y qué temporalidad muestra.
    const incompletos = (draft.graficos ?? []).map((c, i) => ({ i, falta: chartMissing(c) })).filter(x => x.falta.length > 0)
    if (editing === 'Gráficos' && incompletos.length > 0) {
      setError(`Elegí el activo y la temporalidad del gráfico ${incompletos.map(x => x.i + 1).join(', ')} antes de guardar.`)
      setSaving(false)
      return
    }
    try {
      await onSave(patch, { bloque: editing, avisar })
      // Quien lo guarda ya lo vio: no le aparece como novedad.
      if (trackNovedades) marcarBloqueVisto(a, [editing])
      setEditing(null)
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const editForm = (label: string) => (
    <div className="flex flex-col gap-4">
      <p className="callout callout-amber block px-3.5 py-2.5 text-[12.5px] text-base-text">
        Al guardar, el cambio se publica: lo ven todos los alumnos.
      </p>
      <WeeklyBlockForm fields={EDIT[label]} a={draft} onChange={patch => setDraft(d => ({ ...d, ...patch }))} />
      {error && (
        <div role="alert" className="callout callout-red flex-nowrap items-start gap-2.5 px-3.5 py-3 text-[13px] text-base-text">
          <AlertCircle size={16} className="text-neg shrink-0 mt-px" /><span>{error}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3">
        <label className="mr-auto flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" checked={avisar} onChange={e => setAvisar(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#3B82F6]" />
          <span>
            <span className="block text-[13px] font-semibold text-base-text">Avisar a los alumnos</span>
            <span className="block text-xs text-base-muted">Les aparece como novedad. Destildala si es una corrección chica.</span>
          </span>
        </label>
        <div className="flex gap-2">
        <button onClick={() => setEditing(null)} disabled={saving} className="btn-ghost px-4 py-2 text-sm disabled:opacity-60">Cancelar</button>
        <button onClick={saveEdit} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        </div>
      </div>
    </div>
  )

  async function copy() {
    if (!block) return
    // Las líneas vacías ('') separan; las que quedan en blanco por falta de dato se omiten.
    const text = [`${bold(block.title)} · NQ ${a.semana}`, ...block.discord.filter(l => l === '' || l.trim())].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(cur)
    } catch { /* el navegador no dejó copiar: el botón queda igual */ }
  }

  return (
    <article className="space-y-6">
      <header>
        <p className="section-label mb-1">Análisis Semanal</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-display font-semibold text-base-text">Nasdaq NQ · Análisis semanal</h1>
          <BetaBadge />
        </div>
        <p className="text-[13px] text-base-muted mt-1.5">
          <b className="font-semibold text-base-text">{a.semana}</b> · Guía educativa para entender los eventos y planificar escenarios.
        </p>
        {aviso && (
          <div className="mt-3.5 inline-flex max-w-full items-center gap-2.5 rounded-lg border border-brand/25 bg-brand/[.06] py-2 pl-3.5 pr-2 text-[13px]">
            <Dot />
            <span className="min-w-0">
              <b className="font-semibold text-base-text">{aviso.texto}</b>
              {aviso.cuando && <span className="text-base-muted"> · {cuando(aviso.cuando)}</span>}
            </span>
            <button onClick={() => setAviso(null)} aria-label="Ocultar aviso" className="shrink-0 rounded p-1 text-base-faint hover:text-base-text">
              <X size={14} />
            </button>
          </div>
        )}
      </header>

      {editing === 'Idea central' ? (
        <div className="rounded-xl border border-base-line bg-base-panel p-4 md:p-[18px]">{editForm('Idea central')}</div>
      ) : (
        // Lo primero que hay que leer: callout del styleguide, con ícono y texto más grande.
        <IconCallout
          color="green"
          icon={<Lightbulb size={20} />}
          label="La idea central"
          cta={onSave && !editing ? <EditButton onClick={() => startEdit('Idea central')} className="self-start" /> : undefined}
        >
          <span className="text-[15px]">{a.idea_central}</span>
        </IconCallout>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_190px] xl:gap-8">
        {/* Índice: a la derecha en pantallas grandes (como el "En esta página" de
            una documentación), liviano para no competir con el menú de la app.
            Si no entra, desplegable arriba del bloque. */}
        <nav className="sticky top-4 order-last hidden flex-col xl:flex" aria-label="En este análisis">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-base-faint">En este análisis</p>
          <div className="flex flex-col border-l border-base-line">
            {blocks.map((b, i) => (
              <button
                key={b.label}
                onClick={() => go(i)}
                className={`-ml-px flex items-center gap-2 border-l-2 py-1.5 pl-3.5 text-left text-[13px] transition-colors ${
                  i === cur
                    ? 'border-brand font-semibold text-base-text'
                    : 'border-transparent font-medium text-base-muted hover:text-base-text'
                }`}
              >
                <span className={`font-mono text-[11px] ${i === cur ? 'text-brand' : 'text-base-faint'}`}>{b.n}</span>
                {b.label}
                {pend?.bloques.includes(b.label) && <Dot className="ml-auto mr-1" label="Con novedades" />}
              </button>
            ))}
          </div>
        </nav>
        <select
          value={cur}
          onChange={e => go(Number(e.target.value))}
          aria-label="En este análisis"
          className="w-full rounded-[10px] border border-base-line bg-base-panel px-3.5 py-3 text-sm font-semibold text-base-text xl:hidden"
        >
          {blocks.map((b, i) => <option key={b.label} value={i}>{b.n} · {b.label}{pend?.bloques.includes(b.label) ? ' ●' : ''}</option>)}
        </select>

        {block && (
          <section className="overflow-hidden rounded-xl border border-base-line bg-base-panel">
            <div className="flex items-center justify-between gap-3 border-b border-base-line bg-base-panel2 px-4 py-3.5 md:px-[18px]">
              <h2 className="font-display text-[15px] font-semibold text-base-text">
                <span className="mr-2 font-mono text-[11px] font-medium text-base-faint">{block.n}</span>{block.title}
                {trackNovedades && recent(a.novedades?.[block.label]) && (
                  <span className="ml-2 hidden font-sans text-[11.5px] font-normal text-base-muted sm:inline">· Actualizado {cuando(a.novedades![block.label])}</span>
                )}
              </h2>
              {!editing && (canCopy || onSave) && (
                <div className="flex shrink-0 gap-1.5">
                  {onSave && <EditButton onClick={() => startEdit(block.label)} />}
                  {canCopy && (
                    <button
                      onClick={copy}
                      title="Copiar este bloque con formato de Discord (solo equipo)"
                      aria-label="Copiar para Discord"
                      className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-md border bg-base-panel px-2.5 text-xs font-semibold transition-colors ${
                        copied === cur ? 'border-brand/40 text-brand' : 'border-base-line text-base-muted hover:border-base-faint hover:text-base-text'
                      }`}
                    >
                      {copied === cur ? <Check size={14} /> : <Copy size={14} />}
                      <span className="hidden sm:inline">{copied === cur ? '¡Copiado!' : 'Copiar para Discord'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3.5 p-4 md:p-[18px]">{editing === block.label ? editForm(block.label) : block.content}</div>

            {!editing && (prev || next) && (
              <div className="flex gap-2.5 border-t border-base-line px-4 py-3.5 md:px-[18px]">
                {prev && <PagerButton dir="prev" label={prev.label} onClick={() => go(cur - 1)} />}
                {next && <PagerButton dir="next" label={next.label} onClick={() => go(cur + 1)} />}
              </div>
            )}
          </section>
        )}
      </div>

      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}

      <p className="text-xs text-base-muted">
        Material educativo de Equipo Nasdaq. Datos: Forex Factory, Finnhub, FRED y Yahoo Finance. No es una recomendación de inversión.
      </p>
    </article>
  )
}

function EditButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      title="Corregir este bloque (se publica para los alumnos)"
      aria-label="Editar"
      className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-md border border-base-line bg-base-panel px-2.5 text-xs font-semibold text-base-muted transition-colors hover:border-base-faint hover:text-base-text ${className}`}
    >
      <Pencil size={13} /><span className="hidden sm:inline">Editar</span>
    </button>
  )
}

function PagerButton({ dir, label, onClick }: { dir: 'prev' | 'next'; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-0.5 rounded-lg border border-base-line bg-base-panel2 px-3.5 py-2 text-[13px] font-semibold text-base-text transition-colors hover:border-base-faint ${
        dir === 'next' ? 'ml-auto text-right' : 'text-left'
      }`}
    >
      <span className="text-[11px] font-medium text-base-faint">{dir === 'next' ? 'Siguiente →' : '← Anterior'}</span>
      {label}
    </button>
  )
}

function ChartCard({ c, onZoom }: { c: Chart; onZoom: (src: string) => void }) {
  const tv = parseTvLink(c.link)
  if (!tv.ok) return null
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {c.activo?.trim() && <span className="badge badge-brand">{c.activo}</span>}
          {c.temporalidad?.trim() && <span className="badge badge-grey">{c.temporalidad}</span>}
          {c.titulo.trim() && <h3 className="ml-0.5 text-sm font-semibold text-base-text">{c.titulo}</h3>}
        </div>
        <a href={tv.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
          Abrir en TradingView <ExternalLink size={12} />
        </a>
      </div>
      <button
        onClick={() => onZoom(tv.image)}
        aria-label={`Ampliar ${chartTitle(c) || 'gráfico'}`}
        className="group relative block cursor-zoom-in overflow-hidden rounded-[10px] border border-base-line bg-[#131722]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tv.image} alt={chartTitle(c) || 'Gráfico de TradingView'} loading="lazy" className="block h-auto w-full" />
        <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-md border border-base-line bg-base-bg/80 px-2 py-1 text-[11px] font-semibold text-base-muted group-hover:text-base-text">
          <Maximize2 size={12} /><span className="hidden sm:inline">Ampliar</span>
        </span>
      </button>
      {c.nota.trim() && <p className={PROSE}>{c.nota}</p>}
    </>
  )
}

/** Imagen a pantalla completa; se cierra tocando, con la X o con Escape. */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label="Gráfico ampliado" onClick={onClose}
      className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/90 p-4 md:p-8">
      <button onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 inline-flex items-center gap-1.5 text-sm font-semibold text-base-muted hover:text-base-text">
        <X size={16} /> Cerrar
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-full max-w-full rounded-lg" />
    </div>
  )
}

/** Punto verde de novedad. */
function Dot({ className = '', label }: { className?: string; label?: string }) {
  return (
    <span
      className={`h-[7px] w-[7px] shrink-0 rounded-full bg-brand shadow-[0_0_0_3px_rgba(59,130,246,.15)] ${className}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  )
}

/** "A", "A y B", "A, B y C" */
function lista(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}

const recent = (iso?: string) => !!iso && Date.now() - Date.parse(iso) < 7 * 24 * 60 * 60 * 1000
