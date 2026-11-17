// ─────────────────────────────────────────────
//  EDGELOG · Reusable UI Components
// ─────────────────────────────────────────────

import React, { useEffect, useId } from 'react'
import { Lightbulb, Lock, Sun, Moon, Check, User, ArrowLeft, ArrowRight } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MATCH_STATUS_META } from '@/config/blueprintMatchEngine'
import { clsx } from 'clsx'
import { useHasFeature } from '@/store/useStore'
import { TIER_LABELS, requiredTierFor } from '@/config/features'

// Páginas de "drill-down" sin entrada propia en el sidebar — ahí el
// botón de volver suma porque no hay otra forma de retroceder. En las
// páginas del sidebar (Dashboard, Metrix, Portfolio, etc.) es
// redundante con la navegación lateral y no se muestra.
const BACK_BUTTON_ROUTES = [
  '/historial', '/approach', '/calendar', '/montecarlo',
  '/kelly', '/rentabilidad', '/consistencia', '/setups', '/rutina-diaria',
]

// ── IconCircle ────────────────────────────────
// Círculo de color de fondo para un icono/emoji — usado en MetricCard,
// InsightCard y QuickLinkCard para dar peso visual sin añadir texto.
// color: 'primary' (default) | 'text' | 'pos' | 'neg' | 'neutral' | 'info' | 'info-dark'
export function IconCircle({ icon, color = 'primary', size = 30 }) {
  return (
    <div
      className={`icon-circle icon-circle-${color}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      {icon}
    </div>
  )
}

// ── IconDisplay ───────────────────────────────
// Ícono grande, sin fondo, trazo grueso con gradiente de marca —
// nivel "4. Icon display" de StyleGuide → Íconos. Uso: bloques de
// feature/marketing (ej. cards con imagen de la portada), nunca UI
// de producto (para eso están IconCircle / .icon-*).
export function IconDisplay({ icon: Icon, size = 72, strokeWidth = 1.8 }) {
  const gradientId = useId()
  return (
    <span style={{ display: 'inline-flex' }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="#1E40AF" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
      <Icon size={size} strokeWidth={strokeWidth} stroke={`url(#${gradientId})`} />
    </span>
  )
}

// ── Sparkline ─────────────────────────────────
// Mini-gráfico de línea a partir de una serie de números — se usa
// dentro de MetricCard para mostrar la tendencia real, no solo el
// valor puntual.
export function Sparkline({ data = [], color = 'var(--brand)', width = 72, height = 26 }) {
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
    <svg width={width} height={height} className="sparkline" viewBox={`0 0 ${width} ${height}`}>
      <polygon points={areaPoints} fill={color} opacity="0.12" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── MetricCard ────────────────────────────────
// size="hero" es solo un modificador visual (usado para los 3-4 KPIs
// principales del Dashboard) — el resto de props y usos existentes
// no cambian. icon/iconColor/spark son opcionales y solo se pintan
// si se pasan explícitamente.
// deltaMuted: la bajada va en gris aunque el valor lleve semáforo — para
// bajadas descriptivas ("operaciones seguidas", "12 ganadas · 8 perdidas"),
// que no son un resultado en sí.
export function MetricCard({ label, value, delta, deltaUp, deltaMuted, className, size, icon, iconColor, spark }) {
  return (
    <div className={clsx('metric', size === 'hero' && 'metric-hero', className)}>
      <div className="metric-top-row">
        <div>
          <div className="metric-label">{label}</div>
          <div className={clsx('metric-value', deltaUp === true ? 'up' : deltaUp === false ? 'down' : '')}>
            {value}
          </div>
        </div>
        {icon && <IconCircle icon={icon} color={iconColor ?? (deltaUp === false ? 'neg' : 'pos')} />}
      </div>
      <div className="metric-bottom-row">
        {delta && (
          <div className={clsx('metric-delta', deltaMuted ? 'muted' : deltaUp === true ? 'up' : deltaUp === false ? 'down' : 'muted')}>
            {delta}
          </div>
        )}
        {spark && <Sparkline data={spark} color={deltaUp === false ? 'var(--neg)' : 'var(--pos)'} />}
      </div>
    </div>
  )
}

// ── ScoreGauge ────────────────────────────────
// Gauge circular de progreso (arco), estilo "Puntuación General" de
// la referencia. value/max definen el arco relleno.
export function ScoreGauge({ value, max = 100, label = 'Puntuación', size = 96, color = 'var(--brand-deep)', gradient = false, strokeWidth = 8 }) {
  const gradientId = useId()
  const pct = Math.max(0, Math.min(1, value / max))
  const r = (size - strokeWidth - 4) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - pct)
  return (
    <div className="score-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {gradient && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
        )}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border2)" strokeWidth={strokeWidth} />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={gradient ? `url(#${gradientId})` : color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="score-gauge-center">
        <div className="score-gauge-value">{Math.round(value)}</div>
        <div className="score-gauge-label">{label}</div>
      </div>
    </div>
  )
}

