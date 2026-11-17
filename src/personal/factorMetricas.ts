// Lee tus cuentas y operaciones de Factor Métricas (tu app de métricas, en
// Supabase) en modo solo lectura, con tu propio usuario: la seguridad de
// Supabase (RLS) solo deja ver tus filas. Calcula el drawdown igual que
// src/config/drawdownEngine.js de Factor Métricas, para que los números
// coincidan con los que ves en la app.
import { config } from '../config.ts'
import { claveDia } from '../tiempo.ts'
import type { EstadoCuenta, ReglasCuenta } from './gestor.ts'

interface FilaCuenta { id: string; name: string; status?: string; initial_capital?: number; drawdown_type?: string; data?: Record<string, unknown> }
interface FilaTrade { account_id: string | null; date: string | null; dollar_pnl: number | null; r_pnl: number | null }

export interface CuentaFM {
  id: string
  nombre: string
  firma?: string
  tamano: number
  maxDrawdownPct: number
  maxDiarioPct?: number
  objetivoPct?: number
  tipo: 'static' | 'trailing_eod'
  riesgoPorTrade: number
  activa: boolean
}

const num = (v: unknown): number | undefined => {
  const n = Number(v)
  return Number.isFinite(n) && n !== 0 ? n : undefined
}

export function leerCuenta(f: FilaCuenta): CuentaFM {
  const d = f.data ?? {}
  return {
    id: f.id,
    nombre: String(d.name ?? f.name),
    firma: typeof d.broker === 'string' ? d.broker : typeof d.firm === 'string' ? d.firm : undefined,
    tamano: num(d.size) ?? num(f.initial_capital) ?? 0,
    maxDrawdownPct: num(d.maxDrawdown) ?? 0,
    maxDiarioPct: num(d.maxDailyDD),
    objetivoPct: num(d.profitTarget),
    tipo: (d.drawdownType ?? f.drawdown_type) === 'static' ? 'static' : 'trailing_eod',
    riesgoPorTrade: num(d.riskPerTrade) ?? 100,
    activa: (d.status ?? f.status ?? 'active') === 'active',
  }
}

/** Mismo criterio que tradeDollar() de Factor Métricas: $ si lo hay; si no, R × riesgo por operación. */
export function dolares(t: FilaTrade, riesgo: number): number {
  const d = Number(t.dollar_pnl)
  if (Number.isFinite(d) && d !== 0) return d
  const r = Number(t.r_pnl)
  return Number.isFinite(r) && r !== 0 ? r * riesgo : 0
}

/** Reglas y estado de hoy de cada cuenta activa, a partir de sus operaciones. */
export function calcular(cuentas: CuentaFM[], trades: FilaTrade[], ahora: Date): { reglas: ReglasCuenta[]; estados: EstadoCuenta[] } {
  const hoy = claveDia(ahora, config.tzUsuaria)
  const reglas: ReglasCuenta[] = []
  const estados: EstadoCuenta[] = []
  for (const c of cuentas.filter(c => c.activa && c.tamano > 0)) {
    const propios = trades.filter(t => t.account_id === c.id && t.date).sort((a, b) => a.date!.localeCompare(b.date!))
    // Balance de cierre por día (como buildDailyClosingBalances)
    const cierres = new Map<string, number>()
    let saldo = c.tamano
    for (const t of propios) { saldo += dolares(t, c.riesgoPorTrade); cierres.set(t.date!, saldo) }
    const maxCierre = Math.max(c.tamano, ...cierres.values())
    const pnlHoy = propios.filter(t => t.date === hoy).reduce((s, t) => s + dolares(t, c.riesgoPorTrade), 0)
    reglas.push({
      nombre: c.nombre,
      firma: c.firma,
      tamano: c.tamano,
      perdidaDiariaMax: c.maxDiarioPct ? (c.tamano * c.maxDiarioPct) / 100 : undefined,
      drawdownMax: (c.tamano * c.maxDrawdownPct) / 100,
      tipoDrawdown: c.tipo === 'static' ? 'estatico' : 'trailing',
      objetivo: c.objetivoPct ? (c.tamano * c.objetivoPct) / 100 : undefined,
    })
    estados.push({
      nombre: c.nombre,
      saldo: Math.round(saldo * 100) / 100,
      pnlHoy: Math.round(pnlHoy * 100) / 100,
      saldoMaximo: maxCierre,
      actualizado: ahora.toISOString(),
    })
  }
  return { reglas, estados }
}

export function configurado(): boolean {
  const f = config.factorMetricas
  return Boolean(f.url && f.anonKey && f.email && f.password)
}

async function token(): Promise<string> {
  const f = config.factorMetricas
  const r = await fetch(`${f.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: f.anonKey!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: f.email, password: f.password }),
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) throw new Error(`Factor Métricas no aceptó el inicio de sesión (${r.status}). Revisa FACTOR_METRICAS_EMAIL y FACTOR_METRICAS_PASSWORD.`)
  return ((await r.json()) as { access_token: string }).access_token
}

async function leerTabla<T>(tabla: string, select: string, jwt: string): Promise<T[]> {
  const f = config.factorMetricas
  const filas: T[] = []
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${f.url}/rest/v1/${tabla}?select=${select}`, {
      headers: { apikey: f.anonKey!, Authorization: `Bearer ${jwt}`, Range: `${desde}-${desde + 999}` },
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) throw new Error(`Factor Métricas: no se pudo leer ${tabla} (${r.status})`)
    const pagina = (await r.json()) as T[]
    filas.push(...pagina)
    if (pagina.length < 1000) return filas
  }
}

export async function leerFactorMetricas(ahora = new Date()) {
  const jwt = await token()
  const [cuentas, trades] = await Promise.all([
    leerTabla<FilaCuenta>('accounts', 'id,name,status,initial_capital,drawdown_type,data', jwt),
    leerTabla<FilaTrade>('trades', 'account_id,date,dollar_pnl,r_pnl', jwt),
  ])
  return calcular(cuentas.map(leerCuenta), trades, ahora)
}
