// Envío de mensajes. WhatsApp Cloud API de Meta; sin credenciales, consola.
import { config } from '../config.ts'
import { apuntarMensaje } from './historial.ts'

export interface Boton { texto: string; dato: string }
export interface Mensajero {
  enviar(texto: string): Promise<void>
  /** Con botones (solo Telegram); en los demás canales se manda el texto sin ellos. */
  enviarConBotones(texto: string, filas: Boton[][]): Promise<void>
}

export const consola: Mensajero = {
  async enviar(texto) {
    console.log(`\n──── WhatsApp (modo prueba) ────\n${texto}\n────────────────────────────────\n`)
  },
  async enviarConBotones(texto, filas) {
    await consola.enviar(`${texto}\n${filas.map(f => f.map(b => `[${b.texto}]`).join(' ')).join('\n')}`)
  },
}

interface ErrorGraph { error?: { code?: number; message?: string } }

/**
 * Meta solo deja mandar texto libre en las 24 h siguientes al último mensaje
 * de lola. Fuera de esa ventana hace falta una plantilla aprobada; se usa una
 * de tipo "utility" con un único parámetro {{1}} donde va el aviso.
 */
export function whatsapp(): Mensajero {
  const w = config.whatsapp
  const url = `https://graph.facebook.com/${w.graphVersion}/${w.phoneNumberId}/messages`
  const post = async (body: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${w.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    const json = (await res.json().catch(() => ({}))) as ErrorGraph
    return { ok: res.ok, json }
  }
  const m: Mensajero = {
    async enviarConBotones(texto) { await m.enviar(texto) },
    async enviar(texto) {
      const r = await post({ messaging_product: 'whatsapp', to: w.destino, type: 'text', text: { body: texto.slice(0, 4096), preview_url: false } })
      if (r.ok) return
      // 131047: fuera de la ventana de 24 h → plantilla.
      if (r.json.error?.code === 131047) {
        const plano = texto.replace(/\n+/g, ' · ').replace(/\s{2,}/g, ' ').slice(0, 1000)
        const t = await post({
          messaging_product: 'whatsapp', to: w.destino, type: 'template',
          template: { name: w.plantilla, language: { code: w.idiomaPlantilla }, components: [{ type: 'body', parameters: [{ type: 'text', text: plano }] }] },
        })
        if (t.ok) return
        throw new Error(`WhatsApp (plantilla) falló: ${t.json.error?.message ?? 'sin detalle'}`)
      }
      throw new Error(`WhatsApp falló: ${r.json.error?.message ?? 'sin detalle'}`)
    },
  }
  return m
}

/** Telegram: gratis y sin plantillas. Acepta el mismo *negrita* y _cursiva_ que WhatsApp. */
export function telegram(): Mensajero {
  const t = config.telegram
  const mandar = async (texto: string, extra: Record<string, unknown> = {}) => {
    const enviar = (parseMode?: string) => fetch(`https://api.telegram.org/bot${t.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: t.chatId, text: texto.slice(0, 4096), disable_web_page_preview: true, ...extra, ...(parseMode ? { parse_mode: parseMode } : {}) }),
      signal: AbortSignal.timeout(15000),
    })
    let r = await enviar('Markdown')
    // Si el formato falla (por ejemplo, un "_" suelto en un enlace), se manda sin formato.
    if (r.status === 400) r = await enviar()
    if (!r.ok) throw new Error(`Telegram falló: ${r.status} ${await r.text().catch(() => '')}`)
  }
  return {
    enviar: texto => mandar(texto),
    enviarConBotones: (texto, filas) => mandar(texto, {
      reply_markup: { inline_keyboard: filas.map(f => f.map(b => ({ text: b.texto, callback_data: b.dato.slice(0, 64) }))) },
    }),
  }
}

function canal(): Mensajero {
  if (config.dryRun) return consola
  if (config.telegram.token && config.telegram.chatId) return telegram()
  const w = config.whatsapp
  if (w.token && w.phoneNumberId && w.destino) return whatsapp()
  return consola
}

/** El canal que toque, guardando cada mensaje para la tarjeta de Guía en Control. */
export function mensajero(): Mensajero {
  const c = canal()
  const guardarlo = (texto: string) => apuntarMensaje(texto).catch(e => console.error('[historial]', e))
  return {
    async enviar(texto) { await c.enviar(texto); await guardarlo(texto) },
    async enviarConBotones(texto, filas) { await c.enviarConBotones(texto, filas); await guardarlo(texto) },
  }
}
