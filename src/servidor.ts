// Webhook de WhatsApp: recibe tus respuestas (check-in de bienestar y
// actualizaciones de cuentas) y contesta.
import http from 'node:http'
import { interpretarOperacion, apuntarOperacion } from './personal/enVivo.ts'
import { cargarPlan } from './personal/plan.ts'
import crypto from 'node:crypto'
import { config } from './config.ts'
import { leer, guardar } from './almacen.ts'
import { interpretarRespuesta, cargarAjustesCoach, respuestaCheckin, type CheckIn, type EventoDelDia } from './personal/coach.ts'
import { cargarCalendario } from './sources/calendario.ts'
import { eventosDelDia, ventanasDeRiesgo } from './equipo/macro.ts'
import { cargarMiembros, type MiembroFed } from './equipo/fed.ts'
import { avisosAtractor, readinessTrasCheckin } from './tareas.ts'
import { interpretarComandoPnl, type EstadoCuenta } from './personal/gestor.ts'
import { mensajero } from './mensajeria/index.ts'
import { mensajesDeHoy } from './mensajeria/historial.ts'
import { claveDia, hora } from './tiempo.ts'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { leerEstado } from './estadoOficina.ts'
import { modulos, servirAnalytics, pasarAMarkets } from './entropia.ts'
import { resumenTu, type RegistroSesgoTu } from './tu.ts'
import type { Nota } from './readiness.ts'

const PAGINA_OFICINA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'oficina.html')

export async function procesarMensaje(texto: string, ahora = new Date()): Promise<string> {
  // Botones de Atractor (o "op F1 -300"): apunta la operación y avisa al momento si te sales del plan.
  const op = interpretarOperacion(texto)
  if (op) {
    const linea = await apuntarOperacion(op.cuenta, op.que, await cargarPlan(), ahora)
    const aviso = await avisosAtractor(ahora).catch(() => null)
    return aviso ? `${linea}\n\n${aviso}` : linea
  }
  const pnl = interpretarComandoPnl(texto)
  if (pnl) {
    const estados = await leer<EstadoCuenta[]>('cuentas-estado', [])
    const previo = estados.find(e => e.nombre === pnl.nombre)
    const saldo = pnl.saldo ?? previo?.saldo ?? 0
    const nuevo: EstadoCuenta = {
      nombre: pnl.nombre, saldo, pnlHoy: pnl.pnlHoy,
      saldoMaximo: Math.max(previo?.saldoMaximo ?? saldo, saldo),
      actualizado: ahora.toISOString(),
    }
    await guardar('cuentas-estado', [...estados.filter(e => e.nombre !== pnl.nombre), nuevo])
    return `Apuntado: ${pnl.nombre}, hoy ${pnl.pnlHoy} $${pnl.saldo !== undefined ? `, saldo ${pnl.saldo} $` : ''}.`
  }

  const dia = claveDia(ahora, config.tzUsuaria)
  const { habitos } = await cargarAjustesCoach()
  const todos = await leer<Record<string, CheckIn>>('checkins', {})
  const nuevo = interpretarRespuesta(texto, dia, habitos)
  const c: CheckIn = { ...todos[dia], ...nuevo, habitos: { ...todos[dia]?.habitos, ...nuevo.habitos } }
  todos[dia] = c
  await guardar('checkins', todos)
  const respuesta = respuestaCheckin(c, habitos, c.sesgo ? await eventosFuertesDeHoy(ahora) : [])
  const readiness = await readinessTrasCheckin(c, ahora).catch(() => [])
  return [respuesta, ...(readiness.length ? ['', ...readiness] : [])].join('\n')
}

/** Datos y discursos fuertes que quedan hoy, para el comentario del coach sobre tu sesgo. */
async function eventosFuertesDeHoy(ahora: Date): Promise<EventoDelDia[]> {
  try {
    const cal = await cargarCalendario()
    const miembros = await cargarMiembros()
    return ventanasDeRiesgo(eventosDelDia(cal, ahora))
      .filter(v => v.fin > ahora)
      .map(v => ({ titulo: traducir(v.evento.titulo, miembros), hora: hora(v.evento.fecha, config.tzUsuaria) }))
  } catch {
    return []
  }
}

/** "Fed Chair Warsh Speaks" → "habla Kevin Warsh"; el resto, tal cual. */
function traducir(titulo: string, miembros: MiembroFed[]): string {
  const m = miembros.find(x => new RegExp(`\\b${x.apellido}\\b`, 'i').test(titulo))
  if (m && /Speaks|Testifies/i.test(titulo)) return `habla ${m.nombre} ${m.apellido}`
  return titulo
}

