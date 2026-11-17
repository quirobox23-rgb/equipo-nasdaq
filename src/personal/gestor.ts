// Gestor de cuentas: vigila las reglas de las cuentas de fondeo y avisa
// "ojo con esta" antes de acercarte a un límite.
import { promises as fs } from 'node:fs'
import { config } from '../config.ts'
import { leer } from '../almacen.ts'
import type { Hallazgo } from '../tipos.ts'

export interface ReglasCuenta {
  nombre: string
  firma?: string
  /** challenge: pasando la evaluación. fondeada: ya aprobada. */
  fase?: 'challenge' | 'fondeada' | 'personal'
  tamano: number
  /** Pérdida máxima en un día, en dólares. */
  perdidaDiariaMax?: number
  /** Drawdown máximo total, en dólares. */
  drawdownMax: number
  /** trailing: se mueve con el máximo de saldo. estatico: fijo desde el saldo inicial. */
  tipoDrawdown: 'trailing' | 'estatico'
  /** En trailing, muchas firmas dejan de mover el límite cuando llega al saldo inicial. */
  trailingSeFrenaEnInicial?: boolean
  objetivo?: number
}

export interface EstadoCuenta {
  nombre: string
  saldo: number
  pnlHoy: number
  /** Saldo más alto alcanzado (para el drawdown trailing). */
  saldoMaximo?: number
  actualizado: string
}

export interface ProveedorCuentas { leer(): Promise<EstadoCuenta[]> }

/** Hoy: el estado lo actualizas tú por WhatsApp ("pnl cuenta1 -250") o en data/cuentas-estado.json. */
export const proveedorManual: ProveedorCuentas = {
  leer: () => leer<EstadoCuenta[]>('cuentas-estado', []),
}

export async function cargarReglas(): Promise<ReglasCuenta[]> {
  try {
    return JSON.parse(await fs.readFile(config.cuentasArchivo, 'utf-8')) as ReglasCuenta[]
  } catch {
    return []
  }
}

export interface Revision {
  nombre: string
  usoDiario?: number          // 0-1 de la pérdida diaria permitida
  margenDrawdown: number      // dólares hasta el límite total
  limite: number
  objetivoAlcanzado: boolean
}

export function revisarCuenta(r: ReglasCuenta, e: EstadoCuenta): Revision {
  let limite: number
  if (r.tipoDrawdown === 'estatico') {
    limite = r.tamano - r.drawdownMax
  } else {
    const maximo = Math.max(e.saldoMaximo ?? e.saldo, r.tamano, e.saldo)
    limite = maximo - r.drawdownMax
    if (r.trailingSeFrenaEnInicial) limite = Math.min(limite, r.tamano)
  }
  return {
    nombre: r.nombre,
    usoDiario: r.perdidaDiariaMax ? Math.max(0, -e.pnlHoy) / r.perdidaDiariaMax : undefined,
    margenDrawdown: e.saldo - limite,
    limite,
    objetivoAlcanzado: r.objetivo !== undefined && e.saldo - r.tamano >= r.objetivo,
  }
}

const usd = (n: number) => `${Math.round(n).toLocaleString('es-ES')} $`

/** "Tienes 5 cuentas activas: 3 fondeadas y 2 en challenge." */
export function resumenCuentas(reglas: ReglasCuenta[]): string {
  const n = reglas.length
  const cuantas = (f: ReglasCuenta['fase']) => reglas.filter(r => r.fase === f).length
  const partes = [
    cuantas('fondeada') && `${cuantas('fondeada')} ${cuantas('fondeada') === 1 ? 'fondeada' : 'fondeadas'}`,
    cuantas('challenge') && `${cuantas('challenge')} en challenge`,
    cuantas('personal') && `${cuantas('personal')} con capital propio`,
  ].filter(Boolean) as string[]
  const detalle = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0]
  return `Tienes ${n} ${n === 1 ? 'cuenta activa' : 'cuentas activas'}${detalle ? `: ${detalle}` : ''}.`
}

export function evaluarCuentas(reglas: ReglasCuenta[], estados: EstadoCuenta[]): Hallazgo[] {
  if (reglas.length === 0) {
    return [{ agente: 'cuentas', nivel: 'info', titulo: 'Aún no tengo las reglas de tus cuentas (config/cuentas.json).' }]
  }
  const out: Hallazgo[] = [{ agente: 'cuentas', nivel: 'info', titulo: resumenCuentas(reglas) }]
  for (const r of reglas) {
    const e = estados.find(x => x.nombre === r.nombre)
    if (!e) { out.push({ agente: 'cuentas', nivel: 'info', titulo: `${r.nombre}: sin datos de hoy.` }); continue }
    const rev = revisarCuenta(r, e)
    const dia = e.actualizado.slice(0, 10)
    if (rev.margenDrawdown <= 0) {
      out.push({ agente: 'cuentas', nivel: 'alerta', titulo: `${r.nombre}: has tocado el límite de drawdown (${usd(rev.limite)}). Revisa la cuenta con tu firma.`, clave: `dd:${r.nombre}:${dia}` })
      continue
    }
    if (r.perdidaDiariaMax && rev.margenDrawdown < r.perdidaDiariaMax) {
      out.push({ agente: 'cuentas', nivel: 'alerta', titulo: `Ojo con ${r.nombre}: solo te quedan ${usd(rev.margenDrawdown)} hasta el drawdown máximo.`, clave: `dd-cerca:${r.nombre}:${dia}` })
    }
    if (rev.usoDiario !== undefined && rev.usoDiario >= 0.8) {
      out.push({ agente: 'cuentas', nivel: 'alerta', titulo: `Ojo con ${r.nombre}: llevas el ${Math.round(rev.usoDiario * 100)}% de la pérdida diaria. Para por hoy.`, clave: `diaria80:${r.nombre}:${dia}` })
    } else if (rev.usoDiario !== undefined && rev.usoDiario >= 0.5) {
      out.push({ agente: 'cuentas', nivel: 'atencion', titulo: `${r.nombre}: llevas el ${Math.round(rev.usoDiario * 100)}% de la pérdida diaria.`, clave: `diaria50:${r.nombre}:${dia}` })
    }
    if (rev.objetivoAlcanzado) {
      out.push({ agente: 'cuentas', nivel: 'info', titulo: `${r.nombre}: objetivo alcanzado. Protege lo ganado.`, clave: `objetivo:${r.nombre}` })
    }
    if (!out.some(h => h.titulo.includes(r.nombre))) {
      out.push({ agente: 'cuentas', nivel: 'info', titulo: `${r.nombre}: hoy ${usd(e.pnlHoy)}, margen hasta el drawdown ${usd(rev.margenDrawdown)}.` })
    }
  }
  return out
}

/** "pnl cuenta1 -250" o "pnl cuenta1 -250 saldo 49750" → actualización. */
export function interpretarComandoPnl(texto: string): { nombre: string; pnlHoy: number; saldo?: number } | null {
  const m = texto.trim().match(/^pnl\s+(\S+)\s+([+-]?\d+(?:[.,]\d+)?)(?:\s+saldo\s+(\d+(?:[.,]\d+)?))?$/i)
  if (!m) return null
  return {
    nombre: m[1],
    pnlHoy: Number(m[2].replace(',', '.')),
    saldo: m[3] ? Number(m[3].replace(',', '.')) : undefined,
  }
}
