import { useEffect, useMemo, useState } from 'react'
import { Card, PageHeader } from '@/components/ui'
import { useStore } from '@/store/useStore'
import { tradeDollar } from '@/lib/tradeDollar'
import { ultimos30, consejosMetricas, cruceTuMetricas } from './coachTu'

// Zona "Tú": cómo van tus métricas y cómo vas tú, que eres quien ejecuta.
// Tu estado (check-in, hábitos, sesgo) lo da la oficina en /tu; tus métricas
// salen de tus operaciones de aquí. El coach cruza las dos cosas.

const VEREDICTO = {
  ready: { txt: 'Ready', color: 'var(--pos)', fondo: 'rgba(62,207,142,0.10)' },
  caution: { txt: 'Caution', color: '#f0b04a', fondo: 'rgba(240,176,74,0.10)' },
  'not-ready': { txt: 'Not Ready', color: 'var(--neg)', fondo: 'rgba(239,91,91,0.10)' },
}
const colorNota = (n) => (n >= 75 ? 'var(--brand)' : n >= 50 ? '#f0b04a' : 'var(--neg)')
const usd = (x) => `${x < 0 ? '-' : '+'}$${Math.abs(Math.round(x)).toLocaleString('es-ES')}`
const diaCorto = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })

function useTu() {
  const [tu, setTu] = useState(undefined)
  useEffect(() => {
    let vivo = true
    fetch('/tu', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setTu(d && d.hoy ? d : null) })
      .catch(() => { if (vivo) setTu(null) })
    return () => { vivo = false }
  }, [])
  return tu
}

function Nota({ etiqueta, valor }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{etiqueta}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 600, color: valor == null ? 'var(--text3)' : colorNota(valor) }}>
        {valor == null ? '—' : valor}<span style={{ fontSize: 13, color: 'var(--text3)' }}>{valor == null ? '' : '/100'}</span>
      </div>
    </div>
  )
}

