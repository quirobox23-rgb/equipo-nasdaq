import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, AlertTriangle, BarChart3, ThumbsUp } from 'lucide-react'
import { Card, PageHeader, ProgressBar, IconCircle } from '@/components/ui'
import { useTrades, useAccounts } from '@/store/useStore'
import PremiumGate from '@/components/premium/PremiumGate'
import { useBlueprintsList } from '@/store/useBlueprintsStore'
import { useAccountBlueprintAssignments } from '@/store/useAccountBlueprintStore'
import { computeAccountMetrics, matchBlueprintToAccount } from '@/config/blueprintMatchEngine'
import { filterTradesByAccountScope, filterTradesByPeriod, accountLabel } from './dashboard/dashboardHelpers'
import {
  generateExecutiveSummary, generateDiagnosis, generateTraderProfile,
  analyzeOperationalContext, analyzeStatisticalReliability, generateRecommendations,
  generateBlueprintProfessionalContext, compareUserToBlueprint,
} from '@/config/mentorInsights'
import { Chips } from '@/components/accounts/accountFormShared'
import { ACCOUNT_TYPE_FILTER_OPTIONS, ACCOUNT_STATUS_FILTER_OPTIONS, MARKET_FILTER_OPTIONS, PERIOD_FILTER_OPTIONS, byAccountStatus, accountOptionLabel } from '@/components/accounts/metricsFilterOptions'

// ─────────────────────────────────────────────
//  MENTOR IA — Sprint 32: Inteligencia de Trading
//
//  Responde a una única pregunta: "¿Qué significan realmente mis
//  datos y qué decisiones debería tomar?". No repite métricas (eso
//  es Metrix), no repite entrenamientos (eso es Training), no repite
//  la tabla métrica a métrica del Blueprint (eso es Blueprints/Match
//  Engine). Solo interpreta.
//
//  Toda la interpretación vive en config/mentorInsights.js, aislada
//  de esta pantalla. Los filtros (Cuenta/Periodo) reutilizan
//  exactamente el mismo sistema que Dashboard y Metrix
//  (filterTradesByAccountScope / filterTradesByPeriod, Sprint 31).
// ─────────────────────────────────────────────

