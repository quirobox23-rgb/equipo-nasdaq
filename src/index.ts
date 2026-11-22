// Arranque de la oficina: horarios y webhook.
import cron from 'node-cron'
import { config } from './config.ts'
import { guiaDiaria, preApertura, vigilancia, cierre, resumenSemanal, atractorEnVivo, aperturaAtractor } from './tareas.ts'
import { arrancarServidor } from './servidor.ts'
import { escucharTelegram } from './mensajeria/telegramEntrada.ts'

function programar(nombre: string, expresion: string, tz: string, tarea: () => Promise<unknown>) {
  cron.schedule(expresion, async () => {
    try {
      await tarea()
    } catch (e) {
      console.error(`[${nombre}] falló:`, e)
    }
  }, { timezone: tz, name: nombre })
  console.log(`[oficina] ${nombre}: "${expresion}" (${tz})`)
}

const U = config.tzUsuaria
const M = config.tzMercado

programar('guía diaria', '30 8 * * 1-5', U, () => guiaDiaria())
programar('pre-apertura', '0 9 * * 1-5', M, () => preApertura())          // 15:00 en España
programar('vigilancia', '*/5 2-11 * * 1-5', M, () => vigilancia())        // 08:00-17:30 en España; cada tarea mira su ventana
programar('guía: sesión abierta', '25 9 * * 1-5', M, () => aperturaAtractor()) // 15:25 en España: botones TP/SL por cuenta
programar('guía en vivo', '*/5 9-16 * * 1-5', M, () => atractorEnVivo()) // 15:00-22:55 en España: tus operaciones frente al plan
programar('cierre', '15 16 * * 1-5', M, () => cierre())                   // 22:15 en España
programar('resumen semanal', '0 19 * * 0', U, () => resumenSemanal())

if (config.telegram.token) void escucharTelegram()
// La vista de la oficina (y el webhook de WhatsApp, si lo usas) van en el mismo servidor.
arrancarServidor()
