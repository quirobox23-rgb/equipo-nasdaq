// ─────────────────────────────────────────────
//  DASHBOARD · Fila 4 — Operativa
//  Tabla de operaciones / Objetivos / Hábitos / Actividad reciente.
//  Tabla estilo Notion: compacta, con hover y badges.
// ─────────────────────────────────────────────
import { useNavigate } from 'react-router-dom'
import { Badge, ProgressBar, Card } from '@/components/ui'
import { useStore } from '@/store/useStore'
import { PRE_TRADE_ITEMS } from '@/data/mockData'

const WEEKDAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

function RecentTradesTable({ trades, onRowClick }) {
  const recent = [...trades]
    .sort((a, b) => (b.datetime ?? b.date).localeCompare(a.datetime ?? a.date))
    .slice(0, 6)

  if (!recent.length) {
    return <div style={{ fontSize: 11, color: 'var(--text3)' }}>Sin operaciones en este periodo</div>
  }

  return (
    <div className="notion-table">
      <div className="notion-table-head">
        <span>Fecha</span><span>Setup</span><span>Dir.</span><span>R</span><span>Estado</span>
      </div>
      {recent.map((t, i) => (
        <div className="notion-table-row" key={t.id ?? i} onClick={() => onRowClick?.(t)}>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{t.date}</span>
          <span>{t.setup}</span>
          <span>{t.direction === 'long' ? 'Long' : 'Short'}</span>
          <span style={{ fontFamily: 'var(--mono)', color: t.rPnl >= 0 ? 'var(--pos)' : 'var(--red)' }}>
            {t.rPnl >= 0 ? '+' : ''}{t.rPnl}R
          </span>
          <span>
            <Badge variant={t.result === 'win' ? 'green' : t.result === 'loss' ? 'red' : 'amber'}>
              {t.result === 'win' ? 'Win' : t.result === 'loss' ? 'Loss' : 'BE'}
            </Badge>
          </span>
        </div>
      ))}
    </div>
  )
}

function Objetivos({ stats }) {
  const rr = stats.avgLoss !== 0 ? Math.abs(stats.avgWin / stats.avgLoss) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
          <span style={{ color: 'var(--text2)' }}>Consistencia</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{stats.consistency}% / 70%</span>
        </div>
        <ProgressBar value={stats.consistency} max={70} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
          <span style={{ color: 'var(--text2)' }}>Profit Factor</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{stats.profitFactor} / 1.5</span>
        </div>
        <ProgressBar value={stats.profitFactor} max={1.5} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
          <span style={{ color: 'var(--text2)' }}>R:R medio</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{rr.toFixed(2)} / 2.0</span>
        </div>
        <ProgressBar value={rr} max={2} />
      </div>
    </div>
  )
}

function Habitos() {
  const ritualByDate = useStore(s => s.ritualByDate)
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().split('T')[0]
    const ritual = ritualByDate[key]
    const pct = ritual ? ritual.checkedIds.length / PRE_TRADE_ITEMS.length : null
    return { label: WEEKDAY_LABELS[d.getDay()], pct }
  })
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        {days.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{
              width: 26, height: 26, margin: '0 auto', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
              background: d.pct === null ? 'var(--bg3)' : d.pct >= 0.75 ? 'rgba(0,208,132,0.22)' : 'rgba(255,90,106,0.22)',
              color: d.pct === null ? 'var(--text3)' : d.pct >= 0.75 ? 'var(--pos)' : 'var(--red)',
            }}>
              {d.pct === null ? '·' : d.pct >= 0.75 ? '✓' : '✗'}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>{d.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10, textAlign: 'center' }}>
        Checklist pre-trade completado ≥75%
      </div>
    </div>
  )
}

function ActividadReciente({ trades }) {
  const recent = [...trades]
    .sort((a, b) => (b.datetime ?? b.date).localeCompare(a.datetime ?? a.date))
    .slice(0, 4)

  if (!recent.length) {
    return <div style={{ fontSize: 11, color: 'var(--text3)' }}>Sin actividad reciente</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {recent.map((t, i) => (
        <div key={t.id ?? i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
          <span aria-hidden="true" style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0,
            background: t.result === 'win' ? 'var(--pos)' : t.result === 'loss' ? 'var(--neg)' : 'var(--neutral)',
          }} />
          <span style={{ color: 'var(--text2)' }}>
            Trade cerrado: <b style={{ color: 'var(--text)' }}>{t.setup}</b>{' '}
            <span style={{ fontFamily: 'var(--mono)', color: t.rPnl >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
              {t.rPnl >= 0 ? '+' : ''}{t.rPnl}R
            </span>{' '}
            — {t.date}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardActivity({ stats, trades }) {
  const navigate = useNavigate()
  return (
    <div className="section-gap" style={{ gap: 12 }}>
      {/*
      <div className="card-sm">
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 10 }}>Tabla de operaciones</div>
        <RecentTradesTable trades={trades} onRowClick={() => navigate('/historial')} />
      </div>
      <div className="card-sm">
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 10 }}>Objetivos</div>
        <Objetivos stats={stats} />
      </div>
      */}
      <Card title="Rutina diaria">
        <Habitos />
      </Card>
      {/*
      <div className="card-sm">
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 10 }}>Actividad reciente</div>
        <ActividadReciente trades={trades} />
      </div>
      */}
    </div>
  )
}
