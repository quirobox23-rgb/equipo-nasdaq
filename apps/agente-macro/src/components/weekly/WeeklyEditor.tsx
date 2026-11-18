'use client'
import { conBase } from '@/lib/base'
import { useState } from 'react'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'
import { getFirebaseAuth } from '@/lib/firebase/client'
import type { Level, WeeklyAnalysis, WeeklyData } from '@/lib/weekly/types'
import { WeeklyAnalysisView } from './WeeklyAnalysisView'
import { WeeklyForm, emptyAnalysis } from './WeeklyForm'
import { chatPrompt, parseAnalysis, toAnalysis } from '@/lib/weekly/prompt'
import { loadContenido, publishAnalysis, saveContenido } from '@/lib/contenido'

// Panel del equipo para preparar el Análisis Semanal: carga los datos de la
// semana, propone niveles de NQ (el analista los corrige) y, o bien genera el
// borrador con una sola llamada a la IA, o bien se escribe a mano, o bien se
// genera en el chat de Claude (copiar instrucciones → pegar la respuesta).
// Las dos últimas no gastan créditos de la API. El borrador se puede retocar y se publica para los
// alumnos; ver el análisis publicado no gasta créditos.

const INPUT =
  'w-full bg-base-panel2 border border-base-line rounded-[10px] px-3 py-2 text-[13px] text-base-text ' +
  'placeholder:text-base-muted outline-none focus:border-brand'

