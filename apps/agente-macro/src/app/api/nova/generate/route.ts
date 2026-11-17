import { NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { isValidAdminPassword, getAdminPasswordFromRequest } from '@/lib/adminAuth'
import { redisSet } from '@/lib/redis'

const STORAGE_KEY = 'nova:weekly-briefing:latest'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const AGENTES_PROMPTS = {
  'NOVA-M101': {
    nombre: 'Macro Crecimiento',
    rol: 'Especialista en Crecimiento Económico',
    mision: 'Analizar la evolución del crecimiento económico para detectar cambios en el ciclo económico',
    indicadores: ['PIB', 'PMI Manufacturero', 'PMI Servicios', 'ISM', 'Ventas Minoristas', 'Producción Industrial', 'Confianza del Consumidor', 'Leading Indicators'],
    kpi: 'Identificar cambios de ciclo antes de que se reflejen plenamente en el mercado'
  },
  'NOVA-M102': {
    nombre: 'Macro Empleo',
    rol: 'Especialista en Mercado Laboral',
    mision: 'Analizar indicadores de empleo para evaluar la salud del mercado laboral',
    indicadores: ['Desempleo', 'Creación de Empleos', 'Participación Laboral', 'Salarios', 'Horas Trabajadas'],
    kpi: 'Detectar cambios en la dinámica laboral que anticipen cambios de política monetaria'
  },
  'NOVA-M103': {
    nombre: 'Macro Earnings',
    rol: 'Especialista en Resultados Empresariales',
    mision: 'Analizar la salud de las ganancias corporativas y márgenes empresariales',
    indicadores: ['Earnings por acción', 'Márgenes de ganancia', 'Guidance de empresas', 'Surprises de earnings', 'Rentabilidad sectorial'],
    kpi: 'Identificar cambios en rentabilidad corporativa antes de que se reflejen en valuaciones'
  },
  'NOVA-M104': {
    nombre: 'Macro FED',
    rol: 'Especialista en Política Monetaria',
    mision: 'Analizar la postura y decisiones de la Reserva Federal',
    indicadores: ['Tasas de interés', 'Comunicados FOMC', 'Dot plot', 'Balance sheet', 'Inflación vs objetivo'],
    kpi: 'Anticipar cambios en la postura de la Fed antes de que el mercado los precifique'
  },
  'NOVA-M105': {
    nombre: 'Macro Geopolítica',
    rol: 'Especialista en Riesgos Geopolíticos',
    mision: 'Monitorear y analizar riesgos geopolíticos que impacten mercados',
    indicadores: ['Tensiones comerciales', 'Conflictos armados', 'Sanciones', 'Políticas de trade', 'Estabilidad política'],
    kpi: 'Identificar riesgos geopolíticos antes de que causen disrupciones en mercados'
  },
  'NOVA-M106': {
    nombre: 'Macro Inflación',
    rol: 'Especialista en Precios e Inflación',
    mision: 'Analizar trayectoria de la inflación y factores que la impulsan',
    indicadores: ['CPI', 'PPI', 'Inflación Core', 'Expectativas de inflación', 'Precios de commodities'],
    kpi: 'Anticipar cambios en inflación que requieran reposicionamiento de cartera'
  },
  'NOVA-M107': {
    nombre: 'Macro Liquidez',
    rol: 'Especialista en Condiciones de Crédito',
    mision: 'Monitorear condiciones de liquidez y estrés en mercados de crédito',
    indicadores: ['Spreads de crédito', 'Volumen de trading', 'Oferta monetaria', 'Stress índices', 'Tasas overnight'],
    kpi: 'Detectar cambios en liquidez antes de que causen volatilidad en mercados'
  },
  'NOVA-M108': {
    nombre: 'Macro Renta Fija',
    rol: 'Especialista en Bonos y Curva de Rendimientos',
    mision: 'Analizar dinámicas de la curva de rendimientos y mercado de bonos',
    indicadores: ['Curva de rendimientos', 'Spreads de bonos corporativos', 'Duration', 'Inversiones en curva'],
    kpi: 'Identificar oportunidades en renta fija antes de cambios en la curva'
  }
}

async function ejecutarAgente(codigo: string, agente: any): Promise<any> {
  try {
    const prompt = `Eres ${agente.nombre} (${codigo}). 
Tu misión: ${agente.mision}
Analizas: ${agente.indicadores.join(', ')}
Tu KPI: ${agente.kpi}

Esta semana, evalúa la situación. Responde en JSON válido:
{
  "trend": "alcista|bajista|neutral",
  "confidence": 75,
  "summary": "Una frase breve del hallazgo principal",
  "analysis": "Párrafo de 3-4 frases con análisis detallado de indicadores",
  "risks": ["riesgo1", "riesgo2"],
  "implications": "Cómo esto impacta a mercados"
}`

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          agent: codigo,
          status: 'operational',
          trend: parsed.trend || 'neutral',
          confidence: parsed.confidence || 70,
          summary: parsed.summary || '',
          analysis: parsed.analysis || '',
          risks: parsed.risks || [],
          implications: parsed.implications || ''
        }
      }
    } catch (e) {
      const trendMatch = responseText.match(/trend["\s:]*([a-z]+)/i)
      const confMatch = responseText.match(/confidence["\s:]*(\d+)/i)
      return {
        agent: codigo,
        status: 'operational',
        trend: trendMatch ? trendMatch[1] : 'neutral',
        confidence: confMatch ? parseInt(confMatch[1]) : 65,
        summary: responseText.substring(0, 150),
        analysis: responseText,
        risks: [],
        implications: ''
      }
    }
  } catch (err) {
    console.error(`[NOVA] Error en ${codigo}:`, err)
    return {
      agent: codigo,
      status: 'error',
      trend: 'neutral',
      confidence: 0,
      summary: 'Error',
      analysis: '',
      risks: [],
      implications: ''
    }
  }
}

export async function POST(req: Request) {
  const password = getAdminPasswordFromRequest(req)
  if (!isValidAdminPassword(password)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    console.log('[NOVA] Iniciando generación de briefing con 8 agentes...')
    
    const agentResults = await Promise.all(
      Object.entries(AGENTES_PROMPTS).map(([codigo, config]) => 
        ejecutarAgente(codigo, config)
      )
    )

    console.log('[NOVA] Agentes completados:', agentResults.map(a => `${a.agent}: ${a.status}`).join(' | '))

    const successAgents = agentResults.filter(a => a.status === 'operational')
    const avgConfidence = successAgents.length > 0 
      ? Math.round(successAgents.reduce((sum, a) => sum + a.confidence, 0) / successAgents.length)
      : 50

    const alcistas = successAgents.filter(a => a.trend === 'alcista').length
    const bajistas = successAgents.filter(a => a.trend === 'bajista').length
    const neutrales = successAgents.length - alcistas - bajistas

    const trendGlobal = alcistas > bajistas ? 'alcista' : bajistas > alcistas ? 'bajista' : 'neutral'

    const narrativa = successAgents
      .map(a => `**${a.agent}** (${AGENTES_PROMPTS[a.agent as keyof typeof AGENTES_PROMPTS]?.nombre}): ${a.analysis}`)
      .join('\n\n')

    const todosRiesgos = successAgents.flatMap(a => a.risks || []).filter(Boolean)
    const implicaciones = successAgents
      .filter(a => a.implications)
      .map(a => a.implications)
      .join(' | ')

    const data = {
      agent_report: {
        agent: 'NOVA-M001',
        status: successAgents.length === Object.keys(AGENTES_PROMPTS).length ? 'operational' : 'degraded',
        trend: trendGlobal,
        confidence: avgConfidence,
        summary: `${successAgents.length}/8 agentes activos. Tendencia: ${trendGlobal.toUpperCase()}. Confianza: ${avgConfidence}%`
      },
      briefing: {
        narrativa_principal: narrativa || `Análisis de ${successAgents.length} agentes NOVA especializados`,
        tensiones_detectadas: [
          {
            agentes: 'Sistema NOVA Multi-Agentes',
            tension: 'Interconexiones entre ciclos económicos',
            resolucion: 'Monitoreo coordinado de indicadores clave'
          }
        ],
        escenario_base: {
          nombre: `Escenario Central ${trendGlobal.toUpperCase()}`,
          probabilidad: avgConfidence,
          justificacion: `Consenso de ${successAgents.length} agentes especializados. ${alcistas} alcistas, ${bajistas} bajistas, ${neutrales} neutrales`
        },
        escenarios_alternativos: [
          {
            nombre: 'Escenario de sorpresa contraria',
            probabilidad: 100 - avgConfidence,
            trigger: 'Datos económicos sorpresivos o cambios geopolíticos'
          }
        ],
        riesgos: {
          critico: todosRiesgos.slice(0, 3).map(r => ({
            descripcion: r,
            fuente: 'NOVA Multi-Agentes',
            trigger: 'Monitorear'
          })),
          moderado: todosRiesgos.slice(3, 6).map(r => ({
            descripcion: r,
            fuente: 'NOVA Multi-Agentes',
            trigger: 'Vigilancia'
          })),
          vigilar: todosRiesgos.slice(6).map(r => ({
            descripcion: r,
            fuente: 'NOVA Multi-Agentes',
            trigger: 'Seguimiento'
          }))
        },
        implicaciones: {
          entorno: implicaciones || `Mercados ${trendGlobal.toUpperCase()}. Confianza: ${avgConfidence}%`,
          activos_favorecidos: trendGlobal === 'alcista' ? ['NASDAQ', 'SPX', 'EUR'] : ['GOLD', 'USD', 'VIX', 'TLT'],
          eventos_clave: ['CPI', 'FOMC', 'Earnings', 'PMI', 'Desempleo', 'Conflictos Comerciales']
        },
        confidence: avgConfidence
      },
      agents: agentResults,
      weekly_card: null,
      generated_at: new Date().toISOString()
    }

    console.log('[NOVA] Guardando briefing en Redis...')
    await redisSet(STORAGE_KEY, data)
    console.log('[NOVA] Briefing completado y almacenado')

    return NextResponse.json(data)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[NOVA] Error fatal:', errorMessage)
    return NextResponse.json({ error: `Error: ${errorMessage}` }, { status: 500 })
  }
}