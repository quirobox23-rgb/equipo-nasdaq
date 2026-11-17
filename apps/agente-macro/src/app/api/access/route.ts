import { NextRequest, NextResponse } from 'next/server'
import { verifyInvite } from '@/lib/invite'

// /api/access — comprueba un enlace de invitación (email + firma) antes de
// crear la cuenta en /registro. Ver src/lib/invite.ts.

export async function POST(req: NextRequest) {
  const { email, token } = await req.json().catch(() => ({ email: '', token: '' }))
  const ok = typeof email === 'string' && typeof token === 'string' && verifyInvite(email, token)
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 })
}
