// Almacén mínimo en archivos JSON dentro de DATA_DIR. Suficiente para una
// sola persona; si crece, se cambia por SQLite sin tocar los agentes.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from './config.ts'

export async function leer<T>(nombre: string, porDefecto: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(config.dataDir, `${nombre}.json`), 'utf-8')) as T
  } catch {
    return porDefecto
  }
}

export async function guardar<T>(nombre: string, valor: T): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true })
  const destino = path.join(config.dataDir, `${nombre}.json`)
  const tmp = `${destino}.tmp`
  await fs.writeFile(tmp, JSON.stringify(valor, null, 2))
  await fs.rename(tmp, destino)
}
