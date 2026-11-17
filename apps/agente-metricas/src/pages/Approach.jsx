import { useState, useMemo } from 'react'
import { CheckCircle2, XCircle, BarChart3, AlertTriangle, TrendingUp, Target, Calendar as CalendarIcon } from 'lucide-react'
import { Card, PageHeader, CheckItem, ProgressBar } from '@/components/ui'
import { useStore, useRitualDate, useRitualForToday } from '@/store/useStore'
import { PRE_TRADE_ITEMS } from '@/data/mockData'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         startOfWeek, endOfWeek, isSameMonth, isToday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const ENERGIES = ['Muy bajo', 'Bajo', 'Normal', 'Alto', 'Excelente']
const EMOTIONS = ['Ansioso', 'Estresado', 'Neutral', 'Enfocado', 'En zona']
const TOTAL    = PRE_TRADE_ITEMS.length

// ── Score → color/label ───────────────────────
function mindsetColor(pct) {
  if (pct === undefined || pct === null) return { bg: 'var(--bg4)',    border: 'var(--border)',  text: 'var(--text3)', label: '—'       }
  if (pct >= 80)                         return { bg: 'var(--brand2)', border: 'var(--pos)',   text: 'var(--pos)', label: 'Completo' }
  if (pct >= 50)                         return { bg: 'var(--amber2)', border: 'var(--amber)',   text: 'var(--amber)', label: 'Parcial'  }
  return                                        { bg: 'var(--red2)',   border: 'var(--red)',     text: 'var(--red)',   label: 'Bajo'     }
}

