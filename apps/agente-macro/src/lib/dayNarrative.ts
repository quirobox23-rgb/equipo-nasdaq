import type { MacroEvent } from '@/types/macro'

// Composición de texto sobre eventos ya existentes — no interpreta datos,
// solo ordena nombres por relevancia. Igual que se explicó cuando se creó
// (Sprint "reorganización Eventos"): no es un motor nuevo.
export function buildDayNarrative(events: MacroEvent[]): string | null {
  const relevant = events.filter(e => e.impact !== 'low')
  if (relevant.length < 2) return null
  const names = relevant.map(e => e.name)
  if (names.length === 2) {
    return `${names[0]} marca la primera reacción del día. ${names[1]} terminará definiendo el sesgo final.`
  }
  const [first, ...rest] = names
  const last = rest.pop()!
  return `Los ${names.length} eventos deben interpretarse conjuntamente. ${first} marca la primera reacción. ${rest.join(', ')} puede${rest.length > 1 ? 'n' : ''} confirmar o invalidar esa reacción. ${last} terminará definiendo el sesgo final.`
}
