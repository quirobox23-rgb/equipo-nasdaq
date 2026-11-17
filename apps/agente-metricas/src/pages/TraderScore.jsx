import {
  Target, Repeat, Shield, TrendingUp, Brain, Crosshair,
  LineChart as LineChartIcon, ThumbsUp, ThumbsDown, FlaskConical,
} from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { Card, PageHeader, ProgressBar, IconCircle, ScoreGauge } from '@/components/ui'
import PremiumGate from '@/components/premium/PremiumGate'

// ─────────────────────────────────────────────
//  TRADER SCORE — Arquitectura visual (Sprint 9)
//
//  Indicador global de calidad de ejecución del trader.
//  No es una métrica financiera: mide disciplina, consistencia
//  y ejecución a lo largo del tiempo.
//
//  IMPORTANTE: esta página es solo estructura visual.
//  Los valores mostrados son de ejemplo (estáticos) y no
//  provienen de ningún cálculo real. El algoritmo de cálculo
//  se conectará en un sprint posterior.
// ─────────────────────────────────────────────

// Datos de ejemplo — sin cálculo real, solo para maquetar la interfaz
const EXAMPLE_OVERALL_SCORE = 78

const EXAMPLE_CATEGORIES = [
  { key: 'disciplina',    label: 'Disciplina',          icon: Target,     value: 82 },
  { key: 'consistencia',  label: 'Consistencia',        icon: Repeat,     value: 74 },
  { key: 'riesgo',        label: 'Gestión del Riesgo',  icon: Shield,     value: 69 },
  { key: 'rentabilidad',  label: 'Rentabilidad',        icon: TrendingUp, value: 80 },
  { key: 'psicologia',    label: 'Psicología',          icon: Brain,      value: 65 },
  { key: 'ejecucion',     label: 'Ejecución',           icon: Crosshair,  value: 88 },
].map(c => ({ ...c, color: 'primary' }))

// Diseño alternativo (guardado, no borrado): las 6 cards de dimensiones
// (grid 2x3) al lado del Puntaje General, con el radar en una fila aparte
// debajo. Desactivado 2026-10-04: el radar ya muestra los mismos valores
// en su lista, las cards repetían la info. Poner en true para volver.
const SHOW_CATEGORY_CARDS = false

// Puntaje General v2 (2026-10-04): gauge chico + cambio vs. mes anterior
// + evolución de los últimos meses, en una sola card angosta (el radar
// de al lado gana el protagonismo). El diseño anterior
// (gauge grande de 240px + número repetido al lado) queda guardado:
// poner en false para volver. Con v2, la card "Evolución" (placeholder)
// se oculta porque la mini curva ya la absorbe.
const SCORE_SUMMARY_V2 = true

// Evolución del Puntaje General, últimos 6 meses — de ejemplo. El último
// valor es el actual (EXAMPLE_OVERALL_SCORE) y el anteúltimo, el mes anterior.
const EXAMPLE_SCORE_HISTORY = [
  { month: 'May', value: 62 }, { month: 'Jun', value: 66 }, { month: 'Jul', value: 65 },
  { month: 'Ago', value: 71 }, { month: 'Sep', value: 74 }, { month: 'Oct', value: 78 },
]

// Mes anterior — también de ejemplo, para la maqueta del radar
// (actual vs. mes anterior). Ver docs/idea-radar-perfil-trader.md.
const EXAMPLE_PREV_VALUES = {
  disciplina: 76, consistencia: 70, riesgo: 72, rentabilidad: 71, psicologia: 66, ejecucion: 84,
}

// Orden de ejes del radar — pensado, no el de las cards: mitad derecha
// = comportamiento (Disciplina, Psicología, Ejecución), mitad izquierda
// = resultados (Rentabilidad, Consistencia, Riesgo). Así "la forma se
// inclina hacia un lado" ya es una lectura en sí.
const RADAR_AXIS_ORDER = ['disciplina', 'psicologia', 'ejecucion', 'rentabilidad', 'consistencia', 'riesgo']

