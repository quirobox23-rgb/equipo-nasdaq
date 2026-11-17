// weekSource.ts — de dónde sale cada semana de noticias, en este orden:
//
//   1. Archivo src/data/weeks/week_<lunes>.json (lo editado a mano manda).
//   2. Forex Factory (semana en curso), fusionado con la copia guardada para
//      no perder los datos reales ya rellenados. Se guarda la copia (A).
//   3. Copia guardada en Firestore (semanas pasadas que ya no están en FF).
//   4. Calendario de FRED + fechas de la Fed (semanas futuras, o pasadas sin
//      copia): fechas y horas, sin previsión (B).
//
// En todos los casos, el dato real que falte se rellena desde FRED (C).

import { getForexFactoryWeek, type WeekEvent } from './forexFactory'
import { fillActualsFromFred, getFredScheduledWeek } from './fredCalendar'
import { mergeWithSnapshot, readWeekSnapshot, writeWeekSnapshot } from './weekSnapshot'

export type WeekStatus = 'loaded' | 'auto' | 'saved' | 'scheduled' | 'not_found'

/** Semana automática (sin archivo): FF, copia guardada o calendario de FRED. */
export async function loadAutoWeek(monday: string): Promise<{ events: WeekEvent[]; status: WeekStatus }> {
  const [ff, saved] = await Promise.all([getForexFactoryWeek(monday), readWeekSnapshot(monday)])

  if (ff.length > 0) {
    const { events } = await fillActualsFromFred(mergeWithSnapshot(ff, saved))
    await writeWeekSnapshot(monday, events)
    return { events, status: 'auto' }
  }

  if (saved && saved.length > 0) {
    const { events, filled } = await fillActualsFromFred(saved)
    if (filled > 0) await writeWeekSnapshot(monday, events)
    return { events, status: 'saved' }
  }

  const scheduled = await getFredScheduledWeek(monday)
  if (scheduled.length > 0) {
    const { events } = await fillActualsFromFred(scheduled)
    return { events, status: 'scheduled' }
  }
  return { events: [], status: 'not_found' }
}
