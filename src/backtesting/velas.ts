// Velas para el backtesting: leer un CSV (Databento, NinjaTrader, Sierra
// Chart o uno genérico), pasarlo a velas en UTC y agruparlas. Los datos son
// del usuario (su CSV o su clave de Databento): la oficina no trae ni
// reparte datos de CME, solo los guarda en su ordenador para el backtest.

export interface Vela { t: number; o: number; h: number; l: number; c: number; v: number }

/** Las velas en columnas, que ocupan mucho menos guardadas en JSON. */
export interface SerieVelas {
  /** Segundos de cada vela base: 1 (de ticks), 60 (1 minuto), 900 (solo M15)… */
  resolucion: number
  simbolo: string
  origen: string
  t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[]
}

export const ZONAS = { utc: 'UTC', ny: 'America/New_York', chicago: 'America/Chicago', madrid: 'Europe/Madrid' } as const
export type ZonaCsv = keyof typeof ZONAS

// ───────── Zonas horarias rápidas (cientos de miles de velas) ─────────

const formatos = new Map<string, Intl.DateTimeFormat>()
const desfases = new Map<string, number>()

/** Minutos que la zona va por delante de UTC en el instante t (ms). Cacheado por hora. */
export function desfase(tz: string, t: number): number {
  if (tz === 'UTC') return 0
  const clave = `${tz}|${Math.floor(t / 3_600_000)}`
  const visto = desfases.get(clave)
  if (visto !== undefined) return visto
  let f = formatos.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    formatos.set(tz, f)
  }
  const base = Math.floor(t / 3_600_000) * 3_600_000
  const p: Record<string, number> = {}
  for (const x of f.formatToParts(new Date(base))) if (x.type !== 'literal') p[x.type] = Number(x.value)
  const min = Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - base) / 60_000)
  desfases.set(clave, min)
  return min
}

/** Hora de reloj en `tz` (como si fuera UTC) → instante UTC real. */
export function relojAUtc(reloj: number, tz: string): number {
  if (tz === 'UTC') return reloj
  const d1 = desfase(tz, reloj)
  const d2 = desfase(tz, reloj - d1 * 60_000)
  return reloj - d2 * 60_000
}

/** Día (YYYY-MM-DD), minutos desde medianoche y día de la semana en Nueva York. */
export function enNY(t: number): { dia: string; min: number; semana: number } {
  const local = t + desfase(ZONAS.ny, t) * 60_000
  const d = new Date(local)
  return { dia: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), semana: d.getUTCDay() }
}

// ───────── Lectura de CSV ─────────

/** "2024-01-02 09:30:00", "2024/1/2", "01/02/2024 09:30", "20240102 093000", ISO con zona o epoch. */
export function leerFecha(texto: string, tz: string): number | null {
  const s = texto.trim().replace(/^"|"$/g, '')
  if (!s) return null
  if (/^\d{16,19}$/.test(s)) return Math.floor(Number(s.slice(0, s.length - 6)) / 1000) // nanosegundos
  if (/^\d{13}$/.test(s)) return Number(s)
  if (/^\d{10}(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000)
  if (/[T ]\d{1,2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const iso = s.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')
    const t = Date.parse(iso)
    return Number.isNaN(t) ? null : t
  }
  let a: number, m: number, d: number, resto: string
  let r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T]*(.*)$/)
  if (r) { a = +r[1]; m = +r[2]; d = +r[3]; resto = r[4] }
  else if ((r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})[ T]*(.*)$/))) { a = +r[3]; m = +r[1]; d = +r[2]; resto = r[4] } // US: mes/día/año
  else if ((r = s.match(/^(\d{4})(\d{2})(\d{2})[ T]*(.*)$/))) { a = +r[1]; m = +r[2]; d = +r[3]; resto = r[4] }
  else return null
  let h = 0, mi = 0, se = 0, ms = 0
  const hm = resto.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?/) ?? resto.match(/^(\d{2})(\d{2})(\d{2})?(?:\s+(\d+))?/)
  if (hm) { h = +hm[1]; mi = +hm[2]; se = +(hm[3] ?? 0); ms = hm[4] ? Math.floor(Number(`0.${hm[4]}`) * 1000) : 0 }
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null
  return relojAUtc(Date.UTC(a, m - 1, d, h, mi, se, ms), tz)
}