// Esquema binario, no tres tonos — mismo criterio que Fortalezas/Áreas
// de mejora en Mentor IA: a mejorar (rojo/neg) vs. a mantener (verde/pos).
const EXAMPLE_RECOMMENDATIONS = [
  {
    icon: ThumbsDown,
    type: 'mejorar',
    color: 'neg',
    title: 'Reducir sobreoperación',
    text: 'Ejemplo de recomendación futura basada en el número de operaciones por sesión.',
  },
  {
    icon: ThumbsDown,
    type: 'mejorar',
    color: 'neg',
    title: 'Mejorar gestión de pérdidas',
    text: 'Ejemplo de recomendación futura basada en el tamaño y frecuencia de las pérdidas.',
  },
  {
    icon: ThumbsUp,
    type: 'mantener',
    color: 'pos',
    title: 'Mantener consistencia semanal',
    text: 'Ejemplo de recomendación futura basada en la regularidad de resultados semana a semana.',
  },
]

// ─────────────────────────────────────────────
//  COMPONENTS
// ─────────────────────────────────────────────

/**
 * CategoryCard — Tarjeta de categoría del Trader Score
 * Solo diseño: icono, nombre, barra de progreso y valor de ejemplo.
 */
function CategoryCard({ category }) {
  const Icon = category.icon
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <IconCircle icon={<Icon size={16} />} color={category.color} size={32} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{category.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>valor de ejemplo</div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)' }}>
          {category.value}
        </div>
      </div>
      <ProgressBar value={category.value} max={100} />
    </Card>
  )
}

/**
 * ScoreSummary — Puntaje General v2: gauge con el número, cambio vs. mes
 * anterior y mini curva de evolución. Datos de ejemplo.
 */
function ScoreSummary({ score, history }) {
  const prev = history.length > 1 ? history[history.length - 2].value : score
  const delta = score - prev

  return (
    // Dos cards apiladas en la columna angosta: Puntaje General arriba,
    // Evolución abajo (crece para emparejar la altura del radar).
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <Card title="Puntaje General">
      {/* Gauge + cambio vs. mes anterior, centrados */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="score-gauge--lg">
          <ScoreGauge value={score} max={100} label="de 100" size={150} strokeWidth={12} gradient />
        </div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 13,
          color: delta > 0 ? 'var(--pos)' : delta < 0 ? 'var(--neg)' : 'var(--text3)',
        }}>
          {delta > 0 ? '+' : ''}{delta} <span style={{ fontFamily: 'var(--font)', color: 'var(--text3)' }}>vs. mes anterior</span>
        </div>
      </div>

    </Card>

    {/* Evolución — mini curva de los últimos meses */}
    <Card title={`Evolución · últimos ${history.length} meses`} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 96 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreHistFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="scoreHistStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1E40AF" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text3)', fontSize: 11, fontFamily: 'var(--font)' }} />
            <YAxis hide domain={['dataMin - 6', 'dataMax + 4']} />
            <Tooltip
              cursor={{ stroke: 'var(--border2)' }}
              contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'var(--text3)' }}
              itemStyle={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}
              formatter={(v) => [v, 'Puntaje']}
            />
            <Area type="monotone" dataKey="value" stroke="url(#scoreHistStroke)" strokeWidth={2.5} fill="url(#scoreHistFill)"
              dot={false} activeDot={{ r: 3.5, fill: '#3B82F6', stroke: 'var(--bg)' }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
    </div>
  )
}

/**
 * ProfileRadar — Perfil del trader: forma actual vs. mes anterior
 * (maqueta con datos de ejemplo). El radar da la forma; los valores
 * exactos y el cambio van en la lista de la derecha.
 */
