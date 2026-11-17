// Arranque de la oficina: horarios y webhook.
import cron from 'node-cron'
import { config } from './config.ts'
import { guiaDiaria, preApertura, vigilancia, cierre, resumenSemanal } from './tareas.ts'
import { arrancarServidor } from './servidor.ts'

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
programar('vigilancia', '*/5 9-11 * * 1-5', M, () => vigilancia())        // 15:30-17:30 en España
programar('cierre', '15 16 * * 1-5', M, () => cierre())                   // 22:15 en España
programar('resumen semanal', '0 19 * * 0', U, () => resumenSemanal())

arrancarServidor()
