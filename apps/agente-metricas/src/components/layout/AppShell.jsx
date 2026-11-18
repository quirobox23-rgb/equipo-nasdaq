import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Home as HomeIcon, Wallet, History, BarChart3, Sun } from 'lucide-react'
import styles from './AppShell.module.css'
import LogoEntropia from './LogoEntropia'
import { useTheme, useToggleTheme, useStore } from '@/store/useStore'
import { NAVIGATION } from '@/config/navigation'
import TierBadge from '@/components/premium/TierBadge'
import { useAuthStore, useAuthUser } from '@/store/useAuthStore'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import PricingModal from '@/components/upgrade/PricingModal'

// Bottom nav (solo móvil, <=768px — ver AppShell.module.css) — 5
// accesos principales, misma navegación de siempre (NavLink), solo
// presentado distinto en pantallas estrechas.
const BOTTOM_NAV_ITEMS = [
  { to: '/hoy',         label: 'Hoy',         icon: HomeIcon },
  { to: '/rendimiento', label: 'Rendimiento', icon: BarChart3 },
  { to: '/diario',      label: 'Diario',      icon: History },
  { to: '/pulso',       label: 'Pulso',       icon: Sun },
  { to: '/cuentas',     label: 'Cuentas',     icon: Wallet },
]


// Navigation structure is now centralized in src/config/navigation.js
// This uses NAVIGATION constant which is imported above

// Íconos sol/luna — mismo trazo que el ThemeToggle de Entropia Markets
// (santos-trader-factor-macro/src/components/ThemeToggle.tsx), no son
// de lucide-react a propósito, para que el toggle se vea igual en las
// dos apps hermanas.
function IconSun(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2.5v2M10 15.5v2M3.6 3.6l1.4 1.4M15 15l1.4 1.4M2.5 10h2M15.5 10h2M3.6 16.4l1.4-1.4M15 5l1.4-1.4" />
    </svg>
  )
}
function IconMoon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16.5 12.3A6.8 6.8 0 0 1 7.7 3.5a6.8 6.8 0 1 0 8.8 8.8Z" />
    </svg>
  )
}

/**
 * Renders navigation items recursively
 * Supports nested items for grouped navigation
 */
function RenderNavItems({ items }) {
  if (!items || items.length === 0) return null

  return items.map((item) => {
    // Item disabled — preparado en navigation.js, no se borra el item
    // ni la ruta, solo se oculta del menú.
    if (item.disabled) return null

    // Item with nested items (group/section)
    if (item.items) {
      return (
        <div key={item.id} className={styles.navSection}>
          {item.label && <div className={styles.navLabel}>{item.label}</div>}
          <RenderNavItems items={item.items} />
        </div>
      )
    }

    // Flat item (direct route)
    if (item.to && item.icon) {
      const Icon = item.icon
      return (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <Icon className={styles.navIcon} />
          {item.label}
        </NavLink>
      )
    }

    return null
  })
}

