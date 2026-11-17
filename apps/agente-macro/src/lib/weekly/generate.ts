// Escribe el Análisis Semanal de NQ con UNA sola llamada a Claude, a partir
// de los datos reales de la semana (data.ts) y de los niveles que revisó
// el analista. Sustituye, para los alumnos, a los 8 agentes de Mentor IA.

import Anthropic from '@anthropic-ai/sdk'
import type { Level, WeeklyAnalysis, WeeklyData } from './types'
import { SYSTEM, SCHEMA, dataPrompt, parseAnalysis, toAnalysis, type Parsed } from './prompt'

const MODEL = 'claude-opus-5-5'

function textOf(content: { type: string; text?: string }[]): string {
  const block = content.find(b => b.type === 'text')
  if (!block?.text) throw new Error('La IA no devolvió el análisis.')
  return block.text
}

function checkStop(stop: string | null | undefined) {
  if (stop === 'refusal') throw new Error('La IA no pudo generar el análisis esta vez. Probá de nuevo.')
  if (stop === 'max_tokens') throw new Error('El análisis salió demasiado largo. Probá de nuevo.')
}

/**
 * Tres intentos, del mejor al más compatible: si la API rechaza la petición
 * (400/404: modelo o función no disponible para esta clave), se prueba la
 * siguiente forma. La última es la misma que ya usa Mentor IA.
 */
async function callClaude(prompt: string): Promise<Parsed> {
  const client = new Anthropic()
  const format = { type: 'json_schema' as const, schema: SCHEMA }
  const attempts: { name: string; run: () => Promise<Parsed> }[] = [
    {
      name: `${MODEL} + fallbacks`,
      run: async () => {
        const r = await client.beta.messages.create({
          model: MODEL, max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
          thinking: { type: 'adaptive' }, output_config: { effort: 'medium', format },
          system: SYSTEM, messages: [{ role: 'user', content: prompt }],
        })
        checkStop(r.stop_reason)
        return parseAnalysis(textOf(r.content))
      },
    },
    {
      name: MODEL,
      run: async () => {
        const r = await client.messages.create({
          model: MODEL, max_tokens: 16000,
          output_config: { effort: 'medium', format },
          system: SYSTEM, messages: [{ role: 'user', content: prompt }],
        })
        checkStop(r.stop_reason)
        return parseAnalysis(textOf(r.content))
      },
    },
    {
      name: 'claude-opus-4-6 (como Mentor IA)',
      run: async () => {
        const r = await client.messages.create({
          model: 'claude-opus-4-6', max_tokens: 16000,
          system: `${SYSTEM}\n\nResponde SOLO con un objeto JSON válido que cumpla este esquema, sin texto antes ni después:\n${JSON.stringify(SCHEMA)}`,
          messages: [{ role: 'user', content: prompt }],
        })
        checkStop(r.stop_reason)
        return parseAnalysis(textOf(r.content))
      },
    },
  ]

  let lastError: unknown = null
  for (const a of attempts) {
    try {
      return await a.run()
    } catch (err) {
      lastError = err
      const retryable = err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError
      console.error(`[weekly] Intento "${a.name}" falló:`, err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err)
      if (!retryable) throw err
    }
  }
  throw lastError
}

export async function generateAnalysis(data: WeeklyData, levels: Level[], notas: string): Promise<WeeklyAnalysis> {
  return toAnalysis(await callClaude(dataPrompt(data, levels, notas)), data, levels)
}
