'use client'
import { useEffect, useState } from 'react'
import { AlertCircle, Copy, Check } from 'lucide-react'
import { getStoredAdminPassword, setStoredAdminPassword } from '@/lib/adminSession'
import { Logo } from '@/components/Logo'

// /invitar — solo para el equipo (pide la clave de admin). Escribís el email
// del alumno que pagó y te da su enlace de invitación para mandárselo. Con
// ese enlace el alumno crea su cuenta en /registro (una sola por email).

const INPUT =
  'w-full bg-base-panel2 border border-base-line rounded-[10px] px-3.5 py-3 text-[13px] text-base-text ' +
  'placeholder:text-base-muted outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors'

export default function InvitarPage() {
  const [adminPassword, setAdminPassword] = useState('')
  const [email, setEmail]                 = useState('')
  const [link, setLink]                   = useState<string | null>(null)
  const [copied, setCopied]               = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  useEffect(() => {
    setAdminPassword(getStoredAdminPassword() ?? '')
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)
    setLink(null)
    setCopied(false)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No se pudo generar el enlace.')
      } else {
        setStoredAdminPassword(adminPassword)
        setLink(`${window.location.origin}/registro?email=${encodeURIComponent(data.email)}&t=${data.token}`)
      }
    } catch {
      setError('No se pudo generar el enlace.')
    }
    setLoading(false)
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      /* si el navegador no deja copiar, el enlace se puede seleccionar a mano */
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-base-bg px-6 py-8">
      <div className="w-full max-w-[460px]">
        <div className="flex justify-center mb-7">
          <Logo size="lg" />
        </div>

        <form onSubmit={submit}>
          <h2 className="font-display text-2xl font-bold text-base-text tracking-tight">Invitar alumno</h2>
          <p className="text-[13px] text-base-muted leading-relaxed mt-1.5 mb-[22px]">
            Escribí el email del alumno que pagó y mandale el enlace. Con él crea su cuenta (una sola por email).
          </p>

          <div className="mb-4">
            <label htmlFor="inv-admin" className="block text-xs font-medium text-base-muted mb-1.5">Clave de admin</label>
            <input
              id="inv-admin"
              type="password"
              required
              value={adminPassword}
              onChange={e => { setAdminPassword(e.target.value); setError(null) }}
              className={INPUT}
            />
          </div>

          <div className="mb-[18px]">
            <label htmlFor="inv-email" className="block text-xs font-medium text-base-muted mb-1.5">Email del alumno</label>
            <input
              id="inv-email"
              type="email"
              required
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); setLink(null) }}
              placeholder="alumno@email.com"
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
            {loading ? 'Un momento…' : 'Generar enlace'}
          </button>
        </form>

        {link && (
          <div className="mt-6">
            <label className="block text-xs font-medium text-base-muted mb-1.5">Enlace para {email.trim().toLowerCase()}</label>
            <div className="flex gap-2">
              <input readOnly value={link} onFocus={e => e.target.select()} className={`${INPUT} font-mono text-[12px]`} />
              <button
                type="button"
                onClick={copy}
                className="btn-primary px-4 shrink-0"
                aria-label="Copiar enlace"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            {copied && <p className="text-xs text-base-muted mt-1.5">Copiado. Pegáselo al alumno por Discord o email.</p>}
          </div>
        )}
      </div>
    </main>
  )
}
