// ─────────────────────────────────────────────
//  ADMIN — lista de administradores reales, por email
//
//  Distinto del candado por plan (FEATURE_TIERS): un alumno con plan
//  Pro NO es administrador. Solo las personas de esta lista (Santos +
//  equipo) pueden editar/borrar trades y editar Mapas — todos los
//  demás, sea cual sea su plan, ven esas acciones bloqueadas.
//
//  No usa Supabase (no hay campo `is_admin` en `profiles` todavía) —
//  se compara el email real de la sesión (profile.email, ya vive en
//  useAuthStore) contra esta lista fija. Suficiente para un equipo de
//  2-3 personas; si el equipo crece, esto debería pasar a una columna
//  real en Supabase en vez de una lista en el código.
// ─────────────────────────────────────────────

export const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',').map(e => e.toLowerCase().trim()).filter(Boolean)

export function isAdmin(profile) {
  if (!profile?.email) return false
  return ADMIN_EMAILS.includes(profile.email.toLowerCase().trim())
}