// ── Badge ─────────────────────────────────────
export function Badge({ children, variant = 'blue' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

// ── Tag ───────────────────────────────────────
export function Tag({ children }) {
  return <span className="tag">{children}</span>
}

// ── Button ────────────────────────────────────
export function Button({ children, variant = 'secondary', size, onClick, className, ...props }) {
  return (
    <button
      onClick={onClick}
      className={clsx('btn', `btn-${variant}`, size && `btn-${size}`, className)}
      {...props}
    >
      {children}
    </button>
  )
}

// ── Card ──────────────────────────────────────
export function Card({ children, className, title, style }) {
  return (
    <div className={clsx('card', className)} style={style}>
      {title && <div className="card-title">{title}</div>}
      {children}
    </div>
  )
}

// ── PanelHeader ───────────────────────────────
// Cabecera de bloque (traída de Agente Macro): título sobrio a la
// izquierda y aclaración (fuente, unidad o badge) a la derecha, sobre
// --bg-panel2. Primer hijo de una .card.card--flush; el contenido va
// en .card__body. Ver StyleGuide → Cabecera de bloque.
export function PanelHeader({ title, subtitle, aside }) {
  return (
    <div className="panel-header">
      <h2 className="panel-header__title">
        {title}
        {subtitle && <span className="panel-header__subtitle">· {subtitle}</span>}
      </h2>
      {aside && <span className="panel-header__aside">{aside}</span>}
    </div>
  )
}

// ── SectionTitle ──────────────────────────────
// Encabezado de sección con divisor. Gris por defecto (desde 2026-10-04);
// variant="accent" para la versión verde, en casos puntuales.
export function SectionTitle({ children, variant = 'muted', style }) {
  return (
    <div className="section-title-row" style={style}>
      <h3 className={clsx('section-title', variant === 'accent' && 'section-title--accent')}>{children}</h3>
      <div className="section-title-line" />
    </div>
  )
}

// ── ActionCard ────────────────────────────────
// Tarjeta de acción (traída de Agente Macro): .card--image con ícono
// display a la derecha. Título · descripción · botón .btn-lg (primary
// en la principal, outline en la otra). Ver StyleGuide → Tarjetas de acción.
// compact: para columnas angostas (ej. 1/3 del grid) — columna del
// ícono de 120px en vez de 200px, botón .btn-sm, sin descripción.
export function ActionCard({ title, description, cta, icon, primary, compact, onClick }) {
  return (
    <div className={clsx('card card--image action-card', compact && 'action-card--compact')} onClick={onClick}>
      <div className="card--image__content">
        <h3 className="action-card__title" style={description ? undefined : { marginBottom: 12 }}>{title}</h3>
        {description && <p className="action-card__desc">{description}</p>}
        <button type="button" className={clsx('btn', compact ? 'btn-sm' : 'btn-lg', primary ? 'btn-primary' : 'btn-outline')} style={{ alignSelf: 'flex-start' }}>
          {cta} <ArrowRight size={compact ? 13 : 15} />
        </button>
      </div>
      <div className="card--image__photo action-card__icon">
        <IconDisplay icon={icon} size={compact ? 64 : 96} strokeWidth={1.4} />
      </div>
    </div>
  )
}

// ── PageHeader ────────────────────────────────
export function PageHeader({ title, subtitle, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const showBack = BACK_BUTTON_ROUTES.includes(location.pathname)

  return (
    <div className="page-header">
      <div>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              aria-label="Atrás"
              title="Atrás"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 'var(--r)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          {title}
          {subtitle && (
            <>
              <span aria-hidden="true" style={{ width: 1, height: 16, background: 'var(--border3)', flexShrink: 0 }} />
              <span className="page-sub-inline">{subtitle}</span>
            </>
          )}
        </h1>
      </div>
      {children && <div className="flex-center">{children}</div>}
    </div>
  )
}

// ── ProgressBar ───────────────────────────────
export function ProgressBar({ value, max = 100 }) {
  const pct = Math.min(100, (value / max) * 100).toFixed(1)
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--accent-gradient)' }} />
    </div>
  )
}

// ── Divider ───────────────────────────────────
export function Divider() {
  return <div className="divider" />
}

// ── ResultBadge ───────────────────────────────
export function ResultBadge({ result }) {
  const map = { win: 'win-solid', loss: 'loss-solid', breakeven: 'be-solid' }
  const label = { win: 'WIN', loss: 'LOSS', breakeven: 'BE' }
  return <span className={`badge badge-${map[result] ?? 'blue'}`}>{label[result] ?? result.toUpperCase()}</span>
}

// ── DirectionBadge ────────────────────────────
export function DirectionBadge({ direction }) {
  return <Badge variant={direction === 'Long' ? 'green' : 'red'}>{direction}</Badge>
}

// ── RValue ────────────────────────────────────
export function RValue({ value }) {
  // Dinámico: 1 decimal si es redondo (0.0), 2 si no (0.86)
  const fmt = (v) => (Math.round(v * 10) === v * 10 ? v.toFixed(1) : v.toFixed(2))
  const formatted = value >= 0 ? `+${fmt(value)}R` : `${fmt(value)}R`
  return <span className={clsx('mono', value >= 0 ? 'up' : 'down')}>{formatted}</span>
}

// ── Tabs ──────────────────────────────────────
export function Tabs({ options, value, onChange }) {
  return (
    <div className="tabs">
      {options.map((opt) => (
        <div
          key={opt.value}
          className={clsx('tab', value === opt.value && 'active')}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </div>
      ))}
    </div>
  )
}

// ── CheckItem ─────────────────────────────────
export function CheckItem({ text, checked, onToggle }) {
  return (
    <div className={clsx('check-item', checked && 'checked')} onClick={onToggle}>
      <div className="check-box">
        {checked && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="#0a0e17" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </div>
      <div style={{ fontSize: '12.5px' }}>{text}</div>
    </div>
  )
}

// ── AiBubble ─────────────────────────────────
export function AiBubble({ label, text }) {
  return (
    <div className="ai-bubble">
      <div className="ai-label">{label}</div>
      <div className="ai-text">{text}</div>
    </div>
  )
}

// ── EmptyState ────────────────────────────────
export function EmptyState({ message = 'Sin datos', sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
      <div style={{ fontSize: '13px', marginBottom: '4px' }}>{message}</div>
      {sub && <div style={{ fontSize: '11px' }}>{sub}</div>}
    </div>
  )
}

// ── ThemeInitializer ─────────────────────────
// Ponlo una vez en el root de tu app (App.jsx o main.jsx):
//   <ThemeInitializer />
// Se encarga de aplicar data-theme al arrancar.
export function ThemeInitializer() {
  useEffect(() => {
    const saved = localStorage.getItem('agente-metricas-theme') || 'dark'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])
  return null
}

// ── InsightCard (Coach IA) ────────────────────
// Tarjeta fija de 2-3 recomendaciones accionables, generadas a
// partir de datos reales (ver analyzeTradeData en IaMentor).
// items: [{ text: string | ReactNode }]
export function InsightCard({ title = 'Coach IA', items = [], ctaLabel, onCta }) {
  return (
    <div className="insight-card">
      <div className="insight-card-header">
        <span>{title}</span>
      </div>
      {items.map((item, i) => (
        <div className="insight-item" key={i}>{item.text ?? item}</div>
      ))}
      {ctaLabel && (
        <button type="button" className="btn btn-primary insight-cta" onClick={onCta}>{ctaLabel} →</button>
      )}
    </div>
  )
}

// ── QuickLinkCard ─────────────────────────────
// Acceso rápido compacto (fila inferior del Dashboard). Si `feature`
// no está desbloqueada para el tier actual, se muestra atenuado con
// candado en vez de navegar.
export function QuickLinkCard({ label, value, icon, feature, onClick }) {
  const unlocked = useHasFeature(feature)
  return (
    <div
      className={clsx('quick-link', !unlocked && 'is-locked')}
      onClick={unlocked ? onClick : undefined}
    >
      <div>
        <div className="quick-link-label">{label}</div>
        <div className="quick-link-value">{unlocked ? value : `Función ${TIER_LABELS[requiredTierFor(feature)]}`}</div>
      </div>
      {unlocked ? (
        <IconCircle icon={icon} color="primary" size={28} />
      ) : (
        <Lock aria-hidden="true" size={16} style={{ color: 'var(--amber)' }} />
      )}
    </div>
  )
}

// ── LockedFeature ─────────────────────────────
// Envuelve una sección entera de una página. Si el tier actual no
// incluye `feature`, difumina el contenido y superpone un CTA de
// upgrade — la sección sigue "presente" (no desaparece del layout).
export function LockedFeature({ feature, children, onUpgrade }) {
  const unlocked = useHasFeature(feature)
  if (unlocked) return children

  const tierNeeded = TIER_LABELS[requiredTierFor(feature)]
  return (
    <div className="locked-feature">
      <div className="locked-feature-content" aria-hidden="true">{children}</div>
      <div className="locked-feature-overlay">
        <span className="locked-feature-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lock size={13} /> Función {tierNeeded}</span>
        <div className="locked-feature-cta" onClick={onUpgrade}>Mejorar plan →</div>
      </div>
    </div>
  )
}

// ── ThemeToggle ───────────────────────────────
// Ponlo donde quieras en tu UI (sidebar, header, etc):
//   <ThemeToggle />
export function ThemeToggle() {
  // Lee tema directamente de localStorage para no necesitar el store aquí
  const current = document.documentElement.getAttribute('data-theme') || 'dark'
  const [theme, setTheme] = React.useState(current)

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('agente-metricas-theme', next)
    setTheme(next)
    // Sincroniza con el store si está disponible
    try {
      const { useStore } = require('@/store/useStore')
      useStore.getState().setTheme(next)
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{
        background: 'none',
        border: '1px solid var(--border2)',
        borderRadius: 8,
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--text2)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border3)'
        e.currentTarget.style.color = 'var(--text)'
        e.currentTarget.style.background = 'var(--bg3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border2)'
        e.currentTarget.style.color = 'var(--text2)'
        e.currentTarget.style.background = 'none'
      }}
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      <span style={{ fontSize: 11, fontFamily: 'var(--font)' }}>
        {theme === 'dark' ? 'Claro' : 'Oscuro'}
      </span>
    </button>
  )
}