const NOMBRES = {
  fecha: ['ts_event', 'timestamp', 'datetime', 'date time', 'date_time', 'time_utc', 'ts', 'fecha y hora', 'gmt time', 'local time'],
  dia: ['date', 'fecha', 'day'],
  hora: ['time', 'hora', 'ts_recv'],
  o: ['open', 'o', 'apertura', 'first'],
  h: ['high', 'h', 'max', 'máximo', 'maximo'],
  l: ['low', 'l', 'min', 'mínimo', 'minimo'],
  c: ['close', 'c', 'last', 'cierre', 'ultimo', 'último'],
  v: ['volume', 'vol', 'v', 'volumen', 'size', 'qty', 'total volume'],
  precio: ['price', 'precio', 'last', 'trade price'],
  simbolo: ['symbol', 'simbolo', 'símbolo', 'instrument', 'raw_symbol'],
}

export interface OpcionesLector { tz: ZonaCsv }
export interface Lectura { serie: SerieVelas; filas: number; descartadas: number; formato: string; avisos: string[] }

/**
 * Lector línea a línea (los CSV de ticks pueden ser de varios GB). Detecta el
 * formato con la primera línea. Los ticks se juntan en velas de 1 segundo;
 * las velas se quedan como vienen (1 minuto, 5 minutos…).
 */
