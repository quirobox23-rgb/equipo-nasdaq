interface Props {
  items?: string[]
  /** true cuando vive dentro del topbar (Navigation) — sin borde/fondo propio ni padding vertical grande. */
  compact?: boolean
}

// Datos simulados por ahora — el componente ya acepta `items` reales (ej. desde
// un futuro feed de noticias) sin cambiar su forma de renderizar.
const MOCK_HEADLINES = [
  'FED habla hoy a las 14:00 ET',
  'IPC superior al esperado',
  'Oro rompe máximos históricos',
  'VIX +5% en la sesión',
  'Nasdaq continúa alcista',
  'DXY se mantiene firme frente al euro',
  'Rendimiento del 10Y sube 6pb',
  'Petróleo estable tras datos de inventarios',
]

export function NewsTicker({ items = MOCK_HEADLINES, compact = false }: Props) {
  const loop = [...items, ...items] // duplicado para el scroll continuo sin costuras

  return (
    <div className={`w-full overflow-hidden select-none ${compact ? '' : 'border-t border-base-line bg-base-bg'}`}>
      <div className={`flex items-center gap-0 ${compact ? 'py-0' : 'py-6'}`}>
        <span className={`shrink-0 flex items-center gap-2 pr-5 ${compact ? 'pl-0' : 'pl-6'}`}>
          <span className="w-2 h-2 rounded-full bg-brand" style={{ animation: 'breathe-node 2.2s ease-in-out infinite' }} />
          <span className="text-xs font-semibold tracking-[0.2em] text-brand">LIVE</span>
        </span>
        <span className="shrink-0 w-px h-6 bg-base-line mr-6" />
        <div className="overflow-hidden flex-1">
          <div className="flex whitespace-nowrap items-center" style={{ animation: 'ticker-scroll 65s linear infinite', width: 'max-content' }}>
            {loop.map((headline, i) => (
              <span key={i} className="flex items-center text-sm font-medium tracking-wide text-base-text/85">
                {headline}
                <span className="w-px h-4 bg-base-line mx-8" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