function Lista({ items, vacio }) {
  if (!items.length) return <p style={{ color: 'var(--text3)', margin: 0 }}>{vacio}</p>
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
      {items.map((t) => (
        <li key={t} style={{ display: 'flex', gap: 10, lineHeight: 1.5, color: 'var(--text)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 7, flexShrink: 0 }} />
          {t}
        </li>
      ))}
    </ul>
  )
}

export default function TuHoy() {
  const tu = useTu()
  const trades = useStore((s) => s.trades)
  const rows = useMemo(() => ultimos30(trades), [trades])
  const { stats, consejos: deMetricas } = useMemo(() => consejosMetricas(rows), [rows])
  const cruce = useMemo(() => cruceTuMetricas(rows, tu?.dias), [rows, tu])
  const pnlDia = useMemo(() => {
    const m = {}
    for (const t of rows) m[t.date] = (m[t.date] || 0) + tradeDollar(t)
    return m
  }, [rows])

  const r = tu?.hoy?.readiness
  const v = r ? VEREDICTO[r.veredicto] : null

  return (
    <div className="page-inner">
      <PageHeader title="Tú hoy" subtitle="Cómo van tus métricas y cómo vas tú, que eres quien ejecuta." />

      {tu === null && (
        <div className="card" style={{ marginBottom: 20, color: 'var(--text2)' }}>
          Tu estado lo da la oficina. Abre Entropia con <code>npm run entropia</code> y contesta el check-in de la mañana en Telegram; aquí verás tu nota, tus hábitos y tu sesgo.
        </div>
      )}

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <Card title="Readiness de hoy">
          {v ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <span style={{ alignSelf: 'start', justifySelf: 'start', padding: '6px 14px', borderRadius: 999, fontWeight: 700, color: v.color, background: v.fondo }}>{v.txt}</span>
              <div style={{ display: 'flex', gap: 28 }}>
                <Nota etiqueta="Mercado" valor={r.mercado.nota} />
                <Nota etiqueta="Tú" valor={r.tu?.nota ?? null} />
              </div>
            </div>
          ) : <p style={{ color: 'var(--text3)', margin: 0 }}>Aún no hay guía de hoy. Sale a las 8:30.</p>}
        </Card>

        <Card title="Cómo llegas hoy">
          {tu?.hoy?.checkin ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <Nota etiqueta="Tu nota" valor={tu.hoy.nota} />
              <Lista items={tu.hoy.motivos} vacio="Sin nada que te reste hoy." />
            </div>
          ) : <p style={{ color: 'var(--text3)', margin: 0 }}>Contesta el check-in en Telegram y aquí verás cómo llegas.</p>}
        </Card>

        <Card title="Tus métricas · 30 días">
          {stats ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><div className="muted" style={{ fontSize: 11 }}>PnL</div><div style={{ fontFamily: 'var(--mono)', fontSize: 20, color: stats.totalDollar >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{usd(stats.totalDollar)}</div></div>
              <div><div className="muted" style={{ fontSize: 11 }}>Operaciones</div><div style={{ fontFamily: 'var(--mono)', fontSize: 20 }}>{stats.total}</div></div>
              <div><div className="muted" style={{ fontSize: 11 }}>Aciertos</div><div style={{ fontFamily: 'var(--mono)', fontSize: 20 }}>{stats.winRateReal}%</div></div>
              <div><div className="muted" style={{ fontSize: 11 }}>Profit factor</div><div style={{ fontFamily: 'var(--mono)', fontSize: 20 }}>{stats.profitFactor}</div></div>
            </div>
          ) : <p style={{ color: 'var(--text3)', margin: 0 }}>Sin operaciones en los últimos 30 días.</p>}
        </Card>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <Card title="Tus últimos días">
          {tu?.dias?.length ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 170, overflowX: 'auto' }}>
              {tu.dias.map((d) => (
                <div key={d.dia} title={`${d.dia}: nota ${d.nota}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 34 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: pnlDia[d.dia] == null ? 'var(--text3)' : pnlDia[d.dia] >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                    {pnlDia[d.dia] == null ? '·' : usd(pnlDia[d.dia])}
                  </span>
                  <div style={{ width: 18, height: Math.max(6, d.nota * 1.1), borderRadius: 6, background: colorNota(d.nota), opacity: 0.85 }} />
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{diaCorto(d.dia)}</span>
                </div>
              ))}
            </div>
          ) : <p style={{ color: 'var(--text3)', margin: 0 }}>Cuando contestes unos días el check-in, aquí verás tu nota de cada día con lo que ganaste o perdiste.</p>}
        </Card>

        <Card title="Hábitos y sesgo">
          <div style={{ display: 'grid', gap: 12 }}>
            {(tu?.habitos ?? []).map((h) => (
              <div key={h.nombre}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                  <span style={{ textTransform: 'capitalize' }}>{h.nombre}</span>
                  <span className="mono muted">{h.hechos}/{h.de}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg4)' }}>
                  <div style={{ width: `${(h.hechos / h.de) * 100}%`, height: '100%', borderRadius: 3, background: 'var(--accent-gradient, var(--accent))' }} />
                </div>
              </div>
            ))}
            {!tu?.habitos?.length && <p style={{ color: 'var(--text3)', margin: 0 }}>Aún no hay hábitos registrados.</p>}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 13 }}>
              {tu?.sesgo?.total
                ? <>Tu sesgo de la mañana acertó <b>{tu.sesgo.aciertos} de {tu.sesgo.total}</b> días.</>
                : <span style={{ color: 'var(--text3)' }}>Cuando digas tu sesgo por la mañana, al cierre verás si acertó.</span>}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Coach · qué puedes mejorar">
        <div className="grid-3">
          <div>
            <div className="section-title" style={{ marginBottom: 10 }}>En tus métricas</div>
            <Lista items={deMetricas} vacio="Necesito al menos 5 operaciones en 30 días." />
          </div>
          <div>
            <div className="section-title" style={{ marginBottom: 10 }}>En ti</div>
            <Lista items={tu?.consejos ?? []} vacio="Con unos días de check-in te digo qué ajustar." />
          </div>
          <div>
            <div className="section-title" style={{ marginBottom: 10 }}>Tú y tus métricas</div>
            <Lista items={cruce ? [cruce.texto] : []} vacio="Cuando haya días con check-in y operaciones, te digo cómo te afecta llegar flojo." />
          </div>
        </div>
      </Card>
    </div>
  )
}
