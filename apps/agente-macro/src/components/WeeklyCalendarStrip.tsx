'use client'

// WeeklyCalendarStrip — versión recortada de la ficha semanal, pensada
// específicamente para /mentor-ia/page.tsx, que YA muestra narrativa
// dominante, escenario base/alternativos y el panel de 8 agentes.
//
// Por eso aquí solo van los 3 campos de weekly_card que esa página
// todavía NO tiene en ningún sitio: riesgo_semanal, el calendario de 5
// días (con earnings) y el enfoque de la semana. Nada se repite.
//
// Si en el futuro quieres la ficha completa (con narrativa/escenarios/
// agentes) en otra pantalla que no los tenga ya, usa WeeklyCard.tsx en
// vez de este componente — ese sí lleva todos los campos.

interface DiaData {
  eventos: string[]
  estrellas: number
  earnings: string[]
  nota: string
}

interface WeeklyCalendarStripData {
  semana: string | null
  riesgo_semanal: string
  riesgo_justificacion: string
  dias: Record<string, DiaData>
  enfoque: Array<{ tema: string; icono: string; sub: string }>
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

export default function WeeklyCalendarStrip({ data }: { data: WeeklyCalendarStripData }) {
  const riskClass = RISK_TONE[data.riesgo_semanal] ?? 'text-base-muted border-base-line bg-base-panel/40'

  return (
    <div className="relative overflow-hidden rounded-xl border border-neutral/30 bg-gradient-to-br from-base-bg via-base-panel to-neutral/10 p-5 mb-6">
      <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <p className="text-[10px] text-neutral/80 uppercase tracking-[0.3em] mb-1">Semana</p>
            <h2 className="text-lg font-semibold text-base-text">{data.semana ?? 'Sin calendario cargado'}</h2>
          </div>
          <div className="text-right">
            <span className={`inline-block text-sm font-semibold px-3 py-1.5 rounded-lg border ${riskClass}`}>
              Riesgo semanal · {data.riesgo_semanal}
            </span>
            <p className="text-[10px] text-base-muted mt-1.5 max-w-xs">{data.riesgo_justificacion}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
          {DAY_ORDER.map(key => {
            const d = data.dias[key] ?? { eventos: [], estrellas: 0, earnings: [], nota: '' }
            const important = d.estrellas >= 4
            return (
              <div key={key}
                className={`rounded-lg border p-2.5 ${important ? 'border-neutral bg-neutral-dim/20' : 'border-base-line bg-base-panel/40'}`}>
                <p className={`text-[11px] font-bold mb-1 ${important ? 'text-neutral' : 'text-base-text'}`}>{DAY_LABELS[key]}</p>
                {d.estrellas > 0 && (
                  <p className="text-[9px] mb-1">
                    {'★'.repeat(d.estrellas)}<span className="text-base-line">{'★'.repeat(5 - d.estrellas)}</span>
                  </p>
                )}
                {d.eventos.length === 0 ? (
                  <p className="text-[9px] text-base-line">Sin eventos</p>
                ) : (
                  d.eventos.map((e, i) => <p key={i} className="text-[10px] font-medium text-base-text/90 leading-snug">{e}</p>)
                )}
                {d.earnings.length > 0 && (
                  <p className="text-[9px] text-base-muted mt-1">{d.earnings.join(', ')}</p>
                )}
              </div>
            )
          })}
        </div>

        {data.enfoque.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-base-line/60">
            <span className="text-xs font-bold text-base-text shrink-0">ENFOQUE</span>
            {data.enfoque.map((e, i) => (
              <span key={i} className="chain-token flex items-center gap-1.5">
                <span>{e.icono}</span>{e.tema}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
