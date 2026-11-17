// ─────────────────────────────────────────────
//  DASHBOARD · Secciones de detalle
//  Insights automáticos, Trade Efficiency (MFE), Consistencia de
//  Lotaje y Setup Breakdown + Weekday. Todo lo que en el Dashboard
//  principal queda "debajo del pliegue" (el resumen ejecutivo vive
//  en Dashboard.jsx; el detalle completo vive aquí).
//  Depende únicamente de `stats` (el objeto que devuelve computeStats),
//  sin estado propio ni closures sobre el resto de la página.
// ─────────────────────────────────────────────
import {
  BarChart, Bar, ResponsiveContainer, Cell, Tooltip, XAxis, YAxis, ReferenceLine,
} from 'recharts'
import { Trophy, Calendar, Clock, Timer, Check, AlertTriangle, BarChart3, Package } from 'lucide-react'
import { ProgressBar } from '@/components/ui'
import { TT, SectionLabel, StatTile, InsightCard, RiskGauge } from './dashboardHelpers'

export default function DashboardDetailSections({ stats }) {
  return (
    <>
        {/* ══════════════════════════════════════
            SECCIÓN 0 — WIN RATE DETALLADO + RISK
            (versión anterior del Dashboard, conservada aquí como
            detalle ampliado — la vista ejecutiva ya vive arriba)
        ══════════════════════════════════════ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 12,
          marginBottom: 28,
          width: '100%',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            <div style={{
              background: 'var(--bg2)', border: '1px solid rgba(59,130,246,0.25)',
              borderTop: '3px solid #3b82f6', borderRadius: 'var(--r)',
              padding: '24px 20px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60,
                background: 'linear-gradient(to bottom, rgba(59,130,246,0.06), transparent)', pointerEvents: 'none' }} />
              <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10 }}>
                No Loss Rate
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 52, fontWeight: 900, color: '#60a5fa', lineHeight: 1, letterSpacing: '-1px' }}>
                {parseFloat(((stats.wins + stats.breakevens) / stats.total * 100).toFixed(1))}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 12, lineHeight: 1.5 }}>
                Wins + BE sobre total trades
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontFamily: 'var(--mono)' }}>
                {stats.wins + stats.breakevens} de {stats.total} trades no perdieron
              </div>
              <div style={{
                marginTop: 16, padding: '4px 14px', borderRadius: 20,
                background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
                fontSize: 11, color: '#60a5fa', fontFamily: 'var(--mono)', fontWeight: 600,
              }}>
                {stats.wins}W + {stats.breakevens}BE = {stats.wins + stats.breakevens} trades sin pérdida
              </div>
            </div>

            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderTop: '3px solid var(--brand)', borderRadius: 'var(--r)',
              padding: '24px 20px', display: 'flex', flexDirection: 'column',
              justifyContent: 'center',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 20 }}>
                Distribución real
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--pos)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Win</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{stats.wins} trades</span>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 800, color: 'var(--pos)' }}>
                  {parseFloat((stats.wins / stats.total * 100).toFixed(1))}%
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Loss</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{stats.losses} trades</span>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 800, color: 'var(--red)' }}>
                  {parseFloat((stats.losses / stats.total * 100).toFixed(1))}%
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Break Even</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{stats.breakevens} trades</span>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 800, color: 'var(--amber)' }}>
                  {parseFloat((stats.breakevens / stats.total * 100).toFixed(1))}%
                </span>
              </div>

              <div>
                <div style={{ display: 'flex', height: 8, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ flex: stats.wins,                      background: 'var(--pos)', opacity: 0.9 }} />
                  <div style={{ flex: Math.max(stats.breakevens, 0.5), background: 'var(--amber)', opacity: 0.85 }} />
                  <div style={{ flex: Math.max(stats.losses, 0.5),     background: 'var(--red)',   opacity: 0.8 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                  <span style={{ color: 'var(--pos)' }}>W {parseFloat((stats.wins / stats.total * 100).toFixed(1))}%</span>
                  <span style={{ color: 'var(--amber)' }}>BE {parseFloat((stats.breakevens / stats.total * 100).toFixed(1))}%</span>
                  <span style={{ color: 'var(--red)' }}>L {parseFloat((stats.losses / stats.total * 100).toFixed(1))}%</span>
                </div>
              </div>
            </div>
          </div>

          {(() => {
            const wr  = stats.winRate / 100
            const wrR = stats.winRateReal / 100
            const be  = stats.beRate / 100
            const insights = []

            if (be > 0.4) insights.push({
              level: 'red',
              text: 'Estás usando demasiado Break Even. Puede que estés cerrando trades antes de tiempo.',
            })
            if (wr < 0.4 && wrR > 0.55) insights.push({
              level: 'amber',
              text: 'Tu winrate real es bueno, pero los BE están reduciendo tu winrate total artificialmente.',
            })
            if (wrR < 0.45 && stats.wins + stats.losses >= 10) insights.push({
              level: 'red',
              text: 'Tu winrate en trades decisivos es bajo. Revisa tu estrategia o setups.',
            })
            if (wrR > 0.55 && be >= 0.2 && be <= 0.4) insights.push({
              level: 'green',
              text: 'Buen equilibrio entre riesgo y protección de capital.',
            })

            if (!insights.length) return null

            const colors = {
              red:   { bg: 'var(--red2)',   border: 'rgba(255,77,109,0.2)',   text: 'var(--red)'   },
              amber: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: 'var(--amber)' },
              green: { bg: 'var(--brand2)', border: 'rgba(0,212,160,0.2)',    text: 'var(--pos)' },
            }

            return (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {insights.map((ins, i) => {
                  const c = colors[ins.level]
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 14px', borderRadius: 8,
                      background: c.bg, border: `1px solid ${c.border}`,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.text, flexShrink: 0, marginTop: 5 }} />
                      <span style={{ fontSize: 12, color: c.text, lineHeight: 1.5 }}>{ins.text}</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div>
            <SectionLabel accent="var(--brand)">Métricas de Trading</SectionLabel>
            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r)', padding: '16px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <StatTile label="Avg Win"  value={`+${stats.avgWin}R`} color="var(--pos)"
                  sub={stats.avgWinDollar  ? `+$${stats.avgWinDollar}`           : undefined} />
                <StatTile label="Avg Loss" value={`${stats.avgLoss}R`} color="var(--red)"
                  sub={stats.avgLossDollar ? `-$${Math.abs(stats.avgLossDollar)}` : undefined} />
                <StatTile label="Wins"       value={stats.wins}            color="var(--pos)" sub={`de ${stats.total} trades`} />
                <StatTile label="Losses"     value={stats.losses}          color="var(--red)"   sub={`de ${stats.total} trades`} />
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Distribución W/L</div>
                <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ flex: stats.wins, background: 'var(--pos)', opacity: 0.8 }} />
                  <div style={{ flex: Math.max(stats.losses, 1), background: 'var(--red)', opacity: 0.7 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                  <span style={{ color: 'var(--pos)' }}>W {stats.winRate}%</span>
                  <span style={{ color: 'var(--red)' }}>L {(100 - stats.winRate).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel accent="var(--red)">Risk & Advanced</SectionLabel>
            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r)', padding: '16px',
            }}>
              <RiskGauge label="Sharpe Ratio" value={stats.sharpe} max={3} color="var(--brand)" format={v => v.toFixed(2)} />
              <RiskGauge label="Consistencia de curva" value={stats.consistency} max={100} color="var(--brand)" format={v => `${v}%`} />
              <RiskGauge label="Max Drawdown" value={Math.abs(stats.maxDD)} max={20} color="var(--red)" format={v => `-${v}%`} inverse />
              <RiskGauge label="Riesgo de ruina" value={stats.ror} max={100} color="var(--amber)" format={v => `${v}%`} inverse />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginTop: 12, padding: '8px 10px',
                background: stats.sharpe >= 1 ? 'var(--brand2)' : 'var(--bg3)',
                border: `1px solid ${stats.sharpe >= 1 ? 'rgba(0,212,160,0.2)' : 'var(--border)'}`,
                borderRadius: 6, fontSize: 11,
                color: stats.sharpe >= 1 ? 'var(--pos)' : 'var(--text3)',
              }}>
                {stats.sharpe >= 1 ? <Check size={13} /> : <AlertTriangle size={13} />}
                {stats.sharpe >= 2 ? 'Sharpe excelente (>2)' :
                 stats.sharpe >= 1 ? 'Sharpe aceptable (>1)' :
                 'Sharpe bajo — revisar consistencia'}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            SECCIÓN 4 — INSIGHTS AUTOMÁTICOS
        ══════════════════════════════════════ */}
        <SectionLabel accent="var(--amber)">Insights automáticos</SectionLabel>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
          marginBottom: 28,
        }}>
          {stats.bestSetup && (
            <InsightCard
              icon={<Trophy size={16} />} label="Mejor setup"
              value={stats.bestSetup.setup}
              sub={`+${stats.bestSetup.avgR}R avg · ${stats.bestSetup.wr}% WR`}
              accent="var(--amber)"
            />
          )}
          {stats.bestDay && (
            <InsightCard
              icon={<Calendar size={16} />} label="Mejor día"
              value={stats.bestDay.day}
              sub={`+${stats.bestDay.r}R avg`}
              accent="var(--brand)"
            />
          )}
          {stats.bestSession && (
            <InsightCard
              icon={<Clock size={16} />} label="Mejor sesión"
              value={stats.bestSession.session}
              sub={`+${stats.bestSession.avgR}R avg · ${stats.bestSession.count} trades`}
              accent="var(--brand-deep, #3B82F6)"
            />
          )}
          {stats.bestHour && (
            <InsightCard
              icon={<Timer size={16} />} label="Mejor horario"
              value={stats.bestHour.hour}
              sub={`+${stats.bestHour.avgR}R avg`}
              accent="var(--brand)"
            />
          )}
        </div>

        {/* ══════════════════════════════════════
            TRADE EFFICIENCY (MFE) — condicional
        ══════════════════════════════════════ */}
        {stats.mfeStats ? (
          <>
            <SectionLabel accent="var(--brand-deep, #3B82F6)">Trade Efficiency · MFE</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>

              {/* Eficiencia media */}
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderTop: `3px solid ${stats.mfeStats.avg >= 0.6 ? 'var(--pos)' : stats.mfeStats.avg >= 0.4 ? 'var(--amber)' : 'var(--red)'}`,
                borderRadius: 'var(--r)', padding: '20px',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>Eficiencia media</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 44, fontWeight: 900, lineHeight: 1,
                  color: stats.mfeStats.avg >= 0.6 ? 'var(--pos)' : stats.mfeStats.avg >= 0.4 ? 'var(--amber)' : 'var(--red)' }}>
                  {(stats.mfeStats.avg * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>R capturado sobre MFE disponible</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                  {stats.mfeStats.count} trades · MFE medio +{stats.mfeStats.avgMFE}R
                </div>
                {/* Barra de eficiencia */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
                    <span>Capturado</span><span>Dejado en mesa</span>
                  </div>
                  <div style={{ display: 'flex', height: 8, borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ flex: stats.mfeStats.avg, background: stats.mfeStats.avg >= 0.6 ? 'var(--pos)' : 'var(--amber)', opacity: 0.9 }} />
                    <div style={{ flex: 1 - stats.mfeStats.avg, background: 'var(--bg3)', border: '1px solid var(--border)' }} />
                  </div>
                </div>
                {/* Insight inline */}
                {stats.mfeStats.avg < 0.4 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '8px 12px', borderRadius: 8,
                    background: 'var(--red2)', border: '1px solid rgba(255,77,109,0.2)',
                    fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: 5 }} />
                    <span>Estás capturando poco del movimiento. Puede que salgas demasiado pronto.</span>
                  </div>
                )}
                {stats.mfeStats.avg >= 0.4 && stats.mfeStats.avg < 0.6 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                    fontSize: 12, color: 'var(--amber)', lineHeight: 1.5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0, marginTop: 5 }} />
                    <span>Eficiencia mejorable. Revisa tu gestión de salidas.</span>
                  </div>
                )}
              </div>

              {/* BE que estuvieron en positivo */}
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderTop: `3px solid ${stats.mfeStats.bePct > 30 ? 'var(--red)' : 'var(--amber)'}`,
                borderRadius: 'var(--r)', padding: '20px',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>BE con MFE positivo</div>
                {stats.mfeStats.beTotal === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>Sin trades BE registrados</div>
                ) : stats.mfeStats.beMFE === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>Ningún BE tiene MFE registrado aún</div>
                ) : (
                  <>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 44, fontWeight: 900, lineHeight: 1,
                      color: stats.mfeStats.bePct > 50 ? 'var(--red)' : 'var(--amber)' }}>
                      {stats.mfeStats.bePct}%
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>de tus BE llegaron a estar en positivo</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                      {stats.mfeStats.beMFE} de {stats.mfeStats.beTotal} trades BE
                    </div>
                    {stats.mfeStats.bePct > 30 && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '8px 12px', borderRadius: 8,
                        background: stats.mfeStats.bePct > 50 ? 'var(--red2)' : 'rgba(245,158,11,0.08)',
                        border: `1px solid ${stats.mfeStats.bePct > 50 ? 'rgba(255,77,109,0.2)' : 'rgba(245,158,11,0.25)'}`,
                        fontSize: 12, color: stats.mfeStats.bePct > 50 ? 'var(--red)' : 'var(--amber)', lineHeight: 1.5 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                          background: stats.mfeStats.bePct > 50 ? 'var(--red)' : 'var(--amber)',
                        }} />
                        <span>Muchos BE estuvieron en beneficio. Puede que estés moviendo el stop demasiado pronto.</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ marginBottom: 28, padding: '14px 18px', borderRadius: 'var(--r)',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12 }}>
            <BarChart3 size={18} style={{ color: 'var(--text3)' }} />
            <div>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 2 }}>Trade Efficiency · MFE</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Añade el campo <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg3)', padding: '1px 5px', borderRadius: 4 }}>MFE (R)</code> en tus trades para activar esta métrica.</div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            LOTAJE — condicional
        ══════════════════════════════════════ */}
        {stats.lotStats ? (
          <>
            <SectionLabel accent="var(--brand)">Consistencia de Lotaje</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <StatTile label="Lotaje medio"     value={`${stats.lotStats.avg} cts`}  color="var(--brand)" sub={`${stats.lotStats.count} trades con qty`} />
              <StatTile label="Desviación (std)" value={stats.lotStats.std}            color={stats.lotStats.cv > 40 ? 'var(--red)' : 'var(--amber)'} sub={`CV ${stats.lotStats.cv}%`} />
              <StatTile label="Rango"            value={`${stats.lotStats.min} – ${stats.lotStats.max}`} color="var(--text2)" />
              {stats.lotStats.avgRBig !== null && (
                <StatTile
                  label={`R medio lote alto (>${Math.round(stats.lotStats.avg)})`}
                  value={`${stats.lotStats.avgRBig >= 0 ? '+' : ''}${stats.lotStats.avgRBig}R`}
                  color={stats.lotStats.avgRBig >= 0 ? 'var(--pos)' : 'var(--red)'}
                  sub={`${stats.lotStats.bigCount} trades`}
                />
              )}
              {stats.lotStats.avgRSmall !== null && (
                <StatTile
                  label={`R medio lote bajo (≤${Math.round(stats.lotStats.avg)})`}
                  value={`${stats.lotStats.avgRSmall >= 0 ? '+' : ''}${stats.lotStats.avgRSmall}R`}
                  color={stats.lotStats.avgRSmall >= 0 ? 'var(--pos)' : 'var(--red)'}
                  sub={`${stats.lotStats.smallCount} trades`}
                />
              )}
            </div>

            {/* Insights de lotaje */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {stats.lotStats.cv > 40 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                  borderRadius: 8, background: 'var(--red2)', border: '1px solid rgba(255,77,109,0.2)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>
                    Tu tamaño de posición es inconsistente (CV {stats.lotStats.cv}%). Puede indicar falta de disciplina en el sizing.
                  </span>
                </div>
              )}
              {stats.lotStats.avgRBig !== null && stats.lotStats.avgRSmall !== null &&
               stats.lotStats.avgRBig < stats.lotStats.avgRSmall && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                  borderRadius: 8, background: 'var(--red2)', border: '1px solid rgba(255,77,109,0.2)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>
                    Tus trades con mayor lotaje tienen peor rendimiento ({stats.lotStats.avgRBig}R vs {stats.lotStats.avgRSmall}R). Posible sobreexposición.
                  </span>
                </div>
              )}
              {stats.lotStats.cv <= 25 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                  borderRadius: 8, background: 'var(--brand2)', border: '1px solid rgba(0,212,160,0.2)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pos)', flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 12, color: 'var(--pos)', lineHeight: 1.5 }}>
                    Sizing consistente (CV {stats.lotStats.cv}%). Buena disciplina en el tamaño de posición.
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ marginBottom: 28, padding: '14px 18px', borderRadius: 'var(--r)',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12 }}>
            <Package size={18} style={{ color: 'var(--text3)' }} />
            <div>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 2 }}>Consistencia de Lotaje</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Los trades importados desde CSV incluyen el campo <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg3)', padding: '1px 5px', borderRadius: 4 }}>qty</code> automáticamente. Edita trades manuales para añadirlo.</div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            SECCIÓN 5 — SETUP BREAKDOWN + WEEKDAY
        ══════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Win Rate por Setup */}
          <div>
            <SectionLabel accent="var(--brand)">Win Rate por Setup</SectionLabel>
            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r)', padding: 16,
            }}>
              {stats.bySetup.length === 0 && (
                <div style={{ color: 'var(--text3)', fontSize: 12 }}>Sin datos</div>
              )}
              {stats.bySetup.map(({ setup, win, loss, avgR, wr }) => {
                const total = win + loss
                return (
                  <div key={setup} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text)' }}>{setup}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 10, fontFamily: 'var(--mono)',
                          color: avgR >= 0 ? 'var(--pos)' : 'var(--red)',
                        }}>{avgR >= 0 ? '+' : ''}{avgR}R</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                          {wr}% · {total}t
                        </span>
                      </div>
                    </div>
                    <ProgressBar value={wr} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* PnL por día de semana */}
          <div>
            <SectionLabel accent="var(--brand)">PnL promedio por día</SectionLabel>
            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r)', padding: 16,
            }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={stats.byWeekday} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <ReferenceLine y={0} stroke="var(--border2)" strokeDasharray="3 3" />
                  <Tooltip
                    formatter={(v, n, p) => [`${v > 0 ? '+' : ''}${v}R · ${p.payload.count} trades`]}
                    contentStyle={TT}
                  />
                  <Bar dataKey="r" radius={[4,4,0,0]} maxBarSize={40}>
                    {stats.byWeekday.map(d => (
                      <Cell key={d.day} fill={d.r >= 0 ? 'var(--pos)' : 'var(--red)'}
                        opacity={d === stats.bestDay ? 1 : 0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Daily breakdown mini tiles */}
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                {stats.byWeekday.map(d => (
                  <div key={d.day} style={{
                    flex: 1, textAlign: 'center', padding: '4px 0',
                    borderRadius: 4,
                    background: d === stats.bestDay ? 'var(--brand2)' : 'transparent',
                  }}>
                    <div style={{ fontSize: 9, color: 'var(--text3)' }}>{d.day}</div>
                    <div style={{
                      fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600,
                      color: d.r >= 0 ? 'var(--pos)' : 'var(--red)',
                    }}>{d.r > 0 ? '+' : ''}{d.r}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

    </>
  )
}
