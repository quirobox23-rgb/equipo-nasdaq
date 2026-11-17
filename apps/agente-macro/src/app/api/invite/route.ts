import { NextResponse } from 'next/server'
import { isValidAdminPassword, getAdminPasswordFromRequest } from '@/lib/adminAuth'
import { normalizeEmail, signInvite } from '@/lib/invite'

// /api/invite — genera la firma del enlace de invitación para un email.
// Solo admins (header x-admin-password). La página /invitar arma el enlace.

export async function POST(req: Request) {
  if (!isValidAdminPassword(getAdminPasswordFromRequest(req))) {
    return NextResponse.json({ ok: false, error: 'Clave de admin incorrecta' }, { status: 401 })
  }
  const { email } = await req.json().catch(() => ({ email: '' }))
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ ok: false, error: 'Email no válido' }, { status: 400 })
  }
  const token = signInvite(email)
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Invitaciones no configuradas' }, { status: 503 })
  }
  return NextResponse.json({ ok: true, email: normalizeEmail(email), token })
}