// ── TraderAvatar ───────────────────────────────
// Elemento identificativo de Atlas (Sprint 16). Silueta/busto minimalista
// y profesional (NO un personaje ni icono infantil) cuyo color cambia
// según el estado del trader. Totalmente reutilizable: hoy se alimenta
// de datos mock; en el futuro el `status` se calculará automáticamente
// a partir de Trader Score, Disciplina, Riesgo, Consistencia y
// cumplimiento del Blueprint — sin cambiar este componente.
export const TRADER_AVATAR_STATES = {
  elite:        { label: 'Trader Elite',            color: '#22c55e' },
  disciplined:  { label: 'Trader Disciplinado',      color: 'var(--pos)' },
  consistent:   { label: 'Trader Consistente',       color: 'var(--amber)' },
  observation:  { label: 'Trader en Observación',    color: 'var(--amber)' },
  offPlan:      { label: 'Trader Fuera del Plan',    color: 'var(--neg)' },
}

export function TraderAvatar({ status = 'consistent', size = 72, showLabel = true }) {
  const state = TRADER_AVATAR_STATES[status] || TRADER_AVATAR_STATES.consistent

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        role="img" aria-label={state.label}
        className="trader-avatar-circle"
        style={{
          width: size, height: size, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <User size={size * 0.5} color="var(--brand)" strokeWidth={1.8} />
      </div>
      {showLabel && (
        <span style={{ fontSize: 12, fontWeight: 600, color: state.color, textAlign: 'center' }}>
          {state.label}
        </span>
      )}
    </div>
  )
}
// ── BlueprintMatchResults ───────────────────────
// Resultado del Blueprint Match Engine (compatibilidad, prioridades,
// fortalezas y comparación métrica a métrica). Reutilizado desde
// Portfolio (panel "Ver comparación") y desde Blueprints (pestaña
// "Cuentas con este Blueprint"), para no duplicar esta vista.
// layout (opcional): 'wide' reparte en 2 columnas — Prioridades + Fortalezas
// | Métrica a métrica (fila expandible de la vista Tabla en Portafolio).
// Sin layout queda vertical, igual que siempre (modal, Mapas, StyleGuide).
// metricsTitle / metricsAction / leftFooter (opcionales, solo 'wide'):
// reemplazan el título de la tabla de métricas, agregan una acción a la
// derecha de ese título y algo al pie de la columna izquierda.
export function BlueprintMatchResults({ compatibility, strengths, priorities, metrics, layout, metricsTitle, metricsAction, leftFooter }) {
  // Línea junto a los títulos de sección: en 'wide' un tono más visible
  // (--border3, mismo que el borde de los recuadros y las filas).
  const dividerColor = layout === 'wide' ? 'var(--border3)' : 'var(--border)'
  const compatLine = (
      <div style={{ fontSize: 13, color: 'var(--text)', margin: layout === 'wide' ? '0 0 14px' : '2px 0 18px' }}>
        Compatibilidad {compatibility}% <span style={{ color: 'var(--text3)' }}>· solo indica cercanía con este Mapa, no el nivel del trader</span>
      </div>
  )
  const prioritiesBlock = (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neg)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            Prioridades de mejora
          </span>
          <div style={{ flex: 1, height: 1, background: dividerColor }} />
        </div>
        {priorities.list.length === 0 ? (
          <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: 0 }}>Sin prioridades detectadas: la cuenta ya está alineada con el Mapa.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--text)', lineHeight: 2 }}>
            {priorities.list.map(p => layout === 'wide' ? (
              // En 'wide': actual → objetivo del Mapa al lado, para ver la
              // brecha sin buscar la fila en la tabla de métricas.
              <li key={p.key}>
                <span style={{ display: 'inline-flex', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                  <span>{p.label}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13, whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 700, color: MATCH_STATUS_META[p.status]?.color ?? 'var(--neg)' }}>{p.current}{p.unit}</span>
                    <span style={{ color: 'var(--text3)' }}> → {p.target}{p.unit}</span>
                  </span>
                </span>
              </li>
            ) : <li key={p.key}>{p.label}</li>)}
          </ol>
        )}
      </div>

  )
  const strengthsBlock = (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pos)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            Fortalezas
          </span>
          <div style={{ flex: 1, height: 1, background: dividerColor }} />
        </div>
        {strengths.length === 0 ? (
          <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: 0 }}>Todavía ninguna métrica coincide con el Mapa.</p>
        ) : (
          // Lista, mismo formato que "Prioridades de mejora" (antes: badges).
          // <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          //   {strengths.map(s => <Badge key={s} variant="pos">{s}</Badge>)}
          // </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--text)', lineHeight: 2 }}>
            {strengths.map(s => <li key={s}>{s}</li>)}
          </ul>
        )}
      </div>

  )
  const metricsBlock = (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            {layout === 'wide' && metricsTitle ? metricsTitle : 'Comparación métrica a métrica'}
          </span>
          <div style={{ flex: 1, height: 1, background: dividerColor }} />
          {layout === 'wide' && metricsAction}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1.3fr 0.8fr 0.8fr 1fr', gap: 8,
          fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', padding: '0 10px 8px',
        }}>
          <span>Métrica</span>
          <span style={{ borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>Mapa</span>
          <span style={{ borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>Actual</span>
          <span style={{ borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>Estado</span>
        </div>
        {/* En 'wide': filas sin caja, separadas por línea (como la tabla
            principal del Portafolio) y un poco más bajas. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: layout === 'wide' ? 0 : 6 }}>
          {metrics.map(m => (
            <div key={m.key} style={{
              display: 'grid', gridTemplateColumns: '1.3fr 0.8fr 0.8fr 1fr', gap: 8, alignItems: 'center',
              ...(layout === 'wide'
                ? { padding: '7px 10px', borderBottom: '1px solid var(--border3)' }
                : { padding: '8px 10px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border2)' }),
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{m.label}</span>
              <span style={{ fontSize: 13, color: 'var(--text3)', borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
                {m.target || m.target === 0 ? `${m.target}${m.unit}` : '—'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>{m.current}{m.unit}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: MATCH_STATUS_META[m.status].color, flexShrink: 0 }} />
                {MATCH_STATUS_META[m.status].label}
              </span>
            </div>
          ))}
        </div>
      </div>
  )

  if (layout === 'wide') {
    const wideBox = { border: '1px solid var(--border3)', borderRadius: 'var(--r)', padding: '16px 18px', background: 'var(--bg3)' }
    return (
      <div>
        {/* Sin compatLine: en 'wide' la compatibilidad va en el encabezado
            de la fila expandible (Portfolio.jsx), con la aclaración en tooltip. */}
        {/* 2 columnas: Prioridades + Fortalezas apiladas (35%) | Métricas (65%),
            cada una en un recuadro con borde y esquinas redondeadas. */}
        <div style={{ display: 'grid', gridTemplateColumns: '35fr 65fr', gap: 16, alignItems: 'stretch' }}>
          <div style={wideBox}>
            {prioritiesBlock}
            {strengthsBlock}
            {leftFooter}
          </div>
          <div style={wideBox}>
            {metricsBlock}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {compatLine}
      {prioritiesBlock}
      {strengthsBlock}
      {metricsBlock}
    </div>
  )
}

/**
 * RRDistributionPanel — exclusivo de la plantilla Híbrido de Expansión
 * (config/hibridoExpansionEngine.js). Compartido entre Blueprints.jsx
 * y Portfolio.jsx para no duplicarlo. Muestra las 2 preguntas por
 * separado, como exige el PDF del Modelo 3: FRECUENCIA (% de trades
 * en cada rango) y CONTRIBUCIÓN AL P&L (de dónde viene el dinero).
 */
export function RRDistributionPanel({ distribution, speed }) {
  const statusColor = (real, benchmark) => {
    const distance = benchmark > 0 ? Math.abs(real - benchmark) / benchmark : 0
    return distance <= 0.15 ? 'var(--pos)' : distance <= 0.35 ? 'var(--amber)' : 'var(--neg)'
  }

  return (
    <div style={{ marginTop: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 10 }}>
        Distribución de RR (1R = ${distribution.rNominal} · {distribution.total} trades)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {distribution.buckets.map(b => (
          <div key={b.key} style={{
            padding: '10px 14px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{b.label}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>
                <span style={{ color: statusColor(b.pct, b.benchmarkPct), fontWeight: 700 }}>{b.pct}%</span>
                <span style={{ color: 'var(--text3)' }}> / benchmark {b.benchmarkPct}%</span>
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
              {b.count} trades · aporta ${b.dollarContribution.toLocaleString()} ({b.dollarContributionPct}% del P&L total)
            </div>
          </div>
        ))}

        {distribution.expansionAPlus && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, background: 'var(--brand2)', border: '1px solid rgba(59,130,246,0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Expansión A+ (subgrupo, ≥{distribution.expansionAPlus.min}R)</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--pos)' }}>{distribution.expansionAPlus.pct}%</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
              Objetivo: {distribution.expansionAPlus.benchmarkPctMin}-{distribution.expansionAPlus.benchmarkPctMax}% del total · {distribution.expansionAPlus.count} trades · ${distribution.expansionAPlus.dollarContribution.toLocaleString()} aportados
            </div>
          </div>
        )}
      </div>

      {speed && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {speed.capitalizationMin && (
            <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Trades hasta +${speed.capitalizationMin.toLocaleString()}</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: speed.reachedMin ? 'var(--pos)' : 'var(--text3)' }}>
                {speed.reachedMin ? speed.tradesToMin : 'Aún no'}
              </div>
            </div>
          )}
          {speed.capitalizationOptimal && (
            <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Trades hasta +${speed.capitalizationOptimal.toLocaleString()}</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: speed.reachedOptimal ? 'var(--pos)' : 'var(--text3)' }}>
                {speed.reachedOptimal ? speed.tradesToOptimal : 'Aún no'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}