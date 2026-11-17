// ProgressBar — SIEMPRE accent-gradient, nunca semáforo. Representa
// avance/proporción hacia una meta, no un resultado (ver sección 5).
export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100).toFixed(1)
  return (
    <div className="progress-bar">
      <div className="progress-fill bg-gradient-to-r from-[#1E40AF] to-[#3B82F6]" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Divider() {
  return <div className="divider" />
}
