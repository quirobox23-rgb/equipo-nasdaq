'use client'
import { conBase } from '@/lib/base'
import { useEffect, useState } from 'react'
import { Badge, PanelHeader, type BadgeVariant } from '@/components/ui'

interface Headline { title: string; description: string; url: string; publishedAt: string; source: string }
interface RegionData { region: string; flag: string; available: boolean; headlines: Headline[] }
interface AiSummary {
  available: boolean
  nivel_riesgo_global?: 'Alto' | 'Medio' | 'Bajo'
  resumen?: string
  region_mas_relevante?: string
  activos_afectados?: string[]
}
interface GeoResponse { available: boolean; regions: RegionData[]; ai_summary: AiSummary }

const RISK_VARIANT: Record<string, BadgeVariant> = {
  'Bajo': 'pos',
  'Medio': 'neutral',
  'Alto': 'neg',
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 1) return 'hace menos de 1h'
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

function RegionCard({ data }: { data: RegionData }) {
  return (
    <section className="card">
      <PanelHeader title={data.region} aside={data.available ? `${data.headlines.length} titulares` : undefined} />
      <div className="p-5">
      {!data.available ? (
        <p className="text-[12px] text-base-muted italic">Sin titulares disponibles ahora mismo.</p>
      ) : (
        <div className="space-y-3">
          {data.headlines.map((h, i) => (
            <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" className="block group">
              <p className="text-[13px] text-base-text/90 group-hover:text-brand leading-snug transition-colors">{h.title}</p>
              <p className="text-[10px] text-base-muted mt-0.5">{h.source} · {timeAgo(h.publishedAt)}</p>
            </a>
          ))}
        </div>
      )}
      </div>
    </section>
  )
}

export default function GeopoliticaPage() {
  const [data, setData] = useState<GeoResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(conBase('/api/geopolitics'))
      .then(res => res.ok ? res.json() : null)
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const withNews = data?.regions.filter(r => r.available) ?? []
  const ai = data?.ai_summary

  return (
    <div>
      <div className="mb-6">
        <p className="section-label mb-1">Geopolítica</p>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-display font-semibold text-base-text">Contexto por región</h1>
          <span className="text-[10px] text-base-muted">
            {ai?.available ? 'Titulares reales (GNews) + análisis de riesgo (Claude)' : 'Titulares reales (GNews)'}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-base-muted">Cargando titulares…</p>
      ) : !data?.available ? (
        <div className="card p-5">
          <p className="text-sm text-neg font-medium mb-1">Sin conexión a la fuente de noticias</p>
          <p className="text-[12px] text-base-muted">Verifica que GNEWS_API_KEY esté configurada en .env.local y reinicia el servidor.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {data.regions.map(r => <RegionCard key={r.region} data={r} />)}
          </div>

          <section className="card">
            <PanelHeader
              title="Resumen"
              subtitle={ai?.available ? 'Claude' : undefined}
              aside={ai?.available && ai.nivel_riesgo_global ? (
                <Badge variant={RISK_VARIANT[ai.nivel_riesgo_global] ?? 'grey'}>Riesgo {ai.nivel_riesgo_global}</Badge>
              ) : undefined}
            />
            <div className="p-5">

            {ai?.available ? (
              <>
                <p className="text-[13px] leading-relaxed text-base-text/90 mb-2">{ai.resumen}</p>
                <div className="flex flex-wrap gap-3 text-[11px] text-base-muted">
                  {ai.region_mas_relevante && <span>Región más relevante: <span className="text-base-text font-medium">{ai.region_mas_relevante}</span></span>}
                  {ai.activos_afectados && ai.activos_afectados.length > 0 && (
                    <span>Activos afectados: <span className="text-base-text font-medium">{ai.activos_afectados.join(', ')}</span></span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[13px] leading-relaxed text-base-text/90">
                {withNews.length > 0
                  ? `Hay actividad informativa reciente en ${withNews.length} de 3 regiones: ${withNews.map(r => r.region).join(', ')}. Revisa los titulares de cada tarjeta para el contexto completo.`
                  : 'Sin titulares recientes en ninguna región ahora mismo.'}
              </p>
            )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
