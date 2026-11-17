'use client'
import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react'
import type { Chart, WeeklyAnalysis } from '@/lib/weekly/types'
import { ACTIVO_DEFAULT, ACTIVOS, chartMissing, parseTvLink, TEMPORALIDADES, TV_LINK_HELP } from '@/lib/weekly/tradingview'

// Formulario para corregir un bloque del Análisis Semanal publicado desde su
// propia tarjeta (solo equipo). Cada bloque describe sus campos con EditField:
// tablas (una fila de campos por renglón), textos y listas (checklist).

const INPUT =
  'w-full bg-base-panel2 border border-base-line rounded-[10px] px-3 py-2 text-[13px] text-base-text ' +
  'placeholder:text-base-muted outline-none focus:border-brand'

type Row = Record<string, string>

export type EditField =
  | { kind: 'rows'; key: keyof WeeklyAnalysis; label: string; cols: { k: string; label: string; mono?: boolean; long?: boolean }[] }
  | { kind: 'text'; key: keyof WeeklyAnalysis; label: string }
  | { kind: 'list'; key: keyof WeeklyAnalysis; label: string }
  | { kind: 'charts'; key: 'graficos'; label: string }

export function WeeklyBlockForm({ fields, a, onChange }: {
  fields: EditField[]
  a: WeeklyAnalysis
  onChange: (patch: Partial<WeeklyAnalysis>) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {fields.map(f => (
        <div key={f.key} className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-base-muted">{f.label}</p>
          {f.kind === 'text' && (
            <textarea
              value={a[f.key] as string}
              onChange={e => onChange({ [f.key]: e.target.value })}
              rows={4}
              className={INPUT}
            />
          )}
          {f.kind === 'list' && <ListField items={a[f.key] as string[]} onChange={v => onChange({ [f.key]: v })} />}
          {f.kind === 'charts' && <ChartsField charts={a.graficos ?? []} onChange={v => onChange({ graficos: v })} />}
          {f.kind === 'rows' && <RowsField cols={f.cols} rows={a[f.key] as unknown as Row[]} onChange={v => onChange({ [f.key]: v })} />}
        </div>
      ))}
    </div>
  )
}

function RowsField({ cols, rows, onChange }: {
  cols: Extract<EditField, { kind: 'rows' }>['cols']
  rows: Row[]
  onChange: (rows: Row[]) => void
}) {
  const update = (i: number, k: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const grid = cols.length === 2 ? 'sm:grid-cols-[minmax(140px,1fr)_3fr_auto]' : 'sm:grid-cols-[minmax(110px,1fr)_2fr_2fr_auto]'
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className={`grid grid-cols-1 gap-2 ${grid} sm:items-start`}>
          {cols.map(c =>
            c.long ? (
              <textarea key={c.k} value={r[c.k] ?? ''} onChange={e => update(i, c.k, e.target.value)} placeholder={c.label} rows={2} className={INPUT} />
            ) : (
              <input key={c.k} value={r[c.k] ?? ''} onChange={e => update(i, c.k, e.target.value)} placeholder={c.label} className={`${INPUT} ${c.mono ? 'font-mono' : ''}`} />
            ),
          )}
          <button onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Quitar fila" className="btn-ghost px-3 py-2 justify-self-end">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...rows, Object.fromEntries(cols.map(c => [c.k, '']))])}
        className="btn-ghost text-xs px-3 py-2 inline-flex items-center gap-1.5"
      >
        <Plus size={14} /> Añadir fila
      </button>
    </div>
  )
}

