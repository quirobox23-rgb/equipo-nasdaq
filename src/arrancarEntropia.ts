// "npm run entropia": todo Entropia con un solo comando y en una sola dirección.
//   http://localhost:3000/oficina    → la oficina de agentes
//   http://localhost:3000/markets    → Contexto (Entropia Markets)
//   http://localhost:3000/analytics  → Tú (Entropia Analytics)
// La primera vez instala y compila las apps (tarda unos minutos). Después de
// cambiar algo en las apps: "npm run entropia -- --rehacer".
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const MARKETS = path.join(RAIZ, 'apps', 'agente-macro')
const ANALYTICS = path.join(RAIZ, 'apps', 'agente-metricas')
const rehacer = process.argv.includes('--rehacer')
const enWindows = process.platform === 'win32'
const PUERTO_MARKETS = new URL(process.env.MARKETS_INTERNO ?? 'http://127.0.0.1:3001').port || '3001'

function paso(titulo: string, carpeta: string, comando: string, args: string[]) {
  console.log(`[entropia] ${titulo}…`)
  const r = spawnSync(comando, args, { cwd: carpeta, stdio: 'inherit', shell: enWindows })
  if (r.status !== 0) {
    console.error(`[entropia] Falló: ${titulo}. Revisa el mensaje de arriba.`)
    process.exit(1)
  }
}

for (const [nombre, carpeta] of [['Markets', MARKETS], ['Analytics', ANALYTICS]] as const) {
  if (!existsSync(path.join(carpeta, 'node_modules'))) paso(`Instalando ${nombre}`, carpeta, 'npm', ['install'])
}
if (rehacer || !existsSync(path.join(ANALYTICS, 'dist', 'index.html'))) paso('Compilando Analytics (Tú)', ANALYTICS, 'npm', ['run', 'build'])
if (rehacer || !existsSync(path.join(MARKETS, '.next', 'BUILD_ID'))) paso('Compilando Markets (Contexto)', MARKETS, 'npx', ['next', 'build'])

console.log(`[entropia] Arrancando Markets en el puerto interno ${PUERTO_MARKETS}…`)
const markets = spawn('npx', ['next', 'start', '-p', PUERTO_MARKETS, '-H', '127.0.0.1'], { cwd: MARKETS, stdio: 'inherit', shell: enWindows })
const parar = () => { markets.kill(); process.exit(0) }
process.on('SIGINT', parar)
process.on('SIGTERM', parar)
markets.on('exit', c => { if (c) console.error(`[entropia] Markets se ha parado (código ${c}). La oficina y Analytics siguen.`) })

await import('./index.ts')
