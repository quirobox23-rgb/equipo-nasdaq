// adminAuth.ts — comprobación de la clave compartida entre los 3 admins.
//
// Deliberadamente simple (una clave compartida, no cuentas individuales),
// tal como se decidió: rápido de montar ahora, y cuando llegue el sistema
// de membresía real (Skool/WordPress) esto se sustituye sin tocar el resto
// de rutas — cada ruta protegida solo llama a isValidAdminPassword(), no
// le importa CÓMO se valida.

export function isValidAdminPassword(password: string | null | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false // sin ADMIN_PASSWORD configurada, nadie pasa (fail-safe, no fail-open)
  if (!password) return false
  return password === expected
}

/** Extrae la clave del header `x-admin-password` de una request. */
export function getAdminPasswordFromRequest(req: Request): string | null {
  return req.headers.get('x-admin-password')
}

/**
 * ¿La request viene de alguien del equipo (alumnos/{uid}.nivel == "admin")?
 * Usa el token de sesión de Firebase del header `Authorization: Bearer …`:
 * Firebase lo valida y Firestore devuelve el documento del alumno con sus
 * propias reglas (cada uno solo puede leer el suyo). Así el equipo no
 * necesita la clave compartida para el Análisis Semanal.
 */
export async function isTeamRequest(req: Request): Promise<boolean> {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!token || !apiKey || !projectId) return false
  try {
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      cache: 'no-store',
    })
    if (!lookup.ok) return false
    const uid = (await lookup.json()).users?.[0]?.localId
    if (!uid) return false
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/alumnos/${uid}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )
    if (!res.ok) return false
    return (await res.json()).fields?.nivel?.stringValue === 'admin'
  } catch {
    return false
  }
}

/** Equipo por su cuenta de Firebase, o con la clave compartida (la de Mentor IA). */
export async function isAdminRequest(req: Request): Promise<boolean> {
  return isValidAdminPassword(getAdminPasswordFromRequest(req)) || isTeamRequest(req)
}