export function crearLector(op: OpcionesLector) {
  const tz = ZONAS[op.tz] ?? 'UTC'
  let sep = ','
  let formato = ''
  let col: Partial<Record<keyof typeof NOMBRES, number>> = {}
  let tick = false
  let nt = false // NinjaTrader sin cabecera
  let filas = 0, descartadas = 0
  let escala = 1
  // Por símbolo (los CSV de Databento del NQ "padre" traen todos los vencimientos y spreads).
  const porSimbolo = new Map<string, Map<number, Vela>>()
  const volDia = new Map<string, Map<string, number>>()

  function apuntar(sim: string, t: number, o: number, h: number, l: number, c: number, v: number) {
    let m = porSimbolo.get(sim)
    if (!m) { m = new Map(); porSimbolo.set(sim, m) }
    const clave = tick ? Math.floor(t / 1000) * 1000 : t
    const x = m.get(clave)
    if (x) { x.h = Math.max(x.h, h); x.l = Math.min(x.l, l); x.c = c; x.v += v }
    else m.set(clave, { t: clave, o, h, l, c, v })
    if (porSimbolo.size > 1 || sim) {
      const dia = enNY(t).dia
      let vd = volDia.get(dia)
      if (!vd) { vd = new Map(); volDia.set(dia, vd) }
      vd.set(sim, (vd.get(sim) ?? 0) + (v || 1))
    }
  }

  function cabecera(linea: string): boolean {
    sep = [';', '\t', ','].map(s => [s, linea.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0]
    const partes = linea.split(sep).map(x => x.trim().replace(/^"|"$/g, '').toLowerCase())
    // NinjaTrader exporta sin cabecera: "20240102 093000;o;h;l;c;v" o ticks "20240102 093000 1230000;precio;…"
    if (/^\d{8} \d{6}( \d+)?$/.test(partes[0])) {
      nt = true
      tick = /^\d{8} \d{6} \d+$/.test(partes[0]) || partes.length < 6
      formato = tick ? 'NinjaTrader (ticks)' : 'NinjaTrader (velas)'
      return false
    }
    if (!partes.some(p => /[a-z]/.test(p))) {
      // Sin cabecera y sin formato conocido: fecha, apertura, máximo, mínimo, cierre, volumen.
      col = { fecha: 0, o: 1, h: 2, l: 3, c: 4, v: 5 }
      formato = 'CSV sin cabecera (fecha, O, H, L, C, V)'
      return false
    }
    const busca = (k: keyof typeof NOMBRES, excluir: number[] = []) => {
      for (const n of NOMBRES[k]) {
        const i = partes.findIndex((p, j) => !excluir.includes(j) && p === n)
        if (i >= 0) return i
      }
      return undefined
    }
    col.fecha = busca('fecha')
    if (col.fecha === undefined) { col.dia = busca('dia'); col.hora = busca('hora') }
    if (col.fecha === undefined && col.dia === undefined && col.hora !== undefined) { col.fecha = col.hora; col.hora = undefined }
    col.o = busca('o'); col.h = busca('h'); col.l = busca('l')
    col.c = busca('c', [col.o, col.h, col.l].filter((x): x is number => x !== undefined))
    col.v = busca('v')
    col.simbolo = busca('simbolo')
    if (col.o === undefined || col.h === undefined) {
      col.precio = busca('precio')
      if (col.precio === undefined) throw new Error('No encuentro columnas de precio. Necesito open/high/low/close (velas) o price (ticks).')
      tick = true
    }
    if (col.fecha === undefined && col.dia === undefined) throw new Error('No encuentro la columna de fecha y hora.')
    formato = partes.includes('ts_event') ? `Databento (${tick ? 'operaciones' : 'velas'})`
      : partes.includes('# of trades') || partes.includes('numberoftrades') ? 'Sierra Chart'
      : `CSV con cabecera (${tick ? 'ticks' : 'velas'})`
    return true
  }

  function precio(x: string | undefined): number {
    const n = Number(String(x ?? '').trim().replace(/^"|"$/g, ''))
    return n * escala
  }

  function linea(texto: string) {
    const l = texto.replace(/\r$/, '')
    if (!l.trim()) return
    if (!formato) { if (cabecera(l)) return }
    filas++
    const p = l.split(sep)
    let t: number | null, o: number, h: number, lo: number, c: number, v: number, sim = ''
    if (nt) {
      t = leerFecha(p[0].trim().split(' ').slice(0, 2).join(' '), tz)
      if (t !== null && tick) {
        const frac = p[0].trim().split(' ')[2]
        if (frac) t += Math.floor(Number(`0.${frac}`) * 1000)
      }
      if (tick) { o = h = lo = c = Number(p[1]); v = Number(p[4] ?? p[2] ?? 1) || 1 }
      else { o = Number(p[1]); h = Number(p[2]); lo = Number(p[3]); c = Number(p[4]); v = Number(p[5]) || 0 }
    } else {
      const textoFecha = col.fecha !== undefined ? p[col.fecha] : `${p[col.dia!]} ${col.hora !== undefined ? p[col.hora] : ''}`
      t = leerFecha(textoFecha ?? '', tz)
      if (tick) { o = h = lo = c = precio(p[col.precio!]); v = col.v !== undefined ? Number(p[col.v]) || 1 : 1 }
      else { o = precio(p[col.o!]); h = precio(p[col.h!]); lo = precio(p[col.l!]); c = precio(p[col.c!]); v = col.v !== undefined ? Number(p[col.v]) || 0 : 0 }
      if (col.simbolo !== undefined) sim = (p[col.simbolo] ?? '').trim().replace(/^"|"$/g, '')
      // Databento sin pretty_px: precios en milmillonésimas.
      if (filas === 1 && escala === 1 && o > 1e7) { escala = 1e-9; o *= escala; h *= escala; lo *= escala; c *= escala }
    }
    if (t === null || ![o, h, lo, c].every(Number.isFinite) || o <= 0 || h < lo) { descartadas++; return }
    if (sim.includes('-')) { descartadas++; return } // spreads de calendario
    apuntar(sim, t, o, Math.max(h, o, c), Math.min(lo, o, c), c, v)
  }

  function fin(): Lectura {
    const avisos: string[] = []
    let velas: Vela[]
    if (porSimbolo.size <= 1) {
      velas = [...(porSimbolo.values().next().value ?? new Map()).values()]
    } else {
      // Cada día, el vencimiento con más volumen (el que se opera de verdad).
      const elegido = new Map<string, string>()
      for (const [dia, vd] of volDia) elegido.set(dia, [...vd].sort((a, b) => b[1] - a[1])[0][0])
      velas = []
      for (const [sim, m] of porSimbolo) for (const x of m.values()) if (elegido.get(enNY(x.t).dia) === sim) velas.push(x)
      avisos.push(`El archivo trae ${porSimbolo.size} contratos; cada día uso el de más volumen (${[...new Set(elegido.values())].join(', ')}).`)
    }
    velas.sort((a, b) => a.t - b.t)
    const serie = aSerie(velas, tick ? 1 : resolucionDe(velas), [...porSimbolo.keys()].filter(Boolean).join(', ') || 'NQ', formato)
    if (serie.resolucion > 900) throw new Error('Las velas son de más de 15 minutos. Necesito velas de 15 minutos o menos (mejor de 1 minuto o ticks).')
    if (serie.resolucion === 900) avisos.push('Solo hay velas de 15 minutos: si el SL y el TP caen dentro de la misma vela no sé cuál llegó antes y cuento SL. Con velas de 1 minuto o ticks sale más fiel.')
    if (descartadas) avisos.push(`${descartadas.toLocaleString('es-ES')} filas descartadas (vacías, spreads o sin precio válido).`)
    return { serie, filas, descartadas, formato, avisos }
  }

  return { linea, fin }
}

/** La separación más habitual entre velas seguidas, en segundos. */
export function resolucionDe(velas: Vela[]): number {
  const cuenta = new Map<number, number>()
  for (let i = 1; i < Math.min(velas.length, 5000); i++) {
    const d = Math.round((velas[i].t - velas[i - 1].t) / 1000)
    if (d > 0) cuenta.set(d, (cuenta.get(d) ?? 0) + 1)
  }
  return [...cuenta].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 60
}

export function aSerie(velas: Vela[], resolucion: number, simbolo: string, origen: string): SerieVelas {
  return {
    resolucion, simbolo, origen,
    t: velas.map(x => x.t), o: velas.map(x => x.o), h: velas.map(x => x.h), l: velas.map(x => x.l), c: velas.map(x => x.c), v: velas.map(x => x.v),
  }
}

export function deSerie(s: SerieVelas): Vela[] {
  return s.t.map((t, i) => ({ t, o: s.o[i], h: s.h[i], l: s.l[i], c: s.c[i], v: s.v[i] }))
}

/** Lee un CSV entero que ya está en memoria (para pruebas y archivos pequeños). */
export function leerCsv(texto: string, op: OpcionesLector = { tz: 'utc' }): Lectura {
  const lector = crearLector(op)
  for (const l of texto.split('\n')) lector.linea(l)
  return lector.fin()
}

/** Velas de `segundos` (900 = M15) a partir de las velas base, con el tramo de velas base de cada una. */
export interface VelaAgrupada extends Vela { desde: number; hasta: number }
export function agrupar(base: Vela[], segundos: number): VelaAgrupada[] {
  const out: VelaAgrupada[] = []
  const paso = segundos * 1000
  for (let i = 0; i < base.length; i++) {
    const x = base[i]
    const t = Math.floor(x.t / paso) * paso
    const u = out[out.length - 1]
    if (u && u.t === t) { u.h = Math.max(u.h, x.h); u.l = Math.min(u.l, x.l); u.c = x.c; u.v += x.v; u.hasta = i }
    else out.push({ t, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v, desde: i, hasta: i })
  }
  return out
}
