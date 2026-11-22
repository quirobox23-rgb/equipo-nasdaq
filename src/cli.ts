// Ejecuta una tarea a mano: npm run tarea -- guia | apertura | vigilancia | atractor | sesion | cierre | semanal | leer | telegram-id | mensaje "texto"
import { guiaDiaria, preApertura, vigilancia, cierre, resumenSemanal, atractorEnVivo, aperturaAtractor } from './tareas.ts'
import { procesarMensaje } from './servidor.ts'
import { leerTelegram, mostrarChats } from './mensajeria/telegramEntrada.ts'

const [tarea, ...resto] = process.argv.slice(2)
const tareas: Record<string, () => Promise<unknown>> = {
  guia: () => guiaDiaria(),
  apertura: () => preApertura(),
  vigilancia: async () => (await vigilancia()) ?? console.log('Nada nuevo que avisar (o fuera de horario).'),
  sesion: async () => (await aperturaAtractor()) ?? console.log('Guía: no hay cuentas (ni en Factor Métricas ni en config/cuentas.json).'),
  atractor: async () => (await atractorEnVivo()) ?? console.log('Guía: nada que avisar (o Factor Métricas sin configurar).'),
  cierre: () => cierre(),
  semanal: () => resumenSemanal(),
  leer: async () => console.log(`Mensajes atendidos: ${await leerTelegram()}`),
  'telegram-id': () => mostrarChats(),
  mensaje: async () => console.log(await procesarMensaje(resto.join(' '))),
}

if (!tarea || !tareas[tarea]) {
  console.log(`Uso: npm run tarea -- ${Object.keys(tareas).join(' | ')}`)
  process.exit(1)
}
await tareas[tarea]()
