// Motor de backtesting del setup de lola en NQ/MNQ:
//   1) Nivel = máximo (compra) o mínimo (venta) de giro anterior en M15.
//   2) Zona fresca: antes de romperse, el nivel no se ha probado varias veces.
//   3) Disparo: una vela M15 entera por encima del máximo (O, H, L y C; su
//      mínimo ya por encima) o entera por debajo del mínimo.
//   4) Entrada límite en el retroceso Fibonacci del impulso (0,71–0,79).
//   5) SL y TP fijos en dólares, sin break-even ni cierres a mano.
//   6) Si la primera operación del día es pérdida, el día se cierra.
// El SL y el TP se resuelven con las velas base (ticks o 1 minuto) para saber
// cuál se tocó antes. Si los dos caen en la misma vela base, cuenta lo que diga
// `ambiguo` (por defecto SL, lo prudente).
import { agrupar, desfase, enNY, ZONAS, type Vela, type VelaAgrupada } from './velas.ts'

export type Instrumento = 'NQ' | 'MNQ'
export const VALOR_PUNTO: Record<Instrumento, number> = { NQ: 20, MNQ: 2 }
const TICK = 0.25

export interface Ajustes {
  instrumento: Instrumento
  contratos: number
  slUsd: number
  tpUsd: number
  /** Nivel del retroceso donde va la orden límite (0,75 = mitad de la zona 0,71–0,79). */
  fibo: number
  /** Velas a cada lado para que un máximo o mínimo cuente como giro. */
  pivote: number
  /** Toques previos permitidos para que la zona siga siendo fresca. */
  maxToques: number
  /** Puntos de margen para contar un toque. */
  toleranciaPts: number
  /** Velas M15 que vive un nivel sin romperse (96 = un día). */
  vidaNivel: number
  /** Velas M15 que espera la orden límite antes de cancelarse. */
  caducidad: number
  /** Ventana de operativa en hora de Nueva York. Al final se cierra lo que quede abierto. */
  sesionInicio: string
  sesionFin: string
  primeraPerdidaCierra: boolean
  maxOpsDia: number
  direccion: 'ambas' | 'largos' | 'cortos'
  /** Comisiones por operación completa, en dólares. */
  comisionUsd: number
  ambiguo: 'sl' | 'tp'
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  instrumento: 'MNQ', contratos: 4, slUsd: 240, tpUsd: 440, fibo: 0.75,
  pivote: 2, maxToques: 1, toleranciaPts: 2, vidaNivel: 96, caducidad: 8,
  sesionInicio: '09:30', sesionFin: '16:00', primeraPerdidaCierra: true, maxOpsDia: 2,
  direccion: 'ambas', comisionUsd: 0, ambiguo: 'sl',
}

export function completarAjustes(a: Partial<Ajustes> | undefined): Ajustes {
  const x = { ...AJUSTES_POR_DEFECTO, ...(a ?? {}) }
  if (!(x.instrumento in VALOR_PUNTO)) x.instrumento = 'MNQ'
  for (const k of ['contratos', 'slUsd', 'tpUsd', 'fibo', 'pivote', 'maxToques', 'toleranciaPts', 'vidaNivel', 'caducidad', 'maxOpsDia', 'comisionUsd'] as const) {
    const n = Number(x[k])
    ;(x as Record<string, unknown>)[k] = Number.isFinite(n) ? n : AJUSTES_POR_DEFECTO[k]
  }
  x.contratos = Math.max(1, Math.round(x.contratos))
  x.pivote = Math.max(1, Math.round(x.pivote))
  x.fibo = Math.min(0.99, Math.max(0.1, x.fibo))
  return x
}

/** Puntos de SL y TP para los dólares fijos, redondeados al tick de 0,25. */
export function puntos(a: Ajustes): { sl: number; tp: number } {
  const porPunto = VALOR_PUNTO[a.instrumento] * a.contratos
  const r = (usd: number) => Math.max(TICK, Math.round(usd / porPunto / TICK) * TICK)
  return { sl: r(a.slUsd), tp: r(a.tpUsd) }
}

export interface Setup {
  lado: 'largo' | 'corto'
  /** Vela M15 que dispara (índice y hora de inicio). */
  i: number
  t: number
  nivel: number
  toques: number
  /** Extremos del impulso: origen (Fibo 1) y extremo (Fibo 0). */
  origen: number
  extremo: number
}

const aMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0) }

