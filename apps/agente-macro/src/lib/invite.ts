import { createHmac, timingSafeEqual } from 'crypto'

// invite.ts — enlaces de invitación (solo servidor). Cada enlace lleva el
// email del alumno y una firma de ese email: /registro?email=...&t=<firma>.
// Sin base de datos: la firma solo vale para ese email, y Firebase no deja
// crear dos cuentas con el mismo email, así que cada enlace sirve para crear
// UNA sola cuenta. La firma usa INVITE_SECRET (o ADMIN_PASSWORD si no está):
// si se cambia, los enlaces que todavía no se usaron dejan de valer.

function secret(): string | null {
  return process.env.INVITE_SECRET || process.env.ADMIN_PASSWORD || null
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function signInvite(email: string): string | null {
  const key = secret()
  if (!key) return null
  return createHmac('sha256', key).update(normalizeEmail(email)).digest('base64url')
}

export function verifyInvite(email: string, token: string): boolean {
  const expected = signInvite(email)
  if (!expected || !token) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}
