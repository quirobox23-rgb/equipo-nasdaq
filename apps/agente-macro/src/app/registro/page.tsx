'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { authErrorMessage } from '@/lib/studentSession'
import { Logo } from '@/components/Logo'

// /registro?email=...&t=<firma> — el alumno crea su cuenta desde el enlace de
// invitación que le mandamos (se genera en /invitar). El email viene fijo en
// el enlace; el alumno solo elige su contraseña. Firebase no deja crear dos
// cuentas con el mismo email, así que cada enlace sirve una sola vez: después
// el alumno entra desde la portada con su email y contraseña.

const DISCORD_URL = process.env.NEXT_PUBLIC_COMUNIDAD_URL ?? '#'

const INPUT =
  'w-full bg-base-panel2 border border-base-line rounded-[10px] px-3.5 py-3 text-[13px] text-base-text ' +
  'placeholder:text-base-muted outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors'

function RegistroForm() {
  const router = useRouter()
  const params = useSearchParams()
  const email = (params.get('email') ?? '').trim().toLowerCase()
  const token = params.get('t') ?? ''

  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const linkMissing = !email || !token

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading || linkMissing) return
    setError(null)
    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las dos contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      })
      if (!res.ok) {
        setError('Este enlace de invitación no es válido. Pedinos uno nuevo por Discord.')
        setLoading(false)
        return
      }
      await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
      router.push('/home')
    } catch (err) {
      setError(authErrorMessage((err as { code?: string }).code ?? ''))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <h2 className="font-display text-2xl font-bold text-base-text tracking-tight">Creá tu cuenta</h2>
      <p className="text-[13px] text-base-muted leading-relaxed mt-1.5 mb-[22px]">
        Elegí una contraseña. Después vas a entrar siempre con este email y esta contraseña.
      </p>

      {linkMissing ? (
        <div role="alert" className="callout callout-red flex-nowrap items-start gap-2.5 px-3.5 py-3 mb-3.5 text-[13px] leading-normal text-base-text">
          <AlertCircle size={16} className="text-neg shrink-0 mt-px" />
          <span>Este enlace de invitación está incompleto. Abrí el enlace completo que te mandamos o pedinos uno nuevo.</span>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label htmlFor="reg-email" className="block text-xs font-medium text-base-muted mb-1.5">Email</label>
            <input id="reg-email" type="email" value={email} readOnly className={`${INPUT} opacity-70 cursor-not-allowed`} />
          </div>

          <div className="mb-4">
            <label htmlFor="reg-password" className="block text-xs font-medium text-base-muted mb-1.5">Contraseña</label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null) }}
                placeholder="Mínimo 6 caracteres"
                className={`${INPUT} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-base-faint hover:text-base-text"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="mb-[18px]">
            <label htmlFor="reg-confirm" className="block text-xs font-medium text-base-muted mb-1.5">Repetí la contraseña</label>
            <input
              id="reg-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(null) }}
              placeholder="••••••••"
              className={INPUT}
            />
          </div>

          {error && (
            <div role="alert" className="callout callout-red flex-nowrap items-start gap-2.5 px-3.5 py-3 mb-3.5 text-[13px] leading-normal text-base-text">
              <AlertCircle size={16} className="text-neg shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-[13px] px-5 font-bold disabled:opacity-70 disabled:cursor-wait"
          >
            {loading ? (
              <>
                <span className="w-[15px] h-[15px] rounded-full border-2 border-white/35 border-t-white animate-spin" />
                Un momento…
              </>
            ) : 'Crear cuenta'}
          </button>
        </>
      )}

      <p className="text-center mt-[18px] text-[13px] text-base-faint">
        ¿Ya tenés cuenta?{' '}
        <a href="/" className="font-semibold text-base-text underline">Entrá acá</a>
        {' · '}
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-base-text underline">
          Ayuda
        </a>
      </p>
    </form>
  )
}

export default function RegistroPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-base-bg px-6 py-8">
      <div className="w-full max-w-[400px]">
        <div className="flex justify-center mb-7">
          <Logo size="lg" />
        </div>
        <Suspense fallback={null}>
          <RegistroForm />
        </Suspense>
      </div>
    </main>
  )
}