/** Todos los disparos del setup en las velas M15 (no depende de las operaciones). */
export function detectarSetups(m15: Vela[], a: Ajustes): Setup[] {
  const out: Setup[] = []
  const N = a.pivote
  type Nivel = { precio: number; i: number; toques: number; lado: 'largo' | 'corto' }
  let niveles: Nivel[] = []
  for (let i = 0; i < m15.length; i++) {
    // Giro confirmado en j = i - N (hacen falta N velas después).
    const j = i - N
    if (j >= N) {
      let alto = true, bajo = true
      for (let k = 1; k <= N; k++) {
        if (!(m15[j].h > m15[j - k].h && m15[j].h >= m15[j + k].h)) alto = false
        if (!(m15[j].l < m15[j - k].l && m15[j].l <= m15[j + k].l)) bajo = false
      }
      if (alto) niveles.push({ precio: m15[j].h, i: j, toques: 0, lado: 'largo' })
      if (bajo) niveles.push({ precio: m15[j].l, i: j, toques: 0, lado: 'corto' })
    }
    const x = m15[i]
    const disparos: Nivel[] = []
    const siguen: Nivel[] = []
    for (const n of niveles) {
      if (i - n.i > a.vidaNivel) continue
      if (n.i + N >= i) { siguen.push(n); continue } // aún no confirmado al cerrar esta vela
      if (n.lado === 'largo') {
        if (x.l > n.precio) { disparos.push(n); continue }
        if (x.h >= n.precio - a.toleranciaPts && x.c <= n.precio) n.toques++
        if (x.c > n.precio && x.l <= n.precio) { siguen.push(n); continue } // lo cruza sin quedar entera encima: aún no
      } else {
        if (x.h < n.precio) { disparos.push(n); continue }
        if (x.l <= n.precio + a.toleranciaPts && x.c >= n.precio) n.toques++
      }
      siguen.push(n)
    }
    niveles = siguen
    for (const lado of ['largo', 'corto'] as const) {
      if (a.direccion === 'largos' && lado === 'corto') continue
      if (a.direccion === 'cortos' && lado === 'largo') continue
      const cand = disparos.filter(n => n.lado === lado && n.toques <= a.maxToques)
      if (!cand.length) continue
      // El nivel más exigente (el más alto que rompe en compra, el más bajo en venta).
      const n = cand.sort((p, q) => lado === 'largo' ? q.precio - p.precio : p.precio - q.precio)[0]
      let origen = lado === 'largo' ? Infinity : -Infinity
      for (let k = n.i; k <= i; k++) origen = lado === 'largo' ? Math.min(origen, m15[k].l) : Math.max(origen, m15[k].h)
      const extremo = lado === 'largo' ? x.h : x.l
      if (Math.abs(extremo - origen) < TICK * 4) continue
      out.push({ lado, i, t: x.t, nivel: n.precio, toques: n.toques, origen, extremo })
    }
  }
  return out
}

export interface Operacion {
  lado: 'largo' | 'corto'
  dia: string
  setup: number // hora del disparo
  nivel: number
  toques: number
  origen: number
  extremo: number
  entradaT: number
  entrada: number
  sl: number
  tp: number
  salidaT: number
  salida: number
  motivo: 'tp' | 'sl' | 'cierre'
  ambigua: boolean
  usd: number
  puntos: number
}

export interface Simulacion {
  ajustes: Ajustes
  puntos: { sl: number; tp: number }
  setups: number
  sinLlenar: number
  saltadosDia: number
  operaciones: Operacion[]
}

/** Recorre los disparos en orden y simula cada orden con las velas base. */
export function simular(base: Vela[], ajustesParciales?: Partial<Ajustes>): Simulacion {
  const a = completarAjustes(ajustesParciales)
  const pts = puntos(a)
  const m15 = agrupar(base, 900)
  const setups = detectarSetups(m15, a)
  const ini = aMin(a.sesionInicio), fin = aMin(a.sesionFin)
  const ops: Operacion[] = []
  let ocupadoHasta = -Infinity
  let sinLlenar = 0, saltadosDia = 0
  const diaInfo = new Map<string, { n: number; cerrado: boolean }>()

  for (const s of setups) {
    const cierreVela = m15[s.i].t + 900_000
    if (cierreVela < ocupadoHasta) continue
    const ny = enNY(cierreVela)
    if (ny.min < ini || ny.min >= fin) continue
    const d = diaInfo.get(ny.dia) ?? { n: 0, cerrado: false }
    if (d.cerrado || d.n >= a.maxOpsDia) { saltadosDia++; continue }
    const r = ejecutar(base, m15, s, a, pts, fin)
    ocupadoHasta = r.hasta
    if (!r.op) { sinLlenar++; continue }
    ops.push(r.op)
    d.n++
    if (a.primeraPerdidaCierra && d.n === 1 && r.op.usd < 0) d.cerrado = true
    diaInfo.set(ny.dia, d)
  }
  return { ajustes: a, puntos: pts, setups: setups.length, sinLlenar, saltadosDia, operaciones: ops }
}

