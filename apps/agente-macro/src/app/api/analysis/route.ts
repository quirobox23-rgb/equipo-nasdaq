import { NextRequest, NextResponse }              from 'next/server'
import { buildAnalysisPrompt, buildCombinedAnalysisPrompt } from '@/lib/engines/mentorEngine'
import type { MentorAnalysis }                    from '@/lib/engines/mentorEngine'
import type { KnowledgeEntry }                    from '@/lib/dataProvider/KnowledgeBase'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY no está configurada en .env.local' },
      { status: 500 },
    )
  }

  let body: {
    // Single event
    name?:     string
    prev?:     string | null
    forecast?: string | null
    actual?:   string | null
    notes?:    string | null
    impact?:   string
    knowledge?: KnowledgeEntry | null
    // Multi event
    events?: Array<{ name: string; prev?: string|null; forecast?: string|null; actual?: string|null; impact?: string; notes?: string|null; knowledge?: KnowledgeEntry | null }>
  }

  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Cuerpo de la petición inválido' }, { status: 400 }) }

  // Build prompt — single or combined
  let prompt: string
  if (body.events && body.events.length > 1) {
    prompt = buildCombinedAnalysisPrompt(body.events)
  } else if (body.name) {
    prompt = buildAnalysisPrompt({ name: body.name, prev: body.prev, forecast: body.forecast, actual: body.actual, notes: body.notes, impact: body.impact, knowledge: body.knowledge })
  } else {
    return NextResponse.json({ error: 'Se requiere name o events[]' }, { status: 400 })
  }

  let claudeRes: Response
  try {
    claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8192, messages: [{ role: 'user', content: prompt }] }),
    })
  } catch (err) {
    return NextResponse.json({ error: `Error conectando con Claude API: ${String(err)}` }, { status: 502 })
  }

  if (!claudeRes.ok) {
    const text = await claudeRes.text()
    return NextResponse.json({ error: `Claude API error ${claudeRes.status}: ${text}` }, { status: 502 })
  }

  const claudeData = await claudeRes.json()
  const stopReason: string = claudeData.stop_reason ?? ''
  const rawText: string    = claudeData.content?.[0]?.text ?? ''

  if (stopReason === 'max_tokens') {
    return NextResponse.json({ error: 'Respuesta de Claude cortada por límite de tokens. Inténtalo de nuevo.', raw: rawText }, { status: 500 })
  }

  let cleaned = rawText.trim()
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '')
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Claude no devolvió JSON válido', raw: rawText }, { status: 500 })
  }

  let analysis: MentorAnalysis
  try { analysis = JSON.parse(jsonMatch[0]) as MentorAnalysis }
  catch (e) { return NextResponse.json({ error: `Error parseando JSON: ${String(e)}`, raw: rawText }, { status: 500 }) }

  return NextResponse.json({ analysis })
}
