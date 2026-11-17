'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { authErrorMessage } from '@/lib/studentSession'

// Formulario de entrada — reemplaza al botón "Entrar" por defecto de
// <Landing> (vía el prop `cta`) en la puerta de entrada (src/app/page.tsx).
// Igual que Agente Métricas: cada alumno entra con su email y su contraseña
// (Firebase Authentication). Sigue siendo solo por invitación: no hay
// registro público, las cuentas se crean desde la consola de Firebase
// (Authentication → Users → Add user). Independiente del admin password de
// Mentor IA.

export function AccessGateCta() {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [notice, setNotice]     = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password || loading) return
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] text-white text-base font-bold uppercase px-8 py-4 rounded-lg hover:opacity-85 transition-opacity"
      >
        Acceder
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 max-w-xs">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-muted uppercase tracking-wide">
          Email
        </label>
        <input
          autoFocus
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => { setEmail(e.target.value); setError(null) }}
          placeholder="tu@email.com"
          className="bg-base-panel border border-base-line rounded-lg px-4 py-3 text-base-text font-mono text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-muted uppercase tracking-wide">
          Contraseña
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(null) }}
            placeholder="••••••"
            className="flex-1 bg-base-panel border border-base-line rounded-lg px-4 py-3 text-base-text font-mono text-sm outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] text-white font-bold uppercase px-5 py-3 rounded-lg hover:opacity-85 transition-opacity disabled:opacity-50"
          >
            {loading ? '...' : 'Entrar'}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={resetPassword}
        className="self-start text-xs text-base-muted underline-offset-2 hover:underline hover:text-base-text"
      >
        ¿Olvidaste tu contraseña?
      </button>

      {error && <p className="text-xs text-neg">{error}</p>}
      {notice && <p className="text-xs text-base-muted">{notice}</p>}
    </form>
  )
}