// ─────────────────────────────────────────────
//  TAB: CHECKLIST (original intacto)
// ─────────────────────────────────────────────
function TabChecklist() {
  const date       = useRitualDate()
  const ritual     = useRitualForToday()
  const toggleItem = useStore((s) => s.toggleRitualItem)
  const setField   = useStore((s) => s.setRitualField)
  const setDate    = useStore((s) => s.setRitualDate)

  const checkedCount = ritual.checkedIds.length
  const pct          = Math.round((checkedCount / TOTAL) * 100)
  const mc           = mindsetColor(pct)

  return (
    <div>
      {/* Date selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 11, color: 'var(--text2)' }}>Fecha:</span>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setDate(new Date().toISOString().split('T')[0])}
        >Hoy</button>
        <div style={{
          marginLeft: 'auto',
          background: mc.bg, color: mc.text,
          padding: '4px 12px', borderRadius: 20,
          fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600,
          border: `1px solid ${mc.border}40`,
        }}>
          {checkedCount} / {TOTAL} · {pct}%
        </div>
      </div>

      <div className="grid-2">
        {/* Checklist */}
        <Card title="Pre-Trade Checklist">
          {PRE_TRADE_ITEMS.map((item) => (
            <CheckItem
              key={item.id}
              text={item.text}
              checked={ritual.checkedIds.includes(item.id)}
              onToggle={() => toggleItem(date, item.id)}
            />
          ))}
          <div className="divider" />
          <div className="flex-between">
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Preparación general</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: mc.text }}>{pct}%</span>
          </div>
          <ProgressBar value={pct} />
        </Card>

        {/* Estado Mental */}
        <Card title="Estado Mental">
          <div className="form-group">
            <label>Nivel de energía</label>
            <div className="flex-center" style={{ flexWrap: 'wrap', gap: 6 }}>
              {ENERGIES.map((e) => (
                <button key={e} onClick={() => setField(date, 'energy', e)} style={{
                  padding: '7px 14px', borderRadius: 20,
                  border: `1px solid ${ritual.energy === e ? 'var(--brand)' : 'var(--border2)'}`,
                  background: ritual.energy === e ? 'var(--brand2)' : 'transparent',
                  color: ritual.energy === e ? 'var(--brand)' : 'var(--text2)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.15s',
                }}>{e}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Estado emocional</label>
            <div className="flex-center" style={{ flexWrap: 'wrap', gap: 6 }}>
              {EMOTIONS.map((e) => (
                <button key={e} onClick={() => setField(date, 'emotion', e)} style={{
                  padding: '7px 14px', borderRadius: 20,
                  border: `1px solid ${ritual.emotion === e ? 'var(--brand)' : 'var(--border2)'}`,
                  background: ritual.emotion === e ? 'var(--brand2)' : 'transparent',
                  color: ritual.emotion === e ? 'var(--brand)' : 'var(--text2)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.15s',
                }}>{e}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Nota del día</label>
            <textarea
              rows={4}
              placeholder="¿Cómo te sientes hoy? ¿Hay algo que te distraiga?..."
              value={ritual.note}
              onChange={(e) => setField(date, 'note', e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>

          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 8 }}>Resumen del estado</div>
            <div className="flex-center">
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>Energía:</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{ritual.energy}</span>
              <span style={{ color: 'var(--border2)' }}>·</span>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>Emoción:</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{ritual.emotion}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  TAB: CALENDARIO
// ─────────────────────────────────────────────
function TabCalendar({ ritualByDate, tradesByDate }) {
  const setDate   = useStore((s) => s.setRitualDate)
  const [month, setMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const prevMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const nextMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))

  const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return (
    <Card title={format(month, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())}>
      {/* Nav mes */}
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹ Anterior</button>
        <button className="btn btn-ghost btn-sm"
          onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
          Hoy
        </button>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth}>Siguiente ›</button>
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { color: 'var(--pos)', label: 'Mindset ≥80%' },
          { color: 'var(--amber)', label: 'Mindset 50–79%' },
          { color: 'var(--red)',   label: 'Mindset <50%'  },
          { color: 'var(--bg4)',   label: 'Sin datos'     },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color, opacity: 0.7 }} />
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Grid días de semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
        {DOW.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700,
            color: 'var(--text3)', letterSpacing: '0.5px', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Grid días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {days.map(day => {
          const key      = format(day, 'yyyy-MM-dd')
          const ritual   = ritualByDate[key]
          const dayTrades = tradesByDate[key] || []
          const inMonth  = isSameMonth(day, month)
          const todayDay = isToday(day)

          const checkedCount = ritual?.checkedIds?.length ?? null
          const pct = checkedCount !== null ? Math.round((checkedCount / TOTAL) * 100) : null
          const mc  = mindsetColor(pct)

          const dayR    = dayTrades.reduce((s, t) => s + t.rPnl, 0)
          const hasTrades = dayTrades.length > 0
          const isWinner  = dayR > 0
          const isLoser   = dayR < 0

          return (
            <div
              key={key}
              onClick={() => { if (inMonth) setDate(key) }}
              style={{
                minHeight: 52,
                borderRadius: 8,
                padding: '5px 6px',
                cursor: inMonth ? 'pointer' : 'default',
                opacity: inMonth ? 1 : 0.25,
                background: pct !== null && inMonth ? mc.bg : 'var(--bg3)',
                border: todayDay
                  ? '2px solid var(--brand)'
                  : `1px solid ${pct !== null && inMonth ? mc.border + '50' : 'var(--border)'}`,
                transition: 'opacity 0.1s',
                position: 'relative',
              }}
            >
              {/* Número día */}
              <div style={{
                fontSize: 11, fontWeight: todayDay ? 700 : 400,
                color: todayDay ? 'var(--brand)' : inMonth ? 'var(--text)' : 'var(--text3)',
                marginBottom: 3,
              }}>{format(day, 'd')}</div>

              {/* Mindset score */}
              {pct !== null && inMonth && (
                <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: mc.text, fontWeight: 600 }}>
                  {pct}%
                </div>
              )}

              {/* Trades indicator */}
              {hasTrades && inMonth && (
                <div style={{
                  position: 'absolute', bottom: 4, right: 5,
                  fontSize: 8, fontFamily: 'var(--mono)', fontWeight: 700,
                  color: isWinner ? 'var(--pos)' : isLoser ? 'var(--red)' : 'var(--text3)',
                }}>
                  {isWinner ? '+' : isLoser ? '−' : '·'}{Math.abs(dayR).toFixed(1)}R
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Info pie */}
      <div style={{ marginTop: 14, fontSize: 10, color: 'var(--text3)', textAlign: 'center' }}>
        Haz clic en un día para ir al checklist de esa fecha
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────
//  TAB: ESTADÍSTICAS
// ─────────────────────────────────────────────
function TabStats({ ritualByDate, trades }) {
  const stats = useMemo(() => {
    const tradeDays = {}
    trades.forEach(t => {
      if (!tradeDays[t.date]) tradeDays[t.date] = []
      tradeDays[t.date].push(t)
    })

    let withMindset    = { trades: 0, wins: 0, totalR: 0, days: 0 }
    let withoutMindset = { trades: 0, wins: 0, totalR: 0, days: 0 }
    let mindsetDaysOk  = 0
    let totalDaysWithData = 0

    const allDates = new Set([
      ...Object.keys(ritualByDate),
      ...Object.keys(tradeDays),
    ])

    allDates.forEach(date => {
      const ritual      = ritualByDate[date]
      const dayTrades   = tradeDays[date] || []
      const checkedCount = ritual?.checkedIds?.length ?? 0
      const pct         = ritual ? Math.round((checkedCount / TOTAL) * 100) : 0
      const hasMindset  = pct >= 80

      if (ritual) {
        totalDaysWithData++
        if (hasMindset) mindsetDaysOk++
      }

      if (dayTrades.length === 0) return

      const bucket = hasMindset ? withMindset : withoutMindset
      bucket.days++
      dayTrades.forEach(t => {
        bucket.trades++
        bucket.totalR += t.rPnl
        if (t.result === 'win') bucket.wins++
      })
    })

    const wr  = (b) => b.trades ? ((b.wins / b.trades) * 100).toFixed(1) : '—'
    const avg = (b) => b.trades ? (b.totalR / b.trades).toFixed(2) : '—'
    const pctDays = totalDaysWithData
      ? Math.round((mindsetDaysOk / totalDaysWithData) * 100)
      : 0

    return { withMindset, withoutMindset, wr, avg, pctDays, totalDaysWithData, mindsetDaysOk }
  }, [ritualByDate, trades])

  const { withMindset, withoutMindset, wr, avg, pctDays, totalDaysWithData, mindsetDaysOk } = stats

  const CompareRow = ({ label, withVal, withoutVal, higherIsBetter = true }) => {
    const wN  = parseFloat(withVal)
    const woN = parseFloat(withoutVal)
    const wBetter  = !isNaN(wN) && !isNaN(woN) && (higherIsBetter ? wN > woN : wN < woN)
    const woBetter = !isNaN(wN) && !isNaN(woN) && (higherIsBetter ? woN > wN : woN < wN)
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text2)' }}>{label}</span>
        <div style={{ textAlign: 'center' }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700,
            color: wBetter ? 'var(--pos)' : 'var(--text)',
          }}>{withVal === '—' ? '—' : withVal}</span>
          {wBetter && <span style={{ fontSize: 9, color: 'var(--pos)', marginLeft: 4 }}>▲</span>}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700,
            color: woBetter ? 'var(--pos)' : 'var(--text)',
          }}>{withoutVal === '—' ? '—' : withoutVal}</span>
          {woBetter && <span style={{ fontSize: 9, color: 'var(--pos)', marginLeft: 4 }}>▲</span>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Resumen mindset */}
      <Card title="Adherencia al Mindset">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { label: 'Días con datos', value: totalDaysWithData, color: 'var(--text)' },
            { label: 'Días mindset ≥80%', value: mindsetDaysOk, color: 'var(--pos)' },
            { label: '% días OK', value: `${pctDays}%`, color: pctDays >= 70 ? 'var(--pos)' : pctDays >= 50 ? 'var(--amber)' : 'var(--red)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.7px' }}>{label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <ProgressBar value={pctDays} />
        </div>
      </Card>

      {/* Tabla comparativa */}
      <Card title="Mindset vs Rendimiento">
        {/* Cabecera */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8, marginBottom: 4,
        }}>
          <div />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--pos)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            <CheckCircle2 size={11} /> Con mindset
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            <XCircle size={11} /> Sin mindset
          </div>
        </div>

        <CompareRow label="Win Rate"      withVal={wr(withMindset)  + '%'} withoutVal={wr(withoutMindset)  + '%'} />
        <CompareRow label="Avg R/trade"   withVal={avg(withMindset) + 'R'} withoutVal={avg(withoutMindset) + 'R'} />
        <CompareRow label="Total trades"  withVal={String(withMindset.trades)}  withoutVal={String(withoutMindset.trades)}  higherIsBetter={false} />
        <CompareRow label="Total R"       withVal={withMindset.totalR.toFixed(2)  + 'R'} withoutVal={withoutMindset.totalR.toFixed(2)  + 'R'} />
        <CompareRow label="Días operados" withVal={String(withMindset.days)} withoutVal={String(withoutMindset.days)} higherIsBetter={false} />

        {withMindset.trades === 0 && withoutMindset.trades === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 12 }}>
            Registra trades y completa el checklist para ver estadísticas comparativas.
          </div>
        )}
      </Card>

      {/* Insight automático */}
      {(withMindset.trades > 0 || withoutMindset.trades > 0) && (() => {
        const wrWith    = withMindset.trades    ? withMindset.wins    / withMindset.trades    : null
        const wrWithout = withoutMindset.trades ? withoutMindset.wins / withoutMindset.trades : null
        const diff      = wrWith !== null && wrWithout !== null ? ((wrWith - wrWithout) * 100).toFixed(1) : null
        const avgWith   = withMindset.trades    ? withMindset.totalR    / withMindset.trades    : null
        const avgWo     = withoutMindset.trades ? withoutMindset.totalR / withoutMindset.trades : null

        return (
          <div className="ai-bubble">
            <div className="ai-label" style={{ display: "flex", alignItems: "center", gap: 6 }}><BarChart3 size={13} /> Insight automático</div>
            <div className="ai-text" style={{ fontSize: 12, lineHeight: 1.7 }}>
              {diff !== null && parseFloat(diff) > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}><CheckCircle2 size={13} style={{ flexShrink: 0, marginTop: 2 }} /><span>Con mindset completo tu win rate es <strong style={{ color: 'var(--pos)' }}>{diff}pp mayor</strong> que sin él.</span></div>
              )}
              {diff !== null && parseFloat(diff) < 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} /><span>Con mindset completo tu win rate es <strong style={{ color: 'var(--red)' }}>{Math.abs(parseFloat(diff))}pp menor</strong> — revisa si el checklist refleja tus condiciones reales.</span></div>
              )}
              {avgWith !== null && avgWo !== null && parseFloat(avgWith) > parseFloat(avgWo) && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}><TrendingUp size={13} style={{ flexShrink: 0, marginTop: 2 }} /><span>Tu R promedio por trade es <strong style={{ color: 'var(--pos)' }}>{(avgWith - avgWo).toFixed(2)}R mayor</strong> cuando completas el mindset.</span></div>
              )}
              {pctDays < 50 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}><Target size={13} style={{ flexShrink: 0, marginTop: 2 }} /><span>Solo completas el mindset el <strong style={{ color: 'var(--amber)' }}>{pctDays}%</strong> de los días — intenta mejorar la consistencia.</span></div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─────────────────────────────────────────────
