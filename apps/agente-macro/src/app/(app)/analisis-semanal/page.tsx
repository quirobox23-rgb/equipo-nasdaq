'use client'
import { useEffect, useState } from 'react'
import type { WeeklyAnalysis } from '@/lib/weekly/types'
import { WeeklyAnalysisView, BetaBadge } from '@/components/weekly/WeeklyAnalysisView'
import { WeeklyEditor } from '@/components/weekly/WeeklyEditor'
import { useAlumno } from '@/lib/alumno'
import { loadContenido, publishAnalysis, saveContenido } from '@/lib/contenido'

// Análisis Semanal de NQ. Los alumnos ven el último publicado (Firestore, ver src/lib/contenido.ts);
// el equipo (nivel admin) lo prepara desde el panel de abajo con la clave de admin.
export default function AnalisisSemanalPage() {
  const [analysis, setAnalysis] = useState<WeeklyAnalysis | null | undefined>(undefined)
  const [showEditor, setShowEditor] = useState(false)
  const { nivel } = useAlumno()

  useEffect(() => {
    loadContenido<WeeklyAnalysis>('analisis-publicado')
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
  }, [])

  // Corrección de un bloque desde su tarjeta (equipo): se publica al instante y
  // se aplica también al borrador de esa semana, para que volver a publicar
  // desde el panel de abajo no la pise.
  // Con "Avisar a los alumnos" se anota la hora del cambio en ese apartado (ver src/lib/weekly/novedades.ts).
  async function saveEdit(patch: Partial<WeeklyAnalysis>, aviso?: { bloque: string; avisar: boolean }) {
    if (!analysis) return
    const novedades = aviso?.avisar ? { ...analysis.novedades, [aviso.bloque]: new Date().toISOString() } : analysis.novedades
    const updated = { ...analysis, ...patch, ...(novedades ? { novedades } : {}) }
    await publishAnalysis(updated)
    setAnalysis(updated)
    const borrador = await loadContenido<WeeklyAnalysis>('analisis-borrador').catch(() => null)
    if (borrador && borrador.monday === updated.monday) {
      await saveContenido('analisis-borrador', { ...borrador, ...patch }).catch(() => {})
    }
  }

  return (
    <div className="space-y-10">
      {analysis === undefined ? (
        <p className="text-sm text-base-muted">Cargando…</p>
      ) : analysis ? (
        <WeeklyAnalysisView a={analysis} trackNovedades canCopy={nivel === 'admin'} onSave={nivel === 'admin' ? saveEdit : undefined} />
      ) : (
        <div>
          <p className="section-label mb-1">Análisis Semanal</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-display font-semibold text-base-text">Nasdaq NQ · Análisis semanal</h1>
            <BetaBadge />
          </div>
          <p className="text-sm text-base-muted mt-2">El análisis de esta semana todavía no está publicado. Volvé a mirar el domingo.</p>
        </div>
      )}

      {nivel === 'admin' && (
        <div className="pt-6 border-t border-base-line">
          {showEditor ? (
            <WeeklyEditor onPublished={setAnalysis} />
          ) : (
            <button onClick={() => setShowEditor(true)} className="text-xs text-base-faint underline hover:text-base-text">
              Preparar el análisis (solo equipo)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
