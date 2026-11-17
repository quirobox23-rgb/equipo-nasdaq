import { usePrimaryMetric } from '@/store/useStore'

// ─────────────────────────────────────────────
//  METRIC DISPLAY — $ / % / R con una métrica principal (grande)
//  y las otras dos como referencia (pequeñas, debajo).
//
//  Cuál es la principal se decide UNA sola vez para toda la app
//  (useStore: primaryMetric — Dashboard, Portfolio, Metrix...),
//  no por componente. Este componente no decide la preferencia,
//  solo la aplica: recibe los 3 valores ya calculados y los pinta
//  en el orden correcto.
//
//  Uso:
//    <MetricDisplay dollar={1240} percent={2.3} r={2.1} />
//
//  Si `r` es null (cuenta sin riesgo por trade configurado) y la
//  preferencia es 'r', se cae a $ como principal con un aviso corto
//  — nunca se muestra un R falso ni se rompe el render.
// ─────────────────────────────────────────────

const METRIC_META = {
  dollar:  { key: 'dollar',  label: '$', format: (v) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
  percent: { key: 'percent', label: '%', format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` },
  r:       { key: 'r',       label: 'R', format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}R` },
}

export default function MetricDisplay({ dollar, percent, r, label, className, style }) {
  const preference = usePrimaryMetric() // 'dollar' | 'percent' | 'r'

  const values = { dollar, percent, r }
  const available = (key) => values[key] !== null && values[key] !== undefined && !Number.isNaN(values[key])

  // Si la preferencia elegida no está disponible para este dato en
  // concreto (típicamente 'r' sin riesgo configurado), se cae a $ —
  // nunca se inventa un valor ni se rompe el render.
  const fallbackOrder = ['dollar', 'percent', 'r']
  const mainKey = available(preference) ? preference : fallbackOrder.find(available)
  const restKeys = fallbackOrder.filter(k => k !== mainKey && available(k))

  if (!mainKey) return null

  const main = METRIC_META[mainKey]
  const mainValue = values[mainKey]

  return (
    <div className={className} style={style}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 36, fontWeight: 700, letterSpacing: '-0.5px',
        color: mainValue >= 0 ? 'var(--pos)' : 'var(--neg)',
      }}>
        {main.format(mainValue)}
      </div>

      {preference === 'r' && !available('r') && (
        <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 2 }}>
          Configura el riesgo por trade para ver en R
        </div>
      )}

      {restKeys.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {restKeys.map(k => (
            <span key={k} style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
              {METRIC_META[k].format(values[k])}
            </span>
          ))}
        </div>
      )}

      {label && (
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          {label}
        </div>
      )}
    </div>
  )
}