// Barra de módulos del ecosistema Entropia (igual que en Entropia Markets):
// siempre en el mismo sitio y con los mismos tres destinos, para que
// orientarse no cueste esfuerzo.
const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
const IconIntelligence = (p) => (
  <svg viewBox="0 0 24 24" {...trazo} {...p}><circle cx="12" cy="12" r="2.4" /><circle cx="5" cy="6" r="1.6" /><circle cx="19" cy="6" r="1.6" /><circle cx="6" cy="18.5" r="1.6" /><circle cx="18" cy="18.5" r="1.6" /><path d="M6.3 7l3.9 3.4M17.7 7l-3.9 3.4M7.3 17.4l3-3.6M16.7 17.4l-3-3.6" /></svg>
)
const IconMarkets = (p) => (
  <svg viewBox="0 0 24 24" {...trazo} {...p}><circle cx="12" cy="12" r="8.5" /><ellipse cx="12" cy="12" rx="8.5" ry="3.4" transform="rotate(-25 12 12)" /><circle cx="12" cy="12" r="1.6" /></svg>
)
const IconAnalytics = (p) => (
  <svg viewBox="0 0 24 24" {...trazo} {...p}><path d="M4 19.5h16" /><path d="M6.5 16V11M11 16V6.5M15.5 16v-3.5M20 16V9" /></svg>
)
const IconFoco = (p) => (
  <svg viewBox="0 0 24 24" {...trazo} {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /></svg>
)
const MODULOS = [
  { id: 'intelligence', nombre: 'Atractor', Icon: IconIntelligence, href: import.meta.env.VITE_URL_INTELLIGENCE || '/oficina' },
  { id: 'markets', nombre: 'Contexto', Icon: IconMarkets, href: import.meta.env.VITE_URL_MARKETS || '/markets/home' },
  { id: 'analytics', nombre: 'Control', Icon: IconAnalytics, href: `${import.meta.env.BASE_URL}hoy`, activo: true },
]
const CLAVE_FOCO = 'entropia_foco'

/** Modo foco: sin animaciones ni adornos, solo la información. Se recuerda en este navegador. */
function useFoco() {
  const [foco, setFoco] = useState(() => {
    try { return localStorage.getItem(CLAVE_FOCO) === '1' } catch { return false }
  })
  useEffect(() => {
    document.documentElement.toggleAttribute('data-focus', foco)
    try { localStorage.setItem(CLAVE_FOCO, foco ? '1' : '0') } catch { /* sin almacenamiento */ }
  }, [foco])
  return [foco, setFoco]
}

function ModuleRail({ theme, toggleTheme }) {
  const [foco, setFoco] = useFoco()
  return (
    <aside className={styles.rail} aria-label="Módulos de Entropia">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className={styles.railIcon} />
      <nav className={styles.railNav}>
        {MODULOS.map(({ id, nombre, Icon, href, activo }) => (
          <a
            key={id}
            href={href || '#'}
            aria-current={activo ? 'page' : undefined}
            aria-disabled={!href}
            className={`${styles.railBtn} ${activo ? styles.railBtnActive : ''} ${!href ? styles.railBtnOff : ''}`}
            title={href ? nombre : `${nombre} (configura su dirección)`}
          >
            <Icon width={20} height={20} />
            <span>{nombre}</span>
          </a>
        ))}
      </nav>
      <div className={styles.railBottom}>
        <button type="button" className={`${styles.railBtn} ${foco ? styles.railBtnOn : ''}`} onClick={() => setFoco((f) => !f)} aria-pressed={foco} title="Modo foco: sin animaciones ni adornos">
          <IconFoco width={18} height={18} />
          <span>Foco</span>
        </button>
        <button
          type="button"
          className={styles.railBtn}
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        >
          {theme === 'light' ? <IconMoon width={18} height={18} /> : <IconSun width={18} height={18} />}
          <span>Tema</span>
        </button>
      </div>
    </aside>
  )
}

// Aviso cuando el servidor rechaza un guardado (antes solo iba a la consola)
function SyncErrorBanner() {
  const syncError = useStore(s => s.syncError)
  const clearSyncError = useStore(s => s.clearSyncError)
  if (!syncError) return null
  return (
    <div role="alert" style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 8, marginBottom: 14,
      fontSize: 12, background: 'var(--red2)', border: '1px solid rgba(227,114,114,0.2)', color: 'var(--red)',
    }}>
      <span style={{ flex: 1 }}>{syncError.text}</span>
      <button type="button" onClick={clearSyncError} aria-label="Cerrar aviso"
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
    </div>
  )
}

export default function AppShell({ children }) {
  const theme       = useTheme()
  const toggleTheme = useToggleTheme()
  const signOut     = useAuthStore((s) => s.signOut)
  const user        = useAuthUser()
  const navigate     = useNavigate()
  const [showPricing, setShowPricing] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)

  useEffect(() => {
    if (!accountOpen) return
    const onClickOutside = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [accountOpen])

  const initial = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className={styles.appShellV2}>
      <ModuleRail theme={theme} toggleTheme={toggleTheme} />

      <div className={styles.column}>
      {/* Barra superior flotante — logo + cuenta */}
      <header className={styles.topbar}>
        <button className={styles.brand} onClick={() => navigate('/')} aria-label="Ir a Home">
          <LogoEntropia alto={22} />
        </button>

        <div className={styles.topbarRight}>
          {/* Botón "Planes" desactivado (2026-10-07): los planes se venden
              en la web de venta. La ventana de planes sigue accesible desde
              "Mi plan" en el menú de la cuenta y desde las secciones
              bloqueadas. */}

          <div className={styles.accountMenu} ref={accountRef}>
            <button className={styles.accountTrigger} onClick={() => setAccountOpen((o) => !o)}>
              <span className={styles.accountAvatar}>{initial}</span>
              {user?.email && <span className={styles.topbarEmail}>{user.email}</span>}
              <TierBadge />
              <ChevronDown size={14} color="var(--text2)" style={{ transform: accountOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
            </button>

            {accountOpen && (
              <div className={styles.accountDropdown}>
                <button
                  className={styles.accountDropdownItem}
                  onClick={() => { setAccountOpen(false); setShowPricing(true) }}
                >
                  Mi plan
                </button>
                {isSupabaseConfigured && (
                  <button className={styles.accountDropdownItem} onClick={() => signOut()}>Cerrar sesión</button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={styles.appBody}>
      <aside className={styles.sidebar}>
        {/* Navigation */}
        <nav className={styles.nav}>
          {NAVIGATION.map((section) => (
            <div key={section.id} className={styles.navSection}>
              {section.label && <div className={styles.navLabel}>{section.label}</div>}
              <RenderNavItems items={section.items} />
            </div>
          ))}
        </nav>

        {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
      </aside>

      {/* Main */}
      <main className="main-content">
        <SyncErrorBanner />
        {children}
      </main>
      </div>
      </div>

      {/* Bottom nav — solo visible en móvil (ver AppShell.module.css).
          Al navegar, React Router desmonta la pantalla anterior — lo
          que ya cierra cualquier modal local que estuviera abierto. */}
      <nav className={styles.bottomNav}>
        {BOTTOM_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.bottomNavActive : ''}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
