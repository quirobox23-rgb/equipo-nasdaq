// Entropia en una sola dirección: la oficina sirve también Analytics (zona
// "Tú", ya compilada en apps/agente-metricas/dist) en /analytics y pasa
// /markets a Entropia Markets (zona "Contexto", Next.js en un puerto interno).
import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.ts'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DIST_ANALYTICS = path.join(RAIZ, 'apps', 'agente-metricas', 'dist')

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.mjs': 'text/javascript; charset=utf-8',
}

/** Adónde llevan los botones de módulos: dentro de la oficina salvo que el .env diga otra cosa. */
export function modulos() {
  return {
    markets: config.apps.markets || '/markets/home',
    analytics: config.apps.analytics || '/analytics/hoy',
    backtesting: '/backtesting',
  }
}

/** Sirve Analytics desde su carpeta compilada. Las rutas que no son archivos devuelven index.html (la app decide). */
export async function servirAnalytics(pathname: string, res: http.ServerResponse) {
  const relativa = decodeURIComponent(pathname.replace(/^\/analytics\/?/, ''))
  const archivo = path.normalize(path.join(DIST_ANALYTICS, relativa))
  if (!archivo.startsWith(DIST_ANALYTICS)) { res.writeHead(403).end(); return }
  let destino = archivo
  try {
    if (!(await fs.stat(destino)).isFile()) throw new Error('no es archivo')
  } catch {
    destino = path.join(DIST_ANALYTICS, 'index.html')
  }
  try {
    const cuerpo = await fs.readFile(destino)
    const ext = path.extname(destino)
    const cache = destino.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'
    res.writeHead(200, { 'Content-Type': TIPOS[ext] ?? 'application/octet-stream', 'Cache-Control': cache })
    res.end(cuerpo)
  } catch {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Analytics aún no está compilada. Arranca con "npm run entropia" y se prepara sola.')
  }
}

/** Pasa la petición tal cual a Entropia Markets (que ya sabe que vive en /markets). */
export function pasarAMarkets(req: http.IncomingMessage, res: http.ServerResponse) {
  const destino = new URL(req.url ?? '/', config.apps.marketsInterno)
  const salida = http.request(destino, { method: req.method, headers: req.headers }, r => {
    res.writeHead(r.statusCode ?? 502, r.headers)
    r.pipe(res)
  })
  salida.on('error', () => {
    if (res.headersSent) { res.end(); return }
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Markets no está en marcha. Arranca con "npm run entropia" para tener las tres zonas.')
  })
  req.pipe(salida)
}
