import { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, PageHeader, DirectionBadge } from '@/components/ui'
import { useTrades, useAccounts } from '@/store/useStore'
import { useEconomicCalendar } from '@/hooks/useEconomicCalendar'
import EconomicEventCard from '@/components/calendar/EconomicEventCard'
import { filterTradesByAccountScope, accountLabel } from './dashboard/dashboardHelpers'
import { useAccountGroupFilter, GroupFilterSelects } from '@/components/accounts/GroupFilters'
import { MetricsFiltersButton, ActiveFilterTags } from '@/components/accounts/MetricsFilters'
import { tradeDollar, sumTradeDollars } from '@/lib/tradeDollar'

const CALENDAR_ACCOUNT_TYPES = ['Challenge', 'Funded', 'Personal']

// Fila de filtros anterior (Tipo, Cuenta, Ciclo y Mapa a la vista).
// Rediseño 01/11/2026, igual que Métricas: Cuenta a la vista y el resto
// en "Filtros" (MetricsFilters), que suma Mercado. En true vuelve la
// fila anterior.
const CALENDAR_FILTERS_V1 = false

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]
const DAYS_LABEL = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year, month) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

// Cabecera colapsable de eventos — el mismo punto ámbar del grid,
// ahora como toggle: las tarjetas solo se ven si se hace clic aquí,
// nunca se muestran ya abiertas por defecto.
function EventsToggle({ count, expanded, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
        padding: '8px 12px', marginBottom: expanded ? 8 : 14, cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', flex: 1 }}>
        {count} evento{count === 1 ? '' : 's'} económico{count === 1 ? '' : 's'} ese día
      </span>
      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{expanded ? '▾' : '▸'}</span>
    </button>
  )
}

