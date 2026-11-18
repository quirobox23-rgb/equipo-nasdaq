import type { ReactNode, SVGProps } from 'react'
import type { WeeklyMacroContext } from '@/lib/engines/weeklyMacroEngine'
import { Logo } from './Logo'

interface Props {
  context: WeeklyMacroContext
  /** Visual central de la columna derecha (ver DataSphere). */
  visual: ReactNode
  onEnter?: () => void
  /** Si se pasa, reemplaza el botón "Entrar" por defecto (ej. el formulario de código de acceso del candado de alumnos). */
  cta?: ReactNode
  /** Clase de altura del contenedor — min-h-screen por defecto (candado, sin Navigation). Pasar 'min-h-[calc(100vh-56px)]' cuando se usa dentro de (app) (con Navigation encima). */
  minHeightClass?: string
}

function IconArrowRight(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

const FEATURES = ['Eventos en tiempo real', 'Narrativa macro clara', 'Escenarios anticipados']

// Landing / puerta de entrada — igual que Hero.jsx de Entropia Analytics (misma
// familia visual), pero sin su lógica de negocio (useTrades/computeStats):
// el visual central es DataSphere en vez de la esfera de equity. Las
// lecturas flotantes vienen de WeeklyMacroContext (ya calculado en
// mockData), no de datos nuevos.
export function Landing({ context, visual, onEnter, cta, minHeightClass = 'min-h-screen' }: Props) {
  return (
    <div
      className={`relative ${minHeightClass} overflow-hidden bg-base-bg`}
      style={{
        backgroundImage:
          'radial-gradient(ellipse 1100px 700px at 78% 12%, rgba(59,130,246,0.16), transparent 60%),' +
          'radial-gradient(ellipse 900px 650px at 100% 90%, rgba(34,211,238,0.12), transparent 55%),' +
          'radial-gradient(ellipse 700px 500px at 0% 100%, rgba(150,242,110,0.05), transparent 60%)',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-12 py-16">
        {/* Wordmark */}
        <div className="mb-16">
          <Logo size="lg" />
        </div>

        {/* Fila principal: copy + visual */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center mb-16">
          {/* Columna izquierda */}
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-light tracking-tight leading-[1.16] text-base-text uppercase mb-5">
              Aprendé a{' '}
              <span className="bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] bg-clip-text text-transparent font-black">
                leer el mercado
              </span>
              . Interpretá, Anticipá, Decidí.
            </h1>

            <p className="text-[17px] text-base-text leading-relaxed max-w-md mb-7">
              Todo el contexto macro.
            </p>

            <div className="flex flex-wrap gap-5 mb-8">
              {FEATURES.map(f => (
                <div key={f} className="flex items-center gap-1.5 text-sm text-base-text">
                  <span className="w-1 h-1 rounded-full bg-brand" />
                  {f}
                </div>
              ))}
            </div>

            {cta ?? (onEnter && (
              <button
                onClick={onEnter}
                className="inline-flex items-center gap-2 bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] text-white text-base font-bold uppercase px-8 py-4 rounded-lg hover:opacity-85 transition-opacity"
              >
                Entrar <IconArrowRight className="w-[18px] h-[18px]" />
              </button>
            ))}
          </div>

          {/* Columna derecha — visual central enmarcado como instrumento */}
          <div className="relative w-full aspect-square max-w-[540px] justify-self-center">
            {[
              'top-0 left-0 border-t-[1.5px] border-l-[1.5px]',
              'top-0 right-0 border-t-[1.5px] border-r-[1.5px]',
              'bottom-0 left-0 border-b-[1.5px] border-l-[1.5px]',
              'bottom-0 right-0 border-b-[1.5px] border-r-[1.5px]',
            ].map(c => (
              <div key={c} className={`absolute w-[18px] h-[18px] border-base-line/70 ${c}`} />
            ))}

            <div className="absolute inset-[6%]">
              {visual}
            </div>

            <div className="absolute top-[9%] right-[4%] text-right font-mono pointer-events-none">
              <div className="text-xs tracking-wide text-base-muted uppercase">Convicción IA</div>
              <div className="text-[15px] text-base-text mt-0.5">{context.conviction}%</div>
            </div>
            <div className="absolute bottom-[11%] left-[2%] font-mono pointer-events-none">
              <div className="text-xs tracking-wide text-base-muted uppercase">Volatilidad esperada</div>
              <div className="text-[15px] text-brand mt-0.5">{context.volatilityLevel}</div>
            </div>
          </div>
        </div>

        <div className="text-center text-[12.5px] text-base-muted italic">
          "El mercado se mueve por expectativas — entenderlas es la ventaja."
        </div>
      </div>
    </div>
  )
}
