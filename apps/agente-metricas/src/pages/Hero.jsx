import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, ArrowRight } from 'lucide-react'
import { useTrades } from '@/store/useStore'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { computeStats, computeGeneralScore } from '@/pages/dashboard/dashboardHelpers'

// ─────────────────────────────────────────────
//  HERO — pantalla de entrada premium
//
//  Puramente visual: reutiliza computeStats()/computeGeneralScore()
//  tal cual existen (mismos cálculos que ya usa Dashboard.jsx) y el
//  mismo MetricCard/IconCircle/Sparkline que pinta la Fila 1 del
//  Dashboard — mismo lenguaje visual, cero cálculos nuevos, cero
//  estado global nuevo. Es una puerta de entrada a /dashboard, que
//  sigue existiendo exactamente igual.
// ─────────────────────────────────────────────

// Distribución "phyllotaxis" (ángulo dorado) — puntos determinísticos,
// no aleatorios, para que el campo de datos no "parpadee" entre
// renders. Además deriva una red dispersa de conexiones entre nodos
// cercanos (mismo dato, sin nuevo estado ni cálculo de negocio).
function useSphereField(count, radius) {
  return useMemo(() => {
    const golden = 137.508 * (Math.PI / 180)
    const pts = []
    for (let i = 8; i < count; i++) {
      const r = radius * Math.sqrt(i / count)
      const a = i * golden
      pts.push({
        x: 260 + r * Math.cos(a),
        y: 260 + r * Math.sin(a),
        r: 0.5 + (i % 5) * 0.3,
        o: 0.12 + (i % 4) * 0.12,
        hub: i % 7 === 0,
      })
    }
    const links = []
    const THRESH = 28
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < THRESH) links.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[j].x, y2: pts[j].y, o: 0.22 - (d / THRESH) * 0.16 })
      }
    }
    // Anillo bezel — pequeñas marcas técnicas tipo instrumento de navegación.
    const ticks = Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * Math.PI * 2
      const major = i % 3 === 0
      const rOuter = 248
      const rInner = major ? 238 : 243
      return {
        x1: 260 + rInner * Math.cos(a), y1: 260 + rInner * Math.sin(a),
        x2: 260 + rOuter * Math.cos(a), y2: 260 + rOuter * Math.sin(a),
        o: major ? 0.35 : 0.14,
      }
    })
    return { pts, links, ticks }
  }, [count, radius])
}

