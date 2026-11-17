'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Lock, AlertCircle } from 'lucide-react'
import { useAlumno, type Nivel } from '@/lib/alumno'

// Lo que se ve en una sección que el nivel del usuario no abre: sin código
// pide cualquiera de los dos (gratis o VIP); con el gratis, pide el VIP.

const DISCORD_URL = process.env.NEXT_PUBLIC_COMUNIDAD_URL ?? '#'

const INPUT =
  'w-full bg-base-panel2 border border-base-line rounded-[10px] px-3.5 py-3 text-[13px] text-base-text ' +
  'placeholder:text-base-muted outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors'

export function LockedTab({ nivel }: { nivel: Nivel | null }) {
  const upgrade = nivel === 'gratis'
  const { activate } = useAlumno()
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || loading) return
    setLoading(true)
    setError(null)
    const ok = await activate(code)
    if (!ok) {
      setError('Código incorrecto. Revisalo o pedínoslo por Discord.')
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center py-16">
      <form onSubmit={submit} className="w-full max-w-[400px] text-center">
        <div className="mx-auto mb-5 w-12 h-12 rounded-full bg-base-panel2 border border-base-line flex items-center justify-center">
          <Lock size={20} className="text-base-muted" />
        </div>
        <h2 className="font-display text-2xl font-bold text-base-text tracking-tight">
          {upgrade ? 'Nivel Intermedio · alumnos VIP' : 'Poné tu código de acceso'}
        </h2>
        <p className="text-[13px] text-base-muted leading-relaxed mt-2 mb-6">
          {upgrade
            ? 'Con tu acceso Básico ves El Mercado Hoy y Eventos Económicos. Poné tu código VIP para desbloquear el nivel Intermedio: Volatilidad, Geopolítica y Análisis Semanal.'
            : 'Poné tu código gratuito o de alumno VIP para entrar. Solo hace falta una vez.'}
        </p>

        <input
          type="text"
          autoComplete="off"
          value={code}
          onChange={e => { setCode(e.target.value); setError(null) }}
          placeholder={upgrade ? 'Código VIP' : 'Código de acceso'}
          className={`${INPUT} text-center mb-3`}
        />

        {error && (
          <div role="alert" className="callout callout-red flex-nowrap items-start gap-2.5 px-3.5 py-3 mb-3 text-[13px] leading-normal text-base-text text-left">
            <AlertCircle size={16} className="text-neg shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="btn-primary w-full py-[13px] px-5 font-bold disabled:opacity-60"
        >
          {loading ? 'Un momento…' : 'Desbloquear'}
        </button>

        <p className="mt-[18px] text-[13px] text-base-faint">
          ¿No tenés código?{' '}
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-base-text underline">
            Escribinos
          </a>
          {upgrade && ' · '}
          {upgrade && <Link href="/home" className="font-semibold text-base-text underline">Volver a El Mercado Hoy</Link>}
        </p>
      </form>
    </div>
  )
}
