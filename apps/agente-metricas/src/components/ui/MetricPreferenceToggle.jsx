import { usePrimaryMetric, useSetPrimaryMetric } from '@/store/useStore'

// ─────────────────────────────────────────────
//  METRIC PREFERENCE TOGGLE — 3 botones pequeños ($/%/R) para
//  elegir cuál se muestra en grande en todos los <MetricDisplay/>
//  de la app. Autocontenido — se puede colocar en cualquier sitio
//  (sidebar, header del Dashboard...) sin depender de layout ajeno.
// ─────────────────────────────────────────────

const OPTIONS = [
  { key: 'dollar',  label: '$' },
  { key: 'percent', label: '%' },
  { key: 'r',       label: 'R' },
]

export default function MetricPreferenceToggle({ style }) {
  const preference = usePrimaryMetric()
  const setPreference = useSetPrimaryMetric()

  return (
    <div style={{
      display: 'inline-flex', borderRadius: 8, padding: 2,
      background: 'var(--bg3)', border: '1px solid var(--border2)', ...style,
    }}>
      {OPTIONS.map(opt => {
        const active = preference === opt.key
        return (
          <button
            key={opt.key}
            onClick={() => setPreference(opt.key)}
            title={`Mostrar ${opt.label} como métrica principal`}
            style={{
              width: 26, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
              background: active ? 'var(--bg)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text3)',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              transition: 'background 120ms, color 120ms',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}