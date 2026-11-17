// Envío de mensajes. WhatsApp Cloud API de Meta; sin credenciales, consola.
import { config } from '../config.ts'

export interface Mensajero { enviar(texto: string): Promise<void> }

export const consola: Mensajero = {
  async enviar(texto) {
    console.log(`\n──── WhatsApp (modo prueba) ────\n${texto}\n────────────────────────────────\n`)
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
  return {
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
}

/** Telegram: gratis y sin plantillas. Acepta el mismo *negrita* y _cursiva_ que WhatsApp. */
export function telegram(): Mensajero {
  const t = config.telegram
  return {
    async enviar(texto) {
      const enviar = (parseMode?: string) => fetch(`https://api.telegram.org/bot${t.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: t.chatId, text: texto.slice(0, 4096), disable_web_page_preview: true, ...(parseMode ? { parse_mode: parseMode } : {}) }),
        signal: AbortSignal.timeout(15000),
      })
      let r = await enviar('Markdown')
      // Si el formato falla (por ejemplo, un "_" suelto en un enlace), se manda sin formato.
      if (r.status === 400) r = await enviar()
      if (!r.ok) throw new Error(`Telegram falló: ${r.status} ${await r.text().catch(() => '')}`)
    },
  }
}

export function mensajero(): Mensajero {
  if (config.dryRun) return consola
  if (config.telegram.token && config.telegram.chatId) return telegram()
  const w = config.whatsapp
  if (w.token && w.phoneNumberId && w.destino) return whatsapp()
  return consola
}
