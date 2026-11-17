import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  generateExecutiveSummary, generateDiagnosis,
  analyzeOperationalContext, generateRecommendations,
} from '@/config/mentorInsights'

// ─────────────────────────────────────────────
//  SESSION REVIEW MODAL
//
//  Resumen automático de la sesión de hoy. Reutiliza tal cual las
//  funciones de config/mentorInsights.js — las mismas que usa
//  IaMentor.jsx en /ia — no se inventa ningún cálculo ni
//  interpretación nueva aquí, solo se presenta.
//
//  Mismo patrón visual que WithdrawalModal (Portfolio.jsx): overlay
//  fijo oscurecido + card centrada. Entrada con fade + scale simple
//  (CSS transitions, sin librerías nuevas).
// ─────────────────────────────────────────────

function todayLabel() {
  const s = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function SessionReviewModal({ todayTrades, metrics, onClose }) {
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const executiveSummary = generateExecutiveSummary({ accountMetrics: metrics })
  const diagnosis        = generateDiagnosis({ accountMetrics: metrics })
  const contextInsights  = analyzeOperationalContext(todayTrades)
  const recommendations  = generateRecommendations({ diagnosis, contextInsights, accountMetrics: metrics })

  const totalR = todayTrades.reduce((s, t) => s + (t.rPnl || 0), 0)

  const handleFullAnalysis = () => { onClose(); navigate('/mentor-ia') }

  return (
    <div
      style={{
        position: 'fixed', whiteSpace: 'normal', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)', padding: 20,
        opacity: mounted ? 1 : 0, transition: 'opacity 200ms ease',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto',
          transform: mounted ? 'scale(1)' : 'scale(0.95)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 200ms ease, opacity 200ms ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div className="card-title" style={{ margin: 0, border: 'none', padding: 0 }}>📊 Resumen de sesión</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{todayLabel()}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Hero KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
          <div className="metric-hero">
            <div className="metric-label">Trades hoy</div>
            <div className="metric-value">{todayTrades.length}</div>
          </div>
          <div className="metric-hero">
            <div className="metric-label">PnL total</div>
            <div className="metric-value" style={{ color: totalR >= 0 ? 'var(--brand)' : 'var(--red)' }}>
              {totalR >= 0 ? '+' : ''}{totalR.toFixed(2)}R
            </div>
          </div>
          <div className="metric-hero">
            <div className="metric-label">Win Rate hoy</div>
            <div className="metric-value">{metrics ? `${metrics.winRate}%` : '—'}</div>
          </div>
        </div>

        {/* Lectura de hoy — generateExecutiveSummary */}
        {executiveSummary.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              Lectura de hoy
            </div>
            {executiveSummary.map((line, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 4 }}>· {line}</div>
            ))}
          </div>
        )}

        {/* Recomendaciones prioritarias — generateRecommendations (máx. 3) */}
        {recommendations.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
              Recomendaciones prioritarias
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recommendations.map((rec, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
                  padding: '10px 14px',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'var(--brand2)', color: 'var(--brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>{rec}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          <button className="btn btn-primary btn-sm" onClick={handleFullAnalysis}>Ver análisis completo →</button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
