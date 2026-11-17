// Agente de resultados: solo las empresas que mueven de verdad el Nasdaq.
// Da el dato y el consenso, nunca adivina si saldrán bien o mal: una sorpresa
// en cualquier sentido mueve el NQ.
import type { Resultado } from '../sources/earnings.ts'
import type { Hallazgo } from '../tipos.ts'
import { diaAnterior } from '../tiempo.ts'

/** Peso aproximado en el Nasdaq 100: 3 = muy grande, 2 = grande. */
export const EMPRESAS_NQ: Record<string, { nombre: string; peso: 2 | 3 }> = {
  NVDA: { nombre: 'Nvidia', peso: 3 },
  AAPL: { nombre: 'Apple', peso: 3 },
  MSFT: { nombre: 'Microsoft', peso: 3 },
  AMZN: { nombre: 'Amazon', peso: 3 },
  META: { nombre: 'Meta', peso: 2 },
  GOOGL: { nombre: 'Alphabet (Google)', peso: 2 },
  GOOG: { nombre: 'Alphabet (Google)', peso: 2 },
  TSLA: { nombre: 'Tesla', peso: 2 },
  AVGO: { nombre: 'Broadcom', peso: 2 },
  NFLX: { nombre: 'Netflix', peso: 2 },
  COST: { nombre: 'Costco', peso: 2 },
  AMD: { nombre: 'AMD', peso: 2 },
}

const MOMENTO = { antes: 'antes de la apertura', despues: 'después del cierre de Wall Street', durante: 'durante la sesión', 'sin hora': 'sin hora confirmada' } as const

const dolar = (x: number) => `${x.toLocaleString('es-ES', { maximumFractionDigits: 2 })} $`

function comparar(r: Resultado): string {
  if (r.bpaReal === undefined || r.bpaEstimado === undefined) return ''
  const dif = r.bpaReal - r.bpaEstimado
  const como = Math.abs(dif) < 0.005 ? 'en línea con' : dif > 0 ? 'por encima de' : 'por debajo de'
  return ` Beneficio por acción ${dolar(r.bpaReal)}, ${como} lo esperado (${dolar(r.bpaEstimado)}).`
}

/**
 * Para la guía de la mañana (día de Nueva York `hoy`): quién presenta hoy y
 * quién presentó ayer después del cierre (puede abrir con hueco).
 */
export function agendaResultados(lista: Resultado[], hoy: string): Hallazgo[] {
  const ayer = diaAnterior(hoy)
  const vistos = new Set<string>()
  const out: Hallazgo[] = []
  for (const r of lista) {
    const emp = EMPRESAS_NQ[r.simbolo]
    if (!emp || vistos.has(emp.nombre)) continue
    const deAyer = r.fecha === ayer && r.momento === 'despues'
    if (r.fecha !== hoy && !deAyer) continue
    vistos.add(emp.nombre)
    const clave = `earnings:${r.simbolo}:${r.fecha}`
    if (deAyer) {
      out.push({ agente: 'earnings', nivel: emp.peso === 3 ? 'atencion' : 'info', titulo: `${emp.nombre} presentó resultados ayer tras el cierre.${comparar(r)} Puede haber hueco en la apertura del NQ.`, clave })
      continue
    }
    const consenso = r.bpaEstimado !== undefined ? ` El mercado espera un beneficio por acción de ${dolar(r.bpaEstimado)}.` : ''
    out.push({
      agente: 'earnings',
      nivel: emp.peso === 3 ? 'alerta' : 'atencion',
      titulo: `${emp.nombre} presenta resultados hoy ${MOMENTO[r.momento]}.${consenso}${comparar(r)} Una sorpresa, en cualquier sentido, puede mover el NQ con fuerza.`,
      clave,
    })
  }
  return out.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'alerta' ? -1 : 1))
}
