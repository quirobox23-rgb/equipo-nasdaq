import type { ExecutiveSummary } from '@/lib/engines/macroNarrativeEngine'

interface Props { summary: ExecutiveSummary }

export function ExecutiveSummaryCard({ summary }: Props) {
  return (
    <div className="card p-5 mb-5 border-base-line/60">
      <p className="card-title">Resumen Ejecutivo</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div><p className="text-[9px] text-base-muted uppercase tracking-widest mb-1">Narrativa dominante</p><p className="text-sm font-semibold text-base-text/90">{summary.dominantNarrative}</p></div>
        <div><p className="text-[9px] text-base-muted uppercase tracking-widest mb-1">Activo favorito</p><p className="text-sm font-semibold text-pos">{summary.favoredAsset}</p></div>
        <div><p className="text-[9px] text-base-muted uppercase tracking-widest mb-1">Mayor riesgo</p><p className="text-sm font-semibold text-neg">{summary.biggestRisk}</p></div>
        <div><p className="text-[9px] text-base-muted uppercase tracking-widest mb-1">Evento clave</p><p className="text-sm font-semibold text-base-text/90 truncate">{summary.keyEvent}</p></div>
        <div><p className="text-[9px] text-base-muted uppercase tracking-widest mb-1">Convicción</p><p className="text-sm font-semibold text-base-text/90 tabular">{summary.convictionLevel}%</p></div>
      </div>
    </div>
  )
}
