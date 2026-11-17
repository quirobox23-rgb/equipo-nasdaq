// Sparkline — mini-gráfico de línea a partir de una serie de números,
// usado dentro de MetricCard (prop `spark`) para mostrar la tendencia
// real, no solo el valor puntual.
interface Props {
  data: number[]
  color?: string
  width?: number
  height?: number
}

export function Sparkline({ data = [], color = '#3B82F6', width = 72, height = 26 }: Props) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ')
  const areaPoints = `0,${height} ${points} ${width},${height}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polygon points={areaPoints} fill={color} opacity="0.12" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
