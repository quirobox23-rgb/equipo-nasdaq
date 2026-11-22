// Lee tus mensajes al bot de Telegram (sin servidor ni webhook: se pregunta
// a Telegram cada cierto tiempo) y los procesa como el webhook de WhatsApp.
import { config } from '../config.ts'
import { leer, guardar } from '../almacen.ts'
import { procesarMensaje } from '../servidor.ts'
import { mensajero } from './index.ts'

interface Update {
  update_id: number
  message?: { chat: { id: number }; text?: string }
  /** Un botón pulsado (los de Guía para apuntar TP o SL). */
  callback_query?: { id: string; data?: string; message?: { chat: { id: number } } }
}

async function responderBoton(id: string, texto: string) {
  await fetch(`https://api.telegram.org/bot${config.telegram.token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text: texto.slice(0, 190) }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => undefined)
}

async function pedir(offset: number, espera: number): Promise<Update[]> {
  const url = `https://api.telegram.org/bot${config.telegram.token}/getUpdates?offset=${offset}&timeout=${espera}&allowed_updates=${encodeURIComponent('["message","callback_query"]')}`
  const r = await fetch(url, { signal: AbortSignal.timeout((espera + 10) * 1000) })
  if (!r.ok) throw new Error(`Telegram getUpdates: ${r.status}`)
  return ((await r.json()) as { result: Update[] }).result
}

/** Procesa los mensajes pendientes. Devuelve cuántos ha atendido. */
export async function leerTelegram(espera = 0): Promise<number> {
  if (!config.telegram.token) return 0
  const estado = await leer<{ offset: number }>('telegram', { offset: 0 })
  const updates = await pedir(estado.offset, espera)
  let atendidos = 0
  for (const u of updates) {
    estado.offset = u.update_id + 1
    const q = u.callback_query
    if (q?.data && String(q.message?.chat.id) === String(config.telegram.chatId)) {
      const respuesta = await procesarMensaje(q.data)
      await responderBoton(q.id, respuesta.split('\n')[0])
      await mensajero().enviar(respuesta)
      atendidos++
      continue
    }
    const m = u.message
    // Solo se atiende a lola.
    if (!m?.text || String(m.chat.id) !== String(config.telegram.chatId) || m.text.startsWith('/')) continue
    await mensajero().enviar(await procesarMensaje(m.text))
    atendidos++
  }
  await guardar('telegram', estado)
  return atendidos
}

/** Muestra los chats que han escrito al bot, para saber tu TELEGRAM_CHAT_ID. */
export async function mostrarChats(): Promise<void> {
  const updates = await pedir(0, 0)
  const chats = new Map<number, string>()
  for (const u of updates) if (u.message) chats.set(u.message.chat.id, u.message.text ?? '')
  if (chats.size === 0) console.log('Nadie ha escrito al bot todavía. Mándale /start desde tu Telegram y vuelve a ejecutar esto.')
  for (const [id, txt] of chats) console.log(`TELEGRAM_CHAT_ID=${id}   (último mensaje: ${txt})`)
}

/** Bucle de escucha para cuando la oficina corre en un ordenador o servidor. */
export async function escucharTelegram(): Promise<void> {
  console.log('[oficina] Escuchando mensajes de Telegram')
  for (;;) {
    try {
      await leerTelegram(50)
    } catch (e) {
      console.error('[telegram]', e instanceof Error ? e.message : e)
      await new Promise(r => setTimeout(r, 10_000))
    }
  }
}