function firmaValida(cuerpo: string, firma: string | undefined): boolean {
  if (!config.whatsapp.appSecret) return true
  if (!firma) return false
  const esperada = 'sha256=' + crypto.createHmac('sha256', config.whatsapp.appSecret).update(cuerpo).digest('hex')
  return firma.length === esperada.length && crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))
}

interface WebhookWA {
  entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from: string; type: string; text?: { body: string } }> } }> }>
}

/** En la oficina, la planta baja también trabaja: Rendimiento y Coach salen de la zona "Tú". */
async function conZonaTu(e: Awaited<ReturnType<typeof leerEstado>>) {
  if (!e) return e
  const [checkins, sesgos, readiness] = await Promise.all([
    leer<Record<string, CheckIn>>('checkins', {}),
    leer<Record<string, RegistroSesgoTu>>('sesgos', {}),
    leer<{ dia: string; mercado: Nota } | null>('readiness', null),
  ])
  const tu = resumenTu(checkins, sesgos, readiness, claveDia(new Date(), config.tzUsuaria))
  const hora = new Date().toISOString()
  const agentes = { ...e.agentes } as Record<string, { estado: 'alerta' | 'trabajando' | 'descanso'; mensaje: string; hora: string }>
  agentes.coach = tu.consejos.length
    ? { estado: 'trabajando', mensaje: tu.consejos[0], hora }
    : { estado: 'descanso', mensaje: 'Sin nada que corregir por ahora.', hora }
  agentes.rendimiento ??= { estado: 'descanso', mensaje: 'Tus métricas, en Analytics → Tú hoy.', hora }
  return { ...e, agentes }
}

export function arrancarServidor() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/oficina')) {
      const cuerpo = await fs.readFile(PAGINA_OFICINA, 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${cuerpo}</body></html>`)
      return
    }
    if (req.method === 'GET' && url.pathname === '/estado') {
      const estado = await conZonaTu(await leerEstado())
      res.writeHead(estado ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(estado ?? { error: 'La oficina aún no ha trabajado hoy.' }))
      return
    }
    if (req.method === 'GET' && url.pathname === '/modulos') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(modulos()))
      return
    }
    if (req.method === 'GET' && url.pathname === '/tu') {
      const [checkins, sesgos, readiness, atractor] = await Promise.all([
        leer<Record<string, CheckIn>>('checkins', {}),
        leer<Record<string, RegistroSesgoTu>>('sesgos', {}),
        leer<{ dia: string; mercado: Nota } | null>('readiness', null),
        mensajesDeHoy(),
      ])
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ ...resumenTu(checkins, sesgos, readiness, claveDia(new Date(), config.tzUsuaria)), atractor }))
      return
    }
    if (url.pathname === '/markets' || url.pathname.startsWith('/markets/')) {
      pasarAMarkets(req, res)
      return
    }
    if (req.method === 'GET' && (url.pathname === '/analytics' || url.pathname.startsWith('/analytics/'))) {
      await servirAnalytics(url.pathname, res)
      return
    }
    if (req.method === 'GET' && url.pathname === '/salud') {
      res.writeHead(200).end('ok')
      return
    }
    if (req.method === 'GET' && url.pathname === '/webhook') {
      const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === config.whatsapp.verifyToken
      res.writeHead(ok ? 200 : 403).end(ok ? url.searchParams.get('hub.challenge') ?? '' : '')
      return
    }
    if (req.method === 'POST' && url.pathname === '/webhook') {
      let cuerpo = ''
      for await (const trozo of req) cuerpo += trozo
      if (!firmaValida(cuerpo, req.headers['x-hub-signature-256'] as string | undefined)) {
        res.writeHead(401).end()
        return
      }
      res.writeHead(200).end()
      try {
        const datos = JSON.parse(cuerpo) as WebhookWA
        const mensajes = datos.entry?.flatMap(e => e.changes?.flatMap(c => c.value?.messages ?? []) ?? []) ?? []
        for (const m of mensajes) {
          // Solo se atiende a lola.
          if (m.from !== config.whatsapp.destino || m.type !== 'text' || !m.text) continue
          await mensajero().enviar(await procesarMensaje(m.text.body))
        }
      } catch (e) {
        console.error('[webhook]', e)
      }
      return
    }
    res.writeHead(404).end()
  })
  server.listen(config.puerto, () => console.log(`[oficina] Abre http://localhost:${config.puerto}/oficina (Contexto en /markets, Tú en /analytics)`))
  return server
}
