'use client'
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { Eye, EyeOff, Check, AlertCircle, MailCheck } from 'lucide-react'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { authErrorMessage } from '@/lib/studentSession'
import { Logo } from '@/components/Logo'

// Pantalla de acceso — la entrada de la app (src/app/page.tsx). Diseño del
// wireframe AccesoMacro (santos-trader-web/md/wireframes) y de la pantalla
// de acceso de Entropia Analytics (LoginScreen en AuthGate.jsx, 2026-10-07):
// panel con titular y beneficios a la izquierda, formulario sin caja a la
// derecha; debajo de 900px el panel se oculta y el logo sube al formulario.
//
// Como Entropia Analytics: Entrar, "¿No tenés cuenta? Creá una" y "¿Olvidaste
// tu contraseña?" (Firebase, email + contraseña). Cualquiera puede crear su
// cuenta; después pone el código gratis o el VIP, que decide qué secciones
// ve (ver src/lib/alumno.ts).

const DISCORD_URL = process.env.NEXT_PUBLIC_COMUNIDAD_URL ?? '#'

const INPUT =
  'w-full bg-base-panel2 border border-base-line rounded-[10px] px-3.5 py-3 text-[13px] text-base-text ' +
  'placeholder:text-base-muted outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors'

function Benefit({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      {/* Check simple (no IconCircle) para no competir con el logo, como en Métricas */}
      <Check size={18} strokeWidth={2.6} className="text-brand shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <span className="block text-base font-bold text-base-text mb-[3px]">{title}</span>
        <span className="text-sm text-base-muted leading-normal">{children}</span>
      </div>
    </div>
  )
}

export function LoginScreen() {
  const router = useRouter()
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [notice, setNotice]             = useState<string | null>(null)
  const [mode, setMode]                 = useState<'login' | 'signup'>('login')
  const signup = mode === 'signup'

  function switchMode() {
    setMode(signup ? 'login' : 'signup')
    setError(null)
    setNotice(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password || loading) return
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      if (signup) await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
      else await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
      router.push('/home')
    } catch (err) {
      setError(authErrorMessage((err as { code?: string }).code ?? ''))
      setLoading(false)
    }
  }

  async function resetPassword() {
    setError(null)
    setNotice(null)
    if (!email.trim()) {
      setError('Escribí tu email arriba y volvé a pulsar "¿Olvidaste tu contraseña?".')
      return
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim())
    } catch {
      /* no revelamos si el email existe o no */
    }
    setNotice('Si ese email tiene cuenta, te llegará un correo para crear una contraseña nueva.')
  }

  return (
    <div className="min-h-screen flex bg-base-bg">
      <aside
        className="hidden min-[900px]:flex flex-1 basis-1/2 flex-col justify-center p-16 border-r border-base-line bg-base-panel"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 12%, rgba(59,130,246,0.09), transparent 50%),' +
            'radial-gradient(circle at 85% 95%, rgba(30,64,175,0.12), transparent 55%)',
        }}
      >
        <div className="max-w-[520px] w-full mx-auto">
          <Logo size="lg" />
          <h1 className="font-display text-[clamp(34px,3.6vw,52px)] font-light uppercase leading-[1.1] tracking-tight text-base-text my-11">
            Aprendé a{' '}
            <span className="bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] bg-clip-text text-transparent font-black">
              leer el mercado
            </span>
          </h1>
          <div className="flex flex-col gap-[22px]">
            <Benefit title="Interpretá">Los datos económicos de la semana y qué significan para el NASDAQ.</Benefit>
            <Benefit title="Anticipá">Escenarios antes de cada dato: qué pasa si sale mejor o peor de lo esperado.</Benefit>
            <Benefit title="Decidí">Llegá a la sesión con el contexto macro claro, no con corazonadas.</Benefit>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 basis-1/2 items-center justify-center px-6 py-8">
        <div className="w-full max-w-[400px]">
          <div className="flex justify-center mb-7 min-[900px]:hidden">
            <Logo size="lg" />
          </div>

          <form onSubmit={submit}>
            <h2 className="font-display text-2xl font-bold text-base-text tracking-tight">
              {signup ? 'Creá tu cuenta' : 'Te damos la bienvenida'}
            </h2>
            <p className="text-[13px] text-base-muted leading-relaxed mt-1.5 mb-[22px]">
              {signup
                ? 'Creá tu cuenta con tu email y una contraseña.'
                : 'Accedé a tu cuenta para ver el contexto macro de la semana.'}
            </p>

            <div className="mb-4">
              <label htmlFor="login-email" className="block text-xs font-medium text-base-muted mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                placeholder="tu@email.com"
                className={INPUT}
              />
            </div>

            <div className="mb-2">
              <label htmlFor="login-password" className="block text-xs font-medium text-base-muted mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null) }}
                  placeholder="••••••••"
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

            {signup && <p className="text-xs text-base-faint mb-[18px]">Mínimo 6 caracteres.</p>}

            <div className={signup ? 'hidden' : 'flex justify-end mb-[18px]'}>
              <button
                type="button"
                onClick={resetPassword}
                className="text-xs text-base-faint underline hover:text-base-text"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {error && (
              <div role="alert" className="callout callout-red flex-nowrap items-start gap-2.5 px-3.5 py-3 mb-3.5 text-[13px] leading-normal text-base-text">
                <AlertCircle size={16} className="text-neg shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div role="status" className="callout callout-green flex-nowrap items-start gap-2.5 px-3.5 py-3 mb-3.5 text-[13px] leading-normal text-base-text">
                <MailCheck size={16} className="text-brand shrink-0 mt-px" />
                <span>{notice}</span>
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
              ) : signup ? 'Crear cuenta' : 'Entrar'}
            </button>

            <p className="text-center mt-[18px] text-[13px] text-base-faint">
              {signup ? '¿Ya tenés cuenta? ' : '¿No tenés cuenta? '}
              <button type="button" onClick={switchMode} className="font-semibold text-base-text underline">
                {signup ? 'Entrá' : 'Creá una'}
              </button>
            </p>

            <p className="text-center mt-2 text-[13px] text-base-faint">
              Acceso solo para alumnos.{' '}
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-base-text underline"
              >
                Contactanos
              </a>
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}
