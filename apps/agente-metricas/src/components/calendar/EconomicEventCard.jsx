import { useState } from 'react'
import EventImpactBadge from './EventImpactBadge'

// ─────────────────────────────────────────────
//  ECONOMIC EVENT CARD
// ─────────────────────────────────────────────

const COUNTRY_FLAG = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', CNY: '🇨🇳',
}

function isPast(event) {
  const eventTime = new Date(`${event.date}T${(event.time || '00:00')}:00`)
  return eventTime.getTime() < Date.now()
}

function minutesUntil(event) {
  const eventTime = new Date(`${event.date}T${(event.time || '00:00')}:00`)
  return (eventTime.getTime() - Date.now()) / 60000
}

/**
 * historicalStats (opcional, fase 2): { winRate, avgR, trades, baselineWinRate }
 * — se calcula fuera (Calendar.jsx cruzando trades con la fecha del evento)
 * y solo se PRESENTA aquí; esta card no toca el store de trades.
 */
export default function EconomicEventCard({ event, historicalStats }) {
  const [expanded, setExpanded] = useState(false)

  const past = isPast(event)
  const mins = minutesUntil(event)
  const isImminent = !past && mins <= 60

  const borderColor = event.impact === 'high' ? 'var(--red)' : event.impact === 'medium' ? 'var(--amber)' : 'var(--brand)'

  const actualColor = event.actual == null ? 'var(--text2)'
    : (parseFloat(event.actual) >= parseFloat(event.forecast) ? 'var(--brand)' : 'var(--red)')

  return (
    <div
      className="card-sm"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        opacity: past ? 0.5 : 1,
        marginBottom: 8,
        animation: isImminent ? 'eventPulse 1.8s ease-in-out infinite' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', minWidth: 66 }}>
          {event.time} {event.timezone}
        </span>
        <span style={{ fontSize: 15 }}>{COUNTRY_FLAG[event.country] || '🌐'}</span>
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
          textDecoration: past ? 'line-through' : 'none', flex: 1, minWidth: 140,
        }}>
          {event.title}
        </span>
        <EventImpactBadge impact={event.impact} />
      </div>

      {(event.forecast || event.previous) && (
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
          {event.forecast && <span>Forecast: <strong style={{ color: 'var(--text2)' }}>{event.forecast}</strong></span>}
          {event.previous && <span>Previous: <strong style={{ color: 'var(--text2)' }}>{event.previous}</strong></span>}
          {event.actual != null && <span>Actual: <strong style={{ color: actualColor }}>{event.actual}</strong></span>}
        </div>
      )}

      {event.relatedPairs?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {event.relatedPairs.map((p) => (
            <span key={p} style={{
              fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)',
              background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px',
            }}>{p}</span>
          ))}
        </div>
      )}

      {historicalStats && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'none', border: 'none', color: 'var(--brand)', fontSize: 10.5,
              cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {expanded ? '▾' : '▸'} Tu historial en días de {event.title}
          </button>
          {expanded && (
            <div style={{
              marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--bg3)',
              border: '1px solid var(--border)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.6,
            }}>
              {historicalStats.trades > 0 ? (
                <>
                  Win Rate: <strong style={{ color: 'var(--text)' }}>{historicalStats.winRate}%</strong>
                  {' '}(vs {historicalStats.baselineWinRate}% media) · {historicalStats.trades} trades ·
                  {' '}promedio <strong style={{ color: historicalStats.avgR >= 0 ? 'var(--brand)' : 'var(--red)' }}>
                    {historicalStats.avgR >= 0 ? '+' : ''}{historicalStats.avgR}R
                  </strong>
                </>
              ) : (
                'Todavía no has operado en un día con este evento.'
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes eventPulse {
          0%, 100% { border-left-color: ${borderColor}; }
          50% { border-left-color: ${borderColor}99; }
        }
      `}</style>
    </div>
  )
}
