import { useState } from 'react'
import { Card, TraderAvatar } from '@/components/ui'

// ─────────────────────────────────────────────
//  ESTADO DEL TRADER — Sprint 16
//
//  Sustituye las métricas eliminadas del Dashboard (Portfolio·Cuentas,
//  Resultados por sesión, Distribución R:R, Heatmap, Rendimiento por
//  Setup — todas ya disponibles en Metrix/Portfolio). Aquí Atlas no
//  analiza datos: comunica al trader cómo está y qué debe hacer hoy.
//
//  IMPORTANTE: todos los datos de esta sección son MOCK. No hay
//  cálculo real, no hay IA, no hay conexión a backend. Está
//  preparada para que, en el futuro, el estado se calcule con
//  Trader Score, Disciplina, Riesgo, Consistencia y cumplimiento
//  del Blueprint.
// ─────────────────────────────────────────────

// ── Mock data ──────────────────────────────────
const MOCK_WEEKLY_STATUS = {
  level: 'stable', // 'excellent' | 'stable' | 'attention'
  label: 'Semana estable',
}

const MOCK_WEEK_DAYS = [
  { day: 'L', date: '2026-07-06', status: 'green',  result: '+1.8R', trades: 3, setup: 'Breakout NY', comment: 'Buena ejecución, respetando el plan.' },
  { day: 'M', date: '2026-07-07', status: 'green',  result: '+0.6R', trades: 2, setup: 'ICT FVG',      comment: 'Día tranquilo, sin sobreoperar.' },
  { day: 'X', date: '2026-07-08', status: 'amber',  result: '-0.4R', trades: 4, setup: 'Reversión',    comment: 'Una entrada fuera de setup.' },
  { day: 'J', date: '2026-07-09', status: 'red',    result: '-1.2R', trades: 5, setup: 'Scalping',     comment: 'Sobreoperación tras la primera pérdida.' },
  { day: 'V', date: '2026-07-10', status: 'empty',  result: '—',     trades: 0, setup: '—',            comment: 'Todavía sin operar.' },
]

const MOCK_WEEKLY_GOAL = {
  targetR: 5,
  currentR: 3.2,
}

const MOCK_TRADER_STATE = 'consistent' // clave de TRADER_AVATAR_STATES

// ── Estilos de estado (semáforo) ───────────────
const STATUS_STYLES = {
  excellent: { color: 'var(--pos)', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
  stable:    { color: 'var(--amber)',  bg: 'var(--amber2)', border: 'rgba(246,213,92,0.25)' },
  attention: { color: 'var(--neg)',    bg: 'rgba(227,114,114,0.08)', border: 'rgba(227,114,114,0.25)' },
}

const DAY_DOT = {
  green: 'var(--pos)',
  amber: 'var(--amber)',
  red:   'var(--neg)',
  empty: 'var(--text3)',
}

/**
 * WeeklyStatusBanner — Indicador visual tipo semáforo del estado semanal
 */
function WeeklyStatusBanner() {
  const s = STATUS_STYLES[MOCK_WEEKLY_STATUS.level]
  return (
    <Card title="Estado semanal">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{MOCK_WEEKLY_STATUS.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Estado semanal · valor de ejemplo</div>
        </div>
      </div>
    </Card>
  )
}

/**
 * WeeklyCalendar — Calendario de la semana actual (no mensual).
 * Cada día es seleccionable y muestra un resumen (mock) debajo.
 */
function WeeklyCalendar() {
  const [selected, setSelected] = useState(null)
  const activeDay = MOCK_WEEK_DAYS.find(d => d.day === selected)

  return (
    <Card title="Calendario semanal">
      <div style={{ display: 'flex', gap: 4, marginBottom: activeDay ? 16 : 0 }}>
        {MOCK_WEEK_DAYS.map(d => {
          const isSelected = selected === d.day
          return (
            <button
              key={d.day}
              onClick={() => setSelected(isSelected ? null : d.day)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '6px 2px', borderRadius: 6, cursor: 'pointer',
                background: isSelected ? 'var(--bg3)' : 'transparent',
                border: `1px solid ${isSelected ? 'var(--brand-deep)' : 'var(--border2)'}`,
                fontFamily: 'var(--font)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{d.day}</span>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: d.status === 'empty' ? 'transparent' : DAY_DOT[d.status],
                border: d.status === 'empty' ? `1.5px solid ${DAY_DOT.empty}` : 'none',
              }} />
            </button>
          )
        })}
      </div>

      {activeDay && (
        <div style={{
          padding: 14, borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border2)',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 3 }}>Fecha</div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{activeDay.date}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 3 }}>Resultado</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: activeDay.result.startsWith('+') ? 'var(--pos)' : activeDay.result.startsWith('-') ? 'var(--neg)' : 'var(--text2)' }}>
              {activeDay.result}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 3 }}>Operaciones</div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{activeDay.trades}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 3 }}>Setup principal</div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{activeDay.setup}</div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 3 }}>Comentario</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{activeDay.comment}</div>
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * WeeklyGoalCard — Progreso del objetivo semanal (mock, sin cálculo real)
 */
function WeeklyGoalCard() {
  const pct = Math.min(100, Math.round((MOCK_WEEKLY_GOAL.currentR / MOCK_WEEKLY_GOAL.targetR) * 100))
  return (
    <Card title="Objetivo semanal">
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
        {MOCK_WEEKLY_GOAL.targetR}R
      </div>
      <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 4,
          background: 'linear-gradient(90deg, var(--brand-deep), var(--brand))',
        }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>
        {MOCK_WEEKLY_GOAL.currentR}R completados
        <span style={{ color: 'var(--text3)' }}> · {pct}%</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 8 }}>
        Valor de ejemplo — preparado para conexión futura.
      </div>
    </Card>
  )
}

/**
 * TraderStateCard — Estado general del trader, con el Avatar del Trader
 */
function TraderStateCard() {
  return (
    <Card title="Estado del Trader">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <TraderAvatar status={MOCK_TRADER_STATE} size={40} showLabel={false} />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          Trader Consistente
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
        Valor de ejemplo — en el futuro se calculará con Trader Score,
        disciplina, riesgo, consistencia y cumplimiento del Mapa.
      </div>
    </Card>
  )
}

/**
 * DashboardTraderStatus — Sección completa "Estado del Trader"
 */
export default function DashboardTraderStatus() {
  return (
    <div className="section-gap" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <WeeklyStatusBanner />
      <WeeklyCalendar />
      <WeeklyGoalCard />
      {/* <TraderStateCard /> */}
    </div>
  )
}