export default function Hero() {
  const navigate = useNavigate()
  const trades = useTrades()
  const startOnboarding = useOnboardingStore(s => s.start)

  const stats = useMemo(() => (trades.length ? computeStats(trades) : null), [trades])
  const score = useMemo(() => (stats ? computeGeneralScore(stats) : null), [stats])
  const { pts, links, ticks } = useSphereField(72, 224)

  // Misma serie que ya usa Dashboard.jsx (Fila 1) para el sparkline del PnL.
  const equitySpark = stats?.equityCurve?.map(p => p.value)

  // Curva sobre el visual — misma normalización que Sparkline, solo a más escala.
  const curvePath = useMemo(() => {
    const data = equitySpark
    if (!data || data.length < 2) return null
    const w = 320, h = 110
    const min = Math.min(...data), max = Math.max(...data)
    const range = max - min || 1
    const step = w / (data.length - 1)
    return data.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(' ')
  }, [equitySpark])

  // Segunda trayectoria — media móvil de la misma serie, más tenue, para
  // dar sensación de varios vectores/trayectorias conviviendo en la esfera.
  const smoothPath = useMemo(() => {
    const data = equitySpark
    if (!data || data.length < 4) return null
    const smoothed = data.map((_, i) => {
      const win = data.slice(Math.max(0, i - 3), i + 1)
      return win.reduce((s, v) => s + v, 0) / win.length
    })
    const w = 320, h = 110
    const min = Math.min(...smoothed), max = Math.max(...smoothed)
    const range = max - min || 1
    const step = w / (smoothed.length - 1)
    return smoothed.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(' ')
  }, [equitySpark])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, overflow: 'auto',
        background:
          'radial-gradient(ellipse 1100px 700px at 78% 12%, rgba(59,130,246,0.16), transparent 60%),' +
          'radial-gradient(ellipse 900px 650px at 100% 90%, rgba(30,64,175,0.12), transparent 55%),' +
          'radial-gradient(ellipse 700px 500px at 0% 100%, rgba(150,242,110,0.05), transparent 60%),' +
          'var(--bg)',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 48px 72px' }}>

        {/* ── Wordmark ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 72 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 65, height: 65, borderRadius: 17, background: 'var(--accent-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px -2px rgba(59,130,246,0.5)',
            }}>
              <TrendingUp size={35} color="#fff" strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 31, letterSpacing: 0.3 }}>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>FACTOR</span>{' '}
                <span style={{
                  background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                  fontWeight: 900,
                }}>MÉTRICAS</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.6 }}>Entropia</div>
            </div>
          </div>
        </div>

        {/* ── Fila principal: copy + visual ── */}
        <div className="heroMainRow" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center', marginBottom: 64 }}>

          {/* Columna izquierda */}
          <div>
            <h1 style={{ fontSize: 60, fontWeight: 300, letterSpacing: '-1.4px', lineHeight: 1.12, color: 'var(--text)', marginBottom: 20, textTransform: 'uppercase' }}>
              Convierte tus datos en <span style={{
                background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                fontWeight: 900,
              }}>ventaja operativa</span>
            </h1>

            <p style={{ fontSize: 17, color: 'var(--text)', lineHeight: 1.7, maxWidth: 460, marginBottom: 28 }}>
              Analiza. Comprende. Mejora.<br />Todo tu rendimiento como trader, en un solo lugar.
            </p>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 34 }}>
              {['Análisis profundo', 'Patrones reales', 'Decisiones con datos'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: 'var(--text)' }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--brand)' }} />
                  {f}
                </div>
              ))}
            </div>

            <button
              className="btn btn-primary"
              style={{ padding: '18px 34px', fontSize: 16, fontWeight: 700, color: '#16181c', textTransform: 'uppercase' }}
              onClick={() => navigate('/inicio')}
            >
              Entrar al Dashboard <ArrowRight size={18} />
            </button>

            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => startOnboarding()}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text3)',
                  fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline',
                  textDecorationColor: 'var(--border2)', textUnderlineOffset: 3,
                }}
              >
                ¿Primera vez? Configuración guiada en 3 pasos →
              </button>
            </div>
          </div>

          {/* Columna derecha — objeto de datos: la esfera */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', maxWidth: 540, justifySelf: 'center' }}>

            {/* Corner brackets — marco técnico tipo instrumento */}
            {[
              { top: -2, left: -2, borderWidth: '1.5px 0 0 1.5px' },
              { top: -2, right: -2, borderWidth: '1.5px 1.5px 0 0' },
              { bottom: -2, left: -2, borderWidth: '0 0 1.5px 1.5px' },
              { bottom: -2, right: -2, borderWidth: '0 1.5px 1.5px 0' },
            ].map((c, i) => (
              <div key={i} style={{ position: 'absolute', width: 18, height: 18, borderColor: 'var(--border3)', borderStyle: 'solid', ...c }} />
            ))}

            {/* Barrido lento tipo radar — muy sutil */}
            <div style={{
              position: 'absolute', inset: '6%', borderRadius: '50%', overflow: 'hidden', pointerEvents: 'none',
              background: 'conic-gradient(from 0deg, transparent 0deg, rgba(59,130,246,0.10) 18deg, transparent 50deg)',
              animation: 'heroSweep 16s linear infinite',
            }} />

            <svg viewBox="0 0 520 520" width="100%" height="100%" style={{ display: 'block', position: 'relative' }}>
              <defs>
                <radialGradient id="heroCore" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"  stopColor="rgba(59,130,246,0.55)" />
                  <stop offset="40%" stopColor="rgba(59,130,246,0.12)" />
                  <stop offset="100%" stopColor="rgba(59,130,246,0)" />
                </radialGradient>
                <linearGradient id="heroCurve" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#8ef27a" />
                </linearGradient>
                <linearGradient id="heroRim" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="rgba(150,242,110,0.55)" />
                  <stop offset="45%" stopColor="rgba(59,130,246,0.08)" />
                  <stop offset="100%" stopColor="rgba(59,130,246,0)" />
                </linearGradient>
              </defs>

              {/* Núcleo — energía, no planeta */}
              <circle cx="260" cy="260" r="90" fill="url(#heroCore)" />

              {/* Esfera — silueta con luz de borde, no relleno */}
              <circle cx="260" cy="260" r="224" fill="none" stroke="url(#heroRim)" strokeWidth="1.1" />
              <circle cx="260" cy="260" r="224" fill="none" stroke="var(--border)" strokeWidth="1" />
              <circle cx="260" cy="260" r="168" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="1 7" />
              <circle cx="260" cy="260" r="112" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="1 5" opacity="0.6" />

              {/* Bezel — marcas de instrumento de navegación */}
              {ticks.map((t, i) => (
                <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="var(--brand)" strokeWidth="1" opacity={t.o} />
              ))}

              {/* Vectores orbitales — dos grupos girando en sentidos opuestos */}
              <g style={{ transformOrigin: '260px 260px', animation: 'heroSpin 100s linear infinite' }}>
                <ellipse cx="260" cy="260" rx="205" ry="70" fill="none" stroke="var(--brand2)" strokeWidth="1" transform="rotate(18 260 260)" />
                <ellipse cx="260" cy="260" rx="150" ry="150" fill="none" stroke="var(--border2)" strokeWidth="1" transform="rotate(-40 260 260)" opacity="0.5" />
              </g>
              <g style={{ transformOrigin: '260px 260px', animation: 'heroSpinRev 150s linear infinite' }}>
                <ellipse cx="260" cy="260" rx="196" ry="60" fill="none" stroke="var(--brand-deep2)" strokeWidth="1" transform="rotate(-58 260 260)" />
              </g>

              {/* Red de nodos — la "inteligencia" de la esfera */}
              {links.map((l, i) => (
                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--brand)" strokeWidth="0.6" opacity={l.o} />
              ))}
              {pts.map((p, i) => (
                <circle
                  key={i} cx={p.x} cy={p.y} r={p.hub ? p.r + 0.8 : p.r}
                  fill={p.hub ? 'var(--text)' : 'var(--brand)'} opacity={p.o}
                  style={p.hub ? { animation: `heroNodePulse 3.6s ease-in-out ${(i % 9) * 0.3}s infinite` } : undefined}
                />
              ))}

              {/* Trayectorias — equity real, integradas en la esfera */}
              {smoothPath && (
                <g transform="translate(100, 205)">
                  <polyline points={smoothPath} fill="none" stroke="var(--text3)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
                </g>
              )}
              {curvePath && (
                <g transform="translate(100, 205)">
                  <polyline points={curvePath} fill="none" stroke="url(#heroCurve)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              )}

              {/* Núcleo pulsante */}
              <circle cx="260" cy="260" r="3" fill="var(--text)">
                <animate attributeName="r" values="2.5;5;2.5" dur="2.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.35;1" dur="2.8s" repeatCount="indefinite" />
              </circle>
            </svg>

            {/* Lecturas técnicas — sin tarjetas, solo etiqueta + línea guía */}
            <div style={{
              position: 'absolute', top: '9%', right: '4%', textAlign: 'right',
              fontFamily: 'var(--mono)', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 9, letterSpacing: 1, color: 'var(--text3)', textTransform: 'uppercase' }}>Consistency</div>
              <div style={{ fontSize: 15, color: 'var(--text)', marginTop: 2 }}>{score ? `${score.overall}%` : '—'}</div>
            </div>
            <div style={{
              position: 'absolute', bottom: '11%', left: '2%',
              fontFamily: 'var(--mono)', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 9, letterSpacing: 1, color: 'var(--text3)', textTransform: 'uppercase' }}>Expectancy</div>
              <div style={{ fontSize: 15, color: 'var(--brand)', marginTop: 2 }}>
                {stats ? `${stats.expectancy >= 0 ? '+' : ''}${stats.expectancy}R` : '—'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12.5, color: 'var(--text3)', fontStyle: 'italic' }}>
          "Lo que se mide, se puede mejorar."
        </div>
      </div>

      <style>{`
        @keyframes heroSpin    { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes heroSpinRev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes heroSweep   { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes heroNodePulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.9; } }
        @media (max-width: 860px) {
          .heroMainRow { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
