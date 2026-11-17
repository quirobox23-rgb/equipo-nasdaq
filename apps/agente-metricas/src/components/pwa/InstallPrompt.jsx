import { useState, useEffect } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'

// ─────────────────────────────────────────────
//  INSTALL PROMPT — "Añadir a inicio", solo móvil
//
//  Usa el evento nativo `beforeinstallprompt` del navegador — que
//  SOLO existe en Chrome/Android (y derivados basados en Chromium).
//  Safari/iOS no lo implementa: ahí no aparece nada automático, es
//  una limitación real del navegador, no de esta implementación.
// ─────────────────────────────────────────────

const DISMISSED_KEY = 'nova-pwa-install-dismissed'

export default function InstallPrompt() {
  const isMobile = useIsMobile(768)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      if (localStorage.getItem(DISMISSED_KEY)) return
      setDeferredPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!isMobile || !visible || !deferredPrompt) return null

  const handleInstall = async () => {
    setVisible(false)
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12, bottom: 76, zIndex: 950,
      background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: 'var(--shadow)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Instalar NOVA Metrics</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Añádela a tu pantalla de inicio</div>
      </div>
      <button className="btn btn-primary btn-sm" onClick={handleInstall}>Instalar</button>
      <button onClick={handleDismiss} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>
    </div>
  )
}