function ejecutar(base: Vela[], m15: VelaAgrupada[], s: Setup, a: Ajustes, pts: { sl: number; tp: number }, finMin: number): { op: Operacion | null; hasta: number } {
  const largo = s.lado === 'largo'
  const dir = largo ? 1 : -1
  let extremo = s.extremo
  const nivelFibo = () => {
    const p = extremo - dir * a.fibo * Math.abs(extremo - s.origen)
    return Math.round(p / TICK) * TICK
  }
  let entrada = nivelFibo()
  const desde = m15[s.i].hasta + 1
  const limite = m15[Math.min(m15.length - 1, s.i + a.caducidad)]?.hasta ?? base.length - 1
  const diaSetup = enNY(m15[s.i].t + 900_000).dia
  let k = desde
  // 1) Esperar a que el precio vuelva a la entrada.
  for (; k < base.length && k <= limite; k++) {
    const x = base[k]
    const ny = enNY(x.t)
    if (ny.dia !== diaSetup || ny.min >= finMin) return { op: null, hasta: x.t }
    const toca = largo ? x.l <= entrada : x.h >= entrada
    if (toca) break
    if (largo ? x.h > extremo : x.l < extremo) { extremo = largo ? x.h : x.l; entrada = nivelFibo() }
  }
  if (k >= base.length || k > limite) return { op: null, hasta: base[Math.min(k, base.length - 1)]?.t ?? Infinity }
  const xf = base[k]
  const precioEntrada = largo ? Math.min(entrada, xf.o) : Math.max(entrada, xf.o) // si abre más allá, entra a la apertura
  const sl = precioEntrada - dir * pts.sl
  const tp = precioEntrada + dir * pts.tp
  const op = (salidaT: number, salida: number, motivo: Operacion['motivo'], ambigua = false): Operacion => {
    const p = (salida - precioEntrada) * dir
    return {
      lado: s.lado, dia: diaSetup, setup: s.t, nivel: s.nivel, toques: s.toques, origen: s.origen, extremo,
      entradaT: xf.t, entrada: precioEntrada, sl, tp, salidaT, salida, motivo, ambigua,
      puntos: p, usd: Math.round((p * VALOR_PUNTO[a.instrumento] * a.contratos - a.comisionUsd) * 100) / 100,
    }
  }
  // 2) En la misma vela de la entrada solo se mira el SL (no se sabe si el máximo fue antes).
  if (largo ? xf.l <= sl : xf.h >= sl) return { op: op(xf.t, sl, 'sl'), hasta: xf.t }
  if (xf.c !== xf.o || xf.h !== xf.l) {
    // Si la vela base cierra más allá del TP después de llenar, el TP también se tocó.
    if (largo ? xf.c >= tp : xf.c <= tp) return { op: op(xf.t, tp, 'tp'), hasta: xf.t }
  }
  // 3) Hasta TP, SL o fin de sesión.
  let previa = xf
  for (let j = k + 1; j < base.length; j++) {
    const x = base[j]
    const ny = enNY(x.t)
    if (ny.dia !== diaSetup || ny.min >= finMin) return { op: op(previa.t, previa.c, 'cierre'), hasta: previa.t }
    const tocaSl = largo ? x.l <= sl : x.h >= sl
    const tocaTp = largo ? x.h >= tp : x.l <= tp
    if (tocaSl && tocaTp) {
      // Si abre ya más allá de uno de los dos, ese fue el primero.
      if (largo ? x.o <= sl : x.o >= sl) return { op: op(x.t, x.o, 'sl'), hasta: x.t }
      if (largo ? x.o >= tp : x.o <= tp) return { op: op(x.t, tp, 'tp'), hasta: x.t }
      return a.ambiguo === 'tp' ? { op: op(x.t, tp, 'tp', true), hasta: x.t } : { op: op(x.t, sl, 'sl', true), hasta: x.t }
    }
    if (tocaSl) return { op: op(x.t, largo ? Math.min(sl, x.o) : Math.max(sl, x.o), 'sl'), hasta: x.t }
    if (tocaTp) return { op: op(x.t, tp, 'tp'), hasta: x.t }
    previa = x
  }
  return { op: op(previa.t, previa.c, 'cierre'), hasta: previa.t }
}