function ListField({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input value={item} onChange={e => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className={INPUT} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Quitar ítem" className="btn-ghost px-3 py-2 shrink-0">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ''])} className="btn-ghost text-xs px-3 py-2 inline-flex items-center gap-1.5">
        <Plus size={14} /> Añadir ítem
      </button>
    </div>
  )
}

/** Gráficos de TradingView: se pega el link de la captura y se ve la miniatura al instante. */
function ChartsField({ charts, onChange }: { charts: Chart[]; onChange: (charts: Chart[]) => void }) {
  const update = (i: number, patch: Partial<Chart>) => onChange(charts.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const move = (i: number, d: -1 | 1) => {
    const next = [...charts]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  return (
    <div className="space-y-3">
      {charts.map((c, i) => {
        const tv = parseTvLink(c.link)
        return (
          <div key={i} className="grid grid-cols-1 gap-3 rounded-[10px] border border-base-line p-3 sm:grid-cols-[132px_minmax(0,1fr)]">
            <div className="flex aspect-[1.62] w-full items-center justify-center overflow-hidden rounded-lg border border-base-line bg-base-panel2 sm:w-[132px]">
              {tv.ok
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={tv.image} alt="" className="h-full w-full object-cover" />
                : <span className="px-2 text-center text-[11px] text-base-faint">Sin imagen</span>}
            </div>
            <div className="flex flex-col gap-2">
              <Chips label="Activo" options={ACTIVOS} value={c.activo ?? ''} onChange={v => update(i, { activo: v })} allowOther />
              <Chips label="Temporalidad" options={TEMPORALIDADES} value={c.temporalidad ?? ''} onChange={v => update(i, { temporalidad: v })} />
              {chartMissing(c).length > 0 && (
                <p className="text-xs text-neg">Elegí {chartMissing(c).join(' y ')}.</p>
              )}
              <input value={c.titulo} onChange={e => update(i, { titulo: e.target.value })} placeholder="Qué muestra (opcional): Zonas del miércoles" className={INPUT} />
              <div>
                <input
                  value={c.link}
                  onChange={e => update(i, { link: e.target.value })}
                  placeholder="https://www.tradingview.com/x/…"
                  className={`${INPUT} font-mono ${!tv.ok && tv.reason !== 'vacio' ? 'border-neg/60' : ''}`}
                />
                <p className={`mt-1 text-xs ${tv.ok ? 'text-brand' : tv.reason === 'vacio' ? 'text-base-muted' : 'text-neg'}`}>
                  {tv.ok ? <span className="inline-flex items-center gap-1"><Check size={12} /> Captura encontrada</span> : TV_LINK_HELP[tv.reason]}
                </p>
              </div>
              <textarea value={c.nota} onChange={e => update(i, { nota: e.target.value })} placeholder="Nota (opcional): qué querés que miren en este gráfico" rows={2} className={INPUT} />
              <div className="flex justify-end gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className="btn-ghost px-2.5 py-1.5 disabled:opacity-40"><ArrowUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === charts.length - 1} aria-label="Bajar" className="btn-ghost px-2.5 py-1.5 disabled:opacity-40"><ArrowDown size={14} /></button>
                <button onClick={() => onChange(charts.filter((_, j) => j !== i))} aria-label="Quitar gráfico" className="btn-ghost px-2.5 py-1.5"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        )
      })}
      <button
        onClick={() => onChange([...charts, { activo: ACTIVO_DEFAULT, temporalidad: '', titulo: '', link: '', nota: '' }])}
        className="btn-ghost text-xs px-3 py-2 inline-flex items-center gap-1.5"
      >
        <Plus size={14} /> Agregar gráfico
      </button>
    </div>
  )
}

/** Botones para elegir una opción; con `allowOther`, "Otro" abre un campo para escribirla a mano. */
function Chips({ label, options, value, onChange, allowOther = false }: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  allowOther?: boolean
}) {
  const isOther = value !== '' && !options.includes(value)
  const [other, setOther] = useState(isOther)
  const chip = (on: boolean) =>
    `rounded-md border px-2.5 py-1 font-mono text-xs font-semibold transition-colors ${
      on ? 'border-brand bg-brand/10 text-brand' : 'border-base-line text-base-muted hover:border-base-faint hover:text-base-text'
    }`
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-base-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map(o => (
          <button key={o} type="button" onClick={() => { setOther(false); onChange(o) }} className={chip(!other && value === o)}>{o}</button>
        ))}
        {allowOther && (
          <button type="button" onClick={() => { setOther(true); if (!isOther) onChange('') }} className={chip(other)}>Otro</button>
        )}
        {allowOther && other && (
          <input
            autoFocus
            value={value}
            onChange={e => onChange(e.target.value.toUpperCase())}
            placeholder="Ej.: ES, GOLD, BTC"
            className={`${INPUT} w-40 py-1 font-mono`}
          />
        )}
      </div>
    </div>
  )
}