export default function IaMentor() {
  const navigate = useNavigate()
  const trades   = useTrades()
  const accounts = useAccounts()
  const blueprints = useBlueprintsList()
  const assignments = useAccountBlueprintAssignments()


  // ── Filtros: mismo sistema que Dashboard/Metrix (Sprint 31) ──
  const [selectedAccountId, setSelectedAccountId] = useState('all')
  const [accountMarket, setAccountMarket] = useState('all')
  const [selectedPeriod, setPeriod] = useState('1M') // 30 días por defecto

  const selectedAccount = selectedAccountId !== 'all'
    ? accounts.find(a => a.id === selectedAccountId) || null
    : null

  const scopedTrades = useMemo(
    () => filterTradesByAccountScope(trades, accounts, { accountType: 'all', accountMarket, accountId: selectedAccountId }),
    [trades, accounts, accountMarket, selectedAccountId]
  )
  const periodTrades = useMemo(
    () => filterTradesByPeriod(scopedTrades, selectedPeriod),
    [scopedTrades, selectedPeriod]
  )

  const accountMetrics = useMemo(
    () => computeAccountMetrics(periodTrades, selectedAccount),
    [periodTrades, selectedAccount]
  )

  // ── Bloque 1: interpretación (config/mentorInsights.js) ──
  const executiveSummary = useMemo(() => generateExecutiveSummary({ accountMetrics }), [accountMetrics])
  const diagnosis = useMemo(() => generateDiagnosis({ accountMetrics }), [accountMetrics])
  const traderProfile = useMemo(() => generateTraderProfile({ accountMetrics, trades: periodTrades }), [accountMetrics, periodTrades])
  const operationalContext = useMemo(() => analyzeOperationalContext(periodTrades), [periodTrades])
  const statisticalReliability = useMemo(() => analyzeStatisticalReliability(periodTrades), [periodTrades])
  const recommendations = useMemo(
    () => generateRecommendations({ diagnosis, contextInsights: operationalContext, accountMetrics }),
    [diagnosis, operationalContext, accountMetrics]
  )

  // ── Bloque 2: Elite Performance (Match Engine, sin recalcular nada) ──
  const assignedBlueprint = selectedAccount ? blueprints.find(b => b.id === assignments[selectedAccount.id]) : null
  const match = useMemo(
    () => (assignedBlueprint ? matchBlueprintToAccount(assignedBlueprint, accountMetrics) : null),
    [assignedBlueprint, accountMetrics]
  )
  const professionalContext = useMemo(() => generateBlueprintProfessionalContext(assignedBlueprint), [assignedBlueprint])
  const userVsBlueprint = useMemo(
    () => compareUserToBlueprint(assignedBlueprint, periodTrades),
    [assignedBlueprint, periodTrades]
  )

  return (
    <div className="page-inner">
      <PageHeader title="Mentor IA" subtitle="¿Qué significan realmente mis datos y qué decisiones debería tomar?" />

      {/* ══════════════════════════════════════════════════
          FILTROS — mismo sistema que Dashboard/Metrix
      ══════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Mercado</label>
          <Chips size="xs" label="Mercado" value={accountMarket} options={MARKET_FILTER_OPTIONS}
            onChange={v => { setAccountMarket(v); setSelectedAccountId('all') }} />
        </div>
        {/* Ancho fijo: antes se estiraba y empujaba los otros filtros a otra fila */}
        <div className="form-group" style={{ marginBottom: 0, width: 220, flex: '0 0 220px' }}>
          <label>Cuenta</label>
          <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
            <option value="all">Todas</option>
            {accounts.filter(a => accountMarket === 'all' || a.market === accountMarket).sort(byAccountStatus).map(a => <option key={a.id} value={a.id}>{accountOptionLabel(a)}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>Periodo</label>
          <Chips size="xs" label="Periodo" value={selectedPeriod} options={PERIOD_FILTER_OPTIONS} onChange={setPeriod} />
          {/* <select value={selectedPeriod} onChange={e => setPeriod(e.target.value)}>
            <option value="1W">7 días</option>
            <option value="1M">30 días</option>
            <option value="3M">90 días</option>
            <option value="ALL">Todo</option>
          </select> */}
        </div>
      </div>

      {!accountMetrics ? (
        <Card><p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>No hay operaciones registradas para este filtro.</p></Card>
      ) : (
        <>
          {/* 1. Resumen Ejecutivo */}
          <div className="section-gap">
            <Card title="Resumen Ejecutivo">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {executiveSummary.map((line, i) => (
                  <p key={i} style={{ fontSize: 14, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{line}</p>
                ))}
              </div>
            </Card>
          </div>

          {/* 2-6. Diagnóstico, Perfil, Contexto, Recomendaciones — requieren Pro */}
          <PremiumGate feature="iaMentorDiagnostico">
          {/* 2. Diagnóstico */}
          <div className="section-gap">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--section-accent)', whiteSpace: 'nowrap' }}>
                Diagnóstico
              </h3>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card title="Fortalezas">
                {diagnosis.strengths.length === 0
                  ? <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Todavía sin datos suficientes.</p>
                  : diagnosis.strengths.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                      <Check size={13} style={{ color: 'var(--pos)', flexShrink: 0, marginTop: 2 }} /> {s}
                    </div>
                  ))}
              </Card>
              <Card title="Áreas de mejora">
                {diagnosis.weaknesses.length === 0
                  ? <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Nada relevante que señalar.</p>
                  : diagnosis.weaknesses.map((w, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                      <AlertTriangle size={13} style={{ color: 'var(--neutral)', flexShrink: 0, marginTop: 2 }} /> {w}
                    </div>
                  ))}
              </Card>
            </div>
          </div>

          {/* 3. Perfil del Trader */}
          <div className="section-gap">
            <Card title="Perfil del Trader">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {traderProfile.map((tag, i) => (
                  <span key={i} className="badge badge-green" style={{ fontSize: 12, fontWeight: 600 }}>{tag}</span>
                ))}
              </div>
            </Card>
          </div>

          {/* 4. Contexto Operativo */}
          <div className="section-gap">
            <Card title="Contexto Operativo">
              {operationalContext.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                  Todavía no hay suficientes operaciones para detectar patrones fiables.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {operationalContext.map((line, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--brand)' }}>→</span> {line}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* 5. Contexto Estadístico */}
          <div className="section-gap">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8,
              background: 'var(--bg2)', border: '1px solid var(--border2)',
            }}>
              <BarChart3 size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{statisticalReliability}</span>
            </div>
          </div>

          {/* 6. Recomendaciones Prioritarias */}
          <div className="section-gap">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--section-accent)', whiteSpace: 'nowrap' }}>
                Recomendaciones Prioritarias
              </h3>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {recommendations.map((r, i) => (
                <Card key={i} style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <IconCircle icon={<ThumbsUp size={16} />} color="pos" size={30} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, color: 'var(--pos)' }}>
                        Prioridad {i + 1}
                      </div>
                      <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.5 }}>{r}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          </PremiumGate>

          {/* ── Separador visual entre bloques ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '40px 0 24px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border2)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px' }}>ELITE PERFORMANCE</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border2)' }} />
          </div>

          {/* ══════════════════════════════════════════════════
              BLOQUE 2 — ELITE PERFORMANCE
          ══════════════════════════════════════════════════ */}
          <PremiumGate feature="iaMentorPersonalizado">
            {!selectedAccount ? (
              <Card><p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Selecciona una cuenta concreta arriba para ver su contexto profesional.</p></Card>
            ) : !assignedBlueprint ? (
              <Card><p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Esta cuenta todavía no tiene Mapa asignado (asígnalo desde Portfolio).</p></Card>
            ) : (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mapa activo</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: assignedBlueprint.color }}>{assignedBlueprint.name.toUpperCase()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Compatibilidad</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{match?.compatibility ?? 0}%</div>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <ProgressBar value={match?.compatibility ?? 0} max={100} />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase' }}>
                  Contexto Profesional
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {professionalContext.map((line, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>→ {line}</div>
                  ))}
                </div>
              </div>

              {userVsBlueprint.comparisons.length > 0 && (
                <div style={{ marginBottom: 18, paddingTop: 14, borderTop: '1px solid var(--border2)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral)', marginBottom: 8, textTransform: 'uppercase' }}>
                    Tu comportamiento frente al Mapa
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {userVsBlueprint.comparisons.map((line, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>→ {line}</div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ paddingTop: 14, borderTop: '1px solid var(--border2)' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Objetivo de la semana</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{userVsBlueprint.weeklyObjective}</div>
              </div>
            </Card>
            )}
          </PremiumGate>
        </>
      )}
    </div>
  )
}