function ProfileRadar({ categories, prev, stacked, className }) {
  const byKey = Object.fromEntries(categories.map(c => [c.key, c]))
  const data = RADAR_AXIS_ORDER.map(k => ({
    key: k, label: byKey[k].label, actual: byKey[k].value, prev: prev[k],
  }))
  return (
    <Card className={className} title="Perfil del trader">
      {/* stacked: radar arriba y lista abajo en 2 columnas — para cuando la
          card ocupa media fila (al lado del Puntaje General). */}
      <div style={{
        display: 'grid', gap: stacked ? 12 : 24, alignItems: 'center',
        gridTemplateColumns: stacked ? '1fr' : '1.2fr 1fr',
      }}>
        <div>
          <ResponsiveContainer width="100%" height={stacked ? 280 : 360}>
            {/* startAngle 60: 3 ejes a la derecha (comportamiento) y 3 a la
                izquierda (resultados), ninguno partido al medio. */}
            <RadarChart data={data} outerRadius={stacked ? '72%' : '76%'} startAngle={60} endAngle={-300}>
              {/* Gradiente de marca (oscuro → claro, igual que --accent-gradient
                  y la curva de equity de Métricas). */}
              <defs>
                <linearGradient id="profileRadarStroke" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1E40AF" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
                <linearGradient id="profileRadarFill" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1E40AF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <PolarGrid stroke="var(--border2)" />
              <PolarAngleAxis dataKey="label" tick={{ fill: 'var(--text2)', fontSize: 12, fontFamily: 'var(--font)' }} />
              <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={false} axisLine={false} />
              <Radar name="Mes anterior" dataKey="prev" stroke="var(--text3)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" isAnimationActive={false} />
              <Radar name="Este mes" dataKey="actual" stroke="url(#profileRadarStroke)" strokeWidth={2.5} fill="url(#profileRadarFill)" fillOpacity={1} isAnimationActive={false} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: 12, color: 'var(--text2)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 2, background: 'var(--accent-gradient)' }} /> Este mes
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 0, borderTop: '2px dashed var(--text3)' }} /> Mes anterior
            </span>
          </div>
        </div>

        <div style={stacked ? { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24 } : undefined}>
          {data.map((d, i) => {
            const delta = d.actual - d.prev
            const firstRow = stacked ? i < 2 : i === 0
            return (
              <div key={d.key} style={{
                display: 'grid', gridTemplateColumns: '1fr auto 44px', alignItems: 'baseline', gap: 12,
                padding: '10px 0', borderTop: firstRow ? 'none' : '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 14, color: 'var(--text)' }}>{d.label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{d.actual}</span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'right',
                  color: delta > 0 ? 'var(--pos)' : delta < 0 ? 'var(--neg)' : 'var(--text3)',
                }}>
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              </div>
            )
          })}
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, gridColumn: '1 / -1' }}>Cambio vs. mes anterior · escala 0–100</div>
        </div>
      </div>
    </Card>
  )
}

/**
 * RecommendationCard — Tarjeta de recomendación futura (contenido estático)
 */
