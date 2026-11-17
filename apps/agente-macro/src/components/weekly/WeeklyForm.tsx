'use client'
import type { ReactNode } from 'react'
import type { WeeklyAnalysis, WeeklyData } from '@/lib/weekly/types'

// Formulario para escribir (o retocar) el Análisis Semanal a mano, sin IA:
// no gasta créditos. Las tablas se escriben una fila por línea, con las
// columnas separadas por " | ", para que sea fácil copiar y pegar.

const INPUT =
  'w-full bg-base-panel2 border border-base-line rounded-[10px] px-3 py-2 text-[13px] text-base-text ' +
  'placeholder:text-base-muted outline-none focus:border-brand'

const toLines = (rows: string[][]) => rows.map(r => r.join(' | ')).join('\n')

function fromLines(text: string, cols: number): string[][] {
  return text
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      const parts = l.split('|').map(p => p.trim())
      // Si sobran columnas, lo que sobra va en la última.
      const row = parts.slice(0, cols - 1)
      row.push(parts.slice(cols - 1).join(' | '))
      while (row.length < cols) row.push('')
      return row
    })
}

const fmtDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', timeZone: 'UTC' })
    .replace(/^\w/, c => c.toUpperCase())

/** Borrador vacío con lo que ya sabemos de la semana (calendario, earnings, niveles, vencimientos). */
export function emptyAnalysis(data: WeeklyData, niveles: WeeklyAnalysis['niveles']): WeeklyAnalysis {
  const byDay = new Map<string, string[]>()
  for (const e of data.events) {
    if (e.impact && e.impact !== 'high') continue
    byDay.set(e.date, [...(byDay.get(e.date) ?? []), e.name])
  }
  for (const e of data.earnings) {
    byDay.set(e.date, [...(byDay.get(e.date) ?? []), e.symbol])
  }
  const opex = [
    data.opex.mensual ? `Vencimiento mensual de opciones el ${fmtDay(data.opex.mensual).toLowerCase()}.` : 'Sin vencimiento mensual esta semana.',
    `Vencimiento semanal el ${fmtDay(data.opex.semanal).toLowerCase()}.`,
    data.opex.vix ? `Vencimiento del VIX el ${fmtDay(data.opex.vix).toLowerCase()}.` : '',
  ].filter(Boolean).join(' ')

  return {
    semana: data.semana,
    monday: data.monday,
    idea_central: '',
    catalizadores: [],
    calendario: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, names]) => ({ dia: fmtDay(day), eventos: names.join(', '), pregunta: '' })),
    earnings: data.earnings.map(e => ({ empresa: e.symbol, observar: '', importancia: '' })),
    earnings_ejemplo: '',
    opex_vix: opex,
    macro: '',
    niveles,
    ejemplos: [],
    escenarios: [],
    lectura_por_dia: '',
    checklist: [],
    conclusion: '',
    generadoEn: new Date().toISOString(),
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-bold uppercase tracking-wide text-base-muted">{label}</span>
      {hint && <span className="block text-[11.5px] text-base-faint">{hint}</span>}
      {children}
    </label>
  )
}

export function WeeklyForm({ a, onChange }: { a: WeeklyAnalysis; onChange: (a: WeeklyAnalysis) => void }) {
  const set = (patch: Partial<WeeklyAnalysis>) => onChange({ ...a, ...patch })
  const text = (key: keyof WeeklyAnalysis, rows = 3) => (
    <textarea value={a[key] as string} onChange={e => set({ [key]: e.target.value } as Partial<WeeklyAnalysis>)} rows={rows} className={INPUT} />
  )
  const table = (rows: string[][], cols: number, placeholder: string, write: (r: string[][]) => Partial<WeeklyAnalysis>) => (
    <textarea
      defaultValue={toLines(rows)}
      onChange={e => set(write(fromLines(e.target.value, cols)))}
      rows={Math.max(3, rows.length + 1)}
      placeholder={placeholder}
      className={`${INPUT} font-mono text-[12.5px]`}
    />
  )
  const SEP = 'Una fila por línea; separá las columnas con |'

  return (
    <div className="space-y-5">
      <Field label="Semana">
        <input value={a.semana} onChange={e => set({ semana: e.target.value })} className={INPUT} />
      </Field>
      <Field label="La idea central">{text('idea_central', 4)}</Field>
      <Field label="01 Resumen · Catalizador | Qué significa para Nasdaq" hint={SEP}>
        {table(a.catalizadores.map(c => [c.catalizador, c.significado]), 2, 'FOMC + Warsh (miércoles) | Decisión de tasas y guía sobre recortes…',
          r => ({ catalizadores: r.map(([catalizador, significado]) => ({ catalizador, significado })) }))}
      </Field>
      <Field label="02 Calendario · Día | Eventos | Pregunta educativa" hint={`${SEP}. Viene relleno con los eventos de alto impacto y los earnings.`}>
        {table(a.calendario.map(c => [c.dia, c.eventos, c.pregunta]), 3, 'Miércoles 28 | FOMC, MSFT, META | ¿Abre Warsh la puerta a un recorte?',
          r => ({ calendario: r.map(([dia, eventos, pregunta]) => ({ dia, eventos, pregunta })) }))}
      </Field>
      <Field label="03 Earnings · Empresa | Qué observar | Por qué importa" hint={SEP}>
        {table(a.earnings.map(e => [e.empresa, e.observar, e.importancia]), 3, 'Microsoft (MSFT) | Azure y capex en IA | Muy alta',
          r => ({ earnings: r.map(([empresa, observar, importancia]) => ({ empresa, observar, importancia })) }))}
      </Field>
      <Field label="03 Earnings · Ejemplo">{text('earnings_ejemplo')}</Field>
      <Field label="04 OPEX y VIX">{text('opex_vix')}</Field>
      <Field label="05 Macro">{text('macro')}</Field>
      <Field label="06 Niveles NQ · Zona | Lectura y función" hint={`${SEP}. De mayor a menor.`}>
        {table(a.niveles.map(l => [l.zona, l.lectura]), 2, '29.600–29.800 | Primera resistencia de rebote…',
          r => ({ niveles: r.map(([zona, lectura]) => ({ zona, lectura })) }))}
      </Field>
      <Field label="07 Ejemplos · Título | Texto" hint={SEP}>
        {table(a.ejemplos.map(e => [e.titulo, e.texto]), 2, 'Warsh dovish + MSFT fuerte | El NQ acepta por encima de…',
          r => ({ ejemplos: r.map(([titulo, texto]) => ({ titulo, texto })) }))}
      </Field>
      <Field label="08 Escenarios · Escenario | Qué tendría que pasar | Referencias" hint={SEP}>
        {table(a.escenarios.map(e => [e.escenario, e.condicion, e.referencias]), 3, 'Alcista | Warsh dovish y la Big Tech cumple | 29.800 → 30.150',
          r => ({ escenarios: r.map(([escenario, condicion, referencias]) => ({ escenario, condicion, referencias })) }))}
      </Field>
      <Field label="08 Lectura por día">{text('lectura_por_dia')}</Field>
      <Field label="09 Checklist" hint="Un punto por línea">
        <textarea
          defaultValue={a.checklist.join('\n')}
          onChange={e => set({ checklist: e.target.value.split('\n').map(l => l.trim()).filter(Boolean) })}
          rows={Math.max(3, a.checklist.length + 1)}
          className={INPUT}
        />
      </Field>
      <Field label="10 Conclusión">{text('conclusion')}</Field>
    </div>
  )
}
