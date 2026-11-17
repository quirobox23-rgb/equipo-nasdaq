import type { Metadata } from 'next'
import './globals.css'

const TITLE = 'Agente Macro · Equipo Nasdaq'
const DESCRIPTION = 'Agente Macro te dice cada semana qué eventos importan, qué espera el mercado y cuánto se puede mover el NQ. Menos ruido, más contexto para decidir.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    locale: 'es',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

// Script inline, bloqueante, para setear data-theme antes del primer pintado
// — evita el flash dark→light al cargar si el usuario ya eligió claro.
const themeInitScript = `
try {
  if (localStorage.getItem('agente_macro_theme') === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  }
} catch (e) {}
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-base-bg text-base-text antialiased font-body min-h-screen">
        {children}
      </body>
    </html>
  )
}