// ───────── Estadísticas ─────────

export interface Estadisticas {
  operaciones: number
  ganadas: number
  perdidas: number
  cierres: number
  ambiguas: number
  acierto: number
  pnl: number
  esperanza: number
  profitFactor: number | null
  maxDrawdown: number
  rachaPerdidas: number
  diasOperados: number
  mejorDia: { dia: string; usd: number } | null
  peorDia: { dia: string; usd: number } | null
  /** Por media hora de entrada, en hora de España. */
  porHora: { hora: string; n: number; acierto: number; usd: number }[]
  porDiaSemana: { dia: string; n: number; acierto: number; usd: number }[]
  porLado: { lado: string; n: number; acierto: number; usd: number }[]
  porVolatilidad: { regimen: 'baja' | 'media' | 'alta'; n: number; acierto: number; usd: number }[]
  curva: { t: number; usd: number }[]
  desde: string | null
  hasta: string | null
}

/** Minutos desde medianoche en hora de España (lola piensa en su hora). */
function minutosMadrid(t: number): number {
  const d = new Date(t + desfase(ZONAS.madrid, t) * 60_000)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

const SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function grupo(ops: Operacion[]) {
  const n = ops.length
  return { n, acierto: n ? Math.round(ops.filter(o => o.usd > 0).length / n * 1000) / 10 : 0, usd: Math.round(ops.reduce((s, o) => s + o.usd, 0)) }
}

/** Rango de la sesión anterior de cada día, para cruzar el backtest con la volatilidad (Contexto). */
export function rangosPrevios(base: Vela[], a: Ajustes = AJUSTES_POR_DEFECTO): Map<string, number> {
  const ini = aMin(a.sesionInicio), fin = aMin(a.sesionFin)
  const rango = new Map<string, { h: number; l: number }>()
  for (const x of base) {
    const ny = enNY(x.t)
    if (ny.min < ini || ny.min >= fin) continue
    const r = rango.get(ny.dia)
    if (r) { r.h = Math.max(r.h, x.h); r.l = Math.min(r.l, x.l) } else rango.set(ny.dia, { h: x.h, l: x.l })
  }
  const dias = [...rango.keys()].sort()
  const previo = new Map<string, number>()
  for (let i = 1; i < dias.length; i++) { const r = rango.get(dias[i - 1])!; previo.set(dias[i], r.h - r.l) }
  return previo
}

export function estadisticas(ops: Operacion[], previos?: Map<string, number>): Estadisticas {
  const n = ops.length
  const ganadas = ops.filter(o => o.usd > 0)
  const perdidas = ops.filter(o => o.usd < 0)
  const bruto = ganadas.reduce((s, o) => s + o.usd, 0)
  const malo = -perdidas.reduce((s, o) => s + o.usd, 0)
  let acc = 0, pico = 0, dd = 0, racha = 0, peorRacha = 0
  const curva: { t: number; usd: number }[] = []
  for (const o of ops) {
    acc += o.usd
    pico = Math.max(pico, acc)
    dd = Math.max(dd, pico - acc)
    racha = o.usd < 0 ? racha + 1 : 0
    peorRacha = Math.max(peorRacha, racha)
    curva.push({ t: o.salidaT, usd: Math.round(acc) })
  }
  const porDia = new Map<string, number>()
  for (const o of ops) porDia.set(o.dia, (porDia.get(o.dia) ?? 0) + o.usd)
  const dias = [...porDia].sort((x, y) => y[1] - x[1])
  const porClave = <K extends string>(f: (o: Operacion) => K, orden: K[]) => orden.map(k => ({ k, ...grupo(ops.filter(o => f(o) === k)) })).filter(x => x.n)

  let porVolatilidad: Estadisticas['porVolatilidad'] = []
  if (previos && previos.size >= 9) {
    const valores = [...previos.values()].sort((p, q) => p - q)
    const t1 = valores[Math.floor(valores.length / 3)], t2 = valores[Math.floor(valores.length * 2 / 3)]
    const reg = (o: Operacion): 'baja' | 'media' | 'alta' | 'x' => {
      const r = previos.get(o.dia)
      return r === undefined ? 'x' : r < t1 ? 'baja' : r < t2 ? 'media' : 'alta'
    }
    porVolatilidad = porClave(reg, ['baja', 'media', 'alta'] as ('baja' | 'media' | 'alta' | 'x')[]).filter(x => x.k !== 'x').map(({ k, ...r }) => ({ regimen: k as 'baja' | 'media' | 'alta', ...r }))
  }

  return {
    operaciones: n,
    ganadas: ganadas.length,
    perdidas: perdidas.length,
    cierres: ops.filter(o => o.motivo === 'cierre').length,
    ambiguas: ops.filter(o => o.ambigua).length,
    acierto: n ? Math.round(ganadas.length / n * 1000) / 10 : 0,
    pnl: Math.round(acc),
    esperanza: n ? Math.round(acc / n) : 0,
    profitFactor: malo > 0 ? Math.round(bruto / malo * 100) / 100 : null,
    maxDrawdown: Math.round(dd),
    rachaPerdidas: peorRacha,
    diasOperados: porDia.size,
    mejorDia: dias.length ? { dia: dias[0][0], usd: Math.round(dias[0][1]) } : null,
    peorDia: dias.length ? { dia: dias[dias.length - 1][0], usd: Math.round(dias[dias.length - 1][1]) } : null,
    porHora: porClave(o => { const m = minutosMadrid(o.entradaT); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${m % 60 < 30 ? '00' : '30'}` },
      Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)).map(({ k, ...r }) => ({ hora: k, ...r })),
    porDiaSemana: porClave(o => SEMANA[enNY(o.entradaT).semana], SEMANA).map(({ k, ...r }) => ({ dia: k, ...r })),
    porLado: porClave(o => o.lado, ['largo', 'corto'] as const).map(({ k, ...r }) => ({ lado: k, ...r })),
    porVolatilidad,
    curva,
    desde: ops[0]?.dia ?? null,
    hasta: ops[n - 1]?.dia ?? null,
  }
}

// ───────── Cuentas: funded y challenge ─────────

export interface ReglasCuentaSim {
  objetivo: number
  /** Drawdown máximo, en dólares, desde el máximo de cierre de día (trailing EOD). */
  drawdown: number
  /** Pérdida diaria máxima (0 = sin límite). */
  perdidaDiaria: number
  /** El mejor día no puede pasar de este porcentaje del beneficio total (0,2 = 20 %). */
  consistencia: number
  /** Precio de la cuenta (para el coste por cuenta aprobada). */
  precio: number
}

export interface ResultadoCuentas {
  intentos: number
  aprobadas: number
  quemadas: number
  enCurso: boolean
  diasMedios: number | null
  costePorAprobada: number | null
  tasa: number
}

/**
 * Aplica las operaciones del backtest, en orden, a cuentas sucesivas: cuando
 * una se aprueba o se quema, empieza otra. Sirve para comparar ciclos.
 */
export function simularCuentas(ops: Operacion[], r: ReglasCuentaSim): ResultadoCuentas {
  const porDia = new Map<string, number>()
  for (const o of ops) porDia.set(o.dia, (porDia.get(o.dia) ?? 0) + o.usd)
  const dias = [...porDia].sort((a, b) => a[0].localeCompare(b[0]))
  let aprobadas = 0, quemadas = 0, intentos = 0
  let saldo = 0, picoEod = 0, mejorDia = 0, diasCuenta = 0, enCurso = false
  const duraciones: number[] = []
  const reiniciar = () => { saldo = 0; picoEod = 0; mejorDia = 0; diasCuenta = 0; enCurso = false }
  for (const [, usdDia] of dias) {
    if (!enCurso) { intentos++; enCurso = true }
    diasCuenta++
    const dia = r.perdidaDiaria > 0 ? Math.max(usdDia, -r.perdidaDiaria) : usdDia
    saldo += dia
    mejorDia = Math.max(mejorDia, dia)
    if (saldo <= picoEod - r.drawdown) { quemadas++; duraciones.push(diasCuenta); reiniciar(); continue }
    picoEod = Math.max(picoEod, saldo)
    const consistente = r.consistencia <= 0 || mejorDia <= r.consistencia * saldo
    if (saldo >= r.objetivo && consistente) { aprobadas++; duraciones.push(diasCuenta); reiniciar() }
  }
  return {
    intentos, aprobadas, quemadas, enCurso,
    diasMedios: duraciones.length ? Math.round(duraciones.reduce((s, x) => s + x, 0) / duraciones.length * 10) / 10 : null,
    costePorAprobada: aprobadas && r.precio ? Math.round(intentos * r.precio / aprobadas) : null,
    tasa: aprobadas + quemadas ? Math.round(aprobadas / (aprobadas + quemadas) * 1000) / 10 : 0,
  }
}