function RecommendationCard({ recommendation }) {
  const Icon = recommendation.icon
  const isMantener = recommendation.type === 'mantener'
  return (
    <Card style={{
      background: isMantener ? 'rgba(59,130,246,0.06)' : 'rgba(227,114,114,0.06)',
      border: `1px solid ${isMantener ? 'rgba(59,130,246,0.2)' : 'rgba(227,114,114,0.2)'}`,
    }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <IconCircle icon={<Icon size={16} />} color={recommendation.color} size={30} />
        <div>
          <div style={{
            fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4,
            color: recommendation.type === 'mantener' ? 'var(--pos)' : 'var(--neg)',
          }}>
            {recommendation.type === 'mantener' ? 'A mantener' : 'A mejorar'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {recommendation.title}
          </div>
          <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.5 }}>
            {recommendation.text}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────
//  TRADER SCORE PAGE
// ─────────────────────────────────────────────
export default function TraderScore() {
  return (
    <PremiumGate feature="traderScore">
    <div className="page-inner">
      <PageHeader
        title="Puntaje del Trader"
        subtitle="Tu evolución como trader basada en disciplina, consistencia y ejecución."
      >
        {/* Toda la página es maqueta: puntaje, dimensiones, radar y
            recomendaciones son datos de ejemplo hasta que se conecte el
            algoritmo real. */}
        <span className="badge badge-amber" title="Los valores de esta página son de ejemplo — el cálculo real todavía no está conectado." style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FlaskConical size={13} /> Datos de demo
        </span>
      </PageHeader>

      {/* ══════════════════════════════════════
          SCORE PRINCIPAL (50%) + PERFIL DEL TRADER / radar (50%)
          — diseño alternativo: CATEGORÍAS (50%, grid 2x3), ver SHOW_CATEGORY_CARDS
      ══════════════════════════════════════ */}
      {/* v2: Puntaje General angosto (1fr) y radar ancho (2fr) — el radar
          es el protagonista. Diseño anterior: 1fr 1fr. */}
      <div className="section-gap" style={{ display: 'grid', gridTemplateColumns: SCORE_SUMMARY_V2 && !SHOW_CATEGORY_CARDS ? '1fr 2fr' : '1fr 1fr', gap: 20, alignItems: 'stretch' }}>
        {SCORE_SUMMARY_V2 ? (
          <ScoreSummary score={EXAMPLE_OVERALL_SCORE} history={EXAMPLE_SCORE_HISTORY} />
        ) : (
        <Card title="Puntaje General" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 24, padding: '12px 0', flex: 1,
          }}>
            <ScoreGauge
              value={EXAMPLE_OVERALL_SCORE}
              max={100}
              label="Puntaje del Trader"
              size={240}
              strokeWidth={18}
              gradient
            />
            <div>
              <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'var(--mono)' }}>
                {EXAMPLE_OVERALL_SCORE} <span style={{ fontSize: 22, color: 'var(--text3)' }}>/ 100</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                Valor de ejemplo — el algoritmo de cálculo se conectará próximamente.
              </div>
            </div>
          </div>
        </Card>
        )}

        {SHOW_CATEGORY_CARDS ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          {EXAMPLE_CATEGORIES.map(category => (
            <CategoryCard key={category.key} category={category} />
          ))}
        </div>
        ) : (
          <ProfileRadar stacked={!SCORE_SUMMARY_V2} categories={EXAMPLE_CATEGORIES} prev={EXAMPLE_PREV_VALUES} />
        )}
      </div>

      {/* ══════════════════════════════════════
          PERFIL DEL TRADER — radar actual vs. mes anterior (maqueta)
      ══════════════════════════════════════ */}
      {/* En el diseño alternativo (cards de dimensiones), el radar va en
          su propia fila, con la lista al costado. */}
      {SHOW_CATEGORY_CARDS && (
        <ProfileRadar className="section-gap" categories={EXAMPLE_CATEGORIES} prev={EXAMPLE_PREV_VALUES} />
      )}

      {/* ══════════════════════════════════════
          EVOLUCIÓN — espacio reservado para gráfico futuro
      ══════════════════════════════════════ */}
      {/* Oculta con SCORE_SUMMARY_V2: la mini curva del Puntaje General ya la absorbe. */}
      {!SCORE_SUMMARY_V2 && (
      <Card className="section-gap" title="Evolución del Puntaje del Trader">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, padding: '48px 0', color: 'var(--text3)',
        }}>
          <LineChartIcon size={18} />
          <span style={{ fontSize: 12 }}>
            Espacio reservado para el gráfico de evolución (próximo sprint)
          </span>
        </div>
      </Card>
      )}

      {/* ══════════════════════════════════════
          RECOMENDACIONES — contenido estático de ejemplo
      ══════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h3 style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '1.2px',
          textTransform: 'uppercase', color: 'var(--section-accent)', whiteSpace: 'nowrap',
        }}>
          Recomendaciones
        </h3>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12,
      }}>
        {EXAMPLE_RECOMMENDATIONS.map(rec => (
          <RecommendationCard key={rec.title} recommendation={rec} />
        ))}
      </div>
    </div>
    </PremiumGate>
  )
}
