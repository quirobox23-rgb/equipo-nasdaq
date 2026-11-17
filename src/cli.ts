// Ejecuta una tarea a mano: npm run tarea -- guia | apertura | vigilancia | cierre | semanal | mensaje "texto"
import { guiaDiaria, preApertura, vigilancia, cierre, resumenSemanal } from './tareas.ts'
import { procesarMensaje } from './servidor.ts'

const [tarea, ...resto] = process.argv.slice(2)
const tareas: Record<string, () => Promise<unknown>> = {
  guia: () => guiaDiaria(),
  apertura: () => preApertura(),
  vigilancia: async () => (await vigilancia()) ?? console.log('Nada nuevo que avisar (o fuera de horario).'),
  cierre: () => cierre(),
  semanal: () => resumenSemanal(),
  mensaje: async () => console.log(await procesarMensaje(resto.join(' '))),
}

if (!tarea || !tareas[tarea]) {
  console.log(`Uso: npm run tarea -- ${Object.keys(tareas).join(' | ')}`)
  process.exit(1)
}
await tareas[tarea]()