//  MAIN EXPORT
// ─────────────────────────────────────────────
export default function Approach() {
  const [tab, setTab] = useState('checklist')

  const ritualByDate = useStore((s) => s.ritualByDate)
  const trades       = useStore((s) => s.trades)

  const tradesByDate = useMemo(() => {
    const map = {}
    trades.forEach(t => {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(t)
    })
    return map
  }, [trades])

  // Score del día actual para el header
  const date         = useStore((s) => s.ritualDate)
  const todayRitual  = ritualByDate[date]
  const pct          = todayRitual
    ? Math.round((todayRitual.checkedIds.length / TOTAL) * 100)
    : 0
  const mc           = mindsetColor(todayRitual ? pct : null)

  return (
    <div className="page-inner">
      <PageHeader title="Approach & Mindset" subtitle="Pre-trade checklist · Estado mental · Estadísticas">
        <div style={{
          background: mc.bg, color: mc.text,
          padding: '4px 12px', borderRadius: 20,
          fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600,
          border: `1px solid ${mc.border}40`,
        }}>
          {todayRitual ? `${todayRitual.checkedIds.length} / ${TOTAL} · ${pct}%` : 'Sin datos hoy'}
        </div>
      </PageHeader>

      {/* TABS */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {[
          { key: 'checklist',    icon: CheckCircle2,  label: 'Checklist'    },
          { key: 'calendario',   icon: CalendarIcon,  label: 'Calendario'   },
          { key: 'estadisticas', icon: BarChart3,     label: 'Estadísticas' },
        ].map(({ key, icon: TabIcon, label }) => (
          <div
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          ><TabIcon size={13} /> {label}</div>
        ))}
      </div>

      {tab === 'checklist'    && <TabChecklist />}
      {tab === 'calendario'   && <TabCalendar ritualByDate={ritualByDate} tradesByDate={tradesByDate} />}
      {tab === 'estadisticas' && <TabStats    ritualByDate={ritualByDate} trades={trades} />}
    </div>
  )
}
