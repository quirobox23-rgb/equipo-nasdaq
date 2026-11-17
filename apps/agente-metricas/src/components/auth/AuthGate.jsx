import { useState } from 'react'
import { Eye, EyeOff, Check, AlertCircle, MailCheck } from 'lucide-react'
import { useAuthStore, useAuthStatus } from '@/store/useAuthStore'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { IconCircle } from '@/components/ui'
import LogoEntropia from '@/components/layout/LogoEntropia'
import styles from './LoginScreen.module.css'

// ─────────────────────────────────────────────
//  AUTH GATE
//
//  Envuelve el área protegida de la app (todo lo que cuelga de
//  AppShell). Si no hay sesión, muestra login/signup en vez del
//  contenido. Si Supabase no está configurado (.env sin rellenar en
//  local), deja pasar igualmente para no romper el desarrollo de UI,
//  pero avisa en pantalla — nunca de forma silenciosa.
// ─────────────────────────────────────────────
export default function AuthGate({ children }) {
  const status = useAuthStatus()
  const recovering = useAuthStore((s) => s.recovering)

  if (!isSupabaseConfigured) {
    // Banner de aviso (dev-only, de Bego) desactivado a pedido — molestaba
    // durante el trabajo de diseño en local. Sigue sin romper nada: solo
    // no se renderiza el aviso, el resto del comportamiento (dejar pasar
    // sin backend real) queda igual. No se borra por si hace falta
    // reactivarlo:
    // <div style={{
    //   background: 'var(--amber2)', color: 'var(--amber)', fontSize: 12,
    //   padding: '8px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)',
    // }}>
    //   ⚠️ Supabase no está configurado (.env) — mostrando la app sin backend real, los datos no se guardan.
    // </div>
    return <>{children}</>
  }

  if (status === 'loading') {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--text3)', fontSize: 13,
      }}>
        Cargando…
      </div>
    )
  }

  // Entró desde el enlace de "recuperar contraseña": primero la nueva
  // contraseña, después la app.
  if (recovering) {
    return <LoginScreen initialMode="reset" />
  }

  if (status === 'signed-out') {
    return <LoginScreen />
  }

  return children
}