export function WeeklyEditor({ onPublished }: { onPublished: (a: WeeklyAnalysis) => void }) {
  const [data, setData]         = useState<WeeklyData | null>(null)
  const [levels, setLevels]     = useState<Level[]>([])
  const [notas, setNotas]       = useState('')
  const [draft, setDraft]       = useState<WeeklyAnalysis | null>(null)
  const [editing, setEditing]   = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [pasted, setPasted]     = useState('')
  const [copied, setCopied]     = useState(false)
  const [busy, setBusy]         = useState<null | 'prepare' | 'generate' | 'save' | 'publish'>(null)
  const [error, setError]       = useState<string | null>(null)
  const [notice, setNotice]     = useState<string | null>(null)


  async function call(body: object) {
    const res = await fetch(conBase('/api/weekly'), {
      method: 'POST',
      // Se identifica con su sesión de Firebase: el servidor comprueba que es del equipo.
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getFirebaseAuth().currentUser?.getIdToken()}` },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error ?? 'Algo falló. Probá de nuevo.')
    return json
  }

  async function prepare() {
    setBusy('prepare'); setError(null); setNotice(null)
    try {
      const [json, saved] = await Promise.all([
        call({ action: 'prepare' }),
        loadContenido<WeeklyAnalysis>('analisis-borrador').catch(() => null),
      ])
      setData(json.data)
      setLevels(json.data.nivelesPropuestos)
      setDraft(saved && saved.monday === json.data.monday ? saved : null)
      setEditing(false)
    } catch (e) { setError((e as Error).message) }
    setBusy(null)
  }

  async function generate() {
    if (!data) return
    setBusy('generate'); setError(null); setNotice(null)
    try {
      const json = await call({ action: 'generate', monday: data.monday, levels: levels.filter(l => l.zona.trim()), notas })
      setDraft(json.draft)
      // Se guarda como borrador para no tener que volver a generarlo (ni gastar créditos otra vez).
      await saveContenido('analisis-borrador', json.draft).catch(() => {})
      setEditing(false)
    } catch (e) { setError((e as Error).message) }
    setBusy(null)
  }

  function writeByHand() {
    if (!data) return
    if (!draft) setDraft(emptyAnalysis(data, levels.filter(l => l.zona.trim())))
    setEditing(true)
    setError(null); setNotice(null)
  }

  async function copyPrompt() {
    if (!data) return
    const text = chatPrompt(data, levels.filter(l => l.zona.trim()), notas)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setError('No se pudo copiar automáticamente. Probá otra vez desde Chrome o Safari.')
    }
  }

  function loadPasted() {
    if (!data || !pasted.trim()) return
    setError(null); setNotice(null)
    try {
      setDraft(toAnalysis(parseAnalysis(pasted), data, levels.filter(l => l.zona.trim())))
      setEditing(true)
      setChatOpen(false)
      setPasted('')
      setNotice('Análisis cargado. Revisalo abajo, retocá lo que quieras y publicalo.')
    } catch {
      setError('No reconozco esa respuesta. Copiá la respuesta completa de Claude (el bloque que empieza con { y termina con }).')
    }
  }

  async function save() {
    if (!draft) return
    setBusy('save'); setError(null); setNotice(null)
    try {
      await saveContenido('analisis-borrador', draft)
      setNotice('Borrador guardado. Podés seguir otro día desde "Cargar datos de la semana".')
    } catch (e) { setError((e as Error).message) }
    setBusy(null)
  }

  async function publish() {
    if (!draft) return
    setBusy('publish'); setError(null); setNotice(null)
    try {
      // Los gráficos se cargan desde su apartado, en el análisis publicado: si
      // este borrador no los trae (p. ej. se volvió a generar), se conservan.
      const actual = draft.graficos ? null : await loadContenido<WeeklyAnalysis>('analisis-publicado').catch(() => null)
      const graficos = draft.graficos ?? (actual?.monday === draft.monday ? actual.graficos : undefined)
      // Publicar cuenta como análisis nuevo para los alumnos: las novedades sueltas se vacían.
      const published = { ...draft, ...(graficos ? { graficos } : {}), novedades: {}, publicadoEn: new Date().toISOString() }
      await publishAnalysis(published)
      onPublished(published)
      setNotice('Publicado. Los alumnos ya lo ven en Análisis Semanal.')
    } catch (e) { setError((e as Error).message) }
    setBusy(null)
  }

  const updateLevel = (i: number, patch: Partial<Level>) =>
    setLevels(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  return (
    <div className="card p-5 space-y-5 max-w-[860px]">
      <div>
        <h2 className="font-display text-base font-black uppercase tracking-wide text-base-text">Preparar el análisis (equipo)</h2>
        <p className="text-[13px] text-base-muted mt-1">
          Carga los datos de la semana y revisá los niveles de NQ. Después generalo en tu chat de Claude o escribilo vos (ninguna de las dos gasta créditos), o generalo con la IA de la app, y publicalo.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button onClick={prepare} disabled={busy !== null} className="btn-primary px-5 py-2 text-sm shrink-0 disabled:opacity-60">
          {busy === 'prepare' ? 'Cargando…' : 'Cargar datos de la semana'}
        </button>
      </div>

      {error && (
        <div role="alert" className="callout callout-red flex-nowrap items-start gap-2.5 px-3.5 py-3 text-[13px] text-base-text">
          <AlertCircle size={16} className="text-neg shrink-0 mt-px" /><span>{error}</span>
        </div>
      )}
      {notice && <div role="status" className="callout callout-green px-3.5 py-3 text-[13px] text-base-text">{notice}</div>}

      {data && (
        <>
          <div className="text-[13px] text-base-text/85 space-y-1">
            <p><b>Semana:</b> {data.semana}</p>
            <p><b>Datos:</b> {data.events.length} eventos macro · {data.earnings.length} earnings del Nasdaq 100 · NQ {data.nq.precio?.toLocaleString('es-ES') ?? 'sin dato'}</p>
            {data.avisos.map(a => <p key={a} className="text-neutral">⚠ {a}</p>)}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-base-muted">Niveles NQ (de mayor a menor)</p>
            {levels.map((l, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-2">
                <input value={l.zona} onChange={e => updateLevel(i, { zona: e.target.value })} placeholder="29.600–29.800" className={`${INPUT} sm:w-44 font-mono`} />
                <input value={l.lectura} onChange={e => updateLevel(i, { lectura: e.target.value })} placeholder="Lectura y función" className={INPUT} />
                <button onClick={() => setLevels(ls => ls.filter((_, j) => j !== i))} aria-label="Quitar nivel" className="btn-ghost px-3 py-2 shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button onClick={() => setLevels(ls => [...ls, { zona: '', lectura: '' }])} className="btn-ghost text-xs px-3 py-2 inline-flex items-center gap-1.5">
              <Plus size={14} /> Añadir nivel
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-base-muted">Notas para esta semana (opcional)</p>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3} placeholder="Ej.: venimos de una corrección fuerte en tecnología; vigilar semis." className={INPUT} />
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
            <button onClick={() => { setChatOpen(o => !o); setCopied(false) }} disabled={busy !== null} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">
              Con mi chat de Claude (sin créditos)
            </button>
            <button onClick={writeByHand} disabled={busy !== null} className="btn-ghost px-5 py-2.5 text-sm disabled:opacity-60">
              {draft ? 'Editar el texto a mano' : 'Escribirlo yo (sin IA)'}
            </button>
            <button onClick={generate} disabled={busy !== null || levels.every(l => !l.zona.trim())} className="btn-ghost px-5 py-2.5 text-sm disabled:opacity-60">
              {busy === 'generate' ? 'Generando (puede tardar un par de minutos)…' : draft ? 'Volver a generar con IA (gasta créditos)' : 'Generar con IA (gasta créditos)'}
            </button>
          </div>

          {chatOpen && (
            <div className="card p-4 space-y-3">
              <ol className="list-decimal pl-5 space-y-1 text-[13px] text-base-text/90">
                <li>Copiá las instrucciones (llevan los datos de la semana y tus niveles).</li>
                <li>Pegalas en un chat nuevo de claude.ai y enviá.</li>
                <li>Copiá la respuesta completa de Claude y pegala aquí abajo.</li>
              </ol>
              <button onClick={copyPrompt} className="btn-ghost px-4 py-2 text-sm">
                {copied ? '✓ Copiadas, ahora pegalas en Claude' : 'Copiar instrucciones'}
              </button>
              <textarea
                value={pasted}
                onChange={e => setPasted(e.target.value)}
                rows={6}
                placeholder="Pegá aquí la respuesta de Claude"
                className={`${INPUT} font-mono text-[12px]`}
              />
              <button onClick={loadPasted} disabled={!pasted.trim()} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
                Cargar la respuesta
              </button>
            </div>
          )}
        </>
      )}

      {draft && (
        <div className="space-y-4 border-t border-base-line pt-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-bold uppercase tracking-wide text-base-muted">Borrador · {draft.semana}</p>
            <div className="flex gap-2">
              {editing && (
                <button onClick={save} disabled={busy !== null} className="btn-ghost px-4 py-2 text-sm disabled:opacity-60">
                  {busy === 'save' ? 'Guardando…' : 'Guardar borrador'}
                </button>
              )}
              <button onClick={publish} disabled={busy !== null} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
                {busy === 'publish' ? 'Publicando…' : 'Publicar para los alumnos'}
              </button>
            </div>
          </div>
          {editing && <WeeklyForm key={draft.generadoEn} a={draft} onChange={setDraft} />}
          <p className="text-xs font-bold uppercase tracking-wide text-base-muted pt-2">Así lo verán los alumnos</p>
          <WeeklyAnalysisView a={draft} />
        </div>
      )}
    </div>
  )
}