export default function Calendar() {
  const location = useLocation()
  const allTrades = useTrades()
  const accounts  = useAccounts()
  // Ciclo de compra y estrategia (como en Portafolio)
  const group = useAccountGroupFilter(allTrades, accounts)

  // Si se llega desde Metrix Básico/Portfolio con una cuenta puntual,
  // arranca ya filtrado a esa cuenta en vez de ver todo el portafolio.
  // Mismos filtros que Metrix Básico (Tipo de cuenta + Cuenta) — el
  // Periodo queda afuera porque el Calendar ya navega mes a mes.
  const [accountType, setAccountType] = useState('all')
  const [accountMarket, setAccountMarket] = useState('all')
  const [selectedAccountId, setSelectedAccountId] = useState(location.state?.accountId ?? 'all')
  const trades = useMemo(
    () => filterTradesByAccountScope(group.groupTrades, group.groupAccounts, { accountType, accountMarket, accountId: selectedAccountId }),
    [group.groupTrades, group.groupAccounts, accountType, accountMarket, selectedAccountId]
  )
  // Props compartidas del botón "Filtros" y sus etiquetas activas
  const filterProps = {
    accountType, setAccountType, market: accountMarket, setMarket: setAccountMarket,
    group, accounts, onScopeChange: () => setSelectedAccountId('all'),
  }

  const now    = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)

  const dayMap = useMemo(() => {
    const map = {}
    trades.forEach((t) => {
      if (!map[t.date]) map[t.date] = { trades: [], totalR: 0, totalDollar: 0 }
      map[t.date].trades.push(t)
      map[t.date].totalR = parseFloat((map[t.date].totalR + t.rPnl).toFixed(2))
      map[t.date].totalDollar = parseFloat((map[t.date].totalDollar + tradeDollar(t)).toFixed(2))
    })
    return map
  }, [trades])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDayIdx = getFirstDayOfMonth(year, month)
  const totalCells  = Math.ceil((firstDayIdx + daysInMonth) / 7) * 7

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const selectedKey  = selectedDay
    ? `${year}-${String(month + 1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    : null
  const selectedData = selectedKey ? dayMap[selectedKey] : null

  // Eventos económicos del día seleccionado — mismo panel de detalle
  // de siempre, no una pantalla nueva. Fase 1: datos mock de "esta
  // semana" (igual que la fuente real de ForexFactory), por eso solo
  // habrá eventos si el día seleccionado cae dentro de la semana
  // actual — fuera de ese rango, simplemente no hay datos todavía.
  const { allEvents: economicEvents } = useEconomicCalendar({ impactLevels: ['low', 'medium', 'high'] })
  const eventDates = useMemo(() => new Set(economicEvents.map(e => e.date)), [economicEvents])
  const dayEvents = useMemo(
    () => (selectedKey ? economicEvents.filter(e => e.date === selectedKey) : []),
    [economicEvents, selectedKey]
  )
  const [eventsExpanded, setEventsExpanded] = useState(false)
  useEffect(() => setEventsExpanded(false), [selectedKey]) // colapsado de nuevo al cambiar de día

  const monthStats = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2,'0')}`
    const mt = trades.filter(t => t.date.startsWith(prefix))
    const wins   = mt.filter(t => t.result === 'win').length
    const losses = mt.filter(t => t.result === 'loss').length
    const totalR = parseFloat(mt.reduce((s, t) => s + t.rPnl, 0).toFixed(2))
    const totalDollar = sumTradeDollars(mt)
    const greenDays = Object.entries(dayMap).filter(([k]) => k.startsWith(prefix) && dayMap[k].totalR > 0).length
    const redDays   = Object.entries(dayMap).filter(([k]) => k.startsWith(prefix) && dayMap[k].totalR < 0).length
    return { total: mt.length, wins, losses, totalR, totalDollar, greenDays, redDays }
  }, [trades, year, month, dayMap])

  return (
    <div className="page-inner">
      <PageHeader title="Calendar" subtitle="Vista mensual de trading · PnL por día">
        <button className="btn btn-secondary btn-sm" onClick={prevMonth}>← Anterior</button>
        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 160, textAlign: 'center' }}>
          {MONTHS[month]} {year}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={nextMonth}>Siguiente →</button>
      </PageHeader>

      {/* Filtros — mismo criterio que Metrix Básico (Tipo de cuenta + Cuenta) */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24, alignItems: 'flex-end' }}>
        {CALENDAR_FILTERS_V1 && (
        <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>Tipo de cuenta</label>
          <select value={accountType} onChange={e => { setAccountType(e.target.value); setSelectedAccountId('all') }}>
            <option value="all">Todas</option>
            {CALENDAR_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        )}
        <div className="form-group" style={{ marginBottom: 0, width: 220, flex: '0 0 220px' }}>
          <label>Cuenta</label>
          <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
            <option value="all">Todas las cuentas</option>
            {group.groupAccounts
              .filter(a => (accountType === 'all' || a.type === accountType) && (accountMarket === 'all' || a.market === accountMarket))
              .map(a => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
          </select>
        </div>
        {CALENDAR_FILTERS_V1 && <GroupFilterSelects accounts={accounts} group={group} compact onChange={() => setSelectedAccountId('all')} />}
        {!CALENDAR_FILTERS_V1 && <MetricsFiltersButton {...filterProps} />}
        {!CALENDAR_FILTERS_V1 && <ActiveFilterTags {...filterProps} />}
      </div>

      {/* ══════════════════════════════════════
          FRANJA HERO — Nivel 2 (5 métricas, ninguna domina sobre otra).
          No es card — ver "Jerarquía de la información" en /styleguide.
      ══════════════════════════════════════ */}
      <div className="section-gap" style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border2)', borderRadius: 12, padding: 20,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20 }}>
          {[
            { label: 'PnL del mes',    value: `${monthStats.totalDollar >= 0 ? '+$' : '-$'}${Math.abs(monthStats.totalDollar).toLocaleString()}`, up: monthStats.totalR >= 0,
              sub: `${monthStats.totalR >= 0 ? '+' : ''}${monthStats.totalR}R` },
            { label: 'Trades',         value: monthStats.total },
            { label: 'Wins',           value: monthStats.wins },
            { label: 'Días verdes',    value: monthStats.greenDays },
            { label: 'Días rojos',     value: monthStats.redDays },
          ].map(({ label, value, up, sub }) => (
            <div key={label}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
              <div style={{
                fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)',
                color: up === true ? 'var(--pos)' : up === false ? 'var(--neg)' : 'var(--text)',
              }}>
                {value}
              </div>
              {sub && (
                <div style={{ fontSize: 12, fontFamily: 'var(--mono)', marginTop: 2, color: 'var(--text3)' }}>
                  {sub}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2 section-gap" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        {/* Calendar grid */}
        <Card>
          {/* Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
            {DAYS_LABEL.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.8px', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - firstDayIdx + 1
              if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} />

              const dateKey    = `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
              const data       = dayMap[dateKey]
              const hasEvents  = eventDates.has(dateKey)
              const isSelected = selectedDay === dayNum
              const isWeekend  = (i % 7) >= 5

              let bg = 'transparent', color = isWeekend ? 'var(--text3)' : 'var(--text2)', border = 'var(--border)'
              if (data) {
                if (data.totalR > 0)      { bg = 'var(--brand2)'; color = 'var(--pos)'; border = 'rgba(0,208,132,0.25)' }
                else if (data.totalR < 0) { bg = 'var(--red2)';   color = 'var(--red)';   border = 'rgba(255,90,106,0.25)' }
                else                      { bg = 'var(--neutral2)';  color = 'var(--neutral)';  border = 'rgba(246,213,92,0.25)' }
              }

              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(dayNum === selectedDay ? null : dayNum)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 8,
                    background: bg,
                    border: `1px solid ${isSelected ? 'var(--brand)' : border}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    boxShadow: isSelected ? '0 0 0 2px var(--brand)' : 'none',
                    gap: 2,
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: 13, fontFamily: 'var(--mono)', color, fontWeight: data ? 600 : 400 }}>
                    {dayNum}
                  </span>
                  {data && (
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color, opacity: 0.85 }}>
                      {data.totalDollar >= 0 ? '+$' : '-$'}{Math.abs(data.totalDollar).toLocaleString()}
                    </span>
                  )}
                  {data && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color, opacity: 0.6 }}>
                      {data.totalR >= 0 ? '+' : ''}{data.totalR}R
                    </span>
                  )}
                  {hasEvents && (
                    <span title="Eventos económicos ese día" style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)',
                    }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex-center" style={{ marginTop: 16, gap: 16, justifyContent: 'center' }}>
            {[['var(--pos)','Positivo'],['var(--red)','Negativo'],['var(--neutral)','Breakeven']].map(([c, l]) => (
              <div key={l} className="flex-center" style={{ gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c, opacity: 0.5 }} />
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{l}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Detail panel */}
        <Card title={selectedDay ? `Trades · ${selectedDay} ${MONTHS[month]}` : 'Detalle del día'}>
          {!selectedDay && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 12 }}>
              Haz clic en un día coloreado para ver los trades
            </div>
          )}
          {selectedDay && !selectedData && (
            <div style={{ padding: dayEvents.length ? '4px 0' : '40px 0', textAlign: dayEvents.length ? 'left' : 'center', color: 'var(--text3)', fontSize: 12 }}>
              {dayEvents.length > 0 && (
                <>
                  <EventsToggle count={dayEvents.length} expanded={eventsExpanded} onToggle={() => setEventsExpanded(v => !v)} />
                  {eventsExpanded && dayEvents.map(ev => <EconomicEventCard key={ev.id} event={ev} />)}
                </>
              )}
              <div style={{ textAlign: 'center', padding: dayEvents.length ? '20px 0 0' : 0 }}>
                Sin trades registrados este día
              </div>
            </div>
          )}
          {selectedDay && selectedData && (
            <>
              <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: 14, marginBottom: 14 }}>
                <div className="grid-2" style={{ gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>PnL del día</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: selectedData.totalR >= 0 ? 'var(--pos)' : 'var(--red)' }}>
                      {selectedData.totalDollar >= 0 ? '+$' : '-$'}{Math.abs(selectedData.totalDollar).toLocaleString()}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {selectedData.totalR >= 0 ? '+' : ''}{selectedData.totalR}R
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Nº trades</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700 }}>
                      {selectedData.trades.length}
                    </div>
                  </div>
                </div>
              </div>

              {dayEvents.length > 0 && (
                <>
                  <EventsToggle count={dayEvents.length} expanded={eventsExpanded} onToggle={() => setEventsExpanded(v => !v)} />
                  {eventsExpanded && (
                    <div style={{ marginBottom: 14 }}>
                      {dayEvents.map(ev => <EconomicEventCard key={ev.id} event={ev} />)}
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedData.trades.map((t) => (
                  <div key={t.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px' }}>
                    <div className="flex-between mb-2">
                      <div className="flex-center">
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{t.pair}</span>
                        <DirectionBadge direction={t.direction} />
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: (t.dollarPnl ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                          {(t.dollarPnl ?? 0) >= 0 ? '+$' : '-$'}{Math.abs(t.dollarPnl ?? 0).toLocaleString()}
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                          {t.rPnl >= 0 ? '+' : ''}{t.rPnl}R
                        </div>
                      </div>
                    </div>
                    <div className="flex-center" style={{ gap: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{t.time}</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{t.session}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