// ─────────────────────────────────────────────
//  Diseño anterior de la pantalla de acceso. Reemplazado por
//  LoginScreen (abajo, mockup aprobado 2026-10-05). Se conserva sin
//  usar por si hace falta volver atrás.
// ─────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function LoginScreenLegacy() {
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const authError = useAuthStore((s) => s.authError)

  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signupOk, setSignupOk] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSignupOk(false)
    if (mode === 'login') {
      await signIn(email, password)
    } else {
      const ok = await signUp(email, password)
      if (ok) setSignupOk(true)
    }
    setSubmitting(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <LogoEntropia alto={30} />
        </div>

      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', padding: 28 }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 22 }}>
          {mode === 'login'
            ? 'Accedé a tu cuenta para ver tus trades y métricas.'
            : 'Tus trades y cuentas quedan guardados en tu cuenta, no solo en este navegador.'}
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email" required value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
          />
        </div>
        <div className="form-group">
          <label>Contraseña</label>
          <input
            type="password" required value={password} minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {authError && (
          <div style={{
            fontSize: 12, color: 'var(--red)', background: 'var(--red2)',
            border: '1px solid rgba(255,90,106,0.2)', borderRadius: 8,
            padding: '8px 12px', marginBottom: 12,
          }}>
            {authError}
          </div>
        )}
        {signupOk && (
          <div style={{
            fontSize: 12, color: 'var(--brand)', background: 'var(--brand2)',
            border: '1px solid rgba(0,208,132,0.25)', borderRadius: 8,
            padding: '8px 12px', marginBottom: 12,
          }}>
            ✅ Cuenta creada. Revisá tu email para confirmar y luego entrá.
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px 20px', fontSize: 14, fontWeight: 700 }} disabled={submitting}>
          {submitting ? 'Un momento…' : (mode === 'login' ? 'Entrar' : 'Crear cuenta')}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setSignupOk(false) }}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text3)',
            fontSize: 12, cursor: 'pointer', marginTop: 14, textDecoration: 'underline',
            width: '100%', textAlign: 'center',
          }}
        >
          {mode === 'login' ? '¿No tenés cuenta? Creá una' : '¿Ya tenés cuenta? Entrá'}
        </button>
      </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  PANTALLA DE ACCESO — diseño nuevo (mockup aprobado en el repo
//  estático: mockups/acceso.html, variante "con panel").
//  Solo cambia la presentación: entrar y crear cuenta siguen usando
//  signIn / signUp de useAuthStore, igual que LoginScreenLegacy.
//  "¿Olvidaste tu contraseña?" manda el email de recuperación
//  (sendPasswordReset) y el enlace abre el modo "reset" para elegir
//  una contraseña nueva. Fuera por ahora: aceptar términos/privacidad.

// eslint-disable-next-line no-unused-vars
const DISCORD_URL = import.meta.env.VITE_COMUNIDAD_URL ?? '#'
// ─────────────────────────────────────────────

const LOGIN_COPY = {
  login:  { title: 'Te damos la bienvenida', sub: 'Accedé a tu cuenta para ver tus trades y métricas.', button: 'Entrar' },
  signup: { title: 'Creá tu cuenta', sub: 'Tus trades y cuentas quedan guardados en tu cuenta, no solo en este navegador.', button: 'Crear cuenta' },
  forgot: { title: 'Recuperá tu contraseña', sub: 'Te mandamos un enlace a tu email para elegir una contraseña nueva.', button: 'Enviar enlace' },
  reset:  { title: 'Nueva contraseña', sub: 'Elegí tu contraseña nueva para entrar.', button: 'Guardar contraseña' },
}

// Traduce los mensajes más comunes de Supabase; cualquier otro se
// muestra tal cual llega. Solo afecta el texto en pantalla.
function translateAuthError(message) {
  const m = (message || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Todavía no confirmaste tu email. Revisá tu bandeja de entrada (y la de spam).'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este email ya tiene una cuenta. Probá entrando.'
  if (m.includes('password should be at least')) return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (m.includes('invalid format') || (m.includes('email address') && m.includes('invalid'))) return 'El email no es válido.'
  if (m.includes('rate limit') || m.includes('for security purposes')) return 'Demasiados intentos seguidos. Esperá un momento y volvé a probar.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'
  if (m.includes('auth session missing') || m.includes('expired')) return 'El enlace caducó o ya se usó. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".'
  if (m.includes('should be different')) return 'La contraseña nueva tiene que ser distinta de la anterior.'
  return message
}

function LoginScreen({ initialMode = 'login' }) {
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset)
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const authError = useAuthStore((s) => s.authError)

  const [mode, setMode] = useState(initialMode) // 'login' | 'signup' | 'forgot' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signupOk, setSignupOk] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  // El error queda guardado en el store; se muestra solo después de
  // enviar en el modo actual (no al cambiar entre Entrar / Crear cuenta).
  const [showError, setShowError] = useState(false)
  const copy = LOGIN_COPY[mode]

  const switchMode = (next) => {
    setMode(next)
    setSignupOk(false)
    setShowError(false)
    setShowPassword(false)
    setResetSent(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSignupOk(false)
    if (mode === 'login') {
      await signIn(email, password)
    } else if (mode === 'forgot') {
      const ok = await sendPasswordReset(email)
      if (ok) setResetSent(true)
    } else if (mode === 'reset') {
      await updatePassword(password)
    } else {
      const ok = await signUp(email, password)
      if (ok) setSignupOk(true)
    }
    setShowError(true)
    setSubmitting(false)
  }

  const brand = (extraClass = '') => (
    <div className={`${styles.brand} ${extraClass}`}>
      <LogoEntropia alto={34} />
    </div>
  )

  // Check simple (no IconCircle) para no competir con el logo del panel
  const benefit = (title, text) => (
    <div className={styles.benefit}>
      <Check size={18} strokeWidth={2.6} className={styles.benefitCheck} aria-hidden="true" />
      <div>
        <span className={styles.benefitTitle}>{title}</span>
        <span className={styles.benefitText}>{text}</span>
      </div>
    </div>
  )

  return (
    <div className={styles.root}>
      <aside className={styles.panel}>
        <div className={styles.panelInner}>
          {brand()}
          <h1 className={styles.h1}>Convertí tus datos en <em>ventaja operativa</em></h1>
          {benefit('Analizá', 'Análisis profundo de todas tus métricas, en un solo lugar.')}
          {benefit('Comprendé', 'Patrones reales: descubrí cuándo y cómo rendís mejor.')}
          {benefit('Mejorá', 'Decisiones con datos: menos intuición, más ventaja operativa.')}
        </div>
      </aside>

      <main className={styles.formSide}>
        <div className={styles.formWrap}>
          {brand(styles.brandTop)}

          {resetSent ? (
            <div className={styles.sent}>
              <IconCircle icon={<MailCheck size={24} />} size={48} />
              <div className="page-title">Revisá tu email</div>
              <div className={`page-sub ${styles.sub}`}>
                Si <b>{email}</b> tiene una cuenta, te llegará un enlace para elegir una contraseña nueva. Mirá también en spam.
              </div>
              <button type="button" className={`btn btn-secondary ${styles.sentBtn}`} onClick={() => switchMode('login')}>
                Volver a entrar
              </button>
            </div>
          ) : signupOk ? (
            <div className={styles.sent}>
              <IconCircle icon={<MailCheck size={24} />} size={48} />
              <div className="page-title">Revisá tu email</div>
              <div className={`page-sub ${styles.sub}`}>
                Te enviamos un enlace a <b>{email}</b>. Hacé clic en él para confirmar tu cuenta y después entrá.
              </div>
              <button type="button" className={`btn btn-secondary ${styles.sentBtn}`} onClick={() => switchMode('login')}>
                Volver a entrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className="page-title">{copy.title}</div>
              <div className={`page-sub ${styles.sub}`}>{copy.sub}</div>

              {mode !== 'reset' && (
              <div className="form-group">
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email" type="email" required value={email} autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>
              )}
              {mode !== 'forgot' && (
              <div className="form-group">
                <label htmlFor="auth-password">{mode === 'reset' ? 'Contraseña nueva' : 'Contraseña'}</label>
                <div className={styles.inputWrap}>
                  <input
                    id="auth-password" type={showPassword ? 'text' : 'password'} required value={password} minLength={6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button" className={styles.eye}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode !== 'login' && <div className={styles.hint}>Mínimo 6 caracteres.</div>}
              </div>
              )}

              {mode === 'login' && (
                <div className={styles.forgotRow}>
                  <button
                    type="button" className={styles.forgot}
                    onClick={() => switchMode('forgot')}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {showError && authError && (
                <div className={`callout callout-red ${styles.alert}`} role="alert">
                  <AlertCircle size={16} />
                  <span>{translateAuthError(authError)}</span>
                </div>
              )}

              <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting}>
                {submitting ? <><span className={styles.spin} /> Un momento…</> : copy.button}
              </button>

              <div className={styles.foot}>
                {mode === 'reset' ? null : mode === 'forgot' ? (
                  <>¿Te acordaste? <button type="button" className={styles.link} onClick={() => switchMode('login')}>Entrá</button></>
                ) : mode === 'login' ? (
                  <>¿No tenés cuenta? <button type="button" className={styles.link} onClick={() => switchMode('signup')}>Creá una</button></>
                ) : (
                  <>¿Ya tenés cuenta? <button type="button" className={styles.link} onClick={() => switchMode('login')}>Entrá</button></>
                )}
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
