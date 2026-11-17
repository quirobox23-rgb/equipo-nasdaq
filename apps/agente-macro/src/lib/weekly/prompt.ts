// Instrucciones y formato del Análisis Semanal de NQ. Las usa la llamada a
// la API (generate.ts) y también el botón "Copiar instrucciones" del editor,
// para generarlo en el chat de Claude sin gastar créditos de la API.

import type { Level, WeeklyAnalysis, WeeklyData } from './types'

export const SYSTEM = `Eres el analista de Equipo Nasdaq. Escribes el análisis semanal del Nasdaq (NQ) para los alumnos de la comunidad, en español neutro, claro y educativo: es una guía para entender los eventos y planificar escenarios, no una recomendación de inversión.

Reglas:
- Usa solo los datos que te doy. No inventes cifras, horarios, fechas ni resultados. Si falta un dato, dilo ("por verificar").
- Los niveles de NQ son los que te paso, tal cual: no cambies las zonas. Puedes mejorar la redacción de su lectura.
- Frases cortas y concretas, como para leer en el móvil. Nada de relleno.
- Las preguntas del calendario son preguntas educativas que el alumno debería hacerse ese día.
- Los ejemplos prácticos y los escenarios usan los niveles que te paso.
- La checklist tiene 4-6 preguntas que el alumno puede repasar antes de operar.`

export const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['idea_central', 'catalizadores', 'calendario', 'earnings', 'earnings_ejemplo', 'opex_vix',
    'macro', 'niveles', 'ejemplos', 'escenarios', 'lectura_por_dia', 'checklist', 'conclusion'],
  properties: {
    idea_central: { type: 'string', description: '2-3 frases: el contexto de la semana para NQ.' },
    catalizadores: {
      type: 'array', description: '3-5 catalizadores (earnings, OPEX, VIX, macro y bonos...).',
      items: { type: 'object', additionalProperties: false, required: ['catalizador', 'significado'],
        properties: { catalizador: { type: 'string' }, significado: { type: 'string' } } },
    },
    calendario: {
      type: 'array', description: 'Una fila por día de lunes a viernes. dia como "Lun 19".',
      items: { type: 'object', additionalProperties: false, required: ['dia', 'eventos', 'pregunta'],
        properties: { dia: { type: 'string' }, eventos: { type: 'string' }, pregunta: { type: 'string' } } },
    },
    earnings: {
      type: 'array', description: 'Las empresas que presentan esta semana y más mueven NQ (máximo 8).',
      items: { type: 'object', additionalProperties: false, required: ['empresa', 'observar', 'importancia'],
        properties: { empresa: { type: 'string' }, observar: { type: 'string' }, importancia: { type: 'string' } } },
    },
    earnings_ejemplo: { type: 'string', description: 'Un ejemplo breve de cómo leer unos resultados sin complicarse.' },
    opex_vix: { type: 'string', description: 'OPEX y vencimiento del VIX de esta semana explicados en 2-4 frases.' },
    macro: { type: 'string', description: 'Por qué importan esta semana las tasas y los datos macro, con los datos de bonos y VIX.' },
    niveles: {
      type: 'array', description: 'Los mismos niveles recibidos, en el mismo orden (de mayor a menor).',
      items: { type: 'object', additionalProperties: false, required: ['zona', 'lectura'],
        properties: { zona: { type: 'string' }, lectura: { type: 'string' } } },
    },
    ejemplos: {
      type: 'array', description: '3-4 ejemplos prácticos (rebote, rechazo, ruptura...).',
      items: { type: 'object', additionalProperties: false, required: ['titulo', 'texto'],
        properties: { titulo: { type: 'string' }, texto: { type: 'string' } } },
    },
    escenarios: {
      type: 'array', description: '3 escenarios: alcista, bajista y lateral.',
      items: { type: 'object', additionalProperties: false, required: ['escenario', 'condicion', 'referencias'],
        properties: { escenario: { type: 'string' }, condicion: { type: 'string' }, referencias: { type: 'string' } } },
    },
    lectura_por_dia: { type: 'string', description: 'Una frase por día de la semana.' },
    checklist: { type: 'array', items: { type: 'string' } },
    conclusion: { type: 'string', description: '2-3 frases de conclusión semanal.' },
  },
}

