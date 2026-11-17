// ─────────────────────────────────────────────
//  EVENT IMPACT BADGE — Low · Medium · High (semáforo pos/neutral/neg)
// ─────────────────────────────────────────────

const IMPACT_META = {
  low:    { label: 'Low',    color: 'var(--pos)' },
  medium: { label: 'Medium', color: 'var(--amber)' },
  high:   { label: 'High',   color: 'var(--red)' },
}

export default function EventImpactBadge({ impact }) {
  const meta = IMPACT_META[impact] || IMPACT_META.low
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10.5, fontWeight: 700, color: meta.color,
      background: `${meta.color}1a`, border: `1px solid ${meta.color}40`,
      padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.3px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
      {meta.label}
    </span>
  )
}
