'use client'

import { useState, useEffect, useCallback } from 'react'
import { getStoredAdminPassword, clearStoredAdminPassword } from '@/lib/adminSession'

interface Agent {
  agent: string
  status: string
  trend: string
  confidence: number
  summary: string
}

interface NovaResponse {
  agents?: Agent[]
}

// MAPEO: Agentes → Códigos NOVA
const AGENT_CODES: Record<string, string> = {
  'Macro Crecimiento': 'NOVA-M101',
  'Macro Empleo': 'NOVA-M102',
  'Macro Inflacion': 'NOVA-M103',
  'Macro Comodities': 'NOVA-M104',
  'Macro Geopolitica': 'NOVA-M105',
  'Macro Ciclo Economico': 'NOVA-M106',
  'Macro Volatilidad': 'NOVA-M107',
  'Macro Tail Risk': 'NOVA-M108',
}

function AgentCard({ agent }: { agent: Agent }) {
  const code = AGENT_CODES[agent.agent] || 'NOVA-M???'
  const trend = agent.trend.toLowerCase()
  
  // Determinar color del borde
  let borderColor = 'border-base-muted/30' // neutral (naranja/gris)
  let bgColor = 'bg-base-panel2/20'
  
  if (trend.includes('alcista') || trend.includes('bull')) {
    borderColor = 'border-pos/50' // verde
    bgColor = 'bg-pos/5'
  } else if (trend.includes('bajista') || trend.includes('bear')) {
    borderColor = 'border-neg/50' // rojo
    bgColor = 'bg-neg/5'
  } else {
    borderColor = 'border-neutral/40' // naranja/alerta
    bgColor = 'bg-neutral/5'
  }

  return (
    <div className={`${bgColor} border-l-4 ${borderColor} border rounded-lg p-5 hover:border-opacity-100 transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[11px] text-base-muted uppercase tracking-widest font-semibold mb-1">
            {code}
          </p>
          <p className="text-sm font-bold text-base-text">
            {agent.agent.replace('Macro ', '')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-base-muted">{agent.status}</p>
          <p className="text-xs font-mono font-bold text-brand mt-1">{agent.confidence}%</p>
        </div>
      </div>

      {/* Trend */}
      <div className={`text-xs font-bold mb-4 ${
        trend.includes('alcista') ? 'text-pos' : 
        trend.includes('bajista') ? 'text-neg' : 
        'text-neutral'
      }`}>
        {agent.trend}
      </div>

      {/* Summary */}
      <p className="text-sm leading-relaxed text-base-text/90">
        {agent.summary}
      </p>
    </div>
  )
}

export default function MacroPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const password = getStoredAdminPassword()
    if (!password) {
      setError('Sin acceso. Ve a Mentor IA primero.')
      setLoading(false)
      return
    }

    fetch('/api/nova/latest', { headers: { 'x-admin-password': password } })
      .then(async res => {
        if (res.status === 401) {
          clearStoredAdminPassword()
          throw new Error('Acceso denegado')
        }
        if (!res.ok) throw new Error('Error al cargar')
        return res.json()
      })
      .then((data: NovaResponse) => {
        setAgents(data.agents || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse mx-auto mb-3" />
          <p className="text-base-muted text-sm">Cargando análisis macro…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <p className="text-base-text text-sm mb-2">⚠ {error}</p>
        <p className="text-base-muted text-xs">Inicia sesión en <a href="/mentor-ia" className="text-brand hover:underline">Mentor IA</a> primero.</p>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <p className="text-base-text text-sm">No hay análisis disponible aún.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-base-line pb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="section-title">Análisis Macro</span>
        </div>
        <h1 className="text-2xl font-display font-bold text-base-text tracking-tight">8 Agentes Especializados</h1>
        <p className="text-xs text-base-muted mt-2">Análisis en tiempo real de cada componente macro</p>
      </div>

      {/* Grid de 8 cajas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {agents.map((agent, i) => (
          <AgentCard key={i} agent={agent} />
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-base-muted pt-4 border-t border-base-line">
        Análisis macro en tiempo real — No es consejo de inversión
      </div>
    </div>
  )
}