export function dataPrompt(data: WeeklyData, levels: Level[], notas: string): string {
  return [
    `Semana: ${data.semana} (lunes ${data.monday}). Horas en Nueva York (ET).`,
    '',
    'CALENDARIO MACRO (impacto alto y medio):',
    data.events.length
      ? data.events.map(e => `- ${e.date} ${e.time ?? ''} · ${e.name} (${e.impact === 'high' ? 'alto' : 'medio'})`).join('\n')
      : '- Sin datos todavía.',
    '',
    'EARNINGS DE EMPRESAS DEL NASDAQ 100 (bmo = antes de la apertura, amc = después del cierre):',
    data.earnings.length
      ? data.earnings.map(e => `- ${e.date} · ${e.symbol} ${e.hour || '(hora por confirmar)'}`).join('\n')
      : '- Sin datos.',
    '',
    `VENCIMIENTOS: OPEX mensual ${data.opex.mensual ?? 'no cae esta semana'}; OPEX semanal ${data.opex.semanal}; vencimiento VIX ${data.opex.vix ?? 'no cae esta semana'}.`,
    '',
    'BONOS Y VOLATILIDAD (FRED, último dato y cambio en 5 sesiones):',
    data.macro.map(m => `- ${m.nombre}: ${m.ultimo ?? 'sin dato'}${m.cambioSemana != null ? ` (${m.cambioSemana > 0 ? '+' : ''}${m.cambioSemana})` : ''}${m.fecha ? ` a ${m.fecha}` : ''}`).join('\n'),
    '',
    'NQ (Yahoo Finance, futuro continuo):',
    `- Último cierre: ${data.nq.precio ?? 'sin dato'}${data.nq.fecha ? ` (${data.nq.fecha})` : ''}`,
    data.nq.semanaAnterior
      ? `- Semana anterior: máximo ${data.nq.semanaAnterior.alto}, mínimo ${data.nq.semanaAnterior.bajo}, cierre ${data.nq.semanaAnterior.cierre}`
      : '- Semana anterior: sin dato',
    `- Rango semanal medio (8 semanas): ${data.nq.rangoMedioSemanal ?? 'sin dato'} puntos`,
    '',
    'NIVELES NQ REVISADOS POR EL ANALISTA (no cambies las zonas):',
    levels.map(l => `- ${l.zona}: ${l.lectura}`).join('\n'),
    notas.trim() ? `\nNOTAS DEL ANALISTA PARA ESTA SEMANA:\n${notas.trim()}` : '',
  ].join('\n')
}

export type Parsed = Omit<WeeklyAnalysis, 'semana' | 'monday' | 'generadoEn'>

/** Saca el análisis de la respuesta (con o sin ```json alrededor). */
export function parseAnalysis(text: string): Parsed {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('La respuesta no trae el análisis en el formato esperado.')
  const raw = JSON.parse(match[0]) as Partial<Parsed>
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const arr = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : [])
  return {
    idea_central: str(raw.idea_central),
    catalizadores: arr(raw.catalizadores),
    calendario: arr(raw.calendario),
    earnings: arr(raw.earnings),
    earnings_ejemplo: str(raw.earnings_ejemplo),
    opex_vix: str(raw.opex_vix),
    macro: str(raw.macro),
    niveles: arr(raw.niveles),
    ejemplos: arr(raw.ejemplos),
    escenarios: arr(raw.escenarios),
    lectura_por_dia: str(raw.lectura_por_dia),
    checklist: arr<string>(raw.checklist).filter(c => typeof c === 'string'),
    conclusion: str(raw.conclusion),
  }
}

/** Todo lo que hay que pegar en el chat de Claude para que devuelva el análisis. */
export function chatPrompt(data: WeeklyData, levels: Level[], notas: string): string {
  return [
    SYSTEM,
    '',
    'Escribe el análisis semanal de NQ con estos datos:',
    '',
    dataPrompt(data, levels, notas),
    '',
    'Responde SOLO con un objeto JSON válido que cumpla este esquema, sin texto antes ni después:',
    JSON.stringify(SCHEMA),
  ].join('\n')
}

/** Une la respuesta con los datos de la semana; las zonas de los niveles son siempre las del analista. */
export function toAnalysis(parsed: Parsed, data: WeeklyData, levels: Level[]): WeeklyAnalysis {
  const niveles = levels.length
    ? levels.map((l, i) => ({ zona: l.zona, lectura: parsed.niveles?.[i]?.lectura || l.lectura }))
    : parsed.niveles
  return { ...parsed, niveles, semana: data.semana, monday: data.monday, generadoEn: new Date().toISOString() }
}
