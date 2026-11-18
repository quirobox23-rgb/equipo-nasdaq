// Lo que Atractor te ha escrito, guardado para verlo también en Control
// (pantalla Hoy) y no solo en Telegram. Se guardan los tres últimos días.
import { config } from '../config.ts'
import { leer, guardar } from '../almacen.ts'
import { claveDia, hora } from '../tiempo.ts'

export interface MensajeAtractor { hora: string; texto: string }
type Historial = Record<string, MensajeAtractor[]>

export async function apuntarMensaje(texto: string, ahora = new Date()): Promise<void> {
  const h = await leer<Historial>('atractor-mensajes', {})
  const dia = claveDia(ahora, config.tzUsuaria)
  h[dia] = [...(h[dia] ?? []), { hora: hora(ahora, config.tzUsuaria), texto: texto.slice(0, 4000) }]
  const dias = Object.keys(h).sort().slice(-3)
  await guardar('atractor-mensajes', Object.fromEntries(dias.map(d => [d, h[d]])))
}

export async function mensajesDeHoy(ahora = new Date()): Promise<MensajeAtractor[]> {
  return (await leer<Historial>('atractor-mensajes', {}))[claveDia(ahora, config.tzUsuaria)] ?? []
}
