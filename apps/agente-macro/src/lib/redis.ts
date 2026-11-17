// redis.ts — cliente mínimo de Upstash Redis (API REST, sin SDK nuevo,
// mismo criterio que el resto del proyecto: fetch directo).
//
// Variables de entorno necesarias (las genera Vercel solas al instalar la
// integración de Upstash desde el Marketplace — Storage → Marketplace
// Database Providers → Upstash → Redis → Connect a este proyecto):
//   KV_REST_API_URL
//   KV_REST_API_TOKEN
// (Si en tu panel salen con otro nombre, p.ej. UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN, este archivo prueba ambos nombres.)
//
// AVISO: esta pieza no se ha podido probar contra una instancia real de
// Upstash (sin acceso a internet completo desde el entorno de desarrollo).
// Sí está probada la lógica (get/set) contra una respuesta simulada con la
// forma exacta que documenta la API de Upstash — pero la primera prueba
// de verdad hay que hacerla ya con las credenciales reales.

function getCredentials(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

/** Guarda un valor (se serializa a JSON). */
export async function redisSet(key: string, value: unknown): Promise<boolean> {
  const creds = getCredentials()
  if (!creds) return false
  try {
    const res = await fetch(creds.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', key, JSON.stringify(value)]),
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  }
}

/** Lee un valor guardado con redisSet — null si no existe o hay algún fallo. */
export async function redisGet<T>(key: string): Promise<T | null> {
  const creds = getCredentials()
  if (!creds) return null
  try {
    const res = await fetch(creds.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['GET', key]),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.result == null) return null
    return JSON.parse(data.result) as T
  } catch {
    return null
  }
}
