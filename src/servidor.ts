// Webhook de WhatsApp: recibe tus respuestas (check-in de bienestar y
// actualizaciones de cuentas) y contesta.
import http from 'node:http'
import crypto from 'node:crypto'
import { config } from './config.ts'
import { leer, guardar } from './almacen.ts'
import { interpretarRespuesta, evaluarBienestar, type CheckIn } from './personal/coach.ts'
import { interpretarComandoPnl, type EstadoCuenta } from './personal/gestor.ts'
import { mensajero } from './mensajeria/index.ts'
import { claveDia } from './tiempo.ts'

export async function procesarMensaje(texto: string, ahora = new Date()): Promise<string> {
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
  const todos = await leer<Record<string, CheckIn>>('checkins', {})
  const c = { ...todos[dia], ...interpretarRespuesta(texto, dia) }
  todos[dia] = c
  await guardar('checkins', todos)
  const h = evaluarBienestar(c)[0]
  const faltan = [c.horasSueno === undefined && 'horas de sueño', c.entrenado === undefined && 'si has entrenado', c.animo === undefined && 'cómo te sientes'].filter(Boolean)
  return `Gracias. ${h.titulo}${faltan.length ? `\nSi quieres, dime también: ${faltan.join(', ')}.` : ''}`
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

export function arrancarServidor() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
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
  server.listen(config.puerto, () => console.log(`[oficina] Webhook escuchando en el puerto ${config.puerto}`))
  return server
}
