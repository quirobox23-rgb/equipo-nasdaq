// Descarga de velas de Databento con la clave del propio usuario ("trae tu
// propia clave"). La clave no se guarda: se usa para esta petición y ya. Las
// velas quedan solo en este ordenador (data/), para el backtest de quien paga.
import { crearLector, type Lectura } from './velas.ts'

const API = 'https://hist.databento.com/v0'

export interface PeticionDatabento {
  clave: string
  instrumento: 'NQ' | 'MNQ'
  /** YYYY-MM-DD */
  desde: string
  hasta: string
  /** 1 minuto (recomendado) o 1 segundo (más fiel, más caro y pesado). */
  esquema: 'ohlcv-1m' | 'ohlcv-1s'
}

function parametros(p: PeticionDatabento): URLSearchParams {
  return new URLSearchParams({
    dataset: 'GLBX.MDP3',
    // Contrato continuo que cambia de vencimiento cuando el siguiente tiene más volumen.
    symbols: `${p.instrumento}.v.0`,
    stype_in: 'continuous',
    schema: p.esquema,
    start: p.desde,
    end: p.hasta,
  })
}

function cabeceras(clave: string): Record<string, string> {
  return { Authorization: `Basic ${Buffer.from(`${clave.trim()}:`).toString('base64')}` }
}

async function error(r: Response): Promise<Error> {
  let detalle = ''
  try { const j = await r.json() as { detail?: unknown }; detalle = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j) } catch { /* sin cuerpo */ }
  if (r.status === 401 || r.status === 403) return new Error('Databento no acepta la clave. Revisa que la has copiado entera (empieza por "db-").')
  return new Error(`Databento respondió ${r.status}${detalle ? `: ${detalle}` : ''}`)
}

export function validar(p: Partial<PeticionDatabento>): PeticionDatabento {
  const fecha = /^\d{4}-\d{2}-\d{2}$/
  if (!p.clave || !/^db-/.test(p.clave.trim())) throw new Error('Pega tu clave de Databento (empieza por "db-").')
  if (!p.desde || !fecha.test(p.desde) || !p.hasta || !fecha.test(p.hasta) || p.desde >= p.hasta) throw new Error('Elige un rango de fechas válido.')
  return {
    clave: p.clave.trim(), desde: p.desde, hasta: p.hasta,
    instrumento: p.instrumento === 'NQ' ? 'NQ' : 'MNQ',
    esquema: p.esquema === 'ohlcv-1s' ? 'ohlcv-1s' : 'ohlcv-1m',
  }
}

/** Lo que costaría la descarga, en dólares, antes de hacerla. */
export async function coste(p: PeticionDatabento): Promise<number> {
  const r = await fetch(`${API}/metadata.get_cost?${parametros(p)}`, { headers: cabeceras(p.clave) })
  if (!r.ok) throw await error(r)
  return Number(await r.json())
}

/** Descarga en CSV y lo lee por trozos (no carga todo el texto en memoria). */
export async function descargar(p: PeticionDatabento): Promise<Lectura> {
  const q = parametros(p)
  q.set('encoding', 'csv'); q.set('pretty_px', 'true'); q.set('pretty_ts', 'true'); q.set('map_symbols', 'true')
  const r = await fetch(`${API}/timeseries.get_range?${q}`, { headers: cabeceras(p.clave) })
  if (!r.ok || !r.body) throw await error(r)
  const lector = crearLector({ tz: 'utc' })
  const dec = new TextDecoder()
  let resto = ''
  for await (const trozo of r.body as unknown as AsyncIterable<Uint8Array>) {
    resto += dec.decode(trozo, { stream: true })
    const lineas = resto.split('\n')
    resto = lineas.pop() ?? ''
    for (const l of lineas) lector.linea(l)
  }
  if (resto) lector.linea(resto)
  const lectura = lector.fin()
  lectura.serie.simbolo = `${p.instrumento} continuo`
  lectura.serie.origen = `Databento ${p.esquema} (${p.desde} → ${p.hasta})`
  return lectura
}
